---
title: Oversized hand layout
date: 2026-06-25
status: draft
tags: [ux, hand-layout, table-scene, overflow, cards]
modules: [game-ui, game-tablescene, game-layout]
related: [.lore/work/specs/action-impact-preview-and-confirmation.md, .lore/reference/world-deck-loop.md]
req-prefix: HANDLAYOUT
---

# Oversized hand layout

## Context

`TableScene` currently treats every in-hand card as directly renderable on the
table. `drawAll()` builds `visibleHand`, splits it into world cards and player
cards, then calls `layoutRow()` once for each row. `layoutRow()` asks
`rowCardPositions(cards.length, rowY)` for one position per card and creates or
reuses a `CardView` for every card in that row.

The layout helper compresses a row to fit the fixed 900x600 canvas. That works
for ordinary hands, but it fails as a UX once the game state legitimately holds
many cards. At 20 cards, the computed row spacing is far below the card width,
so cards stack into an unreadable, hard-to-click strip. This is not a balance or
rules problem: the game may allow more than 20 cards in hand. The table UI must
make that state playable without changing core hand ownership, draw/discard
rules, effect legality, or action dispatch.

Relevant code:

- `src/game/scenes/TableScene.ts:441` reads the effective hand.
- `src/game/scenes/TableScene.ts:448` and `src/game/scenes/TableScene.ts:456`
  lay out world and player hand rows independently.
- `src/game/scenes/TableScene.ts:593` uses `rowCardPositions(cards.length, rowY)`.
- `src/game/view/tableLayout.ts:17` compresses total row width, shrinking
  spacing as count rises.

## Scope

In scope:

- A renderer-side oversized-hand presentation for both hand rows that can hold
  more cards than the table can show at once.
- Navigation affordances for reaching every in-hand card.
- Preservation of existing card interactions: play, discard, target selection,
  hover previews, connectors, highlighting, confirmation, and cancel flow.
- Tests for the pure layout/windowing model and scene-level behavior.

Out of scope:

- Adding a maximum hand size.
- Changing draw, discard, freeze, boon, hazard persistence, or end-turn rules.
- Changing card dimensions or replacing `CardView`.
- Rebalancing any world, card, or effect that can create oversized hands.

## Requirements

<div id="REQ-HANDLAYOUT-1"></div>

**REQ-HANDLAYOUT-1:** Oversized hands must remain legal game states. The solution
must not cap hand size, discard excess cards, hide cards from `GameState`, block
effects that add cards, or make `effectiveHand()` return fewer cards.

<div id="REQ-HANDLAYOUT-2"></div>

**REQ-HANDLAYOUT-2:** `TableScene` must render a bounded number of full-size,
readable cards per row at a time. When a world-card row or player-card row
contains more cards than fit readably on the table, the row must show a visible
window of cards rather than compressing every card into the row.

<div id="REQ-HANDLAYOUT-3"></div>

**REQ-HANDLAYOUT-3:** Every card in an oversized row must be reachable through
explicit row navigation. Navigation may be paging, scrolling by fixed slots, or
a carousel, but it must expose the current range and total count, such as
`6-10 of 23`, so the player can tell that more cards exist off-screen.

<div id="REQ-HANDLAYOUT-4"></div>

**REQ-HANDLAYOUT-4:** Row navigation must be independent per row. Overflow in
the player-card row must not force world cards off-screen, and overflow in the
world-card row must not force player cards off-screen.

<div id="REQ-HANDLAYOUT-5"></div>

**REQ-HANDLAYOUT-5:** The visible window must preserve card identity and order.
Cards must appear in the same relative order as their source row, and paging or
scrolling away from a card must not destroy gameplay state, selected target ids,
or effective-card display signatures.

<div id="REQ-HANDLAYOUT-6"></div>

**REQ-HANDLAYOUT-6:** Selection state must keep the acting card visible when
possible. If the player starts targeting from a card and then row layout updates,
the acting card must remain visible or be brought back into view so the player
can still read the source of the action and any connector.

<div id="REQ-HANDLAYOUT-7"></div>

