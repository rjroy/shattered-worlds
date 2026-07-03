---
title: Fog Beach Party World
date: 2026-06-15
status: current
tags: [world-design, fog-beach-party, conceal, light, numeric-keywords, gain-light]
fg-type: concept
fg-sources: [.lore/work/specs/fog-beach-party.md, .lore/work/brainstorm/fog-beach-party-world.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/fog-beach-party/cards.json
    - src/data/worlds/fog-beach-party/index.ts
    - src/core/model/keywords.ts
    - src/core/effects/resources.ts
  tests:
    - src/core/tests/fogBeachParty.test.ts
    - src/core/tests/keywords.test.ts
  symbols:
    - Concealed
    - GainLight
---

# Fog Beach Party World

Fog Beach Party's threat verb is **conceal**: hazards can be present and harmful while their identity is hidden. The response archetype is **reveal and endure**. Light is the weapon, but blind discard and sweep effects prevent hard lock.

## Core Mechanic

Keywords support numeric values such as `Concealed:3`. The world has a global `light` value on state. A card is concealed when its Concealed depth is greater than current Light. Concealment means exactly two things: the card cannot be single-targeted and its details are hidden. Other effects still resolve on true data.

## Light

`GainLight` raises the global Light value. Light decays at turn start, so visibility is a threshold that changes over time, not a resource spent by targeting. The HUD must show Light in Fog even at 0 and hide it in non-light worlds.

## World Shape

The Bonfire is visible and grants the light kit, solving the need-reveal-to-get-reveal problem. Abandoned Cooler provides harmless concealed noise so spending Light remains a decision. Whiteout uses a generalized keyword counter instead of bespoke fog logic.

Related: [[numeric-keywords-and-scaled-effects]] (the `Keyword`/`CounterSpec` engine slice this world introduced), [[whiteout-parking-garage-world]] (heat economy, deliberately shares no mechanic with Light).
