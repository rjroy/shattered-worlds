import { createWorld } from "../core/engine/world";
import { reduce } from "../core/engine/reduce";
import { nextFloat, rngFromSeed } from "../core/engine/rng";
import type { CardCatalog, WorldData } from "../core/model/catalog";
import type { RngState, WorldLostCause } from "../core/model/types";
import type { RunModifiers } from "../data/unlocks/types";
import { checkIdAccounting } from "./accounting";
import { determinize } from "./determinize";
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

  while (state.status === "playing" && actions < opts.maxActions) {
    checkIdAccounting(state);

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

  const capped = state.status === "playing";
  const status: PlayOutStatus =
    state.status === "won" ? "won" : state.status === "lost" ? "lost" : "capped";

  // Build optional fields conditionally: exactOptionalPropertyTypes forbids
  // assigning an explicit `undefined` to an optional property.
  return {
    status,
    turns,
    actReached,
    capped,
    finalAgentRng: rng,
    ...(lossCause !== undefined ? { lossCause } : {}),
    ...(actAtLoss !== undefined ? { actAtLoss } : {}),
  };
}
