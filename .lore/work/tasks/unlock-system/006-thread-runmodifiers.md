---
title: Thread RunModifiers from createGame through GameplaySession
date: 2026-06-15
status: complete
tags: [task, unlocks, core-engine, game-runtime]
source: .lore/work/plans/unlock-system.md
sequence: 6
modules: [core-engine, game-runtime]
---

# Thread RunModifiers from createGame through GameplaySession

The safe, additive half of the Phase 6 work — done before the runtime-relocation task (007) so the seam exists and a no-behavior-change checkpoint is verified first.

## What

- **`src/core/engine/game.ts` `createGame`**: add optional `runModifiers?: RunModifiers`; forward to `createWorld(catalog, world, seed, runModifiers)`.
- **`src/game/runtime/gameplaySession.ts`**: add `readonly runModifiers?: RunModifiers` to `GameplaySessionOptions`; pass `options.runModifiers` into `createGame` (≈ line 85).

This is purely additive: an omitted `runModifiers` defaults to `DEFAULT_RUN_MODIFIERS` at the `createWorld` boundary, so no behavior changes.

## Validation

- `bun run typecheck` + **full** `bun run test` green with **no changes to existing tests** (the new param is optional).
- Determinism preserved: a session created without `runModifiers` produces the same state/events as before this task.

## Why

REQ-UNLK-22. Establishes the `runModifiers` flow `createGameplaySession → createGame → createWorld` that task 007 feeds the activated subset into. Split out as a no-behavior-change checkpoint to de-risk the larger relocation.

## Files

- `src/core/engine/game.ts`, `src/game/runtime/gameplaySession.ts`
