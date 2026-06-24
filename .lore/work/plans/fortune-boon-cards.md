---
title: "Implementation plan: Fortune boon cards"
date: 2026-06-17
status: draft
tags: [plan, fortune, boon-cards, unlocks, act-rewards, core-engine]
modules: [data-unlocks, core-engine, game-runtime, card-data, table-ui]
related:
  - .lore/work/specs/fortune-boon-cards.md
  - .lore/work/specs/unlock-system.md
  - .lore/work/design/unlock-catalog.md
  - .lore/reference/destiny-progression.html
---

# Implementation plan: Fortune boon cards

Implements [.lore/work/specs/fortune-boon-cards.md](../specs/fortune-boon-cards.md), especially REQ-FORTUNE-1 through REQ-FORTUNE-34. Build in phase order. Each phase ends with a validation gate; do not proceed while the gate is red.

## Source of truth and decisions

- **Spec:** `.lore/work/specs/fortune-boon-cards.md`.
- **Unlock identity stays stable:** `act-reward` remains `Fortune`; only its config, description, cost/weight, and behavior change.
- **Balance decision:** restore the unlock design values from `.lore/work/design/unlock-catalog.md`: `cost: 70`, `destinyWeight: 3`. The current implementation has `7000/6`, which makes activation impossible under the `DESTINY_BUDGET = 5` rule.
- **Pending-choice representation:** keep `GameState.status === "playing"` and add a separate `pendingActBoon` field. This is less disruptive than adding a fourth status, but requires explicit reducer and `availableActions` gates.
- **Boon art:** v1 uses existing/generic inset art or no inset. Missing assets must not crash card rendering.
- **If new art enters scope:** use the `imagegen` skill, and match the existing basic-card inset direction: sepia-toned, hand-drawn graphic-novel ink, weathered paper texture, restrained contrast, practical survival-object framing, and the same worn apocalyptic tone as the starter/basic card art.
- **Run modifier carries the concrete pool list:** `RunModifiers.actBoon` stores `poolId`, `poolTemplateIds`, `offeredCount`, and `chooseCount`. The reducer receives all data it needs through state and does not import or hard-code the Fortune pool.
- **Offer state stores template IDs, not minted cards.** Minting happens only after the player chooses, so rejected/unchosen options do not consume `nextId`.
- **UI gets catalog access through the gameplay session.** `GameCore`/`GameplaySession` should expose a readonly template lookup helper or catalog snapshot so `TableScene` can render offered template IDs without minting cards.

## Verified code map

- `src/data/unlocks/catalog.ts` defines `UNLOCK_CATALOG`, `DESTINY_BUDGET`, and `buildRunModifiers`; `actReward` is currently skipped.
- `src/data/unlocks/types.ts` defines `RunModifiers` and `UnlockEffect`.
- `src/game/runtime/gameplayRuntime.ts` reads activated unlock IDs, builds `RunModifiers`, and passes them through `createGameplaySession`.
- `src/core/model/types.ts` owns `Action`, `GameState`, and `GameEvent`.
- `src/core/engine/draw.ts` emits `ActAdvanced` when `drawWorld` advances to a queued act.
- `src/core/engine/reduce.ts` calls `startTurn` during `EndTurn`, then performs post-refill loss checks. Fortune must create the pending choice after `ActAdvanced` exists in that dispatch result and before those loss checks.
- `src/data/worldManifest.ts` assembles every world catalog from `BASIC_SOURCE` plus the selected world. A global Fortune boon source must be added to that assembled catalog for every world.
- `src/game/scenes/TableScene.ts` owns table interaction and can render a dedicated overlay; `ModalChooserView` is label-based and should not be stretched into card-face boon selection.

## Phase 1 - Unlock config and run modifier shape

<table><tr><td><b>REQ-FORTUNE-1, 2, 3, 4, 33, 34</b></td><td>Pure unlock-data changes. Establishes the core-readable modifier before any reducer work.</td></tr></table>

