---
title: Feat Definition Type Contract
date: 2026-06-25
status: current
tags: [feats, type-contracts, validation]
fg-type: lesson
fg-sources: [.lore/work/notes/simplify-feat-definitions.md]
fg-status: current
fg-evidence:
  code:
    - src/data/feats/types.ts
    - src/data/feats/catalog.ts
    - src/data/feats/catalog.json
  tests:
    - src/data/feats/catalog.test.ts
    - src/game/runtime/featEvaluator.test.ts
  symbols:
    - FeatDefinition
    - FeatReward
    - RewardItem
---

# Feat Definition Type Contract

The feat-definition type contract now covers the authored feat and reward shapes directly. Runtime behavior is still covered by tests, and the exported TypeScript shapes are the contract to check before adding new feat predicates or reward kinds.

## Current Gaps

Former gaps around boolean predicate values, feat descriptions, and explicit unlock rewards have been resolved in `src/data/feats/types.ts`. `FeatCondition.value` accepts `number | string | boolean`, `FeatDefinition` includes `description`, and `RewardItem` is a closed union for `memoryFragments` and `unlock`.

`FeatReward` remains a wrapper object with `items`, matching the current catalog JSON. Treat that wrapper shape as the live contract unless a future migration also rewrites the authored catalog and tests.

## Validation Rule

Passing runtime tests are not enough for this area. Any feat-definition change should also check that the exported types, catalog JSON, and evaluator tests still agree on every authored feat condition and reward variant.
