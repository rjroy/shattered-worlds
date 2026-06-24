---
title: Rarity system
date: 2026-06-19
status: draft
tags: [spec, rarity, rewards, boons, world-cards, card-effects, weighted-draw, determinism]
modules: [core-engine, card-effects, card-data, game-runtime, table-ui]
related: [.lore/work/brainstorm/rarity-system.md, .lore/work/issues/rarity.md, .lore/work/specs/offer-boon-rewards.md, .lore/work/specs/fortune-boon-cards.md]
req-prefix: RARITY
---

# Rarity system

## Summary

Cards gain a named **rarity tier**. Tiers drive a deterministic **two-step weighted draw**: roll which tier is granted (weighted, renormalized over the tiers actually present in a pool), then pick uniformly among that tier's cards. The same kernel powers two resolution modes:

- **Pick mode:** draw several distinct cards to *offer*, the player chooses (Fortune act rewards and `OfferBoon` world-clear offers, both of which already route through `createBoonOffer`).
- **Roll mode:** draw one card and grant it, via a new `GainRandomCard` effect that rolls at mint time and reveals the result. It coexists permanently with the existing fixed `GainCard`.

Rarity is **core truth** (tier + global weights, part of deterministic replay). Color, glyph, and label are **renderer concerns** fed by a tier the core stamps onto cards and events. This is the follow-up both the OfferBoon and Fortune specs deferred when they listed rarity tiers out of scope.

## Scope

In scope:

- A four-tier rarity ladder (Common / Uncommon / Rare / Legendary) with global draw weights, defined in core.
- An authored `rarity` field on card templates, defaulting to Common, stamped onto minted cards.
- A deterministic two-step weighted-draw kernel, extracted as a shared core helper.
- Migration of `createBoonOffer` (Fortune + `OfferBoon`) from shuffle-then-slice to the weighted draw.
- A new `GainRandomCard` card effect (roll mode) for world-card clear rewards.
- Tier carried on the offer/grant/gain events so the renderer can color cards.
- A renderer-side tier → visual mapping (color / glyph / label).
- An alpha-stage stratification of the `pool-fortune` pool that exercises every path.
- An authoring rule binding rarity to modest power.

Out of scope:

- Per-pool weight overrides (a cache that reweights the ladder). Worlds express richer loot by *stocking* rarer cards.
- Pity / luck / "you're due" modifiers.
- An Epic (or any fifth) tier.
- Effect-magnitude variance (a card whose numeric values flex with rarity).
- Real balance of the Fortune pool or a stratified loot pass across all worlds.
- Replacing every fixed `GainCard` reward with `GainRandomCard`.

## Terms

**Rarity tier:** One of an ordered, named set of bands. Core truth.

**Draw weight:** The relative chance of a *tier* being selected. A global per-tier constant, not a per-card value.

**Pool:** A named list of card template IDs. Boon sets are pools; `GainRandomCard` references a pool. The draw reads each template's rarity at draw time; a pool is not itself rarity-structured data.

**Present tiers:** The set of tiers that have at least one legal candidate remaining in a pool at the moment of a tier roll.

**Pick mode:** Resolution where the kernel produces several distinct offered templates and the player chooses.

**Roll mode:** Resolution where the kernel produces one template that is minted and granted directly.

**`GainRandomCard`:** The roll-mode card effect. The rolled sibling of fixed `GainCard`: it rolls one template from a pool at mint time and grants it, where `GainCard` grants a single authored template deterministically.

## Requirements

### Rarity Tier Model

**REQ-RARITY-1:** Core must define a `RarityTier` type with exactly four members, ordered from most to least common: `common`, `uncommon`, `rare`, `legendary`.

**REQ-RARITY-2:** Core must define a single global weight per tier. The initial values are Common 60, Uncommon 25, Rare 12, Legendary 3. These are alpha starting values, not a tuned economy, and may be retuned without structural change.

**REQ-RARITY-3:** Weights are global. No pool, world, surface, or effect may override them in this version.

**REQ-RARITY-4:** The tier weight table must live in `src/core/` and must contain no color, glyph, label, or other presentation data. Core must never branch on a tier's visual meaning (e.g. "gold means good").

**REQ-RARITY-5:** The tier ordering used for any cumulative-weight walk must be a single fixed order (the REQ-RARITY-1 order) so the draw is reproducible regardless of pool insertion order.

### Authoring And Templates

