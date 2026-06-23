import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { FORTUNE_BOON_POOLS } from "../../data/worlds/boons/fortune";
import { worldDataRegistry } from "../../data/worlds/registry";
import { applyEffect } from "../engine/effects";
import { resolveForceDestroy } from "../engine/draw";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import type { GameState, WorldCard } from "../model/types";

const WORLD_ID = "city-of-sleeping-giants";

// The five engine keywords. City only uses Obstructed and Slow, but assert
// against the full ratified set (REQ-GIANTS-45) for parity with the other worlds.
const VALID_KEYWORDS = new Set(["Obstructed", "Creature", "Slow", "Spore", "Concealed"]);
const REQUIRED_HOOKS = ["onDiscarded", "onCleared", "onPartialClear", "onEndOfTurn"] as const;

// The world cards City authors itself. The Walker is a shared starter template
// (REQ-GIANTS-6) and is intentionally excluded from the per-card hook/keyword
// assertions below.
const GIANTS_WORLD_CARDS = [
  "Minor Tremor",
  "Relocation Order",
  "Fingerquake Ward",
  "Surveyors Mark A Pulse",
  "Vein-Road Surge",
  "Bone Anchor Failure",
  "District Recall",
  "The Giant Turns In Sleep",
] as const;

/** Pull a concrete world card of a given template out of the world draw pile. */
function stageWorldCardInHand(
  base: GameState,
  templateId: string,
): { state: GameState; card: WorldCard } {
  const found = base.worldDraw.find((c) => c.templateId === templateId);
  const card: WorldCard = found ?? (base.worldDraw[0]! as WorldCard);
  const state: GameState = {
    ...base,
    hand: [card],
    worldDraw: base.worldDraw.filter((c) => c.id !== card.id),
  };
  return { state, card };
}

// ---------------------------------------------------------------------------
// C1 — world-data tests (REQ-GIANTS-45).
//
// The parameterized worldRegistry.test.ts already covers, for EVERY world:
// no-duplicate-ids, bundle-in-registry, buildWorld succeeds, and every template
// reference resolves in the assembled catalog. This block adds only the
// City-specific assertions that test does NOT cover.
// ---------------------------------------------------------------------------

