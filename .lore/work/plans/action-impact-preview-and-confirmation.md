---
title: Action impact preview and confirmation implementation plan
date: 2026-06-19
status: draft
tags: [implementation-plan, ux, previews, confirmation, settings]
modules: [core, game-ui, interaction, settings]
related: [.lore/work/specs/action-impact-preview-and-confirmation.md, .lore/work/brainstorm/action-impact-preview-and-confirmation.md]
---

# Action impact preview and confirmation implementation plan

Source spec: `.lore/work/specs/action-impact-preview-and-confirmation.md`

This plan builds the feature in dependency order: pure preview engine, runtime
exposure, UI preview replacement, confirmation flow, settings overlay, and final
validation. The intended end state is that the old targeted `previewPlay` path is
replaced by a unified action-preview system that powers hover hints and
confirmation modals.

Note: the prep-plan workflow asks for lore-researcher / explorer / plan-reviewer
subagents. Those were not invoked because the available agent tool requires
explicit user permission for delegation. This plan includes a local context pass and
local fresh-eyes review instead.

## Assumptions

- `reduce(catalog, state, action)` remains the authoritative pure execution path.
- Preview can use `reduce` against a cloned/current immutable state reference and
  keep the returned preview state local.
- `GameCore` should expose preview capability because it already owns the catalog
  closure; `TableScene` should not reach into world assembly data.
- The first UI version can use the existing bottom `previewSlot` for hover
  summaries and a full-screen/center modal for confirmation.
- Settings should be owned by the game runtime/composition root, not by a one-off
  TableScene field, so future audio/display/accessibility settings can reuse the
  same storage and overlay.
- Confirmation cancel may return to idle for the first implementation, as allowed
  by the spec, if preserving active selection proves too invasive.

## Step 1: Add Pure Action Preview Types And Engine

Files:

- new `src/core/view/actionPreview.ts`
- `src/core/contract.ts`
- `src/core/tests/actionPreview.test.ts`
- existing test fixtures under `src/core/tests/`

Changes:

1. Define `ActionPreview`, `ActionPreviewSeverity`, and `ActionPreviewRisk`.
2. Implement `previewAction(catalog, state, action)` as a pure helper.
3. Call `reduce(catalog, state, action)` inside a try/catch; illegal actions return a typed non-previewable result or safe empty preview instead of throwing through UI.
4. Preserve the original `GameState` object; never assign the preview result to real game state.
5. Build summary lines from `GameEvent[]` plus before/after deltas.
6. Include focused summarizers for:
   - `ProgressDealt`, `HazardResolved`, `HazardPartial`
   - `DamageDealt`, `HpChanged`, `HealReceived`
   - `EnergyChanged`, `LightChanged`, `HeatChanged`, `BraceChanged`, `BraceConsumed`
   - `CardsDiscarded`, `CardDestroyed`, `CardsFrozen`, `CardsThawed`
   - `WorldCardsReturned`, `WorldCardsExiled`, `HazardAdded`
   - `BoonOffered`, `BoonCardGranted`, `ActAdvanced`, `WorldWon`, `WorldLost`
7. Add aggregation helpers for repeated outcomes so `DealProgressAll` can summarize broad effects.
8. Add risk classification according to `REQ-ACTIONPREV-31` through `REQ-ACTIONPREV-33`.
9. Keep the module Phaser-free and browser-free.

Validation gate:

- Unit tests cover simple `DealProgress`, clear hooks, partial hooks, `DealProgressAll`, `DiscardHazard`, and `EndTurn`.
- Unit tests assert original state references/zones are not mutated by preview.
- Unit tests assert illegal preview attempts do not throw uncaught errors.

## Step 2: Add Concealment-Safe Preview Masking

Files:

- `src/core/view/actionPreview.ts`
- `src/core/tests/actionPreview.test.ts`
- possibly `src/core/view/describe.ts` if shared concealment copy helpers belong there

Changes:

