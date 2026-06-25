---
title: Tidal Archive World
date: 2026-06-25
status: current
tags: [world-design, the-tidal-archive, discard-recall, passive-effects, boons]
fg-type: concept
fg-sources: [.lore/work/plans/the-tidal-archive.md, .lore/work/notes/the-tidal-archive.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/the-tidal-archive/cards.json
    - src/data/worlds/the-tidal-archive/index.ts
    - src/core/effects/recallDiscard.ts
    - src/game/interaction/selection.ts
  tests:
    - src/core/tests/tidalArchive.test.ts
    - src/core/tests/recallDiscard.test.ts
    - src/core/tests/tidalReplay.test.ts
  symbols:
    - RecallPlayerDiscard
    - ReturnPlayerDiscardToTop
    - WorldData
---

# Tidal Archive World

The Tidal Archive's threat verb is **displace**: it owns discard and deck-order recall, making the top of the player deck and discard pile part of the decision surface. Rewards deliberately set up future draws, while hazards can recall discarded cards automatically.

## Core Additions

The plan adds recall effects, a discard-target selection grammar, and a per-world end-turn passive. Because `reduce(catalog, state, action)` does not receive `WorldData`, the passive is threaded onto `GameState` during world creation rather than looked up dynamically during reduction.

Adding a new discard-recall target spec affects the runtime action gate, the renderer selection state machine, and sim policy. The spec name is `recallTarget` to avoid confusion with `discardPlayer`, which means the opposite interaction.

## Resolved Authoring Decisions

Memory Trawler uses a random player discard recall effect instead of a player-choice target. Structural force hazards use `ForceDestroy` where the fiction is collapse or snatch rather than HP damage.

Bridge to Yesterday uses top-deck recurrence rather than `ReturnWorldCards` on a clear hook, because automatic hooks cannot supply selected return ids. Drowned Index uses an `OfferBoon` reward choice over the Tidal kit instead of granting multiple fixed cards.
