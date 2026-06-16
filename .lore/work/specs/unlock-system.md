---
title: Unlock system — Destiny Blessings and RunModifiers
date: 2026-06-15
status: draft
tags: [meta-progression, unlocks, destiny-weight, memory-fragments, run-modifiers, game-state, persistence]
modules: [unlocks, feats, meta-progression, core-engine, game-runtime]
related:
  - .lore/work/design/unlock-catalog.md
  - .lore/work/brainstorm/unlock-system.md
  - .lore/work/specs/feat-definitions.md
  - .lore/work/specs/extended-run-telemetry.md
req-prefix: UNLK
---

# Unlock system — Destiny Blessings and RunModifiers

## Context

The feat system (spec: `feat-definitions.md`) established Memory Fragments as a global earned currency. This spec builds the spend side: a purchasable unlock catalog, a persistence layer for what the player has bought, a `RunModifiers` bag that carries active-unlock effects into the core engine, and the engine hooks each effect type requires.

The design doc (`unlock-catalog.md`) fixed the ten catalog entries, their costs in fragments, their per-run Destiny Weights, and which engine hook each one requires. This spec converts those decisions into numbered requirements.

**MVP scope:** This spec includes the **Destiny scene** — both *purchasing* unlocks (spend Fragments to own) and *activating* them per run (toggle owned Blessings within a 5-point Destiny Weight budget). Only the **activated** subset applies to a run. Purchases auto-activate when they fit the budget, so the early game feels always-on and choices only emerge once owned weight exceeds 5. A separate Hades-style run-start loadout screen is the only piece left deferred.

## Scope

**In scope:**
- `UnlockDefinition`, `UnlockEffect` types and `UNLOCK_CATALOG`
- `UnlocksProfile` persistence (load, save, purchase, `computeUnlockSpend`)
- `RunModifiers` type on `GameState`
- `createWorld` accepting and applying `RunModifiers` for stat-offset, hand-size, and initial-state effects
- `decayLight` modification for `minLightPerTurn`
- `gainEnergy` modification for `minEnergyPerTurn`
- `dealProgress` modification for `keywordDamageBonus`
- Relocating the `buildWorld` call from `TableScene` into the runtime, and `starterDeckOverride` wiring through it at session creation
- `SetupModifier[]` stamping in `RunStarted` for active unlocks
- `computeFragmentBalance` minus `computeUnlockSpend` = spendable balance (no stored balance)
- `actIndex`-aware `maxHandSize` derivation for `handSizeBonus`
- `DestinyScene` — the meta unlock UI (a card-grid shop), reachable from `WorldSelect`: purchase Blessings, and toggle which owned Blessings are active for runs within the 5-point budget
- Per-run activation: `activated` loadout on `UnlocksProfile`, `DESTINY_BUDGET` + `activeWeight`/`canActivate`, `setActive`, and the runtime applying only the active subset

**Out of scope:**
- A dedicated run-start loadout screen in the launch flow (activation lives in the Destiny scene instead)
- `Fortune` (`act-reward` effect type) engine wiring — the type is defined but the `choosingActReward` state and `ChooseActCard` action are deferred
- Fragment balance display in scenes other than the run-end summary and the new Destiny scene
- Unlock prerequisites / tier ordering logic
- Final art for the Blessing cards (the scene renders placeholders; art is generated separately and dropped in against the `unlock/<id>` texture keys)

---

## File layout and the core/game boundary

`src/core/` is lint-forbidden from importing anything in `src/game/`. The unlock split follows the same pattern as feats:

| File | Layer | Contents |
|---|---|---|
| `src/data/unlocks/types.ts` | data | `UnlockDefinition`, `UnlockEffect`, `RunModifiers` (pure types) |
| `src/data/unlocks/catalog.ts` | data | `UNLOCK_CATALOG`, `computeUnlockSpend` (type-imports `UnlocksProfile` from game layer) |
| `src/game/runtime/unlocksProfile.ts` | game | `UnlocksProfile`, load/save/purchase, `createUnlocksStore` |
| `src/game/runtime/gameplayRuntime.ts` | game | wires `unlocksStore`, owns world assembly (calls `buildWorld`), translates purchased unlocks → `RunModifiers` + starter-deck id at session creation |
| `src/game/scenes/DestinyScene.ts` | game | the meta unlock purchase UI; reads `computeSpendableBalance`, renders `UNLOCK_CATALOG` as a card grid, calls `unlocksStore.purchase` |
| `src/game/view/unlockShop.ts` | game | pure helper `unlockCardState` (owned / affordable / unaffordable) — testable without Phaser |

`RunModifiers` is a pure-data type that lives in `src/data/unlocks/types.ts` and is imported into `src/core/model/types.ts` (added to `GameState`). This is the only change to core model — the core engine reads the bag without knowing anything about the unlock system.

---

## Requirements

### Type definitions

**REQ-UNLK-1:** Define `RunModifiers` in `src/data/unlocks/types.ts`:

