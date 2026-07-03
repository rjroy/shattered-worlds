---
title: World Select Uses Full-Window Paging, Not the Decided Shift-by-One Carousel
date: 2026-07-02
status: current
tags: [world-select, ui, carousel, paging, decision-drift]
fg-type: lesson
fg-sources: [.lore/work/brainstorm/new-world-concepts.md, .lore/work/specs/world-select.html]
fg-status: current
fg-evidence:
  code:
    - src/game/scenes/worldSelectPaging.ts
    - src/game/scenes/WorldSelectScene.ts
    - src/game/view/layout.ts
  tests:
    - src/game/tests/worldSelectCarousel.test.ts
  symbols:
    - canPageLeft
    - canPageRight
    - pageLeft
    - pageRight
    - visibleWorldCount
---

# World Select Uses Full-Window Paging, Not the Decided Shift-by-One Carousel

World Select shipped originally as a fixed three-card row (`.lore/work/specs/world-select.html`; see [[world-select-scene-and-display-manifest]] for that original scene architecture). It outgrew that single row once a fourth world (Overgrown Mall) was approved: at `WORLD_SELECT_LAYOUT` card width and gap, four or more cards no longer fit the canvas. The 2026-06-11 brainstorm (`.lore/work/brainstorm/new-world-concepts.md`) recorded an explicit decision for how to handle this: a **shift-by-one carousel**, where arrows tween the row one card at a time and edge cards peek at partial opacity — and explicitly rejected two alternatives, **page-flip-by-3** (calling it out by name as producing "orphan pages") and shrinking the cards.

## What Actually Shipped

`WORLD_SELECT_LAYOUT.visibleWorldCount` (`src/game/view/layout.ts`) is `3`. `worldSelectPaging.ts`'s `pageLeft`/`pageRight` step the visible window's start index by the **full `visibleWorldCount`** on every arrow press, clamped to the ends:

```ts
pageRight(start, worldCount, visibleCount) =>
  canPageRight ? min(start + visibleCount, worldCount - visibleCount) : start
```

This is a full-window page flip, not a one-card shift — the exact "page-flip-by-3" shape the brainstorm rejected. There is no partial-opacity peek at the edges; each arrow press swaps the entire visible set of three cards for the next three.

## Why This Matters

This is a case where a recorded design decision and the shipped implementation diverge, and nothing in the codebase or lore currently flags the gap. It is not necessarily wrong — full-window paging is simpler to implement and test (see `worldSelectPaging.ts`'s pure, scene-independent helpers) — but it reintroduces the "orphan page" concern the brainstorm raised: with `visibleWorldCount = 3` and a growing world roster, the last page can be a partial, uneven group.

If World Select visual polish comes up again, treat this as an open item: either implement the originally decided shift-by-one carousel, or explicitly re-decide in favor of full-window paging so the design record matches reality.
