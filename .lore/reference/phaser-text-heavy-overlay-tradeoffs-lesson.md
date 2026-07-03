---
title: Choosing Where Text-Heavy Content Lives in a Fixed Phaser Canvas
date: 2026-07-02
status: current
tags: [phaser, ui, dom-overlay, scrolling, screens, lesson]
fg-type: lesson
fg-sources: [.lore/work/brainstorm/story-detail-and-help-screens.md, .lore/work/specs/help-screen.html]
fg-status: current
---

# Choosing Where Text-Heavy Content Lives in a Fixed Phaser Canvas

The game lives inside a fixed-size Phaser canvas. Text-heavy content (narrative detail, a mechanics glossary) is fundamentally in tension with that container: Phaser text objects are expensive at volume, scrolling needs custom code, but leaving the canvas — a new tab, a DOM overlay, a separate page — risks breaking the immersive "game shell" feel the rest of the project protects carefully.

Five implementation shapes were weighed against each other for this project, and the trade generalizes to any future full-screen text content:

1. **Phaser full-screen overlay** (containers at high depth, the pattern already used for win/loss screens) — zero immersion break, automatically themed by the world's visual theme, but every paragraph is Phaser text objects and scrolling is hand-rolled.
2. **Phaser stacked scene** (`scene.launch`/`scene.bringToTop` on top of the active scene) — clean pause/resume of the underlying scene, but the same text-heavy cost as option 1 with no new rendering capability.
3. **DOM overlay on the canvas** (`scene.add.dom()` or a plain absolutely-positioned `<div>`) — real scrolling, markdown-able rich text, easy to author, but it splits the app into two rendering pipelines with separate theming and a different pointer/interaction model.
4. **Separate web page** (same domain, e.g. a Vite multi-page route) — richest formatting, shareable links, but it leaves the game context and needs a "return to game" affordance, plus multi-page build complexity.
5. **Content embedded in game data, rendered on demand** (tooltips, inline card detail, no dedicated screen) — no new screen architecture, context-sensitive, but a glossary loses its overview shape and gets fragmented across interaction points.

## The Resolving Heuristic

The right choice depends on **when the content is read**, not on the content type alone. A pre-run or between-run trigger (world-select, a lore button) sits at a seam where immersion is already paused, so leaving the pure-canvas experience briefly costs little — richer HTML or a DOM panel is fine there. A mid-run trigger (a `?` help button hit in the middle of play) wants the lowest-friction return to the board, which favors staying in-canvas even at the cost of cruder text handling. Two on-paper-similar "big text screen" problems can legitimately get different answers once the trigger context is accounted for. This project resolved it as: [[story-detail-and-help-screen-decisions]].

## Rejected Approaches Worth Remembering

- **`window.open` for story or help** — breaks popup blockers, loses game focus, an immediate no regardless of content volume.
- **A scrollable Phaser text list with a mask and drag handler** — technically possible, but the implementation cost converges on 80% of a DOM overlay's cost while delivering fewer capabilities. The rule of thumb: if the content needs scrolling, that's the signal to use DOM rather than fight Phaser text into a scroll view.
- **Combining two purpose-different screens into one** (e.g. story and help together) — they serve the player at different moments and for different reasons; merging them muddles both rather than saving screens.
