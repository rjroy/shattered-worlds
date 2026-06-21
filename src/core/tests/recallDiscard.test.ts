import { describe, expect, it } from "bun:test";
import { applyEffect } from "../engine/effects";
import { recallToTop } from "../effects/recallDiscard";
import { availableActions, checkPlayAction, isPlayableOf } from "../engine/available";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import type { Action, CardEffect, GameState, PlayerCard } from "../model/types";
import type { WorldData } from "../model/catalog";
import { catalog, makeState, mintPlayer, mintPlayers, worldData } from "./testFixture";

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * A bare-bones player card literal for tests that need exact control over
 * energyCost / templateId without minting from the catalog.
 */
function playerCard(overrides: Partial<PlayerCard> & Pick<PlayerCard, "id">): PlayerCard {
  return {
    kind: "player",
    templateId: overrides.id,
    name: overrides.id,
    insetKey: undefined,
    sourceWorldId: "test",
    effect: { kind: "None" },
    energyCost: 0,
    keywords: [],
    rarity: "common",
    ...overrides,
  };
}

function recallEvents(events: { type: string }[]) {
  return events.filter((e) => e.type === "PlayerDiscardRecalled");
}

// ---------------------------------------------------------------------------
// ReturnPlayerDiscardToTop (player-selected) — REQ-TIDAL-52
// ---------------------------------------------------------------------------

