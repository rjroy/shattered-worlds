---
title: World 14 grief mechanics (Bargaining and Depression)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-14, applied-keywords, no-new-effects]
modules: [core-effects]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
---

# World 14 grief mechanics (Bargaining and Depression)

Focused brainstorm on mechanizing World 14's three acts (Bargaining / The Door / Depression) using only the effect kinds that already exist in `src/core/effects/registry.ts`, continuing the same constraint as World 13: no new effect kinds, new keywords via `ApplyKeyword`/`KeywordGate`/`RemoveKeyword` are fine.

## Act I — Bargaining, the search for a solution

Bargaining is trading — giving something up for a shot at a different outcome.

- `Modal` as the actual bargain: a card that branches — pay in one currency or another (e.g., destroy a hand card *or* take a Heat hit) — makes "what would you give up" a real choice instead of flavor text.
- `AddThreatToWorldDeck` as the bargain's hidden cost: the deal looks clean now, but it seeds a future hazard into the world deck that surfaces later in the act — the price isn't visible until it comes due.
- `AddPlayerCardToTop` for "glimpses of libraries on death": a lore/Destiny-flavored card queued to appear on the very next draw, as if something found in the archive is about to matter. Reads as research paying off in real time rather than as a cutscene.
- `OfferBoon` reflavored as a "reading" — consulting the ledger of the dead, offered as a genuine choice between two Destiny-adjacent boons, not a trap.

## Act II — The Door, cost of travel

- `GainHeat` with a negative amount as the toll: crossing costs warmth, tying directly back into World 13's Heat/Thaw economy — the Door makes it harder to thaw out of the numbness that world left behind. Real mechanical continuity between 13 and 14, not just narrative.
- `AddWorldCardToDeck` as the visible cost: each Door card adds a lingering hazard to the world deck — literalizes "eleven violet fractures hanging suspended" from `endworlds-destination.md` as an actual growing stack of unresolved things, not just backdrop art.
- `ExileTopWorldCards` as the point of no return: once through, some number of futures at the top of the world deck are gone permanently — no going back to what would have happened if you'd stayed.
- `ReturnPlayerDiscardToTop`/`RecallPlayerDiscard` as baggage: what was already spent to get here doesn't stay behind, it gets pulled back into hand — the Door doesn't let anything, including yourself, go cleanly.

## Act III — Depression, the only choice that makes sense

- `DamageScaled` off the existing `FrozenPlayerCards` counter (already in `resolveCounter`) — the more numbness still carried from World 13, the worse this act hits. Direct continuity, no new counter needed.
- `Brace` reframed as endurance rather than defense — not fighting for a win, just absorbing what's coming because that's what's left to do.
- `DiscardThenDraw` as "let go and keep moving" — not resolving anything, just cycling, matching "the best you can do is not die."
- `SurviveWorld` as the act's actual clear condition, deliberately anticlimactic — the compile text is already just `"SURVIVE!"` in the engine's own vocabulary, no fanfare needed.

## Open threads

- Whatever "carrying the Destiny away" resolves to must feed into World 15's single Acceptance ending, not imply a second track. This act sets up the convergence; it should not create a competing fork the way the old Refusal path did.
- Whether the Heat-toll-through-the-Door and the Frozen-counter-into-Act-III threads are the right continuity with World 13, or too cute — flagged for reaction, not yet decided.
