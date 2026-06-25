# Core Render Split

<!--
date: 2026-06-15
status: current
tags: architecture, core, renderer, phaser, deterministic, event-log, seam
fg-type: architecture
fg-sources: .lore/work/design/core-render-architecture.html, .lore/work/specs/poc-core-loop.html, .lore/work/plans/poc-core-loop.html
fg-status: current
fg-evidence:
  code:
    - src/core/index.ts
    - src/core/engine/reduce.ts
    - src/game/scenes/TableScene.ts
  tests:
    - src/core/tests/reduce.test.ts
    - src/game/tests/gameplaySessionIntegration.test.ts
  symbols:
    - reduce
    - GameState
    - GameEvent
-->

Game truth lives in a pure, synchronous, deterministic TypeScript core. The Phaser layer is a renderer and input adapter. The core never imports Phaser, DOM, canvas, timers, audio, or game presentation code; the build enforces that boundary.

## Contract

The renderer sends a complete action to the core. The core returns the authoritative next state plus an ordered semantic event log. The renderer may animate those events at human pace or skip directly to the returned state. Simulation runners can ignore animation events and run at full speed.

All game randomness lives in the core behind seeded state. Same seed plus same action sequence must replay identically. Cosmetic renderer randomness may exist, but it never feeds back into state.

## Why It Matters

The split makes balance sims, golden tests, reducer tests, and AI code review feasible. It also protects the project from presentation-driven rule drift: if something decides what is true in the game, it belongs in the core; if it decides how truth looks or feels, it belongs in the renderer.
