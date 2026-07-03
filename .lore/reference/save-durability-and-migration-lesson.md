---
title: "localStorage Durability Risk and the Migrate-Don't-Discard Policy"
date: 2026-07-02
status: current
tags: [persistence, localstorage, durability, migration, save-policy, lesson]
fg-type: lesson
fg-sources: [.lore/work/brainstorm/stats-persistence-and-player-views.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/runStats.ts
  symbols:
    - migrateLifetimeV1toV2
---

# localStorage Durability Risk and the Migrate-Don't-Discard Policy

For a game whose whole pitch is "a persistent Destiny outlives the run" (see [[destiny-progression]], [[vision]]), silent loss of `localStorage` is a vision-level failure, not a technical footnote. Safari's ITP caps script-writable storage, `localStorage` included, at roughly 7 days of non-interaction under some configurations, and any browser can evict storage under general pressure. This is worth naming explicitly because it is easy to treat client-side persistence as durable by default and only discover otherwise when a player's progress disappears.

Mitigations, cheapest first, and the ones actually adopted for this project: export/import as a manual backstop (implemented, see [[run-stats-persistence-architecture]]); requesting durable storage via `navigator.storage.persist()`; and, only if it ever becomes necessary, migrating to IndexedDB/OPFS. The first two are treated as nearly free and sufficient for a GitHub Pages portfolio game; the third is deliberately not pursued unless a real need appears. Cloud sync, accounts, and server telemetry were explicitly ruled out — no backend exists, hosting is static GitHub Pages, and the project's anti-goals (see [[vision]]) lean away from added infrastructure. Multiple local player profiles were similarly ruled out: one browser profile already gives one player their own persisted Destiny for free, and there's no case for building more than that without a concrete request.

## Migrate, Don't Discard

The stats payload's load path already discarded malformed data as a safety measure, which stays correct behavior for truly corrupt data. But the **first genuine schema change** must ship with an explicit migration rather than falling back to that discard path — losing a player's lifetime stats to a schema bump is a self-inflicted version of the same durability failure described above. This project's v1-to-v2 bump (adding `activeDurationMs` and richer `byWorld` records) was the first customer for this policy and established `migrateLifetimeV1toV2` as the pattern any future schema change should follow.

## Suspended Runs Must Invalidate Honestly

This principle is decided but not yet built (no suspended-run save exists — see [[run-stats-persistence-architecture]] for what is and isn't persisted today). When a mid-run save is eventually implemented, it must carry a content-version stamp, and on a mismatch (the world's data changed since the save was written) it must tell the player plainly that the world shifted and record the run as abandoned. The explicitly rejected alternative is "replay-and-hope" — attempting to replay a stale action log against changed content and pinning old content data just to keep old saves alive. Patches costing in-flight runs is accepted as consistent with the game's own shattering fiction, not treated as a bug to route around.
