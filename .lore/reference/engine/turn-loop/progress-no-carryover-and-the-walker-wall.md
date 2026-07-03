---
title: Progress Never Carries Between Turns, and The Walker Is Meant to Be a Wall
date: 2026-07-02
status: current
tags: [world-deck, progress, hazards, the-walker, door, balance, meta-progression-motivation]
fg-type: decision
fg-sources: [.lore/work/specs/world-deck-slice.html]
fg-status: current
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/core/engine/reduce.ts
    - src/data/worlds/zombie-big-box/cards.json
  symbols:
    - progressDealtThisTurn
---

# Progress Never Carries Between Turns, and The Walker Is Meant to Be a Wall

Progress dealt to a Hazard is not a stored pool; it exists only as that Hazard's payment accrued during the current turn (`progressDealtThisTurn`, reset to 0 at every `EndTurn`, see [World Deck Loop](world-deck-loop.md)). A Hazard partially paid and then held must be paid again from scratch next turn. This is intentional and load-bearing, not an oversight: it is what forces a high-cost Hazard to demand a single burst turn rather than being chipped away gradually.

## The Walker is deliberately not guaranteed beatable

The clearest consequence ships in the first world (Zombie Big-Box): The Walker costs 10 Progress, and the starter deck is not expected to be able to resolve it in one turn. That is an accepted design outcome, not a bug or a softlock — the game's first real "boss" is meant to read as a wall on the starting loadout, and that wall is what motivates wanting more tools later (meta-progression, see [Destiny Progression](../../progression/destiny-and-unlocks/destiny-progression.md)).

## The forced-Door win path exists so the wall doesn't block winning

Because The Walker need not be beatable, the world still needs a win path that doesn't depend on beating it. Both of The Walker's outcomes lead to the same place: resolving it grants **Summon Door** (a player card that adds a Door to the top of the world deck), while discarding it instead applies its penalty, which adds a Door to the world deck directly. Either way, the **Door** (cost 4, `discardable: false`, reward `SurviveWorld`) becomes reachable. The Door cannot be discarded and can be held indefinitely across turns and even act boundaries, but the only way it leaves the hand is by paying its cost — resolving it is what wins the world. Surviving via the forced Door without ever resolving The Walker is a legitimate, intended win, not an edge case the design failed to close.