1. Update `src/data/unlocks/types.ts`.
   - Add an act-boon modifier field to `RunModifiers`, for example:
     `readonly actBoon: { readonly poolId: string; readonly poolTemplateIds: readonly CardTemplateId[]; readonly offeredCount: number; readonly chooseCount: 1 } | null`.
   - If importing `CardTemplateId` into `src/data/unlocks/types.ts` would create an undesirable data-to-core dependency, use `readonly string[]` for `poolTemplateIds` and keep the field name explicit.
   - Add `actBoon: null` to `DEFAULT_RUN_MODIFIERS`.
   - Expand `UnlockEffect` `actReward` from only `offeredCount` to include `boonPoolId`, `offeredCount`, and `chooseCount`.

2. Create the initial pool manifest `src/data/worlds/boons/fortune.ts`.
   - Export `FORTUNE_BOON_POOLS` with `pool-fortune` mapped to the planned five template IDs.
   - At this phase, the file may export only pool IDs. Phase 2 adds the matching JSON source and `FORTUNE_BOON_SOURCE`.
   - This keeps `buildRunModifiers` able to resolve `poolTemplateIds` without importing core reducer code or waiting for world assembly changes.

3. Update `src/data/unlocks/catalog.ts`.
   - Change `act-reward` description to implemented Fortune copy: choose 1 of 3 temporary boon cards at the start of each new act.
   - Set `cost: 70`, `destinyWeight: 3`.
   - Set `effect: { type: "actReward", boonPoolId: "pool-fortune", offeredCount: 3, chooseCount: 1 }`.
   - Import `FORTUNE_BOON_POOLS` from the manifest created above.
   - In `buildRunModifiers`, translate active `actReward` into `mods.actBoon` with `poolId`, `poolTemplateIds`, `offeredCount`, and `chooseCount` instead of skipping it. Throw or fail tests if the configured `boonPoolId` has no manifest entry.

4. Update `src/game/scenes/DestinyScene.ts`.
   - Update `effectSummary` for `actReward` to use `chooseCount` and `offeredCount` rather than the old generic text.
   - Ensure no Fortune scene copy includes `NotImplemented`.

5. Update tests.
   - Extend `src/data/unlocks/catalog.test.ts` to assert Fortune is legal under `DESTINY_BUDGET`, has stable id/name, builds the `actBoon` modifier only when active, and no longer contains `NotImplemented`.
   - Assert `mods.actBoon.poolTemplateIds` equals the `pool-fortune` pool manifest and contains at least five IDs.
   - Extend runtime unlock tests if needed so activated `act-reward` survives into `GameState.runModifiers.actBoon`.

> **Validation gate:** `bun run typecheck` and `bun run test src/data/unlocks/catalog.test.ts src/game/runtime/gameplayRuntime.test.ts` pass. Manually grep `rg "NotImplemented|act-reward" src/data/unlocks src/game/scenes/DestinyScene.ts` and confirm the obsolete description is gone.

## Phase 2 - Boon-only card data and global pool assembly

<table><tr><td><b>REQ-FORTUNE-16, 17, 18, 19, 20, 21, 22, 29</b></td><td>Adds the templates Fortune can offer without leaking them into normal decks or world loot.</td></tr></table>

1. Add a global boon source, for example `src/data/worlds/boons/fortune.json`.
   - Use `RawCardSource` shape with `worldId: "fortune-boons"` and only `cardTemplates`.
   - Do not include `starterDeck` or `deckComposition`.
   - Author at least five player templates, all `exhaust: true`, all cost 0, all world-agnostic:
     - `Lucky Break`: `Heal 2`
     - `Second Wind`: `GainEnergy 2`
     - `Found Tool`: `DealProgress 2`
     - `Clear Path`: `ReturnWorldCards` with `min: 0`, `max: 2`
     - `Steady Nerve`: `Sequence` of `Brace 1` and `GainLight 1`, or another modest defensive equivalent.
   - Use existing inset keys or omit `insetKey`; do not add new art in this implementation. If that constraint changes, stop and use the `imagegen` skill with the basic-card style note above before adding raster assets.

