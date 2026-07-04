---
title: World 14 grief mechanics (Bargaining and Depression)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-14, applied-keywords, no-new-effects, keyword-cost-modifiers, destiny-entity]
modules: [core-effects]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
---

# World 14 grief mechanics (Bargaining and Depression)

Revised after checking against `.lore/reference/worlds/authoring/theme-authoring.md`. Dropped the Heat-toll-through-the-Door idea (it doubled down on `whiteout-parking-garage`'s coupled Freeze/Heat suite) and dropped `ReturnPlayerDiscardToTop`/`RecallPlayerDiscard` as the baggage mechanic (that suite is `the-tidal-archive`'s signature). Neither is needed as a load-bearing mechanic here.

## Keywords and closer

World 14 also keeps the standard contract intact: Act 3 ends with `The Walker` → `Door` → `SurviveWorld`, unmodified.

Two new competing keywords, both cost-increasing via `KEYWORD_COST_MODIFIERS`: `Bargaining` (Act I) and `Depression` (Act III). Same shape as World 13's Denial/Anger pair — they stack rather than replace each other, and a hand carrying both is expensive.

`Destiny` continues here as the "trouble" hazard, same role as World 13: glimpsed in Act I as lore (the "libraries on death"), and carried forward into Act III as the thing the Walker takes with him. Its cost still scales off whichever grief-keyword (Bargaining/Depression) currently dominates hand.

## Act I — Bargaining, the search for a solution

- `Modal` as the actual bargain: a card that branches — pay in one currency or another (e.g., destroy a hand card *or* take a Heat hit) — makes "what would you give up" a real choice instead of flavor text.
- `AddThreatToWorldDeck` as the bargain's hidden cost: the deal looks clean now, but seeds a future hazard that surfaces later in the act.
- `AddPlayerCardToTop` for "glimpses of libraries on death": a Destiny-lore card queued to appear on the very next draw.
- `Bargaining` keyword applied via `ApplyKeyword`, taxed via `KEYWORD_COST_MODIFIERS`.

## Act II — The Door, cost of travel

- The Door itself stays untouched here — shared template, D1's fixed closer still applies at the end of Act 3, and this act is before that. What "the Door" means narratively in this act is the *concept* the Walker is learning about, not the mechanical closer card yet.
- `AddWorldCardToDeck` as the visible cost of what's being learned: each card adds a lingering hazard to the world deck — literalizes "eleven violet fractures hanging suspended" from `endworlds-destination.md`.
- `ExileTopWorldCards` foreshadows the point of no return that Act III commits to.

## Act III — Depression, the only choice that makes sense

- `Depression` keyword stacks alongside whatever `Bargaining` residue remains — both taxing cost, competing for priority.
- `DiscardThenDraw` as "let go and keep moving" — not resolving anything, just cycling, matching "the best you can do is not die."
- `Brace` reframed as endurance rather than defense — not fighting for a win, just absorbing what's coming.
- `Destiny`'s card here represents what's actually carried onward — its `onCleared` doesn't reward the player conventionally, it just marks that the Walker picked it up. `SurviveWorld` still comes from the standard `Door` closer, unchanged.

## Open threads

- Whether Bargaining/Depression need the same "competing, not sequential" stacking as World 13's pair, or whether Depression should fully eclipse Bargaining by Act III instead (matching how depression as a stage tends to settle rather than compete).
- Concrete `Destiny` card template for this world — what "carrying it" actually looks like as a hand/keyword state that then shows up in World 15.
