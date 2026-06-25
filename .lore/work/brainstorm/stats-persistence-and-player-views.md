---
title: "Stats persistence and player-facing views"
date: "2026-06-12"
status: "resolved"
tags: ['persistence', 'stats', 'run-history', 'save-resume', 'ui', 'run-summary', 'localstorage']
modules: ['game-runtime', 'game-scenes']
---

# Stats persistence and player-facing views

Prompt: "we've been adding run data and lifetime data. The next steps are to persist the data and to setup a way for the player to view this." This brainstorm unpacks what each half could mean, because the first half means less than it sounds and the second half means more.

## Where we actually are (read before ideating)

Lifetime stats persistence **already exists and is wired**. `runStats.ts` writes a versioned, validated payload to `localStorage` under `shattered-worlds/run-stats/v1` on every `RunEnded`; `main.ts` injects `window.localStorage` with a privacy-settings guard; `pagehide → abandonAll()` closes open runs so app-level exits still get recorded.

`RunEnded` is emitted *synchronously inside dispatch* the moment `status` goes terminal (`gameplaySession.ts:138`). By the time `TableScene` shows the win/loss overlay, `runStats.lifetime().lastRun` already holds the finished run. An end-of-run summary screen needs **zero new persistence work** — the data is sitting there waiting for a consumer.

What is **not** persisted today: run history (only `lastRun` survives; every earlier run is folded into aggregates and gone), and in-progress runs (closing the tab mid-run records the run as `abandoned` — the player loses the run).

What has **no surface** today: everything. The win/loss screens are bare click-to-continue overlays. Scenes are Boot → WorldSelect → Table. `RunStatsReader` exists as a read-only seam with exactly zero consumers.

So "persist the data" decomposes into *persist more kinds of data*, and "a way to view this" is a green field. The two halves constrain each other: most views richer than a totals table need run history, which doesn't exist yet.

## Half one: what "persist" could mean now

### A. Run history (ring buffer)

Keep the last N `RunRecord`s, not just `lastRun`. A record is a few hundred bytes; 100 runs is ~30KB against localStorage's ~5MB. Unlocks: run history browser, records/bests computed on the fly, win streaks (which need ordering).

Cost: small. Either bump the payload to v2 or give history its own key + collector subscribing to the same stream — the runtime docstring already names "future meta progression and save policy" as sibling subscribers, so one-collector-per-concern is the established shape.

### B. Suspended-run save (the sleeper)

The core is deterministic and seedable: `{worldId, seed, actionLog}` replayed through dispatch reconstructs the run byte-for-byte. A mid-run save is a tiny JSON blob, not a state snapshot. `pagehide` would save-and-suspend instead of abandon; WorldSelect offers "continue run".

Cost: the biggest item here, and the biggest payoff. The same artifact is a replay file, a bug-repro attachment, and a golden-master test fixture. Portfolio-grade.

### C. Export / import

A "download my data" / "restore" JSON file. Cheap insurance against the real durability problem (see below), a debugging gift, and data portability is on-brand for this user's projects.

Cost: trivial once a save shape exists. Could ship with any view screen as a button.

### D. Save-architecture consolidation

Destiny meta-progression is coming ([existing brainstorm](shattered-worlds-meta-progression.html)). Stats, Destiny, settings, suspended-run: four bespoke localStorage keys each hand-rolling load/validate/version/persist is how save corruption stories start. The load/validate pattern in `runStats.ts` is already the template — extract it into a small `versionedStorage` helper when the *second* customer arrives, not before.

Cost: near-zero if done as extraction-on-second-use. High if done as an up-front save framework with one customer. Don't do the second thing.

### The durability problem nobody asked about

Safari's ITP caps script-writable storage (localStorage included) at **7 days of non-interaction** for some configurations; browsers can evict under storage pressure generally. For a game whose whole pitch is "a persistent Destiny outlives the run," the Destiny silently evaporating is a vision-level failure, not a technical footnote. Options, cheapest first: export/import (C) as a manual backstop; `navigator.storage.persist()` to request durable storage; IndexedDB/OPFS migration if it ever matters. The first two are nearly free and probably enough for a GitHub Pages portfolio game.

**Migration policy: flip at the first schema change.** Discarding malformed payloads stays correct, but the first shape change (v2) must ship with a v1→v2 migration rather than a discard. Per the per-world-bests decision below, that v2 is already on the horizon — it is the migration pattern's first customer.

**Suspended runs invalidate honestly on content mismatch.** Saves carry a content-version stamp; on mismatch, tell the player the world shifted and record the run as abandoned. No replay-and-hope, no pinned content data. Patches cost in-flight runs, which fits the shattering fiction. (The feature itself remains item 4 — own design pass.)

**Duration means active time.** Pause the run clock while the tab is hidden (visibility API). The runtime's clock is already injectable, which is the seam for this. Wall-clock `endedAt − startedAt` stays in the record as timestamps, but "time played" anywhere on screen is active time.

Cloud sync, accounts, server telemetry. No backend exists, GitHub Pages hosting, and the vision's anti-goals lean away from infrastructure. Local-first with export/import covers the actual need.

Multiple local profiles. Real games have them; this one has one player per browser profile, which is the same thing for free. Revisit only if a real request appears.

## Half two: what "a way to view this" could mean

