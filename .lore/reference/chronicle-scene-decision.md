---
title: "ChronicleScene as the Proto-Destiny Surface"
date: 2026-07-02
status: current
tags: [chronicle, destiny, stats-ui, run-summary, decision]
fg-type: decision
fg-sources: [.lore/work/brainstorm/stats-persistence-and-player-views.md]
fg-status: current
fg-evidence:
  code:
    - src/game/scenes/ChronicleScene.ts
    - src/game/runtime/runStats.ts
  tests:
    - src/game/runtime/runStats.test.ts
  symbols:
    - byWorld
    - RunStatsReader
---

# ChronicleScene as the Proto-Destiny Surface

The stats-persistence brainstorm posed a framing question before any UI existed: build a "numbers-forward" stats screen now, or wait for the future Destiny meta-progression hub and build that instead? The two options were in tension because a plain stats screen risked feeling bolted-on next to a fully themed game, while waiting risked shipping nothing.

**Decision:** build one dedicated scene, `ChronicleScene`, reachable from world-select with normal back/escape navigation, and frame it from day one as *the Destiny's memory* — what survives the shattering — rather than as a bare stats table. This dissolves the tension: the screen ships immediately as lifetime totals, a per-world win/loss table, and the last run, and it is built to *grow into* the Destiny hub once meta-progression lands rather than being replaced by a competing screen. See [[destiny-progression]] for the meta-progression layer this screen is designed to absorb.

## Per-World Bests Are Computed at Fold Time, Not Derived

Fastest win, fewest-turns win, and similar per-world records are persisted directly in the `byWorld` v2 shape, updated when each run folds into lifetime stats — not derived on the fly from the run-history ring buffer. This keeps records permanent regardless of the history buffer's retention window (`RUN_HISTORY_LIMIT`, see [[run-stats-persistence-architecture]]): a record set by a run that later scrolls out of the 100-run history ring is not lost, because it was never dependent on that ring to begin with. Each new record type added to `byWorld` is its own schema bump, which is treated as acceptable overhead because it is also where the migrate-don't-discard pattern (see [[save-durability-and-migration-lesson]]) gets exercised.

Run history itself is still recorded from day one — cheap to record, impossible to backfill later — but its job narrows to a future run-history browser and win-streak calculations, not to records, since records no longer depend on it.
