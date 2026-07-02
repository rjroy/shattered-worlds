import { describe, expect, it } from "bun:test";
import { buildWorld, FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { worldDataRegistry } from "../../data/worlds/registry";
import { effectiveWorldCardCost } from "../engine/effectiveCards";
import { applyEffect } from "../engine/effects";
import { drawWorld, resolveForceDestroy } from "../engine/draw";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { appliedKeywordValue } from "../model/keywords";
import type { GameState, WorldCard } from "../model/types";

const WORLD_ID = "transit-authority";

// The world cards Transit authors itself. The Walker is a shared starter
// template (REQ-TRANSIT-6) and is intentionally excluded from the per-card
// hook/keyword assertions below.
const TRANSIT_WORLD_CARDS = [
  "Service Change",
  "Platform Reassignment",
  "Ticket Invalidated",
  "Train Arrives From Nowhere",
  "Do Not Board Unknown Trains",
  "All Departures Suspended",
  "Reissue Credentials",
  "Entity Detected",
] as const;

// Deviation 4: every Transit world card authors all FIVE hooks (onDraw is
// required by WorldCardTemplate, not just the spec's original four).
const REQUIRED_HOOKS = ["onDiscarded", "onCleared", "onPartialClear", "onEndOfTurn", "onDraw"] as const;

// The full global KeywordName set (src/core/model/types.ts), including Reroute
// itself. Transit's authored `keywords` arrays must only ever use
// Obstructed/Slow — Reroute is applied at runtime, never authored.
const VALID_KEYWORDS = new Set([
  "Obstructed",
  "Creature",
  "Slow",
  "Spore",
  "Concealed",
  "Alarm",
  "Lockdown",
  "Reroute",
]);
const AUTHORED_KEYWORDS = new Set(["Obstructed", "Slow"]);

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

function rerouted(card: WorldCard): WorldCard {
  return { ...card, appliedKeywords: [{ name: "Reroute", value: 1 }] };
}

// ---------------------------------------------------------------------------
// World-data shape (REQ-TRANSIT-43, corrected per plan deviation 4).
// ---------------------------------------------------------------------------

describe("Transit Authority — world data shape (REQ-TRANSIT-43)", () => {
  it("is registered in worldDataRegistry and buildWorld succeeds", () => {
    const ids = worldDataRegistry.map((bundle) => bundle.id);
    expect(ids).toContain(WORLD_ID);

    const { worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
  });

  it("has no duplicate template ids across the unified catalog", () => {
    const { catalog } = buildWorld(WORLD_ID);
    const allIds = Object.keys(catalog);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("defines all five hooks on every Transit world card", () => {
    const { catalog } = buildWorld(WORLD_ID);
    for (const id of TRANSIT_WORLD_CARDS) {
      const template = catalog[id];
      expect(template).toBeDefined();
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const hook of REQUIRED_HOOKS) {
        expect(template[hook]).toBeDefined();
      }
    }
  });

  it("authors only Obstructed/Slow as static keywords; Reroute never appears authored", () => {
    const { catalog } = buildWorld(WORLD_ID);
    for (const id of TRANSIT_WORLD_CARDS) {
      const template = catalog[id];
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const keyword of template.keywords) {
        const name = keyword.split(":")[0]!;
        // Every authored name must be part of the closed global set...
        expect(VALID_KEYWORDS.has(name)).toBe(true);
        // ...and restricted to Transit's actual authored subset. Reroute is
        // runtime-only (appliedKeywords), never a static authored keyword.
        expect(AUTHORED_KEYWORDS.has(name)).toBe(true);
      }
      expect(template.keywords.some((k) => k.split(":")[0] === "Reroute")).toBe(false);
    }
  });

  it("maps the Transit world threat to Entity Detected (REQ-TRANSIT-13)", () => {
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("Entity Detected");
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
// Effect/data tests (REQ-TRANSIT-44) plus Reroute-specific assertions.
// ---------------------------------------------------------------------------

describe("Transit Authority — reroute effects drive the reducer (REQ-TRANSIT-44)", () => {
  it("Service Change top-decks Platform Reassignment then self-destructs", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const change = catalog["Service Change"];
    expect(change?.kind).toBe("world");
    if (change === undefined || change.kind !== "world") return;

    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Service Change");

    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, change.onEndOfTurn, undefined, card.id);

    // A Platform Reassignment lands on top of the world deck.
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Platform Reassignment");
    // Service Change removed itself from hand (DestroySelf).
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("Platform Reassignment pins Panic at end of turn and grants Check the Board on clear", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const platform = catalog["Platform Reassignment"];
    expect(platform?.kind).toBe("world");
    if (platform === undefined || platform.kind !== "world") return;

    expect(platform.onEndOfTurn).toEqual({ kind: "AddPlayerCardToTop", template: "Panic" });
    expect(platform.onCleared).toEqual({ kind: "GainCard", template: "Check the Board" });

    const { state } = createWorld(catalog, worldData, 2, DEFAULT_RUN_MODIFIERS);

    const pinned = applyEffect(catalog, state, platform.onEndOfTurn);
    expect(pinned.state.playerDraw[0]!.templateId).toBe("Panic");

    const cleared = applyEffect(catalog, state, platform.onCleared);
    expect(cleared.state.playerDiscard.some((c) => c.templateId === "Check the Board")).toBe(true);
  });

  it("Ticket Invalidated onEndOfTurn queues ForceDestroy (not HP Damage); Temporary Credentials' Brace absorbs it end-to-end", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const ticket = catalog["Ticket Invalidated"];
    expect(ticket?.kind).toBe("world");
    if (ticket === undefined || ticket.kind !== "world") return;

    if (ticket.onEndOfTurn.kind !== "Sequence") {
      throw new Error("Ticket Invalidated onEndOfTurn is expected to be a Sequence");
    }
    expect(ticket.onEndOfTurn.steps[0]).toEqual({ kind: "ForceDestroy", amount: 1 });

    const { state } = createWorld(catalog, worldData, 3, DEFAULT_RUN_MODIFIERS);
    const startHp = state.hp;
    const queued = applyEffect(catalog, state, ticket.onEndOfTurn);

    // Snatch queued, HP untouched, no Damage path.
    expect(queued.state.pendingForceDestroy).toBe(state.pendingForceDestroy + 1);
    expect(queued.state.hp).toBe(startHp);
    expect(queued.events.some((e) => e.type === "DamageDealt")).toBe(false);

    // Temporary Credentials grants a Brace charge (Sequence[Draw, Brace 1]); a
    // single charge absorbs the queued snatch end-to-end with no card destroyed.
    const credentials = catalog["Temporary Credentials"];
    if (credentials === undefined || credentials.kind !== "player") {
      throw new Error("Temporary Credentials missing");
    }
    expect(credentials.effect).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "Draw", player: 1 },
        { kind: "Brace", amount: 1 },
      ],
    });
    const braced = applyEffect(catalog, queued.state, credentials.effect);
    expect(braced.state.braceCharges).toBe(1);

    // Resolve the queued snatch as the engine does at turn start: the brace
    // charge is consumed and no card is destroyed.
    const resolved = resolveForceDestroy(braced.state);
    expect(resolved.events.some((e) => e.type === "BraceConsumed")).toBe(true);
    expect(resolved.events.some((e) => e.type === "CardDestroyed")).toBe(false);
    expect(resolved.state.pendingForceDestroy).toBe(0);
    expect(resolved.state.braceCharges).toBe(0);
  });

  it("Train Arrives From Nowhere onEndOfTurn forces DiscardThenDraw and top-decks All Departures Suspended", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const train = catalog["Train Arrives From Nowhere"];
    expect(train?.kind).toBe("world");
    if (train === undefined || train.kind !== "world") return;

    if (train.onEndOfTurn.kind !== "Sequence") {
      throw new Error("Train Arrives From Nowhere onEndOfTurn is expected to be a Sequence");
    }
    expect(train.onEndOfTurn.steps[0]).toEqual({ kind: "DiscardThenDraw", player: 1 });

    const { state: base } = createWorld(catalog, worldData, 4, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Train Arrives From Nowhere");
    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, train.onEndOfTurn, undefined, card.id);

    // All Departures Suspended lands on top; the train removed itself
    // (DestroySelf) regardless of whether DiscardThenDraw found a player card
    // to discard (the staged hand holds only the hazard itself).
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("All Departures Suspended");
    expect(result.state.hand.some((c) => c.id === card.id)).toBe(false);
  });

  it("Reissue Credentials onCleared offers a boon from pool-reissued-credentials (not a multi-card grant); onDiscarded/onEndOfTurn top-deck related routes", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const reissue = catalog["Reissue Credentials"];
    expect(reissue?.kind).toBe("world");
    if (reissue === undefined || reissue.kind !== "world") return;

    expect(reissue.onCleared).toEqual({
      kind: "OfferBoon",
      setId: "pool-reissued-credentials",
      setName: "Reissued Credentials",
      offeredCount: 3,
      chooseCount: 1,
    });

    const { state } = createWorld(catalog, worldData, 5, DEFAULT_RUN_MODIFIERS);
    const beforeDiscard = state.playerDiscard.length;
    const beforeDeck = state.playerDraw.length;
    const clearedResult = applyEffect(catalog, state, reissue.onCleared);

    // A boon offer, not a card dump: nothing lands in the discard/deck.
    expect(clearedResult.state.playerDiscard.length).toBe(beforeDiscard);
    expect(clearedResult.state.playerDraw.length).toBe(beforeDeck);
    expect(clearedResult.state.pendingBoonChoices.at(-1)?.setId).toBe("pool-reissued-credentials");

    const pool = new Set<string>(FORTUNE_BOON_POOLS["pool-reissued-credentials"]);
    expect(pool).toEqual(
      new Set(["Temporary Credentials", "Express Transfer", "Check the Board", "Board Anyway", "Right of Way"]),
    );

    // onDiscarded top-decks Service Change (wrapped in the Reroute pairing).
    if (reissue.onDiscarded.kind !== "Sequence") {
      throw new Error("Reissue Credentials onDiscarded is expected to be a Sequence");
    }
    expect(reissue.onDiscarded.steps[0]).toEqual({
      kind: "AddWorldCardToDeck",
      template: "Service Change",
      bTop: true,
    });
    const discarded = applyEffect(catalog, state, reissue.onDiscarded);
    expect(discarded.state.worldDraw[0]!.templateId).toBe("Service Change");

    // onEndOfTurn (the hazard persisting unaddressed in hand) top-decks Platform
    // Reassignment (also wrapped in the Reroute pairing).
    if (reissue.onEndOfTurn.kind !== "Sequence") {
      throw new Error("Reissue Credentials onEndOfTurn is expected to be a Sequence");
    }
    expect(reissue.onEndOfTurn.steps[0]).toEqual({
      kind: "AddWorldCardToDeck",
      template: "Platform Reassignment",
      bTop: true,
    });
    const endOfTurn = applyEffect(catalog, state, reissue.onEndOfTurn);
    expect(endOfTurn.state.worldDraw[0]!.templateId).toBe("Platform Reassignment");
  });

  it("Entity Detected uses AddThreatToWorldDeck through the Transit threat mapping", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const entity = catalog["Entity Detected"];
    expect(entity?.kind).toBe("world");
    if (entity === undefined || entity.kind !== "world") return;

    if (entity.onPartialClear.kind !== "Sequence") {
      throw new Error("Entity Detected onPartialClear is expected to be a Sequence");
    }
    expect(entity.onPartialClear.steps[0]).toEqual({ kind: "AddThreatToWorldDeck" });

    const { state } = createWorld(catalog, worldData, 6, DEFAULT_RUN_MODIFIERS);
    expect(state.worldId).toBe(WORLD_ID);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, entity.onPartialClear);

    expect(result.state.worldDraw.length).toBe(before + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Entity Detected");
  });

  // -------------------------------------------------------------------------
  // Reroute-specific: the transient applied keyword (plan deviation 3).
  // -------------------------------------------------------------------------

  it("a hazard drawn after the ApplyKeyword pairing carries Reroute:1", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const change = catalog["Service Change"];
    expect(change?.kind).toBe("world");
    if (change === undefined || change.kind !== "world") return;

    const { state: base } = createWorld(catalog, worldData, 7, DEFAULT_RUN_MODIFIERS);
    const { state, card } = stageWorldCardInHand(base, "Service Change");

    // Fire the full onEndOfTurn Sequence: top-deck Platform Reassignment, apply
    // the pending Reroute keyword, then self-destruct.
    const result = applyEffect(catalog, state, change.onEndOfTurn, undefined, card.id);
    expect(result.state.pendingKeywordNextWorldCard).toContainEqual({ name: "Reroute", value: 1 });

    // Drawing pulls the top card (Platform Reassignment) into hand and stamps
    // it with the pending keyword.
    const drawn = drawWorld(result.state, 1);
    const hazard = drawn.state.hand.find((c) => c.templateId === "Platform Reassignment")!;
    expect(appliedKeywordValue(hazard, "Reroute")).toBe(1);
    expect(drawn.state.pendingKeywordNextWorldCard).toEqual([]);
  });

  it("effectiveWorldCardCost reflects the +1 tax on a Rerouted card", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 8, DEFAULT_RUN_MODIFIERS);
    const base = state.worldDraw[0]!;
    const taxed = rerouted(base);
    const untaxedState: GameState = { ...state, hand: [base] };
    const taxedState: GameState = { ...state, hand: [taxed] };

    expect(effectiveWorldCardCost(base, untaxedState)).toBe(base.cost);
    expect(effectiveWorldCardCost(taxed, taxedState)).toBe(base.cost + 1);
  });

  it("Check the Board strips Reroute from up to two cards via RemoveKeyword", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const checkTheBoard = catalog["Check the Board"];
    if (checkTheBoard === undefined || checkTheBoard.kind !== "player") {
      throw new Error("Check the Board missing");
    }
    if (checkTheBoard.effect.kind !== "Sequence") {
      throw new Error("Check the Board effect is expected to be a Sequence");
    }
    expect(checkTheBoard.effect.steps).toContainEqual({
      kind: "RemoveKeyword",
      keyword: "Reroute",
      target: "hand",
      amount: 2,
    });

    const { state } = createWorld(catalog, worldData, 9, DEFAULT_RUN_MODIFIERS);
    const hazards = state.worldDraw.slice(0, 3).map(rerouted);
    const staged: GameState = { ...state, hand: hazards, worldDraw: state.worldDraw.slice(3) };

    const result = applyEffect(catalog, staged, checkTheBoard.effect);
    const remaining = result.state.hand.filter(
      (c): c is WorldCard => c.kind === "world" && appliedKeywordValue(c, "Reroute") > 0,
    );
    // Only two of the three Rerouted cards are stripped (ExileTopWorldCards
    // amount 2 also removes the top two of the world deck, but RemoveKeyword
    // is capped at amount 2 regardless of hand size).
    expect(remaining).toHaveLength(1);
    const removedEvent = result.events.find((e) => e.type === "KeywordRemoved");
    expect(removedEvent?.type === "KeywordRemoved" && removedEvent.keyword).toBe("Reroute");
    expect(removedEvent?.type === "KeywordRemoved" && removedEvent.ids).toHaveLength(2);
  });

  it("Express Transfer strips Reroute from up to one card via RemoveKeyword", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const expressTransfer = catalog["Express Transfer"];
    if (expressTransfer === undefined || expressTransfer.kind !== "player") {
      throw new Error("Express Transfer missing");
    }
    if (expressTransfer.effect.kind !== "Sequence") {
      throw new Error("Express Transfer effect is expected to be a Sequence");
    }
    expect(expressTransfer.effect.steps).toContainEqual({
      kind: "RemoveKeyword",
      keyword: "Reroute",
      target: "hand",
      amount: 1,
    });

    const { state } = createWorld(catalog, worldData, 10, DEFAULT_RUN_MODIFIERS);
    const hazards = state.worldDraw.slice(0, 2).map(rerouted);
    const staged: GameState = { ...state, hand: hazards, worldDraw: state.worldDraw.slice(2) };

    const result = applyEffect(catalog, staged, expressTransfer.effect);
    const remaining = result.state.hand.filter(
      (c): c is WorldCard => c.kind === "world" && appliedKeywordValue(c, "Reroute") > 0,
    );
    expect(remaining).toHaveLength(1);
    const removedEvent = result.events.find((e) => e.type === "KeywordRemoved");
    expect(removedEvent?.type === "KeywordRemoved" && removedEvent.ids).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Distinctness tests (REQ-TRANSIT-48, renamed per plan deviation 2).
// ---------------------------------------------------------------------------

describe("Transit Authority — reward distinctness (REQ-TRANSIT-48)", () => {
  it("Board Anyway is distinct from city-of-sleeping-giants' Follow The Vein", () => {
    const { catalog } = buildWorld(WORLD_ID);
    const boardAnyway = catalog["Board Anyway"];
    const followTheVein = catalog["Follow The Vein"];
    if (boardAnyway === undefined || boardAnyway.kind !== "player") {
      throw new Error("Board Anyway missing");
    }
    if (followTheVein === undefined || followTheVein.kind !== "player") {
      throw new Error("Follow The Vein missing");
    }

    // Board Anyway leads with DealProgress and now carries the Reroute
    // ApplyKeyword pairing; Follow The Vein leads with Draw and has no
    // ApplyKeyword step at all. Distinct ordered effect-kind sequences.
    const kindsOf = (effect: typeof boardAnyway.effect): string[] =>
      effect.kind === "Sequence" ? effect.steps.map((s) => s.kind) : [effect.kind];

    expect(kindsOf(boardAnyway.effect)).not.toEqual(kindsOf(followTheVein.effect));
    expect(kindsOf(boardAnyway.effect)).toEqual([
      "DealProgress",
      "GainEnergy",
      "AddWorldCardToDeck",
      "ApplyKeyword",
    ]);
    expect(kindsOf(followTheVein.effect)).toEqual(["Draw", "GainEnergy", "AddWorldCardToDeck"]);
  });

  it("Right of Way is distinct from city-of-sleeping-giants' Bone Pin (cost/exhaust delta)", () => {
    const { catalog } = buildWorld(WORLD_ID);
    const rightOfWay = catalog["Right of Way"];
    const bonePin = catalog["Bone Pin"];
    if (rightOfWay === undefined || rightOfWay.kind !== "player") throw new Error("Right of Way missing");
    if (bonePin === undefined || bonePin.kind !== "player") throw new Error("Bone Pin missing");

    // Same Modal-of-two-AddPlayerCardToTop pattern, distinct by cost/exhaust:
    // Right of Way is cost 1, non-exhaust; Bone Pin is cost 0, exhaust.
    expect(rightOfWay.effect.kind).toBe("Modal");
    expect(bonePin.effect.kind).toBe("Modal");
    expect(rightOfWay.energyCost).toBe(1);
    expect(rightOfWay.exhaust).not.toBe(true);
    expect(bonePin.energyCost).toBe(0);
    expect(bonePin.exhaust).toBe(true);
    expect([rightOfWay.energyCost, rightOfWay.exhaust]).not.toEqual([bonePin.energyCost, bonePin.exhaust]);
  });

  it("Check the Board is distinct from highway-volcano's Floor It (cost delta plus appended RemoveKeyword)", () => {
    const { catalog } = buildWorld(WORLD_ID);
    const checkTheBoard = catalog["Check the Board"];
    const floorIt = catalog["Floor It"];
    if (checkTheBoard === undefined || checkTheBoard.kind !== "player") {
      throw new Error("Check the Board missing");
    }
    if (floorIt === undefined || floorIt.kind !== "player") throw new Error("Floor It missing");

    // Floor It: bare ExileTopWorldCards amount:2, exhaust:true, energyCost:0.
    expect(floorIt.effect).toEqual({ kind: "ExileTopWorldCards", amount: 2 });
    expect(floorIt.energyCost).toBe(0);
    expect(floorIt.exhaust).toBe(true);

    // Check the Board: same ExileTopWorldCards amount:2, exhaust:true, but
    // energyCost:1 and an appended RemoveKeyword step this plan adds.
    expect(checkTheBoard.effect).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "ExileTopWorldCards", amount: 2 },
        { kind: "RemoveKeyword", keyword: "Reroute", target: "hand", amount: 2 },
      ],
    });
    expect(checkTheBoard.energyCost).toBe(1);
    expect(checkTheBoard.exhaust).toBe(true);

    expect(checkTheBoard.effect).not.toEqual(floorIt.effect);
    expect(checkTheBoard.energyCost).not.toBe(floorIt.energyCost);
  });
});