describe("City of Sleeping Giants — world data shape (REQ-GIANTS-45)", () => {
  it("is registered in worldDataRegistry and buildWorld succeeds", () => {
    const ids = worldDataRegistry.map((bundle) => bundle.id);
    expect(ids).toContain(WORLD_ID);

    const { worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
  });

  it("has no duplicate template ids across the unified catalog", () => {
    // The unified catalog guarantees uniqueness via assembleCatalog collision
    // detection. Verify the assembled catalog has no duplicates (always passes).
    const { catalog } = buildWorld(WORLD_ID);
    const allIds = Object.keys(catalog);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("defines all four hooks and only valid keywords on every City world card", () => {
    const { catalog } = buildWorld(WORLD_ID);
    for (const id of GIANTS_WORLD_CARDS) {
      const template = catalog[id];
      expect(template).toBeDefined();
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const hook of REQUIRED_HOOKS) {
        expect(template[hook]).toBeDefined();
      }
      for (const keyword of template.keywords) {
        const name = keyword.split(":")[0]!;
        expect(VALID_KEYWORDS.has(name)).toBe(true);
      }
    }
  });

  it("maps the City world threat to The Giant Turns In Sleep (REQ-GIANTS-13)", () => {
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("The Giant Turns In Sleep");
  });

  it("has exactly three acts and ends act 3 with exactly one The Walker", () => {
    const { worldData } = buildWorld(WORLD_ID);
    const acts = worldData.deckComposition.acts;
    expect(acts).toHaveLength(3);
    const finalAct = acts[acts.length - 1]!;
    expect(finalAct.cards.at(-1)).toEqual({ templateId: "The Walker", count: 1 });
  });
});

// ---------------------------------------------------------------------------
// C2 — stirring-pattern effect tests (REQ-GIANTS-46).
//
// Each test drives the pure core reducer directly with the assembled City
// catalog. No mocking: the core is fast, deterministic, and seedable.
//
// Three deliberate spec deviations are asserted AS SHIPPED here:
//   - §2: recurrence is AddWorldCardToDeck (top-deck), not ReturnWorldCards.
//   - §4: Surveyors Mark A Pulse onCleared is an OfferBoon, not a five-card grant.
//   - §5: tremor/giant-movement pressure is ForceDestroy (snatch), not HP Damage.
// ---------------------------------------------------------------------------

describe("City of Sleeping Giants — stirring effects drive the reducer (REQ-GIANTS-46)", () => {
  it("Minor Tremor onEndOfTurn top-decks Fingerquake Ward and removes itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const tremor = catalog["Minor Tremor"];
    expect(tremor?.kind).toBe("world");
    if (tremor === undefined || tremor.kind !== "world") return;

    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Minor Tremor");

    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, tremor.onEndOfTurn, undefined, card.id);

    // A Fingerquake Ward lands on top of the world deck.
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Fingerquake Ward");
    // The Minor Tremor removed itself from hand (DestroySelf).
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("Fingerquake Ward onEndOfTurn queues ForceDestroy 1 AND top-decks Minor Tremor (not HP damage)", () => {
    // Decision §5: the ward snatches a card (ForceDestroy) so Brace has something
    // to absorb. Decision §2: the recurrence half top-decks Minor Tremor.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const ward = catalog["Fingerquake Ward"];
    expect(ward?.kind).toBe("world");
    if (ward === undefined || ward.kind !== "world") return;

    expect(ward.onEndOfTurn).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "ForceDestroy", amount: 1 },
        { kind: "AddWorldCardToDeck", template: "Minor Tremor", bTop: true },
      ],
    });

    const { state } = createWorld(catalog, worldData, 2, DEFAULT_RUN_MODIFIERS);
    const startHp = state.hp;
    const beforeTop = state.worldDraw.length;
    const { state: after, events } = applyEffect(catalog, state, ward.onEndOfTurn);

    // Snatch queued, HP untouched, no Damage path.
    expect(after.pendingForceDestroy).toBe(state.pendingForceDestroy + 1);
    expect(after.hp).toBe(startHp);
    expect(events.some((e) => e.type === "DamageDealt")).toBe(false);
    // Recurrence half: Minor Tremor on top.
    expect(after.worldDraw.length).toBe(beforeTop + 1);
    expect(after.worldDraw[0]!.templateId).toBe("Minor Tremor");
  });

  it("Minor Tremor <-> Fingerquake Ward form a recurring reflex loop (top-deck both halves)", () => {
    // The teacher loop: Minor Tremor top-decks Fingerquake Ward; the ward top-decks
    // Minor Tremor again. Two passes, each growing the world deck — recurrence, not
    // a one-shot.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const tremor = catalog["Minor Tremor"];
    const ward = catalog["Fingerquake Ward"];
    if (tremor?.kind !== "world" || ward?.kind !== "world") {
      throw new Error("loop templates missing");
    }

    const { state } = createWorld(catalog, worldData, 3, DEFAULT_RUN_MODIFIERS);
    const start = state.worldDraw.length;

    const afterTremor = applyEffect(catalog, state, tremor.onEndOfTurn);
    expect(afterTremor.state.worldDraw[0]!.templateId).toBe("Fingerquake Ward");

    const afterWard = applyEffect(catalog, afterTremor.state, ward.onEndOfTurn);
    expect(afterWard.state.worldDraw[0]!.templateId).toBe("Minor Tremor");
    expect(afterWard.state.worldDraw.length).toBe(start + 2);
  });

  it("The Giant Turns In Sleep onDiscarded queues ForceDestroy 2; onEndOfTurn still deals Damage 2", () => {
    // Decision §5: the discard pressure is a snatch (ForceDestroy 2), while the
    // end-of-turn HP-loss fail state survives (Damage 2).
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const giant = catalog["The Giant Turns In Sleep"];
    expect(giant?.kind).toBe("world");
    if (giant === undefined || giant.kind !== "world") return;

    expect(giant.onDiscarded).toEqual({ kind: "ForceDestroy", amount: 2 });

    const { state } = createWorld(catalog, worldData, 4, DEFAULT_RUN_MODIFIERS);

    // onDiscarded: snatch 2, no HP loss.
    const discarded = applyEffect(catalog, state, giant.onDiscarded);
    expect(discarded.state.pendingForceDestroy).toBe(state.pendingForceDestroy + 2);
    expect(discarded.state.hp).toBe(state.hp);

    // onEndOfTurn Sequence still carries a Damage 2 step (HP-loss fail state).
    if (giant.onEndOfTurn.kind !== "Sequence") {
      throw new Error("The Giant Turns In Sleep onEndOfTurn is expected to be a Sequence");
    }
    expect(giant.onEndOfTurn.steps).toContainEqual({ kind: "Damage", amount: 2 });
    const endOfTurn = applyEffect(catalog, state, giant.onEndOfTurn);
    expect(endOfTurn.events.some((e) => e.type === "DamageDealt")).toBe(true);
  });

  it("a Brace charge absorbs a Fingerquake Ward snatch end-to-end (no card destroyed)", () => {
    // Revives the Brace mechanic (decision §5). Queue the ward's ForceDestroy via
    // its onEndOfTurn hook, then resolve it against a single brace charge at turn
    // start: the charge is consumed and no card is destroyed.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const ward = catalog["Fingerquake Ward"];
    if (ward === undefined || ward.kind !== "world") throw new Error("Fingerquake Ward missing");

    const { state } = createWorld(catalog, worldData, 5, DEFAULT_RUN_MODIFIERS);
    const { state: afterHook } = applyEffect(catalog, state, ward.onEndOfTurn);
    expect(afterHook.pendingForceDestroy).toBeGreaterThan(0);

    // Grant a Brace charge (as Brace The Ward would) and resolve the snatch as the
    // engine does at turn start.
    const braced: GameState = { ...afterHook, braceCharges: 1 };
    const resolved = resolveForceDestroy(braced);

    expect(resolved.events.some((e) => e.type === "BraceConsumed")).toBe(true);
    expect(resolved.events.some((e) => e.type === "CardDestroyed")).toBe(false);
    expect(resolved.state.pendingForceDestroy).toBe(0);
    expect(resolved.state.braceCharges).toBe(0);
  });

  it("Surveyors Mark A Pulse onCleared offers a boon from giants-boons (3 offered, choose 1), not a card grant", () => {
    // Decision §4 deviation: REQ-GIANTS-24's initial shape granted all five tools
    // via GainCard; we assert an OfferBoon offer instead. Mirrors the big-box /
    // tidal / ember OfferBoon-on-clear assertion shape. The giants-boons pool has
    // FOUR cards (Quiet Survey, Brace The Ward, Bone Pin, Contour Map); Follow The
    // Vein is granted elsewhere and is NOT in this pool.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const surveyors = catalog["Surveyors Mark A Pulse"];
    expect(surveyors?.kind).toBe("world");
    if (surveyors === undefined || surveyors.kind !== "world") return;

    expect(surveyors.onCleared.kind).toBe("OfferBoon");

    const { state } = createWorld(catalog, worldData, 6, DEFAULT_RUN_MODIFIERS);
    const before = state.pendingBoonChoices.length;
    const beforeDiscard = state.playerDiscard.length;
    const beforeDeck = state.playerDraw.length;
    const result = applyEffect(catalog, state, surveyors.onCleared);

    // A boon offer, not a card dump: nothing lands in the discard/deck.
    expect(result.state.playerDiscard.length).toBe(beforeDiscard);
    expect(result.state.playerDraw.length).toBe(beforeDeck);
    expect(result.state.pendingBoonChoices.length).toBe(before + 1);

    const pending = result.state.pendingBoonChoices.at(-1)!;
    expect(pending.setId).toBe("giants-boons");
    expect(pending.chooseCount).toBe(1);
    expect(pending.offeredTemplateIds).toHaveLength(3);

    // Every offered template is drawn from the four-card giants-boons pool.
    const pool = new Set<string>(FORTUNE_BOON_POOLS["giants-boons"]);
    expect(pool.size).toBe(4);
    expect(pool.has("Follow The Vein")).toBe(false);
    for (const offered of pending.offeredTemplateIds) {
      expect(pool.has(offered)).toBe(true);
    }

    const offered = result.events.find((e) => e.type === "BoonOffered");
    expect(offered).toBeDefined();
    if (offered?.type === "BoonOffered") {
      expect(offered.setId).toBe("giants-boons");
    }
  });

  it("Follow The Vein is granted by Vein-Road Surge onCleared (GainCard), reachable from the world card", () => {
    // Decision §4: the fifth reward references a world card, so it cannot live in a
    // boon set. It is granted via GainCard on Vein-Road Surge's onCleared instead.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const surge = catalog["Vein-Road Surge"];
    expect(surge?.kind).toBe("world");
    if (surge === undefined || surge.kind !== "world") return;

    // onCleared is Sequence[GainEnergy 1, GainCard "Follow The Vein"].
    expect(surge.onCleared).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "GainEnergy", amount: 1 },
        { kind: "GainCard", template: "Follow The Vein" },
      ],
    });

    // Follow The Vein resolves as a real player template in the assembled catalog.
    const vein = catalog["Follow The Vein"];
    expect(vein?.kind).toBe("player");

    const { state } = createWorld(catalog, worldData, 7, DEFAULT_RUN_MODIFIERS);
    const beforeDiscard = state.playerDiscard.length;
    const result = applyEffect(catalog, state, surge.onCleared);
    // GainCard adds the card to the player's discard pile.
    expect(result.state.playerDiscard.length).toBe(beforeDiscard + 1);
    expect(result.state.playerDiscard.some((c) => c.templateId === "Follow The Vein")).toBe(true);
  });

  it("Vein-Road Surge onEndOfTurn creates Bone Anchor Failure and removes itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const surge = catalog["Vein-Road Surge"];
    expect(surge?.kind).toBe("world");
    if (surge === undefined || surge.kind !== "world") return;

    const { state: base } = createWorld(catalog, worldData, 8, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Vein-Road Surge");

    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, surge.onEndOfTurn, undefined, card.id);

    // Bone Anchor Failure lands on top; the surge removed itself (DestroySelf).
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Bone Anchor Failure");
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("District Recall top-decks recurrence hazards (onDiscarded/onPartialClear -> Vein-Road Surge)", () => {
    // Decision §2 deviation: REQ-GIANTS-27 says "returns world cards"; we assert
    // top-deck via AddWorldCardToDeck.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const recall = catalog["District Recall"];
    expect(recall?.kind).toBe("world");
    if (recall === undefined || recall.kind !== "world") return;

    expect(recall.onDiscarded).toEqual({
      kind: "AddWorldCardToDeck",
      template: "Vein-Road Surge",
      bTop: true,
    });
    expect(recall.onPartialClear).toEqual({
      kind: "AddWorldCardToDeck",
      template: "Vein-Road Surge",
      bTop: true,
    });

    const { state } = createWorld(catalog, worldData, 9, DEFAULT_RUN_MODIFIERS);
    const discarded = applyEffect(catalog, state, recall.onDiscarded);
    expect(discarded.state.worldDraw[0]!.templateId).toBe("Vein-Road Surge");
    const partial = applyEffect(catalog, state, recall.onPartialClear);
    expect(partial.state.worldDraw[0]!.templateId).toBe("Vein-Road Surge");
  });

  it("District Recall onEndOfTurn top-decks Vein-Road Surge then Bone Anchor Failure; Bone Anchor lands on top", () => {
    // ⚠️ Engine semantics (decision §2): worldDrawTop PREPENDS, so the LAST step of
    // the Sequence ends up on top. Steps are [AddWorldCardToDeck Vein-Road Surge,
    // AddWorldCardToDeck Bone Anchor Failure] => Bone Anchor Failure lands on top,
    // Vein-Road Surge sits directly beneath it. This pins that ordering.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const recall = catalog["District Recall"];
    expect(recall?.kind).toBe("world");
    if (recall === undefined || recall.kind !== "world") return;

    const { state } = createWorld(catalog, worldData, 10, DEFAULT_RUN_MODIFIERS);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, recall.onEndOfTurn);

    expect(result.state.worldDraw.length).toBe(before + 2);
    expect(result.state.worldDraw[0]!.templateId).toBe("Bone Anchor Failure");
    expect(result.state.worldDraw[1]!.templateId).toBe("Vein-Road Surge");
  });

  it("The Giant Turns In Sleep onEndOfTurn top-decks Bone Anchor Failure AND re-seeds the world threat", () => {
    // The recurrence half (Bone Anchor Failure) plus AddThreatToWorldDeck resolving
    // back to The Giant Turns In Sleep via the A6 WORLD_THREAT_BY_WORLD_ID mapping.
    // Step order: [Damage 2, AddWorldCardToDeck Bone Anchor Failure, AddThreatToWorldDeck].
    // worldDrawTop PREPENDS, so the threat (last world-card step) lands on top and
    // Bone Anchor Failure sits beneath it.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const giant = catalog["The Giant Turns In Sleep"];
    expect(giant?.kind).toBe("world");
    if (giant === undefined || giant.kind !== "world") return;

    const { state } = createWorld(catalog, worldData, 11, DEFAULT_RUN_MODIFIERS);
    expect(state.worldId).toBe(WORLD_ID);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, giant.onEndOfTurn);

    // Two world cards added: the recurrence Bone Anchor Failure and the re-seeded
    // signature threat (The Giant Turns In Sleep).
    expect(result.state.worldDraw.length).toBe(before + 2);
    expect(result.state.worldDraw[0]!.templateId).toBe("The Giant Turns In Sleep");
    expect(result.state.worldDraw[1]!.templateId).toBe("Bone Anchor Failure");
  });

  it("The Giant Turns In Sleep onPartialClear resolves the world-threat mapping", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const giant = catalog["The Giant Turns In Sleep"];
    expect(giant?.kind).toBe("world");
    if (giant === undefined || giant.kind !== "world") return;

    expect(giant.onPartialClear).toEqual({ kind: "AddThreatToWorldDeck" });

    const { state } = createWorld(catalog, worldData, 12, DEFAULT_RUN_MODIFIERS);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, giant.onPartialClear);

    expect(result.state.worldDraw.length).toBe(before + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("The Giant Turns In Sleep");
  });
});

