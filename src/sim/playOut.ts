import { createWorld } from "../core/engine/world";
import { reduce } from "../core/engine/reduce";
import { nextFloat, rngFromSeed } from "../core/engine/rng";
import type { CardCatalog, WorldData } from "../core/model/catalog";
import type { Action, RngState, WorldLostCause } from "../core/model/types";
import type { RunModifiers } from "../data/unlocks/types";
import { checkIdAccounting } from "./accounting";
import { determinize } from "./determinize";
import { DEFAULT_EVAL_WEIGHTS, measureEvalAxes, type EvalWeights } from "./eval";
import type { Policy } from "./policy";

// ---------------------------------------------------------------------------
// Shared play-out loop
//
// This is the decide-on-a-determinized-view / commit-to-the-real-state loop that
// `run.ts` used to inline. It is extracted here so both the random-sim CLI
// (run.ts) and the completeness runner (completeness.ts) drive a single,
// identical loop. The behavior is byte-for-byte what run.ts did before: same
// rng bridge, same `checkIdAccounting` call sites, same terminal classification.
// ---------------------------------------------------------------------------

/**
 * Terminal disposition of one play-out. "won"/"lost" are real core terminals;
 * "capped" means the action cap was hit while still `playing` (the old
 * `violations` bucket in run.ts).
 */
export type PlayOutStatus = "won" | "lost" | "capped";

export interface PlayOutOptions {
  /** Hard cap on actions before the play-out is declared `capped`. */
  maxActions: number;
  /** Optional unlock-derived modifiers applied when constructing the run. */
  runModifiers?: RunModifiers;
  /**
   * Weights for the posthoc ground-truth pressure telemetry (see
   * {@link GroundTruthPressure}). Defaults to `DEFAULT_EVAL_WEIGHTS` so
   * existing callers (e.g. `run.ts`'s random-policy loop, which never scores
   * with these weights) keep compiling and behave exactly as before —
   * these weights only shape a diagnostic, never the agent's decision.
   */
  weights?: EvalWeights;
}

/** Per-`Action["type"]` counts, kept in sync with the `Action` union by construction. */
export type ActionCounts = Record<Action["type"], number>;

/**
 * Per-run MINIMUM of posthoc ground-truth pressure axes (see `measureEvalAxes`
 * in `./eval`), sampled from the REAL committed `state` — never the agent's
 * determinized `view` — immediately before every decision and once more after
 * the loop terminates. These are outcome diagnostics only: they must never be
 * confused with what the honest agent perceived (that's always `view`), and
 * they are never fed back into the agent's decision.
 */
export interface GroundTruthPressure {
  minHp: number;
  minPlayerSupply: number;
  minPredictedPlayerRoom: number;
  minRunwayRemaining: number;
  minEnergy: number;
}

/**
 * The result of a single play-out. `finalAgentRng` is REQUIRED: it is the agent
 * rng state AFTER this play-out, so a multi-seed / multi-world loop can thread it
 * forward and keep one continuous, reproducible agent rng stream (REQ-SCC-16).
 * Dropping it would reseed each play-out and break reproducibility.
 *
 * `actReached` and `actAtLoss` are 0-based `actIndex` values (see GameState);
 * callers that display them to humans add 1 and pair them with `totalActs`.
 */
export interface Outcome {
  status: PlayOutStatus;
  /** EndTurn count: how many turns the world survived. */
  turns: number;
  /** Furthest act reached during the play-out (0-based actIndex). */
  actReached: number;
  /** Loss cause from the `WorldLost` event, when the play-out ended in a loss. */
  lossCause?: WorldLostCause;
  /** Act index at the moment status flipped to "lost" (0-based). */
  actAtLoss?: number;
  /** True when the action cap was hit without reaching a terminal state. */
  capped: boolean;
  finalAgentRng: RngState;

  /** Total actions taken (== the sum of `actionCounts`). */
  totalActions: number;
  /** Actions taken, broken out by `Action["type"]`. */
  actionCounts: ActionCounts;

