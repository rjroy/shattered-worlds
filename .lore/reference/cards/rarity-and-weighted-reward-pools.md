---
title: Rarity and Weighted Reward Pools
date: 2026-06-25
status: current
tags: [rarity, weighted-draw, rewards, boons, gain-random-card]
fg-type: architecture
fg-sources: [.lore/work/plans/rarity-system.md, .lore/work/notes/rarity-system.md, .lore/work/brainstorm/rarity-system.md, .lore/work/specs/rarity-system.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/weightedDraw.ts
    - src/core/effects/pools.ts
    - src/core/effects/gainCard.ts
    - src/core/model/rarity.ts
  tests:
    - src/core/tests/weightedDraw.test.ts
    - src/core/tests/rarity.test.ts
  symbols:
    - GainRandomCard
    - Rarity
---

# Rarity and Weighted Reward Pools

Rarity is a core card-template property. The shipped tier order (`RARITY_ORDER` in `src/core/model/rarity.ts`) has grown to five tiers — common, uncommon, rare, legendary, and signature — with global weights `80 / 40 / 20 / 10 / 160`. This supersedes the original design brainstorm's four-tier proposal (common/uncommon/rare/legendary at weights 60/25/12/3): a fifth tier, signature, was added later as a weight that is intended to always be present rather than a rarer peer of legendary, and the numeric ladder was retuned. Minted cards receive a concrete rarity, defaulting to common when the template omits it. Presentation color and glyph mapping stays in the renderer.

Boon sets and random loot pools share the same named-pool concept: a set id resolves to a list of template ids, and rarity is read from the templates themselves. Pool definitions do not carry separate rarity data.

## Weighted Draw

Reward selection uses a pure weighted-draw kernel. Each pick groups remaining candidates by present rarity tier, renormalizes fixed tier weights across those present tiers, rolls a tier, rolls uniformly within that tier, removes the chosen template, and repeats.

The kernel is legality-agnostic. Callers filter for player cards, exhaust-only cards, or other constraints before invoking it. RNG consumption is fixed and documented so same-seed replay remains explainable after moving from shuffle-and-slice to weighted composition.

### Why weight the tier, not the card

The design brainstorm's load-bearing choice was to weight the tier first and pick uniformly within it, rather than assign each card its own probability weight. Three reasons carried the decision:

- **Probability decouples from population.** A pool of 1000 commons plus 1 legendary at a fixed legendary tier-weight still yields roughly the same legendary odds as a pool of 10 commons plus 1 legendary. Adding or removing cards within a tier doesn't move the tier's odds, so authors can grow a pool without recomputing a weight table.
- **Pity/luck hooks come for free later.** Because tier selection is a discrete first step, a future "you haven't seen a legendary in a while" modifier can bias that one step without any probability-math rework elsewhere. Not implemented, but the architecture was chosen to leave the door open.
- **Renormalization handles sparse pools for free.** A pool with no legendaries simply splits the remaining weight across whichever tiers it actually has present, with no special-casing.

Weighted sampling without replacement is order-dependent: after a pick is removed, present tiers are recomputed before the next roll, so a single-legendary pool drops out of the Legendary tier for the rest of that same offer. Replay/determinism tests need to pin the exact draw order for this reason.

## Preview Rule

Random rewards must not leak their rolled result through action preview or confirmation. `GainRandomCard` grants may emit the concrete result for committed game events, but preview summaries use the pool display name instead of naming the future card or tier.

## Authoring Discipline: The Power Promise

Rarity color is a promise, not just a scarcity signal, and the system doesn't enforce it — it's a content-authoring discipline. The design intent is that rarity correlates with power, but modestly: single-digit percentage-point power spikes, not multipliers, with room for a "burst" feel because burst is fun. If a weak card gets stamped Legendary, or a strong card sits at Common, the color stops meaning anything to the player. Pool curation (commons at baseline, legendaries as the deliberate burst) is the mechanism; nothing in the weighted-draw kernel checks card strength against tier.

## Maintenance Constraints

The weighted-draw kernel assumes callers pass deduped, legal, catalog-resolvable candidate ids. That precondition is documented rather than defensively revalidated, because existing callers already own legality filtering.

`src/core/effects/registry.ts` and `src/core/effects/composite.ts` currently form a circular import. The canonical full test suite is not affected, but narrow test-file subsets can hit a load-order `ReferenceError`; effect-system work should avoid deepening that cycle and should break it when touching those modules.
