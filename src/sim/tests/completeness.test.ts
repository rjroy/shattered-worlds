import { afterEach, describe, expect, test } from "bun:test";
import { createRng } from "../../core/engine/rng";
import type { RngState, WorldLostCause } from "../../core/model/types";
import { buildWorld } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { DEFAULT_EVAL_WEIGHTS } from "../eval";
import { evalPolicyFactory } from "../evalPolicy";
import { randomPolicy } from "../policy";
import { playOut } from "../playOut";
import {
  buildAllWorlds,
  formatHumanReport,
  formatReport,
  parseParams,
  runCompleteness,
  selectWorlds,
  type BuiltWorld,
  type CohortAggregate,
  type CompletenessParams,
  type PerRunObservation,
  type WorldAggregate,
} from "../completeness";

// ---------------------------------------------------------------------------
// Completeness attribution integrity (validation 2 / REQ-SCC).
//
// These tests drive the REAL aggregator (`runCompleteness` from completeness.ts)
// with small N/K, not a replica. `completeness.ts` guards its CLI entry behind
// `import.meta.main`, so importing it here neither runs the full audit nor writes
// to stdout. We exercise the exact aggregation the `bun run sim:complete` audit
// uses and assert the attribution invariants on its output.
// ---------------------------------------------------------------------------

const MAX_ACTIONS = 500;

/**
 * Build one world via the real `buildAllWorlds` smoke-check path and run the
 * real `runCompleteness` aggregator over it with the given small N/K, returning
 * that world's aggregate. Worlds beyond `worldId` are skipped so the suite stays
 * fast while still exercising the shared aggregation code.
 */
function aggregateWorld(worldId: string, N: number, K: number, agentSeed: number): WorldAggregate {
  const world = buildAllWorlds().find((w): w is BuiltWorld => w.id === worldId);
  if (world === undefined) throw new Error(`unknown world for test: ${worldId}`);

  const params: CompletenessParams = {
    N,
    K,
    agentSeed,
    threshold: 0.02,
    weights: DEFAULT_EVAL_WEIGHTS,
    weightsOverridden: false,
    maxRecovery: 1,
  };
  const [agg] = runCompleteness(params, [world]);
  if (agg === undefined) throw new Error("runCompleteness returned no aggregate");
  return agg;
}