**REQ-RARITY-6:** `BasicCardTemplate` must accept an optional `rarity: RarityTier`, inherited by both `PlayerCardTemplate` and `WorldCardTemplate`, authorable from JSON card sources.

**REQ-RARITY-7:** A template that omits `rarity` must be treated as `common`. No existing authored card requires editing to load.

**REQ-RARITY-8:** `mintCard` must stamp the resolved tier (authored or defaulted Common) onto the minted `PlayerCard` and `WorldCard`, so a card's rarity is available on game state without re-reading the catalog.

**REQ-RARITY-9:** An authored rarity above Common must carry a modest power increase relative to lower tiers within the same role: single-digit-percentage deltas, not multipliers, with room for a small burst at Legendary. Rarity color signals both scarcity and a small power edge; authoring a weak card at a high tier breaks that promise. This is an authoring discipline; the system does not mechanically enforce a power curve.

**REQ-RARITY-10:** Catalog validation must reject a `rarity` value that is not a member of `RarityTier`. No general per-field template validation pass exists today (`assembleCatalog` only checks for duplicate template IDs), so this requirement entails introducing or extending catalog-level validation, not hooking into an existing one.

### Weighted Draw Kernel

**REQ-RARITY-11:** Core must provide a single shared weighted-draw helper that both pick mode and roll mode call. The draw logic must not be duplicated across `createBoonOffer` and the `GainRandomCard` handler.

**REQ-RARITY-12:** A single draw must execute as: (1) determine the present tiers among legal candidates; (2) weighted roll over present tiers using global weights renormalized to those present; (3) uniform pick of one template within the chosen tier.

**REQ-RARITY-13:** A multi-draw (pick mode, count > 1) must be **without replacement**: after each pick, remove that template, recompute present tiers, and repeat. A tier with no remaining candidates must drop out of subsequent tier rolls within the same draw (e.g. a single Legendary cannot be offered twice and vanishes from later slots once taken).

**REQ-RARITY-14:** Offered/drawn templates within a single draw must be distinct.

**REQ-RARITY-15:** If a pool has fewer legal candidates than the requested count, the draw must yield every legal candidate without duplicates and without error.

**REQ-RARITY-16:** The draw must consume the run RNG in a fixed, documented order: for each slot, the tier roll consumes its RNG step(s) before the within-tier pick consumes its RNG step(s), and slots resolve in order. Replay must be able to pin the exact sequence of offered/drawn template IDs.

**REQ-RARITY-17:** The same seed, catalog, pool, count, and prior accepted action sequence must produce identical drawn template IDs in identical order. Different seeds may produce different legal results.

**REQ-RARITY-18:** The draw must advance the run RNG whenever a draw is attempted, including the degenerate cases of a single legal candidate or an empty pool, preserving the existing "always advance on attempt" guarantee in `createBoonOffer`.

**REQ-RARITY-19:** Legality filtering (e.g. boon offers restricting to `exhaust: true` player cards) must compose with the weighted draw: filter to legal candidates first, then run the tier/within-tier rolls over what remains.

### Pick Mode (Boon Offer Migration)

**REQ-RARITY-20:** `createBoonOffer` must build its offered set using the weighted-draw kernel instead of shuffle-then-slice. Both `source: "act"` (Fortune) and `source: "worldClear"` (`OfferBoon`) must use it.

**REQ-RARITY-21:** All behavioral guarantees of the Fortune and OfferBoon specs that are not about *which* templates appear must continue to hold: blocking ordinary actions while a choice is pending, the `ChooseBoon` discipline, destinations (hand vs `playerDiscard`), fail-closed on an empty legal pool, single-pending-choice policy, and the opening-Act-1 suppression.

**REQ-RARITY-22:** This spec supersedes the prior deterministic-shuffle offer-*composition* requirements (OfferBoon REQ-OFFER-BOON-40, Fortune REQ-FORTUNE-23 shuffle wording). Determinism is preserved under REQ-RARITY-16/17; the specific offered IDs for a given seed will change from the shuffle-based output, so existing golden/replay fixtures that pin offered IDs must be regenerated, not patched by hand. The adjacent Fortune/OfferBoon determinism and batching requirements that touch `createBoonOffer` (Fortune REQ-FORTUNE-24 "advance the run RNG", REQ-FORTUNE-28 batching; OfferBoon REQ-OFFER-BOON-36..38, REQ-OFFER-BOON-41..48) are not silently left in place — they are re-anchored to and jointly restated by REQ-RARITY-16/18/36 here. Their substance is unchanged; their wording now derives from this spec.

