---
title: Fortune boon cards
date: 2026-06-17
status: draft
tags: [spec, unlocks, fortune, boon-cards, act-rewards]
modules: [data-unlocks, core-engine, game-runtime, card-data]
related: [.lore/work/specs/unlock-system.md, .lore/work/design/unlock-catalog.md, .lore/reference/destiny-progression.html]
req-prefix: FORTUNE
---

# Fortune boon cards

## Summary

`Fortune` (`act-reward`) becomes an active Destiny unlock that offers a choice of temporary boon-only player cards at the start of each new act after Act 1. The first shipped behavior is the ambitious version: choose 1 of 3 cards from a curated boon-only pool, then add the chosen card directly to hand.

The purpose is to make act transitions feel like the player found something useful in the world without stealing world-specific loot rewards or adding permanent deck bloat.

## Requirements

**REQ-FORTUNE-1:** The existing unlock ID `act-reward` must remain stable and continue to display as `Fortune`.

**REQ-FORTUNE-2:** `Fortune` must be activatable through the existing Destiny loadout budget once its cost and weight make activation legal. Its effect must no longer be inert when active.

**REQ-FORTUNE-3:** The `actReward` unlock effect must expose enough data to configure the boon behavior without hard-coding catalog details in the reducer. At minimum it must identify a boon pool, the number of offered cards, and the number of cards chosen per trigger. The first implementation offers 3 and chooses 1.

**REQ-FORTUNE-4:** Activating `Fortune` must set a run modifier that survives into `GameState.runModifiers`, so core gameplay can resolve act rewards without reading unlock profiles directly.

**REQ-FORTUNE-5:** A Fortune reward triggers exactly once when a run advances from one act to the next after Act 1. It does not trigger for the opening Act 1 deal.

**REQ-FORTUNE-6:** A Fortune reward must be tied to real act advancement. If no `ActAdvanced` event occurs, no boon card is granted.

**REQ-FORTUNE-7:** A Fortune reward must not trigger after the run has already become `won` or `lost`.

**REQ-FORTUNE-8:** The first implementation must pause normal gameplay for a Fortune choice. When Fortune triggers, the game enters a pending act-boon choice state and waits for the player to choose one offered card.

**REQ-FORTUNE-9:** The pending act-boon choice must present exactly 3 distinct boon card template options when the configured pool contains at least 3 legal templates. If the pool has fewer than 3 legal templates, it must present every legal template without duplicates.

**REQ-FORTUNE-10:** The player chooses exactly 1 offered boon card. The chosen card is minted and added directly to the player's hand as an extra card. It must not replace or reduce the normal turn-start player draw.

**REQ-FORTUNE-11:** A Fortune boon may temporarily make the hand exceed the effective hand size by the number of chosen boon cards.

**REQ-FORTUNE-12:** The pending act-boon choice must be created before post-refill loss checks that depend on the player having no usable player cards. Resolving the choice can therefore keep the run playable.

**REQ-FORTUNE-13:** While a Fortune choice is pending, ordinary gameplay actions must be unavailable. The player cannot `PlayCard`, `DiscardHazard`, or `EndTurn` until the act-boon choice is resolved.

**REQ-FORTUNE-14:** The reducer must accept a dedicated choice action, provisionally named `ChooseActBoon`, that identifies the offered card/template selected by the player. Invalid choices must be rejected with the same illegal-action discipline as other reducer actions.

**REQ-FORTUNE-15:** Resolving a valid `ChooseActBoon` action must clear the pending choice and return the run to normal `playing` gameplay unless the run has become terminal through another already-resolved effect.

**REQ-FORTUNE-16:** Every first-version Fortune boon card must be a player card with `exhaust: true`, so it disappears after use instead of permanently entering the deck cycle.

**REQ-FORTUNE-17:** Fortune boon cards must be authored in a boon-only pool. They must not reuse world-specific loot cards such as `Shotgun`, `Fire Axe`, `Nitro`, `Weed Killer`, or `Searchlight`.

**REQ-FORTUNE-18:** Boon-only card templates must not appear in starter decks, world act compositions, or world hazard reward effects unless a later spec deliberately expands their role. Fortune is the only first-version source of these cards.

**REQ-FORTUNE-19:** The boon-only pool must be available in every world assembled by `buildWorld`, regardless of selected starter deck or active world.

**REQ-FORTUNE-20:** The first boon-only pool must include at least five distinct cards covering different tactical jobs:

| Job | Example effect shape |
|---|---|
| stabilize | heal or prevent immediate collapse |
| tempo | gain energy or draw |
| pressure | deal progress to a target |
| breathing room | return world cards or reduce hazard pressure |
| world-agnostic utility | light/brace or another useful effect that is not locked to one world's mechanic |

**REQ-FORTUNE-21:** No first-version boon card may directly win the world, add `Door`, add `The Walker`, permanently exile non-exilable cards, or add additional world cards.