function sumValues<K>(map: Map<K, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

/**
 * Disposition/loss-bucket invariants that must hold for ANY cohort, baseline
 * or recovery: every game lands in exactly one disposition bucket, every loss
 * carries exactly one cause and exactly one act, and no bucket is negative or
 * fractional. Factored out so both cohorts run the identical check (step 6 of
 * the completeness-agent-performance-stats plan: reconcile both cohorts, not
 * just baseline).
 */
function checkDispositionInvariants(cohort: CohortAggregate, games: number): void {
  expect(cohort.wins + cohort.losses + cohort.capped).toBe(games);
  expect(cohort.games).toBe(games);

  expect(sumValues(cohort.lossByCause)).toBe(cohort.losses);
  expect(sumValues(cohort.lossByAct)).toBe(cohort.losses);

  for (const v of cohort.lossByCause.values()) {
    expect(Number.isInteger(v) && v > 0).toBe(true);
  }
  for (const v of cohort.lossByAct.values()) {
    expect(Number.isInteger(v) && v > 0).toBe(true);
  }
}

/**
 * All-new-counter invariants (step 6): `runs` is exhaustive over `games`,
 * action-kind counts reconcile with `totalActions` across the whole cohort,
 * the per-act reach/reach-win funnels are exhaustive over `games`/`wins`, and
 * every individual run's energy bookkeeping is internally consistent (mirrors
 * the invariant already proven at the `playOut` call site in
 * playOut.test.ts — this re-confirms it survives the aggregation layer).
 */
function checkCounterInvariants(cohort: CohortAggregate): void {
  expect(cohort.runs.length).toBe(cohort.games);

  let actionKindTotal = 0;
  let totalActionsSum = 0;
  for (const run of cohort.runs) {
    const runActionKindTotal = Object.values(run.actionCounts).reduce((a, b) => a + b, 0);
    // Per-run check: this run's OWN action-kind counts must sum to its OWN
    // totalActions. Checking only the cohort-wide grand total (below) would
    // let two runs' opposite-sign mismatches cancel out and hide a real bug;
    // this catches a single run's internal miscount even when the grand
    // total happens to still reconcile.
    expect(runActionKindTotal).toBe(run.totalActions);

    actionKindTotal += runActionKindTotal;
    totalActionsSum += run.totalActions;

    expect(run.positiveUnusedEndTurns).toBeLessThanOrEqual(run.actionCounts.EndTurn);
    expect(run.totalUnusedEnergy).toBeGreaterThanOrEqual(run.positiveUnusedEndTurns);
  }
  expect(actionKindTotal).toBe(totalActionsSum);

  // Every game bumps reachedActCounts exactly once, and every win bumps
  // reachedActWinCounts exactly once (see recordOutcome in completeness.ts),
  // so summing either map's values over all its keys must recover games/wins.
  expect(sumValues(cohort.reachedActCounts)).toBe(cohort.games);
  expect(sumValues(cohort.reachedActWinCounts)).toBe(cohort.wins);
}

describe("completeness attribution integrity", () => {
  // A small N keeps the suite fast while still exercising real wins/losses/caps.
  const N = 8;
  const K = 2;
  const AGENT_SEED = 4242;

  // Two worlds with very different survivability profiles, so the invariants are
  // checked against both a high-win and a near-0 (flagged) world.
  for (const worldId of ["zombie-big-box", "the-ember-orchard"]) {
    test(`${worldId}: dispositions and loss buckets reconcile for both cohorts`, () => {
      const agg = aggregateWorld(worldId, N, K, AGENT_SEED);

      // REQ-SCC-14's flag detection and REQ-SCC-16's reproducibility are both
      // defined in terms of baseline (see the spec amendment), but the SAME
      // bookkeeping invariants must hold for recovery too: it is a diagnostic
      // cohort, not an exempt one.
      checkDispositionInvariants(agg.baseline, N);
      agg.recoveries.forEach((recovery) => checkDispositionInvariants(recovery, N));
    });

    test(`${worldId}: action counts, funnel counts, and per-run energy invariants reconcile for both cohorts`, () => {
      const agg = aggregateWorld(worldId, N, K, AGENT_SEED);
      checkCounterInvariants(agg.baseline);
      agg.recoveries.forEach(checkCounterInvariants);
    });
  }

  test("aggregation is reproducible for a fixed agent seed and varies by seed", () => {
    // REQ-SCC-16: the agent rng is the only randomness, so identical params must
    // yield identical aggregates, and a different agent seed must change the
    // agent's decision trace.
    const a = aggregateWorld("bird-building", N, K, AGENT_SEED);
    const b = aggregateWorld("bird-building", N, K, AGENT_SEED);
    expect(b.baseline.wins).toBe(a.baseline.wins);
    expect(b.baseline.losses).toBe(a.baseline.losses);
    expect(b.baseline.capped).toBe(a.baseline.capped);
    expect([...b.baseline.lossByCause.entries()].sort()).toEqual(
      [...a.baseline.lossByCause.entries()].sort(),
    );
    expect([...b.baseline.lossByAct.entries()].sort()).toEqual(
      [...a.baseline.lossByAct.entries()].sort(),
    );

    const c = aggregateWorld("bird-building", N, K, AGENT_SEED + 1);

    // A different agent seed must produce a different decision trace. Comparing
    // only the three cohort-level tallies (wins/losses/capped) at N=8 would be
    // a CHANCE-dependent assertion: two different agent rng streams could land
    // on the same 3-way tally split by coincidence even though every
    // individual game's trace differed (the plan's step 6 explicitly warns
    // against requiring small aggregate summaries to differ "by chance").
    // Comparing the full per-run signature sequence instead requires every one
    // of the N games' (disposition, turns, actReached, totalActions) tuples to
    // coincide for the two runs to tie — a far higher bar than 3 tallies
    // matching, and the one the plan asks for ("compare the exact sequence of
    // PerRunObservations ... between two agent seeds on the SAME world/N/K").
    const runSignature = (agg: WorldAggregate) =>
      agg.baseline.runs.map((r) => [r.disposition, r.turns, r.actReached, r.totalActions]);
    expect(runSignature(c)).not.toEqual(runSignature(a));

    // Step 5: the same invariant must hold for the FULL formatted report text,
    // not just the tallies checked above — every new section (funnel,
    // efficiency, pressure, Wilson interval) must format deterministically
    // from the same aggregate, with no reliance on Map insertion order or
    // any other non-deterministic source.
    const reportParams: CompletenessParams = {
      N,
      K,
      agentSeed: AGENT_SEED,
      threshold: 0.02,
      weights: DEFAULT_EVAL_WEIGHTS,
      weightsOverridden: false,
    };
    expect(formatReport(reportParams, [b])).toBe(formatReport(reportParams, [a]));
  });

  test(
    "all registered worlds build and run without throwing",
    () => {
      // Mirrors completeness.ts's buildAllWorlds smoke check: every registered
      // world must build with the default starter and produce a terminal-or-capped
      // outcome under the eval policy.
      expect(worldDataRegistry.length).toBe(15);
      for (const bundle of worldDataRegistry) {
        const agg = aggregateWorld(bundle.id, 2, 1, 999);
        expect(agg.baseline.games).toBe(2);
        expect(agg.baseline.wins + agg.baseline.losses + agg.baseline.capped).toBe(2);
        // runCompleteness always runs both cohorts per seed (see completeness.ts),
        // so this adds no extra play-outs beyond what the baseline check above
        // already exercised — it just asserts on data already computed.
        for (const recovery of agg.recoveries) {
          expect(recovery.games).toBe(2);
          expect(recovery.wins + recovery.losses + recovery.capped).toBe(2);
        }
      }
    },
    { timeout: 3000 },
  );
});

// ---------------------------------------------------------------------------
// World filtering for `bun run sim:complete <worldId>` (CLI single-world runs).
// `selectWorlds` is the pure filter; `parseParams` additionally has to pull a
// world id out of `process.argv` without disturbing N/K/agentSeed/threshold's
// positions, so its argv-parsing behavior is exercised directly.
// ---------------------------------------------------------------------------

describe("world filtering (selectWorlds / parseParams worldId)", () => {
  test("selectWorlds passes every world through when no worldId is given", () => {
    const worlds = buildAllWorlds();
    expect(selectWorlds(worlds, undefined)).toBe(worlds);
  });

  test("selectWorlds narrows to the single matching world", () => {
    const worlds = buildAllWorlds();
    const selected = selectWorlds(worlds, "the-tidal-archive");
    expect(selected.map((w) => w.id)).toEqual(["the-tidal-archive"]);
  });

  test("selectWorlds throws on an unknown id, naming the known worlds", () => {
    const worlds = buildAllWorlds();
    expect(() => selectWorlds(worlds, "not-a-real-world")).toThrow(/Unknown world id/);
    expect(() => selectWorlds(worlds, "not-a-real-world")).toThrow(/the-tidal-archive/);
  });

  // `parseParams` reads `process.argv` directly, so these mutate and restore it.
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
  });

  test("parseParams picks up a world id positioned anywhere among the numeric args", () => {
    process.argv = ["bun", "completeness.ts", "the-tidal-archive", "5", "2"];
    let params = parseParams();
    expect(params.worldId).toBe("the-tidal-archive");
    expect(params.N).toBe(5);
    expect(params.K).toBe(2);

    process.argv = ["bun", "completeness.ts", "5", "2", "the-tidal-archive"];
    params = parseParams();
    expect(params.worldId).toBe("the-tidal-archive");
    expect(params.N).toBe(5);
    expect(params.K).toBe(2);
  });

  test("parseParams leaves worldId undefined and N/K at their defaults when no id is given", () => {
    process.argv = ["bun", "completeness.ts"];
    const params = parseParams();
    expect(params.worldId).toBeUndefined();
    expect(params.N).toBe(100);
    expect(params.K).toBe(5);
    expect(params.outputFormat).toBe("json");
  });

  test("parseParams accepts human and explicit JSON output flags without shifting positional args", () => {
    process.argv = ["bun", "completeness.ts", "5", "--human", "2", "the-tidal-archive"];
    let params = parseParams();
    expect(params.outputFormat).toBe("human");
    expect(params.N).toBe(5);
    expect(params.K).toBe(2);
    expect(params.worldId).toBe("the-tidal-archive");

    process.argv = ["bun", "completeness.ts", "--format=json", "5", "2"];
    params = parseParams();
    expect(params.outputFormat).toBe("json");
  });

  test("parseParams throws immediately on a typo'd world id instead of silently defaulting N", () => {
    process.argv = ["bun", "completeness.ts", "the-tidel-archive", "2", "1"];
    expect(() => parseParams()).toThrow(/Unknown world id "the-tidel-archive"/);
  });
});

