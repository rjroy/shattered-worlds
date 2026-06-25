---
title: Ember Orchard World
date: 2026-06-25
status: current
tags: [world-design, the-ember-orchard, incubation, delayed-pressure, boons]
fg-type: concept
fg-sources: [.lore/work/plans/the-ember-orchard.md]
fg-status: current
---

# Ember Orchard World

The Ember Orchard's threat verb is **incubate**: the player receives immediate warmth or utility that plants known future pressure. The world ships on current engine vocabulary rather than a bespoke timed-incubation system.

The world expresses incubation through top-decked hazards, self-transforming world cards, partial-clear and discard hooks, and a signature threat that keeps pressure recurring. The shared Walker and Door cards remain starter templates; Ember only contributes its world and reward data.

## Resolved Authoring Decisions

Stale `Hidden` wording is authored as `Obstructed`. `AddWorldCardToDeck { bTop: true }` is the top-deck primitive.

Hatchery Cellar uses `OfferBoon` instead of granting five fixed cards. It offers three tools from the Ember cellar pool and lets the player keep one, limiting deck dilution and preserving reward agency.

Ember creature pressure uses `ForceDestroy` so Brace rewards have something real to absorb. Non-creature hazards retain HP damage so survival pressure remains meaningful.

## Delivery Shape

Ember is a gated world unlock with real inset art, a registered theme, help/display metadata, boon source registration, asset bindings, and tests for the incubation loops, boon offer, threat mapping, and seeded three-act gameplay.