// ---------------------------------------------------------------------------
// Seeded three-act identity (REQ-TRANSIT-47).
// ---------------------------------------------------------------------------

describe("Transit Authority — seeded three-act identity (REQ-TRANSIT-47)", () => {
  it("Act 1: hazards produce a forced-connection AddPlayerCardToTop event and the player stays above half HP", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const platform = catalog["Platform Reassignment"];
    if (platform === undefined || platform.kind !== "world") throw new Error("Platform Reassignment missing");

    expect(platform.onEndOfTurn).toEqual({ kind: "AddPlayerCardToTop", template: "Panic" });

    const { state } = createWorld(catalog, worldData, 1234, DEFAULT_RUN_MODIFIERS);
    const startHp = state.hp;
    const result = applyEffect(catalog, state, platform.onEndOfTurn);

    // AddPlayerCardToTop pins a forced connection (Panic) via the shared
    // CardGained event, destined for the top of the player deck.
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "CardGained", templateId: "Panic", dest: "playerDrawTop" }),
    );
    expect(result.state.playerDraw[0]!.templateId).toBe("Panic");
    // No HP loss: Act 1's reassignment is manageable.
    expect(result.state.hp).toBe(startHp);
    expect(result.state.hp).toBeGreaterThanOrEqual(Math.ceil(startHp / 2));
  });

  it("Act 2: hazards force DiscardThenDraw and top-deck related routes", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const doNotBoard = catalog["Do Not Board Unknown Trains"];
    const train = catalog["Train Arrives From Nowhere"];
    if (doNotBoard?.kind !== "world" || train?.kind !== "world") {
      throw new Error("Act 2 hazard templates missing");
    }

    const { state } = createWorld(catalog, worldData, 4242, DEFAULT_RUN_MODIFIERS);

    // The opening hand from createWorld carries real player cards, so
    // DiscardThenDraw forces a genuine transfer: one is discarded, one drawn.
    const beforeHandSize = state.hand.length;
    const afterDoNotBoard = applyEffect(catalog, state, doNotBoard.onEndOfTurn);
    expect(afterDoNotBoard.events.some((e) => e.type === "CardsDiscarded")).toBe(true);
    expect(afterDoNotBoard.state.hand.length).toBe(beforeHandSize);

    const { state: base } = createWorld(catalog, worldData, 4243, DEFAULT_RUN_MODIFIERS);
    const { state: staged, card } = stageWorldCardInHand(base, "Train Arrives From Nowhere");
    const beforeTop = staged.worldDraw.length;
    const afterTrain = applyEffect(catalog, staged, train.onEndOfTurn, undefined, card.id);
    expect(afterTrain.state.worldDraw.length).toBe(beforeTop + 1);
    expect(afterTrain.state.worldDraw[0]!.templateId).toBe("All Departures Suspended");
  });

  it("Act 3: Entity Detected repeatedly chains AddThreatToWorldDeck until cleared/exiled/Door", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const entity = catalog["Entity Detected"];
    if (entity === undefined || entity.kind !== "world") throw new Error("Entity Detected missing");

    let { state } = createWorld(catalog, worldData, 9999, DEFAULT_RUN_MODIFIERS);
    const start = state.worldDraw.length;

    for (let turn = 0; turn < 3; turn++) {
      const result = applyEffect(catalog, state, entity.onPartialClear);
      state = result.state;
      expect(state.worldDraw[0]!.templateId).toBe("Entity Detected");
    }

    expect(state.worldDraw.length).toBe(start + 3);
  });

  it("plays a deterministic opening turn through the reducer without throwing (seeded run is reproducible)", () => {
    // A coarse end-to-end sanity pass: a fixed seed must drive a real EndTurn
    // through the reducer and stay in a valid status, proving the assembled Transit
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
