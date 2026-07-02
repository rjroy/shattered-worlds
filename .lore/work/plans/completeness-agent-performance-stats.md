---
title: "Implementation plan: completeness agent performance stats"
date: 2026-07-01
status: draft
tags: [plan, sim, completeness, agent, telemetry, statistics]
modules: [sim]
related: [.lore/work/specs/sim-completeness-checker.md, .lore/work/brainstorm/sim-completeness-checker.md]
---

# Implementation plan: completeness agent performance stats

## Goal

Make the completeness report explain how the honest eval agent performed, not only whether it won. The report will separate the base configuration from recovery unlocks, show uncertainty and outcome distributions, identify where progression stops, and expose action/resource-pressure signals useful for diagnosing agent behavior.

This extends the implemented [sim completeness checker](../specs/sim-completeness-checker.md). It preserves its honesty, deterministic output, sample-not-proof framing, loss attribution, cap reporting, and report-only behavior.

## Scope decisions

- Run **baseline and recovery as fixed paired cohorts** for every world seed. Do not retain the outcome-dependent recovery trigger: it confounds configuration with earlier failures and cannot measure recovery uplift.
- Pair cohorts by world seed. For each seed, run baseline and then recovery while threading the existing single `agentRng` through both play-outs and onward across worlds. This preserves one deterministic agent RNG stream without claiming identical agent randomness between configurations.
- Report each cohort independently and report the recovery-minus-baseline win-rate difference as a descriptive paired-seed comparison. Do not describe it as a causal estimate.
- Keep `wins / games` as the win-rate denominator, so caps remain non-wins and cannot disappear from the result.
- Display a 95% Wilson interval beside each win rate, but preserve the existing point-estimate threshold for `[FLAGGED]`. Changing flag semantics is outside this plan.
- Use nearest-rank percentiles over integer turn/action observations. Report median and p90 separately for wins and losses; show `(none)` for an empty outcome bucket.
- Sample **posthoc ground-truth pressure from committed `state`**, immediately before every decision and once after the terminal/capped loop. These are outcome diagnostics, not claims about what the honest agent perceived; determinized `view` remains the agent's only decision input. Summaries use raw, interpretable values rather than weighted eval scores.
- Define a no-progress turn as an `EndTurn` where the count of world cards remaining across hand, `worldDraw`, and future `acts` did not decrease since the previous `EndTurn`. Exclude the first `EndTurn`, which establishes the comparison baseline. An increase from recurrence also counts as no progress. This follows the existing `forwardProgress` semantics.
- Include action/resource diagnostics in this tranche. Defer best-vs-runner-up score gaps and decision confidence: `Policy` currently returns only an `Action`, and instrumenting it correctly requires a non-interfering policy diagnostic seam.
- Keep all implementation in `src/sim`; do not change core types or reducer behavior.

## Report shape

Each world block will contain:

