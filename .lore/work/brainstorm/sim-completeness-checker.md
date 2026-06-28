---
title: Sim as a per-world completeness checker
date: 2026-06-27
status: open
tags: [sim, completeness, difficulty, agent, evaluation-function, determinize, survival-horror]
modules: [sim, core]
related: [.lore/work/plans/observability-boundary.md, .lore/work/design/observability-boundary.md]
---

# Sim as a per-world completeness checker

Follow-on to the **executed** observability-boundary plan, which deferred exactly
this: "the greedy / search policy with a tunable evaluation function, and the
agent-ladder difficulty harness." That plan landed the honest seam
(`determinize`, the `Policy` type, the determinized-view runner). Today the only
policy is `randomPolicy` (`src/sim/policy.ts`) — random except a few hard-coded
objective grabs by card name ("Door", "The Walker", "Summon Door"), which is too
weak to tell us anything about whether a world is winnable.

**Goal of this stage:** a stronger-than-random *honest* agent with a tunable
evaluation function, used to measure **per-world solvability** — win-rate per
world over N seeds, where a near-0% rate flags a likely-unwinnable or mistuned
world. Eventually extend to an agent ladder for difficulty.

Scope decisions taken before this session (from the kickoff):
- Completeness unit = **per-world solvability** (not full-run reachability yet).
- Entry depth = **brainstorm first** (the eval function is the iterative part).

## The reframe that drives everything: this is survival horror

The game is **not** about winning, it is about **not losing**. The player
survives until they can escape through the Door. So the eval function is not a
*distance-to-win* gradient (offense). It is a *distance-from-death* gradient
(defense), and the Door is an **exit you take when you can afford to**, not a
hill you climb.

This dissolved the biggest feasibility worry (can the agent even read the
objective?). "How close am I to winning" is opaque; "how close am I to dying" is
sitting in plain state.

## Survival is a vector, not a scalar

There are **four** lose conditions. You die from whichever reservoir hits its
line first:

| Axis | Failure | Mitigation lever |
|---|---|---|
| HP | hits 0 | heal |
| Card supply | all cards gone | add cards / defend against destruction |
| Hand composition | hand full of world cards | clear world cards **through progress** |
| Hand state | all cards frozen | thaw |

Consequences:

- **The eval writes itself and is world-agnostic.** Survival margin ≈
  `min over the four axes of (turns until this axis fails at the current rate)`
  — Liebig's law of the minimum. The agent reads four state quantities and their
  rates of change and triages the bottleneck. **No card names needed.** Each
  world just *weights which axis it attacks* (whiteout → freeze, infest/mall →
  hand-flood, etc.); one generic eval, four terms, world supplies the pressure
  profile.
- **Completeness gets a concrete shape.** A world is broken if any single axis is
  *forced* to fail regardless of play. The sim measures win-rate empirically, but
  the **failure attribution is free**: log which reservoir killed the agent. A
  world that always dies on the same axis points straight at the knob to turn.

## The real currency is plays-per-turn, not deck size

Each axis has its own defense, but all defenses are paid from the **same finite
hand each turn**. The scarcity is *throughput*: four leaks, not enough buckets.
Survival margin = "can my per-turn defensive throughput keep all four axes off
their line, against this act's threat rate."

Special lever: **"clear world cards through progress" makes defense and escape the
same action.** Progress clears the hand-flood axis *and* is the road to the Door.
The Door is not a separate "switch to escape mode" attractor — it is the
accumulation of the same clearing you already do to survive. A pure turtle that
never progresses *floods itself*; progressing to survive naturally drifts toward
the exit. But progress competes for the same plays as healing and thawing. That
spend-this-play-surviving-now vs escaping-sooner tension is the moment-to-moment
game.

## Two timescales: the act arc is the macro cliff

**3 acts × 10 cards, escalating danger, act 1 arms you** (gives helper cards /
rewards). This is the forced escalation. The agent faces a delayed-death cliff at
*two* scales:

- **Micro (per turn):** allocate limited plays across four leaks.
- **Macro (per act):** *invest* in capacity during act 1 — take the right cards,
  pick the right boons between acts (`ChooseBoon` is already in the action space)
  — to survive a later escalation you can see coming *structurally* even though
  the exact cards are hidden.

