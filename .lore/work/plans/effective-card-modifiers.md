---
title: Effective card modifiers implementation plan
date: 2026-06-17
status: draft
tags: [unlocks, card-system, effective-cards, implementation-plan]
modules: [unlocks, core-engine, card-system, table-scene]
related: [.lore/work/specs/effective-card-modifiers.md, .lore/work/brainstorm/unlocks-modifying-card-templates.md]
---

# Effective card modifiers implementation plan

Source spec: `.lore/work/specs/effective-card-modifiers.md`

This plan implements effective player-card modifiers as a pure read-model: durable cards remain unchanged in `GameState` zones, while core rules and UI consume derived effective cards. The dependency order is core data, core rules, then UI consumption.

Note: the prep-plan workflow asks for lore-researcher / plan-reviewer subagents. Those were not invoked because the available agent tool requires explicit user permission for delegation. This plan includes a local context pass and local fresh-eyes review instead.

## Assumptions

- Card modifiers are active only through `RunModifiers`; the first implementation can use test-only modifiers without adding final catalog entries.
- `Action.PlayCard` does not carry an effective snapshot token in this slice.
- UI-selected snapshots are read-models only; reducer validation remains authoritative.
- Existing card-face rendering can show modified cost/effects without adding new unlock badges.

## Step 1: Add modifier and history types

Files:

- `src/data/unlocks/types.ts`
- `src/core/model/types.ts`
- `src/core/engine/world.ts`
- core tests that construct `GameState` literals

Changes:

1. Add `PlayerCardModifier`, `PlayerCardModifierTarget`, `PlayerCardModifierCondition`, and `PlayerCardPatch` pure-data types.
2. Add `playerCardModifiers: readonly PlayerCardModifier[]` to `RunModifiers` and `DEFAULT_RUN_MODIFIERS`.
3. Add `TurnPlayHistory` to core model types.
4. Add `turnPlayHistory` to `GameState`.
5. Initialize `turnPlayHistory` in `createWorld` as `{ cardsPlayedThisTurn: 0, byTemplateId: {} }`.
6. Update test fixture helpers or state literals to include the new default via `createWorld`/`makeState`.

Validation gate:

- `bun run typecheck` reaches only expected follow-up errors in files that still need effective-card implementation, not missing type definitions.
- A grep for `runModifiers:` and `GameState = {` finds all hand-built state objects updated or routed through fixtures.

## Step 2: Build effective-card derivation

Files:

- new `src/core/engine/effectiveCards.ts` or similar core-local module
- `src/core/index.ts` / `src/core/contract.ts` exports as needed
- `src/core/tests/effectiveCards.test.ts`

Changes:

1. Implement `effectivePlayerCard(card, state): PlayerCard`.
2. Implement target matching for exact template ids.
3. Implement condition evaluation for `always`, `templatePlayOrdinalThisTurn`, `anyPlayOrdinalThisTurn`, `hp`, `resource`, `and`, `or`, and `not`.
4. Implement patch application for set/add energy cost, set exhaust, replace/prepend/append effect, add keyword, and rename.
5. Clamp effective energy cost to a sane non-negative integer after additive changes unless a stronger local convention says otherwise.
6. Preserve identity fields: `id`, `templateId`, `sourceWorldId`.
7. Ensure no input card or nested arrays are mutated.
8. Add effect composition helper for prepend/append that creates readable `Sequence` effects and flattens adjacent `Sequence` nodes where safe.

Validation gate:

- Unit tests cover no-op derivation, static cost patch, append effect, ordinal conditions, resource conditions, deterministic multiple-modifier order, and base-card immutability.
- Tests explicitly assert that three separate base `Sprint` cards all derive `energyCost: 0` before any `Sprint` has been played.

## Step 3: Wire effective cards into available actions

Files:

- `src/core/engine/available.ts`
- `src/core/tests/available.test.ts`

Changes:

1. In `availableActions`, derive an effective card for each playable player card before checking affordability or playable spec.
2. Use the effective effect for `playableSpec`.
3. In `legalTargets`, derive the effective card for the requested card id before computing legal targets.
4. Preserve `ignoreEnergy` behavior: bypass cost affordability, but still use the effective effect tree and effective target requirements.
5. Avoid changing discardable world-card behavior.

