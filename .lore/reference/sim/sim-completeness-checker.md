---
title: Sim Per-World Completeness Checker
date: 2026-07-02
status: current
tags: [sim, completeness, agent, evaluation-function, determinize, survival-horror, balance, architecture]
fg-type: architecture
fg-sources: [.lore/work/specs/sim-completeness-checker.md, .lore/work/brainstorm/sim-completeness-checker.md, .lore/work/plans/sim-completeness-checker.md, .lore/work/notes/sim-completeness-checker.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/completeness.ts
    - src/sim/eval.ts
    - src/sim/evalPolicy.ts
    - src/sim/playOut.ts
  tests:
    - src/sim/tests/completeness.test.ts
    - src/sim/tests/brokenWorld.test.ts
  symbols:
    - Policy
    - determinize
    - evaluate
    - WorldLostCause
---

# Sim Per-World Completeness Checker

This is the foundational document for the sim's per-world solvability instrument. It turns the headless sim (`src/sim/`, `bun run sim`) from a fast-loop smoke check into a report generator: a stronger-than-random, survival-oriented **honest agent** plays every registered world across many seeds, and the resulting report says which worlds the agent could not survive, and *why*. [Sim Completeness Performance Stats Plan](sim-completeness-performance-stats-plan.md), [Shared EvalAxes Measurement](sim-eval-axes-shared-measurement.md), [Sim playOut Per-Run Agent Performance Telemetry](sim-agent-performance-telemetry.md), [Sim Statistics Helpers](sim-statistics-helpers.md), and [Aggregating Per-Run Ratios](sim-report-ratio-aggregation-lesson.md) are all later extensions layered on top of the system this page describes.

This checker builds on the **observability-boundary** seam (`determinize(state, agentRng)` producing a player-honest snapshot, and the `Policy` type used by `run.ts`) — see [Observability Boundary Shared Model](../engine/randomness-and-hidden-state/observability-boundary-shared-model.md). Before this work, the only policy was `randomPolicy` (random play plus a few hard-coded objective grabs by card name), too weak to serve as solvability signal.

## Where win/loss actually happen

Grounded against the reducer, not an idealized model:

- **Win** — a `SurviveWorld` effect flips `status → "won"`, emitting `WorldWon`. The Door has to be earned in-run (progress / `Summon Door`); the agent cannot simply "play the Door" turn one.
- **Loss** (`status → "lost"`, `WorldLost`) fires at four distinct reducer sites: HP ≤ 0; zero player cards drawn at turn start (covers both a hand flooded with world cards and an exhausted player deck — the same guard, reported as one cause); no future cards anywhere and no structural play possible; and a degenerate no-world-cards-anywhere livelock guard.
- **Frozen cards are not their own loss trigger.** A fully-frozen hand only kills by funneling into the zero-player-cards-drawn guard on a later turn. The four-reservoir mental model (HP / card-supply / hand-flood / frozen) from the original brainstorm is a design lens for building the eval, not a literal list of engine trigger sites.
- `WorldLostCause` (`"hp" | "noPlayerCards" | "exhausted" | "worldLivelock"`) is the instrumented attribution added to `WorldLost` so the report can name a cause without inferring it from terminal state.

## The honest agent

The agent is a `Policy` (`(view: GameState, rng) => Action`) added beside `randomPolicy`, which remains available and unmodified (including its card-name shortcuts — those are grandfathered into `randomPolicy` specifically, not extended to the new agent). The honest agent:

- **Reads only the determinized view.** It never reaches for `state.playerDraw`/`state.worldDraw`/future `acts` on the real committed state — only the `view` the runner hands it plus its own `rng`. The runner enforces this structurally.
- **Scores states by distance from death, not distance to a win.** The evaluation (`src/sim/eval.ts`) is a **min-of-margins** shape: each survival axis (HP margin, player-card availability vs. hand-flood pressure, deck/world-exhaustion proximity, and the escape/`SurviveWorld` signal) is normalized to `[0, 1]`, and the score is dominated by the *worst* axis rather than an average — so the agent triages the nearest way to die instead of optimizing one axis off a cliff. Energy modulates how many plays a turn affords but never itself kills, so it lives only in a small weighted tie-break spread, never in the death-floor `min`.
- **Never steers by card-name literals.** All objective/threat reading derives from structured state and effect kinds (`SurviveWorld` availability, progress, world-card load), so the agent generalizes across every registered world without per-world special-casing.
- **Respects the real per-turn play budget** (energy cost, hand contents) exactly as `availableActions` would.
- **Samples over K determinizations** per decision (`K` configurable, `K = 1` degenerates to single-sample greedy) because survival failures are delayed and stochastic; a play that looks safe on one determinized sample can be a trap on the actual future draw.
- **Handles escape as a bonus, not a death floor.** Taking the Door when favorable, and treating `ChooseBoon`/reward choices as capacity investment, are both additive terms on top of the survival score, not folded into the min.
- **Is tunable** — eval weights and search parameters (K, lookahead depth, axis weights, risk posture) are named, documented parameters, not hardcoded constants, so a future difficulty ladder can vary them without a rewrite.

**Calibration bar, not a first-cut bar:** the honest agent only needs to be *strictly* above `randomPolicy`'s win-rate to ship; "comfortably dominant across all worlds" is an eval-tuning target reached afterward, not a blocking requirement of the initial implementation.

## The per-world report

The checker iterates every bundle in `worldDataRegistry` (12 worlds as of the 2026-07-02 amendment below), builds each with `buildWorld(worldId)` using the **default starter and no unlocks** (the base-difficulty floor — starter-deck sweeps and Destiny-unlock sweeps are explicitly out of scope for this spec), and runs N seeds per world. Output is plain stdout text, mirroring the existing `bun run sim` format — no JSON, no dashboard.

Per world, the report emits: games played, wins, losses, win-rate, average turns survived, and loss attribution by both **cause** (the four `WorldLostCause` values, summing to total losses) and **act** (so death clustering in escalating late acts reads as expected, while early clustering reads as a tuning problem). Worlds whose win-rate falls at or below a configurable low threshold (default near 0%) are visibly **flagged**, with the dominant cause/act named so the flag points at a specific knob.

**Epistemic framing is a hard requirement, not decoration.** The report states plainly that a win-rate is a sample under one agent at one skill level, not a proof of (un)solvability — a near-0% flag means "this agent could not survive it," to be confirmed later by a planned but not-yet-built clairvoyant (full-information) existence check. This matters in practice, not just in theory: a completeness audit has already produced at least one flagged world later confirmed as a false positive (a puzzle world a human designer wins by hand), which is exactly the failure mode this framing exists to guard against — a flag is a lead to hand-verify, not a verdict.

## Non-functional guarantees

- **Fully reproducible.** Same (agent seed, world seed range, parameters) produces a byte-identical report — no timestamps or other system-derived values in the output. The agent's RNG stream is entirely separate from `state.rng`.
- **No gratuitous core changes.** Core stays pure and engine-independent; the only core change this spec licenses is the optional `WorldLostCause` instrumentation. Attribution logic beyond that lives in `src/sim`.
- **Fast enough for local iteration.** Originally targeted ~60s for N=100, K=5 across the registered worlds. This target has since been revised upward (see the paired-cohort amendment below) as scope grew.

## Implementation amendment: fixed paired recovery cohort

Added 2026-07-02, tracking the [Sim Completeness Performance Stats Plan](sim-completeness-performance-stats-plan.md). The checker runs every seed as a **fixed pair**: a baseline play-out (default starter, no unlocks) followed by a recovery play-out (the same seed, with a permanent, named recovery-unlock configuration applied), always in that order regardless of outcome. Both play-outs of a pair thread one continuous `agentRng` stream, which continues across seeds and worlds exactly as before.

This replaced an earlier **adaptive** trigger (`useRecoveryUnlocks = losses + capped >= N / 2`, evaluated per-seed against accumulating run history) that confounded *which configuration was active* with *whether earlier seeds in the same run had already gone badly* — a confound a fixed pairing removes, since every seed now gets both configurations in the same order.

Baseline remains the sole source of the completeness result and the `[FLAGGED]` determination; recovery is a diagnostic-only comparison that can never rescue or mask a baseline flag, and it introduces no second flagging path. This is explicitly a **bounded exception** to the "no unlock sweeps" scope rule, not a reopening of it: recovery is one fixed, named configuration, not a sweep, and a future proposal to add more configurations would need to re-justify itself independently.

With fixed pairing every world now runs `2 × N` play-outs instead of `N`. Measured directly (not extrapolated) at N=100, K=5, 12 worlds: **67.7s** real wall-clock, revising the runtime target to ~70s (up from the prior ~60s figure, attributed to two real scope changes: 9→12 registered worlds, and 1×N→2×N play-outs — not an unexplained regression).

## Known accepted gap: agent stalling

An additive forward-progress eval term (meant to keep a comfortable, non-progressing board from becoming a local optimum the agent never leaves) was tried and found **counterproductive** during tuning: every positive weight raised the stall (`capped`) rate and hurt survival dominance, catastrophically on recurrence-heavy worlds. `capped == 0` for a default run is therefore not reachable by weight-tuning alone and needs an anti-stall *redesign* out of this spec's scope. The accepted interim position: `capped` count is reported per world as honest signal ("the agent neither won nor lost within the action budget"), not treated as a hard gate. On a default run this affects a minority of games (roughly 32/900), concentrated in `highway-volcano` / `the-ember-orchard` / `overgrown-mall`.

## Explicitly out of scope

The **clairvoyant** (full-information, cheating) agent and the `clairvoyant − honest` surprise-dependence metric; a multi-tier **difficulty ladder** (risk-posture/lookahead dials); a **CI gate** (this checker is report-only; a pass/fail gate may layer on top later); sweeps across starter decks or Destiny unlocks beyond the single fixed recovery cohort; and **full-run reachability** (chaining worlds) — the unit of analysis is one world.
