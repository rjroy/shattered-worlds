/**
 * Unit tests for `measureEvalAxes` (`src/sim/eval.ts`).
 *
 * `measureEvalAxes` is the single shared measurement `evaluate` builds its
 * score from; these tests exercise it directly so raw quantities, margins,
 * frozen/heat relief, and world-cards-remaining are pinned independently of
 * `evaluate`'s scoring formula. A final reconciliation test proves the two
 * can't drift apart: rebuilding `evaluate`'s min-of-margins arithmetic from
 * `EvalAxes` fields alone reproduces `evaluate`'s actual return value.
 */
import { describe, expect, test } from "bun:test";
import type { PlayerCard, WorldCard } from "../../core/model/types";
import { makePlayerCard, makeState, makeWorldCard } from "../../core/tests/testFixture";
import { DEFAULT_EVAL_WEIGHTS, evaluate, measureEvalAxes } from "../eval";
import type { EvalAxes, EvalWeights } from "../eval";

const W = DEFAULT_EVAL_WEIGHTS;

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

describe("measureEvalAxes — representative non-terminal state", () => {
  test("raw quantities and margins match the hand-computed formula", () => {
    const state = makeState({
      hp: 5,
      hand: [...players("h", 1), ...worlds("wh", 1)],
      playerDraw: players("d", 3),
      playerDiscard: players("disc", 1),
      worldDraw: worlds("w", 2),
      acts: [worlds("a", 2)],
      energy: 2,
      heat: 0,
    });

    const axes = measureEvalAxes(state, W);

    // effectiveHandSize == 6 (baseHandSize, actIndex 0).
    // worldInHand=1, frozenPlayer=0, netFrozen=0.
    // worldRemainingForRefill = worldDraw(2) + acts(2) = 4.
    // refillRoom = 6 - worldInHand(1) = 5.
    // forcedWorldDraw = min(max(1, startWorldCards(2)-1)=1, 5, 4) = 1.
    // occupiedSlots = 1 + 0 + 1 = 2 -> predictedPlayerRoom = 6 - 2 = 4.
    expect(axes.hp).toBe(5);
    expect(axes.predictedPlayerRoom).toBe(4);
    // playerSupply = playerDraw(3) + playerDiscard(1) + unfrozenInHand(1) = 5.
    expect(axes.playerSupply).toBe(5);
    // runwayRemaining = playerDraw(3) + playerDiscard(1) + worldDraw(2) + acts(2) = 8.
    expect(axes.runwayRemaining).toBe(8);
    expect(axes.energy).toBe(2);
    // worldCardsRemaining = worldDraw(2) + acts(2) + worldInHand(1) = 5.
    expect(axes.worldCardsRemaining).toBe(5);

    expect(axes.hpMargin).toBeCloseTo(5 / (5 + W.hpComfort), 12);
    expect(axes.playerRoomMargin).toBeCloseTo(4 / (4 + W.playerRoomComfort), 12);
    expect(axes.playerSupplyMargin).toBeCloseTo(5 / (5 + W.playerSupplyComfort), 12);
    expect(axes.playerAvailabilityMargin).toBe(
      Math.min(axes.playerRoomMargin, axes.playerSupplyMargin),
    );
    expect(axes.runwayMargin).toBeCloseTo(8 / (8 + W.runwayComfort), 12);
    expect(axes.energyMargin).toBeCloseTo(2 / (2 + W.energyComfort), 12);
    expect(axes.escapeProximity).toBe(0);
  });
});

describe("measureEvalAxes — terminal states get no special-casing", () => {
  // Unlike `evaluate` (which short-circuits "won"/"lost" to a fixed score),
  // `measureEvalAxes` is a raw measurement of whatever `GameState` it is
  // handed. A terminal state still has concrete hp/hand/pile contents (the
  // snapshot at the moment the world ended), and telemetry wants to see
  // those real numbers, not a fabricated ceiling/floor. So the axes for a
  // "won"/"lost" state must equal the axes of the identical fields under
  // "playing" — sound because nothing in the formulas reads `status`.
  test("axes for a won/lost state equal the axes of the same fields while playing", () => {
    const fields = {
      hp: 3,
      hand: [...players("h", 1), ...worlds("wh", 1)],
      playerDraw: players("d", 2),
      playerDiscard: [] as PlayerCard[],
      worldDraw: worlds("w", 1),
      acts: [] as WorldCard[][],
      energy: 1,
      heat: 0,
    };

    const playing = measureEvalAxes(makeState({ ...fields, status: "playing" }), W);
    const won = measureEvalAxes(makeState({ ...fields, status: "won" }), W);
    const lost = measureEvalAxes(makeState({ ...fields, status: "lost" }), W);

    expect(won).toEqual(playing);
    expect(lost).toEqual(playing);
  });
});

