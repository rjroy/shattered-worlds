---
title: Whiteout Parking Garage World
date: 2026-07-02
status: current
tags: [world-design, whiteout-parking-garage, heat, frozen-cards, themes]
fg-type: concept
fg-sources: [.lore/work/notes/whiteout-parking-garage.md, .lore/work/specs/whiteout-parking-garage.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/whiteout-parking-garage/cards.json
    - src/data/worlds/whiteout-parking-garage/index.ts
    - src/core/effects/heat.ts
    - src/core/engine/energy.ts
    - src/data/unlocks/catalog.json
    - src/data/feats/catalog.json
  tests:
    - src/core/tests/whiteout.test.ts
    - src/game/runtime/featEvaluator.whiteout.test.ts
  symbols:
    - GainHeat
    - FreezeCards
    - ThawCards
    - BurnForHeat
    - frozen
---

# Whiteout Parking Garage World

Whiteout Parking Garage is the cold-survival world built around heat, frozen cards, thawing, and burn-for-heat decisions. It is the reference world for connecting core mechanics, runtime telemetry, feats, unlocks, world data, theme assets, help, manifest wiring, and validation. Its threat verb is **freeze**; the response archetype is **heat economy**. It deliberately shares no mechanic with [[fog-beach-party-world]]: Fog's `Concealed`/`GainLight` is information (Light decays on its own, is never spent), Whiteout's heat is usability (heat never decays, is spent by `ThawCards`). See [[numeric-keywords-and-scaled-effects]] for the shared engine slice both worlds' hazards draw on.

## Engine Shape

`frozen?: number` lives on the minted `PlayerCard` instance, not as a keyword — freezing one copy of a template does not freeze the template or any other copy. A frozen player card is excluded from `availableActions.playable` but is retained in hand across end-of-turn instead of being discarded with the rest of the hand; it only leaves hand by being played (once thawed) or destroyed (`BurnForHeat` can target it directly, the emergency valve for a locked hand). `state.heat` is a spendable, non-decaying resource, gained by `GainHeat` and spent by `ThawCards`'s `heatCost` per card. `FreezeCards` picks up to `amount` unfrozen player cards at random (excluding its own source card where possible) and sets `frozen` to `max(existing, duration)` — freezing never shortens an existing lock.

Turn-start ordering is fixed and shared with Fog: light decay, then `thawFrozenCardsAtTurnStart` (decrement every frozen counter by 1, dropping to unfrozen at 0 but leaving the card in hand that turn), then applied-keyword decay (Alarm, Reroute), then energy gain/refill. `CardsFrozen` and `CardsThawed` events carry card ids and template ids so telemetry and renderer never have to diff object state to notice a freeze/thaw.

## Reward Kit And Hazard Roster

The heat kit (Hand Warmers, Ice Scraper, Burn The Manual, Space Heater, Jumper Cables) is granted by clearing the capstone world card `Maintenance Closet`, mirroring Fog's Bonfire pattern (a visible, high-cost world card whose `onCleared` is a `Sequence` of `GainCard` grants). The hazard roster escalates from ambient snow (Powder Drift, no freeze) through single-card freezes (Frozen Puddle, Black Ice Ramp) to the act-3 signature `The Garage Freezes Shut`, which freezes cards every turn and damages the player scaled by how many frozen cards they are carrying — the climax pressure that makes hoarding frozen cards actively dangerous, not just inconvenient.

## Feats And Unlocks

Whiteout adds run telemetry fields (`heat`, `cardsFrozen`, `cardsThawed`, `heatGained`, `heatSpent`, `cardsBurnedForHeat`) and four feats in `src/data/feats/catalog.json`: `first-whiteout-parking-garage` (first win), `heat-keeper` (win with heat ≥ 10), `master-thaw` (win after thawing ≥ 5 frozen cards), and `freeze-slayer` (resolve 25 `The Garage Freezes Shut` encounters). The `extra-heat` unlock ("Thermal Cache", cost 20, weight 1) grants `extraStartHeat: 2` via `RunModifiers`, mirroring `extra-light` and `extra-brace`; there is deliberately no heat-floor unlock, since heat is spendable and non-decaying and a floor would erase the burn/thaw pressure that defines the world.

## Asset Pattern

Whiteout keeps base world assets under `src/game/assets/themes/whiteout-parking-garage/` and uses generated cinematic card insets that match the existing world art direction: cold concrete, whiteout glare, dirty sodium light, and amber heat accents.

## Validation Rule

Whiteout-level world changes should validate with typecheck, unit tests, direct Bun tests, production build, local server HTTP smoke, and asset dimension checks. Build/server smoke and static asset checks are fallback validation, not a substitute for a full interactive browser pass.
