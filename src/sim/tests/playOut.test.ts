/**
 * Tests for the agent-performance telemetry `playOut` (src/sim/playOut.ts)
 * now records: action-kind counts, unused-energy accounting, no-progress
 * EndTurn tracking, and posthoc ground-truth pressure minima.
 *
 * Two complementary strategies are used, matching the plan's validation gate
 * ("compute the expected values by hand/by reasoning about the fixture,
 * don't just assert 'some plausible number'"):
 *
 *  - An `alwaysEndTurn` policy (never plays a card) makes the real state
 *    trajectory fully independent of the agent rng, so its exact numbers can
 *    be derived by hand from the game rules (energy: +1/turn, never spent)
 *    and confirmed by an out-of-band replay using the core engine directly
 *    (createWorld + reduce), never by calling `playOut` itself.
 *  - For `randomPolicy`, a from-scratch replay (`independentlyReplay` below)
 *    walks the same deterministic (seed, agentRng) trace using the core
 *    engine and `measureEvalAxes` directly, accumulating each counter with
 *    freshly-written arithmetic that shares no code with `playOut`'s
 *    accumulators. `playOut`'s `Outcome` is then compared against this
 *    independent computation, not against itself.
 */
import { describe, expect, test } from "bun:test";
import { createWorld } from "../../core/engine/world";
import { reduce } from "../../core/engine/reduce";
import { createRng, nextFloat, rngFromSeed } from "../../core/engine/rng";
import type { GameState, RngState } from "../../core/model/types";
import type { CardCatalog, WorldData } from "../../core/model/catalog";
import { checkIdAccounting } from "../accounting";
import { determinize } from "../determinize";
import { DEFAULT_EVAL_WEIGHTS, measureEvalAxes } from "../eval";
import type { ActionCounts } from "../playOut";
import { playOut } from "../playOut";
import { catalog, randomPolicy, worldData } from "../policy";
import type { Policy } from "../policy";

/**
 * Never plays a card: always ends the turn immediately. Ignores `view` and
 * `rng` entirely, so the real committed state trajectory it drives depends
 * only on (catalog, worldData, seed) — never on the agent rng passed to
 * `playOut` — which is what makes it independently hand-verifiable.
 */
const alwaysEndTurn: Policy = () => ({ type: "EndTurn" });

const emptyActionCounts = (): ActionCounts => ({
  PlayCard: 0,
  DiscardHazard: 0,
  EndTurn: 0,
  ChooseBoon: 0,
});

