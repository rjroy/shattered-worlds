---
title: Rarity system
date: 2026-06-19
status: open
tags: [rarity, rewards, boons, world-cards, card-effects, weighted-draw, determinism]
modules: [core-engine, card-effects, game-runtime, table-ui, card-data]
related: [.lore/work/issues/rarity.md, .lore/work/specs/offer-boon-rewards.md, .lore/work/specs/fortune-boon-cards.md]
---

# Rarity system

## Where this came from

Source issue (`.lore/work/issues/rarity.md`): add a rarity system, covering both randomness in the reward a card provides and randomness in the set of boons offered for a choice.

Both the OfferBoon and Fortune specs explicitly deferred rarity tiers as out of scope. This is the follow-up that picks them up.

Scope confirmed with the user up front:

- **Model:** named rarity tiers with draw weights, reusable across systems.
- **Both facets:** variance in which cards populate a choice *and* variance in the reward a single card grants.
- **Surfaces:** boon choices (Fortune act rewards + OfferBoon world-clear) and world-card `GainCard` clear rewards. Effect-magnitude variance is out.
- **Visibility:** rarity is visible to the player via color / label / glyph.

Hard constraints carried from the codebase: core stays deterministic and seedable; the core/game lint boundary holds (no Phaser in core); `dispatch` returns state plus an ordered event list.

## The kernel: two-step weighted draw

The load-bearing decision. Rather than weighting individual cards, weight the **tier**, then pick uniformly within it:

1. Look at which tiers are *present* in the pool.
2. Weighted roll over those present tiers (weights renormalized over what's present) to pick a tier.
3. Uniform pick of one card within the chosen tier.
4. Remove that card, loop back to step 1 for the next slot.

Why this shape and not per-card weights:

- **Probability is decoupled from population.** A pool of 1000 commons + 1 legendary at 5% legendary still yields ~5% legendary (≈1 in 20 pulls), without rebuilding a table so each of the 1000 commons carries a 0.095% share. Add or remove cards within a tier and the tier's odds don't move.
- **Pity hooks come for free later.** Because tier selection is a discrete first step, a future "you haven't seen a legendary in a while, here's magic" modifier slots into step 2 with no probability-math rework. Out of scope now, but the architecture earns it.
- **Renormalization handles sparse pools.** A pool with no legendaries just splits the remaining weights across the tiers it actually has.

## One primitive, two resolution modes

The two facets from the issue collapse into the same kernel run with a count and a resolution mode:

- **Pick mode** (OfferBoon / Fortune): run the draw X times without replacement → those are the offered options → player chooses one.
- **Roll mode** (`GainRandomCard`): run the draw once → mint the card → display it.

`GainRandomCard` is "pick mode with count 1 and no choice step." Because the card is chosen **at mint time** and shown, the player still gets the reveal and the rarity color, which gives them the extra readability the user wanted. The existing fixed `GainCard` stays untouched beside it.

This duality is intentional and permanent: `GainCard` for deterministic world-identity loot (clearing the Nitro cache *means* Nitro), `GainRandomCard` for rolled loot. Same `onCleared` hook, two reward philosophies, on purpose. (Matches OfferBoon REQ-66, which protected fixed loot.)

## The tier ladder

Four tiers. Skipped Epic/purple deliberately: four bands read cleaner than five, and because weights are independent we can insert Epic later without disturbing the others.

| Tier | Weight | Renderer color (suggestion) | Feel |
|---|---:|---|---|
| Common | 60 | grey / bone white | baseline; everything starts here |
| Uncommon | 25 | green | a small nudge above baseline |
| Rare | 12 | blue | noticeably good, glad to see it |
| Legendary | 3 | gold / amber | the burst moment, single-digit-% power spike |

Weights are **global** (every pool uses the same ladder, renormalized over present tiers). Rationale: a consistent ladder is something a player can learn and infer. A "fat" cache expresses better loot by *stocking* rarer cards, not by reweighting the ladder. Per-pool weight override is a named future hook, not v1.

These numbers are a starting point that exercises every code path in alpha, **not** a tuned economy. 3% legendary is rare enough to feel special in testing without being so rare the path never fires. Rebalance later.

## Color means power *and* scarcity

The user's call: rarity correlates with power, but modestly. Unlocks (and Fortune) already grant power; the rule is keep it small, single-digit percentage points rather than multipliers, with some burst because burst is fun. So the gold border is an honest promise of a small power spike, not a lie and not a pure-scarcity signal.

This is a **content-authoring discipline**, not something the system enforces. The pool should stratify by strength: commons baseline, legendaries the burst. Worth a written authoring rule so nobody stamps a weak card Legendary and breaks the promise the color makes.

## What this implies for the data and boundary

- **Rarity lives on the card template** (`rarity: RarityTier`, default Common). A "pool" stays just a list of template IDs; the draw reads each template's rarity at draw time. No separate rarity-table data structure.
- **Core owns tier + weight; renderer owns color/glyph/label.** Core can't hold a hex value without breaking the lint boundary. Core stamps the *tier* onto events (offered templates carry their tier; minted cards carry theirs); the renderer paints from that. Core never reasons about "gold = good."
- **Determinism:** both the tier roll and the within-tier card roll consume run RNG. Replay pins the full draw sequence. Offer generation must advance RNG even in degenerate cases (single legal candidate, etc.), consistent with the OfferBoon/Fortune determinism requirements.
- **Migration:** everything currently authored becomes Common by default. One-line migration; restamp the special cards (world loot, boon pool) as a follow-up.

## Fortune pool: just "do something"

Game is still basically alpha, so the goal is to exercise the system, not balance it. Stamp the existing five `pool-fortune` boons as Common, then bump one to Uncommon and one to Rare so the weighted draw *and* the colored rendering both actually fire in a real run. No new cards, no balance work. Rebalance later.

## Out of scope (named for later)

- Per-pool weight overrides (a cache that boosts legendary odds vs. one that stocks rares).
- Pity / luck / "you're due" modifiers — architecture supports them via step-2 of the kernel.
- Epic (purple) tier — insertable later without disturbing existing weights.
- Effect-magnitude variance (a card whose numeric values flex with rarity).
- Real Fortune-pool balance and a real stratified loot pass across worlds.

## Open threads worth a second look during spec

- Weighted sampling **without replacement** in pick mode is order-dependent: after removing the selected card, recompute present tiers before the next roll (a single-legendary pool drops the Legendary tier out of subsequent slots in the same offer). Replay tests must pin the exact draw order.
- Event shape: offered-template events and card-minted/granted events both need to carry the tier so the renderer can color. Confirm this rides cleanly on the existing OfferBoon/Fortune event vocabulary rather than needing new events.
- `GainRandomCard` naming and where it sits relative to the existing `GainCard` effect kind and the `OfferBoon` effect — likely a shared core draw helper that all three call.
- Authoring-rule wording for the power/color promise, so content stays honest.
