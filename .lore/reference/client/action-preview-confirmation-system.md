---
title: Action Preview and Confirmation System
date: 2026-06-25
status: current
tags: [action-preview, confirmation, ux, settings, core-runtime]
fg-type: architecture
fg-sources: [.lore/work/plans/action-impact-preview-and-confirmation.md, .lore/work/notes/action-impact-preview-and-confirmation.md, .lore/work/brainstorm/action-impact-preview-and-confirmation.md, .lore/work/specs/action-impact-preview-and-confirmation.md]
fg-status: current
fg-evidence:
  code:
    - src/core/view/actionPreview.ts
    - src/core/engine/game.ts
    - src/game/view/ActionConfirmationView.ts
    - src/game/scenes/TableScene.ts
    - src/game/runtime/userSettings.ts
  tests:
    - src/core/tests/actionPreview.test.ts
    - src/game/tests/actionConfirmationView.test.ts
  symbols:
    - GameCore
    - previewAction
    - ActionConfirmationView
    - UserSettings
---

# Action Preview and Confirmation System

Action previews are a pure core read-model over real actions. The preview path calls the same reducer used for committed play, but keeps the returned state local so hover hints and confirmation dialogs cannot mutate the run.

`GameCore` owns preview capability because it already closes over the assembled catalog. Runtime and UI layers delegate to it instead of reaching into world assembly data. This keeps `TableScene` from duplicating core legality and effect logic.

## Rules

Preview summaries are derived from emitted `GameEvent` values and before/after deltas. They cover progress, damage, resources, card movement, boons, act advancement, and terminal outcomes. Illegal previews fail closed into a typed non-previewable result rather than throwing through the UI.

Concealed world cards must stay concealed in preview text. Names, costs, keywords, and exact hook text are masked. Broad effects may describe concealed impact only generically, and hidden consequences count as harmful for confirmation.

Concealment masking is provenance-based. `GameEvent` values can carry `sourceCardId`, and `applyEffect` stamps events from the firing card while preserving inner provenance. Preview masking can then genericize or drop events whose source resolves to a concealed world card, instead of mirroring reducer event counts. Deferred `ForceDestroy` also carries source provenance through `pendingForceDestroySource`.

The remaining intentional exception is concealed hooks that add cards to the world deck. Later refill events are emitted by draw logic rather than the hook itself, so preview uses a small downstream taint to mask those newly drawn hazards.

## UI Integration

The unified preview system replaces the older targeted `previewPlay` path. It powers selected-card target hover, idle world-card hover, end-turn hover, and confirmation modals. Detailed hover text is controlled by user settings.

Confirmation is controlled by a versioned settings store with modes for always confirming, confirming risky actions only, or disabling confirmation. This supersedes the originating brainstorm's candidate shape of two independent booleans (`confirmRiskyActions`, `detailedPreviews`) with a single three-mode confirmation setting instead. The same store is intentionally broad enough to host future settings.

Confirmation owns top-most modal behavior in the table scene. It blocks help/settings toggles while open, cancels on ESC before other overlays, clears selected previews/connectors on cancel, and hides during terminal or shutdown cleanup.
