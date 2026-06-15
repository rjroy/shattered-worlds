---
title: "Implementation plan: extended run telemetry and meta-progression profiles"
date: 2026-06-14
status: draft
tags: [plan, stats, telemetry, feats, witness-knowledge, meta-progression]
modules: [run-stats, run-history, stats-transfer, gameplay-runtime, core-engine]
related:
  - .lore/work/specs/extended-run-telemetry.md
  - .lore/work/notes/telemetry-gaps.md
---

# Implementation plan: extended run telemetry and meta-progression profiles

## Context

Meta-progression (Feats of Survival, Witness Knowledge) needs run data the current stats
pipeline does not capture. The spec
([extended-run-telemetry.md](../specs/extended-run-telemetry.md)) defines three new optional
`RunRecord` fields, two new core events, and two new player-profile stores, plus export/import
support.

Reviewing the spec against the code surfaced two wiring gaps the spec now addresses (REQ-TELEM-23,
24, 25) and this plan implements:

1. **`RunEnded` carries no state.** It has only `outcome`/`finalActIndex`/`timestamp`
   (`gameplayEventStream.ts:48`). finalHp, finalResources, and witness `diedTo` all read state "at
   the moment `RunEnded` fires," so `closeRun` must attach a `finalState` snapshot.
2. **The opening hand is invisible.** `createWorld` deals it via `startTurn` and discards the
   events (`world.ts:127`, "events are discarded at init time"). Since `refillHand` always draws at
   least one world card, opening-hand threats would never emit `HazardAdded`. The opening-deal
   events must be surfaced through `RunStarted`.

The deterministic, seedable core is preserved: the only core changes are two additive events. All
profile/collector/transfer work lives in `src/game/runtime/` (the renderer-facing side of the
lint-enforced boundary). No schema version bumps (REQ-TELEM-5).

## Source of truth

Every step maps to requirements in the spec. The final step validates against all 17 AI Validation
checks there. Requirement IDs in brackets below point back to that spec.

## Steps

Ordered by dependency: core events → runtime seams that carry them → consumers → export/import.
Each step lands with its tests (`bun run test` — never `bun test`; preload is required).

### Step 1 — Two new core events  [REQ-TELEM-6, 8]

- `src/core/model/types.ts`: add to the `GameEvent` union:
  `{ type: 'HealReceived'; amount: number }` and `{ type: 'HazardAdded'; templateId: string }`.
- `src/core/effects/resources.ts`: in `heal()`, emit `HealReceived` after `HpChanged`, do not
  replace it — exact order `events: [{ type: 'HpChanged', hp: newHp }, { type: 'HealReceived',
  amount: n }]`. `amount` is the value passed to `heal()`.
- `src/core/engine/draw.ts`: in `drawWorld()`, push one `HazardAdded { templateId: card.name }` per
  world card moved into `hand`, inside the draw loop (once per card instance). `drawWorld` is the
  single funnel: `Dest` only routes to `playerDiscard`/`playerDrawTop`/`worldDraw`/`worldDrawTop`
  (confirmed in `gainCard.ts`), and `drawPlayer` only pulls `PlayerCard`s, so no other path puts a
  world card in `hand`.

