---
title: "Implementation notes: unlock-system"
date: 2026-06-15
status: complete
tags: [implementation, notes, unlocks]
source: .lore/work/plans/unlock-system.md
modules: [unlocks, feats, meta-progression, core-engine, game-runtime]
---

# Implementation notes: unlock-system

## Progress

- [x] 001 Unlock data types
- [x] 002 Unlock catalog, fragment economy, and Destiny budget
- [x] 003 UnlocksProfile persistence and store
- [x] 004 Core RunModifiers field, createWorld application, and hand-size rename
- [x] 005 Engine effects: light floor, energy floor, keyword bonus
- [x] 006 Thread RunModifiers from createGame through GameplaySession
- [x] 007 Runtime world assembly, activation subset, and call-site migration
- [x] 008 unlockCardState pure helper
- [x] 009 Destiny scene: purchase and activation UI
- [x] 010 Final validation sweep

## Log

### 2026-06-15

- Created `src/data/unlocks/types.ts` with `RunModifiers`, `UnlockEffect`, `UnlockDefinition`, and defaults.
- Added `UNLOCK_CATALOG`, fragment spend/balance helpers, `buildRunModifiers`, `DESTINY_BUDGET`, `activeWeight`, and `canActivate`.
- Added `UnlocksProfile` persistence and `UnlocksStore`, including auto-activate-if-fits and already-active no-op behavior.
- Added `GameState.runModifiers`; `createWorld` now applies starting stat offsets and stores the modifier bag.
- Renamed `WORLD_CONSTS.maxHandSize` to `baseHandSize`; draw targeting now uses `effectiveHandSize(state)` while intensity stays on `baseHandSize`.
- Added light floor, energy floor, and keyword damage bonus engine hooks.
- Moved world assembly into `gameplayRuntime.startSession(worldId, seed, options)` with `options.world` as the test seam. Runtime now exposes `unlocksStore`, resolves starter deck overrides from active unlocks, computes `runModifiers`, and stamps `appliedModifiers` from activated ids only.
- Removed `starterId` from `TableScene` launch data; `WorldSelectScene` now launches runs with `{ worldId, seed }`.
- Added `unlockCardState` and the `DestinyScene` shop/loadout UI, wired from `WorldSelectScene` and registered in `main.ts`.
- Generated a 5x2 Blessing art sheet with the built-in image tool and cropped it into ten project assets under `src/game/assets/unlocks/`, bound to `unlock/<id>` texture keys in `assetManifest.ts`.

## Validation

- `bun run typecheck` passed.
- `bun run test` passed: 823 tests.
- `bun run lint` passed.
- `bun run build` passed; generated unlock assets are included in the Vite output.
- V9 grep: no stored balance/spend/spendable keys in `src/game/runtime/unlocksProfile.ts`.
- V10 grep: `src/data/unlocks` imports game-layer types only via `import type`.
- V12 grep: `maxHandSize` absent from `src/core/**` and `src/data/**`.

## Manual Notes

- In-app Browser control was unavailable in this thread, and the bundled Playwright package was missing `playwright-core`, so the interactive browser pass could not be completed through automation.
- Static/build validation confirms `DestinyScene` compiles, is registered, reachable from `WorldSelectScene`, and its generated `unlock/<id>` assets are bundled.
- Store/unit tests cover purchase persistence, auto-activation, affordability state, over-budget blocking, and active-subset runtime application.

## Deferred By Design

- `act-reward` remains cataloged but inert per REQ-UNLK-23.
- Dedicated run-start loadout screen remains out of scope; activation lives in Destiny.
