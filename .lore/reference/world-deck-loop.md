# World Deck Loop

<!--
date: 2026-06-15
status: current
tags: world-deck, hazards, progress, acts, acquisition, loop
fg-type: architecture
fg-sources: .lore/work/specs/world-deck-slice.html, .lore/work/plans/world-deck-slice.html, .lore/work/notes/world-deck-acquisition.html
fg-status: current
-->

The world deck is both threat engine and acquisition engine. World cards enter the player's hand as hazards. Player cards deal Progress to hazards; cleared hazards can grant cards or survival progress; discarded hazards apply penalties; ignored hazards persist and clog the hand.

## Turn Shape

Each turn refills toward a six-card hand while ensuring world pressure continues when there is room. Player cards are discarded at end of turn. World cards stay in hand unless cleared, discarded, returned, destroyed, or otherwise moved by an effect. Partial Progress is per-turn only and resets at turn end, making large hazards require burst turns.

## Acts

A world is authored as ordered acts. The active act's world draw pile is shuffled from data; when it empties and another world draw is needed, the next act becomes the draw pile. Unresolved world cards in hand persist across act boundaries.

## Canon Exit

Act 3 ends on The Walker, which leads to the Door and the world-survival path. The Walker and Door are shared canon cards, referenced by worlds rather than redefined.