// ---------------------------------------------------------------------------
// Formatted report shape (step 5 of the completeness-agent-performance-stats
// plan). These build synthetic `WorldAggregate`s directly rather than driving
// real play-outs, so the `(none)`/flag/caveat/diff-line edge cases are exact
// and don't depend on which seeds happen to produce a zero-loss or
// zero-reached-act cohort under a real agent run.
// ---------------------------------------------------------------------------

const NO_ACTIONS = { PlayCard: 0, DiscardHazard: 0, EndTurn: 0, ChooseBoon: 0 };

function reportParamsFor(threshold: number): CompletenessParams {
  return {
    N: 1,
    K: 1,
    agentSeed: 1,
    threshold,
    weights: DEFAULT_EVAL_WEIGHTS,
    weightsOverridden: false,
  };
}

describe("formatted report shape (step 5)", () => {
  test("zero losses and an unreached act both render '(none)'", () => {
    const wonRun: PerRunObservation = {
      disposition: "won",
      forfeited: false,
      turns: 12,
      actReached: 0, // never advances to act index 1 (act 2/2)
      totalActions: 24,
      actionCounts: { ...NO_ACTIONS, PlayCard: 12, EndTurn: 10 },
      positiveUnusedEndTurns: 3,
      totalUnusedEnergy: 9,
      noProgressEndTurns: 2,
      posthocPressure: {
        minHp: 4,
        minPlayerSupply: 2,
        minPredictedPlayerRoom: 1,
        minRunwayRemaining: 6,
        minEnergy: 1,
      },
    };
    const cohort: CohortAggregate = {
      games: 1,
      wins: 1,
      losses: 0,
      capped: 0,
      forfeits: 0,
      totalTurns: 12,
      runs: [wonRun],
      lossByCause: new Map(),
      lossByAct: new Map(),
      reachedActCounts: new Map([[0, 1]]),
      reachedActWinCounts: new Map([[0, 1]]),
    };
    const agg: WorldAggregate = {
      id: "synthetic-none-cases",
      totalActs: 2,
      baseline: cohort,
      recoveries: [cohort],
    };

    const report = formatHumanReport(reportParamsFor(0.02), [agg]);

    // Zero losses: the lost-turn median/p90 have nothing to summarize.
    expect(report).toContain("Turns survived (lost): median=(none) p90=(none)");
    // act 2/2 (index 1) is never reached, so its conditional win|reached
    // conversion has a zero denominator and must render (none), not 0% or NaN.
    expect(report).toContain("act 2/2: reached=0 (0.0%)  win|reached=(none)");
    expect(report).toContain("[FLAGGED] win-rate 100.0% (too easy)");
    expect(report).toContain("Flagged worlds: 1/1");
  });

  test("baseline-only [FLAGGED]/dominant-cause/caveat; recovery gets the descriptive win-rate-diff line instead", () => {
    const lostRun = (cause: WorldLostCause): PerRunObservation => ({
      disposition: "lost",
      forfeited: false,
      turns: 5,
      actReached: 0,
      totalActions: 10,
      actionCounts: { ...NO_ACTIONS, PlayCard: 5, EndTurn: 5 },
      positiveUnusedEndTurns: 0,
      totalUnusedEnergy: 0,
      noProgressEndTurns: 0,
      posthocPressure: {
        minHp: 0,
        minPlayerSupply: 5,
        minPredictedPlayerRoom: 1,
        minRunwayRemaining: 3,
        minEnergy: 0,
      },
      lossCause: cause,
      actAtLoss: 0,
    });
    const wonRun: PerRunObservation = {
      disposition: "won",
      forfeited: false,
      turns: 8,
      actReached: 0,
      totalActions: 16,
      actionCounts: { ...NO_ACTIONS, PlayCard: 8, EndTurn: 8 },
      positiveUnusedEndTurns: 1,
      totalUnusedEnergy: 2,
      noProgressEndTurns: 0,
      posthocPressure: {
        minHp: 6,
        minPlayerSupply: 5,
        minPredictedPlayerRoom: 1,
        minRunwayRemaining: 4,
        minEnergy: 1,
      },
    };

    // Baseline: 0/4 wins, all losses to "hp" in act 1 — well under threshold.
    const baseline: CohortAggregate = {
      games: 4,
      wins: 0,
      losses: 4,
      capped: 0,
      forfeits: 0,
      totalTurns: 20,
      runs: [lostRun("hp"), lostRun("hp"), lostRun("hp"), lostRun("hp")],
      lossByCause: new Map([["hp", 4]]),
      lossByAct: new Map([[0, 4]]),
      reachedActCounts: new Map([[0, 4]]),
      reachedActWinCounts: new Map(),
    };
    // Recovery: 2/4 wins — comfortably above threshold, must never flag itself.
    const recoveries: CohortAggregate[] = [
      {
        games: 4,
        wins: 2,
        losses: 2,
        capped: 0,
        forfeits: 0,
        totalTurns: 26,
        runs: [wonRun, wonRun, lostRun("hp"), lostRun("hp")],
        lossByCause: new Map([["hp", 2]]),
        lossByAct: new Map([[0, 2]]),
        reachedActCounts: new Map([[0, 4]]),
        reachedActWinCounts: new Map([[0, 2]]),
      },
    ];
    const agg: WorldAggregate = {
      id: "synthetic-flag-placement",
      totalActs: 1,
      baseline,
      recoveries,
    };

    const report = formatHumanReport(reportParamsFor(0.02), [agg]);

    // Baseline: flagged, with hp/act-1 dominant and the epistemic caveat —
    // and each of those markers appears EXACTLY once (baseline only).
    expect(report).toContain("Dominant cause: hp");
    expect((report.match(/\[FLAGGED\]/g) ?? []).length).toBe(1);
    expect((report.match(/Caveat: a win-rate is a SAMPLE/g) ?? []).length).toBe(1);

    // Recovery block: no flag/caveat of its own, but the descriptive,
    // non-causal win-rate-diff line versus baseline (0% -> 50%, +50.0 pp).
    const recoverySection = report.slice(report.indexOf("-- Recovery"));
    expect(recoverySection).not.toContain("[FLAGGED]");
    expect(recoverySection).not.toContain("Caveat:");
    expect(recoverySection).toContain(
      "Win-rate diff vs baseline (descriptive, not causal): +50.0 pp",
    );
  });
});

