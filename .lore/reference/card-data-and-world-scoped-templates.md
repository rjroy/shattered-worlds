# Card Data and World Scoped Templates

<!--
date: 2026-06-15
status: current
tags: card-data, json, catalog, world-id, provenance, templates
fg-type: architecture
fg-sources: .lore/work/specs/card-data-externalization.html, .lore/work/plans/card-data-externalization.html, .lore/work/notes/card-data-externalization.html
fg-status: current
fg-evidence:
  code:
    - src/core/model/catalog.ts
    - src/core/engine/world.ts
    - src/data/allCards.json
    - src/data/worlds/registry.ts
  tests:
    - src/core/tests/catalog.test.ts
    - src/core/tests/worldRegistry.test.ts
    - src/core/tests/worldManifest.test.ts
  symbols:
    - CardCatalog
    - buildWorld
    - worldId
-->

Card templates and deck composition are authored as JSON content, not inline TypeScript. A run assembles a catalog from the shared starter source plus the active world's source. Minting cards goes through that catalog and stamps card provenance, including the card's source world.

## Rules

`worldId` is the join key across world JSON, world manifests, visual themes, assets, help text, and display manifests. Starter cards use `starter` as their source world. Theme cards belong to their world; reward cards should remain mechanically distinct so a deck carries the fingerprint of the worlds it passed through.

The catalog must fail loudly before world creation if required JSON is absent, invalid, or incomplete. The game must not silently proceed with a missing starter source, missing active-world source, or unresolved template reference.

## Renderer Impact

Card provenance is a presentation seam, not a core presentation leak. The core stores source identity as data; the renderer maps it to visual theme choices. Today player cards still use generic fronts in some cases, but the lookup is correctly keyed for future per-world art.
