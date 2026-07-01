---
title: "Implementation notes: new-derelict"
date: 2026-07-01
status: in_progress
tags: [implementation, notes, new-derelict]
source: .lore/work/plans/new-derelict.md
modules: [core, data, game, sim]
---

# Implementation notes: new-derelict

## Progress

- [x] Phase 1 — Core-engine Lockdown and persistent effective-cost modifier
- [x] Phase 2 — New Derelict world data, registration, and threat mapping
- [ ] Phase 3 — Assets, presentation, and theme-authoring reference
- [ ] Phase 4 — Full validation and closeout

## Log

### 2026-07-01 — Initialization

- Loaded the plan and all referenced lore artifacts.
- No `.lore/work/tasks/new-derelict/` directory exists; plan slices are the implementation phases.
- No `.lore/lore-agents.md` registry exists; general-purpose agents fill implementation, testing, and review roles.
- Working tree was clean at initialization.
- Prior-work research confirmed that Eden Prime's prerequisite keyword slice is already shipped and that no New Derelict implementation exists yet.
- Implementation paused for plan divergence before Phase 1: the source does not choose New Derelict's required `musicKey`, `Follow the Checklist`'s fixed top-deck template, or `Gravity Priority Shift`'s fixed pinned template.
- User-authorized divergences:
  - Reuse any suitable existing `musicKey` temporarily; it will be replaced before release.
  - Challenge the fixed-template recipe for `Follow the Checklist`; use `ReturnPlayerDiscardToTop` instead.
  - Challenge the fixed-template recipe for `Gravity Priority Shift`; use `RecallPlayerDiscard` with `HighestCost` instead.

### Phase 1 — Core engine

- Added persistent `Lockdown`, bare-keyword presentation, the `PersistentModifier` card contract, effective world-card cost derivation, and reactive cost display wiring.
- Initial testing found four missing coverage requirements and a broad CardView test path blocked by WebP parsing. Coverage was added for all keyword targets/removal, preview-resolution agreement, and cost-label colors through an isolated runnable harness.
- Review found the persistence test exercised only the lower-level tick helper. Added a turn-start integration case proving `Lockdown` persists while `Alarm` expires.
- Focused suites, type checking, formatting, testing, and review passed after correction.

### Phase 2 — World data

- Added the world-card reference walker coverage, eleven templates, boon pool, world bundle, registry entry, and threat mapping.
- Reused `music-eden-prime` temporarily as authorized. `Follow the Checklist` uses `ReturnPlayerDiscardToTop`; `Gravity Priority Shift` uses `RecallPlayerDiscard` with `highestCost`.
- Full-suite testing exposed a bad Act-1/Act-2 test fixture, stale world-count expectation, and TableScene test doubles missing `updateCostLabel`; all were corrected. Asset binding failures remain intentionally pending Phase 3.
- Review required an end-to-end clustered-clear comparison and explicit `Manual Release` coverage; both were added and passed review.