2. Extend the typed pool manifest created in Phase 1.
   - Export `FORTUNE_BOON_SOURCE` by importing/casting the new JSON source.
   - Keep `FORTUNE_BOON_POOLS.pool-fortune` synchronized with the five JSON template IDs.
   - Keep pool metadata in data and feed it into `RunModifiers.actBoon.poolTemplateIds` from `buildRunModifiers`; do not import this manifest from `src/core/engine/reduce.ts`.

3. Update `src/data/worldManifest.ts`.
   - Import the boon source and include it in every catalog assembly: `assembleCatalog([BASIC_SOURCE, FORTUNE_BOON_SOURCE, worldSource])`.
   - Preserve `assembleCatalog` duplicate-template checking.
   - Do not add boon templates to any starter deck, act composition, or world hazard reward effect.

4. Add or extend tests.
   - `src/core/tests/worldManifest.test.ts`: every `buildWorld(worldId, starter)` catalog contains every `pool-fortune` boon template.
   - Add a leak test that scans starter decks, act compositions, and world-authored `AddCard`/`GainCard`/`AddPlayerCardToTop` effects and verifies Fortune boon template IDs are not referenced outside the boon pool.
   - Verify every boon template is a player card with `exhaust: true`.
   - Add a recursive effect validator for each boon template, walking `Sequence` and `Modal` branches. Reject forbidden first-version shapes: `SurviveWorld`, `AddWorldCardToDeck`, `AddThreatToWorldDeck`, `AddCard`/`GainCard`/`AddPlayerCardToTop` for `Door` or `The Walker`, `ExileTopWorldCards`, and any effect that adds additional world cards.

> **Validation gate:** `bun run typecheck` and `bun run test src/core/tests/worldManifest.test.ts src/core/tests/worldRegistry.test.ts src/core/tests/catalog.test.ts` pass. The pool contains at least five legal, distinct templates, every assembled world can mint them, and recursive effect validation enforces the REQ-FORTUNE-21 forbidden-effect list.

## Phase 3 - Core pending choice model, events, action gates, and template lookup

<table><tr><td><b>REQ-FORTUNE-5, 6, 7, 8, 9, 13, 14, 15, 25, 26, 27, 28</b></td><td>Adds the engine state machine but not the trigger implementation yet.</td></tr></table>

1. Update `src/core/model/types.ts`.
   - Add `ActBoonChoice`, for example:
     `type ActBoonChoice = { readonly act: number; readonly poolId: string; readonly offeredTemplateIds: readonly CardTemplateId[]; readonly chooseCount: 1 }`.
   - Add `pendingActBoon: ActBoonChoice | null` to `GameState`.
   - Add `Action` variant `{ type: "ChooseActBoon"; templateId: CardTemplateId }`. Use template ID rather than index so invalid/reordered UI submissions are unambiguous.
   - Add `GameEvent` variants:
     - `{ type: "ActBoonOffered"; act: number; templateIds: readonly CardTemplateId[] }`
     - `{ type: "BoonCardGranted"; cardId: CardId; templateId: CardTemplateId }`

2. Update `src/core/engine/game.ts` and `src/game/runtime/gameplaySession.ts` to expose readonly card-template lookup for UI.
   - Add a `template(templateId: CardTemplateId): CardTemplate | undefined` method or readonly `catalog` snapshot to `GameCore`.
   - Thread that method through `GameplaySession`.
   - Prefer a method over exposing mutable catalog objects; if returning templates, treat them as read-only and do not mutate them in view code.
   - This is required so `TableScene` can render `pendingActBoon.offeredTemplateIds` without minting cards and consuming `nextId`.