Validation gate:

- Tests prove effective cost controls whether a card appears in `playable`.
- Tests prove an appended target-requiring effect changes `TargetSpec`/legal targets.
- Existing `availableActions` tests still pass.

## Step 4: Wire snapshots into reducer play resolution

Files:

- `src/core/engine/reduce.ts`
- `src/core/model/types.ts`
- `src/core/tests/reduce.test.ts`

Changes:

1. In `handlePlayCard`, find the base hand card, then derive the effective snapshot before any history increment or event emission.
2. Validate the action against `availableActions(state)` as today, but make sure that available action path is already using effective cards from Step 3.
3. Remove/recycle/destroy the base card from hand and discard zones, not the effective copy.
4. Emit `CardPlayed` with `cardId`, base `templateId`, and `templateOrdinalThisTurn`.
5. Increment `turnPlayHistory` after deriving the effective snapshot and before returning the next state.
6. Spend energy using the snapshot's `energyCost`.
7. Apply the snapshot's `effect`.
8. Use the snapshot's `exhaust` decision for whether the base card is destroyed or recycled.
9. Reset `turnPlayHistory` during `EndTurn` before the next player turn is evaluated/rendered.

Validation gate:

- Reducer tests prove first `Sprint` spends `0`, second `Sprint` in the same turn spends normal cost, and history resets after `EndTurn`.
- Tests prove illegal `PlayCard` attempts do not change history.
- Tests prove `Panic` with appended `DealProgressAll` resolves original and appended effects.
- Tests prove the base card object in discard/destroy events keeps stable identity/template.

## Step 5: Add unlock catalog plumbing and playtest unlocks

Files:

- `src/data/unlocks/types.ts`
- `src/data/unlocks/catalog.ts`
- existing unlock tests

Changes:

1. Add an `UnlockEffect` variant for card modifiers, likely `{ type: "playerCardModifier"; modifier: PlayerCardModifier }`.
2. Extend `buildRunModifiers` to append active card modifiers to `mods.playerCardModifiers`.
3. Add a small set of clearly named playtest unlocks to `UNLOCK_CATALOG` so the feature can be purchased, activated, and tested in situ through the Destiny UI. Suggested entries:
   - `first-sprint-free`: first `Sprint` each turn costs `0`.
   - `panic-response`: `Panic` appends `{ kind: "DealProgressAll", base: 1 }`.
   - `second-explore-push`: second `Explore` each turn appends a small extra progress effect.
4. Give these entries normal costs and destiny weights so they exercise purchase, activation, budget, and run assembly paths. Treat names/descriptions/balance as playtest copy, not final catalog design.
5. Ensure purchased-but-inactive unlocks cannot affect the run because `buildRunModifiers` only receives active ids.
6. Keep the entries easy to identify in later balance passes, either by names that signal experimental behavior or by nearby catalog comments.

Validation gate:

- Catalog tests prove active card-modifier effects populate `RunModifiers.playerCardModifiers`.
- Destiny/UI smoke can buy and activate at least one card-modifier unlock without hand-editing profile state.
- Existing unlock catalog and store tests still pass.

## Step 6: Expose effective-card read models for the scene

Files:

- `src/core/engine/effectiveCards.ts`
- `src/core/index.ts` / `src/core/contract.ts`
- possibly `src/core/engine/game.ts`

Changes:

1. Export `effectivePlayerCard`.
2. Add a small helper such as `effectiveCard(card, state): Card` if that keeps scene code simpler.
3. Optionally add `effectiveHand(state): readonly Card[]` to centralize "world cards as base, player cards as effective" behavior.
4. Keep helpers pure and free of Phaser/game-layer imports.

Validation gate:

- Typecheck verifies game-layer scene/view code can consume effective card helpers without crossing forbidden import boundaries.

