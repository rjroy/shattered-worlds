---
title: Don't Fake RNG Inside a Pure Reducer — Determinize at the Boundary Instead
date: 2026-07-02
status: current
tags: [rng, determinization, sim, core-engine, purity, lesson]
fg-type: lesson
fg-sources: [.lore/work/design/observability-boundary.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/determinize.ts
    - src/core/engine/reduce.ts
  symbols:
    - determinize
    - reduce
---

# Don't Fake RNG Inside a Pure Reducer — Determinize at the Boundary Instead

An honest sim agent needs to plan without reading the true future (real deck order, real dice rolls). The tempting fix is a "preview mode" flag inside the reducer that fakes `state.rng` during planning. Both ways of doing that are unsound:

- **Skip the roll.** Downstream effects depend on the result — a card that draws, then reads the hand, cannot proceed without an actual outcome. The reducer cannot know which rolls are safe "leaf" rolls to skip; skipping produces a wrong post-state that cascades.
- **Substitute a placeholder.** A card must physically be in a zone; there is no "maybe-card" representable in the model. Inventing one creates a second semantics for the whole reducer and forces every handler to branch on a preview flag.

The sound version of "give it a fake roll" is to hand the reducer a state whose hidden zones have *already* been reshuffled — that's determinization, and it belongs at the boundary (`src/sim/determinize.ts`), not inside the engine. The reducer (`reduce`) is never touched and stays pure and full-information.

This is the reason an honest sim is cheap: purity is what makes fork-and-rollback free. Any temptation to special-case the reducer for "preview" or "simulation" purposes should be redirected to a boundary transform that reshuffles/resamples state before the reducer runs, never to a flag inside it.
