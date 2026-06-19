---
title: OfferBoon rewards
date: 2026-06-19
status: draft
tags: [spec, rewards, boons, world-cards, card-effects]
modules: [core-engine, card-effects, game-runtime, table-ui, card-data]
related: [.lore/work/brainstorm/offer-boon-world-clear-rewards.md, .lore/work/specs/fortune-boon-cards.md]
req-prefix: OFFER-BOON
---

# OfferBoon rewards

## Summary

World card rewards need a reusable way to offer a small choice of boon cards instead of only granting one fixed card. The new `OfferBoon` card effect presents cards from a named boon set, lets the player choose one, and grants the chosen card either directly to hand or to discard.

The existing Fortune act-reward flow should become the first producer of a generic boon-choice system. `OfferBoon` becomes a second producer that can run from world card hooks such as `onCleared`.

## Scope

In scope:

- A new `OfferBoon` card effect.
- Named boon sets that can be reused by act rewards and world-card rewards.
- Generic pending boon choice state, action, events, and UI.
- Destination control through `bToDiscard`.
- Migration of the existing Fortune act-reward behavior onto the generic boon-choice path.
- Validation that the first implementation offers only legal temporary player boon cards.

Out of scope:

- Multi-card picks beyond `chooseCount: 1`.
- Rerolls, skips, rarity tiers, or currency conversion.
- A queue of multiple simultaneous boon choices.
- Rebalancing every existing world clear reward.
- New art requirements for boon cards.
- Permanent deck drafting from `OfferBoon`.

## Terms

**Boon set:** A named list of candidate card template IDs. The current Fortune pool is one boon set.

**Boon choice:** A pending gameplay choice where the player picks one offered boon template.

**Producer:** A gameplay rule that creates a boon choice. Fortune act rewards and `OfferBoon` effects are producers.

**Destination:** The zone where the chosen boon card is granted after selection. The first version supports hand and player discard.

## Requirements

### Effect Shape

**REQ-OFFER-BOON-1:** The card effect union must support a new effect kind named `OfferBoon`.

**REQ-OFFER-BOON-2:** `OfferBoon` must be authored as serializable card data with this minimum shape:

```typescript
{
  kind: "OfferBoon";
  setId: string;
  offeredCount: number;
  chooseCount: 1;
  bToDiscard?: boolean;
}
```

**REQ-OFFER-BOON-3:** `setId` identifies the boon set used to generate offered cards.

**REQ-OFFER-BOON-4:** `offeredCount` controls the maximum number of distinct options shown to the player.

**REQ-OFFER-BOON-5:** The first implementation must support only `chooseCount: 1`. Any authored `OfferBoon` with a different `chooseCount` must be rejected by catalog validation, runtime validation, or both.

**REQ-OFFER-BOON-6:** If `bToDiscard` is absent or false, the chosen boon must be granted directly to hand.

**REQ-OFFER-BOON-7:** If `bToDiscard` is true, the chosen boon must be granted to `playerDiscard`.

**REQ-OFFER-BOON-8:** `OfferBoon` must be usable from world-card hook effects, including at minimum `onCleared`.

**REQ-OFFER-BOON-9:** `OfferBoon` must remain a hook effect, not a playable player-card action by itself. It must not make a player card playable unless wrapped in an authored playable effect path that is otherwise legal.

### Boon Sets

**REQ-OFFER-BOON-10:** Boon sets must be available through data/configuration rather than hard-coded in the reducer.

**REQ-OFFER-BOON-11:** The existing `fortune-v1` pool must remain available as a boon set.

**REQ-OFFER-BOON-12:** A boon set may be referenced by both act rewards and `OfferBoon` effects.

**REQ-OFFER-BOON-13:** Offer generation must filter a boon set to legal first-version boon templates: player cards with `exhaust: true`.

**REQ-OFFER-BOON-14:** Illegal or missing templates in a boon set must not be offered.

**REQ-OFFER-BOON-15:** If a boon set contains fewer legal templates than `offeredCount`, the offer must include every legal template without duplicates.

**REQ-OFFER-BOON-16:** If a referenced boon set contains no legal templates, the effect must fail closed without crashing the run. It must not create an unresolvable pending choice.

### Generic Boon Choice

**REQ-OFFER-BOON-17:** Replace the act-specific pending choice model with a generic pending boon choice model.

**REQ-OFFER-BOON-18:** The generic pending boon choice must carry at minimum:

```typescript
type PendingBoonChoice = {
  source: "act" | "worldClear";
  setId: string;
  offeredTemplateIds: readonly CardTemplateId[];
  chooseCount: 1;
  bToDiscard: boolean;
};
```

