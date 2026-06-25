---
title: Rarity and Weighted Reward Pools
date: 2026-06-25
status: current
tags: [rarity, weighted-draw, rewards, boons, gain-random-card]
fg-type: architecture
fg-sources: [.lore/work/plans/rarity-system.md]
fg-status: current
---

# Rarity and Weighted Reward Pools

Rarity is a core card-template property with four ordered tiers: common, uncommon, rare, and legendary. Minted cards receive a concrete rarity, defaulting to common when the template omits it. Presentation color and glyph mapping stays in the renderer.

Boon sets and random loot pools share the same named-pool concept: a set id resolves to a list of template ids, and rarity is read from the templates themselves. Pool definitions do not carry separate rarity data.

## Weighted Draw

Reward selection uses a pure weighted-draw kernel. Each pick groups remaining candidates by present rarity tier, renormalizes fixed tier weights across those present tiers, rolls a tier, rolls uniformly within that tier, removes the chosen template, and repeats.

The kernel is legality-agnostic. Callers filter for player cards, exhaust-only cards, or other constraints before invoking it. RNG consumption is fixed and documented so same-seed replay remains explainable after moving from shuffle-and-slice to weighted composition.

## Preview Rule

Random rewards must not leak their rolled result through action preview or confirmation. `GainRandomCard` grants may emit the concrete result for committed game events, but preview summaries use the pool display name instead of naming the future card or tier.
