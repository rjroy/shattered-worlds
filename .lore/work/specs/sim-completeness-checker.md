---
title: Sim per-world completeness checker
date: 2026-06-27
status: implemented
tags: [sim, completeness, agent, evaluation-function, determinize, survival-horror, balance]
modules: [sim, core, data]
related: [.lore/work/brainstorm/sim-completeness-checker.md, .lore/work/plans/sim-completeness-checker.md, .lore/work/notes/sim-completeness-checker.md, .lore/work/plans/observability-boundary.md, .lore/work/design/observability-boundary.md, .lore/work/plans/completeness-agent-performance-stats.md]
req-prefix: SCC
---

# Sim per-world completeness checker

Turn the headless sim into a **per-world solvability instrument**: a
stronger-than-random *honest* agent driven by a survival-oriented evaluation
function, run over many seeds against every registered world, producing a report
of per-world win-rate plus **why** the agent died. A world that the strong honest
agent almost never survives is flagged as likely unwinnable or mistuned.

Follow-on to the **executed** observability-boundary plan, which landed the seam
this depends on: `determinize(state, agentRng)` (player-honest snapshot) and the
`Policy` type, with `run.ts` deciding on the determinized view and committing
against real state. Today the only policy is `randomPolicy` (random except a few
hard-coded objective grabs by card name), too weak to be solvability signal.

## Scope

**In scope (this spec):** the honest evaluation-driven agent and a per-world
completeness **report**, run against all registered worlds.

**Out of scope (named future specs):**
- The **clairvoyant** (cheating, full-information) agent and the
  `clairvoyant − honest` surprise-dependence metric.
- The multi-tier **difficulty ladder** (risk-posture / lookahead dials).
- A **CI gate** (threshold + non-zero exit). This spec is report-only; a gate may
  layer on later.
- Sweeps across **starter decks** and **Destiny unlocks/run modifiers**. This
  spec measures the base-difficulty floor: the default starter and no unlocks.
  **Bounded exception (implementation amendment below):** the
  `completeness-agent-performance-stats` plan adds one fixed, permanent
  **recovery cohort** — a single named unlock configuration run alongside
  baseline as a diagnostic comparison. This is not a reopening of the
  unlock-sweep exclusion: it is one specific configuration, not a sweep across
  starter decks or arbitrary unlock combinations, and it never produces a
  second completeness result (see amendment).
- **Full-run reachability** (chaining worlds). The unit here is one world.

## Background: how win/loss actually work in core

Grounded against the engine (not the idealized model) so requirements map to real
state:

- **Win** = a `SurviveWorld` effect flips `status → "won"` (`effects/worldCards.ts:249`),
  emitting `WorldWon`. Escaping = resolving the Door. Door availability is
  earned in-run (progress / `Summon Door`), so the agent cannot just "play the
  Door" on turn one.
- **Loss** (`status → "lost"`, emits `WorldLost`) happens at distinct sites:
  - **HP ≤ 0** — `effects/damage.ts:20`.
  - **Drew zero player cards at turn start** — `reduce.ts:254`. Covers both
    *hand flooded by world cards* (no room) and *player deck exhausted*.
  - **No future cards anywhere and no structural play possible** — `reduce.ts:260-277`.
  - **No world cards anywhere and no card can introduce one** — `reduce.ts:290-322`
    (degenerate-state livelock guard).
- **"All cards frozen" is NOT its own loss trigger.** Frozen cards remain in hand
  and thaw-tick at turn start; an all-frozen hand only kills by funneling into the
  "drew zero player cards" guard on a later turn. The four-reservoir model from
  the brainstorm (HP / card-supply / hand-flood / frozen) is a *design lens*, not
  a literal set of engine triggers.
- **`WorldLost` carries no cause today.** Failure attribution (below) requires
  either inspecting terminal state or instrumenting the loss. The agent's plays
  are gated by **energy** (refills each turn; `GainEnergy` effects can raise it
  above the per-turn baseline) — energy is the per-turn play budget the eval must
  respect by reading `state.energy`, not a constant.

