---
title: Story Detail Lives in World-Select; Help Is a Phaser Overlay
date: 2026-07-02
status: current
tags: [ui, world-select, help-overlay, story, screens, decision]
fg-type: decision
fg-sources: [.lore/work/brainstorm/story-detail-and-help-screens.md]
fg-status: current
fg-evidence:
  code:
    - src/game/scenes/WorldSelectScene.ts
    - src/game/view/HelpOverlayView.ts
    - src/data/worldHelpManifest.ts
    - src/data/worlds/types.ts
  symbols:
    - WorldHelpData
    - WorldMechanicNote
---

# Story Detail Lives in World-Select; Help Is a Phaser Overlay

Two related but distinct screens were resolved with different implementations, because they have different triggers: story detail is read at a pre-run seam (world-select), where leaving the pure-canvas feel briefly is low-cost; help is consulted mid-run, where a full navigation away from the table is disruptive.

## Story Detail: No Dedicated Screen

Story detail is **not** a separate screen. Each world's select card shows a short (2-4 sentence) mood-setting paragraph — the `story` field on a world's display data (`src/data/worlds/types.ts`, rendered in `WorldSelectScene`). The explicit design intent is a vibe sketch, not lore depth: "the Walker arrives, the world goes sideways" is enough; content is authored per world alongside the rest of the world's display manifest, so it ships for free when a world is added rather than needing its own screen architecture.

## Help: Phaser Overlay, Not DOM or a Separate Page

Help is a full-canvas Phaser overlay (`HelpOverlayView`, depth 1000), the same layering pattern already used for win/loss screens, triggered by a `?` control. Content structure is base rules, then a keyword glossary, then a per-world "in this world" section of `WorldMechanicNote`s (title + detail) drawn from `worldHelpManifest`. This keeps help in-canvas and themed automatically by the world's `VisualTheme`, at the cost of hand-built scrolling/paging rather than DOM-native text flow — an explicit tradeoff, not an oversight; see [[phaser-text-heavy-overlay-tradeoffs-lesson]] for the reasoning across all the options considered (DOM overlay, stacked scene, separate web page, embedding content on-demand) and why Phaser-overlay won for this specific mid-run trigger.

The glossary was expected to start small (5-8 core terms) and grow per world as worlds ship; the brainstorm's explicit revisit trigger is "reconsider if it grows past roughly 15 entries," since a scrolling Phaser text list becomes as much implementation effort as a DOM overlay well before that point.
