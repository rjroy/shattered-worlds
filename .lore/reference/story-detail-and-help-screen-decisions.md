---
title: Story Detail Lives in World-Select; Help Is a Phaser Overlay
date: 2026-07-02
status: current
tags: [ui, world-select, help-overlay, story, screens, decision]
fg-type: decision
fg-sources: [.lore/work/brainstorm/story-detail-and-help-screens.md, .lore/work/specs/world-select.html, .lore/work/specs/help-screen.html]
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

Help is a full-canvas Phaser overlay (`HelpOverlayView`, depth 1000), the same layering pattern already used for win/loss (`RunSummaryView`) and the settings overlay, triggered by a `?` control and dismissed by its own close control or Escape. This keeps help in-canvas and themed automatically by the world's `VisualTheme`, at the cost of hand-built layout/paging rather than DOM-native text flow — an explicit tradeoff, not an oversight; see [[phaser-text-heavy-overlay-tradeoffs-lesson]] for the reasoning across all the options considered (DOM overlay, stacked scene, separate web page, embedding content on-demand) and why Phaser-overlay won for this specific mid-run trigger.

The `help-screen.html` spec (2026-06-08) proposed a single fixed 3-section panel (Base Rules, Keywords, In This World) sized to fit the 900×600 canvas with no scrolling. The shipped `HelpOverlayView` outgrew that shape: it is a 5-tab paged reference (Turn, Hazards, Tools, Icons, World), with per-page content built largely from icon tooltips (`EFFECT_ICON_TOOLTIPS`) and callouts rather than a static keyword-definition table. The one part of the spec's data contract that did survive unchanged is the per-world seam: `WorldHelpData.mechanics: readonly WorldMechanicNote[]` (title + detail), now sourced per-world from each world bundle's `help` field (`src/data/worlds/<world>/meta.ts`) and assembled into `worldHelpManifest` via `derive(worldDataRegistry, (b) => b.help)`, consumed by the overlay's "World" tab. A completeness test (`src/core/tests/worldHelpManifest.test.ts`) still guards that every registered world has at least one mechanic note — the spec's original "no game left without a help entry" concern (REQ-HELP-12) held even as the surrounding layout changed. bird-building and highway-volcano, placeholder-only when the spec was written, now ship real per-world mechanic notes rather than the deferred placeholder text the spec anticipated.