  /**
   * `EndTurn`s where the committed state still had energy left unspent.
   * Raw count only: `positiveUnusedEndTurns <= actionCounts.EndTurn`. The
   * report-aggregation phase divides by `EndTurn` counts to get a rate; that
   * ratio is deliberately not computed here.
   */
  positiveUnusedEndTurns: number;
  /**
   * Sum of unused energy (the committed state's `energy` immediately before
   * each `EndTurn` was applied) across every `EndTurn` in the run. Raw total
   * only, same reasoning as `positiveUnusedEndTurns`.
   */
  totalUnusedEnergy: number;

  /**
   * Count of `EndTurn`s (excluding the very first, which only establishes the
   * baseline) whose world-cards-remaining count did not decrease since the
   * previous `EndTurn` — see `GroundTruthPressure`'s sibling, `EvalAxes.
   * worldCardsRemaining`. An increase (e.g. recurrence) also counts as no
   * progress. `actionCounts.EndTurn - 1` (when `EndTurn` count >= 2) is the
   * comparable-turn denominator for a later no-progress RATE; no separate
   * field is stored for it since it is fully derivable from `actionCounts`.
   */
  noProgressEndTurns: number;

  /** See {@link GroundTruthPressure}. */
  posthocPressure: GroundTruthPressure;
}

/**
 * Run a single world to a terminal state (or the action cap) under `policy`.
 *
 * `catalog` and `worldData` are parameterized so callers can pass either the
 * test fixture (run.ts) or a `buildWorld(...)` pairing (completeness.ts). The
 * `createWorld(catalog, worldData, seed)` path is exactly the one run.ts used.
 *
 * The loop scans each `reduce` result's events for `WorldLost` to capture the
 * loss `cause`, and records the act index at the moment the status flips to lost.
 * `checkIdAccounting` is asserted before every decision and once at the terminal,
 * matching run.ts.
 */
