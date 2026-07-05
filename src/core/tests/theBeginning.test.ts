import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { dealProgress } from "../effects/dealProgress";
import { effectiveWorldCardCost } from "../engine/effectiveCards";
import { applyEffect } from "../engine/effects";
import { createGame } from "../engine/game";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { mintCard } from "../model/cards";
import { appliedKeywordValue } from "../model/keywords";
import type { KeywordName, WorldCard } from "../model/types";

const WORLD_ID = "the-beginning";

// World-authored world card templates (excludes the shared Destiny and The
// Walker templates, which are reused/starter entities, not authored here).
const WORLD_CARDS = [
  "It's Fine, Actually",
  "Somebody Else Will Handle It",
  "A Story You've Told Yourself",
  "Somebody Should Be Mad About This",
  "Every Excuse Sounds Thinner",
  "One More Excuse",
  "A Smaller Ask",
  "It's Not So Bad",
  "Terms You Already Know",
  "The Same Tired Weight",
  "He's Still Fighting",
  "The Weight You're Still Carrying",
] as const;

const REQUIRED_HOOKS = [
  "onDiscarded",
  "onCleared",
  "onPartialClear",
  "onEndOfTurn",
  "onDraw",
] as const;

// Denial/Anger/Bargaining/Depression appear only as applied keywords on these
// cards (via onDraw's ApplyKeyword{target:"self"}); none of them is authored
// statically in `keywords`. Obstructed is the shared tool-fetch keyword this
// world also uses, same as questions/answers.
const VALID_KEYWORDS = new Set(["Obstructed"]);

function worldTemplate(id: (typeof WORLD_CARDS)[number]) {
  const template = buildWorld(WORLD_ID).catalog[id];
  if (template?.kind !== "world") throw new Error(`${id} missing`);
  return template;
}

function playerTemplate(id: string) {
  const template = buildWorld(WORLD_ID).catalog[id];
  if (template?.kind !== "player") throw new Error(`${id} missing`);
  return template;
}

describe("The Beginning world data", () => {
  it("registers, builds, maps its threat, and ends act 3 with the no-door Walker", () => {
    expect(worldDataRegistry.map((bundle) => bundle.id)).toContain(WORLD_ID);
    const { catalog, worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
    expect(new Set(Object.keys(catalog)).size).toBe(Object.keys(catalog).length);
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("Destiny");
    expect(worldData.deckComposition.acts).toHaveLength(3);
    expect(worldData.deckComposition.acts.at(-1)?.cards.at(-1)).toEqual({
      templateId: "Grief",
      count: 1,
    });

    // REQ-W15-6: the companion-figure reflavor is flavor text only — confirm
    // no card in this world's own authoring reuses "The Walker" template id
    // for the companion figure (duplicate ids would also throw in buildWorld,
    // but this asserts the intent directly rather than relying on that as a
    // side effect).
    expect(WORLD_CARDS as readonly string[]).not.toContain("The Walker");
    expect(catalog["Grief"]?.name).toBe("The Walker");
  });

  it("defines all five hooks and valid keywords on each world card", () => {
    for (const id of WORLD_CARDS) {
      const template = worldTemplate(id);
      for (const hook of REQUIRED_HOOKS) expect(template[hook]).toBeDefined();
      for (const keyword of template.keywords) {
        expect(VALID_KEYWORDS.has(keyword.split(":")[0]!)).toBe(true);
      }
    }
  });
});

// This plan's central mechanic (see the-beginning.md's deviation section):
// every grief-release reward card strips its keyword from a hand card AND, in
// the same effect Sequence, applies Acceptance:2 to Destiny by name via the
// preferWorldCardByTemplateId ApplyKeyword target — a no-op if Destiny isn't
// in hand, deterministic and never leaking onto any other card (e.g. Door).
describe("The Beginning isolate effects — RemoveKeyword + Acceptance-onto-Destiny", () => {
  const cases: readonly [reward: string, keyword: KeywordName, carrierTemplateId: string][] = [
    ["Say It Out Loud", "Denial", "It's Fine, Actually"],
    ["Put It Down", "Anger", "Somebody Else Will Handle It"],
    ["Close the Book On It", "Bargaining", "A Smaller Ask"],
    ["Set It Down", "Depression", "It's Not So Bad"],
  ];

  it.each(cases)(
    "%s removes %s from its carrier and applies Acceptance:2 to Destiny",
    (reward, keyword, carrierTemplateId) => {
      const { catalog, worldData } = buildWorld(WORLD_ID);
      const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);

      const [destinyCard, afterDestiny] = mintCard(catalog, base, "Destiny");
      const [carrierCard, afterCarrier] = mintCard(catalog, afterDestiny, carrierTemplateId);
      if (destinyCard.kind !== "world" || carrierCard.kind !== "world") {
        throw new Error(`${carrierTemplateId} and Destiny must mint world cards`);
      }
      expect(destinyCard.keywords).toEqual([]);

      const griefCarrier: WorldCard = {
        ...carrierCard,
        appliedKeywords: [{ name: keyword, value: 1 }],
      };
      const state = { ...afterCarrier, hand: [destinyCard, griefCarrier], worldDraw: [] };

      const result = applyEffect(catalog, state, playerTemplate(reward).effect);

      const destinyAfter = result.state.hand.find((c) => c.id === destinyCard.id);
      const carrierAfter = result.state.hand.find((c) => c.id === griefCarrier.id);
      if (destinyAfter?.kind !== "world" || carrierAfter?.kind !== "world") {
        throw new Error("Destiny and the carrier must remain world cards");
      }

      // The grief keyword is gone from its carrier...
      expect(appliedKeywordValue(carrierAfter, keyword)).toBe(0);
      // ...and Destiny picked up Acceptance:2, exactly zeroing its
      // unmodified cost of 15 on first contact (the design doc's chosen
      // value — see the-beginning-card-design.md).
      expect(appliedKeywordValue(destinyAfter, "Acceptance")).toBe(2);
      expect(effectiveWorldCardCost(destinyAfter, result.state)).toBe(13);
    },
  );

  it("is a no-op on Acceptance when Destiny isn't in hand yet (Acts I/II, before Destiny is drawn)", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const [carrierCard, afterCarrier] = mintCard(catalog, base, "It's Fine, Actually");
    if (carrierCard.kind !== "world") throw new Error("It's Fine, Actually must mint a world card");

    const griefCarrier: WorldCard = {
      ...carrierCard,
      appliedKeywords: [{ name: "Denial", value: 1 }],
    };
    const state = { ...afterCarrier, hand: [griefCarrier], worldDraw: [] };

    const result = applyEffect(catalog, state, playerTemplate("Say It Out Loud").effect);

    // Denial is still stripped from the carrier...
    const carrierAfter = result.state.hand.find((c) => c.id === griefCarrier.id);
    if (carrierAfter?.kind !== "world") throw new Error("carrier must remain a world card");
    expect(appliedKeywordValue(carrierAfter, "Denial")).toBe(0);
    // ...but there is nothing in hand named "Destiny" for the ApplyKeyword
    // step to match, so it silently no-ops rather than throwing.
    expect(result.state.hand.some((c) => c.kind === "world" && c.templateId === "Destiny")).toBe(
      false,
    );
  });
});

