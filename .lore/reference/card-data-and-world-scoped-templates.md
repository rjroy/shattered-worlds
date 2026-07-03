---
title: Card Data and World Scoped Templates
date: 2026-07-02
status: current
tags: [card-data, json, catalog, world-id, provenance, templates]
fg-type: architecture
fg-sources: [.lore/work/specs/card-data-externalization.html, .lore/work/plans/card-data-externalization.html, .lore/work/notes/card-data-externalization.html]
fg-status: current
fg-evidence:
  code:
    - src/core/model/catalog.ts
    - src/core/engine/world.ts
    - src/core/model/cards.ts
    - src/data/allCards.json
    - src/data/worldManifest.ts
    - src/data/worlds/registry.ts
  tests:
    - src/core/tests/catalog.test.ts
    - src/core/tests/worldRegistry.test.ts
    - src/core/tests/worldManifest.test.ts
    - src/core/tests/cards.test.ts
  symbols:
    - CardCatalog
    - buildWorld
    - worldId
    - sourceWorldId
---

# Card Data and World Scoped Templates

Card templates and deck composition are authored as JSON content, not inline TypeScript. `mintCard` takes an explicit `catalog: CardCatalog` parameter (no module-level catalog global) and stamps each minted `PlayerCard` with `sourceWorldId`, its card provenance.

The originating spec (`card-data-externalization.html`, drafted 2026-06-04, status draft) proposed a catalog assembled per-run from a separate `starter.json` plus the active world's own JSON, each carrying its own `cardTemplates`. That per-world split did not survive: it was superseded by the unified-catalog refactor (see [Unified Card Catalog Plan](unified-card-catalog-plan.md)). Today every card template for every world lives in one file, `src/data/allCards.json`, assembled once into `CARD_CATALOG` at import time via Vite's static JSON import (`src/data/worldManifest.ts`) — not via Phaser's runtime asset loader, which the draft spec had assumed. Per-world `cards.json` files (`src/data/worlds/<worldId>/cards.json`) now carry only `worldId` and `deckComposition`; `buildWorld(worldId, starterId)` pairs the shared `CARD_CATALOG` with a world's deck composition and a chosen starter deck.

## Rules

`worldId` is the join key across world JSON, world manifests, visual themes, assets, help text, and display manifests. `GameState.worldId` starts at `"basic"` before a world is entered — the draft spec's proposed literal value was `'starter'`, which is not what shipped, though the intent (stamp pre-world cards with a distinct, non-world provenance) holds. `mintCard` derives `sourceWorldId` from `state.worldId` at mint time; the field is set once and never mutated. `WorldCard` instances never carry `sourceWorldId` — world cards are always of the currently active world and render from `state.worldId` directly, never from a value stamped at mint time.

Theme cards belong to their world; reward cards should remain mechanically distinct so a deck carries the fingerprint of the worlds it passed through.

The catalog must fail loudly before world creation if required JSON is absent, invalid, or incomplete: `assembleCatalog` throws on a duplicate `templateId` across sources, and `mintCard` throws a typed `UnknownTemplateError` for a template id absent from the catalog. The game must not silently proceed with a missing catalog source, an unresolved template reference, or a silently-ignored unknown id.

## Renderer Impact

Card provenance is a presentation seam, not a core presentation leak. The core stores source identity as data (`card.sourceWorldId`); the renderer's `selectCardFrontKey` resolves a player card's front theme by that field, falling back to the generic `'cardfront'` key since no world currently defines per-world player-card art. An unrecognized `sourceWorldId` resolves through the same theme-registry fallback as any unknown `worldId` (see [Theme Authoring](theme-authoring.md)): the dedicated `STARTER` theme, not `zombie-big-box` as the draft spec assumed.
