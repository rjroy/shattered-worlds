import { describe, expect, it } from "bun:test";
import { previewAction } from "../view/actionPreview";
import { FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";
import type { CardEffect, GameEvent, GameState } from "../model/types";

/**
 * Fail-closed observability conformance suite.
 *
 * THE AUDIT-TWO-AXES RULE. Every new effect that can surface in a preview must
 * be checked against BOTH observability axes, because either one leaking is a
 * leak the player can exploit:
 *
 *   (a) rng consumers — any handler that calls `shuffle`/`nextFloat`/`weightedDraw`
 *       to PICK card identities or an outcome must stamp its event `randomized:
 *       true`. Audited sites today: resolveForceDestroy (CardDestroyed),
 *       FreezeCardsHandler (CardsFrozen), GainRandomCardHandler (CardGained),
 *       RecallPlayerDiscardHandler policy "random" (PlayerDiscardRecalled),
 *       createBoonOffer for BOTH the act and world-clear sources (BoonOffered).
 *
 *   (b) hidden-zone readers — any handler that REVEALS cards out of a hidden
 *       collection (playerDraw, worldDraw, or a future unreached `acts` deck)
 *       must stamp its event `revealedFromHidden: true`. Audited sites today:
 *       drawPlayer (CardsDrawn bHazard:false), drawWorld (CardsDrawn bHazard:true
 *       + HazardAdded), ExileTopWorldCardsHandler (WorldCardsExiled).
 *
 * An event that reaches the preview from EITHER axis WITHOUT its stamp is a
 * leak: `actionPreview` would fall through to its named summary and print the
 * rng-chosen / hidden card's identity to the player before they commit. This
 * suite drives each audited path through the real `previewAction` and asserts
 * two things at once: the produced event carries the expected stamp, AND the
 * rendered summary never names the cards that axis is supposed to hide.
 *
 * When you add a new effect, add a case here on whichever axis (or both) applies.
 * If you cannot decide which axis it is on, it is probably on both.
 */

const FORTUNE_POOL = FORTUNE_BOON_POOLS["pool-fortune"] ?? [];

/** Run the real preview and return both the preview and its joined summary. */
function preview(state: GameState, action: Parameters<typeof previewAction>[2]) {
  const result = previewAction(catalog, state, action);
  return { preview: result, text: result.summaryLines.join("\n") };
}

/** Assert none of the given names/templateIds appear anywhere in the summary. */
function expectNoNames(text: string, names: readonly string[]): void {
  for (const name of names) {
    expect(text).not.toContain(name);
  }
}

describe("observability conformance (fail-closed)", () => {
  // -------------------------------------------------------------------------
  // Axis (a): rng consumers must stamp `randomized`.
  // -------------------------------------------------------------------------

  it("force-destroy: CardDestroyed is randomized and never names the snatched loot", () => {
    // A VISIBLE world card queues an rng ForceDestroy; resolveForceDestroy drains
    // it against the just-refilled hand at turn start (within this EndTurn).
    const snatcher = makeWorldCard({
      id: "open-snatcher",
      templateId: "Open Snatcher",
      name: "Open Snatcher",
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const loot = Array.from({ length: 5 }, (_, i) =>
      makePlayerCard({ id: `loot-${i}`, templateId: `Loot ${i}`, name: `Loot ${i}` }),
    );
    const state = makeState({ hand: [snatcher], playerDraw: loot, light: 0 });

    const { preview: p, text } = preview(state, { type: "EndTurn" });

    const destroyed = p.events.find((e) => e.type === "CardDestroyed");
    expect(destroyed).toBeDefined();
    expect(destroyed?.randomized).toBe(true);
    // Name-free: generic count copy, never the rng-chosen victim.
    expect(text).toContain("Destroy 1 player card");
    expectNoNames(
      text,
      loot.map((c) => c.name),
    );
  });

  it("freeze-at-random: CardsFrozen is randomized and never names the frozen cards", () => {
    const freezer = makePlayerCard({
      id: "freeze-tool",
      templateId: "Freeze Tool",
      name: "Freeze Tool",
      effect: { kind: "FreezeCards", amount: 2, duration: 1 },
    });
    const targetA = makePlayerCard({ id: "target-a", templateId: "Target A", name: "Target A" });
    const targetB = makePlayerCard({ id: "target-b", templateId: "Target B", name: "Target B" });
    const state = makeState({ hand: [freezer, targetA, targetB], light: 0 });

    const { preview: p, text } = preview(state, { type: "PlayCard", cardId: freezer.id });

    const frozen = p.events.find((e) => e.type === "CardsFrozen");
    expect(frozen).toBeDefined();
    expect(frozen?.randomized).toBe(true);
    expect(text).toContain("Freeze 2 cards at random");
    expectNoNames(text, ["Target A", "Target B"]);
  });

  it("gain-random: CardGained is randomized and names only the pool, never the rolled template", () => {
    const explore = makePlayerCard({
      id: "explore",
      templateId: "Explore",
      name: "Explore",
      effect: { kind: "DealProgress", base: 1 },
    });
    const cache = makeWorldCard({
      id: "cache-hazard",
      templateId: "Cache Hazard",
      name: "Cache Hazard",
      cost: 1,
      onCleared: { kind: "GainRandomCard", setId: "pool-fortune", setName: "the cache" },
    });
    const state = makeState({ hand: [explore, cache], progress: {} });

    const { preview: p, text } = preview(state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: cache.id,
    });

    const gained = p.events.find((e) => e.type === "CardGained");
    expect(gained).toBeDefined();
    expect(gained?.randomized).toBe(true);
    expect(text).toContain("Gain a random card from the cache");
    // The pool's rolled template must not leak.
    expectNoNames(text, FORTUNE_POOL);
  });

  describe("random recall: only policy 'random' stamps PlayerDiscardRecalled", () => {
    function recallPreview(
      policy: NonNullable<Extract<CardEffect, { kind: "RecallPlayerDiscard" }>["policy"]>,
    ) {
      const recaller = makePlayerCard({
        id: "recall-tool",
        templateId: "Recall Tool",
        name: "Recall Tool",
        effect: { kind: "RecallPlayerDiscard", count: 1, policy },
      });
      // Discard cards with distinct names so a leak would be visible.
      const discard = Array.from({ length: 3 }, (_, i) =>
        makePlayerCard({
          id: `disc-${i}`,
          templateId: `Discard ${i}`,
          name: `Discard ${i}`,
          energyCost: i,
        }),
      );
      const state = makeState({ hand: [recaller], playerDiscard: discard });
      return preview(state, { type: "PlayCard", cardId: recaller.id });
    }

    it("random policy stamps randomized and never names the recalled discard", () => {
      const { preview: p, text } = recallPreview("random");
      const recalled = p.events.find((e) => e.type === "PlayerDiscardRecalled");
      expect(recalled).toBeDefined();
      expect(recalled?.randomized).toBe(true);
      // The pre-existing discard cards must not be named (the just-played
      // "Recall Tool" legitimately appears in the "Play ..." line).
      expectNoNames(text, ["Discard 0", "Discard 1", "Discard 2"]);
    });

    for (const policy of ["latest", "lowestCost", "highestCost", "panicFirst"] as const) {
      it(`deterministic policy '${policy}' carries NO randomized stamp`, () => {
        const { preview: p } = recallPreview(policy);
        const recalled = p.events.find((e) => e.type === "PlayerDiscardRecalled");
        expect(recalled).toBeDefined();
        expect(recalled?.randomized).toBeUndefined();
      });
    }
  });

  it("world-clear boon: BoonOffered is randomized and names only the pool", () => {
    const explore = makePlayerCard({
      id: "explore",
      templateId: "Explore",
      name: "Explore",
      effect: { kind: "DealProgress", base: 1 },
    });
    const shrine = makeWorldCard({
      id: "boon-shrine",
      templateId: "Boon Shrine",
      name: "Boon Shrine",
      cost: 1,
      onCleared: {
        kind: "OfferBoon",
        setId: "pool-fortune",
        setName: "Clear Cache",
        offeredCount: 3,
        chooseCount: 1,
      },
    });
    const state = makeState({ hand: [explore, shrine], progress: {} });

    const { preview: p, text } = preview(state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: shrine.id,
    });

    const offered = p.events.find((e) => e.type === "BoonOffered");
    expect(offered).toBeDefined();
    expect(offered?.randomized).toBe(true);
    expect(offered?.type === "BoonOffered" && offered.source).toBe("worldClear");
    expect(text).toContain("Boon offered from Clear Cache");
    expectNoNames(text, FORTUNE_POOL);
  });

  it("act boon: BoonOffered is randomized and names only the pool", () => {
    // EndTurn drains worldDraw, so the refill advances into the queued act,
    // emitting ActAdvanced; the act-boon cascade then offers a boon. This is the
    // SECOND createBoonOffer caller (the act source), with its `act` field.
    const actHazard = makeWorldCard({
      id: "act-hazard",
      templateId: "Act Hazard",
      name: "Act Hazard",
    });
    const players = Array.from({ length: 4 }, (_, i) =>
      makePlayerCard({ id: `pc-${i}`, templateId: `Player ${i}`, name: `Player ${i}` }),
    );
    const base = makeState({ worldDraw: [], acts: [[actHazard]], playerDraw: players, light: 0 });
    const state: GameState = {
      ...base,
      runModifiers: {
        ...base.runModifiers,
        actBoon: {
          poolId: "pool-fortune",
          poolName: "Act Cache",
          poolTemplateIds: FORTUNE_POOL,
          offeredCount: 3,
          chooseCount: 1,
        },
      },
    };

    const { preview: p, text } = preview(state, { type: "EndTurn" });

    const offered = p.events.find((e) => e.type === "BoonOffered");
    expect(offered).toBeDefined();
    expect(offered?.randomized).toBe(true);
    expect(offered?.type === "BoonOffered" && offered.source).toBe("act");
    expect(text).toContain("Boon offered from Act Cache");
    // Neither the offered pool nor the act hazard surfaced from the hidden act.
    expectNoNames(text, [...FORTUNE_POOL, "Act Hazard"]);
  });

  // -------------------------------------------------------------------------
  // Axis (b): hidden-zone readers must stamp `revealedFromHidden`.
  // -------------------------------------------------------------------------

  it("world + player draws: refill CardsDrawn carry revealedFromHidden and name nothing", () => {
    const hazard = makeWorldCard({
      id: "secret-hazard",
      templateId: "Secret Hazard",
      name: "Secret Hazard",
    });
    const hidden = Array.from({ length: 4 }, (_, i) =>
      makePlayerCard({ id: `hidden-${i}`, templateId: `Hidden ${i}`, name: `Hidden ${i}` }),
    );
    const state = makeState({ hand: [], worldDraw: [hazard], playerDraw: hidden, light: 0 });

    const { preview: p, text } = preview(state, { type: "EndTurn" });

    const worldDrawn = p.events.find(
      (e): e is Extract<GameEvent, { type: "CardsDrawn" }> => e.type === "CardsDrawn" && e.bHazard,
    );
    const playerDrawn = p.events.find(
      (e): e is Extract<GameEvent, { type: "CardsDrawn" }> => e.type === "CardsDrawn" && !e.bHazard,
    );

    expect(worldDrawn?.revealedFromHidden).toBe(true);
    expect(playerDrawn?.revealedFromHidden).toBe(true);
    // HazardAdded (the other drawWorld emit) is also stamped.
    const hazardAdded = p.events.find((e) => e.type === "HazardAdded");
    expect(hazardAdded?.revealedFromHidden).toBe(true);

    expect(text).toMatch(/Draw \d+ world card/);
    expect(text).toMatch(/Draw \d+ player card/);
    expectNoNames(text, ["Secret Hazard", ...hidden.map((c) => c.name)]);
  });

  it("exile top world cards: WorldCardsExiled carries revealedFromHidden and names nothing", () => {
    const exiler = makePlayerCard({
      id: "exile-tool",
      templateId: "Exile Tool",
      name: "Exile Tool",
      effect: { kind: "ExileTopWorldCards", amount: 2 },
    });
    const topZombie = makeWorldCard({ id: "top-zombie", templateId: "Zombie", name: "Zombie" });
    const topRubble = makeWorldCard({ id: "top-rubble", templateId: "Rubble", name: "Rubble" });
    const state = makeState({ hand: [exiler], worldDraw: [topZombie, topRubble] });

    const { preview: p, text } = preview(state, { type: "PlayCard", cardId: exiler.id });

    const exiled = p.events.find((e) => e.type === "WorldCardsExiled");
    expect(exiled).toBeDefined();
    expect(exiled?.revealedFromHidden).toBe(true);
    expect(text).toContain("Exile top 2 world cards");
    expectNoNames(text, ["Zombie", "Rubble"]);
  });

  // -------------------------------------------------------------------------
  // Known unemitted event.
  // -------------------------------------------------------------------------

  // CardsBurnedForHeat is defined in the GameEvent union and handled by the
  // preview, but NO core handler emits it today (verified: no `type:
  // "CardsBurnedForHeat"` emit site exists outside model/types and the preview).
  // It reads player cards burned for Heat, so the day an emitter lands it sits
  // on BOTH axes: it consumes rng to pick victims (stamp `randomized`) and may
  // reveal them from a hidden zone (stamp `revealedFromHidden`). This pending
  // test marks that obligation; turn it into a real case when the emitter ships.
  it.skip("CardsBurnedForHeat must stamp randomized once an emitter exists", () => {
    expect(true).toBe(true);
  });
});
