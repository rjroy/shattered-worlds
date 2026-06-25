---
title: Unlock System Runtime Ownership
date: 2026-06-25
status: current
tags: [unlocks, destiny, run-modifiers, runtime, meta-progression]
fg-type: architecture
fg-sources: [.lore/work/plans/unlock-system.md, .lore/work/notes/unlock-system.md]
fg-status: current
---

# Unlock System Runtime Ownership

The unlock system belongs to the gameplay runtime. `TableScene` no longer assembles worlds directly; the runtime chooses the starter deck override, builds `RunModifiers` from the activated unlock subset, assembles the world, and starts the gameplay session through one path.

Purchasing unlocks and activating run modifiers are distinct. The Destiny scene handles both buying Blessings and toggling which owned modifiers are active within the Destiny budget. Only activated ids feed `buildRunModifiers`.

## Persistence

The unlock profile stores purchased ids and activated ids. Spendable Memory Fragments are derived from earned feats minus purchased unlock costs, not stored as a mutable balance. Activated ids are constrained to purchased ids.

## Runtime Seam

Production `startSession(worldId, seed, options)` assembles from manifests and unlock state. Tests can inject `options.world` to supply a hand-built catalog and world data, but both production and test paths converge on the same modifier and session-creation tail.

## Destiny UI

Destiny is the between-run purchase and loadout screen. It displays spendable Fragments, active weight against the Destiny budget, purchase state, and activation toggles. Purchases auto-activate when they fit.
