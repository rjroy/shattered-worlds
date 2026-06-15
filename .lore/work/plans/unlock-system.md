---
title: "Implementation plan: unlock system (Destiny Blessings and RunModifiers)"
date: 2026-06-15
status: draft
tags: [plan, unlocks, meta-progression, run-modifiers, persistence, core-engine]
modules: [unlocks, feats, meta-progression, core-engine, game-runtime]
related:
  - .lore/work/specs/unlock-system.md
  - .lore/work/design/unlock-catalog.md
  - .lore/work/brainstorm/unlock-system.md
---

# Implementation plan: unlock system (Destiny Blessings and RunModifiers)

Implements [.lore/work/specs/unlock-system.md](../specs/unlock-system.md) (REQ-UNLK-1 … 37, including 22a/22b; validators V1 … V19). Every step below names the requirements it satisfies and ends with a validation gate. Build strictly in phase order: each phase compiles and tests green before the next begins.

## Source of truth and key decisions

- **Spec:** `unlock-system.md`. The catalog values are fixed by `unlock-catalog.md`; do not retune them here.
- **World assembly moves into the runtime** (user decision, captured in REQ-UNLK-19/21/22a/22b). `TableScene` stops calling `buildWorld`; the runtime owns it so it can apply the starter-deck override and `RunModifiers` from one place.
- **The Destiny scene ships in this plan** (Phase 7, REQ-UNLK-28..34, 37) and does **both** purchase and per-run activation. Card-grid layout, named **Destiny**, reached from `WorldSelect`, mirrors `ChronicleScene`. Owned Blessings carry an Active/Inactive toggle against a 5-point `DESTINY_BUDGET` meter; only the **activated** subset feeds the runtime. Purchases auto-activate when they fit (early game feels always-on). A dedicated run-start loadout screen is the only deferred piece.
- **Test-world injection seam (REQ-UNLK-22b):** `startSession(worldId, seed, options)` gains an optional `options.world?: { catalog, worldData }`. Production omits it (runtime assembles from the manifest + unlock deck override); `gameplayRuntime.test.ts` passes it to inject hand-built worlds. **Both paths converge** on the same "compute `runModifiers` + `appliedModifiers` from the store → `createGameplaySession`" tail — no second assembly code path.

## Verified groundwork (already confirmed against the code)

- Core lint boundary (`eslint.config.js:20-38`) forbids only `phaser` and `**/game/**`. **`core → data` is allowed**, so `core/model/types.ts` importing `RunModifiers` from `data/unlocks/types.ts` is lint-clean (V10 safe).
- `data → game` type-only imports already have precedent: `computeFragmentBalance` in `data/feats/catalog.ts` type-imports `FeatsProfile`. No runtime cycle because the import is type-only.
- `GameState` literal blast radius is contained: every core `GameState` is built by `createWorld` or forked from it via `makeState` (`src/core/tests/testFixture.ts:27`, which spreads `...base`). Setting `runModifiers` in `createWorld` propagates everywhere automatically.
- Fog Beach Party `startLight` is **4** (`src/data/worlds/fog-beach-party/cards.json:3`), not 5. Test math uses 4.
- `footballer` is registered in `STARTER_SOURCES` (`src/data/worldManifest.ts`).

---

## Phase 1 — Pure data types

<table><tr><td><b>REQ-UNLK-1, 2, 3</b></td><td>No dependencies. Pure types, zero runtime imports.</td></tr></table>

**1.1** Create `src/data/unlocks/types.ts`:
- `RunModifiers` (8 readonly numeric fields) and `DEFAULT_RUN_MODIFIERS` (all 0) — copy verbatim from REQ-UNLK-1.
- `UnlockEffect` discriminated union — verbatim from REQ-UNLK-2 (six variants: `startingStat`, `handSizeBonus`, `minResourcePerTurn`, `keywordDamageBonus`, `starterDeckOverride`, `actReward`).
- `UnlockDefinition` — verbatim from REQ-UNLK-3 (`id`, `name`, `description`, `cost`, `destinyWeight`, `effect`).

