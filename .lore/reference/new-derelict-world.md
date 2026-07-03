---
title: New Derelict World
date: 2026-07-02
status: current
tags: [world-design, new-derelict, isolate, lockdown, persistent-modifier, deck-pressure]
fg-type: concept
fg-sources: [.lore/work/plans/new-derelict.md, .lore/work/notes/new-derelict.md, .lore/work/specs/new-derelict.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/new-derelict/cards.json
    - src/data/worlds/new-derelict/index.ts
    - src/data/worlds/new-derelict/theme.ts
    - src/data/worlds/new-derelict/meta.ts
  tests:
    - src/core/tests/newDerelict.test.ts
    - src/game/tests/newDerelictPresentation.test.ts
  symbols:
    - Lockdown
    - PersistentModifier
    - onDraw
    - WORLD_THREAT_BY_WORLD_ID
---

# New Derelict World

New Derelict's threat verb is **isolate**. Hazards seal world cards in hand with the `Lockdown` keyword — the first keyword to ship as genuinely persistent (it does not decay at turn start, unlike every prior applied keyword). A Locked card's clear cost climbs per other Locked card in the hand cluster (see [[persistent-keyword-cost-modifiers]]), so leaving seals unaddressed compounds into an increasingly expensive hand rather than a single fixed penalty.

Seven hazard templates (`Bulkhead 7-C Seals`, `Unfinished Captain's Address`, `Gravity Priority Shift`, `Administrative Misfile`, `Corridor Becomes Lifeboat`, `Systems Panel`, `The Order Arrives`) and four player-card rewards (`Emergency Route`, `Override Badge`, `Manual Release`, `Follow the Checklist`) carry the world. `The Order Arrives` is the signature threat (`WORLD_THREAT_BY_WORLD_ID["new-derelict"]`), dealing base damage plus a Lockdown-scaled bonus. `Override Badge` and `Manual Release` are the release valves that strip `Lockdown` back off.

Difficulty 4, cycle 6.

## Resolved authoring decisions

Two "fixed template" placeholders in the source spec were resolved by challenging the fixed-recipe approach rather than inventing new template ids: `Follow the Checklist` uses `ReturnPlayerDiscardToTop` instead of a fixed top-deck target, and `Gravity Priority Shift` uses `RecallPlayerDiscard` with a `highestCost` selector instead of a fixed pinned template. Every world-card template authors all five required hooks, including `onDraw: { "kind": "None" }` where unused — `onDraw` is a hook that postdates some older reference material and is easy to under-count.

This world's own card recipes (`Gravity Priority Shift`, `Corridor Becomes Lifeboat`, `The Order Arrives`) put template references inside `onPartialClear`, which exposed a pre-existing gap in the registry conformance-test's template-reference walker — see [[world-registry-template-reference-walker]].

## Delivery shape

Gated world unlock (`world-new-derelict` in the unlock catalog), registered theme/help/display metadata, a distinct `music-new-derelict` audio binding (an earlier in-flight reuse of Eden Prime's music key was a stopgap, not a shipped pattern — see [[world-launch-checklist-gaps]]), eleven generated card insets, and tests covering the Lockdown persistence/decay contrast with `Alarm`, the cluster-tax cost compounding, the release valves, and seeded three-act identity.
