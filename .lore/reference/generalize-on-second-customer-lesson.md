---
title: Generalize an Engine Primitive Only When a Second Customer Needs It
date: 2026-07-02
status: current
tags: [engine-design, refactoring, keywords, persistence, sequencing]
fg-type: lesson
fg-sources: [.lore/work/brainstorm/fog-beach-party-world.md, .lore/work/brainstorm/stats-persistence-and-player-views.md]
fg-status: current
---

# Generalize an Engine Primitive Only When a Second Customer Needs It

Two unrelated design brainstorms independently landed on the same sequencing rule: don't generalize a primitive speculatively, and don't leave it bespoke once a second concrete use case exists.

**[[fog-beach-party-world]]** needed a numeric-valued keyword (`Concealed:N`, how deep a hazard sits in the fog). Rather than bolt a one-off `conceal: number` field onto cards, the design generalized the existing flag-only `Keyword` type to optionally carry a value (`{ name: KeywordName; value?: number }`), authored as `"Name:N"` strings parsed at mint. The generalization was justified specifically because a second world (Whiteout, the *freeze* world) also wanted a numeric keyword (`Frozen:N`) in the same shape — one customer alone would not have justified the wider change. The rule that fell out: **sequence the engine slice before the content slice** that needs it, and let the second concrete need be the trigger, not a guess about future needs.

The stats-persistence brainstorm ([[run-stats-persistence-architecture]]) hit the same shape from the other direction: `runStats.ts` already hand-rolls a load/validate/version/persist cycle for one localStorage key. Destiny profiles, settings, and a future suspended-run save would each want the identical cycle. The brainstorm's explicit call: extracting that cycle into a shared `versionedStorage` helper is cheap "if done as extraction-on-second-use" but expensive "if done as an up-front save framework with one customer" — so wait for the second concrete key before extracting.

The general lesson: a single use site is evidence the shape is *needed*, not evidence the shape is *general*. Wait for the second real consumer to confirm the abstraction boundary before generalizing; generalizing off one example risks guessing the wrong axis of variation.
