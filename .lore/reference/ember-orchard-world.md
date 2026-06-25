---
title: Ember Orchard World
date: 2026-06-25
status: current
tags: [world-design, the-ember-orchard, incubation, delayed-pressure, boons]
fg-type: concept
fg-sources: [.lore/work/plans/the-ember-orchard.md, .lore/work/notes/the-ember-orchard.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/the-ember-orchard/cards.json
    - src/data/worlds/the-ember-orchard/index.ts
    - src/data/worlds/the-ember-orchard/theme.ts
    - src/core/effects/worldCards.ts
  tests:
    - src/core/tests/emberOrchard.test.ts
    - src/game/tests/emberOrchardPresentation.test.ts
  symbols:
    - OfferBoon
    - ForceDestroy
    - AddWorldCardToDeck
---

# Ember Orchard World

The Ember Orchard's threat verb is **incubate**: the player receives immediate warmth or utility that plants known future pressure. The world ships on current engine vocabulary rather than a bespoke timed-incubation system.

The world expresses incubation through top-decked hazards, self-transforming world cards, partial-clear and discard hooks, and a signature threat that keeps pressure recurring. The shared Walker and Door cards remain starter templates; Ember only contributes its world and reward data.

## Resolved Authoring Decisions

Stale `Hidden` wording is authored as `Obstructed`. `AddWorldCardToDeck { bTop: true }` is the top-deck primitive.

Hatchery Cellar uses `OfferBoon` instead of granting five fixed cards. It offers three tools from the Ember cellar pool and lets the player keep one, limiting deck dilution and preserving reward agency.

Ember creature pressure uses `ForceDestroy` so Brace rewards have something real to absorb. Non-creature hazards retain HP damage so survival pressure remains meaningful.

## Delivery Shape

Ember is a gated world unlock with a registered theme, help/display metadata, boon source registration, base/music/unlock asset bindings, card inset bindings, and tests for the incubation loops, boon offer, threat mapping, presentation assets, and seeded three-act gameplay.
