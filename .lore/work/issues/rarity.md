---
title: Rarity system
date: 2026-06-19
status: resolved
tags: [rarity, rewards, boons]
modules: [core-engine, card-effects, card-data]
related: [.lore/work/brainstorm/rarity-system.md]
---

# Rarity system

We should add a rarity system. This could be randomness in the reward a card provides as well as randomness in the set of boons that are there for chosen reward.

## Resolution

Designed in [.lore/work/brainstorm/rarity-system.md](../brainstorm/rarity-system.md). Two-step weighted-draw kernel (weight the tier, pick uniformly within it), four-tier ladder (Common/Uncommon/Rare/Legendary) with global weights, one primitive resolved in pick mode (OfferBoon/Fortune) or roll mode (`GainRandomCard`). Proceeding to spec.

