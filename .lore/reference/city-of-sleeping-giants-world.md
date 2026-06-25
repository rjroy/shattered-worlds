---
title: City of Sleeping Giants World
date: 2026-06-25
status: current
tags: [world-design, city-of-sleeping-giants, stir, recurrence, force-destroy]
fg-type: concept
fg-sources: [.lore/work/plans/city-of-sleeping-giants.md, .lore/work/notes/city-of-sleeping-giants.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/city-of-sleeping-giants/cards.json
    - src/data/worlds/city-of-sleeping-giants/index.ts
    - src/data/worlds/city-of-sleeping-giants/theme.ts
    - src/core/effects/worldCards.ts
  tests:
    - src/core/tests/cityOfSleepingGiants.test.ts
    - src/game/tests/cityOfSleepingGiantsPresentation.test.ts
  symbols:
    - AddThreatToWorldDeck
    - AddWorldCardToDeck
    - OfferBoon
    - ForceDestroy
---

# City of Sleeping Giants World

City of Sleeping Giants' threat verb is **stir**: unresolved or exploited hazards make body movements return at larger or worse scale. The design avoids adding a new awareness or Stir counter by using existing recurrence and deck-seeding effects.

## Resolved Authoring Decisions

Stale `Hidden` wording is authored as `Obstructed`.

World-hook recurrence uses `AddWorldCardToDeck { bTop: true }` and `AddThreatToWorldDeck`, not `ReturnWorldCards`. `ReturnWorldCards` is no-op on automatic world hooks because those hooks do not provide selected return ids, and where it does work it removes hazards from hand, which is boon-signed rather than threat-signed.

Surveyors Mark A Pulse uses `OfferBoon` rather than granting all five survey rewards. Each clear offers three tools and keeps one, avoiding large deck floods while preserving survey choice.

Body-movement hazards use `ForceDestroy` where the fiction is snatching or burying cards. That gives Brace rewards a real defensive target while structural hazards keep HP damage as the fail-state pressure.

## Delivery Shape

The world is gated through the unlock system, registers a signature threat, adds a boon source for survey rewards, and validates recurrence through top-decked body-reflex hazards rather than a new core engine slice. Base, music, unlock, and card inset assets are wired and covered by presentation asset checks.
