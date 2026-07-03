---
title: Feat Definition Type Contract
date: 2026-06-25
status: current
tags: [feats, type-contracts, validation]
fg-type: lesson
fg-sources: [.lore/work/notes/simplify-feat-definitions.md, .lore/work/brainstorm/feat-definitions.md]
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

## Design rationale

`statId` is a flat string, not a typed enum, and is namespaced by dot-notation prefix rather than a separate condition-type field per scope: a bare `finalHp` or `outcome` reads against the just-completed `RunRecord`, `witness.<ThreatName>.<field>` reads cross-run witness data (e.g. `witness.Zombie.resolvedCount`), and `lifetime.<field>` or `world.<worldId>.<field>` reads cumulative `LifetimeStats` (shipped as `lifetime.wins`, `world.fog-beach-party.wins`, etc. — the brainstorm's original proposal used `lifetime.byWorld.<worldId>.<field>`; the shipped catalog flattened per-world stats to a top-level `world.` prefix instead). This keeps one condition shape for all three scopes instead of three condition types.

`operator` carries a separate `is` alongside the numeric comparisons (`gte`/`lte`/`gt`/`lt`/`eq`) specifically for categorical and boolean stats (`outcome is won`, `witness.Zombie.diedTo is true`). The reasoning: forcing a boolean through `eq 1`/`eq 0` leaks representation detail into every feat author's head. A `neq` operator was considered and deliberately left out — anything it would express reads fine as the complementary numeric/boolean check (`healingReceived lte 0` instead of `healingReceived neq 0`).

`RewardItem` is a discriminated union (`memoryFragments` | `unlock`) wrapped in `FeatReward.items`, rather than named optional fields (`{ memoryFragments, unlock? }`). The union was chosen specifically so a future third reward kind is an additive union member, not a structural change to every existing feat — code that doesn't understand a new item type can skip it safely. Feat conditions are also a flat list, implicitly AND'd; OR logic is deliberately not supported in a single feat definition — an OR case is authored as two separate feats instead.