// ---------------------------------------------------------------------------
// C5 — seeded three-act gameplay test (REQ-GIANTS-49).
//
// Deterministic (fixed seed). Demonstrates the three-act identity through the
// pure core: Act 1 creates manageable civic tremors, Act 2 hazards repeatedly
// top-deck/recur related reflex cards, and the Act 3 signature threat repeatedly
// re-seeds The Giant Turns In Sleep until cleared or escaped.
// ---------------------------------------------------------------------------

describe("City of Sleeping Giants — seeded three-act identity (REQ-GIANTS-49)", () => {
  it("Act 1: Minor Tremor creates a manageable civic tremor (top-decks one Fingerquake Ward, no HP loss)", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const tremor = catalog["Minor Tremor"];
    if (tremor === undefined || tremor.kind !== "world") throw new Error("Minor Tremor missing");

    const { state: base } = createWorld(catalog, worldData, 1234, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Minor Tremor");

    const startHp = state.hp;
    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, tremor.onEndOfTurn, undefined, card.id);

    // Manageable: exactly one ward queued, no HP loss, the tremor consumes itself.
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Fingerquake Ward");
    expect(result.state.hp).toBe(startHp);
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("Act 2: hazards recur by top-decking related reflex cards on end of turn", () => {
    // Surveyors Mark A Pulse end-of-turn top-decks Vein-Road Surge; running the
    // surge's onEndOfTurn then top-decks Bone Anchor Failure — a recurring hazard
    // chain expressed entirely through AddWorldCardToDeck.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const surveyors = catalog["Surveyors Mark A Pulse"];
    const surge = catalog["Vein-Road Surge"];
    if (surveyors?.kind !== "world" || surge?.kind !== "world") {
      throw new Error("Act 2 hazard templates missing");
    }

    const { state } = createWorld(catalog, worldData, 4242, DEFAULT_RUN_MODIFIERS);

    const afterSurveyors = applyEffect(catalog, state, surveyors.onEndOfTurn);
    expect(afterSurveyors.state.worldDraw[0]!.templateId).toBe("Vein-Road Surge");

    const afterSurge = applyEffect(catalog, afterSurveyors.state, surge.onEndOfTurn);
    expect(afterSurge.state.worldDraw[0]!.templateId).toBe("Bone Anchor Failure");
    // The deck grew across both hazards — recurrence, not a one-shot.
    expect(afterSurge.state.worldDraw.length).toBe(state.worldDraw.length + 2);
  });

  it("Act 3: The Giant Turns In Sleep repeatedly re-seeds itself until cleared/escaped", () => {
    // Fire the giant's onPartialClear AddThreatToWorldDeck three times in sequence
    // (as it would across three turns if never fully cleared): each pass re-seeds a
    // fresh The Giant Turns In Sleep on top of the world deck.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const giant = catalog["The Giant Turns In Sleep"];
    if (giant === undefined || giant.kind !== "world") {
      throw new Error("The Giant Turns In Sleep missing");
    }

    let { state } = createWorld(catalog, worldData, 9999, DEFAULT_RUN_MODIFIERS);
    const start = state.worldDraw.length;

    for (let turn = 0; turn < 3; turn++) {
      const result = applyEffect(catalog, state, giant.onPartialClear);
      state = result.state;
      expect(state.worldDraw[0]!.templateId).toBe("The Giant Turns In Sleep");
    }

    expect(state.worldDraw.length).toBe(start + 3);
  });

  it("plays a deterministic opening turn through the reducer without throwing (seeded run is reproducible)", () => {
    // A coarse end-to-end sanity pass: a fixed seed must drive a real EndTurn
    // through the reducer and stay in a valid status, proving the assembled City
    // catalog reduces cleanly. Two identical seeds yield identical state.
    const { catalog, worldData } = buildWorld(WORLD_ID);

    const run = (seed: number): GameState => {
      const { state } = createWorld(catalog, worldData, seed, DEFAULT_RUN_MODIFIERS);
      const { state: afterTurn } = reduce(catalog, state, { type: "EndTurn" });
      return afterTurn;
    };

    const a = run(20260621);
    const b = run(20260621);

    expect(a.hand.map((c) => c.templateId)).toEqual(b.hand.map((c) => c.templateId));
    expect(a.worldDraw.map((c) => c.templateId)).toEqual(b.worldDraw.map((c) => c.templateId));
    expect(["playing", "won", "lost"]).toContain(a.status);
  });
});