describe("measureEvalAxes — zero/negative margins", () => {
  test("hp <= 0 saturates hpMargin to 0", () => {
    const state = makeState({ hp: 0, hand: players("h", 1), playerDraw: players("d", 2) });
    expect(measureEvalAxes(state, W).hpMargin).toBe(0);

    // saturate() treats any non-positive amount alike; confirm the same holds
    // for a state that (structurally) ends up with negative predicted room.
    const negRoom = measureEvalAxes(
      makeState({
        hp: 8,
        // 5 frozen + 1 world card occupies more than the 6-slot hand once the
        // forced world draw is added, driving predictedPlayerRoom negative.
        hand: [
          ...Array.from({ length: 5 }, (_, i) =>
            makePlayerCard({ id: `fz-${i}`, effect: { kind: "None" }, frozen: 1 }),
          ),
          ...worlds("wh", 1),
        ],
        worldDraw: worlds("w", 3),
        acts: [],
        heat: 0,
      }),
      W,
    );
    expect(negRoom.predictedPlayerRoom).toBeLessThan(0);
    expect(negRoom.playerRoomMargin).toBe(0);
  });

  test("no player supply anywhere saturates playerSupplyMargin and the combined margin to 0", () => {
    const state = makeState({
      hp: 8,
      hand: worlds("wh", 1),
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 1,
    });

    const axes = measureEvalAxes(state, W);
    expect(axes.playerSupply).toBe(0);
    expect(axes.playerSupplyMargin).toBe(0);
    expect(axes.playerAvailabilityMargin).toBe(0);
  });
});

describe("measureEvalAxes — empty world piles", () => {
  test("worldDraw and acts both empty: worldCardsRemaining and runway reflect only hand/player piles", () => {
    const state = makeState({
      hp: 8,
      hand: players("h", 2),
      playerDraw: players("d", 3),
      playerDiscard: players("disc", 1),
      worldDraw: [],
      acts: [],
      energy: 1,
    });

    const axes = measureEvalAxes(state, W);
    expect(axes.worldCardsRemaining).toBe(0);
    expect(axes.runwayRemaining).toBe(4); // playerDraw(3) + playerDiscard(1)
  });
});

describe("measureEvalAxes — frozen cards and heat thaw relief", () => {
  test("frozen player cards in hand reduce predictedPlayerRoom relative to an unfrozen sibling", () => {
    const unfrozen = makeState({
      hp: 8,
      hand: [
        ...players("uf", 2),
        makePlayerCard({ id: "extra", effect: { kind: "None" } }),
      ],
      playerDraw: players("d", 3),
      worldDraw: worlds("w", 2),
      acts: [],
      heat: 0,
    });
    const frozen = makeState({
      hp: 8,
      hand: [
        ...players("uf", 2),
        makePlayerCard({ id: "extra", effect: { kind: "None" }, frozen: 1 }),
      ],
      playerDraw: players("d", 3),
      worldDraw: worlds("w", 2),
      acts: [],
      heat: 0,
    });

    const axesUnfrozen = measureEvalAxes(unfrozen, W);
    const axesFrozen = measureEvalAxes(frozen, W);

    expect(axesFrozen.predictedPlayerRoom).toBeLessThan(axesUnfrozen.predictedPlayerRoom);
    // Freezing also removes the card from unfrozen-hand supply counting.
    expect(axesFrozen.playerSupply).toBeLessThan(axesUnfrozen.playerSupply);
  });

  test("heat thaws frozen cards back into room, monotonically up to full relief", () => {
    const stateAt = (heat: number) =>
      makeState({
        hp: 8,
        hand: [
          ...Array.from({ length: 3 }, (_, i) =>
            makePlayerCard({ id: `fz-${i}`, effect: { kind: "None" }, frozen: 1 }),
          ),
          ...worlds("wh", 1),
        ],
        playerDraw: players("d", 3),
        worldDraw: worlds("w", 2),
        acts: [],
        heat,
      });

    const room0 = measureEvalAxes(stateAt(0), W).predictedPlayerRoom;
    const room1 = measureEvalAxes(stateAt(1), W).predictedPlayerRoom;
    const room2 = measureEvalAxes(stateAt(2), W).predictedPlayerRoom;
    const room3 = measureEvalAxes(stateAt(3), W).predictedPlayerRoom;

    // heatThawEfficiency is 1 in DEFAULT_EVAL_WEIGHTS, so each point of heat
    // thaws one of the 3 frozen cards until all are relieved (heat >= 3).
    expect(room1).toBeGreaterThan(room0);
    expect(room2).toBeGreaterThan(room1);
    expect(room3).toBeGreaterThan(room2);
    // Heat beyond full relief (3) has nothing left to thaw.
    expect(measureEvalAxes(stateAt(4), W).predictedPlayerRoom).toBe(room3);
  });
});