1. Add helper logic to identify concealed world cards with `isConcealed(card, state.light)`.
2. Mask concealed hazard names, costs, keywords, and exact hook text in summary output.
3. Use warning copy close to `Effect is concealed. Beware.` for concealed idle hover.
4. When `DealProgressAll` or another broad effect hits concealed hazards, summarize as concealed impact without names.
5. When preview events include clearing or partially clearing concealed hazards, use copy like `a concealed hazard would clear` or `concealed hazard effects may trigger`.
6. Treat hidden/concealed consequences as risk `harmful` for confirmation purposes.

Validation gate:

- Tests prove concealed hover/preview does not include hidden card name, keywords, cost, or exact hook effects.
- Tests prove visible hazards still show useful names and consequences.
- Tests prove broad effects can mention concealed hazards only generically.

## Step 3: Expose Preview Through Core And Runtime

Files:

- `src/core/engine/game.ts`
- `src/core/contract.ts`
- `src/core/index.ts` if exports need no extra work beyond contract
- `src/game/runtime/gameplaySession.ts`
- `src/game/runtime/gameplaySession.test.ts`

Changes:

1. Add `preview(action: Action): ActionPreview` to `GameCore`.
2. Implement `GameCore.preview` by calling `previewAction(catalog, current, action)` without mutating `current`.
3. Add `preview(action)` to `GameplaySession`, delegating to core.
4. Ensure `GameplaySession.preview` does not emit `GameplayBatch`, `RunEnded`, stats, witness, or feat stream items.
5. Keep `template()` unchanged for card preview consumers.

Validation gate:

- Runtime tests prove preview returns events/summary but does not emit gameplay stream batches.
- Runtime tests prove preview does not change `session.state`.
- Typecheck verifies `TableScene` can call `this.game_.preview(action)`.

## Step 4: Add Extensible User Settings Store

Files:

- new `src/game/runtime/userSettings.ts`
- `src/game/runtime/gameplayRuntime.ts`
- `src/game/main.ts`
- `src/game/runtime/userSettings.test.ts`

Changes:

1. Define versioned settings:

   ```ts
   type ConfirmationMode = "always" | "risk-only" | "off";
   type UserSettings = {
     readonly version: 1;
     readonly confirmationMode: ConfirmationMode;
     readonly detailedHoverPreviews: boolean;
   };
   ```

2. Implement a small store/reader with:
   - guarded load
   - guarded save
   - in-memory fallback
   - malformed JSON discard
   - unknown future key tolerance
   - setters for current settings
   - subscribe or read API usable by scenes
3. Add `userSettings` to `GameplayRuntime`.
4. Pass the same guarded storage from `main.ts` that currently feeds stats/runtime persistence.
5. Keep naming broad (`userSettings`, not `previewSettings`) so future settings can join the same owner.

Validation gate:

- Tests cover missing storage, throwing storage, malformed JSON, default values, persistence, and unknown future keys.
- New defaults are `confirmationMode: "always"` and `detailedHoverPreviews: true`.

## Step 5: Build Settings Overlay View

Files:

- new `src/game/view/SettingsOverlayView.ts`
- `src/game/view/layout.ts`
- `src/game/scenes/TableScene.ts`
- `src/game/tests/settingsOverlayView.test.ts` or existing Phaser view tests

Changes:

1. Create a `SettingsOverlayView` modeled after `HelpOverlayView`: full-screen container, hidden by default, depth above table UI, interactive backdrop that blocks underlying clicks.
2. Add a settings button near help/exit controls. Update `TABLE_LAYOUT.buttons` with a stable position.
3. Add a three-way confirmation mode control: `Always`, `Risk only`, `Off`.
4. Add a boolean detailed-hover control.
5. Persist changes immediately through the settings store.
6. Opening/closing settings must not call `scene.start`, abandon the session, dispatch actions, or clear the run.
7. Decide during implementation whether opening settings preserves or cancels active selection. If canceling, do it explicitly and clear previews/connectors/snapshots.
8. Hide/disable settings when the terminal run summary is visible.

Validation gate:

