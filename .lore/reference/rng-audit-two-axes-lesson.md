---
title: A Hidden-State Audit Must Follow Two Axes, Not Just RNG Call Sites
date: 2026-07-02
status: current
tags: [observability, audit, hidden-information, lesson, rng]
fg-type: lesson
fg-sources: [.lore/work/design/observability-boundary.md]
fg-status: current
fg-evidence:
  code:
    - src/core/effects/worldCards.ts
  tests:
    - src/core/tests/observability-conformance.test.ts
  symbols:
    - revealedFromHidden
    - ExileTopWorldCardsHandler
---

# A Hidden-State Audit Must Follow Two Axes, Not Just RNG Call Sites

When auditing which handlers need a `randomized`/`revealedFromHidden` stamp (see [[event-randomness-hidden-reveal-stamps]]), a first pass traced only `shuffle`/rng call sites and missed `ExileTopWorldCardsHandler`, which reads the top of `worldDraw` — a hidden zone — **deterministically**. No rng roll occurs, so it never surfaced in an rng-consumer search, yet it named the exiled cards in the preview summary, revealing exactly what sat on top of a hidden pile.

The lesson: a hidden-state audit needs two independent passes, not one:

1. Every `state.rng` consumer, for the `randomized` stamp.
2. Every handler that reads a hidden zone (`playerDraw`, `worldDraw`, future `acts`) **regardless of whether it rolls**, for the `revealedFromHidden` stamp.

Treat the audit itself — not the stamping mechanism — as the primary deliverable of this kind of work, and review it independently against the full effect registry. A search strategy anchored to "where randomness is consumed" will structurally miss deterministic reveals of hidden state; the two properties (random vs. hidden) are orthogonal and must be audited as such.
