# Targeting and Selection Grammar

<!--
date: 2026-06-15
status: current
tags: targeting, selection, available-actions, renderer, ux, legality
fg-type: architecture
fg-sources: .lore/work/design/targeting-interaction.html, .lore/work/plans/generalize-selection-targeting.html, .lore/work/specs/player-feedback-selection-and-progress.html
fg-status: current
fg-evidence:
  code:
    - src/core/engine/available.ts
    - src/game/interaction/selection.ts
    - src/game/interaction/highlight.ts
  tests:
    - src/core/tests/available.test.ts
    - src/game/tests/selection.test.ts
    - src/game/tests/highlight.test.ts
  symbols:
    - AvailableAction
    - SelectionState
-->

Selection is renderer-only transient state. The core never sees half-built interactions such as "card selected, target pending." It receives only complete actions. Legality, however, comes from the core through a pure available-actions read model, so renderer highlights and reducer validation share the same source of truth.

## Grammar

The interaction pattern is select, resolve requirements, commit. A card's target spec decides whether the middle step is no target, one hazard target, a modal branch, a return selection, a destroy selection, a discard step, or a compound sequence. Cancel is available during every non-idle selection and dispatches nothing.

## World Cards

A world card is an actor only when selected from idle for discard. While a player card is selected, the same world card is a possible target. The Door and other non-discardable world cards do not offer a discard affordance.

## Design Rule

The renderer can project legality into hover states, connectors, previews, and dimming, but it must not reimplement game rules. If a highlight would offer an action that dispatch rejects, the bug is in the availability seam.