describe("ReturnPlayerDiscardToTop", () => {
  it("moves a selected discard to the top of playerDraw, preserving the instance", () => {
    const chosen = playerCard({
      id: "c1",
      energyCost: 2,
      modified: true,
      exhaust: true,
      frozen: 3,
    });
    const other = playerCard({ id: "c2" });
    const existingTop = playerCard({ id: "draw-top" });
    const state = makeState({
      playerDiscard: [chosen, other],
      playerDraw: [existingTop],
    });

    const effect: CardEffect = { kind: "ReturnPlayerDiscardToTop", min: 1, max: 1 };
    const { state: after, events } = applyEffect(catalog, state, effect, {
      type: "PlayCard",
      cardId: "reward",
      recallIds: ["c1"],
    });

    // Landed on top of playerDraw, exact same instance. Because it is the
    // same object reference (toBe), every flag — modified/exhaust/frozen — is
    // intact by construction; the chosen literal carries them.
    expect(after.playerDraw[0]).toBe(chosen);
    expect(chosen.modified).toBe(true);
    expect(chosen.exhaust).toBe(true);
    expect(chosen.frozen).toBe(3);
    expect(after.playerDraw[1]).toBe(existingTop);
    // Removed from discard; the other discard stays.
    expect(after.playerDiscard.map((c) => c.id)).toEqual(["c2"]);

    const recalled = recallEvents(events);
    expect(recalled).toHaveLength(1);
    expect(recalled[0]).toMatchObject({
      cardIds: ["c1"],
      templateIds: ["c1"],
      source: "playerSelected",
      dest: "playerDrawTop",
    });
  });

  it("orders multiple selected cards on top in selection order", () => {
    const a = playerCard({ id: "a" });
    const b = playerCard({ id: "b" });
    const c = playerCard({ id: "c" });
    const state = makeState({ playerDiscard: [a, b, c], playerDraw: [] });

    const effect: CardEffect = { kind: "ReturnPlayerDiscardToTop", min: 1, max: 3 };
    const { state: after } = applyEffect(catalog, state, effect, {
      type: "PlayCard",
      cardId: "reward",
      // Deliberately not pile order: c then a.
      recallIds: ["c", "a"],
    });

    expect(after.playerDraw.map((x) => x.id)).toEqual(["c", "a"]);
    expect(after.playerDiscard.map((x) => x.id)).toEqual(["b"]);
  });

  it("is unplayable when min cannot be met (too few discards)", () => {
    const reward = playerCard({
      id: "reward",
      effect: { kind: "ReturnPlayerDiscardToTop", min: 1, max: 1 },
    });
    const empty = makeState({ hand: [reward], playerDiscard: [], energy: 5 });
    expect(isPlayableOf(reward.effect, empty, reward.id)).toBe(false);
    // Not reported as playable.
    expect(availableActions(empty).playable.find((p) => p.cardId === "reward")).toBeUndefined();

    const withDiscard = makeState({
      hand: [reward],
      playerDiscard: [playerCard({ id: "d1" })],
      energy: 5,
    });
    expect(isPlayableOf(reward.effect, withDiscard, reward.id)).toBe(true);
  });

  it("min: 0 is playable and a zero-selection is a legal no-op", () => {
    const reward = playerCard({
      id: "reward",
      effect: { kind: "ReturnPlayerDiscardToTop", min: 0, max: 1 },
    });
    const state = makeState({ hand: [reward], playerDiscard: [], energy: 5 });

    expect(isPlayableOf(reward.effect, state, reward.id)).toBe(true);

    // Zero-selection passes the runtime gate and produces no event.
    const available = availableActions(state);
    const action: Extract<Action, { type: "PlayCard" }> = {
      type: "PlayCard",
      cardId: "reward",
      recallIds: [],
    };
    expect(checkPlayAction(available, action)).toBeNull();

    const { events } = applyEffect(catalog, state, reward.effect, action);
    expect(recallEvents(events)).toHaveLength(0);
  });

  it("rejects an out-of-range selection through the runtime gate", () => {
    const reward = playerCard({
      id: "reward",
      effect: { kind: "ReturnPlayerDiscardToTop", min: 1, max: 1 },
    });
    const d1 = playerCard({ id: "d1" });
    const d2 = playerCard({ id: "d2" });
    const state = makeState({ hand: [reward], playerDiscard: [d1, d2], energy: 5 });
    const available = availableActions(state);

    // Too many selected (max 1).
    expect(
      checkPlayAction(available, {
        type: "PlayCard",
        cardId: "reward",
        recallIds: ["d1", "d2"],
      }),
    ).not.toBeNull();

    // A legal selection passes.
    expect(
      checkPlayAction(available, {
        type: "PlayCard",
        cardId: "reward",
        recallIds: ["d1"],
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RecallPlayerDiscard (automatic) — REQ-TIDAL-53
// ---------------------------------------------------------------------------

describe("RecallPlayerDiscard", () => {
  function discardWith(cards: PlayerCard[], extra: Partial<GameState> = {}): GameState {
    return makeState({ playerDiscard: cards, playerDraw: [], ...extra });
  }

  it("latest recalls the head of playerDiscard (most recently discarded)", () => {
    const newest = playerCard({ id: "newest" });
    const oldest = playerCard({ id: "oldest" });
    // handleEndTurn prepends, so head = latest.
    const state = discardWith([newest, oldest]);
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "RecallPlayerDiscard",
      policy: "latest",
    });
    expect(after.playerDraw.map((c) => c.id)).toEqual(["newest"]);
    expect(recallEvents(events)[0]).toMatchObject({ source: "latest", cardIds: ["newest"] });
  });

  it("lowestCost / highestCost recall by energyCost", () => {
    const cheap = playerCard({ id: "cheap", energyCost: 0 });
    const mid = playerCard({ id: "mid", energyCost: 2 });
    const pricey = playerCard({ id: "pricey", energyCost: 5 });

    const low = applyEffect(catalog, discardWith([mid, cheap, pricey]), {
      kind: "RecallPlayerDiscard",
      policy: "lowestCost",
    });
    expect(low.state.playerDraw[0]?.id).toBe("cheap");

    const high = applyEffect(catalog, discardWith([mid, cheap, pricey]), {
      kind: "RecallPlayerDiscard",
      policy: "highestCost",
    });
    expect(high.state.playerDraw[0]?.id).toBe("pricey");
  });

  it("panicFirst recalls a Panic when present", () => {
    const [panic] = mintPlayer(makeState(), "Panic");
    const other = playerCard({ id: "other" });
    const withPanic = discardWith([other, panic]);
    const { state: after, events } = applyEffect(catalog, withPanic, {
      kind: "RecallPlayerDiscard",
      policy: "panicFirst",
    });
    expect(after.playerDraw[0]?.id).toBe(panic.id);
    expect(recallEvents(events)[0]).toMatchObject({ source: "panicFirst" });
  });

  it("panicFirst falls back to latest when no Panic is present", () => {
    const newest = playerCard({ id: "newest" });
    const oldest = playerCard({ id: "oldest" });
    const { state: after } = applyEffect(catalog, discardWith([newest, oldest]), {
      kind: "RecallPlayerDiscard",
      policy: "panicFirst",
    });
    expect(after.playerDraw[0]?.id).toBe("newest");
  });

  it("random is deterministic across two identical seeded runs and advances rng", () => {
    const cards = [
      playerCard({ id: "a" }),
      playerCard({ id: "b" }),
      playerCard({ id: "c" }),
      playerCard({ id: "d" }),
    ];
    const base = createWorld(catalog, worldData, 12345).state;
    const seeded: GameState = { ...base, playerDiscard: cards, playerDraw: [] };

    const r1 = applyEffect(catalog, seeded, { kind: "RecallPlayerDiscard", policy: "random" });
    const r2 = applyEffect(catalog, seeded, { kind: "RecallPlayerDiscard", policy: "random" });

    expect(recallEvents(r1.events)[0]).toEqual(recallEvents(r2.events)[0]);
    expect(r1.state.playerDraw[0]?.id).toBe(r2.state.playerDraw[0]?.id);
    // rng threaded back (random consumed at least one float).
    expect(r1.state.rng).not.toEqual(seeded.rng);
  });

  it("recalls `count` cards when count > 1", () => {
    const a = playerCard({ id: "a" });
    const b = playerCard({ id: "b" });
    const c = playerCard({ id: "c" });
    const { state: after } = applyEffect(catalog, discardWith([a, b, c]), {
      kind: "RecallPlayerDiscard",
      count: 2,
      policy: "latest",
    });
    expect(after.playerDraw.map((x) => x.id)).toEqual(["a", "b"]);
    expect(after.playerDiscard.map((x) => x.id)).toEqual(["c"]);
  });

  it("empty discard is a no-op with no event", () => {
    const state = discardWith([]);
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "RecallPlayerDiscard",
      policy: "latest",
    });
    expect(after).toBe(state);
    expect(recallEvents(events)).toHaveLength(0);
  });

  it("preserves recalled instance data", () => {
    const flagged = playerCard({ id: "flagged", modified: true, exhaust: true, frozen: 2 });
    const { state: after } = applyEffect(catalog, discardWith([flagged]), {
      kind: "RecallPlayerDiscard",
      policy: "latest",
    });
    expect(after.playerDraw[0]).toBe(flagged);
  });

// ---------------------------------------------------------------------------
// recallToTop helper — not-found ids are dropped
// ---------------------------------------------------------------------------

describe("recallToTop", () => {
  it("drops ids not present in playerDiscard", () => {
    const a = playerCard({ id: "a" });
    const state = makeState({ playerDiscard: [a], playerDraw: [] });
    const { state: after, events } = recallToTop(state, ["a", "ghost"], "playerSelected");
    expect(after.playerDraw.map((c) => c.id)).toEqual(["a"]);
    expect(recallEvents(events)).toHaveLength(1);
  });

  it("is a no-op when no id matches", () => {
    const state = makeState({ playerDiscard: [playerCard({ id: "a" })] });
    const { state: after, events } = recallToTop(state, ["ghost"], "latest");
    expect(after).toBe(state);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// End-turn passive ordering — REQ-TIDAL-54
// ---------------------------------------------------------------------------

describe("end-turn passive recall ordering", () => {
  // A synthetic Tidal-like world: the shared starter deck + a trivial 1-act
  // composition, plus the Tidal Memory passive. Does not depend on Slice B data.
  function passiveWorld(passive: CardEffect): WorldData {
    return {
      worldId: "synthetic-tidal",
      starterDeck: worldData.starterDeck,
      deckComposition: { acts: [{ cards: [{ templateId: "The Walker", count: 1 }] }] },
      onEndOfTurnPassive: passive,
    };
  }

  it("threads onEndOfTurnPassive onto GameState via createWorld", () => {
    const { state } = createWorld(catalog, passiveWorld({ kind: "RecallPlayerDiscard" }), 1);
    expect(state.endOfTurnPassive).toEqual({ kind: "RecallPlayerDiscard" });
  });

  it("recalls a card discarded this turn and draws it into the next hand", () => {
    const base = createWorld(catalog, passiveWorld({ kind: "RecallPlayerDiscard", policy: "latest" }), 1)
      .state;

    // A marked player card sits in hand and will be discarded at end of turn.
    const [marked] = mintPlayer(base, "Sprint");
    const tagged: PlayerCard = { ...marked, id: "MARKER" };

    // Empty the draw pile so the only way MARKER reaches the next hand is the
    // passive recalling it to the top. Keep a healthy discard to refill from.
    const [fillers, afterFill] = mintPlayers(base, "Sprint", 6);
    const start: GameState = {
      ...afterFill,
      hand: [tagged],
      playerDraw: [],
      playerDiscard: fillers,
      worldDraw: [],
      acts: [],
      energy: 1,
    };

    const { state: after, events } = reduce(catalog, start, { type: "EndTurn" });

    // The passive recalled MARKER to the top of playerDraw before the refill,
    // so it is the first card drawn into the next hand.
    const recalled = recallEvents(events);
    expect(recalled).toHaveLength(1);
    expect(recalled[0]).toMatchObject({ cardIds: ["MARKER"], source: "latest" });
    expect(after.hand.some((c) => c.id === "MARKER")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Non-Tidal regression — REQ-TIDAL-18
// ---------------------------------------------------------------------------

describe("non-Tidal worlds (default passive)", () => {
  it("emit no PlayerDiscardRecalled and an identical end-turn event sequence", () => {
    // Baseline: a real world (zombie-big-box) with the default None passive.
    const { state: base } = createWorld(catalog, worldData, 999);
    expect(base.endOfTurnPassive).toEqual({ kind: "None" });

    const [players, afterPlayers] = mintPlayers(base, "Sprint", 4);
    const start: GameState = {
      ...afterPlayers,
      hand: [players[0]!],
      playerDiscard: [players[1]!, players[2]!, players[3]!],
      energy: 1,
    };

    const { events } = reduce(catalog, start, { type: "EndTurn" });
    expect(recallEvents(events)).toHaveLength(0);
  });

  it("produces byte-identical end-turn output whether passive is None or absent", () => {
    // The createWorld default (absent onEndOfTurnPassive ⇒ None) and an
    // explicit None must yield identical state + events.
    const explicitNone: WorldData = {
      worldId: "explicit-none",
      starterDeck: worldData.starterDeck,
      deckComposition: worldData.deckComposition,
      onEndOfTurnPassive: { kind: "None" },
    };

    const a = createWorld(catalog, worldData, 7).state;
    const b = createWorld(catalog, explicitNone, 7).state;

    const ra = reduce(catalog, a, { type: "EndTurn" });
    const rb = reduce(catalog, b, { type: "EndTurn" });

    expect(ra.events).toEqual(rb.events);
});