> **Validation gate**
> - New unit tests: `Heal { amount: 4 }` produces `HealReceived { amount: 4 }` [AI #2]; a
>   world-card draw produces `HazardAdded { templateId: '<name>' }` [AI #3].
> - Update existing event-sequence assertions broken by the additive events. Most golden checks use
>   `toContain` or run-vs-run equality (`golden.test.ts`) and survive; audit `effects.test.ts`,
>   `reduce.test.ts`, `draw.test.ts` for any exact-array assertions and extend them.
> - `bun run test` green.

### Step 2 — Surface opening-deal events  [REQ-TELEM-24]

- `src/core/engine/world.ts`: `createWorld` returns the opening `startTurn` events instead of
  discarding them — change its return to `{ state, openingEvents }` (or a small named type).
- `src/core/engine/game.ts`: `GameCore` gains `readonly openingEvents: readonly GameEvent[]`,
  populated from `createWorld`. `state` already exposes the initial state.
- `src/game/runtime/gameplayEventStream.ts`: `RunStarted` gains `initialEvents: readonly
  GameEvent[]` and `initialState: GameState`. `createRunStarted` snapshots them like the rest.
- `src/game/runtime/gameplaySession.ts`: when emitting the initial `RunStarted`, populate
  `initialEvents` from `core.openingEvents` and `initialState` from `core.state`. Delivered before
  any `GameplayBatch`.

> **Validation gate**
> - `gameplaySession` test: starting a run whose opening hand holds world card `X` surfaces
>   `HazardAdded { templateId: 'X' }` in `RunStarted.initialEvents` before any dispatch [AI #15].
> - Update every direct `createWorld` call site to destructure the new return shape — notably
>   `world.test.ts`, which today treats the result as a bare `GameState`. Audit other callers too.
> - Core determinism tests still pass (opening events are produced deterministically; only the
>   discard at the runtime boundary changed).
> - `bun run test` green.

### Step 3 — `RunEnded` carries final state  [REQ-TELEM-23]

- `src/game/runtime/gameplayEventStream.ts`: `RunEnded` gains `finalState: GameState`;
  `createRunEnded` snapshots it.
- `src/game/runtime/gameplaySession.ts`: `closeRun` passes `finalState: core.state` into
  `createRunEnded` (which already deep-clones via its internal `snapshot()`, so a live reference is
  fine). `core.state` is the final state in both the terminal-dispatch path (read after
  `core.dispatch` updates it) and the `abandon()` path. Transient stream data only — never
  persisted.

> **Validation gate**
> - Test: after a run ends, `RunEnded.finalState` matches the final `GameState` (hp/energy/hand);
>   for a run abandoned before any action, `finalState` is the opening state [AI #16].
> - `bun run test` green.

### Step 4 — Extended `RunRecord` fields + heal tally  [REQ-TELEM-1..5, 7]

- `src/game/runtime/runStats.ts`:
  - Add optional `finalHp`, `finalResources`, `healingReceived` to `RunRecord`.
  - `RunAccumulator` gains a `healingReceived` tally. Refactor the inner event loop out of `tally()`
    into `tallyEvents(accumulator, events: readonly GameEvent[])` so it can run over both
    `batch.events` (existing path: `tally()` calls it with `batch.events`) and
    `RunStarted.initialEvents` at `onRunStarted` (so opening-hand heals count). `tallyEvents` adds
    `HealReceived.amount` to `healingReceived`. Do not keep two divergent loops.
  - `finalizeRun` reads `RunEnded.finalState` for `finalHp = finalState.hp` and `finalResources =
    { energy, light: finalState.light, brace: finalState.braceCharges }` [REQ-TELEM-3 table], and
    writes the accumulated `healingReceived`.
  - Harden `isRunRecord`: keep the existing required keys, and additionally — when present —
    type-check `finalHp`/`healingReceived` as finite numbers and `finalResources` as an object of
    finite-number values. Absent = valid; present-but-wrong-type = rejected [REQ-TELEM-5]. Leave
    `RUN_RECORD_NUMBER_KEYS` (the required set) unchanged so old payloads still validate.

> **Validation gate**
> - Tests: two `HealReceived` (3 then 5) → `healingReceived === 8` [AI #4]; finish with hp 7 /
>   energy 3 → `finalHp === 7`, `finalResources === { energy: 3, light: 0, brace: 0 }` [AI #5];
>   old stored `RunRecord` without the new fields loads with them `undefined` [AI #6].
> - Added test (beyond the spec's 17, closes a coverage hole): a `HealReceived` carried in
>   `RunStarted.initialEvents` increments `healingReceived` — guards against an implementation that
>   only tallies `GameplayBatch` events.
> - `bun run test` green.

### Step 5 — Witness profile + collector  [REQ-TELEM-9..14, 25]

- New file `src/game/runtime/witnessProfile.ts` (mirrors `runHistory.ts`/`runStats.ts` patterns):
  - `WitnessEntry`, `WitnessProfile` types; storage key `shattered-worlds/witness/v1`.
  - `loadWitnessProfile(storage)` with validation; a corrupt/invalid payload resets to
    `{ version: 1, threats: {} }` and logs a warning, never touching run-stats keys
    [REQ-TELEM-10, 11].
  - `createWitnessCollector({ storage })`: a `RunStreamSubscriber`. Use one shared helper that
    walks a `readonly GameEvent[]` and counts `HazardAdded` (`encounterCount += 1` per event), fed
    by both `RunStarted.initialEvents` and each `GameplayBatch.events` — same single-loop discipline
    as Step 4's `tallyEvents`. Counts accumulate across runs incl. abandons [REQ-TELEM-12]. On
    `RunEnded` with `outcome === 'lost'`, filter `finalState.hand` to `WorldCard` instances
    (`card.kind === 'world'`) and set `diedTo = true` for each `card.name`; never on abandon
    [REQ-TELEM-13]. Save after updating.
- `src/game/runtime/gameplayRuntime.ts`: create the witness store/collector and
  `stream.subscribe(witnessCollector)` **after** `runStats.subscriber`, so the run-end witness
  update runs after run stats are written [REQ-TELEM-14, 25]. Expose the witness store on the
  runtime for the transfer (Step 7).

> **Validation gate**
> - Tests: Zombie drawn into hand twice + lost with a Zombie in hand → `encounterCount === 2`,
>   `diedTo === true` after reload [AI #7]; abandon with a hazard in hand → `diedTo` not set
>   [AI #8]; invalid JSON at the witness key → returns `{ version: 1, threats: {} }`, run stats
>   unaffected [AI #9].
> - `bun run test` green.

### Step 6 — Feats profile store  [REQ-TELEM-15..18]

- New file `src/game/runtime/featsProfile.ts`:
  - `FeatRecord`, `FeatsProfile` types; storage key `shattered-worlds/feats/v1`.
  - `loadFeatsProfile`/`saveFeatsProfile` with validation (corrupt resets to
    `{ version: 1, earned: [] }`).
  - A pure append API `appendFeat(profile: FeatsProfile, record: FeatRecord): FeatsProfile` that
    returns the profile unchanged when `record.featId` is already in `earned` (dedupe,
    REQ-TELEM-17). Passive store — no stream subscriber; writable from outside for the future Feats
    evaluator [REQ-TELEM-18].
- `src/game/runtime/gameplayRuntime.ts`: create and own the feats store; expose it for the transfer.

> **Validation gate**
> - Tests: write/reload a `FeatRecord` round-trips into `earned` [AI #10]; writing the same
>   `featId` twice keeps exactly one [AI #11].
> - `bun run test` green.

### Step 7 — Export / import for both profiles  [REQ-TELEM-19..22]

- `src/game/runtime/statsTransfer.ts`:
  - `StatsExportPayload` gains optional `witnessProfile?` and `featsProfile?`; `kind` and format
    stay unchanged [REQ-TELEM-19].
  - `createStatsTransfer` takes the witness store and feats store alongside `runStats`. To avoid a
    third/fourth positional parameter trailing the optional `clock`, move to an options object
    (e.g. `createStatsTransfer({ runStats, witness, feats, clock? })`) and update the one caller in
    `gameplayRuntime.ts`.
  - `exportJson` includes each profile only when non-empty (`threats`/`earned` has ≥1 entry)
    [REQ-TELEM-20].
  - `inspectImport` accepts payloads with or without the fields; a present-but-malformed
    `witnessProfile`/`featsProfile` returns `{ ok: false }` (like invalid lifetime/history)
    [REQ-TELEM-21].
  - `applyImport` replaces a profile when present in the payload and leaves the stored profile
    untouched when absent [REQ-TELEM-22].
- `src/game/runtime/gameplayRuntime.ts`: pass the witness and feats stores into
  `createStatsTransfer`.

> **Validation gate**
> - Tests: after populating both profiles, `exportJson` contains them with correct content
>   [AI #12]; importing an old-format payload (no profiles) leaves local witness state unchanged
>   [AI #13]; a full payload replaces both [AI #14]; a present-but-malformed `witnessProfile`
>   import returns `{ ok: false }` and leaves stored state unchanged [AI #17].
> - `bun run test` green.

### Step 8 — Full verification  [AI #1]

- `bun run test` (full suite), typecheck, and lint all green.
- `tsc --noEmit` passes with all new types defined and `StatsExportPayload` extended [AI #1].
- Lint confirms the core/game boundary holds: the two new events live in `src/core`; all profile,
  collector, and transfer code stays in `src/game/runtime` with zero Phaser imports.
- Walk all 17 AI Validation checks in the spec and confirm each is covered by a test above.

## Risks and notes

- **Event-sequence test churn.** Adding `HealReceived`/`HazardAdded` shifts core event arrays.
  `golden.test.ts` mostly uses `toContain` and run-vs-run equality (resilient), but Step 1 must
  audit `effects.test.ts`/`reduce.test.ts`/`draw.test.ts` for exact-array assertions. This is
  expected churn, not a regression — verify the *state* assertions are unchanged.
- **New files.** `witnessProfile.ts` and `featsProfile.ts` are new modules, mirroring the existing
  `runStats.ts`/`runHistory.ts` storage-seam pattern (injectable `RunStatsStorage`, validate-on-
  load, log-and-reset on corruption). The spec authorizes both stores; this plan is the review gate
  for adding them.
- **Non-threat world cards.** `Door`, `The Walker`, etc. are world cards, so they get witness
  entries too. Accepted per spec (REQ-TELEM-9 note); feat logic filters by name.
- **`finalState` size.** `RunEnded.finalState` is a full `GameState` snapshot, consistent with
  `GameplayBatch.state`. It is transient stream data; only the extracted scalars reach `RunRecord`,
  so persisted size is unaffected.

## Verification (end to end)

1. `bun run test` — entire suite green, including the new tests at every step.
2. `tsc --noEmit` — clean typecheck across the new types and extended payload.
3. Lint — passes, confirming the core/game boundary (no Phaser in `src/core`).
4. Spec cross-check — all 17 AI Validation items in
   [extended-run-telemetry.md](../specs/extended-run-telemetry.md) have a corresponding green test.