**REQ-OFFER-BOON-19:** The pending choice source must identify whether the offer came from an act reward or a world-card clear reward.

**REQ-OFFER-BOON-20:** The first implementation may use `source: "worldClear"` for every `OfferBoon` hook trigger, even if later versions add more source variants.

**REQ-OFFER-BOON-21:** Replace the act-specific choice action with a generic choice action, provisionally named `ChooseBoon`, that identifies the selected offered template.

**REQ-OFFER-BOON-22:** While a boon choice is pending, ordinary gameplay actions must remain blocked. The player must not be able to `PlayCard`, `DiscardHazard`, or `EndTurn` until the choice resolves.

**REQ-OFFER-BOON-23:** A valid `ChooseBoon` action must clear the pending boon choice.

**REQ-OFFER-BOON-24:** An invalid `ChooseBoon` action, including a template that was not offered, must be rejected with the same illegal-action discipline as other reducer actions.

**REQ-OFFER-BOON-25:** The chosen boon must be minted from the current run catalog at choice resolution time.

**REQ-OFFER-BOON-26:** The chosen boon must be rejected if it does not mint as a player card with `exhaust: true`.

**REQ-OFFER-BOON-27:** A direct-to-hand choice may make the hand exceed normal hand size by the chosen boon card.

**REQ-OFFER-BOON-28:** A discard-destination choice must not enter hand immediately and must be visible in `playerDiscard` after resolution.

### Fortune Migration

**REQ-OFFER-BOON-29:** The existing `act-reward` unlock ID and display name `Fortune` must remain stable.

**REQ-OFFER-BOON-30:** Active Fortune act rewards must produce generic pending boon choices instead of act-specific pending choices.

**REQ-OFFER-BOON-31:** Fortune must preserve its current implemented behavior: when an eligible act transition occurs, offer 3 legal cards from `fortune-v1`, choose 1, and grant the chosen temporary card to hand.

**REQ-OFFER-BOON-32:** Fortune must continue not to trigger during the opening Act 1 deal.

**REQ-OFFER-BOON-33:** Fortune must continue to trigger only when an actual `ActAdvanced` event occurs and the run is still playing.

**REQ-OFFER-BOON-34:** Existing Fortune boon card constraints from `.lore/work/specs/fortune-boon-cards.md` remain in force unless explicitly superseded by this spec.

**REQ-OFFER-BOON-35:** This spec supersedes Fortune's act-specific pending-choice, action, and offer-event names. Requirements in the Fortune spec that refer to `ChooseActBoon`, `pendingActBoon`, or `ActBoonOffered` should be satisfied through the generic boon-choice equivalents defined here.

### Offer Generation And Determinism

**REQ-OFFER-BOON-36:** Boon offer generation must use the run's deterministic RNG state.

**REQ-OFFER-BOON-37:** The same seed, world, starter, active unlocks, catalog, and accepted action sequence must produce the same offered boon template IDs in the same order.

**REQ-OFFER-BOON-38:** Boon offer generation must advance the run RNG whenever an offer is attempted, including the degenerate case where the legal candidate list is too short to shuffle.

**REQ-OFFER-BOON-39:** Offered template IDs must be distinct within one offer.

**REQ-OFFER-BOON-40:** Offer generation must preserve authored boon set order only where deterministic shuffle behavior results in that order. It must not depend on JavaScript object enumeration of unrelated data.

### Events And Runtime Stream

**REQ-OFFER-BOON-41:** The engine must emit an observable event when a boon choice is offered.

**REQ-OFFER-BOON-42:** The boon-offered event must include at minimum the source, set ID, and offered template IDs.

**REQ-OFFER-BOON-43:** Act-source boon-offered events must remain correlatable with the triggering act number.

**REQ-OFFER-BOON-44:** World-clear-source boon-offered events must remain correlatable with the hazard that was cleared. At minimum, either the event or adjacent event batch must expose the cleared hazard ID and template ID.

**REQ-OFFER-BOON-45:** The engine must emit an observable event when a chosen boon card is granted.

**REQ-OFFER-BOON-46:** The boon-granted event must include at minimum the granted card ID, template ID, and destination.

**REQ-OFFER-BOON-47:** A boon-offered event from `OfferBoon` must appear in the same reducer dispatch batch as the effect that created it.

**REQ-OFFER-BOON-48:** A boon-granted event must appear in the later dispatch batch that resolves `ChooseBoon`.

**REQ-OFFER-BOON-49:** Existing runtime subscribers must continue to receive ordered gameplay events without needing renderer state to identify boon offers and grants.

### UI And Interaction

