---
title: Randomness/Hidden-Reveal Event Stamps (randomized, revealedFromHidden)
date: 2026-07-02
status: current
tags: [observability, preview, game-event, rng, hidden-information, architecture]
fg-type: architecture
fg-sources: [.lore/work/design/observability-boundary.md]
fg-status: current
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/core/view/actionPreview.ts
    - src/core/engine/draw.ts
    - src/core/effects/gainCard.ts
    - src/core/effects/heat.ts
    - src/core/effects/recallDiscard.ts
    - src/core/effects/worldCards.ts
    - src/core/engine/actBoon.ts
  tests:
    - src/core/tests/observability-stamps.test.ts
    - src/core/tests/observability-conformance.test.ts
  symbols:
    - randomized
    - revealedFromHidden
---

# Randomness/Hidden-Reveal Event Stamps (`randomized`, `revealedFromHidden`)

`GameEvent` carries two optional boolean stamps, siblings of the existing `sourceCardId` provenance field:

- `randomized` — the outcome was chosen via rng at resolution time (freeze-at-random victims, `GainRandomCard` template rolls, random discard-recall, boon offers).
- `revealedFromHidden` — the event's identities came from a hidden zone (`playerDraw`, `worldDraw`), whether or not rng was involved in choosing them.

The preview layer's masking rule collapses to one invariant: **any event carrying `randomized` or `revealedFromHidden` is summarized generically**, full stop. This replaced a previous approach where the summary layer (`actionPreview.ts`) pattern-matched each stochastic effect individually to decide whether to mask it — a whack-a-mole that silently missed new effects.

## Where the stamp is set

Unlike `sourceCardId`, which is stamped once at the `applyEffect` boundary because every event from one hooked card shares a single source, these stamps cannot be applied at a shared boundary. Within a single effect, some emitted events are random and some are not — the clearest example is `recallDiscard`, where only the `random` policy is stamped and the deterministic policies (latest/lowestCost/highestCost/panicFirst) are not. Each emitting handler stamps its own event, at the point the dice are rolled or the hidden zone is read — not where the summary text is written.

## Why this matters beyond the summary text

`ActionPreview.events` is public API and carries real `templateIds`. A clean summary string does not protect against something that later renders or animates the raw preview events instead of the text. The stamp on the event itself (not just a downstream text rule) is what closes that hole, and it is also what tells the sim agent where uncertainty enters a rollout — see [[observability-boundary-shared-model]].

A fail-closed conformance test (`src/core/tests/observability-conformance.test.ts`) asserts that every event type known to originate from an rng-consuming or hidden-zone-reading handler reaches the preview carrying one of these stamps, so a new stochastic effect fails the test until it stamps correctly instead of silently leaking.
