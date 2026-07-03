---
title: Transit Authority World
date: 2026-07-02
status: current
tags: [world-design, transit-authority, reroute, forced-movement, deck-pressure, anime-inset-style]
fg-type: concept
fg-sources: [.lore/work/plans/transit-authority.md, .lore/work/notes/transit-authority.md, .lore/work/specs/transit-authority.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/transit-authority/cards.json
    - src/data/worlds/transit-authority/index.ts
    - src/data/worlds/transit-authority/theme.ts
    - src/data/worlds/transit-authority/meta.ts
  tests:
    - src/core/tests/transitAuthority.test.ts
    - src/game/tests/transitAuthorityPresentation.test.ts
  symbols:
    - Reroute
    - KEYWORD_COST_MODIFIERS
    - ApplyKeyword
    - RemoveKeyword
    - WORLD_THREAT_BY_WORLD_ID
---

# Transit Authority World

Transit Authority's threat verb is **reroute**: hazards force cards to the top of both decks and tag the forced world card with a transient `Reroute` keyword. This started as the spec's "authored feel only, no core touch" plan, but was upgraded during planning to a real applied keyword reusing the `ApplyKeyword`/`RemoveKeyword`/`KEYWORD_COST_MODIFIERS` primitives already built for `Lockdown` (New Derelict) and `Alarm` (Eden Prime) — see [[persistent-keyword-cost-modifiers]]. Unlike `Lockdown`, `Reroute` is **not** in `PERSISTENT_KEYWORDS`: it decays at turn start like `Alarm`, matching a "just got reassigned" framing where the self-transforming card carrying it has usually already been replaced. It taxes clear cost the same way Lockdown does (`ClearCostPerSelfKeyword`, `costPer: 1`), and is stripped by two route-control rewards, `Check the Board` and `Express Transfer`.

Seven hazard templates plus `Entity Detected` (the signature threat, `WORLD_THREAT_BY_WORLD_ID["transit-authority"]`) and five player-card rewards (`Temporary Credentials`, `Express Transfer`, `Check the Board`, `Board Anyway`, `Right of Way`) carry the world. `Reroute` is never authored in a card's static `keywords` array — it only ever appears at runtime via `appliedKeywords`, the same as `Alarm` and `Lockdown`.

Difficulty 4, cycle 7.

## Decided deviations from the source spec

- Dropped the effect-kind exclusion list (banning specific effects from Transit rewards) as contradicting the project's explicit "no mechanic is exclusive" rule in `theme-authoring.md`; identity protection is already handled by the verb carve-out and the distinctness test.
- Renamed the "mechanical identity" test to "distinctness" — same test (two rewards are non-distinct only if they share the same ordered effect-kind sequence, numeric params, energy cost, and exhaust), clearer name.
- Card insets specifically (not the shared backdrop/overlay/cardfront) use an **anime-but-gritty** rendering style — bold cel-shaded linework, high-contrast shading, grime/wear texture and imperfect edges to avoid clean-anime polish — as a deliberate, Transit-specific divergence from the shared ink-and-wash inset convention. Composition rules (one large foreground subject, bold silhouette, simplified background, no crowded props) are explicitly unchanged; "anime" pulls toward multi-figure action-panel habits that would violate those rules if followed uncritically, so the standing constraint was baked directly into the prompt template rather than left to each generation to remember.

## Delivery shape

Gated world unlock (`world-transit-authority`), registered theme/help/display metadata, a distinct `music-transit-authority` audio binding, thirteen anime-but-gritty card insets, and tests covering the Reroute application/tax/removal cycle, distinctness against sibling worlds' near-identical rewards (including a same-shape comparison against Highway Volcano's `Floor It`), and seeded three-act identity. Both the music binding and the unlock-catalog gate were open items flagged during implementation — see [[world-launch-checklist-gaps]] — and were resolved before merge.
