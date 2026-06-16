---
title: UnlocksProfile persistence and store
date: 2026-06-15
status: complete
tags: [task, unlocks, persistence, store, activation]
source: .lore/work/plans/unlock-system.md
sequence: 3
modules: [unlocks, meta-progression]
---

# UnlocksProfile persistence and store

## What

Create `src/game/runtime/unlocksProfile.ts`, mirroring `featsProfile.ts`:

- `UnlocksProfile = { version: 1; purchased: readonly string[]; activated: readonly string[] }` (REQ-UNLK-9). Storage key `'shattered-worlds/unlocks/v1'`. `activated` is always a subset of `purchased`.
- `isUnlocksProfile` validator (both arrays are string arrays), `emptyUnlocksProfile()` = `{ version: 1, purchased: [], activated: [] }`, `loadUnlocksProfile` / `saveUnlocksProfile` — same try/catch + `console.warn` shape as feats (REQ-UNLK-10). **On load, drop any `activated` id not in `purchased`** (subset invariant).
- `UnlocksStore` interface: `getProfile()`, `purchase(id): 'ok' | 'already-owned' | 'insufficient-fragments'`, `setActive(id, active): 'ok' | 'not-owned' | 'over-budget'` (REQ-UNLK-11).
- `createUnlocksStore(storage, featsStore)` (runtime-imports `computeSpendableBalance`, `canActivate`, `DESTINY_BUDGET` from `data/unlocks/catalog`):
  - `purchase`: already-owned check → balance via `computeSpendableBalance(featsStore.getProfile(), profile)` → append to `purchased` + persist + `'ok'`; **also append to `activated` when `canActivate` is true** (auto-activate-if-fits).
  - `setActive(id, true)`: `'not-owned'` if unowned; **`'ok'` no-op if already active** (do not re-run the budget check, or its own weight is double-counted); `'over-budget'` if `!canActivate`; else append to `activated` + persist + `'ok'`.
  - `setActive(id, false)`: remove from `activated` + persist + `'ok'` (never budget-blocked).

Create `src/game/runtime/unlocksProfile.test.ts`.

## Validation

`unlocksProfile.test.ts` covers and passes (REQ-UNLK-25):
- Load returns empty (`purchased: []`, `activated: []`) when storage absent or key missing.
- Load discards malformed JSON.
- Load drops `activated` ids not present in `purchased`.
- `purchase`: `'already-owned'` duplicate; `'insufficient-fragments'` when balance short; `'ok'` appends + persists; auto-activates when it fits; leaves owned-but-inactive when weight would exceed budget (**V19**).
- `setActive(id, true)`: `'not-owned'` for unowned; `'over-budget'` when it would exceed `DESTINY_BUDGET` and `activated` unchanged (**V17**); `'ok'` + persists otherwise.
- **`setActive(id, true)` on an already-active id → `'ok'` and `activated` length unchanged** (proves weight isn't double-counted).
- `setActive(id, false)` deactivates, persists, never blocked.

In-memory storage stub + stub `FeatsStore` with a known earned set. Grep persistence layer: only `purchased`/`activated` data fields — no `balance`/`spend`/`spendable` keys (**V9**).

`bun run typecheck` + the new test file green.

## Why

REQ-UNLK-9, 10, 11, 25; validators V9, V17, V19. The persisted purchase + activation backend. The already-active no-op is the subtlest invariant in the system; its test is mandatory.

## Files

- `src/game/runtime/unlocksProfile.ts` (new)
- `src/game/runtime/unlocksProfile.test.ts` (new)
