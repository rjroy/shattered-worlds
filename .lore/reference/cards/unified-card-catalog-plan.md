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

The catalog refactor moved every card template from world JSON, starter files, and boon sources into one global template file. World deck composition and starter deck lists remain where they are and reference the unified catalog.

`CARD_CATALOG` is assembled once from `src/data/allCards.json`. `buildWorld(worldId, starterId)` pairs that shared catalog with a world deck descriptor and a chosen starter deck; the public `worldManifest` still exposes per-world builders that accept `starterId`.

## Safety Net

The architecture depends on duplicate-template validation and reference integrity checks. Every `GainCard`, `AddWorldCardToDeck`, `AddPlayerCardToTop`, deck composition entry, boon set, and loot pool reference must resolve against the unified catalog.

Tests assert catalog contents, starter/world references, boon set references, loot pool references, and `CARD_CATALOG` equivalence to the assembled unified file rather than inspecting per-world merge intermediates.

## Risk

Centralizing template definitions improves consistency but makes template-id typos less visually local. The mitigation is stricter automated reference checking, not ad hoc per-world merge assertions.