export function playOut(
  catalog: CardCatalog,
  worldData: WorldData,
  seed: number,
  policy: Policy,
  agentRng: RngState,
  opts: PlayOutOptions,
): Outcome {
  let state = createWorld(catalog, worldData, seed, opts.runModifiers).state;
  let rng = agentRng;
  let turns = 0;
  let actions = 0;
  let actReached = state.actIndex;
  let lossCause: WorldLostCause | undefined;
  let actAtLoss: number | undefined;

  const weights = opts.weights ?? DEFAULT_EVAL_WEIGHTS;
  const actionCounts: ActionCounts = { PlayCard: 0, DiscardHazard: 0, EndTurn: 0, ChooseBoon: 0 };
  let positiveUnusedEndTurns = 0;
  let totalUnusedEnergy = 0;
  let noProgressEndTurns = 0;
  // World-cards-remaining count as of the previous EndTurn's decision point;
  // undefined until the first EndTurn happens, since it has nothing to
  // compare against and is excluded from no-progress counting.
  let worldCardsAtPreviousEndTurn: number | undefined;
  let minHp = Infinity;
  let minPlayerSupply = Infinity;
  let minPredictedPlayerRoom = Infinity;
  let minRunwayRemaining = Infinity;
  let minEnergy = Infinity;

  const sampleGroundTruthPressure = (axes: {
    hp: number;
    playerSupply: number;
    predictedPlayerRoom: number;
    runwayRemaining: number;
    energy: number;
  }): void => {
    if (axes.hp < minHp) minHp = axes.hp;
    if (axes.playerSupply < minPlayerSupply) minPlayerSupply = axes.playerSupply;
    if (axes.predictedPlayerRoom < minPredictedPlayerRoom) {
      minPredictedPlayerRoom = axes.predictedPlayerRoom;
    }
    if (axes.runwayRemaining < minRunwayRemaining) minRunwayRemaining = axes.runwayRemaining;
    if (axes.energy < minEnergy) minEnergy = axes.energy;
  };

  while (state.status === "playing" && actions < opts.maxActions) {
    checkIdAccounting(state);

    // Posthoc ground-truth pressure sample: read from the REAL committed
    // `state`, before the agent ever sees a (determinized) view of it. This is
    // an outcome diagnostic only — it never feeds back into `view` or `policy`
    // below, and must never be read as what the honest agent perceived.
    const groundTruthAxes = measureEvalAxes(state, weights);
    sampleGroundTruthPressure(groundTruthAxes);

    // Decide on a determinized, player-honest snapshot; apply to the REAL
    // state. determinize advances the threaded agent rng (its reshuffles), and
    // we carry the returned state forward so no two decisions repeat.
    const [view, rngAfterDet] = determinize(state, rng);

    // Bridge the pure RngState the runner threads to the `() => number` closure
    // the policy wants: pull one value, expand it into a stateful sfc32 closure,
    // and thread the post-pull rng state forward. The closure's own advances
    // during a single decision stay local; only the threaded rng persists.
    const [seedValue, rngAfterPolicy] = nextFloat(rngAfterDet);
    const policyRng = rngFromSeed(Math.floor(seedValue * 0x100000000));
    rng = rngAfterPolicy;

    const action = policy(view, policyRng);

    if (action.type === "EndTurn") {
      // Unused energy: `state.energy` is the committed, pre-`reduce` energy
      // for the turn the agent is about to end, so it is exactly what went
      // unspent this turn.
      if (state.energy > 0) positiveUnusedEndTurns++;
      totalUnusedEnergy += state.energy;

      // No progress: the world-cards-remaining count (reusing `measureEvalAxes`
      // rather than recounting) did not shrink since the previous EndTurn. An
      // increase (e.g. recurrence) counts as no progress too; only a strict
      // decrease counts as progress. The first EndTurn only sets the baseline.
      if (
        worldCardsAtPreviousEndTurn !== undefined &&
        groundTruthAxes.worldCardsRemaining >= worldCardsAtPreviousEndTurn
      ) {
        noProgressEndTurns++;
      }
      worldCardsAtPreviousEndTurn = groundTruthAxes.worldCardsRemaining;
    }

    actionCounts[action.type]++;

    const result = reduce(catalog, state, action);
    state = result.state;

    // Capture the loss cause and the act it happened in from the events. Each
    // reduce yields at most one WorldLost, so this assigns exactly once per loss.
    for (const event of result.events) {
      if (event.type === "WorldLost") {
        lossCause = event.cause;
        actAtLoss = state.actIndex;
      }
    }

    if (state.actIndex > actReached) actReached = state.actIndex;
    if (action.type === "EndTurn") turns++;
    actions++;
  }

  checkIdAccounting(state);

  // Final posthoc ground-truth pressure sample, taken once more after the
  // loop terminates (win, loss, or cap) — same reasoning as the in-loop
  // sample above: real committed state, never the agent's view.
  sampleGroundTruthPressure(measureEvalAxes(state, weights));

  // A still-"playing" status at loop exit means the action cap was hit; "won"
  // and "lost" carry through unchanged. (state.status is "playing" | "won" | "lost".)
  const capped = state.status === "playing";
  const status: PlayOutStatus = state.status === "playing" ? "capped" : state.status;

  // Build optional fields conditionally: exactOptionalPropertyTypes forbids
  // assigning an explicit `undefined` to an optional property.
  return {
    status,
    turns,
    actReached,
    capped,
    finalAgentRng: rng,
    totalActions: actions,
    actionCounts,
    positiveUnusedEndTurns,
    totalUnusedEnergy,
    noProgressEndTurns,
    posthocPressure: {
      minHp,
      minPlayerSupply,
      minPredictedPlayerRoom,
      minRunwayRemaining,
      minEnergy,
    },
    ...(lossCause !== undefined ? { lossCause } : {}),
    ...(actAtLoss !== undefined ? { actAtLoss } : {}),
  };
}
