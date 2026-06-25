---
title: OfferBoon Reward Path
date: 2026-06-25
status: current
tags: [offer-boon, boons, reward-choice, world-clear, core-effects]
fg-type: architecture
fg-sources: [.lore/work/plans/offer-boon-rewards.md, .lore/work/notes/offer-boon-rewards.md]
fg-status: current
fg-evidence:
  code:
    - src/core/effects/boonChoice.ts
    - src/core/engine/actBoon.ts
    - src/core/model/types.ts
    - src/data/boonPools.json
  tests:
    - src/core/tests/effects.test.ts
    - src/game/tests/boonChoiceView.test.ts
  symbols:
    - OfferBoon
    - ChooseBoon
    - BoonCardGranted
---

# OfferBoon Reward Path

`OfferBoon` generalizes the Fortune act-boon path into a reusable reward-choice system. The act-specific `pendingActBoon`, `ChooseActBoon`, and `ActBoonOffered` concepts become generic boon-choice state, action, and events.

The first implementation stays intentionally narrow: one pending boon choice, `chooseCount: 1`, exhaust player-card templates only, and no queue. That keeps world-card clear rewards and Fortune act rewards on the same engine path without broadening every reward shape at once.

## Core Behavior

A generic boon-offer helper accepts a source, set id, template pool, offered count, choose count, and destination. It filters to legal player boon templates, deduplicates candidates, advances deterministic RNG, and creates pending choice state.

`ChooseBoon` mints the selected template, enforces player/exhaust constraints, grants it to hand or discard, clears the pending choice, and emits `BoonCardGranted`.

`OfferBoon` is hook-only and fail-closed. Unknown sets, no legal options, and already-pending choices do not create partial state. The handler resolves through the shared boon-set registry rather than a local Fortune-only shim.

## Authoring Rule

Boon sets are registered once and referenced by set id. World-card `onCleared` hooks may use `OfferBoon` for cache-style rewards where player agency is better than dumping several fixed cards into the deck.

Recursive effect description and availability dispatch resolve the effect registry lazily at method-call time. This avoids the `registry -> composite -> describe/available -> registry` initialization cycle in the current effect system.