// ---------------------------------------------------------------------------
// Eval-dominates-random (REQ-SCC-9, validation 3).
//
// SKIPPED per the plan's calibration decision: an untuned eval that fails to
// dominate must read as "needs tuning", not as a code bug, so this gate is not
// allowed to fail the build yet. The empirical numbers are reported separately
// (see the diagnostic in the Step-4 test report). When the eval is confirmed to
// dominate at the chosen N/K, drop `.skip` to turn this into a live gate.
//
// Measured at authoring time (zombie-big-box, N=50 same seeds, agentSeed=777,
// K=5): random 0/50 (0.0%), eval 37/50 (74.0%). Eval dominates decisively.
// ---------------------------------------------------------------------------
describe("eval dominates random (REQ-SCC-9)", () => {
  test.skip(
    "eval win-rate > random win-rate on zombie-big-box (same seeds)",
    () => {
      const { catalog, worldData } = buildWorld("zombie-big-box");
      const N = 40;
      const K = 5;
      const AGENT_SEED = 777;

      const runWinRate = (policy: Parameters<typeof playOut>[3]): number => {
        let agentRng: RngState = createRng(AGENT_SEED);
        let wins = 0;
        for (let seed = 1; seed <= N; seed++) {
          const o = playOut(catalog, worldData, seed, policy, agentRng, {
            maxActions: MAX_ACTIONS,
          });
          agentRng = o.finalAgentRng;
          if (o.status === "won") wins++;
        }
        return wins / N;
      };

      const randomRate = runWinRate(randomPolicy);
      const evalRate = runWinRate(evalPolicyFactory(catalog, DEFAULT_EVAL_WEIGHTS, K));
      expect(evalRate).toBeGreaterThan(randomRate);
    },
    { timeout: 30000 },
  );
});