> **✅ Gate (V1):** `bun run typecheck` exits 0. No `any`/`unknown` casts. File has no runtime imports.

---

## Phase 2 — Catalog and fragment economy

<table><tr><td><b>REQ-UNLK-5, 6, 7, 8, 12, 23, 24, 36</b></td><td>Depends on Phase 1 + type-only imports of `UnlocksProfile` (Phase 3) and `FeatsProfile`.</td></tr></table>

**2.1** Create `src/data/unlocks/catalog.ts`:
- `import type { UnlocksProfile } from '../../game/runtime/unlocksProfile'` and `import type { FeatsProfile } from '../../game/runtime/featsProfile'` — **type-only** (V10). These erase at runtime, so no module cycle with Phase 3.
- `import { computeFragmentBalance, FEAT_CATALOG } from '../feats/catalog'`.
- `UNLOCK_CATALOG: readonly UnlockDefinition[]` — exactly the ten entries in the REQ-UNLK-5 table, IDs verbatim. Includes `act-reward` (`actReward`, offeredCount 3) defined but inert (REQ-UNLK-23).
- `computeUnlockSpend(profile, catalog)` (REQ-UNLK-7) — sum costs of purchased ids present in catalog; ignore unknown ids.
- `computeSpendableBalance(featsProfile, unlocksProfile)` (REQ-UNLK-8) — `computeFragmentBalance(featsProfile, FEAT_CATALOG) - computeUnlockSpend(unlocksProfile, UNLOCK_CATALOG)`, clamped to 0 with a `console.warn` on a negative result.
- `buildRunModifiers(activeIds, catalog)` (REQ-UNLK-12) — fold the **activated** ids into `RunModifiers` (caller passes `profile.activated`, not all purchased). Accumulation rules per REQ-UNLK-12: `startingStat` → add to the matching `extraStart*`; `handSizeBonus` → assign `handSizeBonusPerAct`; `minResourcePerTurn` → `max(current, floor)`; `keywordDamageBonus` → additive; `starterDeckOverride`/`actReward` → skip. Unknown ids skipped.
- `DESTINY_BUDGET = 5`, `activeWeight(activeIds, catalog)` (sum `destinyWeight`, ignore unknown), and `canActivate(def, activeIds, catalog)` (`false` if already active or `activeWeight + def.destinyWeight > DESTINY_BUDGET`) (REQ-UNLK-36). Single source of truth for the budget rule — store and scene both call it.

**2.2** Create `src/data/unlocks/catalog.test.ts` (REQ-UNLK-24): duplicate-id check; `computeUnlockSpend` (empty=0, partial sum, unknown ignored); `buildRunModifiers` (empty=`DEFAULT_RUN_MODIFIERS`, all stat unlocks accumulate, `min-energy` → `minEnergyPerTurn=2`, **active subset only**); `computeSpendableBalance` (50f earned − `extra-hp` 15f = 35, i.e. V8); `activeWeight` sum + unknown-ignored; `canActivate` fits / exceeds / already-active.

> **✅ Gate (V1, V8):** `bun run typecheck` + `bun run test src/data/unlocks/catalog.test.ts` green.

---

## Phase 3 — Persistence: UnlocksProfile and store

<table><tr><td><b>REQ-UNLK-9, 10, 11, 25</b></td><td>Mirrors <code>src/game/runtime/featsProfile.ts</code>. Depends on Phase 2 for the balance check and budget helpers.</td></tr></table>

