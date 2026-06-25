---
title: Feat Evaluation and Memory Fragment Economy
date: 2026-06-25
status: current
tags: [feats, memory-fragments, meta-progression, run-summary, runtime]
fg-type: architecture
fg-sources: [.lore/work/plans/feat-definitions.md]
fg-status: current
---

# Feat Evaluation and Memory Fragment Economy

Feats are evaluated from runtime telemetry after a run ends. The evaluator is a game-runtime component, not a core component, because it depends on run records, lifetime stats, witness data, the feats store, and the gameplay event stream.

The feat catalog and Memory Fragment reward definitions live under `src/data/feats`. Fragment balance is derived from earned feat records and the catalog; it is not stored as its own persistent balance.

## Stream Ordering

The feat evaluator subscribes after run stats and witness tracking so a `RunEnded` event can evaluate against post-run lifetime state and the latest witness profile. Abandoned runs do not award feats.

Each newly earned feat appends a `FeatRecord` containing the feat id, earned timestamp, and session id. `lastRunEarned()` stays available after run end so the run summary can show newly earned feats.

## UI Rule

The run summary grows downward when feat rows are present. It caps visible feats at four plus an overflow row, keeps the top of the panel stable, and moves the continue prompt below the last feat row.