```typescript
export type RunModifiers = {
  readonly extraStartHp: number          // default 0
  readonly extraStartEnergy: number      // default 0
  readonly extraStartLight: number       // default 0
  readonly extraStartBrace: number       // default 0
  readonly handSizeBonusPerAct: number   // default 0; added once per completed act
  readonly minLightPerTurn: number       // default 0; light decay floor
  readonly minEnergyPerTurn: number      // default 0; energy floor after turn-start gain
  readonly keywordDamageBonus: number    // default 0; added to every keyword bonus amount
}

export const DEFAULT_RUN_MODIFIERS: RunModifiers = {
  extraStartHp: 0,
  extraStartEnergy: 0,
  extraStartLight: 0,
  extraStartBrace: 0,
  handSizeBonusPerAct: 0,
  minLightPerTurn: 0,
  minEnergyPerTurn: 0,
  keywordDamageBonus: 0,
}
```

**REQ-UNLK-2:** Define `UnlockEffect` as a discriminated union in `src/data/unlocks/types.ts`:

```typescript
export type UnlockEffect =
  | { readonly type: 'startingStat'; readonly stat: 'hp' | 'energy' | 'light' | 'brace'; readonly amount: number }
  | { readonly type: 'handSizeBonus'; readonly amountPerAct: number }
  | { readonly type: 'minResourcePerTurn'; readonly resource: 'energy' | 'light'; readonly floor: number }
  | { readonly type: 'keywordDamageBonus'; readonly amount: number }
  | { readonly type: 'starterDeckOverride'; readonly starterDeckId: string }
  | { readonly type: 'actReward'; readonly offeredCount: number }
```

No variant outside this union may be added to the catalog without revising this type first.

**REQ-UNLK-3:** Define `UnlockDefinition` in `src/data/unlocks/types.ts`:

```typescript
export type UnlockDefinition = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly cost: number           // Memory Fragments
  readonly destinyWeight: number  // 1–3; reserved for per-run activation budget
  readonly effect: UnlockEffect
}
```

**REQ-UNLK-4:** Add `runModifiers: RunModifiers` to `GameState` in `src/core/model/types.ts`. Declare the field `readonly` even though the surrounding `GameState` fields are mutable — it is set once in `createWorld` and never reassigned, and `readonly` documents that contract. Default value (when no unlocks are active) is `DEFAULT_RUN_MODIFIERS`. The core engine reads this field; it never writes it after initialization.

---

### Unlock catalog

**REQ-UNLK-5:** Define `UNLOCK_CATALOG` in `src/data/unlocks/catalog.ts` containing exactly the following ten entries. IDs are stable — never rename them:

| id | name | cost | destinyWeight | effect |
|---|---|---|---|---|
| `extra-hp` | Tough Hide | 15 | 1 | `startingStat` hp +3 |
| `extra-energy` | Charged | 20 | 1 | `startingStat` energy +1 |
| `extra-light` | Fog Lantern | 20 | 1 | `startingStat` light +2 |
| `extra-brace` | Braced | 20 | 1 | `startingStat` brace +2 |
| `hand-size-per-act` | Adaptable | 35 | 2 | `handSizeBonus` amountPerAct 1 |
| `keyword-bonus` | Sharpened Instincts | 30 | 2 | `keywordDamageBonus` amount 1 |
| `min-light` | Fog Signal | 35 | 2 | `minResourcePerTurn` light floor 1 |
| `min-energy` | Steady Pulse | 40 | 2 | `minResourcePerTurn` energy floor 2 |
| `starter-footballer` | Athlete's Instinct | 50 | 3 | `starterDeckOverride` starterDeckId `'footballer'` |
| `act-reward` | Fortune | 70 | 3 | `actReward` offeredCount 3 |

**REQ-UNLK-6:** `UNLOCK_CATALOG` must have no duplicate `id` values. A catalog test must verify this at import time.

**REQ-UNLK-7:** Define `computeUnlockSpend(profile: UnlocksProfile, catalog: readonly UnlockDefinition[]): number` in `src/data/unlocks/catalog.ts`. It returns the total fragment cost of all purchased unlock IDs that exist in the catalog. IDs in `profile.purchased` that are not in the catalog are silently ignored (same pattern as `computeFragmentBalance`). `UnlocksProfile` is type-imported from the game layer — a type-only cross-layer import following the same approved precedent as `computeFragmentBalance` importing `FeatsProfile`.

---

### Fragment economy

**REQ-UNLK-8:** Define `computeSpendableBalance(featsProfile: FeatsProfile, unlocksProfile: UnlocksProfile): number` in `src/data/unlocks/catalog.ts`:

```
spendableBalance = computeFragmentBalance(featsProfile, FEAT_CATALOG)
                 - computeUnlockSpend(unlocksProfile, UNLOCK_CATALOG)
```

The balance is derived on every read; it is never stored. Negative balances cannot occur because the purchase gate (REQ-UNLK-11) prevents spending beyond the available balance. If a stale profile somehow produces a negative result, return 0 (clamp, log a warning). `FeatsProfile` is type-imported from `src/game/runtime/featsProfile.ts` — a type-only cross-layer import, same as REQ-UNLK-7. Both imports must be type-only to satisfy the lint boundary (V10).

---

### Persistence — `UnlocksProfile`

**REQ-UNLK-9:** Define `UnlocksProfile` in `src/game/runtime/unlocksProfile.ts`:

```typescript
export type UnlocksProfile = {
  readonly version: 1
  readonly purchased: readonly string[]   // unlock ids the player owns
  readonly activated: readonly string[]    // owned ids currently equipped for runs (⊆ purchased)
}
```

Storage key: `'shattered-worlds/unlocks/v1'`. `activated` is the per-run loadout (REQ-UNLK-36). It is always a subset of `purchased`; the store enforces that invariant. The profile is new in this spec, so both fields ship in `version: 1` with no migration.

