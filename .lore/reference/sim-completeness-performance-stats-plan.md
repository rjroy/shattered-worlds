---
title: Sim Completeness Performance Stats Plan
date: 2026-07-02
status: current
tags: [sim, completeness-checker, telemetry, statistics, agent-diagnostics, plan]
fg-type: decision
fg-sources: [.lore/work/plans/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/completeness.ts
    - src/sim/eval.ts
    - src/sim/playOut.ts
---

# Sim Completeness Performance Stats Plan

A planned (not yet implemented as of 2026-07-02) extension to the sim completeness checker, aimed at explaining *how* the honest eval agent performed on a world, not only whether it won. The base completeness checker's honesty, determinism, sample-not-proof framing, loss attribution, and report-only behavior are preserved; this plan adds statistical shape and diagnostic depth on top.

## Key scope decisions

- **Fixed paired cohorts, not an adaptive trigger.** Baseline (no recovery unlocks) and recovery are run as two fixed cohorts per world seed, not with recovery conditionally activated after a cumulative-failure threshold. The adaptive version confounds configuration with earlier failures and cannot measure recovery uplift; a fixed pairing can. Cohorts share one continuous `agentRng` stream threaded baseline → recovery → next seed, but the recovery-minus-baseline win-rate delta is reported as a **descriptive paired-seed comparison only**, never framed as causal.
- **Baseline remains the sole flag source.** Recovery is diagnostic; it cannot rescue or mask a baseline `[FLAGGED]` result. The existing point-estimate flag threshold is unchanged — a 95% Wilson interval is displayed alongside each win rate but does not itself gate the flag.
- **Posthoc telemetry reads committed state, not the agent's view.** Pressure measurements (HP, player supply, refill room, runway, energy and their margins) are sampled from ground-truth `state` immediately before every decision and once at the terminal/capped end of the loop. These are outcome diagnostics about what actually happened, explicitly labeled `posthoc`/`groundTruth` so they can't be mistaken for what the agent perceived — the agent's only decision input remains the determinized `view`.
- **No-progress turn definition.** An `EndTurn` is no-progress when the count of world cards remaining across hand, `worldDraw`, and future acts did not decrease since the previous `EndTurn` (the first `EndTurn` is excluded as the baseline). An increase from recurrence also counts as no progress.
- **Sim-only scope.** No changes to core types or reducer behavior; all new measurement lives in `src/sim`. Decision-confidence diagnostics (best-vs-runner-up score gaps) are explicitly deferred — `Policy` currently returns only an `Action`, and instrumenting it correctly needs a non-interfering diagnostic seam that doesn't yet exist.

## Report shape (per world, per cohort)

Disposition counts with a 95% Wilson interval on win rate; a progress funnel (games and win-conditional-conversion reaching each act); efficiency (median actions, actions per completed turn, no-progress rate, positive-unused-energy rate, action-kind counts); pressure (median per-run minimum HP/supply/refill-room/runway/energy); and the existing loss-by-cause/loss-by-act attribution, restricted to the baseline cohort for flagging purposes.

## Risks named in the plan

Runtime roughly doubles (two cohorts instead of one) against the existing ~60-second local-iteration target — the plan treats exceeding that target as a review blocker rather than something to quietly accept. Report volume grows across all registered worlds, mitigated with compact single-line funnels/summaries. Telemetry must be pure reads of committed state — it must never re-enumerate actions or re-invoke policy/eval sampling, which would perturb agent RNG consumption and change behavior being measured.