## Step 7: Render visible hand from effective cards

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/view/CardView.ts` only if existing API cannot update reused faces
- `src/game/tests/cardObjects.test.ts` or focused scene/view tests

Changes:

1. In `drawAll`, derive effective player cards for the current hand before splitting into world/player rows.
2. Pass effective player cards to `layoutRow`/`obtainCardContainer`.
3. Audit persistent `CardView` reuse: currently `obtainCardContainer` returns an existing container without refreshing its face from changed card data. Add a controlled way to update a reused `CardView` when effective cost/effect changes, or recreate player-card containers when their effective display signature changes.
4. Preserve existing world-card progress ring and concealment behavior.
5. Ensure desired ids still use the base/effective shared `id`, so reconciliation and dispatch continue to target the durable card.

Validation gate:

- A view/scene test or manual smoke confirms all visible `Sprint`s show cost `0` before one resolves, and remaining `Sprint`s update after one resolves.
- Existing card object tests still pass.

## Step 8: Stabilize UI selected-card snapshots

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/interaction/selection.ts` if state shape needs an effective spec/snapshot attachment
- `src/game/tests/selection.test.ts`

Changes:

1. When a playable card is clicked, find the effective card and capture a scene-level selected snapshot.
2. Start selection from the snapshot-derived `TargetSpec`.
3. Keep selection state stable until completed or canceled; do not recompute its step list mid-selection.
4. Clear the selected snapshot on cancel, dispatch completion, modal dismissal, end of play, and act boon interruptions.
5. For modal cards, use the snapshot's modal branches for branch labels and modal targeting.
6. Keep core validation authoritative; the UI snapshot only drives display/interaction.

Validation gate:

- Selection tests prove `beginTargeting` behavior remains stable.
- Scene-level tests or targeted unit tests prove an effective appended target step is present during selection.

## Step 9: Use selected snapshots for previews and connector styles

Files:

- `src/game/scenes/TableScene.ts`
- `src/core/view/describe.ts` tests
- `src/game/tests/feedback.test.ts` / describe tests if needed

Changes:

1. Change `showTargetPreview` to use the selected effective snapshot instead of `state.hand.find`.
2. Change `stepConnectorStyle` to use the selected effective snapshot where the requested `cardId` matches the active selection.
3. Ensure playability hover still uses `availableActions`, which already reflects effective cards.
4. Keep non-selected hover behavior unchanged.

Validation gate:

- Tests or manual smoke prove preview text and connector style match an appended effective progress/return/destroy step.
- Existing feedback/describe tests still pass.

## Step 10: Full validation and cleanup

Files:

- all touched files
- `.lore/work/specs/effective-card-modifiers.md` as validation source

Commands:

1. `bun run typecheck`
2. `bun test --preload ./src/game/tests/testSetup.ts`
3. `bun run lint`
4. `bun run build`

Manual smoke:

1. Earn or seed enough Memory Fragments to buy `first-sprint-free` through the Destiny UI.
2. Activate `first-sprint-free` within the destiny budget.
3. Start a run with multiple `Sprint` cards visible.
4. Confirm all visible `Sprint`s show free.
5. Play one `Sprint`.
6. Confirm energy spend, `CardPlayed` ordinal, and remaining `Sprint` display match the spec.
7. Repeat with `panic-response` to confirm an unlock-modified card renders and resolves its appended effect in normal gameplay.

Diff review:

1. Confirm no conditional modifier rewrites durable card-zone objects for display.
2. Confirm core imports remain pure and do not import from game layer.
3. Confirm UI snapshots do not bypass reducer validation.
4. Confirm playtest unlock entries are clearly identifiable and do not pretend to be final balance/catalog decisions.

## Local Fresh-Eyes Review

Findings to watch during implementation:

- **CardView reuse is the main UI risk.** The scene currently reuses card containers by id and creates the card face only once. Effective cards that change cost/effect after state changes will not visibly update unless `CardView` gains a refresh path or containers are recreated when the effective display signature changes.
- **Reducer snapshot ordering is easy to get wrong.** The effective card must be derived before incrementing turn play history; otherwise "first Sprint" can invalidate itself.
- **`availableActions` and reducer must share the same derivation helper.** Any duplicate logic will drift between UI legality and actual play resolution.
- **Modal labels and target specs need effective effects.** The current modal chooser reads the base hand card's `effect.branches`; this must move to selected snapshots.
- **Testing through real card templates may be awkward.** Use focused test fixtures with simple `PlayerCard` literals where possible, and only use world catalog integration tests for final smoke coverage.
