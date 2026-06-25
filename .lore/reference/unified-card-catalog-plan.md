---
title: Unified Card Catalog Plan
date: 2026-06-25
status: current
tags: [card-catalog, templates, data-architecture, world-manifest, refactor]
fg-type: architecture
fg-sources: [.lore/work/plans/plan-unified-card-catalog.md]
fg-status: current
fg-evidence:
  code:
    - src/core/model/catalog.ts
    - src/core/engine/world.ts
    - src/data/allCards.json
    - src/data/worlds/registry.ts
  tests:
    - src/core/tests/catalog.test.ts
    - src/core/tests/worldManifest.test.ts
    - src/core/tests/verify-merge.test.ts
  symbols:
    - CardCatalog
    - GainCard
    - AddWorldCardToDeck
---

# Unified Card Catalog Plan

The planned catalog refactor moves every card template from world JSON, starter files, and boon sources into one global template file. World deck composition and starter deck lists remain where they are and become references into the unified catalog.

Today each world assembles its own catalog from basics, boon sets, and that world's templates. The refactor replaces per-world template merging with one imported catalog paired with each world's deck descriptor.

## Safety Net

The transition depends on automated extraction, duplicate-template validation, and reference integrity checks. Every `GainCard`, `AddWorldCardToDeck`, `AddPlayerCardToTop`, deck composition entry, boon set, and loot pool reference must resolve against the unified catalog.

Tests that currently assert intermediate merge counts or inspect `source.cardTemplates` must be rewritten to assert catalog contents and reference validity instead. The public `buildWorld(starterId)` shape is preserved.

## Risk

Centralizing template definitions improves consistency but makes template-id typos less visually local. The mitigation is stricter automated reference checking, not ad hoc per-world merge assertions.
