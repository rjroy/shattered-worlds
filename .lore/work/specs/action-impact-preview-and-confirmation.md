---
title: Action impact preview and confirmation
date: 2026-06-19
status: draft
tags: [ux, previews, confirmation, settings, action-preview]
modules: [core, game-ui, interaction, settings]
related: [.lore/work/brainstorm/action-impact-preview-and-confirmation.md, .lore/work/specs/effective-card-modifiers.md]
req-prefix: ACTIONPREV
---

# Action impact preview and confirmation

## Context

Players need to understand the likely consequences of an action before committing
it. The current table UI previews a narrow slice of player-card targeting: how much
Progress a selected player card will deal to a hovered hazard and whether that
target clears. That preview does not explain world-card hooks, discard penalties,
partial-clear effects, area effects such as `DealProgressAll`, or the broader
state changes caused by an action.

This spec defines a unified action preview system, a confirmation system, and an
in-run settings overlay. The preview system should replace the narrow
`previewPlay` path rather than live permanently beside it.

## Scope

In scope:

- Pure action-preview calculation for completed or partially completed player
  intent.
- Contextual hover previews for player-card targeting, idle world-card hover,
  discardable world cards, and end turn.
- Confirmation modal for actions based on a user setting.
- A HelpView-like settings overlay available during a run without ending the run.
- Persistence for preview and confirmation settings.
- A settings structure that can grow to support future player preferences.
- Concealment-safe preview language that does not reveal hidden world-card details.

Out of scope:

- Rebalancing card effects or world data.
- Replacing the existing card-face static effect rendering.
- A full title-screen settings scene.
- Audio, animation, or accessibility settings beyond the preview/confirmation
  controls listed here.
- Explaining every future random outcome exactly; random effects should be
  described honestly as random or uncertain.

## Terms

**Action preview:** A pure read-model describing what a candidate `Action` would do
if dispatched from the current state.

**Preview summary:** Short player-facing text derived from an action preview. The
summary may aggregate details when a full event list would be too noisy.

**Risk:** A preview classification used by confirmation and styling. Risk is about
player attention, not only negative effects.

**Confirmation mode:** The player setting that controls when the confirmation modal
appears. Valid modes are `always`, `risk-only`, and `off`.

**Concealed hazard:** A world card hidden by the existing concealment rules. Its
identity and exact hooks must not be leaked by preview UI.

## Requirements

### Unified Action Preview

<div id="REQ-ACTIONPREV-1"></div>

**REQ-ACTIONPREV-1:** Core/view code must expose a pure action-preview helper that
can evaluate a candidate `Action` against the current `GameState` without mutating
the original state.

Suggested shape:

```ts
previewAction(catalog, state, action): ActionPreview
```

<div id="REQ-ACTIONPREV-2"></div>

**REQ-ACTIONPREV-2:** `ActionPreview` must include enough structured data for UI
surfaces to render summaries and decide whether confirmation is required.

Suggested shape:

```ts
type ActionPreview = {
  readonly action: Action;
  readonly events: readonly GameEvent[];
  readonly summaryLines: readonly string[];
  readonly severity: "info" | "notice" | "warning" | "danger";
  readonly risk: "none" | "attention" | "harmful";
};
```

<div id="REQ-ACTIONPREV-3"></div>

**REQ-ACTIONPREV-3:** Preview calculation must use the same reducer/effect semantics
as real action dispatch. It must not hand-author separate effect execution logic
that can drift from `reduce`, `applyEffect`, effective-card behavior, or world-hook
ordering.

<div id="REQ-ACTIONPREV-4"></div>

**REQ-ACTIONPREV-4:** Preview calculation must never commit state changes, emit
runtime stream events, update run stats, trigger scene transitions, change pending
selection state, or alter RNG in the real game state.

<div id="REQ-ACTIONPREV-5"></div>

