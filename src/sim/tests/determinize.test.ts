import { describe, expect, test } from "bun:test";
import type { GameState } from "../../core/model/types";
import { createWorld } from "../../core/engine/world";
import { reduce } from "../../core/engine/reduce";
import { availableActions } from "../../core/engine/available";
import { createRng, rngFromSeed } from "../../core/engine/rng";
import { checkIdAccounting } from "../accounting";
import { determinize } from "../determinize";
import { pickAction, catalog, worldData } from "../policy";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ids = (cards: readonly { id: string }[]): string[] => cards.map((c) => c.id);
const sortedIds = (cards: readonly { id: string }[]): string[] => [...ids(cards)].sort();

/**
 * A mid-run state: advanced far enough that `playerDiscard` is non-empty (cards
 * have been played) while still `playing` with acts queued, so every hidden
 * zone the test cares about (playerDraw, worldDraw, acts) is populated.
 */
function midRunState(seed: number): GameState {
  let state = createWorld(catalog, worldData, seed).state;
  const rng = rngFromSeed(seed);
  let actions = 0;
  while (
    state.status === "playing" &&
    actions < 200 &&
    (state.playerDiscard.length === 0 || state.acts.length === 0 || state.playerDraw.length === 0)
  ) {
    const action = pickAction(state, rng);
    state = reduce(catalog, state, action).state;
    actions++;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("determinize", () => {
  test("fixture exercises every hidden zone", () => {
    const state = midRunState(1);
    // Preconditions: the assertions below are only meaningful if these are populated.
    expect(state.status).toBe("playing");
    expect(state.playerDraw.length).toBeGreaterThan(0);
    expect(state.worldDraw.length).toBeGreaterThan(0);
    expect(state.acts.length).toBeGreaterThan(0);
    expect(state.playerDiscard.length).toBeGreaterThan(0);
    expect(state.hand.length).toBeGreaterThan(0);
  });

  test("hidden zones are permutations of the originals (same multiset of ids)", () => {
    const state = midRunState(1);
    const [out] = determinize(state, createRng(42));

    expect(sortedIds(out.playerDraw)).toEqual(sortedIds(state.playerDraw));
    expect(sortedIds(out.worldDraw)).toEqual(sortedIds(state.worldDraw));
    expect(out.acts.length).toBe(state.acts.length);
    for (let i = 0; i < state.acts.length; i++) {
      expect(sortedIds(out.acts[i]!)).toEqual(sortedIds(state.acts[i]!));
    }
  });

  test("visible zones and resources are byte-identical to the input", () => {
    const state = midRunState(1);
    const [out] = determinize(state, createRng(42));

    expect(out.hand).toEqual(state.hand);
    expect(out.playerDiscard).toEqual(state.playerDiscard);
    expect(out.hp).toBe(state.hp);
    expect(out.energy).toBe(state.energy);
    expect(out.heat).toBe(state.heat);
    expect(out.light).toBe(state.light);
    expect(out.nextId).toBe(state.nextId);
    expect(out.progress).toEqual(state.progress);
  });

  test("state.rng is reseeded (differs from the input rng)", () => {
    const state = midRunState(1);
    const [out] = determinize(state, createRng(42));
    expect(out.rng).not.toEqual(state.rng);
  });

  test("same agent rng seed yields identical determinization (reproducible)", () => {
    const state = midRunState(1);
    const [a, nextA] = determinize(state, createRng(7));
    const [b, nextB] = determinize(state, createRng(7));

    expect(a).toEqual(b);
    expect(nextA).toEqual(nextB);
  });

  test("different agent rng seeds generally differ (at least one zone reorders)", () => {
    const state = midRunState(1);
    const [a] = determinize(state, createRng(1));
    const [b] = determinize(state, createRng(2));

    // The combined order across all hidden zones is large; two distinct seeds
    // producing the identical full permutation is astronomically unlikely.
    const order = (s: GameState): string[] => [
      ...ids(s.playerDraw),
      ...ids(s.worldDraw),
      ...s.acts.flatMap((act) => ids(act)),
    ];
    expect(order(a)).not.toEqual(order(b));
  });

  test("checkIdAccounting passes on the determinized output (no card lost or duplicated)", () => {
    const state = midRunState(1);
    const [out] = determinize(state, createRng(42));
    expect(() => checkIdAccounting(out)).not.toThrow();
  });

  test("does not mutate the input state", () => {
    const state = midRunState(1);
    const beforePlayerDraw = ids(state.playerDraw);
    const beforeWorldDraw = ids(state.worldDraw);
    const beforeRng = { ...state.rng };

    determinize(state, createRng(42));

    expect(ids(state.playerDraw)).toEqual(beforePlayerDraw);
    expect(ids(state.worldDraw)).toEqual(beforeWorldDraw);
    expect(state.rng).toEqual(beforeRng);
  });

  test("hand instances are preserved: legality matches the real state", () => {
    const state = midRunState(1);
    const [out] = determinize(state, createRng(42));

    const real = availableActions(state);
    const det = availableActions(out);

    // Hand-derived legality depends only on the (untouched) hand and resources,
    // so the playable/discardable sets must be identical.
    expect(det.playable.map((p) => p.cardId).sort()).toEqual(
      real.playable.map((p) => p.cardId).sort(),
    );
    expect([...det.discardable].sort()).toEqual([...real.discardable].sort());
    expect(det.canEndTurn).toBe(real.canEndTurn);

    // A concrete action over a hand card is legal on the determinized state:
    // it references the same instance, so reduce accepts it just as it would
    // on the real state.
    const agentRng = rngFromSeed(99);
    const action = pickAction(out, agentRng);
    expect(() => reduce(catalog, out, action)).not.toThrow();
    expect(() => reduce(catalog, state, action)).not.toThrow();
  });
});