**REQ-UNLK-10:** Implement `loadUnlocksProfile` and `saveUnlocksProfile` following the same pattern as `loadFeatsProfile` / `saveFeatsProfile` in `featsProfile.ts`: parse JSON, validate shape (both `purchased` and `activated` are string arrays), return an empty profile (`{ version: 1, purchased: [], activated: [] }`) on parse failure or missing key. On load, drop any `activated` id not present in `purchased` (defensive: keeps the subset invariant if storage was hand-edited).

**REQ-UNLK-11:** Define `UnlocksStore` interface and `createUnlocksStore` factory:

```typescript
export interface UnlocksStore {
  getProfile(): UnlocksProfile
  purchase(id: string): 'ok' | 'already-owned' | 'insufficient-fragments'
  setActive(id: string, active: boolean): 'ok' | 'not-owned' | 'over-budget'
}
```

`purchase` must:
1. Return `'already-owned'` if `id` is already in `profile.purchased`.
2. Compute the spendable balance (requires `FeatsProfile` from the `FeatsStore`); return `'insufficient-fragments'` if the unlock's cost exceeds the balance.
3. Otherwise append `id` to `purchased`, persist, and return `'ok'`. **Auto-activate if it fits:** if `activeWeight(activated) + def.destinyWeight ≤ DESTINY_BUDGET`, also append `id` to `activated`. This makes the early game feel always-on (cheap unlocks all fit) and only forces choices once the active weight would exceed the budget (REQ-UNLK-36).