3. Update `src/core/engine/world.ts`.
   - Initialize `pendingActBoon: null` in `createWorld`.

4. Update `src/core/engine/available.ts`.
   - If `state.pendingActBoon !== null`, return no playable cards, no discardable hazards, `canEndTurn: false`, and `legalTargets` returning `[]`.
   - This keeps UI/sim availability aligned with reducer legality.

5. Update `src/core/engine/reduce.ts`.
   - At the top of `reduce`, after terminal-status rejection:
     - If `pendingActBoon !== null`, reject `PlayCard`, `DiscardHazard`, and `EndTurn` with `IllegalActionError`.
     - Allow only `ChooseActBoon`.
   - Add `handleChooseActBoon(catalog, state, action)`:
     - Require `state.pendingActBoon !== null`.
     - Require `action.templateId` is included in `offeredTemplateIds`.
     - Mint with `mintCard(catalog, state, action.templateId)`.
     - Require the minted card is `kind: "player"` and `exhaust === true`; otherwise throw an illegal/action authoring error consistent with existing reducer discipline.
     - Append the card directly to `hand`, clear `pendingActBoon`, preserve all normal draw/refill results, and emit `BoonCardGranted`.

6. Add tests in `src/core/tests/reduce.test.ts`, `src/core/tests/available.test.ts`, and gameplay session/core tests.
   - Pending choice blocks `PlayCard`, `DiscardHazard`, and `EndTurn`.
   - `availableActions` exposes no ordinary gameplay actions while pending.
   - Valid `ChooseActBoon` clears pending, grants a player exhaust card into hand, can exceed effective hand size, and emits `BoonCardGranted`.
   - Invalid template IDs and non-offered template IDs are rejected without mutating state.
   - `GameplaySession.template(id)` or the chosen catalog lookup path returns boon templates for offered IDs and `undefined` for unknown IDs.

> **Validation gate:** `bun run typecheck` and `bun run test src/core/tests/reduce.test.ts src/core/tests/available.test.ts` pass. A pending choice is observable in state but normal gameplay cannot proceed until it is resolved.

## Phase 4 - Deterministic offer generation on real act advancement

<table><tr><td><b>REQ-FORTUNE-5, 6, 7, 8, 9, 10, 11, 12, 23, 24, 25, 28</b></td><td>Hooks Fortune into the act-transition path and deterministic RNG stream.</td></tr></table>

1. Add a core helper for offer creation, for example `src/core/engine/actBoon.ts`.
   - Inputs: `catalog`, `state`, `actBoon` from `state.runModifiers`, and `act`.
   - Filter legal templates to player cards with `exhaust: true`.
   - Deterministically shuffle the full legal template ID list using the existing `shuffle` and `state.rng` on every trigger, even when the legal pool has fewer than `offeredCount` templates.
   - If at least `offeredCount` legal templates exist, take the first `offeredCount` shuffled distinct IDs.
   - If fewer legal templates exist, offer every legal template without duplicates.
   - Always thread the advanced RNG back into state. This satisfies REQ-FORTUNE-24 even in the fallback branch.
   - Return next state plus `ActBoonOffered`.

2. Use only `state.runModifiers.actBoon.poolTemplateIds` for pool contents.
   - `src/core/engine/reduce.ts` must not import `FORTUNE_BOON_POOLS` and must not inline the Fortune template list.
   - `poolId` remains in state/events for observability/debuggability, while `poolTemplateIds` is the actual core input.

