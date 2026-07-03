---
title: Full-Screen Overlay Input Blocking via Phaser's topOnly Default
date: 2026-07-02
status: current
tags: [phaser, overlay, input-blocking, architecture, ui]
fg-type: architecture
fg-sources: [.lore/work/specs/help-screen.html]
fg-status: current
fg-evidence:
  code:
    - src/game/view/HelpOverlayView.ts
    - src/game/view/RunSummaryView.ts
    - src/game/view/SettingsOverlayView.ts
    - src/game/scenes/TableScene.ts
  symbols:
    - setInteractive
    - setDepth
---

# Full-Screen Overlay Input Blocking via Phaser's topOnly Default

Every full-canvas Phaser overlay in the client — the help overlay (`HelpOverlayView`), the win/loss screen (`RunSummaryView`), and the settings overlay (`SettingsOverlayView`) — follows the same shape: a `Phaser.GameObjects.Container` created once, positioned at canvas center, `setDepth(1000)`, and `setVisible(false)` until triggered. Each container's background rectangle calls `setInteractive()`.

## Why this is enough to block the board

No overlay explicitly disables interactivity on every card or button underneath it. Phaser's input plugin defaults to `topOnly: true`, meaning only the topmost interactive game object under the pointer receives pointer events. Because the overlay's background rectangle sits at depth 1000 — above every table card, hand card, and action button in the scene — it silently swallows all pointer events aimed at the board while the overlay is visible. No per-card `disableInteractive()` loop is needed, and none exists.

This is a convention, not an accident: any new full-screen overlay should follow the same recipe (container, depth 1000, hidden by default, interactive background) rather than inventing a bespoke input-blocking mechanism. If Phaser's global `topOnly` setting is ever changed or overridden for a specific object, every overlay built on this assumption needs re-auditing, since the depth-ordering guarantee is the only thing keeping board interaction suspended.

## Keyboard input needs its own guard

`topOnly` only governs pointer events. Keyboard-driven interactions (e.g. row navigation in `TableScene`) are not routed through Phaser's input depth stack, so they route around the overlay's pointer-blocking entirely. `TableScene.canHandleTableRowNavigationKeys()` explicitly checks `.visible` on each overlay (help, run summary, settings, action confirmation, modal/discard choosers) before allowing a keyboard shortcut to act. Escape-key dismissal of an overlay is likewise a scene-level key handler gated on that overlay's visibility, not something Phaser's depth stack provides for free.
