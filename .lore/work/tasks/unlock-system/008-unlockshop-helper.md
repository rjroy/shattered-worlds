---
title: unlockCardState pure helper
date: 2026-06-15
status: complete
tags: [task, unlocks, view, pure-helper]
source: .lore/work/plans/unlock-system.md
sequence: 8
modules: [unlocks]
---

# unlockCardState pure helper

The Phaser-free, unit-tested logic behind the Destiny scene's card states. Split from the scene (009) because it is pure logic with its own unit gate.

## What

Create `src/game/view/unlockShop.ts`:

- `unlockCardState(def, purchased, balance): 'owned' | 'affordable' | 'unaffordable'` (REQ-UNLK-32) — `'owned'` if `def.id ∈ purchased`; else `'affordable'` if `def.cost ≤ balance`; else `'unaffordable'`.

The budget/activation rule is **not** here — it lives in `canActivate` (`data/unlocks/catalog`, task 002); the scene imports that. This helper only covers purchase state.

Create `src/game/view/unlockShop.test.ts`.

## Validation

`unlockShop.test.ts` covers and passes (REQ-UNLK-35):
- `'owned'` when in `purchased` (even if also unaffordable).
- `'affordable'` when not owned and `cost ≤ balance`.
- `'unaffordable'` when not owned and `cost > balance`.
- Boundary: `cost === balance` → `'affordable'`.

`bun run test src/game/view/unlockShop.test.ts` green (**V16**).

## Why

REQ-UNLK-32, 35; validator V16.

## Files

- `src/game/view/unlockShop.ts` (new)
- `src/game/view/unlockShop.test.ts` (new)
