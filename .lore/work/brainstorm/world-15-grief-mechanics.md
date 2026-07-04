---
title: World 15 grief mechanics (Acceptance)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-15, applied-keywords, no-new-effects, acceptance-ending]
modules: [core-effects]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
  - .lore/work/brainstorm/world-14-grief-mechanics.md
---

# World 15 grief mechanics (Acceptance)

Focused brainstorm on mechanizing World 15's three acts (Denial+Anger reprised / Bargaining+Depression reprised / Acceptance) using only the effect kinds that already exist in `src/core/effects/registry.ts`, continuing the same constraint as Worlds 13 and 14: no new effect kinds, new keywords via `ApplyKeyword`/`KeywordGate`/`RemoveKeyword` are fine.

The hard constraint carried in from `endworlds-destination.md`: the Refusal fork was explicitly dropped. World 15 converges on a single Acceptance ending — "hard if you fight, easy if you accept, and you're not even the one fighting" has to be true mechanically here, not just asserted narratively.

## Act I — Denial + Anger, reprised

- Fast-forward version of both worlds' toolkits at once: `Numb`/`Denial`/`Anger` keywords all stacking via `ApplyKeyword` in the same act, `KeywordGate` thresholds hit sooner than the first time through — less patience, same shapes.
- "Requiring unlocks earned earlier in the run" maps onto `GainKeywordGuard`: pre-load guard charges from actually-earned Destiny Blessings/Feats rather than generating them in-act. A run that skipped certain unlocks hits every `KeywordGate` trigger unguarded — the compression punishes an undercooked Destiny, a real and checkable design lever rather than flavor text.
- `ForceDestroy` stacking faster with less `Brace` available than World 13 had — Anger's chaos compressed into less room to breathe.

## Act II — Bargaining + Depression, reprised

- Same toolkit as World 14 (`Modal` bargains, `DiscardThenDraw` cycling, `GainHeat` toll) but with the numbers turned down across the board — not a new mechanic, the same shapes at lower stakes. The player already knows this dance; the tempo drop is the content.
- `ResourceGate` checks stay calm here — nothing ambushes low HP/Heat the way Act I's aggression does. Sluggish, not threatening.

## Act III — Acceptance

The act worth being most deliberate about, since the win condition is not the Door — it's a different version of the Walker dealing with the world's cards, and the player's job is just to be there for him.

- Reflavor rather than invent: `Heal`/`GainEnergy`/`GainLight`/`Brace` already just touch the player's own HP/energy/light/brace. Recast that here as caretaking the other Walker, not self-preservation — no new effect, just a narrative reskin of what "your resources" represent.
- `DealProgress` (player picks a hazard, deals effort toward clearing it) reflavors as "helping him focus on this threat" rather than the player striking it directly — mechanically identical, framed as support instead of combat.
- The "hard if you fight it" half: import Act I's aggressive toolkit (`DealProgressAll` spam, `ForceDestroy` chaining) into Act III and let `ResourceGate` punish it specifically here — the exact moves that worked in Act I backfire in Act III. Fighting harder makes it mechanically worse, not just tonally wrong.
- The release: `RemoveKeyword` clearing `Numb`/`Denial`/`Anger` one at a time, each card shedding one thing carried forward from Worlds 13 and 14. Once all three are gone, a `KeywordGate` on a new `Acceptance` keyword flips — but positively, gating `SurviveWorld` as the payoff instead of a disruption. Same mechanism every other world uses to punish, inverted once, on purpose, at the very end.
- Closing beat: `ThawCards` on whatever's still frozen, right before `SurviveWorld` fires. The last play of the game is letting go of the last thing being held onto.

## Imagery

- Act I: saturated, fast, everything from Worlds 13/14 crammed into flashes.
- Act II: muted grey-blue, no threat music.
- Act III: color returns as warmth rather than intensity. The other Walker renders as a distinct, less-corrupted figure actually fighting the world's cards, while the player's plays manifest as small gestures around him — a hand on a shoulder, held light — rather than attacks.

## Open threads

- Whether the "same `KeywordGate` mechanism, inverted once at the very end" idea for Acceptance reads clearly in play or is too subtle to land without extra signposting — flagged for reaction, not decided.
- Whether pre-loading `GainKeywordGuard` from earned Blessings/Feats needs a concrete mapping (which unlocks grant how many charges) before this is buildable, or stays conceptual for now.