## Requirements

### Honest evaluation-driven agent

#### REQ-SCC-1 — Implements the existing `Policy` seam
The agent is a `Policy` (`(view: GameState, rng) => Action`) added beside
`randomPolicy` in `src/sim`. `randomPolicy` remains as the baseline. The runner
selects which policy to use (e.g. argv/env); existing random behavior stays
available and behavior-preserving.

#### REQ-SCC-2 — Honest: reads only the determinized view
The agent decides solely from the `view` handed to it by the runner (the
`determinize` snapshot) and its own `rng`. It must never read real hidden state
(`playerDraw`/`worldDraw`/future `acts` of the committed `state`). The runner
already enforces this structurally; the agent must not be given, or reach for, a
back channel to ground truth.

#### REQ-SCC-3 — Survival-oriented evaluation function
A pure evaluation function scores a `GameState` by *distance from death*, not
distance to a win. It reads, at minimum, the survival-pressure signals
*contributing to* the engine loss sites:
- HP margin,
- player-card availability vs. hand-flood pressure (room for player cards next
  refill; world-cards-in-hand load),
- frozen-card pressure (fraction of hand frozen and thaw capacity) — note this
  is **not its own engine loss trigger**; it feeds the zero-player-cards-drawn
  guard (see Background), so it is an input to that axis, not a separate
  `min`-term,
- deck/world-exhaustion proximity,
- and the escape signal (progress toward / availability of `SurviveWorld`).

The score is dominated by the *worst* axis (a `min`-of-margins shape), so the
agent triages the nearest failure rather than optimizing one axis off a cliff.