**REQ-OFFER-BOON-50:** Rename or generalize the existing act boon choice view so it can present any pending boon choice.

**REQ-OFFER-BOON-51:** The choice UI must show all offered card faces using the existing player-card rendering path.

**REQ-OFFER-BOON-52:** The choice UI must allow exactly one selection in the first implementation.

**REQ-OFFER-BOON-53:** Pointer selection must work for every visible offered option.

**REQ-OFFER-BOON-54:** Number-key selection must work for visible offered options.

**REQ-OFFER-BOON-55:** While the boon choice UI is open, normal table interactions must be unavailable.

**REQ-OFFER-BOON-56:** The choice UI copy must accurately describe whether the chosen boon goes to hand or discard.

**REQ-OFFER-BOON-57:** The UI must not describe `OfferBoon` rewards as permanent deck drafting in the first implementation.

**REQ-OFFER-BOON-58:** Missing offered templates must be handled as a visible/debuggable error state instead of crashing the scene.

### Multi-Offer Policy

**REQ-OFFER-BOON-59:** The first implementation supports at most one pending boon choice at a time.

**REQ-OFFER-BOON-60:** If an effect attempts to create a boon choice while another boon choice is already pending, the engine must fail closed in a deterministic way.

**REQ-OFFER-BOON-61:** The first implementation must not silently replace an existing pending boon choice with a newer one.

**REQ-OFFER-BOON-62:** No queue of pending boon choices is required in the first implementation.

**REQ-OFFER-BOON-63:** Initial authored `OfferBoon` usages should avoid common cards and effects likely to clear multiple boon-offering hazards in one `DealProgressAll` sweep.

### Data Authoring

**REQ-OFFER-BOON-64:** At least one world-card `onCleared` reward must be migrated or added to exercise `OfferBoon` in real world data.

**REQ-OFFER-BOON-65:** Initial `OfferBoon` authoring should target cache-style, high-cost, or rare world cards where a choice modal is worth the interruption.

**REQ-OFFER-BOON-66:** Existing fixed `GainCard` rewards may remain where deterministic world-specific loot is desired.

**REQ-OFFER-BOON-67:** `OfferBoon` must not be authored on `onPartialClear`, `onEndOfTurn`, or common low-cost hazards in the first implementation unless a later spec explicitly expands the policy.

**REQ-OFFER-BOON-68:** Card/effect description and glyph rendering must describe `OfferBoon` clearly enough that a player can understand a world card's clear reward before clearing it.

## Non-Goals

- No support for choosing more than one boon per offer.
- No support for a pending-choice queue.
- No permanent non-exhaust boon grants.
- No replacement of all current `GainCard` clear rewards.
- No new unlock economy changes.
- No new boon-card art requirement.

## AI Validation

1. Run core card/effect registry tests and verify `OfferBoon` is recognized, described, compiled for display, and not treated as a normal playable effect by itself.
2. Run catalog/world manifest tests and verify every referenced boon set exists, every initial offered template is legal, and the `fortune-v1` set remains available.
3. Add reducer tests for `OfferBoon` on a world card's `onCleared`. Clearing the card must create a pending generic boon choice and emit a boon-offered event.
4. Add reducer tests for `bToDiscard` absent/false and true. The chosen card must land in hand for false and `playerDiscard` for true.
5. Verify `ChooseBoon` rejects missing, non-offered, non-player, and non-exhaust templates without mutating state.
6. Verify normal gameplay actions are rejected while a generic boon choice is pending.
7. Verify Fortune still offers 3 from `fortune-v1`, chooses 1, grants to hand, skips the opening Act 1 deal, and triggers only on real act advancement.
8. Run deterministic replay tests showing identical seeds/action sequences produce identical offered template IDs and different seeds may produce different legal offers.
9. Verify event batches contain the boon-offered event in the producing dispatch and the boon-granted event in the choice dispatch, with destination included.
10. Verify a multi-clear scenario cannot replace an already pending boon choice.
11. Verify the Table scene displays generic boon choices, supports pointer and number-key selection, blocks table interaction while open, and dismisses after a valid choice.
12. Verify at least one real world card data file exercises `OfferBoon` from `onCleared` without breaking world assembly.

## Open Questions

- Should the generic pending choice source be exactly `"worldClear"`, or should it carry a more detailed source object with hazard ID and template ID?
- Should failed closed multi-offer attempts emit a diagnostic gameplay event, or only avoid creating the second pending choice?
- Should future boon sets live in global boon data beside Fortune, inside each world bundle, or both?
- Should `bToDiscard: true` eventually permit permanent non-exhaust rewards, or should permanence be a separate effect?