**REQ-ACTIONPREV-5:** Preview summaries must be derived from emitted domain events
and relevant before/after state deltas. The summary must cover at least HP,
energy, light, heat, brace, Progress, resolved hazards, partial hazards, discarded
cards, destroyed cards, frozen/thawed cards, world cards added, world cards
returned, boons offered, act advance, win, and loss when those events occur.

<div id="REQ-ACTIONPREV-6"></div>

**REQ-ACTIONPREV-6:** Preview summaries must aggregate repeated outcomes when a
full list would be too long. For example, a `DealProgressAll` sweep may summarize
`clears 2 hazards; partial effects trigger on 3` while still allowing a richer
confirmation modal to list important named outcomes.

<div id="REQ-ACTIONPREV-7"></div>

**REQ-ACTIONPREV-7:** The existing targeted `previewPlay` behavior must be replaced
by the unified action-preview path. Targeted Progress previews must continue to
show the useful current information: amount of Progress, whether the target clears,
and how much remains when it does not clear.

<div id="REQ-ACTIONPREV-8"></div>

**REQ-ACTIONPREV-8:** Targeted player-card previews must use the selected effective
card snapshot, matching the effective-card requirements in
`.lore/work/specs/effective-card-modifiers.md`.

<div id="REQ-ACTIONPREV-9"></div>

**REQ-ACTIONPREV-9:** Compound and modal player-card previews must reflect the
currently selected modal branch and completed target choices. If the player has
not provided enough targets to build a legal action, the preview may summarize
the active step instead of simulating the full action.

<div id="REQ-ACTIONPREV-10"></div>

**REQ-ACTIONPREV-10:** Preview calculation must treat illegal candidate actions as
non-previewable and must not throw uncaught errors into the Phaser scene. Illegal
preview attempts should return a safe empty preview or a typed error result for
the UI to ignore.

### Hover And Hint Surfaces

<div id="REQ-ACTIONPREV-11"></div>

**REQ-ACTIONPREV-11:** The table must continue to keep instruction text and impact
preview text on separate surfaces so selection instructions are not overwritten by
hover previews.

<div id="REQ-ACTIONPREV-12"></div>

**REQ-ACTIONPREV-12:** While targeting a legal hazard with a selected player card,
hovering the hazard must show the unified preview for the resulting `PlayCard`
action or the nearest legal partial intent.

<div id="REQ-ACTIONPREV-13"></div>

**REQ-ACTIONPREV-13:** While idle, hovering a world card must preview its
`onEndOfTurn` effect in player-facing language when that hook has an effect.

<div id="REQ-ACTIONPREV-14"></div>

**REQ-ACTIONPREV-14:** While idle, hovering a discardable world card must preview
its `onDiscarded` effect in player-facing language when that hook has an effect.

<div id="REQ-ACTIONPREV-15"></div>

**REQ-ACTIONPREV-15:** If a world card has both a meaningful `onEndOfTurn` and a
meaningful `onDiscarded` effect, idle hover must expose both consequences clearly.

<div id="REQ-ACTIONPREV-16"></div>

**REQ-ACTIONPREV-16:** Targeting previews take priority over idle world-card
previews. If a world card is currently a legal target for the selected player card,
hover must describe the selected action against that target rather than the
world-card idle hooks.

<div id="REQ-ACTIONPREV-17"></div>

**REQ-ACTIONPREV-17:** End Turn hover or focus must provide a preview of meaningful
end-turn consequences, including world `onEndOfTurn` hooks, discarded unfrozen
player cards, turn-start refill, act advance, and terminal win/loss if applicable.

<div id="REQ-ACTIONPREV-18"></div>

**REQ-ACTIONPREV-18:** Preview text must fit the existing 900x600 table layout
without overlapping buttons, cards, HUD, selection hint, or the run summary. Long
previews must be shortened or summarized rather than overflowing the preview slot.

<div id="REQ-ACTIONPREV-19"></div>

