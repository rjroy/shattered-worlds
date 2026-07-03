---
title: Per-World Intensity Weights Remain an Open Idea, Not Yet Built
date: 2026-07-02
status: current
tags: [intensity, juice, feedback, world-design, open-idea]
fg-type: concept
fg-sources: [.lore/work/brainstorm/theme-mechanical-differentiation.md, .lore/work/brainstorm/shard-response-archetypes.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/intensity.ts
---

# Per-World Intensity Weights Remain an Open Idea, Not Yet Built

`intensity(state)` (`src/core/engine/intensity.ts`) is a renderer-facing read-model in `[0, 1]` that drives juice (screen shake, music, glow). It combines act progress, HP loss, and held-hazard hand-clog with fixed weights (currently `0.75` act / `0.9` hp / `0.9` held-hazards) — the same weights for every world.

Two brainstorms independently proposed making these weights per-world instead of global, so the juice crescendos from whichever pressure source is actually that world's identity: `highway-volcano` spiking on time/act progress, `bird-building` on hand clog, `zombie-big-box` on HP loss. Both brainstorms flagged this as pure renderer-facing tuning with zero gameplay risk — but as of 2026-07-02 the function is still global and unweighted per world. This is a recorded, twice-proposed, still-open idea rather than a decision: if picked up, the natural home is a per-`worldId` weight table read by `intensity()` instead of the current constants.
