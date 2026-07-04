---
title: World 15 grief mechanics (Acceptance)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-15, applied-keywords, no-new-effects, keyword-cost-modifiers, acceptance-ending, destiny-entity]
modules: [core-effects]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
  - .lore/work/brainstorm/world-14-grief-mechanics.md
---

# World 15 grief mechanics (Acceptance)

Revised after checking against `.lore/reference/worlds/authoring/theme-authoring.md`. Two changes from the original draft:

1. Dropped the Freeze/Thaw-as-continuity-thread idea (coupled to `whiteout-parking-garage`) — kept only as optional flavor, not spine, matching Worlds 13 and 14.
2. Resolved the direct conflict between "win condition is NOT the Door" and D1 ("Act 3 always ends with `The Walker` → `Door` → `SurviveWorld`"). Resolution: World 15 keeps all three — `The Walker`, `Door`, and `Destiny` — present and unmodified as templates, but flips which one is trouble and which one is the survive condition.

## Keywords and closer

World 15 reprises all four keywords from Worlds 13 and 14 — `Denial`, `Anger`, `Bargaining`, `Depression` — all still cost-*increasing* via `KEYWORD_COST_MODIFIERS`. It adds a fifth, `Acceptance`, the only cost-*decreasing* keyword in the game. This is the direct mechanism for "hard if you fight it, easy if you accept" — not a `ResourceGate` punishment layered on top, just the existing keyword-cost-modifier registry doing the work it already does, pointed the opposite direction for once.

`Door` and `Walker` stay completely standard here — same authoring, same behavior, no special-casing, exactly as in every other world. No tax is targeted at Door; the ordinary escape every world already has is still sitting there, untouched, if the player never engages with Acceptance at all. `Destiny` is the only thing that changes: it's authored with a base cost high enough to be nigh-impossible to clear without substantial `Acceptance` stacked. Its cost drops via `KEYWORD_COST_MODIFIERS` as Acceptance accumulates, and only once it's actually reachable does its `onCleared` (which fires `SurviveWorld` directly — a legitimate use of the same generic effect, not reserved to Door) become a viable path. Destiny is an earned alternate ending, not a replacement for Door and not something Door's difficulty needs to account for. Nothing about the shared `Door`/`Walker` templates is redefined (N1 stays intact), and nothing about their authoring changes at all.

## Act I — Denial + Anger, reprised

- Both keywords reappear, saturating faster than their home worlds did — less patience, same shapes, same cost tax.
- "Requiring unlocks earned earlier in the run" maps onto `GainKeywordGuard`: pre-load guard charges from actually-earned Destiny Blessings/Feats. A run that skipped unlocks hits every `KeywordGate` trigger — and pays every keyword's cost tax — unguarded.
- `ForceDestroy` stacking faster with less `Brace` available than World 13 had.

## Act II — Bargaining + Depression, reprised

- Same pair, same cost tax, turned down in intensity — lower `AddThreatToWorldDeck` stakes, gentler `Modal` bargains, slower `DiscardThenDraw` cycling. The player already knows this dance; the tempo drop is the content.
- `ResourceGate` checks stay calm here — nothing ambushes low HP the way Act I's aggression does.

## Act III — Acceptance

- `RemoveKeyword` clears `Denial`/`Anger`/`Bargaining`/`Depression` one at a time — each card sheds one thing carried forward from the earlier worlds, and each removal lifts that keyword's cost tax.
- `ApplyKeyword` stamps `Acceptance` as those clear, and `Acceptance`'s cost-reduction (via `KEYWORD_COST_MODIFIERS`) makes the remaining hand cheaper to play the more of it accumulates — mechanically, letting go makes everything easier, not just narratively.
- Reflavor `Heal`/`GainEnergy`/`GainLight`/`Brace` as caretaking the other Walker rather than self-preservation; `DealProgress` reflavors as helping him focus on a threat rather than the player striking it directly.
- `Door` sits in hand too, completely standard, same cost it would be in any other world — the ordinary flight instinct is still available and untouched if the player never accepts anything.
- `Destiny`'s base cost is authored high enough to be nigh-impossible without meaningful `Acceptance` stacked; it clears cheaper the more `Acceptance` has accumulated, and its `onCleared` is the one that fires `SurviveWorld` when it does.

## Imagery

- Act I saturated, fast. Act II muted grey-blue, no threat music. Act III color returns as warmth. The other Walker renders as a distinct, less-corrupted figure fighting the world's cards, while the player's plays manifest as small gestures around him.

## Open threads

- Whether `Destiny`'s `SurviveWorld` card needs a specific narrative beat (what clearing it looks like on screen) so the player understands it's the intended ending, given `Door` sits right next to it looking exactly like it always has.
- Roughly how high "nigh-impossible" needs to be authored as an actual number, and how much `Acceptance` a realistic Act III run can accumulate by the time Destiny is in hand — needs a pass with real numbers, not just the shape of the idea.
- Whether `GainKeywordGuard` pre-loading from earned Blessings/Feats needs a concrete mapping before this is buildable, or stays conceptual for now.