**REQ-FORTUNE-22:** First-version boon cards should be modestly above normal zero-cost value because they are rare and exhaust, but must not be stronger than the best world-specific loot rewards.

**REQ-FORTUNE-23:** Fortune offer generation must use the run's deterministic RNG state. The same seed, world, starter, active unlocks, and action sequence must produce the same offered boon template IDs in the same order.

**REQ-FORTUNE-24:** Fortune offer generation must advance the run RNG so subsequent shuffles and random effects remain deterministic and replayable.

**REQ-FORTUNE-25:** The engine must emit an observable event when Fortune offers boon cards. The event must include the act number and offered template IDs.

**REQ-FORTUNE-26:** The engine must emit an observable event when a Fortune boon is chosen and granted. The event must include the granted card ID and template ID.

**REQ-FORTUNE-27:** Because existing `CardGained` destinations do not include direct-to-hand grants, Fortune must add specific observable events such as `ActBoonOffered` and `BoonCardGranted` rather than overloading `CardGained` inaccurately.

**REQ-FORTUNE-28:** The Fortune offer event must appear in the same dispatch batch as the act transition that caused it, so runtime subscribers can correlate the reward with `ActAdvanced`. The grant event appears in the later batch that contains the player choice action.

**REQ-FORTUNE-29:** UI card rendering must handle Fortune boon cards using the existing player-card face path. Placeholder or reused inset art is acceptable for the first implementation as long as missing assets do not crash the run.

**REQ-FORTUNE-30:** The gameplay UI must present the pending Fortune choice as a focused choice overlay or equivalent scene layer. It must show all offered card faces, allow exactly one selection, and prevent normal table interactions while open.

**REQ-FORTUNE-31:** The choice UI must be keyboard and pointer operable. At minimum, pointer selection and number-key selection for visible options must work.

**REQ-FORTUNE-32:** The choice UI must not describe itself as permanent deck drafting. Copy should communicate that the chosen card is temporary and goes to hand.

**REQ-FORTUNE-33:** The Destiny scene copy for Fortune must describe the implemented behavior. The detail text should communicate that the player chooses 1 of 3 temporary boon cards at the start of each new act.

**REQ-FORTUNE-34:** The previous `act-reward` "NotImplemented" description must be removed once this spec is implemented.

## Candidate first pool

These names are provisional; the implementation may tune names and exact numbers while preserving the jobs and constraints above.

| Template | Cost | Exhaust | Effect intent |
|---|---:|---:|---|
| `Lucky Break` | 0 | true | Heal 2 |
| `Second Wind` | 0 | true | GainEnergy 2 |
| `Found Tool` | 0 | true | DealProgress 2 |
| `Clear Path` | 0 | true | ReturnWorldCards 0-2 |
| `Steady Nerve` | 0 | true | Brace 1 plus GainLight 1, or equivalent world-agnostic defense |

## Non-goals

- No permanent deck drafting from Fortune.
- No world-specific loot cards in the Fortune pool.
- No new art-generation requirement.
- No economy rebalance beyond making `Fortune` testable/activatable when the feature is ready.
- No multi-card picks, rerolls, rarity tiers, or skip-for-currency behavior in the first version.

## AI Validation

1. Run unit tests for unlock catalog behavior and verify `act-reward` contributes a concrete run modifier when active.
2. Run core reducer/draw tests covering an act transition with Fortune active and inactive. Confirm the active case creates a pending choice and the inactive case creates none.
3. Verify the opening deal never creates a Fortune choice.
4. Verify a run that advances multiple acts creates one pending choice per `ActAdvanced` event and no duplicate choices for the same transition.
5. Verify ordinary gameplay actions are rejected while a Fortune choice is pending, and a valid `ChooseActBoon` action resolves the pending choice.
6. Verify invalid choice indices/template IDs are rejected without mutating state.
7. Verify the chosen card is in hand, is a player card, has `exhaust: true`, and does not reduce the normal refill draw.
8. Run a deterministic replay test with identical seed and actions. Confirm the same offered boon template IDs are generated in the same order.
9. Run a different-seed smoke test. Confirm the offered options can differ while remaining inside the configured boon-only pool.
10. Verify all worlds assembled by `buildWorld` can mint every boon template in the configured Fortune pool.
11. Verify runtime event batches include the offer event in the same batch as the triggering `ActAdvanced`, and the grant event in the choice-action batch.
12. Verify the Table scene or equivalent gameplay UI displays the offer, blocks table interactions, supports pointer and number-key selection, and dismisses after a valid choice.
13. Verify Destiny scene text no longer says `NotImplemented` and accurately promises choose-1-of-3 temporary boon behavior.

## Open Questions

- Should `Fortune` remain weight 3 and cost 70 once active, or should the now-ambitious choice version be costlier/lighter/heavier?
- Should boon cards have unique art assets before release, or use existing generic inset art until the pool stabilizes?
- Should pending choice state be represented as a separate `status` value or as a `pendingChoice` field while `status` remains `playing`?