**REQ-ACTIONPREV-19:** Preview surfaces must be pointer-safe. New preview UI must
not intercept clicks intended for cards, buttons, modal choices, or existing
tooltips.

### Concealment And Uncertainty

<div id="REQ-ACTIONPREV-20"></div>

**REQ-ACTIONPREV-20:** Hovering a concealed world card must not reveal its name,
keywords, cost, exact `onEndOfTurn`, exact `onDiscarded`, exact `onCleared`, or
exact `onPartialClear` effect text.

<div id="REQ-ACTIONPREV-21"></div>

**REQ-ACTIONPREV-21:** Concealed world-card hover copy must warn the player without
leaking details. Initial copy should be close to: `Effect is concealed. Beware.`

<div id="REQ-ACTIONPREV-22"></div>

**REQ-ACTIONPREV-22:** When a player action such as `DealProgressAll` affects
concealed hazards, previews may state that concealed hazards will also be affected
but must not name those hazards or reveal their hidden hooks.

<div id="REQ-ACTIONPREV-23"></div>

**REQ-ACTIONPREV-23:** If a concealed hazard would clear or partially clear during
preview simulation, the summary must use concealment-safe language such as
`a concealed hazard would clear` or `concealed hazard effects may trigger`.

<div id="REQ-ACTIONPREV-24"></div>

**REQ-ACTIONPREV-24:** Random effects must be summarized as random or uncertain
when the exact affected card is not guaranteed to the player. The preview must not
present RNG-selected outcomes as player-chosen certainty.

### Confirmation System

<div id="REQ-ACTIONPREV-25"></div>

**REQ-ACTIONPREV-25:** Before dispatching a candidate action, the table must check
the current confirmation mode and the action preview to decide whether to show a
confirmation modal.

<div id="REQ-ACTIONPREV-26"></div>

**REQ-ACTIONPREV-26:** Confirmation mode values are exactly:

- `always`
- `risk-only`
- `off`

<div id="REQ-ACTIONPREV-27"></div>

**REQ-ACTIONPREV-27:** New profiles and runs must default confirmation mode to
`always`.

<div id="REQ-ACTIONPREV-28"></div>

**REQ-ACTIONPREV-28:** In `always` mode, every player-initiated committed action
must require confirmation before dispatch, including `PlayCard`, `DiscardHazard`,
and `EndTurn`.

<div id="REQ-ACTIONPREV-29"></div>

**REQ-ACTIONPREV-29:** In `risk-only` mode, confirmation must appear for actions
whose preview risk is `attention` or `harmful`, and must not appear for actions
whose preview risk is `none`.

<div id="REQ-ACTIONPREV-30"></div>

**REQ-ACTIONPREV-30:** In `off` mode, no action-preview confirmation modal appears.
Existing targeting confirm buttons for multi-pick selection steps remain governed
by the selection system and are not disabled by this setting.

<div id="REQ-ACTIONPREV-31"></div>

**REQ-ACTIONPREV-31:** Risk classification must mark at least the following as
`harmful`: HP loss, card destruction, forced discard, freeze, non-routine
resource spend such as heat or sacrificing cards, world loss, and hidden/concealed
consequences. Ordinary player-card energy costs must not make an action harmful
by themselves.

<div id="REQ-ACTIONPREV-32"></div>

**REQ-ACTIONPREV-32:** Risk classification must mark at least the following as
`attention`: resolving hazards, triggering partial-clear hooks, triggering
clear hooks, adding world cards, returning world cards, offering boons, advancing
acts, and winning the world.

<div id="REQ-ACTIONPREV-33"></div>

**REQ-ACTIONPREV-33:** Risk classification may mark simple beneficial effects such
as healing, gaining energy, gaining light, gaining heat, gaining brace, or drawing
cards as `none` when no other meaningful side effect occurs.

<div id="REQ-ACTIONPREV-34"></div>