**REQ-HANDLAYOUT-7:** Legal targets outside the current visible window must be
reachable without canceling the action. During targeting, the player must be
able to navigate the relevant row and select any legal target that exists in
the underlying hand.

<div id="REQ-HANDLAYOUT-8"></div>

**REQ-HANDLAYOUT-8:** Existing hover and targeting feedback must continue to
work on visible cards. Hover previews, card emphasis, connector drawing,
concealment handling, and `classifyHighlight()` styling must apply to visible
cards exactly as they do in non-overflow rows.

<div id="REQ-HANDLAYOUT-9"></div>

**REQ-HANDLAYOUT-9:** Navigation controls and range labels must be pointer-safe.
They must not intercept card clicks except where the player is directly using a
navigation affordance, and they must not overlap the HUD, pile stacks, end-turn
button, cancel/confirm buttons, preview slot, selection hint, modals, tooltips,
or run summary.

<div id="REQ-HANDLAYOUT-10"></div>

**REQ-HANDLAYOUT-10:** Repaints after dispatch, hover, selection changes, and
boon/discard modal closure must preserve each row's window offset when the same
cards remain available. If cards leave the hand, offsets must clamp to the
nearest valid window instead of snapping to an empty page.

<div id="REQ-HANDLAYOUT-11"></div>

**REQ-HANDLAYOUT-11:** Newly relevant cards must be discoverable. When a new
card is added to hand, a card becomes the selected acting card, or a required
target step can only be satisfied by off-screen cards, the UI must either adjust
the row window or provide a clear off-screen-legal-target indicator.

<div id="REQ-HANDLAYOUT-12"></div>

**REQ-HANDLAYOUT-12:** The pure layout logic must be separated from Phaser
objects. The choice of visible slice, offset clamping, range label, and card
positions must be testable without constructing `TableScene`.

<div id="REQ-HANDLAYOUT-13"></div>

**REQ-HANDLAYOUT-13:** Existing normal-hand behavior must remain stable. Rows
that fit within the readable visible limit must continue to render centered
without navigation chrome, and current tests around one-card and small-row
positioning must continue to pass or be updated only to reflect intentional
readability thresholds.

<div id="REQ-HANDLAYOUT-14"></div>

**REQ-HANDLAYOUT-14:** The solution must support mouse, keyboard, and touch-style
navigation at the scene level where practical. Wheel or drag navigation is
acceptable as an enhancement, but visible click/tap controls are required so
the overflow state is discoverable.

## Design Constraints

- Prefer a fixed-size visible window over shrinking card scale. The card face is
  text-heavy, and the current `CARD_FACE` dimensions are part of readability.
- Keep row navigation local to the table renderer. The core should continue to
  reason over full hand arrays and durable card ids.
- The windowing model should operate on row-local card ids, not card kind alone,
  because future rows may contain modified, frozen, or otherwise transformed
  cards with stable ids.
- It is acceptable for non-visible cards not to have live `CardView` objects,
  provided hidden containers are destroyed cleanly and recreated with the same
  behavior when they re-enter the window.

## AI Validation

The AI should verify completion with the following checks:

1. Run the unit tests for table layout/windowing. Tests must cover empty rows,
   fitting rows, oversized rows, offset clamping, range labels, stable order, and
   independent offsets for world and player rows.
2. Add or update scene tests around `TableScene.drawAll()` with a hand containing
   more than 20 cards. The test must prove the scene creates visible `CardView`
   objects only for the row window, exposes navigation state, and can page to a
   card that was initially off-screen.
3. Add or update interaction tests proving that a card initially off-screen can
   still be played, discarded, or targeted after navigating to it.
4. Add or update targeting tests proving that selecting an acting card and then
   navigating target rows does not cancel selection and does not lose legal
   target highlighting for visible cards.
5. Run the existing card object, table layout, and gameplay interaction tests:
   `bun test src/game/tests/tableLayout.test.ts src/game/tests/cardObjects.test.ts`.
6. Start the game locally and inspect an oversized-hand scenario in the browser.
   Confirm that cards remain readable, navigation controls are visible, range
   counts are accurate, hover previews and connectors still render, and no table
   controls overlap at the 900x600 game viewport.