1. A baseline cohort: games, wins with 95% Wilson interval, losses, caps, average turns survived across all runs including capped games (retains REQ-SCC-11's existing metric), and median/p90 turns split by win/loss disposition.
2. A recovery cohort with the same fields, plus the descriptive win-rate difference.
3. A progress funnel per cohort: number and percentage of all games reaching each act, plus conditional conversion `wins that reached act / all games that reached act`. Wins, losses, and caps all participate in reach denominators; an unreached act renders `(none)` conversion.
4. Efficiency per cohort: median total actions, median actions per completed turn, no-progress rate per comparable `EndTurn`, positive-unused-energy `EndTurn` rate, median unused energy per `EndTurn`, and action-kind counts. Zero-opportunity rates render `(none)`.
5. Pressure per cohort: median per-run minimum HP, player supply, predicted refill room, runway, and energy.
6. Existing loss-by-cause and loss-by-act attribution per cohort, with the flagged baseline cohort retaining the dominant cause/act and epistemic caveat.

The baseline cohort is the completeness result used by `Flagged worlds`. Recovery is diagnostic and must not rescue or mask a baseline flag.

## Implementation steps

### 1. Amend the governing completeness spec for recovery diagnostics

**File:** `.lore/work/specs/sim-completeness-checker.md`

- Add an implementation amendment documenting the fixed paired recovery cohort, why it replaces the statistically confounded adaptive trigger, and that baseline/no-unlock remains the sole REQ-SCC-10 completeness result and flag source.
- Amend the spec's **Scope** section, which currently lists "sweeps across starter decks and Destiny unlocks/run modifiers" as out of scope for future specs. State explicitly that this plan's fixed recovery cohort is a bounded exception: one specific, named unlock configuration run as a permanent diagnostic comparison against the baseline, not the general unlock-sweep excluded by Scope. The base-difficulty-floor measurement (default starter, no unlocks) remains the sole completeness result; the exception does not reopen sweeps across starter decks or arbitrary unlock combinations.
- Document the `2 × N` default play-out contract and the runtime consequence under REQ-SCC-18. Recovery remains a diagnostic comparison, not an agent ladder, general unlock sweep, CI gate, or proof of causal uplift.
- Link this plan from the spec frontmatter.

**Validation gate:** the amended spec and plan use the same baseline/recovery, RNG-stream, flagging, and runtime semantics before production code changes begin, and the Scope section no longer contradicts the recovery cohort this plan adds.

### 2. Extract structured pressure measurements from the eval model

**Files:** `src/sim/eval.ts`, new or existing sim tests for eval metrics

- Introduce an exported `EvalAxes`/`measureEvalAxes(state, weights)` result containing the raw and normalized quantities needed by both evaluation and telemetry: HP, predicted player room, player supply, runway, energy, their margins, escape proximity, and world cards remaining. The pure helper accepts any `GameState`: `evaluate` calls it with the honest determinized view, while `playOut` calls it with committed state for explicitly labeled posthoc telemetry.
- Refactor `evaluate` to consume this structured measurement so telemetry cannot drift from the agent's definitions.
- Preserve all existing scores for identical states and weights. Do not expose card names or committed hidden state to the policy.
- Add table-driven edge tests for terminal states, zero/negative margins, empty world piles, frozen cards, and heat, plus representative player room/supply, runway, and world-card remaining cases. Capture pre-refactor score fixtures before changing the formulas and assert exact score equivalence afterward.

**Validation gate:** existing eval/policy tests remain unchanged in behavior; new tests demonstrate that structured measurements reproduce the values used by `evaluate`.

### 3. Capture deterministic per-run telemetry in `playOut`

**File:** `src/sim/playOut.ts`; focused sim test fixture

- Extend `Outcome` with total action count and counts by `Action["type"]`.
- Record unused energy immediately before each `EndTurn`, including the number of end-turns with positive unused energy and total unused energy.
- Track the per-run minimum raw pressure measurements from committed state at every decision boundary and after loop termination. Name types/report labels `posthoc` or `groundTruth` so they cannot be mistaken for perceived pressure.
- Track no-progress turns using the documented world-cards-remaining comparison between successive `EndTurn` decisions.
- Retain `actReached`, terminal attribution, caps, and `finalAgentRng` exactly as today.
- Define ratios only during report aggregation; keep raw integer counts in `Outcome`. For zero completed turns, actions-per-turn renders `(none)` rather than dividing by zero.

**Validation gate:** a small deterministic play-out fixture asserts action totals reconcile with action-kind counts, minima are sampled, `positiveUnusedEndTurns <= endTurnCount`, `totalUnusedEnergy >= positiveUnusedEndTurns`, and exact unused-energy/no-progress values. A one-`EndTurn` fixture confirms the first turn establishes a baseline and is not counted as no-progress. Existing accounting checks continue to run before every decision and at terminal state.

### 4. Replace the adaptive recovery mixture with paired cohort aggregation

**File:** `src/sim/completeness.ts`

- Add explicit `baseline` and `recovery` cohort types containing dispositions, per-run observations, loss maps, act-reach counts, and telemetry totals/samples.
- For each `(world, seed)`, execute baseline and recovery play-outs in fixed order, threading `Outcome.finalAgentRng` from baseline into recovery and recovery into the next seed/world.
- Aggregate `actReached` into a monotonic reach funnel over every disposition. For act `a`, conversion is `wins whose actReached >= a / games whose actReached >= a`; render `(none)` when the denominator is zero.
- Remove `recoveryRuns` and the cumulative-failure activation condition.
- Keep aggregate helpers deterministic and make empty input/cohort handling explicit.
- Update comments to describe two configurations and the doubled play-out count.

**Validation gate:** for each cohort, `wins + losses + capped === games`; cause and loss-act maps each sum to losses; action-kind counts sum to actions; act reach is monotonic; every win is included in each reached-act conversion denominator; identical inputs produce deeply equal aggregates.

### 5. Add deterministic statistical helpers and format the expanded report

**File:** `src/sim/completeness.ts`; optionally split pure helpers into `src/sim/statistics.ts` if the report module becomes difficult to review

- Implement nearest-rank median/p90 helpers with documented empty and singleton behavior.
- Implement a pure 95% Wilson interval helper for `n > 0` and clamp endpoints to `[0, 1]`; `n === 0` renders `(none)` rather than a numeric interval.
- Compute average turns survived across all runs (wins, losses, and caps) per cohort, retaining REQ-SCC-11's existing metric alongside the new win/loss percentiles.
- Format cohort disposition/distribution, progress funnel, efficiency, pressure, and loss-attribution sections in stable cohort/action/act order.
- Compute the recovery-minus-baseline win-rate difference in percentage points and label it descriptive.
- Derive opportunity-normalized efficiency rates from raw counters: no-progress/comparable-end-turns, positive-unused/end-turns, and unused-energy/end-turn samples. Define zero-denominator output as `(none)`.
- Apply `[FLAGGED]`, dominant loss cause/act, and the sample-not-proof caveat to baseline only. Preserve the configured point-estimate threshold.
- Update the report header to state `2 × N` play-outs per world and identify the fixed recovery unlock configuration.

**Validation gate:** unit tests cover percentile and Wilson edge cases (`n=0`, all losses, all wins, singleton, even-sized samples); a formatted fixture verifies stable ordering, empty buckets, baseline-only flags, and the recovery comparison label.

### 6. Expand completeness integration and regression coverage

**Files:** `src/sim/tests/completeness.test.ts`, `src/sim/tests/brokenWorld.test.ts`

- Extend real-world aggregation tests to reconcile both cohorts and all new counters.
- Compare complete formatted reports from two identical runs to enforce byte-identical reproducibility, not only selected tallies.
- On a controlled seed-sensitive fixture, verify distinct agent seeds produce distinct outcome traces. Do not require small real-world aggregate summaries to differ by chance.
- Update the broken-world fixture expectations so baseline remains flagged with dominant HP/act attribution; recovery results are diagnostic and do not alter `Flagged worlds`.
- Keep the all-registered-world smoke test small (`N`/`K`) while exercising both cohorts.
- Leave the existing skipped eval-vs-random calibration test unchanged; an agent ladder and clairvoyant comparison remain out of scope.

**Validation gate:** focused sim tests pass with deterministic output and both synthetic and registered-world coverage.

### 7. Validate runtime, boundaries, and the full project

- Run the focused sim tests, then `bun run test`, `bun run typecheck`, `bun run lint`, and `bun run build`.
- Run `bun run sim:complete` with reduced parameters as a report-shape smoke test.
- Measure the default `N=100`, `K=5` run outside report output and compare it with REQ-SCC-18's approximate 60-second target. Timing is validation evidence only and must never enter the deterministic report.
- Treat exceeding the local-iteration target as a review blocker. A cohort selector may be planned separately, but this implementation must not invent an unreviewed CLI/env API or restore adaptive cohort selection.
- Review the diff for sim-only scope, no timestamps/system-derived report data, no card-name steering, no changes to agent RNG consumption within either play-out, and no accidental clairvoyant state access.

**Final validation gate:** baseline satisfies the amended source spec's REQ-SCC-10 through REQ-SCC-18 constraints. Recovery is a separately labeled diagnostic cohort governed by the amendment in step 1 and cannot alter the base completeness result.

## Risks and mitigations

- **Runtime roughly doubles.** Validate the default run explicitly; provide a fixed cohort selector if needed rather than statistically invalid adaptive sampling.
- **Report volume grows substantially across 11 worlds.** Use compact single-line funnels and summaries; keep raw per-run samples internal.
- **Telemetry changes agent behavior through RNG consumption.** Measurements must be pure reads of the committed state. Do not enumerate actions or call policy/eval sampling again for instrumentation.
- **Eval/telemetry formula drift.** Centralize structured axis measurement and have `evaluate` consume it.
- **Recovery comparison can be overinterpreted.** Label it descriptive and explain that only world seeds are paired; the continuous agent RNG samples differ.
- **No-progress semantics are imperfect on recurrence worlds.** The chosen definition deliberately treats recurrence/increased world-card count as lack of forward consumption and is diagnostic, not a loss condition.

## Deferred follow-ups

- A non-interfering observer from `evalPolicyFactory` for candidate count, best/runner-up score gap, and chosen-action score.
- One-turn-before-loss precursor snapshots grouped by cause; resource minima in this plan provide the lower-cost first signal.
- Repeated-state signatures or plateau detection and anti-stall policy changes.
- Confidence-bound-based flags, CI gating, clairvoyant comparison, and an agent difficulty ladder.
