---
title: OfferBoon Reward Path
date: 2026-06-25
status: current
tags: [offer-boon, boons, reward-choice, world-clear, core-effects]
fg-type: architecture
fg-sources: [.lore/work/plans/offer-boon-rewards.md, .lore/work/notes/offer-boon-rewards.md, .lore/work/brainstorm/offer-boon-world-clear-rewards.md]
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

`OfferBoon` generalizes the Fortune act-boon path into a reusable reward-choice system. Act rewards and world-clear rewards now share generic `pendingBoonChoices`, `ChooseBoon`, `BoonOffered`, and `BoonCardGranted` concepts, with source metadata distinguishing act offers from world-clear offers.

The implementation supports queued pending boon choices, `chooseCount` greater than one, hand or discard destinations, and exhaust player-card templates. That keeps world-card clear rewards and Fortune act rewards on the same engine path without broadening every reward shape at once.

## Core Behavior

A generic boon-offer helper accepts a source, set id, template pool, offered count, choose count, and destination. It filters to legal player boon templates, deduplicates candidates, advances deterministic RNG, and creates pending choice state.

`ChooseBoon` mints the selected template, enforces player/exhaust constraints, grants it to hand or discard, clears the pending choice, and emits `BoonCardGranted`.

`OfferBoon` is hook-only and fail-closed. Unknown sets and no legal options do not create partial state. Already-pending choices are allowed; new offers append to the queue and resolve FIFO through `ChooseBoon`. The handler resolves through the shared boon-set registry rather than a local Fortune-only shim.

## Authoring Rule

Boon sets are registered once and referenced by set id. World-card `onCleared` hooks may use `OfferBoon` for cache-style rewards where player agency is better than dumping several fixed cards into the deck.

Early authoring guidance from the design brainstorm still applies: don't replace every `GainCard` clear reward at once. Good first targets are multi-card reward caches, expensive/rare hazards whose payoff should feel like a discovery, and act-pacing reward cards. Avoid common low-cost hazards, partial-clear effects, and end-of-turn effects, where a modal interruption reads as friction rather than a moment.

## History: queueing was initially rejected, then adopted

The original design brainstorm's stated concern was `DealProgressAll` sweeping multiple world cards with `OfferBoon` hooks in one effect, creating two pending choices at once. Its initial recommendation was conservative: allow only one pending boon choice at a time, fail closed or skip a second offer, and avoid authoring `OfferBoon` on cards likely to be cleared in bulk — reasoning that a full choice queue "adds complexity to reducer blocking rules, event streams, UI, tests, and simulations" that a first implementation should avoid. The shipped implementation superseded that caution directly: pending boon choices are a queue, and multiple offers append and resolve FIFO through `ChooseBoon` rather than being dropped or blocked.

Recursive effect description and availability dispatch resolve the effect registry lazily at method-call time. This avoids the `registry -> composite -> describe/available -> registry` initialization cycle in the current effect system.