**3.1** Create `src/game/runtime/unlocksProfile.ts`, mirroring `featsProfile.ts`:
- `UnlocksProfile = { version: 1; purchased: readonly string[]; activated: readonly string[] }` (REQ-UNLK-9). Storage key `'shattered-worlds/unlocks/v1'`.
- `isUnlocksProfile` validator (both arrays), `emptyUnlocksProfile()` = `{ version: 1, purchased: [], activated: [] }`, `loadUnlocksProfile` / `saveUnlocksProfile` — same try/catch + `console.warn` shape as feats (REQ-UNLK-10). On load, drop `activated` ids not in `purchased` (subset invariant).
- `UnlocksStore` interface: `getProfile()`, `purchase(id): 'ok' | 'already-owned' | 'insufficient-fragments'`, `setActive(id, active): 'ok' | 'not-owned' | 'over-budget'` (REQ-UNLK-11).
- `createUnlocksStore(storage, featsStore)`: `purchase` → already-owned check → balance via `computeSpendableBalance(featsStore.getProfile(), profile)` → append to `purchased` + persist + `'ok'`, **and append to `activated` when `canActivate` is true** (auto-activate-if-fits). `setActive(id,true)` → `'not-owned'` if unowned, `'ok'` no-op if already active, `'over-budget'` if `!canActivate`, else add to `activated` + persist; `setActive(id,false)` → remove from `activated` + persist (never blocked). Import `canActivate`/`DESTINY_BUDGET` at runtime from `data/unlocks/catalog`.