describe("playOut — action counting and unused-energy telemetry", () => {
  test("alwaysEndTurn policy: exact action, energy, and no-progress counts on a natural loss", () => {
    // Independently confirmed (createWorld + repeated `reduce(..., {type:
    // "EndTurn"})`, no playOut involved) for seed=1 on the shared test-fixture
    // world: the policy never spends energy, so energy at each EndTurn's
    // decision point is exactly the turn number (1,2,3,4,5,6) — `gainEnergy`
    // adds +1/turn and nothing ever subtracts it. HP falls 10,9,8,7,5,2 and
    // then to 0 after the 6th EndTurn resolves, ending the run in a loss.
    // World-cards-remaining at each EndTurn is 30,29,28,27,27,27: turns 2-4
    // each decreased (progress), turns 5 and 6 held flat (no progress), and
    // turn 1 is the excluded baseline.
    const outcome = playOut(catalog, worldData, 1, alwaysEndTurn, createRng(0), {
      maxActions: 100,
    });

    expect(outcome.status).toBe("lost");
    expect(outcome.capped).toBe(false);
    expect(outcome.turns).toBe(6);

    expect(outcome.actionCounts).toEqual({
      PlayCard: 0,
      DiscardHazard: 0,
      EndTurn: 6,
      ChooseBoon: 0,
    });
    expect(outcome.totalActions).toBe(6);
    // Reconciliation: the total must equal the sum of the per-kind counts.
    const summedActions = Object.values(outcome.actionCounts).reduce((a, b) => a + b, 0);
    expect(summedActions).toBe(outcome.totalActions);

    expect(outcome.positiveUnusedEndTurns).toBe(6);
    expect(outcome.totalUnusedEnergy).toBe(1 + 2 + 3 + 4 + 5 + 6);
    expect(outcome.positiveUnusedEndTurns).toBeLessThanOrEqual(outcome.actionCounts.EndTurn);
    expect(outcome.totalUnusedEnergy).toBeGreaterThanOrEqual(outcome.positiveUnusedEndTurns);

    expect(outcome.noProgressEndTurns).toBe(2);

    // Ground-truth pressure minima across the 6 in-loop samples plus the
    // final post-loop sample: hp 10,9,8,7,5,2,0; energy 1,2,3,4,5,6,6;
    // playerSupply constant 10; predictedPlayerRoom 3,3,3,3,2,1,1; runway
    // 34,33,32,31,31,31,31.
    expect(outcome.posthocPressure).toEqual({
      minHp: 0,
      minPlayerSupply: 10,
      minPredictedPlayerRoom: 1,
      minRunwayRemaining: 31,
      minEnergy: 1,
    });
  });

  test("one-EndTurn fixture: the first EndTurn sets the no-progress baseline and is not counted", () => {
    // Same seed/policy as above, capped after exactly one action so only the
    // first EndTurn ever happens.
    const outcome = playOut(catalog, worldData, 1, alwaysEndTurn, createRng(0), {
      maxActions: 1,
    });

    expect(outcome.capped).toBe(true); // still "playing" after just one EndTurn
    expect(outcome.turns).toBe(1);
    expect(outcome.actionCounts).toEqual({ ...emptyActionCounts(), EndTurn: 1 });
    expect(outcome.totalActions).toBe(1);

    // With only one EndTurn ever decided, noProgressEndTurns must be 0 not
    // because there happens to be nothing to compare, but because the plan
    // explicitly excludes the FIRST EndTurn from the no-progress comparison
    // (it only establishes the baseline). A bug that compared against a
    // default baseline (e.g. treating a missing previous count as 0 or
    // Infinity) would make this turn register as progress or no-progress;
    // it must do neither.
    expect(outcome.noProgressEndTurns).toBe(0);

    expect(outcome.positiveUnusedEndTurns).toBe(1);
    expect(outcome.totalUnusedEnergy).toBe(1);

    // Two samples only: before the first (only) decision (hp=10, energy=1,
    // supply=10, room=3, runway=34) and once after the loop ends (hp=9,
    // energy=2, supply=10, room=3, runway=33).
    expect(outcome.posthocPressure).toEqual({
      minHp: 9,
      minPlayerSupply: 10,
      minPredictedPlayerRoom: 3,
      minRunwayRemaining: 33,
      minEnergy: 1,
    });
  });

  test("checkIdAccounting still holds before every decision and at the terminal state", () => {
    // Not a regression test of accounting itself (see sim.test.ts / eval
    // tests for that); this just confirms the new bookkeeping did not
    // dislodge the existing call sites for a policy/seed combo exercised
    // above.
    let state = createWorld(catalog, worldData, 1).state;
    let actions = 0;
    while (state.status === "playing" && actions < 100) {
      expect(() => checkIdAccounting(state)).not.toThrow();
      state = reduce(catalog, state, { type: "EndTurn" }).state;
      actions++;
    }
    expect(() => checkIdAccounting(state)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Independent replay for randomPolicy fixtures
// ---------------------------------------------------------------------------

interface ReplayResult {
  hpSamples: number[];
  energySamples: number[];
  playerSupplySamples: number[];
  predictedPlayerRoomSamples: number[];
  runwaySamples: number[];
  actionCounts: ActionCounts;
  totalActions: number;
  positiveUnusedEndTurns: number;
  totalUnusedEnergy: number;
  noProgressEndTurns: number;
}

/**
 * Walks the exact same (seed, policy, agentRng) decision trace `playOut`
 * would, but with its own freshly-written accumulation — no import of, or
 * delegation to, `playOut`'s internals. Used to cross-check `playOut`'s
 * bookkeeping against an independently-derived answer rather than against
 * itself.
 */
function independentlyReplay(
  seed: number,
  policy: Policy,
  agentRng: RngState,
  maxActions: number,
): ReplayResult {
  let state: GameState = createWorld(catalog, worldData, seed).state;
  let rng = agentRng;
  let actions = 0;
  const actionCounts = emptyActionCounts();
  const hpSamples: number[] = [];
  const energySamples: number[] = [];
  const playerSupplySamples: number[] = [];
  const predictedPlayerRoomSamples: number[] = [];
  const runwaySamples: number[] = [];
  let positiveUnusedEndTurns = 0;
  let totalUnusedEnergy = 0;
  let noProgressEndTurns = 0;
  let worldCardsAtPreviousEndTurn: number | undefined;

  const sample = (s: GameState) => {
    const axes = measureEvalAxes(s, DEFAULT_EVAL_WEIGHTS);
    hpSamples.push(axes.hp);
    energySamples.push(axes.energy);
    playerSupplySamples.push(axes.playerSupply);
    predictedPlayerRoomSamples.push(axes.predictedPlayerRoom);
    runwaySamples.push(axes.runwayRemaining);
    return axes;
  };

  while (state.status === "playing" && actions < maxActions) {
    const axes = sample(state);
    const [view, rngAfterDet] = determinize(state, rng);
    const [seedValue, rngAfterPolicy] = nextFloat(rngAfterDet);
    const policyRng = rngFromSeed(Math.floor(seedValue * 0x100000000));
    rng = rngAfterPolicy;
    const action = policy(view, policyRng);

    if (action.type === "EndTurn") {
      if (state.energy > 0) positiveUnusedEndTurns++;
      totalUnusedEnergy += state.energy;
      if (
        worldCardsAtPreviousEndTurn !== undefined &&
        axes.worldCardsRemaining >= worldCardsAtPreviousEndTurn
      ) {
        noProgressEndTurns++;
      }
      worldCardsAtPreviousEndTurn = axes.worldCardsRemaining;
    }

    actionCounts[action.type]++;
    state = reduce(catalog, state, action).state;
    actions++;
  }

  sample(state);

  return {
    hpSamples,
    energySamples,
    playerSupplySamples,
    predictedPlayerRoomSamples,
    runwaySamples,
    actionCounts,
    totalActions: actions,
    positiveUnusedEndTurns,
    totalUnusedEnergy,
    noProgressEndTurns,
  };
}

describe("playOut — posthoc pressure minima under randomPolicy", () => {
  test("minEnergy is a genuine running minimum, not the final sample", () => {
    // seed=1, agentSeed=1 on the shared fixture world: energy dips to 0
    // twice mid-run (never-spent-down-to-zero moments) and then climbs to 8
    // by the final sample, independently confirmed by `independentlyReplay`
    // below. A buggy implementation that just overwrote the tracked value on
    // every sample (instead of taking a running min) would report 8, not 0.
    const seed = 1;
    const agentSeed = 1;
    const maxActions = 300;

    const replay = independentlyReplay(seed, randomPolicy, createRng(agentSeed), maxActions);
    const outcome = playOut(catalog, worldData, seed, randomPolicy, createRng(agentSeed), {
      maxActions,
    });

    // Cross-check every new counter against the independent replay.
    expect(outcome.actionCounts).toEqual(replay.actionCounts);
    expect(outcome.totalActions).toBe(replay.totalActions);
    expect(outcome.positiveUnusedEndTurns).toBe(replay.positiveUnusedEndTurns);
    expect(outcome.totalUnusedEnergy).toBe(replay.totalUnusedEnergy);
    expect(outcome.noProgressEndTurns).toBe(replay.noProgressEndTurns);

    expect(outcome.posthocPressure).toEqual({
      minHp: Math.min(...replay.hpSamples),
      minPlayerSupply: Math.min(...replay.playerSupplySamples),
      minPredictedPlayerRoom: Math.min(...replay.predictedPlayerRoomSamples),
      minRunwayRemaining: Math.min(...replay.runwaySamples),
      minEnergy: Math.min(...replay.energySamples),
    });

    // The genuine-minimum proof: the minimum is strictly below the final
    // sample, so the field cannot have been produced by "keep the latest
    // sample" bookkeeping.
    const lastEnergySample = replay.energySamples[replay.energySamples.length - 1]!;
    expect(outcome.posthocPressure.minEnergy).toBe(0);
    expect(lastEnergySample).toBeGreaterThan(outcome.posthocPressure.minEnergy);
  });
});

// ---------------------------------------------------------------------------
// Forfeit clause (hopeless-state give-up).
//
// The stall world below can neither be won (no SurviveWorld anywhere) nor
// lost (every hook is None, nothing ever deals damage), and its hazards can't
// be cleared (cost 99, starter deals no progress), discarded, or exiled — so
// world-cards-remaining is CONSTANT and every EndTurn after the first is a
// no-progress turn. Exactly 2 hazards (== startWorldCards): both sit in the
// opening hand and the world draw stays empty, so the hand never floods and
// core's own noPlayerCards loss (which a BIGGER immovable act triggers within
// a few turns) never fires — the stall is genuinely indefinite. Without forfeit, a run burns the whole action cap in
// policy decisions; with it, the runner must stop consulting the policy at
// the threshold and spend the rest of the cap on free EndTurns. The policy
// call count is the observable that proves the rollout cost actually stops.
// ---------------------------------------------------------------------------

const STALL_FIDGET = "stall-fidget";
const STALL_HAZARD = "stall-hazard";

const stallCatalog: CardCatalog = {
  [STALL_FIDGET]: {
    kind: "player",
    name: "fidget",
    effect: { kind: "None" },
    energyCost: 0,
  },
  [STALL_HAZARD]: {
    kind: "world",
    name: "immovable",
    cost: 99,
    keywords: [],
    discardable: false,
    canExile: false,
    onDiscarded: { kind: "None" },
    onCleared: { kind: "None" },
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
    onDraw: { kind: "None" },
  },
};

const stallWorld: WorldData = {
  worldId: "stall-world",
  starterDeck: [{ templateId: STALL_FIDGET, count: 12 }],
  deckComposition: {
    acts: [{ cards: [{ templateId: STALL_HAZARD, count: 2 }] }],
  },
};

describe("playOut — forfeit clause", () => {
  test("forfeits after N consecutive no-progress EndTurns and stops consulting the policy", () => {
    // alwaysEndTurn timeline on the stall world (world-cards-remaining is
    // constant): EndTurn 1 sets the baseline; EndTurns 2/3/4 are no-progress
    // turns 1/2/3; the check before decision 5 sees 3 >= 3 and forfeits.
    let policyCalls = 0;
    const countingEndTurn: Policy = () => {
      policyCalls++;
      return { type: "EndTurn" };
    };

    const outcome = playOut(stallCatalog, stallWorld, 1, countingEndTurn, createRng(0), {
      maxActions: 12,
      forfeit: { noProgressTurns: 3, maxActionsPerTurn: 40 },
    });

    expect(outcome.forfeited).toBe(true);
    expect(policyCalls).toBe(4);
    // The stall world has no terminal, so the run still caps — but the
    // post-forfeit actions are free EndTurns, not eval'd decisions.
    expect(outcome.status).toBe("capped");
    expect(outcome.turns).toBe(12);
    expect(outcome.actionCounts.EndTurn).toBe(12);

    // Efficiency counters cover agent DECISIONS only: exactly the 4 policy
    // EndTurns (energy 1+2+3+4 unspent; no-progress turns 2-4), with the 8
    // post-forfeit EndTurns excluded.
    expect(outcome.positiveUnusedEndTurns).toBe(4);
    expect(outcome.totalUnusedEnergy).toBe(1 + 2 + 3 + 4);
    expect(outcome.noProgressEndTurns).toBe(3);
  });

  test("without the forfeit option the same run consults the policy for every action", () => {
    let policyCalls = 0;
    const countingEndTurn: Policy = () => {
      policyCalls++;
      return { type: "EndTurn" };
    };

    const outcome = playOut(stallCatalog, stallWorld, 1, countingEndTurn, createRng(0), {
      maxActions: 12,
    });

    expect(outcome.forfeited).toBe(false);
    expect(policyCalls).toBe(12);
    expect(outcome.status).toBe("capped");
    expect(outcome.noProgressEndTurns).toBe(11);
  });

  test("forfeits on a degenerate in-turn loop via maxActionsPerTurn", () => {
    // Plays a fidget whenever one is in hand and never ends the turn on its
    // own — the shape of an agent dodging an EndTurn it scores as lethal.
    let policyCalls = 0;
    const playFidgets: Policy = (view) => {
      policyCalls++;
      const fidget = view.hand.find((card) => card.kind === "player");
      return fidget !== undefined
        ? { type: "PlayCard", cardId: fidget.id }
        : { type: "EndTurn" };
    };

    const outcome = playOut(stallCatalog, stallWorld, 1, playFidgets, createRng(0), {
      maxActions: 12,
      forfeit: { noProgressTurns: 50, maxActionsPerTurn: 2 },
    });

    // Decisions 1 and 2 play fidgets; the check before decision 3 sees 2
    // actions this turn >= 2 and forfeits.
    expect(outcome.forfeited).toBe(true);
    expect(policyCalls).toBe(2);
    expect(outcome.actionCounts.PlayCard).toBe(2);
    expect(outcome.actionCounts.EndTurn).toBe(10);
    expect(outcome.status).toBe("capped");
  });
});
