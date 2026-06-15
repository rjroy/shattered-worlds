---
title: Engine effects — light floor, energy floor, keyword bonus
date: 2026-06-15
status: pending
tags: [task, unlocks, core-engine, effects]
source: .lore/work/plans/unlock-system.md
sequence: 5
modules: [core-engine, unlocks]
---

# Engine effects — light floor, energy floor, keyword bonus

Each reads `state.runModifiers`; no signature changes. Default (0) values preserve current behavior byte-for-byte.

## What

- **`src/core/engine/energy.ts` `decayLight`** (REQ-UNLK-16): replace the `if (state.light <= 0) return` early-return with the floor-aware form — early-return only when `light <= 0 && floor === 0`; otherwise `newLight = max(max(0, light - LIGHT_DECAY), floor)`; emit `LightChanged` iff `light !== newLight`.
- **`src/core/engine/energy.ts` `gainEnergy`** (REQ-UNLK-17): the **one-argument turn-start** `gainEnergy(state)` (adds 1 unconditionally) — `newEnergy = max(state.energy + 1, state.runModifiers.minEnergyPerTurn)`. **Do NOT** touch the card-effect `gainEnergy(state, n)` in `src/core/effects/resources.ts`.
- **`src/core/effects/dealProgress.ts` `dealProgress`** (REQ-UNLK-18): when the bonus tag matches, `bonus.amount + state.runModifiers.keywordDamageBonus`; non-matching hazards get no bonus. `DealProgressAll` inherits via the same helper.

Add the REQ-UNLK-27 test cases to the appropriate engine test files.

## Validation

Tests pass (REQ-UNLK-27):
- `decayLight` with `minLightPerTurn: 1` never goes below 1; over 10 `startTurn` calls on a Fog state (`startLight: 4`) → `state.light === 1` (**V5**). With `minLightPerTurn: 0` (default), behavior is identical to current.
- `gainEnergy` with `minEnergyPerTurn: 2`: from `energy 0` → `2` (**V6**); from `energy 3` → `4` (floor not triggered).
- `dealProgress` with `keywordDamageBonus: 1`: Explore (base 1, +1 vs Hidden) on a Hidden hazard → 3 progress; on a non-Hidden hazard → 1 (**V7**).

`bun run typecheck` + **full** `bun run test` green; no pre-existing test regresses (the floor-0/default-0 cases prove behavior preservation).

## Why

REQ-UNLK-16, 17, 18, 27; validators V5, V6, V7.

## Files

- `src/core/engine/energy.ts`, `src/core/effects/dealProgress.ts`, and their test files (e.g. `src/core/tests/reduce.test.ts` / a `dealProgress` test)
