---
title: "Implementation notes: City of Sleeping Giants"
date: 2026-06-21
status: in_progress
tags: [implementation, notes, world-design, city-of-sleeping-giants, stirring, recurrence]
source: .lore/work/plans/city-of-sleeping-giants.md
modules: [world-data, themes, game-view, unlocks, boons]
---

# Implementation notes: City of Sleeping Giants

Implementing [the city-of-sleeping-giants plan](../plans/city-of-sleeping-giants.md) (REQ-GIANTS-1..49). Eighth world, verb **stir** (recurrence/escalation of body-movement hazards). No core slice; all on existing engine vocabulary. Canonical template: `the-ember-orchard` (the twin), which mirrors `whiteout-parking-garage`. Orchestrated via `/implement` — all code/test/review through sub-agents.

## Approved deviations from spec (carried from plan decisions)

- **§1 / REQ-22/24/25/27 + REQ-19:** every `Hidden` authored as `Obstructed` (engine keyword); `bonus Hidden +1` → `{ tag: "Obstructed", amount: 1 }`.
- **§2 / REQ-23/27/28/46:** `ReturnWorldCards` on world auto-hooks is inert (`ctx.returnIds` undefined) + boon-signed where it fires + no world discard pile. Re-expressed as `AddWorldCardToDeck { bTop }` on three cards: Fingerquake Ward, District Recall, The Giant Turns In Sleep.
- **§4 / REQ-24/46:** Surveyors Mark A Pulse `onCleared` runs `OfferBoon { setId: "giants-boons", offeredCount 3, chooseCount 1 }` instead of `Sequence[GainCard ×5]`. Rewards single-sourced in `src/data/worlds/boons/giants.json` (A8).
- **§5 / REQ-23/28/46:** body-movement hazards deal `ForceDestroy` not `Damage` to revive `Brace`: Fingerquake Ward (`onDiscarded`/`onEndOfTurn` `Damage 1`→`ForceDestroy 1`), The Giant Turns In Sleep (`onDiscarded` `Damage 3`→`ForceDestroy 2`; keeps `onEndOfTurn Damage 2`).

## Decisions made during orchestration

- **2026-06-21: Art DEFERRED (user choice, mirrors Ember).** Wire all base/music bindings + turnkey TODO comments for the 13 insets + unlock art; asset-binding tests stay RED by design (do NOT add placeholder files); file a deferral issue. User generates the 14 images later.

## Prior-work anchors (from lore-researcher + Ember notes)

- `.lore/work/notes/the-ember-orchard.md` — the twin (7th world). **Critical infeasibility:** `OfferBoon` can only offer cards from a MERGED boon set; the `worldManifest` sync test requires `templateIds == cardTemplates` exactly; the merged boon source must resolve in EVERY world catalog. Reward cards that reference a **world** card cannot live in a boon set. For Giants this implicates **Follow The Vein** (`AddWorldCardToDeck{Vein-Road Surge}` — a world-card ref). Ember resolved by keeping world-referencing rewards in `cards.json` granted via `GainCard` on clear, and topping the boon pool with self-contained tools to reach 5 for the 3-of-5 offer. WATCH for this in Slice A8.
- `worldAssetBindings.test.ts` scans ONLY the world bundle's own `cards.json`, NOT the merged boon source — boon-tool inset keys ship silently unbound unless explicitly covered (Ember added a presentation test). Relevant to C3.
- `.lore/work/notes/the-tidal-archive.md` — code-anchored gotcha list confirms all five fixes. Browser smoke unavailable in this env → fall back to build + asset checks, report honestly.
- JSON catalogs are NOT typechecked; parameterized world tests are the only ref-resolution guard.

## Progress

- [ ] **Slice A — World data, registration, unlock gating** (A1-A8)
  - [ ] A1 cards.json (8 world cards; 5 reward cards live in boon source per A8)
  - [ ] A2 theme.ts
  - [ ] A3 meta.ts
  - [ ] A4 index.ts (bundle)
  - [ ] A5 registry.ts
  - [ ] A6 threat mapping (gainCard.ts)
  - [ ] A7 unlock gating (catalog.ts)
  - [ ] A8 boon source (giants.json + fortune.ts)
  - [ ] Gate A
- [ ] **Slice B — Assets, presentation, help, docs** (B1-B6) — ART DEFERRED
  - [ ] B1 13 card insets (art-gen) — DEFERRED
  - [ ] B2 unlock art (art-gen) — DEFERRED
  - [ ] B3 base + music bindings (insets left unbound w/ turnkey TODO)
  - [ ] B4 manifest reachable for base keys; unlock-art entry turnkey TODO
  - [ ] B5 world-select paging (confirm no layout change)
  - [ ] B6 theme-authoring doc (add `stir` verb row + finish stale-token cleanup)
  - [ ] Gate B
- [ ] **Slice C — Tests and validation** (C1-C5)
  - [ ] C1 world-data tests
  - [ ] C2 stirring-pattern effect tests
  - [ ] C3 asset validation (incl. boon-inset coverage)
  - [ ] C4 presentation/theme test
  - [ ] C5 seeded three-act gameplay test
  - [ ] Gate C (final) + holistic spec validation
- [ ] **Finalize**

## Log

- 2026-06-21: Initialized. lore-researcher run complete (anchors above). No task files / no agent registry; using `general-purpose` for all roles. Phases = plan slices A/B/C. User chose to DEFER art (mirrors Ember).