#### REQ-SCC-4 — No hard-coded card-name heuristics
The agent generalizes across all registered worlds. It must not steer by literal
card names (`"Door"`, `"The Walker"`, `"Summon Door"`, etc.). Objective and
threat reading derive from structured state/effects (e.g. `SurviveWorld`
availability, `progress`, world-card load), not name string matches. The new agent must not
use card-name shortcuts to guide its decisions. `randomPolicy`/`pickAction`
retains its existing shortcuts and is **not** modified by this spec (preserving
REQ-SCC-1's behavior guarantee).

#### REQ-SCC-5 — Respects the per-turn play budget
Candidate actions are evaluated under the real action economy: energy cost and
hand contents constrain what is playable, consistent with `availableActions`. The
eval/agent does not assume more plays per turn than energy allows.

#### REQ-SCC-6 — Samples over determinizations
Because survival failures are delayed and stochastic, the agent evaluates
candidate actions by averaging the eval over **K** determinized samples
(K configurable, K ≥ 1; K = 1 degenerates to single-sample greedy). This is what
lets it avoid actions that look safe now but die on a likely future draw. A
*sample* here is one determinized snapshot at the current decision point with the
eval applied (1-ply) — the base requirement. Deeper multi-ply lookahead (step N
turns before evaluating) is a tuning extension via REQ-SCC-8, not part of the base
requirement; the plan picks the starting search shape.

#### REQ-SCC-7 — Handles escape and capacity investment
The agent takes the Door (`SurviveWorld`) when escape is favorable under the eval,
and resolves `ChooseBoon` / reward choices as capacity investment (valuing future
survival against the known act escalation), not as throwaway picks. It must not
stall indefinitely when escape is achievable.

#### REQ-SCC-8 — Tunable
Eval weights and search parameters (K, lookahead depth, axis weights, risk
posture) are explicit, named parameters with documented defaults, so the agent
can be re-tuned without rewrites. (Enables the future ladder to vary them.)

#### REQ-SCC-9 — Strictly stronger than random
Across the registered worlds, the honest agent's win-rate is strictly higher than
`randomPolicy`'s under the same seeds. A loss by this agent is therefore real
solvability signal, not agent weakness, to the resolution the agent affords.
(This is a *bar*, not a *proof* of unwinnability — see REQ-SCC-15.)

This is a **calibration target**, not a first-iteration bar: the minimum bar a
working implementation must clear is *strictly above* `randomPolicy` on the
fixture world; "comfortably dominant across all worlds" is reached by eval tuning
(see Open Questions). The plan should treat the dominance test (validation item 3)
as a pending/skipped assertion until tuning is confirmed, so a not-yet-tuned eval
is not mistaken for a code bug.

### Per-world completeness report

#### REQ-SCC-10 — Runs every registered world
The checker iterates `worldDataRegistry` (all registered bundles — 12 as of this
amendment; the count grows as worlds are added), building each world via
`buildWorld(worldId)` with the default starter and no unlocks, and runs N seeds
per world (N configurable). It does not run against only the test fixture.

The report is emitted to **stdout as human-readable text** (mirroring the
existing `bun run sim` output).

#### REQ-SCC-11 — Per-world win-rate and survival depth
For each world the report emits: games played, wins, losses, win-rate, average
turns survived across all runs, and the act-distribution of losses (the per-loss
act detail of REQ-SCC-13 aggregated per world).

#### REQ-SCC-12 — Failure attribution by cause
Each loss is attributed to exactly one cause, mapped to the engine loss sites:
HP-zero, zero-player-cards-drawn, deck/no-play exhaustion, and the degenerate
world-card livelock. Attribution uses the **engine-trigger taxonomy**: hand-flood
and player-deck-exhaustion both fire the same `reduce.ts:254` guard and are
reported as one cause (`zero-player-cards-drawn`), because distinguishing them
requires deeper terminal-state inspection than this stage commits to. If a later
stage wants them split, it adds a sub-attribute. Attributions sum to total losses
per world. The mechanism (instrument `WorldLost` with a cause vs. infer from
terminal state) is a plan decision; the *attribution* is required output.

#### REQ-SCC-13 — Failure attribution by act
Each loss also records which act (`actIndex` of `totalActs`) it occurred in, so
the report shows whether deaths cluster in the escalating later acts (expected) or
early (a likely tuning problem).

#### REQ-SCC-14 — Flags likely-unwinnable / mistuned worlds
The report visibly flags worlds whose honest win-rate falls at or below a
configurable low threshold (default near 0%), with the dominant failure cause/act
surfaced so the flag points at the knob to turn.

#### REQ-SCC-15 — Honest about its own epistemics
The report states that a win-rate is a sample under one agent at one skill level,
not a proof of (un)solvability, and that a near-0% flag means "this agent could
not survive it," to be confirmed by a future clairvoyant existence check. No
result is phrased as a guarantee of impossibility.

### Non-functional

#### REQ-SCC-16 — Reproducible
The whole run is deterministic given (agent seed, world seed range, parameters):
same inputs produce a byte-identical report. The report contains no timestamps,
elapsed times, or other system-derived values — only seed-derived content. The
agent's randomness stays fully separate from `state.rng` (as the existing seam
already arranges).

#### REQ-SCC-17 — No gratuitous core changes
Core stays pure, deterministic, and engine-independent. The only core change this
spec may justify is optional `WorldLost` cause instrumentation for REQ-SCC-12;
anything beyond that for attribution should live in the sim layer. No renderer or
Phaser dependency enters `src/core` or `src/sim`.

#### REQ-SCC-18 — Runnable and reasonably fast
The checker is runnable from a documented command (extend `bun run sim` or add a
sibling). For default parameters (target N = 100 seeds, K = 5 samples per
decision, across all registered worlds — 12 as of this amendment — with every
seed run as a fixed baseline+recovery pair per the paired-cohort design below,
i.e. 2 × N play-outs per world) the full run completes in under ~70s on a
typical dev machine. This was measured directly (not extrapolated) at 67.7s
real wall-clock time under exactly that scope (N=100, K=5, 12 worlds, 2×N
play-outs); ~70s is that measurement rounded up slightly for margin. The
revision from the prior ~60s figure reflects two changes since it was set: the
registered-world count grew from 9 to 12, and every seed now runs two
play-outs (baseline + recovery) instead of one. The number is adjustable once
measured again under a larger scope, but the bar remains "fast enough for
local/iterative use." N and K are tunable down for quick passes and up for
confidence. Accounting invariants (`checkIdAccounting`) continue to hold every
step.