- View or scene tests prove opening/closing settings does not dispatch actions or abandon/restart a run.
- Tests prove setting changes write to the settings store.
- Manual smoke confirms the overlay can open mid-run and close back to the same run.

## Step 6: Replace Targeted Hover Preview With Unified Preview

Files:

- `src/game/scenes/TableScene.ts`
- `src/core/view/describe.ts`
- `src/game/tests/cardObjects.test.ts`
- `src/game/tests/describe.test.ts`

Changes:

1. Remove or deprecate `previewPlay` usage from `TableScene`.
2. Add helper(s) in `TableScene` to build candidate `PlayCard` actions from current selection state plus hovered target.
3. For a legal hazard target, call `this.game_.preview(action)` and render its summarized targeted line in `previewSlot`.
4. Preserve the current useful text: Progress amount, clears target vs remaining Progress.
5. For compound/modal selections where the full action is not buildable yet, preview the nearest legal partial intent with clear copy rather than failing silently.
6. Keep selected effective card snapshots as the source of modal branch/target path, matching the existing effective-card modifier behavior.
7. Honor `detailedHoverPreviews`: detailed on shows richer consequence summaries; off shows minimal preview while retaining concealed warnings.

Validation gate:

- Tests prove targeted hover uses unified preview output.
- Existing effective-card preview tests still pass, especially selected effective snapshot behavior.
- Tests prove preview clears on hover-out, cancel, dispatch, and terminal summary.

## Step 7: Add Idle World-Card And End-Turn Previews

Files:

- `src/game/scenes/TableScene.ts`
- `src/core/view/actionPreview.ts`
- `src/game/tests/cardObjects.test.ts`

Changes:

1. In card `pointerover`, when idle and hovering a world card, render idle hook preview.
2. For visible world cards:
   - summarize `onEndOfTurn` when meaningful
   - summarize `onDiscarded` when discardable and meaningful
   - show both when both matter
3. For concealed world cards, show only concealment-safe warning copy.
4. Give targeted preview priority over idle world-card preview.
5. Add hover/focus handling for End Turn that previews meaningful `EndTurn` action consequences via `this.game_.preview({ type: "EndTurn" })`.
6. Ensure all preview objects remain non-interactive or are only attached to existing buttons/cards in ways that do not steal clicks.

Validation gate:

- Tests cover idle visible world hover with end-turn hook.
- Tests cover discardable visible world hover with discard effect.
- Tests cover both hooks appearing together.
- Tests cover concealed hover warning.
- Tests cover target hover priority.
- Tests cover End Turn preview.

## Step 8: Add Confirmation Modal View

Files:

- new `src/game/view/ActionConfirmationView.ts`
- `src/game/scenes/TableScene.ts`
- `src/game/tests/modal.test.ts` or focused confirmation tests

Changes:

1. Create a modal view with:
   - title naming the action
   - consequence lines from `ActionPreview.summaryLines`
   - cancel button
   - commit button
   - interactive backdrop/panel that blocks underlying table clicks
2. Keep the modal copy concise and concealment-safe by using already-masked preview summaries.
3. Add enough layout constraints so long summaries do not overflow the 900x600 canvas.
4. Ensure modal depth is above cards, connectors, tooltips, and modal chooser, but below/cleared for terminal run summary.
5. Add destroy/cleanup methods similar to other view classes.

Validation gate:

- View tests or scene tests prove cancel and commit callbacks fire exactly once.
- Manual smoke confirms the modal is readable and blocks underlying card clicks.

