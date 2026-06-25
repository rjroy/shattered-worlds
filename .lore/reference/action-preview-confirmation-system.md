---
title: Action Preview and Confirmation System
date: 2026-06-25
status: current
tags: [action-preview, confirmation, ux, settings, core-runtime]
fg-type: architecture
fg-sources: [.lore/work/plans/action-impact-preview-and-confirmation.md]
fg-status: current
---

# Action Preview and Confirmation System

Action previews are a pure core read-model over real actions. The preview path calls the same reducer used for committed play, but keeps the returned state local so hover hints and confirmation dialogs cannot mutate the run.

`GameCore` owns preview capability because it already closes over the assembled catalog. Runtime and UI layers delegate to it instead of reaching into world assembly data. This keeps `TableScene` from duplicating core legality and effect logic.

## Rules

Preview summaries are derived from emitted `GameEvent` values and before/after deltas. They cover progress, damage, resources, card movement, boons, act advancement, and terminal outcomes. Illegal previews fail closed into a typed non-previewable result rather than throwing through the UI.

Concealed world cards must stay concealed in preview text. Names, costs, keywords, and exact hook text are masked. Broad effects may describe concealed impact only generically, and hidden consequences count as harmful for confirmation.

## UI Integration

The unified preview system replaces the older targeted `previewPlay` path. It powers selected-card target hover, idle world-card hover, end-turn hover, and confirmation modals. Detailed hover text is controlled by user settings.

Confirmation is controlled by a versioned settings store with modes for always confirming, confirming risky actions only, or disabling confirmation. The same store is intentionally broad enough to host future settings.
