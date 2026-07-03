---
title: Oversized Hand Row Windowing
date: 2026-07-02
status: current
tags: [ux, hand-layout, table-scene, overflow, cards, windowing]
fg-type: architecture
fg-sources: [.lore/work/specs/oversized-hand-layout.md]
fg-status: current
fg-evidence:
  code:
    - src/game/view/tableLayout.ts
    - src/game/scenes/TableScene.ts
  tests:
    - src/game/tests/tableLayout.test.ts
    - src/game/tests/cardObjects.test.ts
  symbols:
    - rowWindowLayout
    - clampRowWindowOffset
    - rowWindowPageOffset
    - bringRowIndexIntoView
    - bringRowCardIdIntoView
    - rowWindowRangeLabel
    - ROW_WINDOW_VISIBLE_LIMIT
---

# Oversized Hand Row Windowing

`TableScene`'s world-card and player-card hand rows render a bounded, fixed-size **window** of cards rather than compressing every in-hand card to fit the 900x600 canvas. This is a renderer-only presentation layer: it does not cap hand size, hide cards from `GameState`, or change `effectiveHand()` — oversized hands (e.g. 20+ cards from world effects that add cards) remain fully legal core state, and the core continues to reason over complete hand arrays and durable card ids.

## The windowing model

`src/game/view/tableLayout.ts` holds the pure logic, deliberately separated from Phaser so it is unit-testable without constructing a scene:

- **`ROW_WINDOW_VISIBLE_LIMIT` (5)** — the fixed number of full-size, readable cards shown per row at once. Rows at or under this limit render centered with no navigation chrome, unchanged from pre-windowing behavior.
- **`clampRowWindowOffset(cardCount, desiredOffset, visibleLimit)`** — the single source of truth for a legal window offset: clamps into `[0, max(0, cardCount - visibleLimit)]`. Every other windowing function routes through this, so an offset can never point past the end of a shrunk row (e.g. after cards leave the hand).
- **`rowWindowLayout(isPlayer, cardIds, desiredOffset, rowY, visibleLimit)`** — the per-row entry point. Given the row's full ordered card-id array and a desired offset, it returns the visible id slice, computed card positions (via the existing `rowCardPositions`), a `rangeLabel` (e.g. `"6-10 of 23"`), `hasOverflow`, and independent `canPageBackward`/`canPageForward` flags.
- **`rowWindowPageOffset`** / **`rowWindowSlotOffset`** — page by a full window (paging) or by one card (fine-grained scroll/slot movement), both clamped.
- **`bringRowIndexIntoView` / `bringRowCardIdIntoView`** — used to keep a specific card visible: if the target index/id is already inside the window, the offset is unchanged; if it's outside, the offset moves the minimum amount needed to bring it into view. This backs "keep the acting card visible" (selection) and "surface a newly-added or newly-relevant card" without forcing a full re-page.
- **`rowWindowRangeLabel(startIndex, endIndex, totalCount)`** — the `"N-M of T"` label text, also usable directly in tests without going through full layout.

Each row's offset is independent state (world row and player row page separately); overflow in one row never displaces the other.

## Why this shape

The design constraint was a fixed-size visible window over shrinking card scale — card faces are text-heavy, and `CARD_FACE` dimensions are load-bearing for readability, so the alternative (compress every card into the row, which is what `rowCardPositions` alone did before) was rejected once row counts pushed spacing below card width. The windowing model operates on row-local card ids (not card kind), so it composes correctly with modified, frozen, or otherwise transformed cards that keep stable ids across state changes.

Selection, targeting, hover, connectors, and `classifyHighlight()` styling all continue to apply to whatever is in the current visible window exactly as they did in non-overflow rows; navigating away from a card during targeting does not cancel the action, and legal targets outside the current window remain reachable by navigating that row.

## Scope boundary

This is presentation-only. It does not add a maximum hand size, does not change draw/discard/freeze/boon/hazard-persistence rules, and does not rebalance any world or effect capable of producing an oversized hand. Any future core-side hand-size cap would be an unrelated, separate decision.
