import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { effectiveWorldCardCost } from "../engine/effectiveCards";
import { applyEffect } from "../engine/effects";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { mintCard } from "../model/cards";
import type { WorldCard } from "../model/types";

const WORLD_ID = "answers";

// World-authored world card templates (excludes the shared Destiny and The
// Walker templates, which are reused/starter entities, not authored here).
const WORLD_CARDS = [
  "The Ledger Never Closes",
  "A Broker Who Owes Nothing",
  "What Would You Give Up",
  "The Archive Has a Price",
  "A Deal Too Easy",
  "A Reading of the Ledger",
  "A Fracture Opens",
  "Another Fracture",
  "The Point of No Return",
  "The Weight Doesn't Lift",
  "It Won't Go Away",
  "It Calcified",
  "A Reason to Keep Moving",
  "Just Keep Walking",
] as const;

const REQUIRED_HOOKS = [
  "onDiscarded",
  "onCleared",
  "onPartialClear",
  "onEndOfTurn",
  "onDraw",
] as const;

// Bargaining/Depression appear only as applied keywords on most of these
// cards (via onDraw's ApplyKeyword{target:"self"}); It Calcified is the one
// authored exception (Depression:2 statically). Obstructed is the shared
// tool-fetch keyword this world also uses.
const VALID_KEYWORDS = new Set(["Obstructed", "Bargaining", "Depression"]);

function worldTemplate(id: (typeof WORLD_CARDS)[number]) {
  const template = buildWorld(WORLD_ID).catalog[id];
  if (template?.kind !== "world") throw new Error(`${id} missing`);
  return template;
}

describe("Answers world data", () => {
  it("registers, builds, maps its threat, and ends act 3 with The Walker", () => {
    expect(worldDataRegistry.map((bundle) => bundle.id)).toContain(WORLD_ID);
    const { catalog, worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
    expect(new Set(Object.keys(catalog)).size).toBe(Object.keys(catalog).length);
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("Destiny");
    expect(worldData.deckComposition.acts).toHaveLength(3);
    expect(worldData.deckComposition.acts.at(-1)?.cards.at(-1)).toEqual({
      templateId: "The Walker",
      count: 1,
    });
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

describe("Answers isolate effects", () => {
  it("A Fracture Opens top-decks Another Fracture and removes itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const [card, staged] = mintCard(catalog, base, "A Fracture Opens");
    if (card.kind !== "world") throw new Error("A Fracture Opens must mint a world card");
    const state = { ...staged, hand: [card], worldDraw: [] };

    const result = applyEffect(
      catalog,
      state,
      worldTemplate("A Fracture Opens").onEndOfTurn,
      undefined,
      card.id,
    );

    expect(result.state.worldDraw[0]?.templateId).toBe("Another Fracture");
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("It Won't Go Away top-decks It Calcified and removes itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const [card, staged] = mintCard(catalog, base, "It Won't Go Away");
    if (card.kind !== "world") throw new Error("It Won't Go Away must mint a world card");
    const state = { ...staged, hand: [card], worldDraw: [] };

    const result = applyEffect(
      catalog,
      state,
      worldTemplate("It Won't Go Away").onEndOfTurn,
      undefined,
      card.id,
    );

    expect(result.state.worldDraw[0]?.templateId).toBe("It Calcified");
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("It Calcified authors Depression:2 statically and is not discardable", () => {
    const template = worldTemplate("It Calcified");
    expect(template.keywords).toEqual(["Depression:2"]);
    expect(template.discardable).toBe(false);
  });

  // Per commit 5b2e0e5 ("Updated destiny."), Destiny authors keywords: [] — no
  // Denial, no Depression, nothing at all. The only tax vector left is
  // Bargaining's ClearCostPerOtherKeyword, which taxes ANY priced card based
  // on Bargaining summed across other cards in hand, regardless of whether
  // the priced card itself carries a keyword. Expected: 15 + 3 * costPer(1) = 18.
  it("Destiny's effective cost is 15 plus Bargaining tax from another card, not a Denial/Depression formula", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);

    const [destinyCard, afterDestiny] = mintCard(catalog, base, "Destiny");
    const [otherCard, afterOther] = mintCard(catalog, afterDestiny, "The Ledger Never Closes");
    if (destinyCard.kind !== "world" || otherCard.kind !== "world") {
      throw new Error("Destiny and The Ledger Never Closes must mint world cards");
    }
    expect(destinyCard.keywords).toEqual([]);

    const bargainingCarrier: WorldCard = {
      ...otherCard,
      appliedKeywords: [{ name: "Bargaining", value: 3 }],
    };
    const state = { ...afterOther, hand: [destinyCard, bargainingCarrier], worldDraw: [] };

    expect(effectiveWorldCardCost(destinyCard, state)).toBe(18);
  });
});