## Step 9: Gate Dispatch Through Confirmation

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/interaction/selection.ts` only if action-finalization helpers need small extensions
- `src/game/tests/cardObjects.test.ts`
- `src/game/tests/selection.test.ts`

Changes:

1. Add `maybeConfirmOrDispatch(action: Action)` in `TableScene`.
2. Route all user-initiated committed actions through it:
   - complete `PlayCard`
   - `DiscardHazard`
   - `EndTurn`
3. Do not route `ChooseBoon` through this first version unless later review finds it necessary; boon choice UI is already a modal commitment.
4. Evaluate confirmation mode:
   - `always`: confirm every `PlayCard`, `DiscardHazard`, `EndTurn`
   - `risk-only`: confirm preview risk `attention` or `harmful`
   - `off`: dispatch directly
5. Store the exact action and preview used by the modal.
6. Commit dispatches the stored action exactly once.
7. Cancel dispatches nothing and clears stale connector/preview/modal state.
8. While confirmation is open, ignore or block card clicks, end-turn clicks, discard clicks, modal chooser clicks, and hover previews behind it.
9. Revalidate stored action before dispatch if there is any path for state to change while the modal is open; otherwise document that modal input blocking preserves local sync validity.

Validation gate:

- Tests cover `always`, `risk-only`, and `off`.
- Tests prove `risk-only` skips a risk `none` action.
- Tests prove cancel dispatches no action.
- Tests prove commit dispatches exactly the stored action once.
- Tests prove underlying clicks do not dispatch while modal is open.

## Step 10: Integrate Terminal, Boon, And Selection Cleanup

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/tests/boonChoiceView.test.ts`
- `src/game/tests/cardObjects.test.ts`

Changes:

1. Dismiss confirmation and settings overlays when terminal run summary appears.
2. Ensure pending boon choices continue to block normal table actions as today.
3. Clear preview text, connector graphics, selected snapshots, and confirmation state on:
   - cancel selection
   - confirmation cancel
   - dispatch commit
   - run summary display
   - scene shutdown
4. Keep Help overlay and Settings overlay from fighting over top-level input. If one opens while the other is visible, close or hide the other consistently.
5. Ensure `ESC` behavior is predictable for help/settings/confirmation; at minimum, settings can close like help, and confirmation cancel behavior is explicit.

Validation gate:

- Existing boon choice tests still pass.
- Scene tests cover terminal cleanup.
- Manual smoke covers opening Help, Settings, and Confirmation in normal play.

## Step 11: Full Validation

Commands:

1. `bun run typecheck`
2. `bun test --preload ./src/game/tests/testSetup.ts`
3. `bun run lint`
4. `bun run build`

Manual smoke:

1. Start a run with default settings.
2. Confirm settings shows confirmation mode `Always` and detailed hover previews on.
3. Hover visible world cards and verify end-turn/discard previews.
4. Select a player card and hover a legal target; verify targeted preview replaces idle world preview.
5. Play a card, discard a hazard, and end turn; verify each opens confirmation in `Always`.
6. Switch to `Risk only`; verify risk-free actions skip confirmation and meaningful/risky actions confirm.
7. Switch to `Off`; verify action-preview confirmations stop.
8. Open and close settings mid-run; verify the run does not restart or abandon.
9. In a concealment world, hover concealed hazards and verify no hidden details leak.

Diff review:

1. Confirm preview code does not mutate real game state.
2. Confirm previews do not emit runtime stream batches or update run stats.
3. Confirm settings storage is generic/extensible rather than tied only to confirmation.
4. Confirm `previewPlay` is removed from active TableScene flow.
5. Confirm new UI elements are pointer-safe and do not intercept card clicks outside their own overlay/modal.

## Local Fresh-Eyes Review

- The highest-risk part is preview summary quality. Keep the first implementation
  event-driven and conservative; if text becomes too noisy, aggregate more rather
  than building special effect-specific prose paths.
- `EndTurn` preview may include draw/refill events that depend on RNG. This is
  acceptable only because it uses the cloned preview state. The UI copy should
  avoid overpromising exact random outcomes where the player did not choose them.
- TableScene already has a confirm button for multi-pick targeting. The new
  action-confirmation modal must be named and structured distinctly so it does not
  blur with step confirmation.
- Settings should be injected through runtime/session construction rather than
  imported as a singleton. That keeps tests clean and leaves room for future app
  settings.
- If preserving active selection across settings overlay causes brittle scene
  state, canceling selection on settings-open is acceptable under the spec, but it
  must be deliberate and thoroughly cleaned up.
