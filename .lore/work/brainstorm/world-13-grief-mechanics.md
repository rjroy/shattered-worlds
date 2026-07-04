---
title: World 13 grief mechanics (Denial and Anger)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-13, applied-keywords, no-new-effects, keyword-cost-modifiers, destiny-entity]
modules: [core-effects]
related: [.lore/work/brainstorm/endworlds-destination.md]
---

# World 13 grief mechanics (Denial and Anger)

Revised after checking against `.lore/reference/worlds/authoring/theme-authoring.md`. The original draft leaned on `FreezeCards`/`GainHeat`/`ThawCards` as the central mechanic, but that suite is `whiteout-parking-garage`'s signature (coupled, not just an effect — see the theme-authoring doc's Signature Effects table). Dropped as the spine, kept only as optional minor flavor (a card or two), not the through-line.

## Keywords and closer

World 13 keeps the standard contract: Act 3 ends with the shared `The Walker` → `Door` → `SurviveWorld` chain, unmodified (D1). Nothing about that closer changes.

The world introduces two new applied keywords that compete for the same hand real estate: `Denial` (Act II) and `Anger` (Act III). Both are registered as cost-*increasing* modifiers in `KEYWORD_COST_MODIFIERS` — carrying either one taxes a card, and since both stack rather than replace each other, a hand thick with grief is a hand that's expensive to play. By Act III both keywords are live simultaneously, and the player is choosing which cost to pay down first.

`Destiny` is introduced here as an in-fiction hazard, not a shared template — its own themed world card, appearing in Act III, playing the "trouble" role. Its clear cost scales with whichever of Denial/Anger currently has more total value in hand (`DealProgressScaled` off a `KeywordInHand` counter), so Destiny gets more expensive the deeper into either stage the player already is.

## Act I — Loss, fear, helplessness

- A card or two using `FreezeCards`/`ThawCards` for a specific numb moment — not the act's spine, just a beat.
- A `ForceDestroy` queued early with no `Brace` available yet — something lands later, guaranteed, no way to stop it.
- Cards here are otherwise unkeyworded — Denial and Anger haven't shown up yet; this act is the wound before either defense kicks in.

## Act II — Denial

- A hazard whose own effect is `ReturnWorldCards` — reject it, it goes back into the deck, it comes back later.
- `Denial` keyword applied via `ApplyKeyword`, taxing cost through `KEYWORD_COST_MODIFIERS`. `GainKeywordGuard` lets the player absorb the first `KeywordGate` trigger once denial accumulates — but it runs out.
- `DealProgressScaled` off the `KeywordInHand` counter for `Denial` could make holding onto Denial cards paradoxically easier to clear in the short term — leaning into it works, until it doesn't.

## Act III — Anger / Destiny's first appearance

- `Anger` keyword stacks alongside whatever `Denial` is still in hand — both taxing cost now, competing for which gets paid down first.
- `DealProgressAll` as the indiscriminate "Why" swing — hits every hazard in hand, no aim.
- `Destiny`'s card uses `ExileTopWorldCards` — cutting off future moments entirely and permanently, its own cost scaling off whichever of Denial/Anger is winning. This is what Destruction actually costs, and it costs more the deeper into grief the player already is.
- `KeywordGate` on combined Denial+Anger saturation unlocks the big `DealProgressAll`/`ExileTopWorldCards` payoff — earning the tool costs a `ForceDestroy` on yourself as the price of using it.

## Open threads

- Whether Denial and Anger need to visually/mechanically read as "competing" (e.g., a card that can only carry one) or whether simple co-stacking cost tax is enough to sell the tension.
- Exactly what `Destiny`'s Act III card looks like beyond "hazard whose cost scales with grief-keyword saturation" — needs a concrete template.
- The Attachment stat from `endworlds-destination.md` still doesn't have a job since the Refusal fork was cut — could track total Denial+Anger keyword-turns generated per run, but not decided.