## AI Validation

How the AI confirms this is done. Each item is runnable or observable.

1. **Report shape.** Running the checker emits, for **all** registered worlds, a
   per-world block with games/wins/losses/win-rate, survival depth, and
   per-cause + per-act loss attribution. (REQ-SCC-10, 11, 12, 13)
2. **Attribution integrity.** For each world, summed cause-attributions equal
   total losses, and each loss has exactly one cause and one act. (REQ-SCC-12, 13)
3. **Dominance over random.** A test runs both `randomPolicy` and the honest agent
   over the same seed set on at least the fixture world (`zombie-big-box`) and
   asserts the honest agent's win-rate is strictly higher. Per REQ-SCC-9 this test
   may be pending/skipped until eval tuning is confirmed, so a not-yet-tuned eval
   is not read as a code failure. (REQ-SCC-9)
4. **Honesty of the seam (structural + behavioral).** *Structural:* code review
   confirms the agent function receives only `view: GameState` and `rng`, with no
   import or closure reference to the runner's real `state`, and a grep finds no
   `state.playerDraw` / `state.worldDraw` / `acts` read inside the agent module.
   *Behavioral:* a spy/seam test feeds the agent ground truth vs. the determinized
   view and shows the decisions differ, proving it consumes the view. The
   structural check is primary; the behavioral one supplements it. (REQ-SCC-2)
5. **No card-name steering.** Grep/review shows the agent has no literal
   objective/threat card-name string matches; removing the old name heuristics
   does not reintroduce them. (REQ-SCC-4)
6. **Reproducibility.** Two runs with identical (agent seed, seed range, params)
   produce identical reports; changing the agent seed changes results.
   (REQ-SCC-16)
7. **Broken-world detection.** A synthetic unsurvivable world yields a near-0%
   win-rate and is flagged, with a dominant cause/act reported; a known-winnable
   world is not flagged. The fixture may be a minimal in-memory `WorldData`
   constructed directly (not through the data-bundle layer) whose acts escalate
   beyond any survivable threshold (e.g. only heavy-damage / ForceDestroy hazards).
   (REQ-SCC-14)
8. **Tunability.** Varying K and an eval weight via the documented parameters
   changes agent behavior/win-rate without code edits. (REQ-SCC-6, 8)
9. **Budget honesty.** The agent never emits an action that `availableActions`
   (with real energy) would reject for the committed state. (REQ-SCC-5)
10. **Escape, not stall.** On a world/seed where the agent reaches a state with
    `SurviveWorld` playable, it resolves it within a small number of turns rather
    than stalling. The action-cap (`MAX_ACTIONS_PER_WORLD`) violation ("capped")
    count is **reported per world** in the completeness output.
    *Amended 2026-06-28 (implementation divergence, user-approved):* the original
    bar was "capped count is 0 for a default-configuration run." A pure
    survival eval makes a comfortable, non-progressing board a local optimum, so
    the honest agent stalls in a minority of games (~32/900 on a default run,
    concentrated in highway-volcano / the-ember-orchard / overgrown-mall). The
    planned additive forward-progress eval term was empirically proven
    counterproductive (every positive weight *raised* capping and harmed survival
    dominance, catastrophically on recurrence worlds), so `capped == 0` is not
    reachable by weight-tuning and needs an anti-stall *redesign* out of this
    spec's scope. Decision: treat `capped` as honest reported signal ("this agent
    neither won nor lost within the action budget") rather than a hard gate. The
    dominance result (REQ-SCC-9) and the instrument's value stand. A future spec
    may add a plateau-aware anti-stall mechanism and restore the ==0 bar. (REQ-SCC-7)
11. **Suite + invariants green.** `bun run test` (sim + core), `bun run typecheck`,
    `bun run lint`, `bun run build` all pass; `checkIdAccounting` never throws
    during a full run. (REQ-SCC-17, 18)
