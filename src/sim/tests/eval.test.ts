/**
 * Unit tests for the survival evaluation (`src/sim/eval.ts`).
 *
 * The eval is a min-of-margins survival score: higher == safer. These tests pin
 * the three behaviours the Step 2 validation gate calls out:
 *   1. Monotonic in HP / headroom (other axes held fixed).
 *   2. A state one reduce-step from a loss line scores strictly worse than a
 *      safe sibling, for both the HP axis and the player-card-availability axis.
 *   3. An available, affordable escape (SurviveWorld) dominates an otherwise
 *      identical, equally-safe state with no escape.
 *
 * States are built directly with the shared core fixtures so every case is
 * deterministic. Where a case claims to be "one step from loss", that claim is
 * corroborated by actually stepping the core (`damage` / `reduce`).
 */
import { describe, expect, test } from "bun:test";
import type { PlayerCard, WorldCard } from "../../core/model/types";
import { reduce } from "../../core/engine/reduce";
import { damage } from "../../core/engine/effects";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "../../core/tests/testFixture";
import { DEFAULT_EVAL_WEIGHTS, evaluate } from "../eval";

const W = DEFAULT_EVAL_WEIGHTS;
const ev = (view: Parameters<typeof evaluate>[0]): number => evaluate(view, W);

/** A few inert player cards (no effect), threaded as plain literals. */
function players(prefix: string, n: number): PlayerCard[] {
  return Array.from({ length: n }, (_, i) =>
    makePlayerCard({ id: `${prefix}-${i}`, effect: { kind: "None" }, energyCost: 0 }),
  );
}

/** A few inert world cards. */
function worlds(prefix: string, n: number): WorldCard[] {
  return Array.from({ length: n }, (_, i) => makeWorldCard({ id: `${prefix}-${i}` }));
}

describe("evaluate — terminal short-circuit", () => {
  test('"won" returns the ceiling score and "lost" returns 0', () => {
    const base = makeState({
      hp: 7,
      hand: players("h", 2),
      playerDraw: players("d", 4),
      worldDraw: worlds("w", 2),
      energy: 2,
    });

    expect(ev({ ...base, status: "won" })).toBe(W.wonScore);
    expect(ev({ ...base, status: "lost" })).toBe(0);

    // The won ceiling must dominate any non-terminal score so reaching a win
    // always wins the comparison.
    expect(ev({ ...base, status: "won" })).toBeGreaterThan(ev(base));
  });
});