3. Hook `handleEndTurn` in `src/core/engine/reduce.ts`.
   - After `startTurn(stateAfterDiscard)`, inspect that dispatch's events for `ActAdvanced`.
   - If the run is still `playing`, `state.runModifiers.actBoon !== null`, and an `ActAdvanced` event occurred, create exactly one pending Fortune choice for that transition.
   - Use the act value from the `ActAdvanced` event.
   - Approved divergence, 2026-06-17: if one refill emits multiple `ActAdvanced` events, Fortune still creates at most one pending choice for that reducer dispatch and uses the first `ActAdvanced.act` in the event batch.
   - Append `ActBoonOffered` to the same event array as the `ActAdvanced` dispatch result.
   - Do this before the post-refill loss guards. If `pendingActBoon` is created, return that pending state immediately or explicitly skip/defer both post-refill loss guards until after `ChooseActBoon` resolves. Do not allow the existing `playerCardsDrawn === 0` guard to mark the run lost while a Fortune choice is pending.
   - Do not trigger during `createWorld` opening deal because no `EndTurn`/real `ActAdvanced` dispatch occurred there.
   - Do not trigger if `current.status` has become `won` or `lost` before the offer point.

4. Add deterministic reducer tests.
   - Fortune inactive: act advancement produces no pending choice and no `ActBoonOffered`.
   - Fortune active: advancing from Act 1 to Act 2 creates one pending choice and emits `ActBoonOffered` in the same event batch as `ActAdvanced`.
   - Opening deal never creates a pending choice.
   - Multiple act transitions over a run create one pending choice per real `ActAdvanced`, no duplicates.
   - Post-terminal states never trigger offers.
   - Same seed/world/starter/active unlocks/action sequence produces the same offered template IDs in the same order.
   - Different seed smoke test can produce different offers while staying within `pool-fortune`.
   - RNG advances on every trigger, including a test-only pool with fewer than 3 legal templates.
   - A focused REQ-FORTUNE-12 rescue test: construct an act transition where `playerCardsDrawn === 0`; with Fortune inactive the run loses under the existing guard, and with Fortune active the reducer returns `playing` with `pendingActBoon` instead of `lost`.

> **Validation gate:** `bun run typecheck` and focused core tests pass. The active Fortune case creates pending state before loss checks, emits `ActBoonOffered` with `ActAdvanced`, and deterministic replay is stable.

## Phase 5 - Runtime event stream compatibility

<table><tr><td><b>REQ-FORTUNE-25, 26, 27, 28</b></td><td>Core already emits events through gameplay batches; this phase proves the stream surface is correct.</td></tr></table>

1. Update any type guards/tests around `GameEvent` snapshots if new event variants require fixtures to be expanded.

2. Add or extend `src/game/runtime/gameplaySession.test.ts`.
   - Dispatch the act-advancing `EndTurn` with Fortune active and assert the emitted `GameplayBatch` contains both `ActAdvanced` and `ActBoonOffered`.
   - Dispatch `ChooseActBoon` and assert the later batch contains `BoonCardGranted`.
   - Confirm `CardGained` is not emitted for the direct-to-hand boon grant.

3. Add a `gameplayRuntime` test if Phase 1 did not already cover it.
   - Activated `act-reward` appears in `appliedModifiers` and creates `runModifiers.actBoon`.
   - Purchased-but-inactive `act-reward` does not affect the run.

> **Validation gate:** `bun run typecheck` and `bun run test src/game/runtime/gameplaySession.test.ts src/game/runtime/gameplayRuntime.test.ts` pass. Stream subscribers can correlate `ActBoonOffered` with the triggering `ActAdvanced` batch.

## Phase 6 - Table scene boon-choice overlay

<table><tr><td><b>REQ-FORTUNE-8, 13, 30, 31, 32</b></td><td>User-facing choice UI. Core legality is already enforced; the scene now renders and dispatches the choice.</td></tr></table>

1. Add a dedicated view, for example `src/game/view/ActBoonChoiceView.ts`.
   - Render a focused overlay above the table.
   - Include an interactive shield/background so pointer events do not fall through to table cards.
   - Render all offered card faces using template data fetched through `this.game_.template(templateId)` or the chosen session catalog lookup. Do not mint cards for display.
   - If reusing `CardView` requires a minted `Card`, build a separate template-card face adapter instead of fabricating cards that can drift from reducer minting.
   - Copy should say the chosen card is temporary and goes to hand; do not describe this as permanent deck drafting.
   - Pointer click on an offered card calls `onChoose(templateId)`.