**REQ-ACTIONPREV-34:** The confirmation modal must clearly name the action being
confirmed and list the most important consequences from the action preview.

<div id="REQ-ACTIONPREV-35"></div>

**REQ-ACTIONPREV-35:** The confirmation modal must provide a cancel action that
returns the player to the prior board state without dispatching the action.

<div id="REQ-ACTIONPREV-36"></div>

**REQ-ACTIONPREV-36:** The confirmation modal must provide a commit action that
dispatches exactly the previously previewed action. It must not rebuild a different
action from changed hover or selection state.

<div id="REQ-ACTIONPREV-37"></div>

**REQ-ACTIONPREV-37:** While the confirmation modal is open, card clicks, end-turn
clicks, discard clicks, modal-chooser clicks, and hover previews behind the modal
must not dispatch additional actions.

<div id="REQ-ACTIONPREV-38"></div>

**REQ-ACTIONPREV-38:** Confirmation copy for concealed hazards must stay
concealment-safe. It may warn that an effect is concealed and dangerous, but must
not list hidden exact effect text.

### Settings Overlay

<div id="REQ-ACTIONPREV-39"></div>

**REQ-ACTIONPREV-39:** The game must add an in-run settings overlay that behaves
like `HelpOverlayView`: hidden by default, shown above the table during a run, and
closed without switching scenes or ending the current run.

<div id="REQ-ACTIONPREV-40"></div>

**REQ-ACTIONPREV-40:** Opening or closing settings must not call `scene.start`,
shut down `TableScene`, abandon the gameplay session, dispatch game actions, or
clear the current run.

<div id="REQ-ACTIONPREV-41"></div>

**REQ-ACTIONPREV-41:** Opening and closing settings during an active card
selection should preserve the current selection state when feasible. If the first
implementation chooses to cancel active selection when opening settings, it must
do so explicitly and must clear stale previews, connectors, modal choosers, and
selected snapshots.

<div id="REQ-ACTIONPREV-42"></div>

**REQ-ACTIONPREV-42:** The table must expose a settings button during active play,
near the existing help/exit controls or another consistent top-level table control
location.

<div id="REQ-ACTIONPREV-43"></div>

**REQ-ACTIONPREV-43:** The settings overlay must expose confirmation mode as a
three-way control with labels equivalent to `Always`, `Risk only`, and `Off`.

<div id="REQ-ACTIONPREV-44"></div>

**REQ-ACTIONPREV-44:** The settings overlay must expose detailed hover previews as
a boolean setting. Detailed hover previews default to on.

<div id="REQ-ACTIONPREV-45"></div>

**REQ-ACTIONPREV-45:** When detailed hover previews are off, the UI may show only
minimal preview text, but it must still preserve concealment warnings and must not
disable confirmation previews.

<div id="REQ-ACTIONPREV-46"></div>

**REQ-ACTIONPREV-46:** Settings must persist through guarded `localStorage` access.
If storage is unavailable or throws, the game must fall back to in-memory defaults
without failing to boot.

<div id="REQ-ACTIONPREV-47"></div>

**REQ-ACTIONPREV-47:** Settings persistence must be versioned so malformed or
unknown stored settings can be discarded safely without crashing.

Suggested shape:

```ts
type UserSettings = {
  readonly version: 1;
  readonly confirmationMode: "always" | "risk-only" | "off";
  readonly detailedHoverPreviews: boolean;
};
```

<div id="REQ-ACTIONPREV-48"></div>

**REQ-ACTIONPREV-48:** The settings overlay and persisted settings model must be
designed as an extensible starting point, not a one-off confirmation dialog. Adding
future settings such as audio, animation, accessibility, or display preferences
should not require replacing the settings storage owner or changing how the table
opens the settings overlay.

### Interaction And State Safety

<div id="REQ-ACTIONPREV-49"></div>

**REQ-ACTIONPREV-49:** The action stored for confirmation must include all selected
targets and modal choices needed to dispatch the exact intended action.

