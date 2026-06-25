---
title: Whiteout Parking Garage World
date: 2026-06-25
status: current
tags: [world-design, whiteout-parking-garage, heat, frozen-cards, themes]
fg-type: concept
fg-sources: [.lore/work/notes/whiteout-parking-garage.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/whiteout-parking-garage/cards.json
    - src/data/worlds/whiteout-parking-garage/index.ts
    - src/core/effects/heat.ts
    - src/data/unlocks/catalog.json
  tests:
    - src/core/tests/whiteout.test.ts
    - src/game/runtime/featEvaluator.whiteout.test.ts
  symbols:
    - GainHeat
    - FreezeCards
    - ThawCards
---

# Whiteout Parking Garage World

Whiteout Parking Garage is the cold-survival world built around heat, frozen cards, thawing, and burn-for-heat decisions. It is the reference world for connecting core mechanics, runtime telemetry, feats, unlocks, world data, theme assets, help, manifest wiring, and validation.

## Engine Shape

The core additions are heat, freeze, thaw, burn-for-heat effects, frozen-card hand retention, and start-of-turn thawing. The world also registers Whiteout-specific feats and the Thermal Cache unlock.

## Asset Pattern

Whiteout keeps base world assets under `src/game/assets/themes/whiteout-parking-garage/` and uses generated cinematic card insets that match the existing world art direction: cold concrete, whiteout glare, dirty sodium light, and amber heat accents.

## Validation Rule

Whiteout-level world changes should validate with typecheck, unit tests, direct Bun tests, production build, local server HTTP smoke, and asset dimension checks. Build/server smoke and static asset checks are fallback validation, not a substitute for a full interactive browser pass.
