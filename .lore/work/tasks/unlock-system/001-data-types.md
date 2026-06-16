---
title: Unlock data types
date: 2026-06-15
status: complete
tags: [task, unlocks, types]
source: .lore/work/plans/unlock-system.md
sequence: 1
modules: [unlocks]
---

# Unlock data types

## What

Create `src/data/unlocks/types.ts` with the pure data types, verbatim from the spec:

- `RunModifiers` — eight `readonly` numeric fields (`extraStartHp`, `extraStartEnergy`, `extraStartLight`, `extraStartBrace`, `handSizeBonusPerAct`, `minLightPerTurn`, `minEnergyPerTurn`, `keywordDamageBonus`) and `DEFAULT_RUN_MODIFIERS` with all fields `0` (REQ-UNLK-1).
- `UnlockEffect` — the six-variant discriminated union: `startingStat`, `handSizeBonus`, `minResourcePerTurn`, `keywordDamageBonus`, `starterDeckOverride`, `actReward` (REQ-UNLK-2).
- `UnlockDefinition` — `id`, `name`, `description`, `cost`, `destinyWeight`, `effect` (REQ-UNLK-3). No `iconKey` field.

This file has zero runtime imports (type declarations plus the one `DEFAULT_RUN_MODIFIERS` const).

## Validation

- `bun run typecheck` exits 0 (V1).
- No `any`/`unknown` casts.
- The file imports nothing at runtime — confirm only type decls and the single const.

## Why

REQ-UNLK-1, 2, 3. The pure-data foundation every later phase depends on; defined first so nothing references it before it exists.

## Files

- `src/data/unlocks/types.ts` (new)