<div id="REQ-ACTIONPREV-50"></div>

**REQ-ACTIONPREV-50:** Canceling confirmation after completing a selection must
return to a sensible state. The first implementation may return to idle with no
action dispatched, but it must not leave stale connectors, selected snapshots,
hover previews, or modal chooser state on screen.

<div id="REQ-ACTIONPREV-51"></div>

**REQ-ACTIONPREV-51:** If game state changes between preview creation and commit,
the implementation must either prevent that change while the confirmation modal is
open or revalidate the stored action before dispatch. Local synchronous play should
normally satisfy this by blocking table input behind the modal.

<div id="REQ-ACTIONPREV-52"></div>

**REQ-ACTIONPREV-52:** Confirmation and preview UI must not interfere with pending
boon choice UI. If a boon choice is pending, normal table actions remain blocked
as they are today.

<div id="REQ-ACTIONPREV-53"></div>

**REQ-ACTIONPREV-53:** Terminal run summary display takes priority over settings,
confirmation, and hover previews. When the run is won, lost, or abandoned, preview
and confirmation UI must not remain interactable above the run summary.

## AI Validation

An AI implementing this spec should verify completion with the following checks.

1. Run the repo's normal typecheck and test commands.

2. Add pure core/view tests for `previewAction`:

   - simple `DealProgress` preview reports amount and remaining Progress.
   - clearing a hazard reports `HazardResolved` and clear-hook consequences.
   - partial progress reports `HazardPartial` and partial-hook consequences.
   - `DealProgressAll` summarizes multiple affected world cards.
   - `DiscardHazard` summarizes `onDiscarded` effects.
   - `EndTurn` summarizes world hooks, player-card discard, refill, act advance,
     and terminal loss/win when applicable.

3. Add concealment tests:

   - concealed world hover does not reveal name, cost, keywords, or exact hooks.
   - `DealProgressAll` affecting concealed hazards reports broad impact without
     hidden identities.
   - confirmation summaries for concealed hazards use warning language rather than
     exact hidden effects.

4. Add risk-classification tests:

   - HP loss, destruction, discard, freeze, resource spend, and world loss are
     `harmful`.
   - clear hooks, partial hooks, act advance, boon offers, world-card adds, and
     win are at least `attention`.
   - simple gain-only actions can be `none`.

5. Add TableScene interaction tests where feasible:

   - targeted hover preview uses the unified preview path.
   - idle hover over a world card shows end-turn and discard consequences.
   - targeted hover takes priority over idle world-card hover.
   - end-turn hover/focus shows meaningful end-turn consequences.
   - preview text clears on hover-out, cancel, dispatch, and terminal summary.

6. Add confirmation tests:

   - default settings produce confirmation mode `always`.
   - `always` confirms `PlayCard`, `DiscardHazard`, and `EndTurn`.
   - `risk-only` confirms risky actions but skips risk `none` actions.
   - `off` skips action-preview confirmations.
   - canceling confirmation dispatches no action and clears stale UI.
   - committing confirmation dispatches exactly the stored action once.

7. Add settings tests:

   - settings load safely when localStorage is unavailable.
   - malformed stored settings are discarded and defaults are used.
   - confirmation mode and detailed-hover settings persist across reload.
   - adding an unknown future setting key does not break loading known settings.
   - opening and closing settings does not abandon or restart the run.

8. Run a browser smoke test:

   - start a run with confirmation mode defaulting to `always`.
   - hover a world card and confirm the bottom preview describes its hooks.
   - select a player card and hover a target; confirm targeted preview overrides
     idle world-card preview.
   - play, discard, and end turn; confirm each opens a modal.
   - change confirmation mode to `off`; confirm actions dispatch without the
     preview modal.
   - open and close settings mid-run; confirm the run continues.

9. Inspect `git diff` to confirm no preview code mutates real game state, run
   stats, runtime streams, or stored card-zone objects.
