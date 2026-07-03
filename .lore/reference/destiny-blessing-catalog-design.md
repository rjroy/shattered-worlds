---
title: Destiny Blessing Catalog — Unique Unlocks Under a Weighted Point Budget
date: 2026-07-02
status: current
tags: [meta-progression, unlocks, destiny, balance, catalog]
fg-type: decision
fg-sources: [.lore/work/design/unlock-catalog.md]
fg-status: current
fg-evidence:
  code:
    - src/data/unlocks/catalog.json
    - src/data/unlocks/catalog.ts
    - src/data/unlocks/types.ts
  tests:
    - src/data/unlocks/catalog.test.ts
  symbols:
    - UnlockDefinition
    - DESTINY_BUDGET
    - buildRunModifiers
    - activeWeight
    - canActivate
---

# Destiny Blessing Catalog — Unique Unlocks Under a Weighted Point Budget

The Destiny Blessing catalog is purchased with Memory Fragments and activated within a per-run Destiny budget (`DESTINY_BUDGET = 5`). Two design rules anchor the catalog:

- **Unique unlocks only.** No stacking — each unlock exists once. A stronger version of an idea is a separate catalog entry, not a purchasable tier.
- **Weighted activation budget.** Each unlock declares a `destinyWeight` (0–3). The budget is what prevents a player from activating every owned Blessing at once and forces a build choice. A weight of 5 with unlocks spanning weight 1–3 was validated by hand-checking that several distinct 5-point builds (e.g. a fog specialist, an athlete, an aggressor) all feel viable and distinct — the budget isn't felt as a constraint until a player owns at least two unlocks, which is judged to be the right pacing.

Each `UnlockDefinition.effect` is a discriminated union tag consumed by `buildRunModifiers`, which folds all activated unlocks into one `RunModifiers` object read by the core engine at world-build time. The engine never inspects the unlock catalog directly — only the assembled `RunModifiers`.

## Effect categories established by this catalog

The original catalog defined six categories of unlock, each still present in the live catalog:

- **Starting stats** (weight 1, e.g. Tough Hide `+3 HP`, Charged `+1 starting energy`, Fog Lantern `+2 starting light`, Braced `+2 starting brace`) — cheap, additive, and often world-specific in effect (light/brace only matter in worlds with those mechanics).
- **Hand size** (weight 2, Adaptable) — `handSizeBonusPerAct` grows hand size as the run progresses (base +1 per completed act), read at draw time rather than recomputed on an act-transition event.
- **Combat** (weight 2, Sharpened Instincts) — `keywordDamageBonus` adds to keyword-triggered progress bonuses (e.g. Explore's Hidden bonus, Sprint's Slow bonus), silently buffing every keyword-tagged card the player owns.
- **Resource floor** (weight 2, Fog Signal / Steady Pulse) — `minResourcePerTurn` clamps light or energy to a floor after the normal turn-start change, restructuring a world's pressure loop (Fog Signal) or rewarding aggressive spending with a refund (Steady Pulse).
- **Character** (starter deck override) — replaces the default starter deck with a themed alternative. The catalog has grown to one starter-deck override per world (footballer, contractor, harvester, archivist, surveyor, …), each mutually exclusive at activation time (`canActivate` blocks activating a second starter deck).
- **Discovery** (Fortune, `act-reward`) — offers a reward choice after each act. The concrete mechanism (a boon-pool offer with template ids, not a raw 3-random-card draft) was finalized later; see [[fortune-act-boon-rewards]].

## Divergence from the original weight rationale

The original catalog design gave starter-deck overrides weight 3, reasoning that choosing a character identity is the highest-level build decision and should consume most of the budget. The shipped catalog instead gives every `starterDeckOverride` entry `destinyWeight: 0` — a starter deck choice is exclusivity-gated (only one active at a time) rather than budget-gated. World-access unlocks (`worldUnlock`) are a separate, later addition with their own weight-0, purchase-only semantics; see [[world-access-unlocks]].
