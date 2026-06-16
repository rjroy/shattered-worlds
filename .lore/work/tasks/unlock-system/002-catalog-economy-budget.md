---
title: Unlock catalog, fragment economy, and Destiny budget
date: 2026-06-15
status: complete
tags: [task, unlocks, catalog, economy, budget]
source: .lore/work/plans/unlock-system.md
sequence: 2
modules: [unlocks, meta-progression]
---

# Unlock catalog, fragment economy, and Destiny budget

## What

Create `src/data/unlocks/catalog.ts`:

- **Type-only** imports of `UnlocksProfile` (from `../../game/runtime/unlocksProfile`) and `FeatsProfile` (from `../../game/runtime/featsProfile`). These must stay `import type` to honor the data→game boundary convention (V10). Runtime import `computeFragmentBalance`, `FEAT_CATALOG` from `../feats/catalog`.
- `UNLOCK_CATALOG: readonly UnlockDefinition[]` — exactly the ten entries in the REQ-UNLK-5 table, IDs verbatim. `act-reward` (`actReward`, `offeredCount: 3`) is present but inert (REQ-UNLK-23).
- `computeUnlockSpend(profile, catalog)` — sum costs of purchased ids present in the catalog; ignore unknown ids (REQ-UNLK-7).
- `computeSpendableBalance(featsProfile, unlocksProfile)` — `computeFragmentBalance(...) - computeUnlockSpend(...)`, clamped to 0 with a `console.warn` on a negative result (REQ-UNLK-8).
- `buildRunModifiers(activeIds, catalog)` — fold the **activated** ids into `RunModifiers`. Rules (REQ-UNLK-12): `startingStat` → add to matching `extraStart*`; `handSizeBonus` → assign `handSizeBonusPerAct`; `minResourcePerTurn` → `max(current, floor)`; `keywordDamageBonus` → additive; `starterDeckOverride`/`actReward` → skip; unknown ids skipped.
- `DESTINY_BUDGET = 5`; `activeWeight(activeIds, catalog)` (sum `destinyWeight`, ignore unknown); `canActivate(def, activeIds, catalog)` → `false` if `def.id` already active **or** `activeWeight + def.destinyWeight > DESTINY_BUDGET` (REQ-UNLK-36). This is the single source of truth for the budget rule.

Create `src/data/unlocks/catalog.test.ts`.

## Validation

`catalog.test.ts` covers and passes:
- `UNLOCK_CATALOG` has no duplicate ids.
- `computeUnlockSpend`: empty → 0; partial sum; unknown ids ignored.
- `buildRunModifiers`: empty → `DEFAULT_RUN_MODIFIERS`; all stat unlocks accumulate; `min-energy` → `minEnergyPerTurn = 2`; **active subset only** (e.g. `[extra-hp]` yields `extraStartHp 3`, `extraStartEnergy 0`).
- `computeSpendableBalance`: 50f earned − `extra-hp` (15f) = 35 (**V8**).
- `activeWeight`: sums `destinyWeight`, ignores unknown ids.
- `canActivate`: true when it fits; false when it would exceed `DESTINY_BUDGET`; false when already active.

`bun run typecheck` + `bun run test src/data/unlocks/catalog.test.ts` green.

## Why

REQ-UNLK-5, 6, 7, 8, 12, 23, 24, 36; validator V8. The catalog, fragment math, and the budget primitives that the store (003) and scene (009) both consume.

## Files

- `src/data/unlocks/catalog.ts` (new)
- `src/data/unlocks/catalog.test.ts` (new)
