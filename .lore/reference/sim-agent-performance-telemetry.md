---
title: Sim playOut Per-Run Agent Performance Telemetry
date: 2026-07-02
status: current
tags: [sim, playout, telemetry, agent-diagnostics, architecture]
fg-type: architecture
fg-sources: [.lore/work/plans/completeness-agent-performance-stats.md, .lore/work/notes/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/playOut.ts
  tests:
    - src/sim/tests/playOut.test.ts
  symbols:
    - Outcome
    - posthocPressure
    - GroundTruthPressure
    - noProgressEndTurns
---

# Sim playOut Per-Run Agent Performance Telemetry

`src/sim/playOut.ts`'s `Outcome` carries per-run diagnostic telemetry alongside the existing win/loss/cap result, so the completeness report can explain *how* the agent played, not only what happened. Fields: `totalActions`, `actionCounts` (a `Record<Action["type"], number>` tally, structurally tied to the action union), `positiveUnusedEndTurns`, `totalUnusedEnergy`, `noProgressEndTurns`, and `posthocPressure` (a `GroundTruthPressure` struct of running minima: `minHp`, `minPlayerSupply`, `minPredictedPlayerRoom`, `minRunwayRemaining`, `minEnergy`).

`Outcome` stores raw counts and minima only — no ratios. Rates like actions-per-turn are computed later during report aggregation, where a zero denominator can render `(none)` instead of dividing by zero.

## Posthoc naming convention

Pressure is sampled via `measureEvalAxes(state, weights)` (see [Shared EvalAxes Measurement](sim-eval-axes-shared-measurement.md)) against the real committed `state`, never the agent's determinized `view` — before every decision and once after the loop ends. Fields and report labels are deliberately named `posthoc`/`groundTruth` so they can't be mistaken for what the agent perceived when it acted. Running minima use strict `<` comparison so a later higher sample never overwrites a genuine minimum.

Unused energy is read as `state.energy` before `EndTurn`'s reduce call — the pre-reduce, committed value.

## No-progress turn definition

An `EndTurn` counts as no-progress when the number of world cards remaining across hand, `worldDraw`, and future `acts` did not decrease since the previous `EndTurn`. The very first `EndTurn` is excluded, since it establishes the baseline for later comparisons rather than measuring change. An increase in world-card count (e.g. from a recurrence mechanic re-adding cards) also counts as no-progress — the definition tracks forward consumption, not just direction of change. This follows the existing `forwardProgress` semantics already used elsewhere in the sim.