// This world is the first to put both shared threat-style templates in play
// at once: Destiny (drawn from the deck composition) and Door (added later via
// The Walker's onDiscarded/onCleared). Both carry onCleared: SurviveWorld.
// Neither questions nor answers had precedent for this — each uses only
// Destiny, and Door only ever appears alongside The Walker in worlds that
// don't also carry Destiny. Confirm the two clear paths are fully independent:
// resolving one leaves the other's card, progress, and onCleared hook intact.
describe("The Beginning — Door and Destiny onCleared are independent SurviveWorld paths", () => {
  it("clearing Door does not consume or disable Destiny's own SurviveWorld path, and vice versa", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);

    const [destinyCard, afterDestiny] = mintCard(catalog, base, "Destiny");
    const [doorCard, afterDoor] = mintCard(catalog, afterDestiny, "Door");
    if (destinyCard.kind !== "world" || doorCard.kind !== "world") {
      throw new Error("Destiny and Door must mint world cards");
    }

    const state = { ...afterDoor, hand: [destinyCard, doorCard], worldDraw: [], progress: {} };

    // Resolve Door first (authored cost 4) — its own onCleared fires...
    const afterDoorClear = dealProgress(catalog, state, doorCard.id, 4, applyEffect);
    expect(afterDoorClear.state.status).toBe("won");
    expect(
      afterDoorClear.events.some((e) => e.type === "HazardResolved" && e.templateId === "Door"),
    ).toBe(true);

    // ...and Destiny is untouched: still in hand, still at zero progress, its
    // own onCleared path is neither consumed nor disabled by Door's clear.
    expect(afterDoorClear.state.hand.some((c) => c.id === destinyCard.id)).toBe(true);
    expect(afterDoorClear.state.progress[destinyCard.id] ?? 0).toBe(0);

    // Now resolve Destiny (authored cost 15) from the post-Door state — its
    // SurviveWorld path fires normally, proving Door's earlier clear never
    // disabled it.
    const afterDestinyClear = dealProgress(
      catalog,
      afterDoorClear.state,
      destinyCard.id,
      15,
      applyEffect,
    );
    expect(afterDestinyClear.state.status).toBe("won");
    expect(afterDestinyClear.events.some((e) => e.type === "WorldWon")).toBe(true);
    expect(
      afterDestinyClear.events.some(
        (e) => e.type === "HazardResolved" && e.templateId === "Destiny",
      ),
    ).toBe(true);
    expect(afterDestinyClear.state.hand.some((c) => c.id === destinyCard.id)).toBe(false);
  });
});

// Regression for a live playtest crash: logEvent()'s switch handled
// "KeywordRemoved" but not "KeywordReduced", so any dispatch() turn boundary
// that decayed a non-persistent applied keyword (Denial/Anger/Bargaining/
// Depression/Alarm/Acceptance) by one step — without fully expiring it —
// threw "logEvent: unhandled event type KeywordReduced". Every prior keyword/
// decay test drove tickAppliedKeywordsAtTurnStart or reduce() directly, so
// logEvent (only invoked from GameCore.dispatch's
// `result.events.forEach(logEvent)`, see engine/game.ts) was never exercised
// by a decay scenario. This world is the natural home for the regression:
// Anger is authored here via onDraw ApplyKeyword{target:"self"} and decays
// one turn later since it isn't in PERSISTENT_KEYWORDS.
describe("The Beginning — dispatch() regression: applied-keyword decay reaches logEvent", () => {
  it("EndTurn decaying an applied grief keyword does not throw", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    // Seed pinned because it deterministically draws an Anger-applying hazard
    // into hand on the opening deal and decays it (2 -> 1, a KeywordReduced)
    // on the second
    // EndTurn — reproducing the exact event type that crashed logEvent.
    const game = createGame(catalog, worldData, 27, DEFAULT_RUN_MODIFIERS);

    const keywordsReduced: string[] = [];
    expect(() => {
      for (let turn = 0; turn < 2; turn++) {
        const { events } = game.dispatch({ type: "EndTurn" });
        for (const event of events) {
          if (event.type === "KeywordReduced") keywordsReduced.push(event.keyword);
        }
      }
    }).not.toThrow();

    expect(keywordsReduced).toContain("Anger");
  });
});
