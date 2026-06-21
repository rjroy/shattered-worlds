import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { applyEffect } from "../engine/effects";
import { resolveForceDestroy } from "../engine/draw";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import type { CardEffect } from "../model/types";

const WORLD_ID = "the-tidal-archive";
const VALID_KEYWORDS = new Set(["Obstructed", "Creature", "Slow"]);
const REQUIRED_HOOKS = ["onDiscarded", "onCleared", "onPartialClear", "onEndOfTurn"] as const;

// The seven world cards Tidal authors itself (The Walker is a shared starter
// template and is intentionally excluded from these per-card assertions).
const TIDAL_WORLD_CARDS = [
  "Wandering Stacks",
  "Drowned Index",
  "Misfiled Century",
  "Bridge to Yesterday",
  "Borrowed Catastrophe",
  "Chained Books Rising",
  "The Same Footprint",
] as const;

describe("The Tidal Archive — registration and data shape (REQ-TIDAL-55)", () => {
  it("is registered in worldDataRegistry", () => {
    const ids = worldDataRegistry.map((bundle) => bundle.id);
    expect(ids).toContain(WORLD_ID);
  });

  it("buildWorld succeeds and carries the matching worldId", () => {
    const { worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
  });

  it("maps the world threat to The Same Footprint", () => {
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("The Same Footprint");
  });

  it("threads the Tidal Memory passive onto GameState.endOfTurnPassive", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    expect(worldData.onEndOfTurnPassive).toEqual({
      kind: "RecallPlayerDiscard",
      policy: "latest",
    });

    const { state } = createWorld(catalog, worldData, 1);
    expect(state.endOfTurnPassive).toEqual({
      kind: "RecallPlayerDiscard",
      policy: "latest",
    });
  });

  it("has no duplicate deck-composition template ids per act position", () => {
    const { worldData } = buildWorld(WORLD_ID);
    // A duplicate *template id* across acts is legal (a hazard can recur), but a
    // template appearing twice in the same act-card list would be an authoring
    // slip. Assert each act has unique templateIds within its own list.
    for (const act of worldData.deckComposition.acts) {
      const ids = act.cards.map((c) => c.templateId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("defines all four hooks and only valid keywords on every Tidal world card", () => {
    const { catalog } = buildWorld(WORLD_ID);
    for (const id of TIDAL_WORLD_CARDS) {
      const template = catalog[id];
      expect(template).toBeDefined();
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const hook of REQUIRED_HOOKS) {
        expect(template[hook]).toBeDefined();
      }
      for (const keyword of template.keywords) {
        // Authored as "Name" or "Name:N"; the keyword identity is the name part.
        const name = keyword.split(":")[0]!;
        expect(VALID_KEYWORDS.has(name)).toBe(true);
      }
    }
  });

  it("ends act 3 with exactly one The Walker", () => {
    const { worldData } = buildWorld(WORLD_ID);
    const acts = worldData.deckComposition.acts;
    expect(acts).toHaveLength(3);
    const finalAct = acts[acts.length - 1]!;
    const lastCard = finalAct.cards[finalAct.cards.length - 1]!;
    expect(lastCard.templateId).toBe("The Walker");
    expect(lastCard.count).toBe(1);
  });
});

describe("The Tidal Archive — review-correction hooks drive the reducer (REQ-TIDAL-55)", () => {
  it("Drowned Index onCleared offers a boon from tidal-boons, not a fixed grant", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const drownedIndex = catalog["Drowned Index"];
    expect(drownedIndex?.kind).toBe("world");
    if (drownedIndex === undefined || drownedIndex.kind !== "world") return;

    expect(drownedIndex.onCleared.kind).toBe("OfferBoon");

    const { state } = createWorld(catalog, worldData, 7);
    const before = state.pendingBoonChoices.length;
    const result = applyEffect(catalog, state, drownedIndex.onCleared);

    // A boon offer, not a two-card grant: the discard pile stays empty and a
    // pending choice is queued sourced from the tidal-boons set.
    expect(result.state.playerDiscard).toHaveLength(0);
    expect(result.state.pendingBoonChoices.length).toBe(before + 1);
    const pending = result.state.pendingBoonChoices[result.state.pendingBoonChoices.length - 1]!;
    expect(pending.setId).toBe("tidal-boons");

    const offered = result.events.find((e) => e.type === "BoonOffered");
    expect(offered).toBeDefined();
    if (offered?.type === "BoonOffered") {
      expect(offered.setId).toBe("tidal-boons");
    }
  });

  it("Chained Books Rising onEndOfTurn queues a ForceDestroy (not HP damage), absorbed by Brace", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const chained = catalog["Chained Books Rising"];
    expect(chained?.kind).toBe("world");
    if (chained === undefined || chained.kind !== "world") return;

    const { state } = createWorld(catalog, worldData, 3);
    const startHp = state.hp;

    const { state: afterHook, events } = applyEffect(catalog, state, chained.onEndOfTurn);

    // The snatch is queued, not dealt as HP damage.
    expect(afterHook.pendingForceDestroy).toBeGreaterThan(0);
    expect(afterHook.hp).toBe(startHp);
    expect(events.some((e) => e.type === "DamageDealt")).toBe(false);

    // A Brace charge absorbs the snatch end-to-end: no card is destroyed.
    const braced = { ...afterHook, braceCharges: 1 };
    const resolved = resolveForceDestroy(braced);
    expect(resolved.events.some((e) => e.type === "BraceConsumed")).toBe(true);
    expect(resolved.events.some((e) => e.type === "CardDestroyed")).toBe(false);
    expect(resolved.state.pendingForceDestroy).toBe(0);
    expect(resolved.state.braceCharges).toBe(0);
  });

  it("Bridge to Yesterday onCleared top-decks a Misfiled Century onto the world deck", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const bridge = catalog["Bridge to Yesterday"];
    expect(bridge?.kind).toBe("world");
    if (bridge === undefined || bridge.kind !== "world") return;

    const onCleared: CardEffect = bridge.onCleared;
    expect(onCleared).toEqual({
      kind: "AddWorldCardToDeck",
      template: "Misfiled Century",
      bTop: true,
    });

    const { state } = createWorld(catalog, worldData, 5);
    const beforeTopCount = state.worldDraw.length;
    const result = applyEffect(catalog, state, onCleared);

    expect(result.state.worldDraw.length).toBe(beforeTopCount + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Misfiled Century");
  });
});
