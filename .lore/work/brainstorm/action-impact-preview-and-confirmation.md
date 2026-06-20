---
title: Action impact preview and confirmation
date: 2026-06-19
status: open
tags: [brainstorm, ux, previews, confirmation, settings]
modules: [core, game-ui, interaction]
---

# Action impact preview and confirmation

## Problem

Players do not always understand the consequences of an action before committing it.
The current UI can preview how a player card might affect a targeted world card, but
it does not consistently preview:

- world-card effects that will fire on end turn
- world-card discard penalties
- partial-clear consequences from player cards
- `DealProgressAll` effects that may trigger several partial-clear or clear hooks
- risky actions that should ask for explicit confirmation

This matters because a player can make a technically legal action without realizing
that it will damage them, destroy cards, freeze cards, add hazards, or otherwise
shift the board.

## Two UX Systems

There are two separate player moments to solve:

1. Intent preview while the player is still deciding.
2. Commit confirmation when the chosen action is about to mutate state.

Keeping these separate should avoid making ordinary hover text too noisy while still
protecting players from surprising consequences.

## Impact Preview

The current bottom hint and preview slot can become the lightweight surface for
contextual impact.

For player cards, previews could evolve from narrow progress math:

- `Make 3 Progress -> clears Zombie`

Into contextual consequences:

- `Explore: +3 Progress to Zombie; partial triggers: take 1 damage`
- `Panic: +2 Progress to all hazards; clears 1, partials trigger on 2`
- `Barricade: clears Rubble; then return 1 world card`

For world cards, idle hover should preview what the world card threatens to do:

- `End turn: take 2 damage`
- `End turn: freeze 1 player card`
- `End turn: add Zombie to the world deck`

If the world card is discardable, hover should also expose the discard consequence:

- `Discard: take 1 damage`
- `Discard: add a hazard to the world deck`

If a world card is being hovered as the target of a selected player card, the
player-card action preview should take priority over the idle world-card preview.

## Confirmation Modal

Confirmations should appear only for meaningful or risky actions, not every action.
The modal should clearly state the consequence in direct language.

Potential default confirmation triggers:

- discarding a world card whose `onDiscarded` effect is not `None`
- ending the turn while world cards in hand have harmful `onEndOfTurn` effects
- playing a card that causes damage, destroys cards, freezes cards, discards cards,
  causes world loss, or triggers multiple hazard hooks
- playing `DealProgressAll` when it will trigger any `onPartialClear` or
  `onCleared` effects

Probably avoid confirmations for:

- simple progress to one hazard
- gaining energy, light, heat, or brace
- healing
- draw-only effects, unless future rules make drawing itself risky

Example discard confirmation:

```text
Confirm Discard

Discarding Screams will:
- Deal 2 damage
- Add Zombie to the world deck

[Cancel] [Discard]
```

Example end-turn confirmation:

```text
Confirm End Turn

Ending the turn will:
- Rubble: take 1 damage
- Strange Sounds: add Zombie to the world deck
- Discard 2 player cards
- Draw a new hand

[Cancel] [End Turn]
```

## Settings

Because no settings page exists yet, start with a small settings overlay rather than
a full route or separate scene.

Add a gear/settings button near help and exit. Initial settings:

- `Confirm risky actions`: on by default
- `Show detailed hover previews`: on by default

Possible later settings:

- animation intensity
- music volume
- sound effect volume

Persist settings through `localStorage`, following the current pattern where access
is guarded because storage can throw under restrictive browser settings.

Candidate shape:

```ts
type UserSettings = {
  confirmRiskyActions: boolean;
  detailedPreviews: boolean;
};
```

## Implementation Shape

The safest design is to derive previews from the same core logic that applies
actions, rather than hand-authoring a second set of prediction strings.

Add a pure core/view helper:

```ts
previewAction(catalog, state, action): ActionPreview
```

Candidate output:

```ts
type ActionPreview = {
  action: Action;
  events: readonly GameEvent[];
  summaryLines: readonly string[];
  severity: "info" | "warning" | "danger";
  requiresConfirmation: boolean;
};
```

The helper can:

- clone the current state
- run the action through the reducer/effect engine
- inspect emitted events and state deltas
- summarize what changed
- classify whether the action is risky enough to confirm

This keeps UI decisions in Phaser while keeping consequence prediction pure and
headlessly testable.

`TableScene` could use this in three places:

- hover player target preview
- idle hover world-card preview
- before dispatching an action

## Concealment And Uncertainty

Concealed cards should not leak hidden card identity or hidden effect text.

Possible copy:

- `Concealed hazard: exact discard effect unknown`
- `Will affect all hazards, including concealed hazards`
- `Lost in the fog: needs Light 3`

`DealProgressAll` currently applies to every world card in hand, including concealed
ones, so previews need to warn about broad impact without revealing hidden names.

Random effects also need careful wording:

- `Will destroy 1 random player card next turn`
- `Will freeze up to 2 eligible player cards`

## Suggested Order

1. Add pure `previewAction` and an event/state-delta summarizer.
2. Use it for discard-hover and end-turn hover/hint.
3. Add confirmation modal for risky discard, end-turn, and play actions.
4. Add settings overlay with persistent toggles.
5. Replace the current narrow `previewPlay` path with the shared preview system once
   targeted play previews are covered.

## Open Questions

- Should confirmations be based on severity only, or on user-configurable categories?
- How much detail belongs in the bottom hint versus a richer hover tooltip?
- Should `DealProgressAll` preview each affected hazard or aggregate by outcome?
- Should confirmations also trigger when an action consumes scarce resources but is
  otherwise harmless?
- Should hidden/concealed discard effects be confirmable as unknown risk?