**3.2** Create `src/game/runtime/unlocksProfile.test.ts` (REQ-UNLK-25): load empty (`purchased:[]`,`activated:[]`) when storage absent/key missing; discard malformed JSON; load drops orphan `activated` ids; `purchase` returns `already-owned`/`insufficient-fragments`/`ok`-with-persist; `purchase` auto-activates when it fits, leaves owned-but-inactive when it would exceed budget; `setActive` covers `not-owned`/`over-budget`/`ok` and unblocked deactivation; **`setActive(id, true)` on an already-active id returns `'ok'` and leaves `activated` unchanged** (proves its own weight isn't double-counted — the subtlest invariant in the system). In-memory storage stub + stub `FeatsStore` with a known earned set.

> **✅ Gate (V1, V2, V9, V17, V19):** typecheck + both new test files green. Grep the persistence layer: only `purchased`/`activated` data fields — no `balance`/`spend`/`spendable` JSON keys (V9).

---

## Phase 4 — Core model field + createWorld + hand size

<table><tr><td><b>REQ-UNLK-4, 13, 14, 15, 26</b></td><td>Phases 4a–4c are one atomic change: adding a required <code>GameState</code> field breaks compilation until <code>createWorld</code> sets it.</td></tr></table>

**4a — Model field.** `src/core/model/types.ts`: add `readonly runModifiers: RunModifiers` to `GameState`, importing `RunModifiers` from `../../data/unlocks/types`. `readonly` is deliberate (set once, never reassigned) even though sibling fields are mutable (REQ-UNLK-4).

**4b — `WORLD_CONSTS` rename + `effectiveHandSize`.** `src/core/engine/world.ts` (REQ-UNLK-15):
- Rename `WORLD_CONSTS.maxHandSize` → `baseHandSize` (value 6). Update the `startPlayerCards` getter to `baseHandSize - startWorldCards`.
- Export `effectiveHandSize(state) = WORLD_CONSTS.baseHandSize + state.actIndex * state.runModifiers.handSizeBonusPerAct`.

**4c — `createWorld`.** `src/core/engine/world.ts` (REQ-UNLK-13, 14):
- Import `RunModifiers` and `DEFAULT_RUN_MODIFIERS` from `../../data/unlocks/types`.
- Add optional 4th param `runModifiers?: RunModifiers`; `const mods = runModifiers ?? DEFAULT_RUN_MODIFIERS`.
- Skeleton state: `hp: startHp + mods.extraStartHp`, `energy: mods.extraStartEnergy`, `light: (world.startLight ?? 0) + mods.extraStartLight`, `braceCharges: mods.extraStartBrace`, `runModifiers: mods`.

**4d — Switch call sites** (REQ-UNLK-15):
- `src/core/engine/draw.ts` `refillHand`: **two** functional refs → `effectiveHandSize(state)`:
  - `:144` `const room = WORLD_CONSTS.maxHandSize - heldWorld` → `effectiveHandSize(state) - heldWorld`. The subtracted term is `heldWorld`, **not** `hand.length` (leave the math, only swap the constant). The `if (room === 0)` early-exit guard at `:146` now fires at the *effective* hand size, so a higher-act hand with `handSizeBonusPerAct > 0` correctly leaves more world-card room — intended behavior.
  - `:171` `Math.max(0, WORLD_CONSTS.maxHandSize - current.hand.length)` → `Math.max(0, effectiveHandSize(state) - current.hand.length)`. Use `state`, not `current`: `actIndex`/`runModifiers` are unchanged by the draw loop, and the target hand size is fixed at turn start.
  - Update the formula doc-comment (`:126,132,135`) to read `effectiveHandSize(state)` **and** correct the pre-existing error where `:132`/`:135` say `room = ... - hand.length`; the code subtracts `heldWorld`, so the comment should too.
- `src/core/engine/intensity.ts:17`: `WORLD_CONSTS.maxHandSize` → `WORLD_CONSTS.baseHandSize` (normalization denominator — must **not** use `effectiveHandSize`).
- `src/game/view/HelpOverlayView.ts:420`: rename to `baseHandSize` (display only).
- `src/core/tests/draw.test.ts`: rename all `maxHandSize` → `baseHandSize`.

**4e — Tests.** Extend `src/core/tests/world.test.ts` (REQ-UNLK-26): `extraStartHp:5 → hp 15`; `extraStartEnergy:1 → energy 2` (skeleton 1 + opening startTurn +1); `extraStartLight:2` on Fog (`startLight 4`) → skeleton 6, minus one decay = **5**; `extraStartBrace:2 → braceCharges 2`; `effectiveHandSize` returns `baseHandSize + actIndex*bonus`. Confirm `makeState` (testFixture) still compiles unchanged (inherits `runModifiers` from `createWorld`).

> **✅ Gate (V1, V3, V4, V11, V12):** typecheck + full `bun run test` green. Grep: `maxHandSize` absent from `src/core/**` and `src/data/**` (V12, comments excepted). Determinism test (golden) passes with `RunModifiers` threaded (V11).

---

## Phase 5 — Engine effects (light floor, energy floor, keyword bonus)

<table><tr><td><b>REQ-UNLK-16, 17, 18, 27</b></td><td>Each reads <code>state.runModifiers</code>; no signature changes. Default (0) values preserve current behavior byte-for-byte.</td></tr></table>

**5.1** `src/core/engine/energy.ts` `decayLight` (REQ-UNLK-16): replace the `if (state.light <= 0) return` early-return with the floor-aware form from the spec — early-return only when `light <= 0 && floor === 0`; otherwise `newLight = max(max(0, light - LIGHT_DECAY), floor)`; emit `LightChanged` iff `light !== newLight`. Confirm the floor-0 path stays byte-identical for non-Fog (light 0) and Fog-decay cases.

**5.2** `src/core/engine/energy.ts` `gainEnergy` (REQ-UNLK-17): the **one-argument turn-start** `gainEnergy(state): EffectResult` (the one that adds 1 unconditionally) only — `newEnergy = max(state.energy + 1, state.runModifiers.minEnergyPerTurn)`. **Do not touch** the card-effect `gainEnergy(state, n)` in `src/core/effects/resources.ts`.

**5.3** `src/core/effects/dealProgress.ts` `dealProgress` (REQ-UNLK-18): when the bonus tag matches, `bonus.amount + state.runModifiers.keywordDamageBonus`; non-matching hazards get nothing. `DealProgressAll` inherits automatically (same helper).

**5.4** Tests (REQ-UNLK-27), in `energy`/`reduce`/`dealProgress` test files: light floor holds at 1 / floor-0 unchanged (V5); energy floor 0→2 and 3→4-not-triggered (V6); keyword bonus matching → +1, non-matching → none (V7).

> **✅ Gate (V5, V6, V7):** typecheck + full `bun run test` green. No pre-existing test regresses (the floor-0 / default-0 cases prove behavior preservation).

---

## Phase 6 — Runtime wiring + buildWorld relocation

<table><tr><td><b>REQ-UNLK-19, 20, 21, 22, 22a, 22b</b></td><td>Largest blast radius. Threads <code>runModifiers</code> end to end and moves assembly into the runtime.</td></tr></table>

**6.1 — Thread `runModifiers` through the core/session boundary** (REQ-UNLK-22):
- `src/core/engine/game.ts` `createGame`: add optional `runModifiers?: RunModifiers`; forward to `createWorld(catalog, world, seed, runModifiers)`.
- `src/game/runtime/gameplaySession.ts`: add `readonly runModifiers?: RunModifiers` to `GameplaySessionOptions`; pass `options.runModifiers` into `createGame` at line ~85.

**6.2 — Runtime owns assembly** `src/game/runtime/gameplayRuntime.ts` (REQ-UNLK-19, 20, 21, 22b):
- Import `buildWorld` (from `data/worldManifest`), `UNLOCK_CATALOG` + `buildRunModifiers` (from `data/unlocks/catalog`), `createUnlocksStore` + `UnlocksStore` (from `unlocksProfile`).
- `createUnlocksStore(options.storage, featsStore)`; add `unlocksStore: UnlocksStore` to the `GameplayRuntime` interface and the returned object.
- Private `resolveStarterDeckId(activeIds, catalog)`: first `starterDeckOverride.starterDeckId` among the **activated** ids, else `undefined`.
- Add `world?: AssembledWorld` to **`RuntimeSessionOptions`** (the `Omit<GameplaySessionOptions, …>` type in this file) as the test seam (REQ-UNLK-22b). Reuse the existing `AssembledWorld` type (`{ catalog, worldData }`, exported from `core/model/catalog`, returned by `buildWorld`) — do not define a parallel inline shape. Strip it before forwarding to `createGameplaySession` so the session layer never sees it.
- Change `startSession(catalog, world, seed, options)` → **`startSession(worldId, seed, options)`**. Body:
  1. `activeIds = unlocksStore.getProfile().activated` (only the equipped subset applies — REQ-UNLK-19/20)
  2. `const { catalog, worldData } = options.world ?? buildWorld(worldId, resolveStarterDeckId(activeIds, UNLOCK_CATALOG) ?? 'starter')`
  3. `runModifiers = buildRunModifiers(activeIds, UNLOCK_CATALOG)`
  4. `appliedModifiers = activeIds.map(id => ({ kind: 'unlock', id }))` (REQ-UNLK-20)
  5. `createGameplaySession(catalog, worldData, seed, { ...rest, runModifiers, appliedModifiers, stream, clock })`
  - Both branches of step 2 feed the identical step 3–5 tail — single session-creation path.

**6.3 — Scene** `src/game/scenes/TableScene.ts` (REQ-UNLK-22a):
- Replace `buildWorld(...)` + `startSession(catalog, worldData, this.seed_)` (≈ lines 157–159) with `this.runtime_.startSession(this.worldId_, this.seed_)`. Remove the now-unused `buildWorld` import.
- `starterId_` becomes vestigial. **Remove it** (REQ-UNLK-22a: do not leave dead state): delete the `starterId_` private field, the `starterId?` key from the `init` data type, and the `this.starterId_ = data.starterId ?? "starter"` line. The unlock `starterDeckOverride` drives the deck; no debug path is in scope. `WorldSelectScene.ts:396` (`scene.launch("Table", { worldId, seed, starterId: "starter" })`) should drop the now-ignored `starterId` key.

**6.4 — Update tests** (REQ-UNLK-22a, 22b):
- `src/game/runtime/gameplayRuntime.test.ts` (exactly 12 `startSession` sites): `startSession(catalog, worldData, seed, opts)` → `startSession(worldId, seed, { world: { catalog, worldData }, ...opts })`. Pass a `worldId` that **matches `worldData.worldId`** of the injected world (e.g. `'runtime-win-world'` for the `winWorldData` test at line 182) so the recorded `state.worldId` and event stream stay consistent — the seam bypasses `worldManifest`, so the id is only a label here, but a mismatched one produces confusing stream assertions. Coverage (lifecycle, win/abandon, multi-session correlation) preserved, not weakened.
- `src/game/tests/gameplaySessionIntegration.test.ts:152`: replace the source-string assertion with exactly `expect(source).toContain('this.game_ = this.runtime_.startSession(this.worldId_, this.seed_)')`. Also scan this test for any other source-text assertions referencing the removed `buildWorld` import or the old `const { catalog, worldData } = buildWorld(...)` lines and update them too.
- `src/game/scenes/WorldSelectScene.ts:141`: unchanged (display act-count only).
- Add a runtime test (or extend `gameplayRuntime.test.ts`) for **V18**: with a stubbed `unlocksStore` whose profile has `extra-hp` activated and `extra-energy` purchased-but-inactive, the started session's `state.runModifiers.extraStartHp === 3`, `extraStartEnergy === 0`, and `appliedModifiers` lists only `extra-hp`.

> **✅ Gate (V1, V2, V10, V18):** typecheck + **full** `bun run test` green (all suites). `bun run lint` exits 0 — this enforces the **core** boundary (`eslint.config.js` restricts only `src/core/**`). The **data** boundary is convention, not lint: grep `src/data/unlocks/` and confirm the only `game`-layer imports are the two `import type` lines in `catalog.ts` (V10).

---

## Phase 7 — Destiny scene (meta unlock purchase + activation UI)

<table><tr><td><b>REQ-UNLK-28 … 34, 37</b></td><td>The screen that makes the system reachable: buy Blessings and equip them within the budget. Mirrors <code>ChronicleScene</code>. Depends on Phase 3 (<code>UnlocksStore</code>) and Phase 6 (<code>unlocksStore</code> exposed on the runtime).</td></tr></table>

**7.1 — Pure state helper.** Create `src/game/view/unlockShop.ts`: `unlockCardState(def, purchased, balance): 'owned' | 'affordable' | 'unaffordable'` (REQ-UNLK-32) — owned if `def.id ∈ purchased`; else affordable if `def.cost ≤ balance`; else unaffordable. (The budget/activation rule lives in `data/unlocks/catalog`'s `canActivate`, REQ-UNLK-36 — the scene imports it, does not re-derive it.) Plus `src/game/view/unlockShop.test.ts` (REQ-UNLK-35): owned-even-if-unaffordable, affordable, unaffordable, and the `cost === balance` boundary (affordable).

**7.2 — Scene.** Create `src/game/scenes/DestinyScene.ts`, scene key `'Destiny'`, constructor `(featsStore: FeatsStore, unlocksStore: UnlocksStore)` (REQ-UNLK-28). Reuse the `ChronicleScene` idioms (dark bg `0x0d0a12`, gold `#d6b15c`, `addPanel`/`createButton`/confirm-overlay, `textStyle`/`TEXT`, 900×600):
- **Header** (REQ-UNLK-30): `✦ {computeSpendableBalance(...)} Fragments` **and** the Destiny budget meter `Destiny {pips} {activeWeight}/{DESTINY_BUDGET}` (filled/empty dots). Both re-derived every render and after every purchase or toggle.
- **Card grid** (REQ-UNLK-31): two columns over `UNLOCK_CATALOG`; per card — art slot (`scene.textures.exists('unlock/' + id)` ? image : placeholder rect), name, `destinyWeight` pips, effect + `description`, `✦ cost`, a purchase-state control and (when owned) an activation toggle. Wheel + arrow scroll when rows overflow (mirror the Chronicle worlds-scroll).
- **Purchase-state control** (REQ-UNLK-32): `unlockCardState` → `✓ owned` badge / interactive `Buy` / dimmed cost.
- **Activation toggle** (REQ-UNLK-37): owned cards show `◉ ACTIVE` / `◯ inactive`; click → `unlocksStore.setActive(id, !active)` → re-render. When inactive and `canActivate(def, activated, UNLOCK_CATALOG)` is false, render the toggle dimmed/non-interactive (can't exceed budget). Deactivation always allowed.
- **Purchase** (REQ-UNLK-33): `Buy` → confirm overlay naming the Blessing + cost → `unlocksStore.purchase(id)`; `'ok'` re-renders + brief confirmation (auto-activated card shows ACTIVE), error results surface in a message line (never swallowed).
- **Nav** (REQ-UNLK-29): `Back` button + `ESC` → `scene.start('WorldSelect')`.

**7.3 — Navigation entry.** `src/game/scenes/WorldSelectScene.ts`: add a `Destiny` button mirroring `createChronicleButton` → `this.scene.start('Destiny')`.

**7.4 — Composition root.** `src/game/main.ts`: add `new DestinyScene(gameplayRuntime.featsStore, gameplayRuntime.unlocksStore)` to the `scene` array (after `ChronicleScene`). Relies on `unlocksStore` exposed in Phase 6.

**7.5 — Optional art preload.** `src/game/scenes/BootScene.ts`: optionally attempt to preload `unlock/<id>` images if present (REQ-UNLK-34). Absence is the expected MVP state — the scene placeholders handle it. Skip if no art exists yet.

**7.6 — Wiring test.** Add two source-string assertions to the **existing** `src/game/tests/gameplaySessionIntegration.test.ts` (alongside its current "boots the app" / "WorldSelect wires Chronicle" cases — do not create a new file): `main.ts` constructs `DestinyScene` with both stores, and `WorldSelectScene` starts the `'Destiny'` scene (REQ-UNLK-35).

> **✅ Gate (V1, V2, V16; V13–V15, V17 manual):** typecheck + full `bun run test` green (incl. `unlockShop.test.ts`, V16). Manual browser pass: Destiny reachable from WorldSelect; balance + budget meter correct; Buy → confirm → Owned + balance drop, auto-activated when it fits; toggle ACTIVE/inactive updates the meter; toggling past 5 weight is blocked (V17); persists across reload (V13, V14, V15). Use `/run` or `/verify` for the manual gate.

---

## Phase 8 — Final validation sweep

<table><tr><td><b>V1 … V19</b></td><td>Whole-spec compliance gate before declaring done.</td></tr></table>

**8.1** Run the full gate: `bun run typecheck` (V1), `bun run test` (V2, V16, V17, V18, V19), `bun run lint` (V10). All exit 0.

**8.2** Manual confirmations: V9 grep (no balance/spend JSON keys); V12 grep (`maxHandSize` gone from `src/core/**`, `src/data/**`); spot-check V3–V8 assertions exist in the named test files; browser pass for V13–V15, V17 (Destiny scene reachable, purchase end-to-end, affordability gating, budget block).

**8.3** Spec-compliance review: walk REQ-UNLK-1 … 37 and tick each against the implementation. Note deferred-by-design items (`act-reward` inert per REQ-UNLK-23; dedicated run-start loadout screen out of scope; real card art separate). Flag any requirement that could not be satisfied as written.

> **✅ Final gate:** every validator V1–V19 passes (V13–V15, V17 confirmed in-browser); every REQ-UNLK requirement is implemented or explicitly deferred with a reason.

---

## Out of scope (do not build here)

A dedicated run-start loadout screen in the launch flow (activation lives in the Destiny scene), `Fortune`/`act-reward` engine wiring (`choosingActReward` status + `ChooseActCard` action), fragment-balance display in scenes other than Destiny and the run-end summary, unlock prerequisite/tier logic, and final Blessing-card art. All carried in the spec's "Open items (deferred)."
