---
title: Shared EvalAxes Measurement Between Agent Scoring and Telemetry
date: 2026-07-02
status: current
tags: [sim, eval, telemetry, agent-diagnostics, architecture]
fg-type: architecture
fg-sources: [.lore/work/plans/completeness-agent-performance-stats.md, .lore/work/notes/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/eval.ts
    - src/sim/playOut.ts
  tests:
    - src/sim/tests/evalAxes.test.ts
  symbols:
    - EvalAxes
    - measureEvalAxes
    - evaluate
---

# Shared EvalAxes Measurement Between Agent Scoring and Telemetry

`src/sim/eval.ts` exports a single pure function, `measureEvalAxes(state, weights)`, that both the agent's decision scoring and the completeness checker's posthoc telemetry read from. Before this existed, the honest sim agent's `evaluate()` computed HP margin, player-availability margin, runway margin, and energy margin through four separate private helper functions; telemetry work needed the same raw quantities and risked reimplementing them with subtly different formulas.

## Structure

`measureEvalAxes` takes any `GameState` and returns an `EvalAxes` struct: `hp`/`hpMargin`, `predictedPlayerRoom`/`playerRoomMargin`, `playerSupply`/`playerSupplyMargin`, a combined `playerAvailabilityMargin`, `runwayRemaining`/`runwayMargin`, `energy`/`energyMargin`, `escapeProximity`, and `worldCardsRemaining`. `evaluate()` now consumes this struct instead of calling four separate functions, so the score formula and any telemetry reading the same axes cannot drift apart.

The function itself is state-source-agnostic: `evaluate()` calls it with the agent's determinized `view` (the only state the agent is allowed to see), while `playOut()` calls it with the real committed `state` for posthoc telemetry (see [Sim playOut Per-Run Agent Performance Telemetry](sim-agent-performance-telemetry.md)). Nothing in `measureEvalAxes` itself distinguishes "honest" from "clairvoyant" reads — that distinction lives entirely in which state object the caller passes in.

## Deliberate omission

`measureEvalAxes` does not special-case terminal (won/lost) states. `evaluate()`'s won/lost short-circuit is scoring policy — a decision about how to rank actions — not a property of the raw measurement, so it stays in `evaluate()` rather than being pulled into the shared axis function.