**REQ-RARITY-23:** Pick-mode offer composition is the direct consequence of REQ-RARITY-12 applied per slot: a higher-tier boon appears in an offer less often than a lower-tier boon at the ratio of their global weights, renormalized over present tiers. The statistical acceptance bound is defined in AI Validation item 3; this requirement adds no constraint beyond REQ-RARITY-12, it names the observable consequence.

### Roll Mode (GainRandomCard)

**REQ-RARITY-24:** The card-effect union must support a new effect kind `GainRandomCard` with at minimum a pool reference (`setId` or equivalent named pool ID) identifying the candidate templates.

**REQ-RARITY-25:** `GainRandomCard` must resolve by running the weighted-draw kernel for exactly one template, minting that template, and granting it. The roll happens at mint/resolution time so the concrete card and its tier can be displayed; it is not a hidden deferred roll.

**REQ-RARITY-26:** `GainRandomCard` must grant to `playerDiscard` by default, matching fixed `GainCard`. (A configurable destination is permitted but not required in this version.)

**REQ-RARITY-27:** Fixed `GainCard` must remain unchanged and continue to grant its single authored template deterministically. `GainCard` and `GainRandomCard` coexist permanently: fixed for world-identity loot, rolled for variable loot.

**REQ-RARITY-28:** `GainRandomCard` must be a hook/reward effect, not a playable player-card action by itself (matching `GainCard`/`OfferBoon` `isPlayable: false`).

**REQ-RARITY-29:** `GainRandomCard` must fail closed without crashing the run if its referenced pool is missing or contains no legal candidates, while still advancing the RNG per REQ-RARITY-18.

**REQ-RARITY-30:** At least one world-card `onCleared` reward must use `GainRandomCard` in real world data so the roll path is exercised by an actual run.

**REQ-RARITY-31:** `GainRandomCard` must have `describe` and `compile` (glyph) output that communicates a rolled reward from a pool, clearly distinct from `GainCard`'s single named reward, so a player can read the clear reward before clearing. Because the roll has not happened yet at pre-clear render time (REQ-RARITY-25), this output names the pool (and that the reward is randomized), not a specific tier or a specific card.

### Events And Tier Surfacing

**REQ-RARITY-32:** The `BoonOffered` event must carry the rarity tier of each offered template as a parallel `rarities` array, index-aligned with `templateIds`, so the renderer can color offered cards without re-reading the catalog. The decision is the parallel-array shape, not a per-template object.

**REQ-RARITY-32a:** `BoonOffered` is a discriminated union in `types.ts` (the `source: "act"` arm carries `act: number`; the `source: "worldClear"` arm carries `act?: never`). The new `rarities` field must be added symmetrically to both arms, and the existing `source`/`act` discriminated split must be preserved unchanged.