`setActive` must:
1. Return `'not-owned'` if `id` is not in `profile.purchased`.
2. When `active === true`: if `id` is **already** in `activated`, return `'ok'` (no-op — don't re-run the budget check, or its own weight is double-counted). Otherwise return `'over-budget'` when `canActivate(def, activated, UNLOCK_CATALOG)` is `false`; else append `id` to `activated`, persist, return `'ok'`.
3. When `active === false`: remove `id` from `activated` (idempotent), persist, return `'ok'`. Deactivation is never budget-blocked.

`createUnlocksStore` takes `storage: RunStatsStorage | undefined` and a reference to the `FeatsStore` (for balance checking).

---

### `RunModifiers` construction

**REQ-UNLK-12:** Define `buildRunModifiers(activeIds: readonly string[], catalog: readonly UnlockDefinition[]): RunModifiers` in `src/data/unlocks/catalog.ts`. The caller passes the **activated** ids (REQ-UNLK-36), not all purchased — only equipped unlocks affect a run. It folds over `activeIds`, looks up each id in the catalog, and accumulates modifier values:

- `startingStat hp` → adds `amount` to `extraStartHp`
- `startingStat energy` → adds `amount` to `extraStartEnergy`
- `startingStat light` → adds `amount` to `extraStartLight`
- `startingStat brace` → adds `amount` to `extraStartBrace`
- `handSizeBonus` → sets `handSizeBonusPerAct` to `amountPerAct` (direct assignment, not additive — unlocks are unique, so at most one such id can be active)
- `minResourcePerTurn energy` → sets `minEnergyPerTurn` to `max(current, floor)`
- `minResourcePerTurn light` → sets `minLightPerTurn` to `max(current, floor)`
- `keywordDamageBonus` → adds `amount` to `keywordDamageBonus`
- `starterDeckOverride`, `actReward` → no effect on `RunModifiers` (handled elsewhere)

IDs not found in the catalog are skipped.

---

### Destiny budget (per-run activation)

**REQ-UNLK-36:** Define the activation budget primitives in `src/data/unlocks/catalog.ts`:

```typescript
export const DESTINY_BUDGET = 5

export function activeWeight(activeIds: readonly string[], catalog: readonly UnlockDefinition[]): number
export function canActivate(def: UnlockDefinition, activeIds: readonly string[], catalog: readonly UnlockDefinition[]): boolean
```

- `activeWeight` sums `destinyWeight` over the active ids that exist in the catalog (unknown ids contribute 0).
- `canActivate` returns `true` iff `def.id` is **not** already active and `activeWeight(activeIds) + def.destinyWeight ≤ DESTINY_BUDGET`. It is the single source of truth for the budget rule — the store's `setActive` guard (REQ-UNLK-11) and the scene's toggle gating (REQ-UNLK-37) both call it; do not re-derive the rule in two places.

These are pure functions, no game-layer import.

### Engine integration — `createWorld`

**REQ-UNLK-13:** `createWorld` in `src/core/engine/world.ts` must accept an optional `runModifiers: RunModifiers` parameter. When `undefined`, use `DEFAULT_RUN_MODIFIERS`. The signature becomes:

```typescript
export function createWorld(
  catalog: CardCatalog,
  world: WorldData,
  seed: number,
  runModifiers?: RunModifiers,
): CreateWorldResult
```

The resolved value (`runModifiers ?? DEFAULT_RUN_MODIFIERS`) is used everywhere inside the function.

**REQ-UNLK-14:** In the skeleton state built inside `createWorld`, apply the resolved modifiers to initial values before the first `mintAll` call. `GameState.runModifiers` is a required field (REQ-UNLK-4), so `DEFAULT_RUN_MODIFIERS` must always be stored even when the caller passes no modifiers:

- `hp: WORLD_CONSTS.startHp + mods.extraStartHp`
- `energy: mods.extraStartEnergy` (was always 0; the opening `startTurn` adds +1 on top)
- `light: (world.startLight ?? 0) + mods.extraStartLight`
- `braceCharges: mods.extraStartBrace`
- `runModifiers: mods` (the full bag, stored for all subsequent engine reads)

where `mods = runModifiers ?? DEFAULT_RUN_MODIFIERS`.

**REQ-UNLK-15:** `WORLD_CONSTS.maxHandSize` must be renamed to `WORLD_CONSTS.baseHandSize` (same value: 6). Define and export `effectiveHandSize` in `src/core/engine/world.ts` alongside `WORLD_CONSTS`:

```typescript
export function effectiveHandSize(state: GameState): number {
  return WORLD_CONSTS.baseHandSize
    + state.actIndex * state.runModifiers.handSizeBonusPerAct
}
```

**Call sites that must switch to `effectiveHandSize(state)`:**
- `refillHand` in `src/core/engine/draw.ts` — the only draw-target function, but it references `WORLD_CONSTS.maxHandSize` in **two** functional spots, both of which must switch to `effectiveHandSize(state)`:
  - the `room` calculation (`draw.ts:144`: `const room = WORLD_CONSTS.maxHandSize - heldWorld`)
  - the `playerToDraw` calculation (`draw.ts:171`: `Math.max(0, WORLD_CONSTS.maxHandSize - current.hand.length)`)
  - The doc-comment references in the `refillHand` header (`draw.ts:126`, `132`, `135`) describe the formula and must be updated to read `effectiveHandSize(state)` for accuracy.

**Call sites that must use `WORLD_CONSTS.baseHandSize` (not `effectiveHandSize`):**
- `intensity.ts` — uses `maxHandSize` as a normalization denominator, not a draw target. Changing to `effectiveHandSize` would corrupt intensity calculations. Replace with `WORLD_CONSTS.baseHandSize` only.
- The `startPlayerCards` getter inside `WORLD_CONSTS` itself (`return WORLD_CONSTS.maxHandSize - WORLD_CONSTS.startWorldCards`) — rename the reference to `WORLD_CONSTS.baseHandSize`.

**Call sites requiring a mechanical update only (name change, not behavior change):**
- `src/game/view/HelpOverlayView.ts` — references `WORLD_CONSTS.maxHandSize` for display purposes. Update the property name; behavior is unchanged.
- `src/core/tests/draw.test.ts` — update all `WORLD_CONSTS.maxHandSize` references to `WORLD_CONSTS.baseHandSize`.

No other file may compute hand size independently; all draw-target logic must go through `effectiveHandSize`.

---

### Engine integration — `decayLight`

**REQ-UNLK-16:** Modify `decayLight` (private function, `src/core/engine/energy.ts`) to apply the light floor. The existing implementation has an early-return guard `if (state.light <= 0) return { state, events: [] }` that would skip the floor when light is already at 0 — causing V5 to fail. This guard must be revised so the floor can still raise light from 0 to `minLightPerTurn`.

Replace the current early-return with a check that also considers the floor:

```typescript
function decayLight(state: GameState): EffectResult {
  const floor = state.runModifiers.minLightPerTurn
  if (state.light <= 0 && floor === 0) {
    return { state, events: [] }
  }
  const decayed = Math.max(0, state.light - LIGHT_DECAY)
  const newLight = Math.max(decayed, floor)
  if (state.light === newLight) {
    return { state, events: [] }
  }
  return {
    state: { ...state, light: newLight },
    events: [{ type: 'LightChanged', light: newLight }],
  }
}
```

The `LightChanged` event fires whenever `state.light !== newLight` — this handles both the decay case and the case where the floor raises light from 0 to `minLightPerTurn`. Non-Fog worlds always have `light === 0` and `minLightPerTurn === 0` (default), so they still hit the fast path and emit nothing.

---

### Engine integration — `gainEnergy`

**REQ-UNLK-17:** In the turn-start `gainEnergy` (`src/core/engine/energy.ts`, the zero-argument `gainEnergy(state)` — **not** the card-effect `gainEnergy(state, n)` in `src/core/effects/resources.ts`), after `state.energy + 1`, apply the energy floor:

```typescript
const gained = state.energy + 1
const newEnergy = Math.max(gained, state.runModifiers.minEnergyPerTurn)
```

The `EnergyChanged` event carries `newEnergy`. Existing callers are unaffected — this `gainEnergy` is only called from `startTurn`. The card-effect `gainEnergy` in `resources.ts` (the `GainEnergy` handler) must **not** receive the floor: it models a card's printed energy gain, where the floor does not apply.

---

### Engine integration — `dealProgress`

**REQ-UNLK-18:** In `dealProgress` (`src/core/effects/dealProgress.ts`), when computing `bonusAmount`, add `state.runModifiers.keywordDamageBonus` to the bonus when the tag check passes:

```typescript
const bonusAmount = bonus !== undefined && hasKeyword(hazard, bonus.tag)
  ? bonus.amount + state.runModifiers.keywordDamageBonus
  : 0
```

The bonus is only boosted when the tag actually matches. A hazard without the keyword receives no bonus regardless of `keywordDamageBonus`. `DealProgressAll` uses the same `dealProgress` helper, so it is boosted automatically.

---

### Starter deck override

**REQ-UNLK-19:** World assembly moves into the runtime (see REQ-UNLK-21 for the full signature change). `startSession` resolves the active starter deck from the unlocks profile, then assembles the world. If the **activated** unlocks include a `starterDeckOverride` effect, its `starterDeckId` is passed as the `starterId` argument to `buildWorld`; otherwise `'starter'` is used:

```typescript
const deckId = resolveStarterDeckId(activeIds, UNLOCK_CATALOG) ?? 'starter'
const { catalog, worldData } = buildWorld(worldId, deckId)
```

`resolveStarterDeckId(activeIds, catalog)` is a private helper in `gameplayRuntime.ts`. It returns the `starterDeckId` of the first `starterDeckOverride` effect found among the **activated** unlock ids (at most one can be active; the catalog has only one), or `undefined` when none is active.

No changes to the internals of `createWorld`, `buildWorld`, or `worldManifest.ts` are required — `buildWorld` already resolves the deck via `STARTER_SOURCES`. The only structural change is **relocating the `buildWorld` call from `TableScene` into the runtime** so the runtime can apply the deck override and `RunModifiers` from a single owner. `'footballer'` is confirmed present in `STARTER_SOURCES` (`src/data/worlds/starters/footballer.json`).

---

### SetupModifier stamping

**REQ-UNLK-20:** The `appliedModifiers: readonly SetupModifier[]` field in `RunStarted` and `RunRecord` (already present; no schema change) must be populated with one entry per **activated** unlock (the set that actually applied to this run, not everything owned):

```typescript
{ kind: 'unlock', id: 'extra-hp' }
{ kind: 'unlock', id: 'keyword-bonus' }
// etc.
```

The `gameplayRuntime` constructs this list from the activated unlock ids before creating the session. This is chronicle data only — downstream consumers must not derive gameplay behavior from `appliedModifiers`; they read `GameState.runModifiers` instead.

---

### Runtime wiring

**REQ-UNLK-21:** `createGameplayRuntime` in `gameplayRuntime.ts` must:

1. Call `createUnlocksStore(storage, featsStore)` alongside the existing `createFeatsStore` call.
2. Expose `unlocksStore: UnlocksStore` on the `GameplayRuntime` interface.
3. Take over world assembly. `startSession` changes from `startSession(catalog, world, seed, options)` to `startSession(worldId, seed, options)`. Internally it now:
   a. reads `activeIds = unlocksStore.getProfile().activated`,
   b. resolves the starter deck id and calls `buildWorld(worldId, deckId)` (REQ-UNLK-19),
   c. computes `runModifiers = buildRunModifiers(activeIds, UNLOCK_CATALOG)`,
   d. constructs `appliedModifiers` from `activeIds` (REQ-UNLK-20),
   e. calls `createGameplaySession(catalog, worldData, seed, { ...options, runModifiers, appliedModifiers, stream, clock })`.

**REQ-UNLK-22:** The `runModifiers` value must flow through the full call chain: `startSession` → `createGameplaySession` → `createGame` → `createWorld`.

`GameplaySessionOptions` (in `gameplaySession.ts`) must gain an optional field:

```typescript
export interface GameplaySessionOptions {
  // ... existing fields ...
  readonly runModifiers?: RunModifiers
}
```

`createGameplaySession` passes `options.runModifiers` to `createGame`. `createGame` (in `src/core/engine/game.ts`) accepts and forwards it to `createWorld`:

```typescript
export function createGame(
  catalog: CardCatalog,
  world: WorldData,
  seed: number,
  runModifiers?: RunModifiers,
): GameCore
```

All three boundaries receive the optional parameter; callers that omit it get `DEFAULT_RUN_MODIFIERS` at the `createWorld` boundary. No other `GameCore` interface changes are required.

**REQ-UNLK-22a — `startSession` signature change blast radius.** Moving world assembly into the runtime changes `startSession` from `(catalog, world, seed, …)` to `(worldId, seed, …)`. The following must be updated as part of this spec:

- `src/game/scenes/TableScene.ts` — replace the `buildWorld(...)` call plus `startSession(catalog, worldData, this.seed_)` (line ~157–159) with `startSession(this.worldId_, this.seed_)`; remove the now-unused `buildWorld` import. The scene's `starterId_` field (init data, currently only ever `"starter"` from `WorldSelectScene.ts:396`) becomes vestigial for session creation once the runtime resolves the deck from unlocks. The plan must either drop it or repurpose it as an explicit debug override with a stated precedence rule (default: the unlock `starterDeckOverride` wins; an explicit non-`"starter"` init value is out of scope for MVP). Do not leave dead state on the scene.
- `src/game/tests/gameplaySessionIntegration.test.ts:152` — the source-string assertion (`this.game_ = this.runtime_.startSession(catalog, worldData, this.seed_)`) must be updated to the new call form.
- `src/game/scenes/WorldSelectScene.ts:141` — uses `buildWorld` only to read a display act-count, not to create a session. It stays unchanged.

**REQ-UNLK-22b — test-world injection seam.** `src/game/runtime/gameplayRuntime.test.ts` currently injects hand-built `worldData` (including a world that wins immediately) directly into `startSession` across ~12 call sites. Once the runtime assembles the world from a `worldId`, those tests can no longer inject a custom world through the production path. The runtime must therefore retain a way to start a session from a caller-supplied assembled `WorldData` for tests. The exact mechanism (an optional `assembledWorld` field on the runtime options, a separate lower-level entry point, or registering the test worlds in a test manifest) is a plan-phase decision, but the spec requires that the existing `gameplayRuntime.test.ts` coverage (run lifecycle, win/abandon, multi-session correlation) is preserved without weakening it. Avoid two divergent assembly code paths — the test seam must funnel into the same session-creation logic as production.

---

### `actReward` deferral

**REQ-UNLK-23:** The `actReward` effect type must exist in the `UnlockEffect` union and in `UNLOCK_CATALOG` (REQ-UNLK-5), but no engine behavior is implemented for it in this spec. `buildRunModifiers` silently skips it. When `act-reward` is in the purchased list, it has no effect on any run — the player may purchase it without seeing its effect until the follow-up spec.

---

### Destiny scene — the meta unlock purchase UI

This is where Memory Fragments are spent. Without it the rest of the system is unreachable, so it ships in this spec. It mirrors `ChronicleScene` in structure: a Phaser scene constructed at the `main.ts` composition root with its stores injected, navigated by scene key from the `WorldSelect` hub, using the shared `textStyle` / `TEXT` palette and the existing button and confirm-overlay patterns. Canvas is 900×600 (`CANVAS_W`/`CANVAS_H`).

**REQ-UNLK-28 — Scene and wiring.** Add `src/game/scenes/DestinyScene.ts` with scene key `'Destiny'`. Its constructor takes `featsStore: FeatsStore` and `unlocksStore: UnlocksStore` (same injection pattern as `ChronicleScene`). Register it in the `main.ts` scene array as `new DestinyScene(gameplayRuntime.featsStore, gameplayRuntime.unlocksStore)`. This depends on `unlocksStore` being exposed on `GameplayRuntime` (REQ-UNLK-21).

**REQ-UNLK-29 — Navigation.** `WorldSelectScene` gains a "Destiny" button alongside the existing Chronicle button (mirror `createChronicleButton`) that calls `this.scene.start('Destiny')`. `DestinyScene` provides a `Back` button and an `ESC` key handler, both `this.scene.start('WorldSelect')`.

**REQ-UNLK-30 — Header (balance + Destiny budget).** The header shows two readouts, re-derived on every render and after every purchase or toggle (never stored, never cached):
- the spendable balance from `computeSpendableBalance(featsStore.getProfile(), unlocksStore.getProfile())`, rendered as `✦ {n} Fragments`;
- the Destiny budget meter: `Destiny {pips} {used}/{DESTINY_BUDGET}` where `used = activeWeight(profile.activated, UNLOCK_CATALOG)` and `pips` is `used` filled dots over `DESTINY_BUDGET - used` empty dots (e.g. `●●●○○ 3/5`).

**REQ-UNLK-31 — Card grid.** Render `UNLOCK_CATALOG` (in catalog order) as a two-column grid of Blessing cards. Each card shows:
- an art slot: `scene.add.image(x, y, 'unlock/' + def.id)` **only if** `scene.textures.exists('unlock/' + def.id)`, otherwise a neutral placeholder rectangle (missing art must never throw or block the scene);
- the `name`;
- weight pips: `def.destinyWeight` filled dots (informational — REQ-UNLK out-of-scope keeps it non-interactive);
- the effect summary and the `description` flavor line;
- the cost as `✦ {def.cost}`;
- a purchase-state control (REQ-UNLK-32) and, when owned, an activation toggle (REQ-UNLK-37).

When entries exceed the visible rows, support scrolling via mouse wheel and up/down arrows, mirroring `ChronicleScene`'s worlds-list scroll.

**REQ-UNLK-32 — Per-card purchase state.** Derive each card's purchase state per render from `(def, purchased, balance)` via a pure helper `unlockCardState(def, purchased, balance)` in `src/game/view/unlockShop.ts` returning `'owned' | 'affordable' | 'unaffordable'`:
- `'owned'` — `def.id ∈ purchased` → render a `✓ owned` badge plus the activation toggle (REQ-UNLK-37); no buy control.
- `'affordable'` — not owned and `def.cost ≤ balance` → render an interactive `Buy` button.
- `'unaffordable'` — not owned and `def.cost > balance` → render the cost dimmed with no interactive control.

**REQ-UNLK-33 — Purchase flow.** A `Buy` click opens a confirm overlay (mirror `ChronicleScene`'s confirm overlay) naming the Blessing and its cost, since spending Fragments is permanent and irreversible. On confirm, call `unlocksStore.purchase(def.id)` and handle the result:
- `'ok'` → re-render the whole scene (balance drops, the card flips to `Owned`, other cards may flip to `unaffordable`); show a brief confirmation line.
- `'already-owned'` / `'insufficient-fragments'` → show the reason in a message line. These shouldn't be reachable through the gated UI, but the store contract returns them and the scene must surface rather than swallow them.

**REQ-UNLK-34 — Art is optional placeholder.** No `iconKey` lives on `UnlockDefinition`; the texture key is derived as `'unlock/' + id` at render time. `BootScene` may attempt to preload `unlock/<id>` images when present, but their absence is the expected MVP state and the scene renders placeholders in that case. Generating and dropping in the real art is a separate task that touches no catalog or scene logic.

**REQ-UNLK-37 — Activation toggle.** Every **owned** card shows an Active/Inactive toggle reflecting whether `def.id ∈ profile.activated`:
- Active → `◉ ACTIVE`; clicking calls `unlocksStore.setActive(def.id, false)` and re-renders.
- Inactive → `◯ inactive`; clicking calls `unlocksStore.setActive(def.id, true)` and re-renders.
- Gating: when inactive and `canActivate(def, profile.activated, UNLOCK_CATALOG)` is `false` (would exceed `DESTINY_BUDGET`), render the toggle non-interactive/dimmed so the player can't push past 5. The scene calls `canActivate` for this — it does not re-implement the budget math (REQ-UNLK-36). Toggling off is always allowed.

A purchase that auto-activates (REQ-UNLK-11) lands as Active after the buy re-render. Unowned cards show no toggle.

---

### Tests

**REQ-UNLK-24:** `src/data/unlocks/catalog.test.ts` must cover:

- `UNLOCK_CATALOG` has no duplicate ids
- `computeUnlockSpend` returns 0 for an empty profile; returns the sum of matching costs for a partial profile; ignores unknown ids
- `buildRunModifiers` with no purchased unlocks returns `DEFAULT_RUN_MODIFIERS`
- `buildRunModifiers` with all stat unlocks accumulates correctly
- `buildRunModifiers` with `min-energy` sets `minEnergyPerTurn` to 2
- `computeSpendableBalance` with a feats profile earning 50 fragments and an unlocks profile with `extra-hp` purchased (15f) returns 35
- `activeWeight` sums `destinyWeight` over active ids and ignores unknown ids
- `canActivate` returns `true` when the addition fits the budget, `false` when it would exceed `DESTINY_BUDGET`, and `false` when the id is already active
- `buildRunModifiers` applied to a subset (e.g. only `extra-hp` active while `extra-energy` is owned-but-inactive) reflects only the active subset

**REQ-UNLK-25:** `src/game/runtime/unlocksProfile.test.ts` must cover:

- Load returns empty profile (`purchased: []`, `activated: []`) when storage is absent or key is missing
- Load discards malformed JSON and returns empty
- Load drops `activated` ids not present in `purchased` (subset invariant)
- `purchase` returns `'already-owned'` for a duplicate id
- `purchase` returns `'insufficient-fragments'` when balance is insufficient
- `purchase` appends the id and persists when valid, and **auto-activates** it when it fits the budget
- `purchase` of an unlock whose weight would exceed the remaining budget leaves it owned-but-inactive
- `setActive(id, true)` returns `'not-owned'` for an unowned id, `'over-budget'` when it would exceed `DESTINY_BUDGET`, and `'ok'` (persisted) otherwise
- `setActive(id, false)` deactivates and persists, and is never budget-blocked

**REQ-UNLK-26:** `src/core/engine/world.test.ts` (or equivalent) must cover:

- `createWorld` with `extraStartHp: 5` produces `state.hp === 15`
- `createWorld` with `extraStartEnergy: 1` produces `state.energy === 2` in the returned `CreateWorldResult` (the skeleton sets energy to 1, then the opening `startTurn` adds +1, yielding 2)
- `createWorld` with `extraStartLight: 2` on the Fog world (Fog Beach Party `startLight: 4`, per `src/data/worlds/fog-beach-party/cards.json`) produces a skeleton `light === 6`, minus one decay from the opening `startTurn` = `state.light === 5`
- `createWorld` with `extraStartBrace: 2` produces `braceCharges === 2`
- `effectiveHandSize` returns `baseHandSize + actIndex * bonus`

**REQ-UNLK-27:** Engine effect tests must cover:

- `decayLight` with `minLightPerTurn: 1` never decays light below 1
- `decayLight` with `minLightPerTurn: 0` (default) behaves identically to the current implementation
- `gainEnergy` with `minEnergyPerTurn: 2` and `state.energy === 0` produces `energy === 2`
- `gainEnergy` with `minEnergyPerTurn: 2` and `state.energy === 3` produces `energy === 4` (floor not triggered when above)
- `dealProgress` with `keywordDamageBonus: 1` and a matching keyword hazard applies `bonus.amount + 1`
- `dealProgress` with `keywordDamageBonus: 1` and a non-matching hazard applies no bonus (as before)

**REQ-UNLK-35:** `src/game/view/unlockShop.test.ts` must cover the pure `unlockCardState(def, purchased, balance)` helper:

- `'owned'` when `def.id` is in `purchased` (even if also unaffordable)
- `'affordable'` when not owned and `def.cost ≤ balance`
- `'unaffordable'` when not owned and `def.cost > balance`
- boundary: `def.cost === balance` is `'affordable'`

Scene rendering itself (Phaser) is verified manually (V13, V14). A lightweight wiring test must assert `main.ts` constructs `DestinyScene` with both stores and that `WorldSelectScene` starts the `'Destiny'` scene (source-string assertion, mirroring `gameplaySessionIntegration.test.ts`).

---

## AI Validation

After implementation, the following must all pass before this spec is considered complete:

**V1 — Type safety:** `bun run typecheck` exits 0. No `any` or `unknown` casts introduced in the new files.

**V2 — Unit tests:** `bun run test` exits 0. All tests in REQ-UNLK-24 through REQ-UNLK-27 and REQ-UNLK-35 exist and pass. No pre-existing tests regress.

**V3 — Stat offsets apply:** In a test using `createWorld` with `extraStartHp: 5`, the returned `state.hp` equals 15. Verified by REQ-UNLK-26 tests.

**V4 — Hand size scales:** After `drawWorld` exhausts act 0 and advances to `actIndex === 1`, `effectiveHandSize(state)` returns 7 when `handSizeBonusPerAct === 1`. Verified by REQ-UNLK-26.

**V5 — Light floor holds:** After 10 consecutive `startTurn` calls on a Fog world state with starting light 4 (Fog Beach Party's actual `startLight`) and `minLightPerTurn: 1`, `state.light === 1` (not 0). Verified by REQ-UNLK-27.

**V6 — Energy floor holds:** With `minEnergyPerTurn: 2` and starting `energy === 0`, after `startTurn`, `state.energy === 2`. Verified by REQ-UNLK-27.

**V7 — Keyword bonus applies:** In a test with `keywordDamageBonus: 1`, playing Explore (base 1, bonus +1 vs Hidden) against a Hidden hazard deals 3 progress instead of 2. Against a non-Hidden hazard: 1 progress (no bonus). Verified by REQ-UNLK-27.

**V8 — Balance derivation:** Given a `FeatsProfile` that earns 50 fragments and an `UnlocksProfile` that has purchased `extra-hp` (15f), `computeSpendableBalance` returns 35. Verified by a test in REQ-UNLK-24.

**V9 — No stored balance:** `UnlocksProfile` shape in storage contains no balance or spend fields. Grep confirms `spendable` and `balance` do not appear as JSON keys in the persistence layer.

**V10 — Lint boundary:** `bun run lint` exits 0. No import of `src/game/**` from `src/core/**` or `src/data/**`, except for the two approved type-only imports in `src/data/unlocks/catalog.ts` (`UnlocksProfile` from `unlocksProfile.ts` and `FeatsProfile` from `featsProfile.ts`), which follow the same precedent as `computeFragmentBalance` in `src/data/feats/catalog.ts`.

**V11 — Determinism:** Two calls to `createWorld` with the same seed and the same `RunModifiers` produce byte-identical initial states. Verified by an existing determinism test with the new modifiers parameter passed.

**V12 — `maxHandSize` fully renamed:** Grep confirms `maxHandSize` does not appear in any file under `src/core/` or `src/data/` after implementation. The only permitted residual is comments explaining the rename.

**V13 — Destiny scene reachable (manual):** From `WorldSelect`, the Destiny button opens the scene; it renders the ten Blessing cards with the live Fragment balance in the header; `Back` and `ESC` return to `WorldSelect`.

**V14 — Purchase works end to end (manual):** With a balance ≥ an unlock's cost, `Buy` → confirm → the card flips to `✓ Owned`, the header balance drops by the cost, and reloading the page (re-entering the scene) still shows the unlock owned (persisted under `'shattered-worlds/unlocks/v1'`). Because the purchase auto-activates when it fits the budget (REQ-UNLK-11), starting a run afterward applies the unlock's `RunModifiers`.

**V15 — Affordability gating (manual + unit):** An unlock whose cost exceeds the balance renders with no `Buy` control; an owned unlock renders `✓ Owned`. The `unlockCardState` branches are unit-verified by REQ-UNLK-35.

**V16 — State helper unit test:** `bun run test src/game/view/unlockShop.test.ts` passes all `unlockCardState` cases in REQ-UNLK-35.

**V17 — Budget enforced:** `setActive(id, true)` returns `'over-budget'` and does not mutate `activated` when `activeWeight + def.destinyWeight > 5`. Verified by REQ-UNLK-25. Manual: the scene's toggle for such a card is non-interactive.

**V18 — Only the active subset applies:** With `extra-hp` owned-and-active and `extra-energy` owned-but-inactive, a session started through the runtime has `state.runModifiers.extraStartHp === 3` and `extraStartEnergy === 0`, and `appliedModifiers` lists only `extra-hp`. Verified by a runtime/`buildRunModifiers` test (REQ-UNLK-24, 25).

**V19 — Auto-activate-if-fits:** Purchasing into an empty loadout leaves the new unlock active; purchasing a 3-weight unlock when 3 weight is already active leaves the new one owned-but-inactive. Verified by REQ-UNLK-25.

---

## Open items (deferred)

- **Fortune (`act-reward`) engine wiring:** Requires `status: 'choosingActReward'` on `GameState`, a `ChooseActCard` action type, and a new scene component. Deferred to a follow-up spec. The Destiny scene lets the player buy `Fortune`, but it has no run effect yet (REQ-UNLK-23) — a follow-up should communicate "pending" in the card UI.
- **Dedicated run-start loadout screen:** Activation lives in the Destiny scene (toggles + budget meter). A separate Hades-style "equip before this run" screen in the launch flow is a possible later refinement, not built here.
- **Blessing card art:** The scene renders placeholders against `unlock/<id>` texture keys; generating and dropping in the real art is a separate task.
- **`computeSpendableBalance` exposure:** Where to surface the balance in existing scenes (ChronicleScene, RunSummaryView) is a UI spec concern, not addressed here.
- **Test-world injection mechanism (REQ-UNLK-22b):** The runtime must keep a single seam for starting a session from a caller-supplied assembled `WorldData` so `gameplayRuntime.test.ts` retains its custom-world coverage after `startSession` switches to a `worldId` argument. Choosing the exact shape of that seam is left to the plan phase.
