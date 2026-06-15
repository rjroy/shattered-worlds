---
title: "Implementation notes: extended run telemetry and meta-progression profiles"
date: 2026-06-14
status: complete
tags: [implementation, notes, telemetry, meta-progression, witness, feats]
source: .lore/work/plans/extended-run-telemetry.md
modules: [run-stats, run-history, stats-transfer, gameplay-runtime, core-engine]
related:
  - .lore/work/specs/extended-run-telemetry.md
  - .lore/work/plans/extended-run-telemetry.md
---

# Implementation notes: extended run telemetry and meta-progression profiles

## Progress

- [x] Phase 1 — Two new core events (HealReceived, HazardAdded)
- [x] Phase 2 — Surface opening-deal events on RunStarted
- [x] Phase 3 — RunEnded carries finalState
- [x] Phase 4 — Extended RunRecord fields + heal tally
- [x] Phase 5 — Witness profile + collector
- [x] Phase 6 — Feats profile store
- [x] Phase 7 — Export/import for both profiles
- [x] Phase 8 — Full verification

## Agents

- Implementation: `general-purpose` (fallback — no lore-agents.md)
- Testing: `general-purpose`
- Review: `general-purpose`

## Key findings from lore-researcher

- Spec and plan both dated 2026-06-14, both `draft`. No conflicts between documents.
- Prior gameplay-event-stream work is fully complete (all 8 phases). The TELEM work builds on that foundation.
- `telemetry-gaps.md` is the direct origin of `HealReceived` and `HazardAdded`.
- `witnessProfile` placement in `src/game/runtime/` is the established decision (from brainstorm): it's player profile data, never core simulation state.
- `subscriber order matters`: run stats subscriber registered before witness collector per REQ-TELEM-25.

## Key codebase observations (pre-implementation)

- `createWorld` in `src/core/engine/world.ts:64` currently returns bare `GameState` — Phase 2 changes this to `{ state, openingEvents }`.
- **Phase 2 ripple**: `createWorld` is called in ~15 sites: `game.ts:20`, `effects.test.ts:27`, `reduce.test.ts:27`, `draw.test.ts` (multiple), `world.test.ts` (multiple), and possibly others. All callers need updating to destructure `.state`.
- `createGame` in `game.ts:20` uses `createWorld` directly — Phase 2 must add `openingEvents` to `GameCore`.
- `gameplaySession.ts` uses `createGame` (not `createWorld` directly), so it reads `core.openingEvents` after Phase 2.
- Phase 1 test audit: no exact-array assertions in `effects.test.ts` or `draw.test.ts` that check Heal or drawWorld events. The `expect(events).toHaveLength(1)` at `effects.test.ts:739` is for `Brace`, not Heal — unaffected.
- `runStats.ts:380` — `tally()` loops over `batch.events`; Phase 4 must refactor into `tallyEvents()` helper callable on both batch events and `RunStarted.initialEvents`.
- `gameplaySession.ts:108` — `closeRun()` calls `createRunEnded()` — Phase 3 adds `finalState: core.state` here.

## Log

### 2026-06-14

Initialized. 8 phases tracked. Lore-researcher completed — no conflicts found. Dispatching phases sequentially.

Implementation complete. 779 tests pass, 0 fail. TypeScript clean, lint clean, all 17 AI Validation checks covered.

**Phase 8 fix**: `gameplaySession.ts` was missing the `openingEvents` getter on its return object (GameCore interface requires it). Fixed by the verification agent. Also fixed a strict-mode null access in `statsTransfer.test.ts`.

**Final test delta**: 740 (baseline) → 779 (after all 8 phases). 39 new tests added.

**New files created**:
- `src/game/runtime/witnessProfile.ts` + `witnessProfile.test.ts`
- `src/game/runtime/featsProfile.ts` + `featsProfile.test.ts`

**Files changed**:
- `src/core/model/types.ts` — HealReceived, HazardAdded added to GameEvent union
- `src/core/effects/resources.ts` — heal() emits HealReceived
- `src/core/engine/draw.ts` — drawWorld() emits HazardAdded per world card
- `src/core/engine/world.ts` — createWorld returns { state, openingEvents }
- `src/core/engine/game.ts` — GameCore gains openingEvents
- `src/game/runtime/gameplayEventStream.ts` — RunStarted gains initialEvents/initialState; RunEnded gains finalState
- `src/game/runtime/gameplaySession.ts` — populates new fields; gains openingEvents getter
- `src/game/runtime/runStats.ts` — RunRecord optional fields; tallyEvents helper; finalizeRun extended; isRunRecord hardened
- `src/game/runtime/statsTransfer.ts` — StatsExportPayload extended; createStatsTransfer options object; profile export/import
- `src/game/runtime/gameplayRuntime.ts` — witnessStore and featsStore wired
- Many test files updated for new required fields (especially initialEvents, initialState, finalState)
