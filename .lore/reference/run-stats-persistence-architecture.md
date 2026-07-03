---
title: Run Stats Persistence Architecture
date: 2026-07-02
status: current
tags: [persistence, run-stats, localstorage, run-history, export-import, runtime]
fg-type: architecture
fg-sources: [.lore/work/brainstorm/stats-persistence-and-player-views.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/runStats.ts
    - src/game/runtime/runHistory.ts
    - src/game/runtime/statsTransfer.ts
    - src/game/runtime/gameplayRuntime.ts
    - src/game/main.ts
  tests:
    - src/game/runtime/runStats.test.ts
    - src/game/runtime/runHistory.test.ts
    - src/game/runtime/statsTransfer.test.ts
  symbols:
    - RunEnded
    - RunStatsReader
    - RunRecord
    - byWorld
    - activeDurationMs
    - migrateLifetimeV1toV2
---

# Run Stats Persistence Architecture

`runStats.ts` writes a versioned, validated lifetime-stats payload to `localStorage` under `shattered-worlds/run-stats/v2` every time a `RunEnded` event reaches it. `RunEnded` fires synchronously inside `dispatch()` the instant a run's `status` goes terminal, so by the time `TableScene` shows a win/loss/abandon screen, the finished run's `RunRecord` is already sitting in the persisted `lastRun` field — an end-of-run summary view needs no new persistence work, only a consumer of the existing `RunStatsReader` read-only seam.

`main.ts` is the composition root: it builds `window.localStorage` behind a `statsStorage()` guard (privacy settings or storage restrictions make `localStorage` throw, so the app falls back to in-memory-only stats rather than failing to boot) and wires `document.visibilitychange` into the runtime so run duration can be measured as active time, not wall-clock time. A `pagehide` listener calls `gameplayRuntime.abandonAll()` because scene shutdown never fires on tab close — this is the last reliable synchronous point to close any open run stream and record it as `abandoned` rather than lose it silently.

## What Is Persisted

- **Lifetime aggregates** (`byWorld`, overall totals, `lastRun`) — always kept, folded on every `RunEnded`.
- **Run history** — a ring buffer of up to `RUN_HISTORY_LIMIT` (100) `RunRecord`s under its own key (`shattered-worlds/run-history/v1`, see `runHistory.ts`), independent of the lifetime-stats key so history and aggregates can evolve on separate schedules.
- **Active duration** — `activeDurationMs` on each `RunRecord`, computed by pausing the run clock while the tab is hidden (the visibility-API seam wired in `main.ts`). This is distinct from the raw `endedAt - startedAt` wall-clock timestamps, which are also retained.
- **Export/import** — `statsTransfer.ts` provides a full serialize/inspect/restore path so a player can download and later restore their stats as a portable JSON file.

## What Is Not (Yet) Persisted

In-progress runs. Closing the tab mid-run still records the run as `abandoned` via `abandonAll()`; there is no suspended-run save that would let a player resume. See [[save-durability-and-migration-lesson]] for why that gap matters and what mitigates it in the meantime.

## Schema Versioning

The stats payload has already been through one schema bump (v1 to v2, adding `activeDurationMs` and moving `byWorld` to a richer per-world shape). `migrateLifetimeV1toV2` and `migrateRunRecordV1toV2` convert a legacy payload on load rather than discarding it, and the migration marks `removeLegacyAfterPersist` so the old key is cleaned up once the migrated shape is safely written. This migrate-don't-discard behavior is a deliberate policy, not incidental code — see [[save-durability-and-migration-lesson]] for the reasoning.

## Related Consumers

[[chronicle-scene-decision]] documents `ChronicleScene`, the first UI consumer of this data. `RunStatsReader` is designed as a shared seam so future subscribers (meta-progression, save policy) can read the same stream without new plumbing, the same pattern already used by [[unlock-system-runtime-ownership]] and [[feat-evaluation-memory-fragments]] for their own runtime subscriptions.