| View | Needs new persistence? | Emotional job |
| --- | --- | --- |
| 1. End-of-run summary | **No** — `lastRun` is live | The ritual. Cement the run that just happened. |
| 2. Carousel badges (per-world W/L) | **No** — `byWorld` is live | Ambient goading. "Fog Beach: 0 wins in 4 tries." |
| 3. Chronicle screen (lifetime hub) | No for totals; A for anything ranked | The mirror. Who has this Destiny been? |
| 4. Records / bests | A (or new v2 fields) | The hooks. Fastest win, fewest turns, streak. |
| 5. Run history browser | A | The archive. Probably premature — see below. |

### 1. End-of-run summary — the obvious first move

Replace the bare win/loss overlay with the just-finalized `RunRecord`: outcome, turns, duration, cards played, progress dealt, damage taken, hazards resolved/discarded. Balatro and Slay the Spire treat the recap as part of the run's emotional arc, not an afterthought — the numbers are the cooldown. One screen, one existing data source (`RunStatsReader` handed to the scene), and it makes every run feel *recorded*, which is the whole fantasy of a Destiny that remembers.

Cheap multiplier: show one lifetime number alongside the run numbers ("3rd win on this world", "Run 27"). That single line is what makes the persistence *felt* rather than merely present.

**Abandons get the full summary, same as win/loss.** Every terminal outcome gets the same recap screen — abandonment feels recorded, not erased. Applies to the explicit exit button; a tab-close abandon can't show a screen, so the Chronicle remains the only witness for those.

### 2. Carousel badges — highest feel-per-effort

Each world card on WorldSelect shows wins/attempts. Zero navigation, zero new data, and it converts the `byWorld` table from dead weight into motivation. This is roguelite convention for a reason (StS character select win counts). Needs the theme-authoring rules consulted so badges don't fight the inset art.

### 3. Chronicle screen — and the framing question that matters

A stats hub reachable from WorldSelect: lifetime totals, per-world table, last run. The interesting decision isn't layout, it's *identity*. Two framings:

### Numbers-forward

A clean stats screen. Honest, legible, shows the data engineering (portfolio value). Risk: feels bolted on in a game whose every surface is themed.

### The Destiny's memory

The same data framed as what survives the shattering — the meta-progression brainstorm's "knowledge persists" answer, made literal. Here's the move: **this screen and the future Destiny hub are the same surface.** Ship it as stats now; when meta-progression lands, it grows into the Destiny screen instead of competing with one. That dissolves the "build a stats screen now or wait for Destiny?" tension entirely.

**Dedicated `ChronicleScene`,** reachable from WorldSelect with back/escape navigation from day one. Built as the proto-Destiny surface — when meta-progression lands it grows into the Destiny hub rather than competing with one. This also settles the framing tension above in favor of "the Destiny's memory."

**Per-world bests are persisted in a v2 `byWorld` shape** (fastest win, fewest-turns win, etc.), updated at fold time — not derived from a history buffer. Records are permanent regardless of any buffer window. Each new record type is a schema bump, which is acceptable because this v2 is also where the migrate-don't-discard pattern gets built (see migration decision above). Run history (A) is still worth recording, but its job narrows to the future history browser and streaks, not records.

Run history browser as an early deliverable. A run is currently eleven counters — a list of eleven-counter rows is a spreadsheet, not a feature. It earns its place once runs have texture (deck composition at end, modifiers, Destiny choices). Persist history early (A is cheap and you can't backfill what you didn't record); *browse* it later.

### Wilder ideas parked here on purpose

**Seed sharing / daily run.** Determinism makes "play my exact shuffle" a URL: `?world=X&seed=Y`. A daily seed is the same trick with a date-derived seed. Nearly free mechanically; the cost is all in framing and the records screen wanting a "seeded runs don't count" rule.

**Replay-as-spectator.** The suspended-run save format (B) replayed at watch speed is a replay viewer. Useful for bug reports tomorrow, share-your-win someday.

**Ghost pacing.** On a repeat world+seed, show your previous run's progress pace as a ghost marker. Racing yourself. Expensive, very deckbuilder-unusual, noted and shelved.

**Memory cards.** Past runs rendered as literal cards you flip through — stats as a deck. Thematically perfect, cost way ahead of value right now.

## Gravity, not a plan

If the ideas above have a natural pull order, it's this — recorded as gravity, not commitment:

1. **End-of-run summary (all outcomes, per the abandon decision) + carousel badges.** Both consume data that already persists. Pure view work, immediate felt payoff, exercises `RunStatsReader` for the first time. The active-time clock decision wants to land alongside, before any screen shows a duration.
1. **v2 schema: per-world bests + the v1→v2 migration.** The two decisions that interlock — the first schema change carries the first migration. Run-history ring buffer can ride along (cheap to record, impossible to backfill) even though records no longer depend on it.
1. **`ChronicleScene`** , built as the proto-Destiny surface, showing lifetime totals, per-world table with bests, last run. Export/import button rides along.
1. **Suspended-run save.** Separate track, biggest engineering, changes abandon semantics — wants its own design pass. Stale-save policy is already decided (invalidate honestly via content-version stamp), which removes the scariest unknown.

Items 1–2 are roughly "the next PR or two." Item 4 is a feature with a design doc's worth of remaining questions. The word "persist" in the prompt most likely meant item 2 plus the durability/migration posture — the lifetime aggregates were already done.
