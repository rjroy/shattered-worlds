---
title: Core RunModifiers field, createWorld application, and hand-size rename
date: 2026-06-15
status: pending
tags: [task, unlocks, core-engine, createworld, hand-size]
source: .lore/work/plans/unlock-system.md
sequence: 4
modules: [core-engine, unlocks]
---

# Core RunModifiers field, createWorld application, and hand-size rename

This is one **atomic** change: adding a required `GameState` field breaks compilation until `createWorld` sets it. Land it all together.

## What

- **`src/core/model/types.ts`**: add `readonly runModifiers: RunModifiers` to `GameState`, importing `RunModifiers` from `../../data/unlocks/types` (core→data is lint-allowed). `readonly` is deliberate — set once, never reassigned (REQ-UNLK-4).
- **`src/core/engine/world.ts`**:
  - Rename `WORLD_CONSTS.maxHandSize` → `baseHandSize` (still 6); update the `startPlayerCards` getter to `baseHandSize - startWorldCards` (REQ-UNLK-15).
  - Import `RunModifiers`, `DEFAULT_RUN_MODIFIERS` from `../../data/unlocks/types`.
  - `createWorld` gains optional 4th param `runModifiers?: RunModifiers`; `const mods = runModifiers ?? DEFAULT_RUN_MODIFIERS` (REQ-UNLK-13).
  - Skeleton state (REQ-UNLK-14): `hp: startHp + mods.extraStartHp`, `energy: mods.extraStartEnergy`, `light: (world.startLight ?? 0) + mods.extraStartLight`, `braceCharges: mods.extraStartBrace`, `runModifiers: mods`.
  - Export `effectiveHandSize(state) = WORLD_CONSTS.baseHandSize + state.actIndex * state.runModifiers.handSizeBonusPerAct` (REQ-UNLK-15).
- **`src/core/engine/draw.ts`** `refillHand`: switch both functional refs to `effectiveHandSize(state)` — `:144` (`... - heldWorld`, term stays `heldWorld`) and `:171` (use `state`, not `current`). Update the doc-comment at `:126,132,135` to read `effectiveHandSize(state)` **and** fix the pre-existing error where `:132`/`:135` say `room = ... - hand.length` (the code subtracts `heldWorld`). The `if (room === 0)` guard at `:146` now fires at the effective size — intended.
- **`src/core/engine/intensity.ts:17`**: `WORLD_CONSTS.maxHandSize` → `WORLD_CONSTS.baseHandSize` (normalization denominator — must NOT use `effectiveHandSize`).
- **`src/game/view/HelpOverlayView.ts:420`**: rename to `baseHandSize` (display only).
- **`src/core/tests/draw.test.ts`**: rename all `maxHandSize` → `baseHandSize`.
- **`src/core/tests/world.test.ts`**: add the REQ-UNLK-26 cases.

## Validation

- `bun run typecheck` + **full** `bun run test` green. `makeState` (`testFixture.ts`) compiles unchanged — it forks `createWorld`, so it inherits `runModifiers`.
- world.test.ts: `extraStartHp: 5` → `state.hp === 15` (**V3**); `extraStartEnergy: 1` → `state.energy === 2`; `extraStartLight: 2` on Fog (`startLight: 4`) → skeleton 6, minus one decay = `state.light === 5`; `extraStartBrace: 2` → `braceCharges === 2`; `effectiveHandSize` returns `baseHandSize + actIndex * bonus` (**V4**: 7 at `actIndex === 1`, bonus 1).
- Determinism test passes with `RunModifiers` threaded (**V11**).
- Grep: `maxHandSize` absent from `src/core/**` and `src/data/**` (**V12**), comments excepted.

## Why

REQ-UNLK-4, 13, 14, 15, 26; validators V3, V4, V11, V12.

## Files

- `src/core/model/types.ts`, `src/core/engine/world.ts`, `src/core/engine/draw.ts`, `src/core/engine/intensity.ts`, `src/game/view/HelpOverlayView.ts`, `src/core/tests/draw.test.ts`, `src/core/tests/world.test.ts`
