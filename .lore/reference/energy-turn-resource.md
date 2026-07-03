---
title: Energy Turn Resource
date: 2026-07-02
status: current
tags: [energy, player-resource, turn-economy, cost, core-state]
fg-type: architecture
fg-sources: [.lore/work/specs/player-energy-resource.html, .lore/work/plans/player-energy-resource.html, .lore/work/notes/player-energy-resource.html, .lore/work/brainstorm/theme-mechanical-differentiation.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/energy.ts
    - src/core/engine/available.ts
    - src/core/engine/reduce.ts
    - src/core/model/types.ts
  tests:
    - src/core/tests/available.test.ts
    - src/core/tests/reduce.test.ts
  symbols:
    - energy
    - energyCost
---

# Energy Turn Resource

Energy is a per-turn player resource stored on `GameState`. It gates player-card playability without changing world-card hazard cost. The two costs are separate concepts: hazard cost is cleared by Progress; energy cost is paid by the player to play certain cards.

This resolves an open question from an early differentiation brainstorm (`theme-mechanical-differentiation.md`, 2026-06-07), which flagged "no energy/mana exists" as the single biggest fork in how much differentiation work would be needed: without a spendable budget, hazard `cost` is purely a progress threshold, not a budget, and a whole class of "you can't clear everything, choose" decisions was unavailable. Energy shipped afterward, closing that fork in favor of the richer design space.

## Lifecycle

Energy initializes to `runModifiers.extraStartEnergy` when a world is created — `0` by default, but Destiny Blessing unlocks can raise it (`src/data/unlocks/catalog.ts`) — then the shared start-turn step grants +1 before the opening hand and before every later refill. Unspent energy carries across turns with no cap. Act transitions do not reset energy; a new world does.

## Playability

A card is playable only when its structural targeting requirements are satisfied and current energy is at least its energy cost. Cost-0 cards preserve existing behavior. Spending energy happens as part of playing the card, so reducer tests must cover both state change and event emission.
