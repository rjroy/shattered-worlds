---
title: Keyword Density Bias Differentiates the Shared Starter Deck for Free
date: 2026-07-02
status: current
tags: [theme, world-design, keywords, starter-deck, differentiation]
fg-type: concept
fg-sources: [.lore/work/brainstorm/theme-mechanical-differentiation.md, .lore/work/brainstorm/shard-response-archetypes.md]
fg-status: current
fg-evidence:
  code:
    - src/data/allCards.json
    - src/data/worlds/zombie-big-box/cards.json
    - src/data/worlds/highway-volcano/cards.json
    - src/data/worlds/bird-building/cards.json
---

# Keyword Density Bias Differentiates the Shared Starter Deck for Free

The starter deck is shared and unchanged across worlds, but several starter cards read a keyword-tagged bonus off whatever they're targeting: `Baseball Bat` bonuses against `Creature`, `Sprint` bonuses against `Slow`, and `Explore`/`Listen` bonus against `Obstructed`. Because the bonus is keyword-driven rather than world-specific, biasing which keyword a world's hazards carry changes which shared starter card is the correct answer in that world — with zero code, purely by editing hazard keyword arrays in data.

## Verified in shipped data

- **`zombie-big-box`** biases toward `Creature`: `Zombie` carries `["Creature"]`, making `Baseball Bat` (`DealProgress` with a `Creature` bonus) the signature answer.
- **`highway-volcano`** biases toward `Slow`: `Gridlock`, `Ash Fall`, and `Lava Flow` all carry `["Slow"]`, making `Sprint`'s `Slow`-bonus branch the outrun-it answer.
- **`bird-building`** biases toward `Obstructed`: `Shadow Overhead`, `Sliding Debris`, `Gripping Talon`, and `Find Fire Axe` all carry `Obstructed`, making `Explore`/`Listen` (both bonus against `Obstructed`) the scout-don't-swing answer.

## A naming note

The originating brainstorm (`theme-mechanical-differentiation.md`) proposed this lever using the keyword name "Hidden." The keyword that actually shipped for this purpose is named `Obstructed` — the mechanic and the lever are exactly as designed, only the keyword's name changed before it landed in the engine. `Hidden`/`Concealed` later became its own, separate mechanic (see `fog-beach-party-world`'s `Concealed` keyword), unrelated to this bias lever.

## Why it matters

This is the cheapest available differentiation lever for a new world: before reaching for a new effect kind, check whether biasing hazard keyword density toward an existing starter-card bonus already makes the shared deck play differently. See [[theme-authoring]] for the full effect/keyword vocabulary and [[place-disaster-contrast-theme-rule]] for the companion fiction-level lever.
