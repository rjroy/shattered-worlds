---
title: Runtime world assembly, activation subset, and call-site migration
date: 2026-06-15
status: pending
tags: [task, unlocks, game-runtime, buildworld, activation, migration]
source: .lore/work/plans/unlock-system.md
sequence: 7
modules: [game-runtime, unlocks]
---

# Runtime world assembly, activation subset, and call-site migration

The largest-blast-radius change: world assembly moves into the runtime, and only the **activated** subset of unlocks reaches a run. Depends on tasks 002, 003, 006.

## What

**`src/game/runtime/gameplayRuntime.ts`:**
- Import `buildWorld` (from `data/worldManifest`), `UNLOCK_CATALOG` + `buildRunModifiers` (from `data/unlocks/catalog`), `createUnlocksStore` + `UnlocksStore` (from `unlocksProfile`), and the `AssembledWorld` type.
- `createUnlocksStore(options.storage, featsStore)`; expose `unlocksStore: UnlocksStore` on the `GameplayRuntime` interface and the returned object.
- Private `resolveStarterDeckId(activeIds, catalog)`: first `starterDeckOverride.starterDeckId` among the **activated** ids, else `undefined`.
- Add `world?: AssembledWorld` to `RuntimeSessionOptions` (the `Omit<GameplaySessionOptions, …>` type) as the test seam; strip it before forwarding to `createGameplaySession`. Reuse `AssembledWorld` (from `core/model/catalog`) — no parallel inline shape.
- Change `startSession(catalog, world, seed, options)` → **`startSession(worldId, seed, options)`**:
  1. `activeIds = unlocksStore.getProfile().activated`
  2. `const { catalog, worldData } = options.world ?? buildWorld(worldId, resolveStarterDeckId(activeIds, UNLOCK_CATALOG) ?? 'starter')`
  3. `runModifiers = buildRunModifiers(activeIds, UNLOCK_CATALOG)`
  4. `appliedModifiers = activeIds.map(id => ({ kind: 'unlock', id }))`
  5. `createGameplaySession(catalog, worldData, seed, { ...rest, runModifiers, appliedModifiers, stream, clock })`
  - Both branches of step 2 feed the identical step 3–5 tail (single session-creation path).

**`src/game/scenes/TableScene.ts`:** replace the `buildWorld(...)` + `startSession(catalog, worldData, this.seed_)` (≈ 157–159) with `this.runtime_.startSession(this.worldId_, this.seed_)`; remove the `buildWorld` import; **remove `starterId_`** (the private field, the `starterId?` init key, and the `this.starterId_ = ...` line).

**`src/game/scenes/WorldSelectScene.ts:396`:** drop the now-ignored `starterId: "starter"` key from the `scene.launch("Table", …)` call.

**Test migration:**
- `src/game/runtime/gameplayRuntime.test.ts` (exactly 12 `startSession` sites): `startSession(catalog, worldData, seed, opts)` → `startSession(worldId, seed, { world: { catalog, worldData }, ...opts })`. Pass a `worldId` that matches `worldData.worldId` of the injected world (e.g. `'runtime-win-world'` for the `winWorldData` test at line 182).
- `src/game/tests/gameplaySessionIntegration.test.ts:152`: replace the assertion with exactly `expect(source).toContain('this.game_ = this.runtime_.startSession(this.worldId_, this.seed_)')`; scan for other assertions referencing the removed `buildWorld`/`worldData` lines and update.
- Add a runtime test for **V18**: stub `unlocksStore` with `extra-hp` activated and `extra-energy` purchased-but-inactive → started session has `state.runModifiers.extraStartHp === 3`, `extraStartEnergy === 0`, and `appliedModifiers` lists only `extra-hp`.

## Validation

- `bun run typecheck` + **full** `bun run test` green (all suites, incl. migrated `gameplayRuntime.test.ts` and the V18 test).
- `bun run lint` exits 0 (core boundary). Grep `src/data/unlocks/`: only `game`-layer imports are the two `import type` lines in `catalog.ts` (**V10**).
- **V18** test passes: only the active subset applies; `appliedModifiers` reflects activated, not all owned.

## Why

REQ-UNLK-19, 20, 21, 22a, 22b; validators V10, V18.

## Files

- `src/game/runtime/gameplayRuntime.ts`, `src/game/scenes/TableScene.ts`, `src/game/scenes/WorldSelectScene.ts`, `src/game/runtime/gameplayRuntime.test.ts`, `src/game/tests/gameplaySessionIntegration.test.ts`
