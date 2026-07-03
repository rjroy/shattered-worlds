---
title: WorldSelectScene Replaces BootScene's Random World Assignment
date: 2026-07-02
status: current
tags: [world-select, scene-architecture, boot-scene, display-manifest, decision]
fg-type: architecture
fg-sources: [.lore/work/specs/world-select.html]
fg-status: current
fg-evidence:
  code:
    - src/game/scenes/BootScene.ts
    - src/game/scenes/WorldSelectScene.ts
    - src/data/worldDisplayManifest.ts
    - src/data/worlds/types.ts
  tests:
    - src/core/tests/worldDisplayManifest.test.ts
---

# WorldSelectScene Replaces BootScene's Random World Assignment

Before this spec, `BootScene` picked a world and generated a seed itself. `WorldSelectScene` was inserted between `BootScene` and `TableScene` so the player chooses a world instead of one being assigned: `BootScene.create()` now does nothing but `this.scene.start('WorldSelect')`, and `TableScene.init` keeps its existing `{ worldId, seed }` contract unchanged — only the caller moved. Each world-card click generates a fresh seed (`Math.floor(Math.random() * 2 ** 32)`, the same formula BootScene used) and starts `'Table'`; there is no seed persistence or display.

## Display Data Is a Separate Authoring Surface

`worldDisplayManifest` (originally specced as a flat authored `Record<string, WorldDisplayData>` in its own file) is the single source for world-card UI text — name, tagline, a 2-4 sentence mood-setting `story` paragraph — deliberately kept out of `worldManifest`/`WorldData` so neither `TableScene` nor any game-logic module needs to import it. The shape has since grown (`cycle`, `difficulty`, `backgroundKey` were added alongside `name`/`tagline`/`story` — see `src/data/worlds/types.ts`), and the manifest itself is now derived per-world from each world's `meta.ts` via a shared registry (`derive(worldDataRegistry, (b) => b.display)` in `src/data/worldDisplayManifest.ts`) rather than hand-authored as one flat literal — but the original decision (a display-only data model, separate from game-logic `WorldData`) still holds.

Two guards enforce completeness:
- A unit test (`src/core/tests/worldDisplayManifest.test.ts`) asserts every `worldId` key in the game manifest has a corresponding, non-empty-shaped entry in `worldDisplayManifest`, iterating keys only (it must not invoke world-builder functions, which throw outside a Phaser asset cache).
- `WorldSelectScene` throws immediately at scene load (`"No display entry for worldId: <id>"`) if a lookup ever misses — a belt-and-suspenders fallback behind the test.

## Superseded Layout

The original spec called for exactly three world cards in a fixed horizontal row (~240px wide, ~30px gap, centered), each card tinted with the world's `intrusionHue` theme color and no preloaded backdrop art. That fixed 3-card layout was outgrown once a fourth world shipped and was replaced by full-window paging — see [[world-select-carousel-paging]] for what the carousel layout actually does and how it diverges from an even later *shift-by-one* redesign decision. The per-card content model (name, tagline, story, theme-tinted background) and the hover/click interaction (scale-up emphasis on `pointerover`, `scene.start`/`scene.launch` on click) carried forward unchanged into the carousel.

Related: [[story-detail-and-help-screen-decisions]] (the `story` field's role once it's on the card), [[world-select-carousel-paging]] (what replaced the fixed 3-card row).
