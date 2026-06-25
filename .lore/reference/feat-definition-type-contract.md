---
title: Feat Definition Type Contract
date: 2026-06-25
status: current
tags: [feats, type-contracts, validation]
fg-type: lesson
fg-sources: [.lore/work/notes/simplify-feat-definitions.md]
fg-status: current
---

# Feat Definition Type Contract

The feat-definition type contract is not fully aligned with the written requirements. Runtime behavior is covered by tests, but the TypeScript shapes do not express every feat and reward case the spec describes.

## Current Gaps

`RewardItem.value` does not allow booleans even though the spec allows `number | string | boolean`, which blocks boolean feat predicates such as `diedTo` at the type level.

`FeatReward` is implemented as a wrapper object with `items`, while the spec describes it as a plain `RewardItem[]` alias. `FeatDefinition` also lacks the specified `description` field, and the unlock reward variant is represented by an open catch-all instead of an explicit `{ type: "unlock"; id: string }` shape.

## Validation Rule

Passing runtime tests are not enough for this area. Any feat-definition change should also check that the exported types match the current spec contract and can represent all authored feat conditions and reward variants.