describe("evaluate — monotonic in HP / headroom", () => {
  test("score strictly increases as HP rises, other axes fixed", () => {
    // Comfortable supply + runway so HP is the axis that moves; everything else
    // is held byte-for-byte identical across the sweep.
    const fixed = {
      hand: [...players("h", 2), ...worlds("wh", 1)],
      playerDraw: players("d", 4),
      playerDiscard: players("disc", 1),
      worldDraw: worlds("w", 2),
      acts: [worlds("a", 2)],
      energy: 3,
    };

    const hpLadder = [1, 2, 4, 6, 9, 10];
    const scores = hpLadder.map((hp) => ev(makeState({ ...fixed, hp })));

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
  });

  test("score strictly increases as player supply (headroom) rises, HP fixed", () => {
    // Hold HP and runway comfortable; grow only the player draw pile so the
    // player-availability axis improves. Supply margin is strictly increasing.
    const supplyLadder = [1, 2, 4, 7, 12];
    const scores = supplyLadder.map((n) =>
      ev(
        makeState({
          hp: 8,
          hand: [...players("h", 2), ...worlds("wh", 1)],
          playerDraw: players("d", n),
          worldDraw: worlds("w", 2),
          acts: [worlds("a", 2)],
          energy: 3,
        }),
      ),
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
  });
});

describe("evaluate — one step from loss scores worse than a safe sibling", () => {
  test("HP axis: a one-hit-from-death state scores below a high-HP sibling", () => {
    const fixed = {
      hand: [...players("h", 2), ...worlds("wh", 1)],
      playerDraw: players("d", 4),
      worldDraw: worlds("w", 2),
      acts: [worlds("a", 2)],
      energy: 3,
    };

    const brink = makeState({ ...fixed, hp: 1 });
    const safe = makeState({ ...fixed, hp: 10 });

    expect(ev(brink)).toBeLessThan(ev(safe));

    // Corroborate "one step from the HP loss line": a single point of damage
    // ends the brink state but leaves the safe sibling playing.
    expect(damage(brink, 1).state.status).toBe("lost");
    expect(damage(safe, 1).state.status).toBe("playing");
  });

  test("player-availability axis: a no-supply state scores below a stocked sibling", () => {
    // Pre-loss: a world card is held but no player card lives in any pile, so the
    // next refill draws zero player cards -> "noPlayerCards" loss (worldLost.ts).
    const preLoss = makeState({
      hand: worlds("wh", 1),
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 2,
    });

    // Safe sibling: identical except a stocked player draw pile, so the refill
    // draws player cards and the world keeps playing.
    const safe = makeState({
      hand: worlds("wh", 1),
      playerDraw: players("d", 6),
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 2,
    });

    expect(ev(preLoss)).toBeLessThan(ev(safe));

    // Corroborate the loss lines by actually stepping the core.
    expect(reduce(catalog, preLoss, { type: "EndTurn" }).state.status).toBe("lost");
    expect(reduce(catalog, safe, { type: "EndTurn" }).state.status).toBe("playing");
  });
});

describe("evaluate — worst axis dominates the spread (REQ-SCC-3)", () => {
  test("a board that dies next turn but is healthy elsewhere scores below a surviving-but-mediocre board", () => {
    // `dying`: zero player cards in every pile, so the next refill draws no
    // player card -> instant "noPlayerCards" loss (worst axis margin == 0). Every
    // OTHER axis is deliberately plush: high HP, a deep world runway, fat energy.
    // This is exactly the board the old formula mis-scored — its healthy axes
    // pumped the spread term high enough to beat a board that actually lives.
    const dying = makeState({
      hp: 20,
      hand: worlds("wh", 1),
      playerDraw: [],
      playerDiscard: [],
      worldDraw: worlds("w", 25),
      acts: [worlds("a", 25)],
      energy: 10,
    });

    // `surviving`: genuinely lives through the next turn (a player card recycles
    // from hand), but is mediocre on every axis — low HP, thin supply, short
    // runway, low energy. Its worst-axis margin is small yet strictly positive.
    const surviving = makeState({
      hp: 1,
      hand: [...players("h", 1), ...worlds("wh", 1)],
      playerDraw: [],
      playerDiscard: [],
      worldDraw: worlds("w", 1),
      acts: [],
      energy: 1,
    });

    // The invariant: a meaningfully better worst axis (surviving's > 0 vs
    // dying's == 0) must win regardless of the other axes. Under the OLD shape
    // (worstAxisWeight 100, un-normalized spreadWeight 10, axis weights summing
    // to 3.5) the dying board scored ~20.5 vs the surviving board's ~17.3 — the
    // spread overrode the worst axis and the agent would have walked into death.
    // With the normalized, shrunk spread it is ~0.6 vs ~11.3: survival wins.
    expect(ev(surviving)).toBeGreaterThan(ev(dying));

    // Corroborate the two worst-axis claims by stepping the core: the healthy
    // board dies on the very next turn; the mediocre board keeps playing.
    expect(reduce(catalog, dying, { type: "EndTurn" }).state.status).toBe("lost");
    expect(reduce(catalog, surviving, { type: "EndTurn" }).state.status).toBe("playing");
  });
});

describe("evaluate — escape dominates", () => {
  test("an available, affordable SurviveWorld play scores strictly higher", () => {
    // Common safe board: deep supply, deep runway, healthy HP and energy.
    const shared = {
      hp: 9,
      playerDraw: players("d", 6),
      playerDiscard: players("disc", 2),
      worldDraw: worlds("w", 3),
      acts: [worlds("a", 3)],
      energy: 3,
    };

    // The escape and non-escape cards are identical to the margin math (player
    // kind, unfrozen, energyCost 0): same supply, same room, same runway. The
    // ONLY difference between the two states is the SurviveWorld effect, which
    // feeds escape proximity and nothing else. Building the ready escape was
    // trivial: a single player card whose effect kind is "SurviveWorld".
    const escapeCard = makePlayerCard({
      id: "escape",
      effect: { kind: "SurviveWorld" },
      energyCost: 0,
    });
    const inertCard = makePlayerCard({
      id: "escape", // same id/cost: keeps hand size and supply identical
      effect: { kind: "None" },
      energyCost: 0,
    });

    const filler = players("h", 1);
    const withEscape = makeState({ ...shared, hand: [...filler, escapeCard] });
    const without = makeState({ ...shared, hand: [...filler, inertCard] });

    expect(ev(withEscape)).toBeGreaterThan(ev(without));

    // Margins are identical, so the entire gap is the escape term: ~escapeWeight.
    expect(ev(withEscape) - ev(without)).toBeCloseTo(W.escapeWeight, 6);
  });

  test("a ready escape beats an equally-safe board even when that board is safest otherwise", () => {
    // Both boards are comfortably safe; only one has the exit in hand. The escape
    // must still win, proving escape is an additive opportunity bonus on top of a
    // strong survival score (not folded into the survival min).
    const shared = {
      hp: 10,
      playerDraw: players("d", 8),
      playerDiscard: players("disc", 3),
      worldDraw: worlds("w", 4),
      acts: [worlds("a", 4)],
      energy: 4,
    };

    const withEscape = makeState({
      ...shared,
      hand: [
        ...players("h", 1),
        makePlayerCard({ id: "exit", effect: { kind: "SurviveWorld" }, energyCost: 1 }),
      ],
    });
    const safeNoEscape = makeState({
      ...shared,
      hand: players("h", 2),
    });

    expect(ev(withEscape)).toBeGreaterThan(ev(safeNoEscape));
  });
});
