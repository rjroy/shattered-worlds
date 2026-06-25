---
title: World Access Unlocks
date: 2026-06-25
status: current
tags: [world-unlocks, destiny, world-select, access-control, unlocks]
fg-type: decision
fg-sources: [.lore/work/plans/world-access-unlocks.md]
fg-status: current
---

# World Access Unlocks

World access unlocks are ownership gates, not run loadout modifiers. A `worldUnlock` effect records access in `purchased`; it does not enter `activated`, has zero Destiny weight, and does not change `RunModifiers`.

## Decisions

Locked worlds remain visible in World Select. Clicking a locked world routes to Destiny instead of launching Table. Locked-world help is gated as well, so the Help overlay does not preview mechanics for a world the player has not unlocked.

`isWorldUnlocked(worldId, profile, catalog)` is the access helper. It returns true for ungated worlds, true for gated worlds whose unlock id is purchased, and false for gated worlds whose unlock id has not been purchased.

## UI Semantics

Destiny renders world unlocks as buyable access cards. Owned world unlocks show unlocked/owned state but no active/inactive toggle, because activation is reserved for run modifiers.
