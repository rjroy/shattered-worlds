---
title: Effective Card Modifiers Read Model
date: 2026-06-25
status: current
tags: [effective-cards, unlocks, run-modifiers, card-system, read-model]
fg-type: architecture
fg-sources: [.lore/work/plans/effective-card-modifiers.md]
fg-status: current
---

# Effective Card Modifiers Read Model

Player-card modifiers are applied as a pure read-model. Durable cards in `GameState` zones remain unchanged; core rules and UI derive effective player-card snapshots when they need to check legality, render card faces, spend energy, or resolve effects.

Modifiers are activated through `RunModifiers`. A modifier can target card templates, check conditions such as play ordinal, resources, or HP, and patch properties such as energy cost, exhaust behavior, name, keywords, or effect composition.

## Core Contract

Available-actions logic derives effective cards before checking affordability and target requirements. Reducer play resolution derives the snapshot before incrementing play history, validates against the same effective availability path, then removes or recycles the base card while applying the effective effect and cost.

Turn play history lives in core state and resets on end turn. It supports modifiers such as "first Sprint this turn costs 0" without mutating the card templates or the individual card instances.

## Design Constraint

Effective snapshots are not authority on their own. Reducer validation remains authoritative, and UI-selected snapshots are presentation/read-model artifacts. This prevents unlocked card changes from becoming a second rules engine in the renderer.
