---
title: Destiny Progression
date: 2026-07-02
status: current
tags: [destiny, meta-progression, unlocks, retention, run-integrity]
fg-type: concept
fg-sources: [.lore/work/brainstorm/shattered-worlds-meta-progression.md]
fg-status: current
fg-evidence:
  code:
    - src/data/feats/catalog.ts
    - src/data/unlocks/catalog.ts
    - src/game/runtime/featsProfile.ts
    - src/game/runtime/unlocksProfile.ts
    - src/game/runtime/runStats.ts
    - src/game/runtime/witnessProfile.ts
  tests:
    - src/data/unlocks/catalog.test.ts
    - src/game/runtime/featEvaluator.test.ts
    - src/game/runtime/unlocksProfile.test.ts
  symbols:
    - computeFragmentBalance
    - computeSpendableBalance
    - buildRunModifiers
---

# Destiny Progression

Destiny is the between-run progression layer. Its job is to widen the game without flattening the run. It may unlock new choices, memories, starter variants, world access, and modest early-run help, but it must not let a patient player buy past the hardest content.

## Design Thesis

Runs remain disposable and skill-demanding. What persists is possibility space: more ways to start, more paths through worlds, more tools to express a plan, and more knowledge about what survived the shattering. Progression should make returning meaningful while preserving the summit as a play challenge.

## What Persists

Every meta-progression form is an answer to one question: what is allowed to persist when a world ends? The design deliberately leaves one answer empty — **power**, meaning numbers that persist (permanent HP, energy, draw, or flat damage). Everything that has shipped or been proposed persists something else instead:

- **Options persist** — more choices before and during a run. The Destiny Blessing catalog (see [[destiny-blessing-catalog-design]]) and world-access unlocks (see [[world-access-unlocks]]) live here.
- **Knowledge persists** — the player's information state carries over. [[witness-knowledge-system]] lives here: threats the player has encountered or died to become legible in feat conditions.
- **Story persists** — meaning accumulates with zero balance surface. Feats of Survival (see [[feat-definition-type-contract]], [[feat-evaluation-memory-fragments]]) live here: unlocks gated behind doing a play pattern, not spending currency.
- **People, the world, and the challenge persisting** (a rescued-survivor system, worlds that remember runs, and earned-harshness difficulty tiers) were proposed but remain unbuilt. See [[meta-progression-rejected-approaches]] for shapes that were considered and explicitly rejected rather than merely deferred.

## First Implementation Bias

The safest first stack is unlocks and loadout-like choices rather than raw stat growth. Persistent power can exist only where it softens the foothills; it should never erase late-run tension or make difficult worlds automatic.

The stack that actually shipped matches the brainstorm's proposed "coherent first stack" closely: a purchase-and-activate Blessing catalog as the loadout spine, Feats of Survival as the earn mechanism, and Witness Knowledge arriving for free from dying. None of this required a currency design beyond Memory Fragments earned from feats — the harder open question (what a "winning" currency is, per-world vs. per-act vs. per-feat) was deferred rather than answered, matching the brainstorm's own reasoning that this stack "needs no currency design at all."
