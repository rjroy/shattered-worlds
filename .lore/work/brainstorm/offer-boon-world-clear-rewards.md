---
title: OfferBoon world clear rewards
date: 2026-06-19
status: open
tags: [brainstorm, rewards, boons, world-cards]
modules: [core-engine, card-effects, table-ui]
---

# OfferBoon world clear rewards

## Context

World card clear rewards currently lean on fixed `GainCard` effects. That works for authored rewards like "clear this hazard, gain this specific tool," but it makes world-clear rewards deterministic and can make every reward feel like a deck-bloat event.

The existing `act-reward` unlock already proves the more interesting interaction: present a small boon pool, let the player choose one temporary card, then grant the chosen card. The desired direction is to use that same kind of choice as a world-clear reward.

## Agreed Shape

Introduce one general effect primitive:

```ts
{
  kind: "OfferBoon";
  setId: string;
  offeredCount: number;
  chooseCount: 1;
  bToDiscard?: boolean;
}
```

The other brainstormed reward variants are mostly configuration of this effect:

- `setId` chooses the boon set.
- `offeredCount` controls draft width.
- `chooseCount` is initially fixed to `1`.
- `bToDiscard` controls whether the chosen card goes to discard instead of hand.

Default behavior should be `bToDiscard: false`, meaning the chosen boon goes directly to hand.

## Semantics

`OfferBoon` should create a pending boon choice from a named boon set. The offered templates are randomly sampled from that set using the run RNG, filtered to legal boon templates.

The chosen card should mint as a player card. The current Fortune boon model suggests requiring `exhaust: true` for offered cards, at least initially, so clear rewards add tactical one-shot help instead of permanently inflating the deck.

Destination behavior:

- `bToDiscard: false | undefined`: chosen boon goes to hand.
- `bToDiscard: true`: chosen boon goes to `playerDiscard`.

The UI copy can reflect the destination:

- Hand: "Pick one temporary card. It goes directly to your hand."
- Discard: "Pick one temporary card. It goes to your discard pile."

## Generalize Act Boons

The act-reward system should become a generic boon-choice system rather than adding a second parallel modal path.

Replace `pendingActBoon` with something like:

```ts
type PendingBoonChoice = {
  source: "act" | "worldClear";
  setId: string;
  offeredTemplateIds: readonly CardTemplateId[];
  chooseCount: 1;
  bToDiscard: boolean;
};
```

Replace the act-specific action with a generic action:

```ts
{ type: "ChooseBoon"; templateId: CardTemplateId }
```

Act reward becomes one producer of `PendingBoonChoice`. `OfferBoon` becomes another producer.

Possible events:

```ts
{ type: "BoonOffered"; source: "act" | "worldClear"; setId: string; templateIds: readonly CardTemplateId[] }
{ type: "BoonCardGranted"; cardId: CardId; templateId: CardTemplateId; dest: "hand" | "playerDiscard" }
```

The existing `ActBoonChoiceView` can become `BoonChoiceView`. The current card-preview layout and numeric shortcut flow should mostly carry forward.

## Important Edge Case

`DealProgressAll` can clear multiple world cards in one effect. If more than one cleared card has `OfferBoon`, the engine needs a policy.

Initial conservative policy:

- Only one pending boon choice may exist at a time.
- If an effect would create a second pending boon choice, fail closed or skip the later offer.
- Avoid authoring `OfferBoon` on cards likely to be swept together until queues are intentionally designed.

Longer-term policy option:

- Add a boon-choice queue and resolve choices one at a time.

The queue is more complete, but it adds complexity to reducer blocking rules, event streams, UI, tests, and simulations. The first implementation should probably avoid it.

## Authoring Direction

Do not replace every `GainCard` clear reward at once. Start with cache-style or high-cost world cards where a draft moment feels worth the modal interruption.

Good first targets:

- Multi-card reward caches currently authored as `Sequence` of `GainCard`.
- Expensive or rare hazards whose payoff should feel like a discovery.
- Act-pacing reward cards, if the world wants a mid-act spike.

Avoid at first:

- Common low-cost hazards.
- Partial-clear effects.
- End-of-turn effects.
- Cards likely to be resolved in bulk by `DealProgressAll`.

## Open Questions

- Should `OfferBoon` require `exhaust: true`, or should the boon set decide whether cards are temporary?
- Should `bToDiscard: true` allow non-exhaust permanent cards as a separate reward tier?
- Should boon sets live beside `pool-fortune`, or should each world define local boon sets in its own data bundle?
- Should the source include the cleared world card id/template id for event telemetry and animation?
- Should `BoonOffered` happen before or after `HazardResolved` in the event list?

## Tentative Recommendation

Generalize act boons first, then implement `OfferBoon` as a hook effect that reuses the generalized offer creation and choice resolution path.

Keep the first version narrow:

- `chooseCount` must be `1`.
- Offered templates must be exhaust player cards.
- Chosen cards go to hand unless `bToDiscard` is true.
- Only one pending boon choice is supported.
- Initial authoring replaces a small number of cache-style `GainCard` rewards.