A shallow agent sails through act 1, under-invests, and dies in act 3 — **the
authentic new-player death** ("it was easy and then suddenly I lost"). So the
completeness agent must value *future* survival capacity, and boon/reward choice
is as load-bearing as play choice. A world can be broken not only by an
unsurvivable act 3, but by an **act 1 that doesn't arm you enough** to reach
survivable act-3 throughput.

Two supporting facts:

- **Escalation is known structure even when card identity is hidden.**
  `determinize` shuffles within acts, so the honest agent never sees act 3's exact
  cards — but "3 acts, later worse, 10 each" is fixed and legible. Honest *and*
  tractable: reason about the shape of the threat without seeing the cards.
- **The coupling is why you need simulation, not arithmetic.** Tempting bad idea:
  check completeness per axis analytically ("max thaw throughput vs act-3 freeze
  rate"). It fails because the axes share one play budget — defending one starves
  the others. Only a full rollout sees the allocation pressure.

## Honest vs clairvoyant: two instruments, not one

A win-rate is a **sample, not a proof**. The honest agent (re-samples hidden info
per rollout via `determinize`) answers the *human-realistic* question. But "is
this world survivable **in principle**" is an existence question best answered by
a **clairvoyant** agent that reads the real threat order and just tries to find
one surviving line. The observability design left this door open ("reversible
later if the follow-on wants a clairvoyant upper-bound agent").

The two together are richer than either alone:

- clairvoyant 0% → genuinely unfair / broken (true completeness failure).
- clairvoyant high, honest near-0 → **you die to things you can't anticipate.**
  In survival horror that gap *is* the horror — a design smell *or* an
  intentional dread lever, but a number the designer wants to *know*.

So **`clairvoyant_winrate − honest_winrate` is a surprise-dependence metric**, not
just a completeness check. Completeness is really two layers: "is there a
surviving line at all" (clairvoyant) and "how much does survival depend on
luck/foresight" (the gap).

## The agent ladder falls out for free: risk posture, not cleverness

Because the game is about *not losing*, an agent's skill level *is* its risk
tolerance and how far ahead it checks for death. Two dials, both mapping to real
human skill progression:

- **Micro axis-awareness** — how many of the four leaks it watches.
  - Tier 1 watches HP only → gets milled, flooded, or frozen out. *New player.*
  - Tier 2 watches all four, one turn ahead.
  - Tier 3 watches all four across sampled determinizations, takes the Door only
    when escape is near-certain. *Expert.*
- **Macro investment horizon** — does it build in act 1 for act 3.

The classic survival-horror death ("I was watching my health and got locked out")
is reproduced directly by an axis-awareness ladder — exactly what difficulty
calibration should track.

## Model, end to end

- **Eval** = `min`-of-four survival margins, financed by a per-turn play budget,
  with progress doubling as the Door attractor.
- **Completeness** = run a strong *honest* agent N seeds/world; report win-rate
  **plus failure attribution** (which axis, which act killed it). Layer a
  *clairvoyant* run for the existence question; read the gap as
  surprise-dependence.
- **Difficulty ladder** = two dials (micro axis-awareness, macro investment
  horizon), both mapping to human skill progression.

## Open forks for the design phase (not resolved here)

1. **Smart eval + shallow search, or simple eval + deep sampling?** The two
   delayed-death cliffs can be paid either by an eval that *encodes coming-act
   pressure* (hard to write, cheap to run) or by deeper rollouts that *discover*
   it (easy eval, expensive). A ladder may want both as knobs.
2. **What makes the Door available** — a schedule (end of act 3) or summoned by
   accumulated progress? Decides whether the macro game is "survive a fixed
   gauntlet" or "win a progress-race against the squeeze," and changes the eval's
   Door term. (The old `Summon Door` heuristic hints at progress-summoned —
   confirm against core.)
3. **Compute budget / where it runs.** Search agent × N determinizations ×
   rollouts × seeds × worlds can be orders of magnitude slower than today's random
   sim. Is completeness a CI gate (needs a frozen, comparable agent and low false
   alarms) or an on-demand balancing dashboard (tolerates noise, wants spread)?
   This gates agent strength and seed counts.

## Concrete unknowns to confirm before/at design

- Does the core expose progress / Door-availability and the four reservoir
  quantities as structured state the eval can read directly?
- Exact lose-condition triggers in the reducer (HP≤0, empty supply, hand-all-world,
  hand-all-frozen) — to compute per-axis margins and attribute deaths.
- How "progress" is represented and how it both clears world cards and reaches the
  Door.
