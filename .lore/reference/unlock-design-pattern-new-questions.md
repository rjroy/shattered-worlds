---
title: Unlock Design Pattern — Ask a New Question
date: 2026-07-02
status: current
tags: [unlocks, meta-progression, design-pattern, gameplay-identity]
fg-type: concept
fg-sources: [.lore/work/brainstorm/unlocks-changing-gameplay.md]
fg-status: current
---

# Unlock Design Pattern — Ask a New Question

A guiding pattern for authoring future Destiny Blessings, distinct from the six mechanical effect categories already in the catalog (see [[destiny-blessing-catalog-design]]). Most shipped unlocks are straightforward power increases — more starting HP, more energy, more light, bigger hand size. The pattern names what separates a merely-stronger unlock from one that changes how a run is played: **a good unlock should ask the player a new question during the run**, not just make an old answer bigger.

Three shipped unlocks already do this and anchor the pattern:

- **Tough Hide** asks "can I survive slightly longer?" — the baseline power-increase case.
- **Fortune** (`act-reward`) asks "which temporary tool changes this act?" — see [[fortune-act-boon-rewards]].
- **Athlete's Instinct** (a starter-deck override) asks "how does my opening deck reshape the whole run?"

## Categories drawn from Slay the Spire relic design

The brainstorm mined Slay the Spire's relic design for reusable unlock shapes, none of which are implemented yet but which describe a design space still open for future Blessings:

1. **Create new priorities** — reward counting or sequencing that the player wouldn't otherwise track (e.g. "every third Sprint gains extra energy").
2. **Convert one resource into another** — build identity through conversion (e.g. heat spendable as energy, at a cost).
3. **Add constraints with upside** — a boss-relic-style trade (e.g. draw +1 each turn, but reward choices shrink by one).
4. **Make weak cards or awkward states desirable** — change what the player drafts or tolerates (e.g. `Panic` becomes a burst effect the first time it's played each act). This is also explored mechanically in [[effective-card-modifiers-read-model]], which shipped the engine primitives (`playerCardModifiers`, conditional patches) that this category would need.
5. **Change the start of the run** — starter-deck identity, already validated by Athlete's Instinct.
6. **Alter reward structure** — reshape what act/world-clear rewards offer, already validated by Fortune and [[offer-boon-reward-path]].

## Caution: sidegrade, not stack

Because these unlocks are meta-progression and can be strange or build-defining rather than purely additive, the brainstorm's explicit caution is that they should act as **sidegrades inside the Destiny budget** rather than permanent stacking power — the existing `DESTINY_BUDGET = 5` (see [[destiny-blessing-catalog-design]]) is treated as sufficient headroom for weirder, more build-defining unlocks without every run becoming overloaded.