**REQ-RARITY-33:** The `CardGained` event (used by `gainCard`, and therefore by `GainRandomCard`'s grant) must carry the granted card's rarity tier.

**REQ-RARITY-34:** The `BoonCardGranted` event must carry the granted boon card's rarity tier.

**REQ-RARITY-35:** Tier on events must be the same value stamped on the minted card (REQ-RARITY-8); the two sources must never disagree.

**REQ-RARITY-36:** Event ordering and batching guarantees from the Fortune and OfferBoon specs must be preserved: the offer event in the producing dispatch batch, the grant event in the resolving batch, the gain event in the effect's batch.

### Renderer Visibility

**REQ-RARITY-37:** The renderer (`src/game/`) must own the single mapping from `RarityTier` to its visual treatment (color, and where used, glyph and label). Core must not import or depend on this mapping; the lint boundary must stay green.

**REQ-RARITY-38:** The four tiers must be visually distinguishable. The intended palette is Common grey/bone, Uncommon green, Rare blue, Legendary gold/amber. Exact values are a renderer detail and may be tuned.

**REQ-RARITY-39:** The boon-choice UI and the card-face rendering path must surface a card's tier using the tier carried on events/cards, for both pick-mode offers and roll-mode grants.

**REQ-RARITY-40:** A missing or unknown tier on the renderer side must degrade to the Common treatment rather than crash the scene.

### Fortune Pool Alpha Pass

**REQ-RARITY-41:** The existing five `pool-fortune` boon templates must be stamped with rarity. At least one must be Uncommon and at least one must be Rare, with the remainder Common, so the weighted draw and the colored rendering both fire in a real run. No new boon cards and no balance work are required.

**REQ-RARITY-42:** This alpha stratification must not violate the Fortune-pool constraints from the Fortune spec (boon-only, `exhaust: true`, no world-specific loot cards, etc.).

### Migration And Back-Compat

**REQ-RARITY-43:** All cards, worlds, boon sets, and starter decks that exist today must continue to assemble and run with rarity defaulting to Common, with no required edits beyond the deliberate Fortune stamping in REQ-RARITY-41 and any deliberate `GainRandomCard` authoring in REQ-RARITY-30.

**REQ-RARITY-44:** No save-format or run-replay compatibility with pre-rarity persisted runs is promised; if offered-ID determinism changes invalidate stored runs, that invalidation must be honest (surfaced) rather than silently producing different results for the "same" seed.

## Non-Goals

- No per-pool or per-world weight overrides.
- No pity/luck system (the kernel's discrete tier step leaves room for one later).
- No fifth tier.
- No effect-magnitude variance.
- No full loot-rarity pass across worlds, and no real Fortune-pool rebalance.
- No removal of fixed `GainCard` rewards.

## AI Validation

1. Run core type/registry tests: `RarityTier` has exactly the four ordered members, the global weight table lives in core and carries no presentation fields, and `GainRandomCard` is registered, described, glyph-compiled, and not treated as a playable player action.
2. Run catalog tests: a template with no `rarity` mints as Common; a template with an authored tier mints with that tier; an invalid `rarity` value is rejected by validation.
3. Unit-test the weighted-draw kernel directly with a stubbed RNG: present-tier renormalization is correct; a single Legendary in a pool of many Commons is drawn at roughly the Legendary weight, not at one-over-population odds; without-replacement removes the taken tier when it empties; fewer candidates than count yields all of them without duplicates or error.
4. Determinism: identical seed + pool + count + action sequence yields identical drawn IDs in identical order across repeated runs; a different seed can produce different legal results. Confirm the RNG advances even for single-candidate and empty pools.
5. Confirm `createBoonOffer` uses the kernel for both `act` and `worldClear` sources, and that all non-composition Fortune/OfferBoon guarantees (action blocking, `ChooseBoon`, destinations, fail-closed, single-pending, Act-1 suppression) still pass.
6. Regenerate and verify golden/replay fixtures that pin offered IDs; confirm the change is a deterministic recomputation, not nondeterminism.
7. Reducer-test `GainRandomCard` on a world card's `onCleared`: it mints exactly one card from the pool, grants it to `playerDiscard`, and emits a `CardGained` event carrying the tier. Fixed `GainCard` still grants its single authored template unchanged.
8. `GainRandomCard` fails closed (no crash, RNG advanced) for a missing pool and an empty legal pool.
9. Event tests: `BoonOffered` carries a `rarities` array index-aligned with `templateIds` on both the `act` and `worldClear` union arms with the discriminated split intact, `CardGained` and `BoonCardGranted` carry tier, event-tier equals minted-card tier, and the Fortune/OfferBoon batching/ordering guarantees still hold.
10. Lint-boundary test: core has no import of the renderer tier→visual map; the renderer maps every tier to a distinct treatment and falls back to Common for an unknown tier.
11. Confirm the `pool-fortune` pool has at least one Uncommon and one Rare stamped, still satisfies the Fortune-pool constraints, and that an act-reward offer can surface a non-Common boon.
12. Confirm at least one real world data file exercises `GainRandomCard` from `onCleared` without breaking world assembly.

## Open Questions

- Should `GainRandomCard`'s pool be the same named `BOON_SETS` registry, a parallel "loot pool" registry, or a generic pool concept both share? (Leaning: one generic named-pool lookup so boon sets and loot pools are the same shape. This is a design/structure call for the plan, not a behavioral gap.)
- Do any existing world-card `onCleared` `GainCard` rewards want to *become* `GainRandomCard` in this pass, or do we add a fresh authored example and leave existing fixed loot alone? (REQ-RARITY-30 only requires one example; the duality says existing fixed loot can stay.)

Resolved during review: the tier rides on events as a parallel `rarities` array (REQ-RARITY-32); the `BoonOffered` discriminated-union shape is preserved (REQ-RARITY-32a).
