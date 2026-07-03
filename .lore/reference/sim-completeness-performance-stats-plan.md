---
title: Sim Completeness Performance Stats Plan
date: 2026-07-02
status: current
tags: [sim, completeness-checker, telemetry, statistics, agent-diagnostics, plan, implemented]
fg-type: decision
fg-sources: [.lore/work/plans/completeness-agent-performance-stats.md, .lore/work/notes/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/completeness.ts
    - src/sim/eval.ts
    - src/sim/playOut.ts
    - src/sim/statistics.ts
  tests:
    - src/sim/tests/completeness.test.ts
    - src/sim/tests/brokenWorld.test.ts
    - src/sim/tests/evalAxes.test.ts
    - src/sim/tests/playOut.test.ts
---

# Sim Completeness Performance Stats Plan

An implemented (as of 2026-07-02) extension to the sim completeness checker, aimed at explaining *how* the honest eval agent performed on a world, not only whether it won. The base completeness checker's honesty, determinism, sample-not-proof framing, loss attribution, and report-only behavior are preserved; this work adds statistical shape and diagnostic depth on top. See [Shared EvalAxes Measurement](sim-eval-axes-shared-measurement.md), [Sim playOut Per-Run Agent Performance Telemetry](sim-agent-performance-telemetry.md), and [Sim Statistics Helpers](sim-statistics-helpers.md) for the pieces this decision produced.

## Key scope decisions

- **Fixed paired cohorts, not an adaptive trigger.** Baseline (no recovery unlocks) and recovery are run as two fixed cohorts per world seed, not with recovery conditionally activated after a cumulative-failure threshold. The adaptive version confounded configuration with earlier failures and couldn't measure recovery uplift; a fixed pairing can. Cohorts share one continuous `agentRng` stream threaded baseline → recovery → next seed's baseline, but the recovery-minus-baseline win-rate delta is reported as a **descriptive paired-seed comparison only**, never framed as causal.
- **Baseline remains the sole flag source.** Recovery is diagnostic; it cannot rescue or mask a baseline `[FLAGGED]` result. The existing point-estimate flag threshold (`wins/games <= threshold`) is unchanged — a 95% Wilson interval is displayed alongside each win rate but is never substituted into the flag decision.
- **Posthoc telemetry reads committed state, not the agent's view.** Pressure measurements (HP, player supply, refill room, runway, energy and their margins) are sampled from ground-truth `state` immediately before every decision and once at the terminal/capped end of the loop. These are outcome diagnostics about what actually happened, explicitly labeled `posthoc`/`groundTruth` so they can't be mistaken for what the agent perceived — the agent's only decision input remains the determinized `view`.
- **No-progress turn definition.** An `EndTurn` is no-progress when the count of world cards remaining across hand, `worldDraw`, and future acts did not decrease since the previous `EndTurn` (the first `EndTurn` is excluded as the comparison baseline). An increase from recurrence also counts as no progress.
- **Sim-only scope.** No changes to core types or reducer behavior; all new measurement lives in `src/sim`. Decision-confidence diagnostics (best-vs-runner-up score gaps) were explicitly deferred — `Policy` returns only an `Action`, and instrumenting it correctly needs a non-interfering diagnostic seam that doesn't yet exist.
- **The recovery cohort is a bounded exception to the "no unlock sweeps" scope rule**, not a reopening of it. The governing spec (`sim-completeness-checker.md`) excludes general sweeps across starter decks or Destiny unlock combinations from future work. This plan's fixed recovery cohort is one specific, named unlock configuration run permanently as a diagnostic comparison against baseline — the base no-unlock measurement remains the sole completeness result. A future proposal to add more unlock configurations would need to re-justify itself against that exclusion, not point to this precedent as already having opened the door.

## Report shape (per world, per cohort)

Disposition counts with a 95% Wilson interval on win rate; a progress funnel (games and win-conditional-conversion reaching each act); efficiency (median actions, actions per completed turn, no-progress rate, positive-unused-energy rate, action-kind counts); pressure (median per-run minimum HP/supply/refill-room/runway/energy); and the existing loss-by-cause/loss-by-act attribution, restricted to the baseline cohort for flagging purposes.

## Runtime target revision

The plan treated exceeding the existing ~60-second local-iteration target (REQ-SCC-18) as a review blocker rather than something to quietly accept, since doubling the play-out count (baseline + recovery) was an expected but unverified cost. Measured directly (not extrapolated) at default parameters (N=100, K=5, 12 worlds, 2×N play-outs): **67.7s real wall-clock**, about 13% over the old ~60s target but well under the naive ~162s (2.7×) linear-scaling estimate — fixed per-process overhead is a larger share of the old baseline than a linear model assumes. User accepted 67.7s as the new baseline; REQ-SCC-18 was revised to a ~70s target, attributed to the two real scope changes that landed in the same window (9→12 registered worlds, 1×N→2×N play-outs), not treated as an unexplained regression.

## Risks named in the plan

Runtime roughly doubles (two cohorts instead of one) against the existing ~60-second local-iteration target. Report volume grows across all registered worlds, mitigated with compact single-line funnels/summaries. Telemetry must be pure reads of committed state — it must never re-enumerate actions or re-invoke policy/eval sampling, which would perturb agent RNG consumption and change the behavior being measured. A fresh-context boundary review at completion confirmed no RNG-consumption drift, no clairvoyant leakage of committed state into the agent's `view`, and baseline/recovery independence in the flag decision.
