---
title: "Implementation notes: feat definitions and Memory Fragments"
date: 2026-06-15
status: complete
tags: [implementation, notes, feats, meta-progression, memory-fragments]
source: .lore/work/plans/feat-definitions.md
modules: [feats-profile, feat-evaluator, run-stats, run-summary-view, gameplay-runtime]
related:
  - .lore/work/plans/feat-definitions.md
  - .lore/work/specs/feat-definitions.md
---

# Implementation notes: feat definitions and Memory Fragments

## Progress

- [x] Step 1 — Pure types + catalog + fragment balance
- [x] Step 2 — Pure condition evaluation
- [x] Step 3 — FeatEvaluator subscriber + factory
- [x] Step 4 — Wire into gameplayRuntime
- [x] Step 5 — RunSummaryData + TableScene population
- [x] Step 6 — RunSummaryView feats section + panel growth
- [x] Step 7 — Final validation (automated gates passed; manual browser check pending)

## Context confirmed (pre-implementation)

All prerequisite types verified in codebase:
- `FeatRecord`, `FeatsProfile`, `FeatsStore`, `createFeatsStore` — `src/game/runtime/featsProfile.ts`
- `WitnessProfile`, `WitnessStore`, `createWitnessCollector` — `src/game/runtime/witnessProfile.ts`
- `RunEnded.sessionId`, `Clock`, `RunStreamSubscriber` — `src/game/runtime/gameplayEventStream.ts`
- `LifetimeStats`, `RunRecord`, `RunStatsReader`, `lastRun?` — `src/game/runtime/runStats.ts`
- No task files; no lore-agents.md → using general-purpose agents

`RunRecord` fields confirmed: `sessionId`, `worldId`, `outcome`, `activeDurationMs`, `turns`, `cardsPlayed`, `progressDealt`, `damageTaken`, `hazardsResolved`, `hazardsDiscarded`, `cardsDiscarded`, `finalHp?`, `finalResources?`, `healingReceived?`

`WorldStats` fields confirmed: `runs`, `wins`, `losses`, `abandoned`, `fewestTurnsWin?`, `mostProgressInRun?`

`WitnessProfile` shape confirmed: `{ version: 1, threats: Record<string, WitnessEntry> }` where `WitnessEntry = { encounterCount, diedTo }`

Plan corrections in effect:
- Anchor y=104 (not 110)
- `featEvaluator.subscriber` goes after `witnessStore.subscriber`, before or after the `openSessions` cleanup lambda (order irrelevant)
- Bottom corner circles at `(±260, bottomEdge - 55)`
- Evaluator lives in `src/game/runtime/`, not `src/core/`

## Log

### 2026-06-15 — Session start

Initialized from plan. All prereqs verified. Beginning Phase 1.

### 2026-06-15 — All 7 phases complete

- Steps 1–6 implemented and tested via sub-agents.
- Final gate: `tsc --noEmit` clean, `bun run lint` clean, 796/796 tests pass across 48 files.
- All 22 REQ-FEAT requirements satisfied. All 23 AI validation items covered by tests or type check.
- Manual browser check of panel geometry (Step 7 gate item 5) remains pending — must be done with a real win that earns ≥1 feat, and one that earns ≥5 feats to verify the overflow cap and panel growth.

**Decisions made/discovered:**
- `RunSummaryView` restructure uses create-then-update approach: panel and frame are created with default dimensions, then `setPosition`/`setSize`/`clear()` updates them when feats are present. Plan allowed both "recreate" or "update" — update was chosen.
- `Object.create(RunSummaryView.prototype)` + stub scene used for view tests (same pattern as `cardObjects.test.ts`). No real Phaser instance needed.
- `capped.forEach` + separate `overflow > 0` block for the `+ N more` row — clearer than trying to unify into one loop.