describe("measureEvalAxes — independent axis variation", () => {
  const base = {
    hp: 8,
    hand: [...players("h", 1), ...worlds("wh", 1)],
    playerDraw: players("d", 3),
    playerDiscard: [] as PlayerCard[],
    worldDraw: worlds("w", 2),
    acts: [worlds("a", 2)] as WorldCard[][],
    energy: 2,
    heat: 0,
  };

  test.each([
    { extraPlayerDraw: 0, expectedSupply: 4 },
    { extraPlayerDraw: 5, expectedSupply: 9 },
    { extraPlayerDraw: 10, expectedSupply: 14 },
  ])(
    "player supply scales with playerDraw size ($extraPlayerDraw extra)",
    ({ extraPlayerDraw, expectedSupply }) => {
      const state = makeState({
        ...base,
        playerDraw: players("d", 3 + extraPlayerDraw),
      });
      expect(measureEvalAxes(state, W).playerSupply).toBe(expectedSupply);
    },
  );

  test.each([
    { discardSize: 0, expectedRunway: 2 + 2 }, // worldDraw(2) + acts(2)
    { discardSize: 4, expectedRunway: 4 + 4 },
    { discardSize: 9, expectedRunway: 4 + 9 },
  ])(
    "runwayRemaining scales with playerDiscard size ($discardSize)",
    ({ discardSize, expectedRunway }) => {
      const state = makeState({
        ...base,
        playerDraw: [],
        playerDiscard: players("disc", discardSize),
      });
      expect(measureEvalAxes(state, W).runwayRemaining).toBe(expectedRunway);
    },
  );

  test.each([
    { actCards: 0, expectedWorldRemaining: 2 + 0 + 1 }, // worldDraw(2) + acts + hand world(1)
    { actCards: 3, expectedWorldRemaining: 2 + 3 + 1 },
    { actCards: 10, expectedWorldRemaining: 2 + 10 + 1 },
  ])(
    "worldCardsRemaining scales with acts size ($actCards)",
    ({ actCards, expectedWorldRemaining }) => {
      const state = makeState({
        ...base,
        acts: actCards > 0 ? [worlds("a", actCards)] : [],
      });
      expect(measureEvalAxes(state, W).worldCardsRemaining).toBe(expectedWorldRemaining);
    },
  );
});

describe("measureEvalAxes — reconciles with evaluate() (no formula drift)", () => {
  /**
   * Rebuilds `evaluate`'s min-of-margins arithmetic (worst-axis dominance +
   * normalized spread + escape) purely from `EvalAxes` fields. Requires
   * `progressWeight === 0` (DEFAULT_EVAL_WEIGHTS ships it disabled) since the
   * plateau-breaking term is intentionally not carried in `EvalAxes` — its
   * value comes from `forwardProgress`, a scoring-only helper.
   */
  function reconstructScore(axes: EvalAxes, w: EvalWeights): number {
    if (w.progressWeight !== 0) {
      throw new Error("reconstructScore assumes progressWeight === 0");
    }
    const worst = Math.min(axes.hpMargin, axes.playerAvailabilityMargin, axes.runwayMargin);
    const axisWeightSum =
      w.hpAxisWeight + w.playerAvailAxisWeight + w.exhaustionAxisWeight + w.energyAxisWeight;
    const weightedMargins =
      w.hpAxisWeight * axes.hpMargin +
      w.playerAvailAxisWeight * axes.playerAvailabilityMargin +
      w.exhaustionAxisWeight * axes.runwayMargin +
      w.energyAxisWeight * axes.energyMargin;
    const spread = axisWeightSum > 0 ? weightedMargins / axisWeightSum : 0;
    const escape = w.escapeWeight * axes.escapeProximity;
    return w.worstAxisWeight * worst + w.spreadWeight * spread + escape;
  }

  test("reconstructed score matches evaluate()'s output across representative states", () => {
    const escapeCard = makePlayerCard({
      id: "escape",
      effect: { kind: "SurviveWorld" },
      energyCost: 0,
    });

    const states = [
      makeState({
        hp: 5,
        hand: [...players("h", 1), ...worlds("wh", 1)],
        playerDraw: players("d", 3),
        playerDiscard: players("disc", 1),
        worldDraw: worlds("w", 2),
        acts: [worlds("a", 2)],
        energy: 2,
      }),
      makeState({
        hp: 1,
        hand: worlds("wh", 1),
        playerDraw: [],
        playerDiscard: [],
        worldDraw: [],
        acts: [],
        energy: 0,
      }),
      makeState({
        hp: 20,
        hand: [...players("h", 1), escapeCard],
        playerDraw: players("d", 8),
        playerDiscard: players("disc", 2),
        worldDraw: worlds("w", 4),
        acts: [worlds("a", 4)],
        energy: 4,
      }),
      makeState({
        hp: 3,
        hand: [
          makePlayerCard({ id: "fz", effect: { kind: "None" }, frozen: 2 }),
          ...worlds("wh", 1),
        ],
        playerDraw: players("d", 1),
        worldDraw: worlds("w", 1),
        acts: [],
        heat: 1,
        energy: 1,
      }),
    ];

    for (const state of states) {
      const axes = measureEvalAxes(state, W);
      expect(reconstructScore(axes, W)).toBeCloseTo(evaluate(state, W), 12);
    }
  });
});