2. Update `src/game/scenes/TableScene.ts`.
   - Track `actBoonChoiceView: ActBoonChoiceView | null`.
   - In `drawAll`, if `state.pendingActBoon !== null`, show/update the overlay; otherwise dismiss it.
   - Resolve offered templates through the session lookup added in Phase 3; if any offered template is missing, show a non-interactive error state and log loudly rather than crashing.
   - Add guards in `onCardClick`, `onDiscardClick`, `onEndTurnClick`, `onConfirmClick`, and modal handling so pending Fortune choices do not begin table interactions.
   - Dispatch `{ type: "ChooseActBoon", templateId }` from overlay selection.
   - Bind number keys `1`, `2`, `3` near the existing keyboard hook. If a pending choice exists, choose the visible option at that index; ignore out-of-range keys.
   - Ensure `dispatch` dismisses the boon overlay after a valid choice, clears selection, and redraws.

3. Update UI tests.
   - Add a Phaser/unit test similar to `src/game/tests/modal.test.ts` that constructs a pending state and verifies the overlay renders all offered choices.
   - Test pointer selection dispatches `ChooseActBoon`.
   - Test number-key selection dispatches the matching visible template ID.
   - Test table card clicks and End Turn do not dispatch ordinary actions while the overlay is present.

4. Manual visual pass.
   - Start a local dev server with `bun run dev`.
   - Use a deterministic setup or temporary test harness path to reach an act transition with Fortune active.
   - Verify the overlay is legible, card faces render, pointer and number-key selection work, and table interactions are blocked.

> **Validation gate:** `bun run typecheck`, relevant UI tests, and a browser smoke pass succeed. The overlay displays exactly the offered templates and disappears after a valid choice.

## Phase 7 - Full validation and requirement audit

<table><tr><td><b>REQ-FORTUNE-1 ... 34</b></td><td>Whole-feature compliance gate.</td></tr></table>

1. Run automated gates:
   - `bun run typecheck`
   - `bun run test`
   - `bun run lint`

2. Run the spec's AI validation checklist from `.lore/work/specs/fortune-boon-cards.md`.
   - Catalog behavior and activatable Fortune.
   - Active/inactive reducer act-transition cases.
   - Opening deal never triggers.
   - One pending choice per `ActAdvanced`.
   - Ordinary actions rejected while pending.
   - Invalid choices rejected without mutation.
   - Chosen card is in hand, player, exhaust, direct-to-hand, and does not reduce normal refill draw.
   - Deterministic same-seed replay and different-seed smoke.
   - Every `buildWorld` world can mint every boon template.
   - Event batch ordering for offer and grant.
   - Table scene overlay blocks interactions and supports pointer plus number keys.
   - Template lookup path renders offered card faces without minting display-only cards.
   - Destiny copy accurately describes choose-1-of-3 temporary boon behavior.

3. Requirement audit.
   - Walk REQ-FORTUNE-1 through REQ-FORTUNE-34 and mark each implemented.
   - Explicitly note the accepted v1 art decision: generic/existing inset art, no new image generation. If implementation created art anyway, verify the `imagegen` skill was used and the assets match the basic-card sepia hand-drawn graphic-novel style.
   - Document that `RunModifiers.actBoon.poolTemplateIds` satisfies REQ-FORTUNE-3 because the reducer receives configured pool contents through run state and does not hard-code catalog details.

> **Final gate:** full tests and lint pass, the browser smoke is clean, and every Fortune requirement is either implemented or has a documented v1 exception already allowed by the spec.

## Out of scope

No permanent deck drafting, rerolls, skip rewards, rarity tiers, multi-card picks, new art generation, world-specific loot reuse, economy rebalance beyond making Fortune activatable, or additional world-card creation from boon cards.