12. **Epistemic framing present.** The report text includes the
    sample-not-proof caveat for any flagged world. (REQ-SCC-15)

## Implementation amendment: fixed paired recovery cohort

*Added 2026-07-02, tracking the
[completeness-agent-performance-stats plan](../plans/completeness-agent-performance-stats.md)
(diagnostic extension, not a rewrite of this spec).*

The checker already ships a recovery mechanism (`RECOVERY_RUN_MODIFIERS`,
`src/sim/completeness.ts`), but this spec never documented it. This amendment
closes that gap and replaces the mechanism's trigger with a fixed design.

**Fixed pairing, not adaptive triggering.** The implementation previously
activated recovery unlocks **adaptively**: `useRecoveryUnlocks = agg.losses +
agg.capped >= params.N / 2`, evaluated per-seed as running losses/caps
accumulated across the world's seed loop. The plan replaces this with a
**fixed paired cohort**: for every world seed, run **baseline first, then
recovery, always**, regardless of outcome. Both play-outs for a seed thread
one continuous `agentRng` stream, and that stream continues across seeds and
worlds exactly as today (REQ-SCC-16) — baseline and recovery are simply two
consecutive draws from the same deterministic stream rather than two
alternate branches of it.

**Why the adaptive trigger is being replaced.** The adaptive design confounds
two different things: *which configuration is active* (baseline vs. recovery
unlocks) and *whether earlier seeds in the same run had already accumulated
losses/caps*. Because the trigger condition depends on the run's own outcome
history, a difference observed between "recovery-triggered" and
"non-recovery" seeds cannot be attributed to the recovery unlocks — it may
simply reflect that recovery only ever turned on once things were already
going badly. A fixed pairing removes this confound: every seed gets both
configurations, in the same order, so any baseline-vs-recovery difference is
attributable to the configuration alone.

**Baseline remains the sole completeness result.** REQ-SCC-10's completeness
result, and the sole source of the `[FLAGGED]` determination, is the
**baseline cohort** (default starter, no unlocks) — unchanged from today.
Recovery is a **diagnostic-only** cohort reported alongside baseline; it must
never rescue or mask a baseline flag, and it introduces no second flagging
path.

**Runtime: `2 × N` play-outs per world.** With fixed pairing, every world now
runs baseline **and** recovery for each of the `N` seeds, i.e. `2 × N`
play-outs per audit instead of `N`. This is a runtime consequence, not a
change to REQ-SCC-18's ~60s target itself — the plan's validation step
(step 7) must re-measure the default `N=100, K=5` run against that target
rather than assume it still holds at double the play-out count. Recovery
stays strictly a **diagnostic comparison**: it is not an agent ladder, not a
general unlock sweep, not a CI gate, and not a claim of causal uplift (only
world seeds are paired; the continuous agent RNG samples differ between the
two play-outs of a pair).

**Re-measurement complete.** The validation step 7 re-measurement called for
above has been performed: the default `N=100, K=5`, all-12-worlds, `2×N`
play-outs run measured **67.7s** real wall-clock time on the dev machine used
for measurement. REQ-SCC-18's target has been revised accordingly to ~70s
(see above); this closes the loop this amendment opened, though further scope
growth (more worlds, larger N/K) will likely require re-measuring again.

## Open questions for the plan

- **Attribution mechanism:** extend `WorldLost` with a `cause` field (touches
  core, cleanest signal) vs. infer cause from terminal state in the sim (keeps
  core untouched, slightly fuzzier). REQ-SCC-12/17 allow either; plan decides.
- **Search shape:** 1-ply eval over K determinizations vs. shallow multi-ply
  lookahead. The brainstorm's "smart eval + shallow search vs. simple eval + deep
  sampling" fork lands here; pick a starting point and leave the other as a tuning
  knob (REQ-SCC-8).
- **Eval calibration loop:** the eval is iterative by nature; the plan should
  sequence "land a working agent + report" before "tune until dominance is
  comfortable," using REQ-SCC-9 as the moving target.
