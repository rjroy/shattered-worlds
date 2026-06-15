---
title: Extended run telemetry and meta-progression profiles
date: 2026-06-14
status: draft
tags: [stats, telemetry, feats, witness-knowledge, meta-progression, run-record]
modules: [run-stats, run-history, stats-transfer, gameplay-runtime]
related:
  - .lore/work/specs/stats-persistence-and-player-views.html
  - .lore/work/brainstorm/shattered-worlds-meta-progression.html
  - .lore/work/notes/telemetry-gaps.md
req-prefix: TELEM
---

# Extended run telemetry and meta-progression profiles

## Context

The existing run stats system (`LifetimeStats` v2, `RunRecord`, `RunHistory`) tracks aggregate counters and a ring buffer of the last 100 runs. It was deliberately scoped to what the Chronicle screen needs today. Three gaps need filling before meta-progression can be built:

1. **Per-run end-state fields** — HP, resources, and total healing at run end. The feat ideas in `notes-on-memories.md` need these to evaluate conditions like "finish with more than 20 HP" or "clear Volcano without healing."
2. **Witness Knowledge profile** — cross-run state recording which threats a player has encountered or been killed by. Player profile data, never part of core simulation.
3. **Feats profile** — the record of which Feats of Survival have been earned. Feat definitions and evaluation logic are separate work; this spec only establishes the schema and storage.

## Scope

**In scope:**
- Three new optional fields on `RunRecord`
- Two new core events: `HealReceived` and `HazardAdded`
- Runtime seams: `finalState` on `RunEnded`, and surfacing the discarded opening-deal events through the stream
- `WitnessProfile` type and localStorage storage, plus a witness collector wired at the runtime composition root
- `FeatsProfile` type and localStorage storage
- Export/import extensions for both profiles

**Out of scope:**
- Per-act breakdowns (needed for "no 3-cost card" feat — deferred to Feats spec)
- Feat condition definitions and evaluation logic (Feats spec)
- Destiny Loadout tracking
- Display of witness or feat state in any scene

---

## Requirements

### Extended RunRecord fields

**REQ-TELEM-1:** `RunRecord` gains three new optional fields. All three are `undefined` in payloads predating this spec; feat evaluation and display code must guard for `undefined` and treat it as "data unavailable for this run."

```
finalHp: number | undefined
finalResources: Record<string, number> | undefined
healingReceived: number | undefined
```

**REQ-TELEM-2:** `finalHp` is player HP (`GameState.hp`) at the exact moment `RunEnded` fires, read from `RunEnded.finalState` (see REQ-TELEM-23).

**REQ-TELEM-3:** `finalResources` uses three stable identifier strings, each mapping to a named field in `GameState`:

| Key | GameState field | Present on world(s) |
|---|---|---|
| `"energy"` | `energy` | all worlds |
| `"light"` | `light` | Fog Beach Party (others will be 0) |
| `"brace"` | `braceCharges` | Bird-Carried Office (others will be 0) |

All three keys are always included. A world that does not use a resource will record `0` for its key. Values are read from `RunEnded.finalState` (see REQ-TELEM-23).

**REQ-TELEM-4:** `healingReceived` is the cumulative HP healed during the run, counted via `HealReceived` events (REQ-TELEM-7).

**REQ-TELEM-5:** No schema version is bumped. The new fields are optional; old stored payloads remain valid. `LifetimeStats.version` stays at `2`. Validators for `RunRecord` must accept both old payloads (fields absent) and new payloads (fields present) without rejecting either. When the optional fields *are* present, the validator type-checks them: `finalHp` and `healingReceived` must be finite numbers, and `finalResources` must be an object whose values are all finite numbers. A payload carrying a malformed optional field (e.g. `finalHp` as a string) is rejected — "absent" and "valid" are accepted; "present but wrong type" is not.

---

### New core events

**REQ-TELEM-6:** The core engine emits a new event `HealReceived { type: 'HealReceived', amount: number }` from the `heal()` effect, alongside (not replacing) the existing `HpChanged` event. `amount` is the value passed to `heal()`.

**REQ-TELEM-7:** `RunStatsCollector` subscribes to `HealReceived` and accumulates `amount` into an in-progress `healingReceived` tally. The tally is written to `RunRecord.healingReceived` when `RunEnded` fires.

**REQ-TELEM-8:** The core engine emits a new event `HazardAdded { type: 'HazardAdded', templateId: string }` each time a world card is drawn into `hand`. The `templateId` is the card's `name` field, which is the de facto template identifier for world cards (matching the identifiers in world definition catalogs). This event fires once per card instance per draw, not once per card type per turn.

---

### Runtime stream seams

These close the gap between "read state at the moment `RunEnded` fires" and what the stream actually delivers today. They are runtime-layer changes; the deterministic core is unaffected beyond the two new events above.

**REQ-TELEM-23:** `RunEnded` gains a `finalState: GameState` field — a snapshot of `core.state` taken in `gameplaySession`'s `closeRun`, at the instant the run closes, for both terminal and abandoned outcomes. This is the single source for `finalHp` (REQ-TELEM-2), `finalResources` (REQ-TELEM-3), and the witness `diedTo` hand inspection (REQ-TELEM-13). It is transient stream data: only the extracted scalar fields land in `RunRecord`; `finalState` itself is never persisted. Consumers read it from `RunEnded` rather than caching their own copy of the last batch state.

**REQ-TELEM-24:** The opening hand is dealt inside `createWorld`, whose events are currently discarded (`world.ts`: "events are discarded at init time"), so opening-hand world-card draws never reach the stream. Because `refillHand` always draws at least one world card, every run's opening threats would otherwise go uncounted. `createGame` must expose the opening-deal events and the initial state, and `gameplaySession` must surface them on the stream — carried on `RunStarted` as `initialEvents` and `initialState`, delivered before any `GameplayBatch`. Every consumer that tallies `HealReceived` or `HazardAdded` reads the opening-deal events in addition to per-batch events, so opening-hand threats count toward `encounterCount` (REQ-TELEM-12) and any opening-hand heal counts toward `healingReceived`. The deterministic core's behavior is unchanged; only the discarding of init-time events at the runtime boundary is fixed.

**REQ-TELEM-25:** Witness tracking is a dedicated stream subscriber (a witness collector) created and wired at the `gameplayRuntime` composition root, subscribed *after* `runStats.subscriber` so its run-end update runs after run stats are written (REQ-TELEM-14). The feats profile is a passive store (no subscriber) owned by the runtime. `createStatsTransfer` is extended to take the witness store and feats store alongside `runStats`, so export (REQ-TELEM-20) and import (REQ-TELEM-22) can read and replace them.

---

### Witness Knowledge profile

**REQ-TELEM-9:** Define new types:

```typescript
type WitnessEntry = {
  encounterCount: number
  diedTo: boolean
}

type WitnessProfile = {
  version: 1
  threats: Record<string, WitnessEntry>
}
```

The key in `threats` is the `templateId` value from `HazardAdded` (the world card's `name`). One entry per unique threat name. World decks also contain non-threat utility cards (e.g. `Door`, `The Walker`); because the key is any world card's `name`, these receive witness entries too. That is acceptable — feat logic that cares only about lethal threats filters by name.

**REQ-TELEM-10:** `WitnessProfile` is stored at localStorage key `shattered-worlds/witness/v1`, completely separate from the run stats keys. A corrupted or missing witness payload must not affect run stats, and vice versa.

**REQ-TELEM-11:** A stored `WitnessProfile` that fails validation is silently discarded (reset to `{ version: 1, threats: {} }`) and a warning is logged. The player's run stats are unaffected.

**REQ-TELEM-12:** A threat's `encounterCount` increments once per `HazardAdded` event for that `templateId`. The counter accumulates across runs, including abandoned runs. A single run may increment the counter by more than 1 if the same threat type is drawn multiple times. Opening-hand draws count, via the surfaced opening-deal events (REQ-TELEM-24).

**REQ-TELEM-13:** A threat's `diedTo` is set to `true` when the run outcome is `lost` and at least one instance of that threat is in the `hand` zone at the moment `RunEnded` fires. "In hand" means in the `GameState.hand` array, not in `worldDraw`, read from `RunEnded.finalState.hand` (see REQ-TELEM-23). Once `true`, it never reverts. Abandoned runs never set `diedTo` regardless of which threats are active.

**REQ-TELEM-14:** The `WitnessProfile` is loaded before the first `RunStarted` event can be observed, updated at run end (after run stats are written), and saved back. It is never reset by a run stats import unless the import payload explicitly includes a `witnessProfile` field (see REQ-TELEM-19).

---

### Feats profile

**REQ-TELEM-15:** Define new types:

```typescript
type FeatRecord = {
  featId: string
  earnedAt: number   // epoch ms
  sessionId: string  // RunRecord.sessionId of the earning run
}

type FeatsProfile = {
  version: 1
  earned: FeatRecord[]
}
```

**REQ-TELEM-16:** `FeatsProfile` is stored at localStorage key `shattered-worlds/feats/v1`, separate from run stats and witness keys.

**REQ-TELEM-17:** Each `featId` may appear at most once in `earned`. If a run satisfies a feat condition for a feat already in `earned`, no duplicate is appended.

**REQ-TELEM-18:** Feat condition definitions and evaluation are out of scope for this spec. The `FeatsProfile` is writable from outside this module (to allow the future Feats evaluator to append entries), but the schema and storage key are owned here.

---

### Export and import

**REQ-TELEM-19:** `StatsExportPayload` gains two new optional fields:

```
witnessProfile?: WitnessProfile
featsProfile?: FeatsProfile
```

The `kind` literal stays `'shattered-worlds-stats'`; no new export format version.

**REQ-TELEM-20:** `StatsTransfer.exportJson()` includes both profiles in the payload when they are non-empty (`threats` has at least one entry, or `earned` has at least one entry). An empty profile is omitted.

**REQ-TELEM-21:** `StatsTransfer.inspectImport()` accepts payloads with or without the new optional fields. A payload without `witnessProfile` or `featsProfile` (old export) is valid and imports without error. A payload that *includes* `witnessProfile` or `featsProfile` but with an invalid shape is rejected (`inspectImport` returns `{ ok: false }`), the same way an invalid `lifetime` or `history` is rejected. This differs from REQ-TELEM-11, which silently discards corrupt *stored* witness data — a malformed *import* is reported, not swallowed.

**REQ-TELEM-22:** `StatsTransfer.applyImport()` replaces the witness profile when `witnessProfile` is present in the payload, and replaces the feats profile when `featsProfile` is present. If a field is absent, the existing stored profile for that field is left unchanged — an old export does not wipe locally-earned witness or feats state.

---

## AI Validation

1. **Type check.** `tsc --noEmit` passes with the new `RunRecord` fields, `WitnessProfile`, `WitnessEntry`, `FeatRecord`, `FeatsProfile`, `HealReceived`, and `HazardAdded` types defined, and `StatsExportPayload` extended.

2. **HealReceived event fires.** In a unit test, apply a `Heal { amount: 4 }` effect and assert the event stream contains `{ type: 'HealReceived', amount: 4 }`.

3. **HazardAdded event fires.** In a unit test, trigger a world-card draw and assert the event stream contains `{ type: 'HazardAdded', templateId: '<card name>' }` with the correct template name.

4. **Collector tallies healing.** Run a game session with two `HealReceived` events (`amount: 3` then `amount: 5`), finish the run, and assert `RunRecord.healingReceived === 8`.

5. **finalHp and finalResources captured on a Zombie run.** Finish a run with known `GameState.hp = 7` and `GameState.energy = 3`. Assert `RunRecord.finalHp === 7` and `RunRecord.finalResources` equals `{ energy: 3, light: 0, brace: 0 }`.

6. **Old payload still valid.** Load a stored `RunRecord` without `finalHp`, `finalResources`, or `healingReceived` fields. Assert the validator accepts it and the fields are `undefined` after load.

7. **Witness profile round-trip.** Run a session for a Zombie world. The `"Zombie"` card is drawn into hand twice (two `HazardAdded` events with `templateId: "Zombie"`). The run is lost while a `"Zombie"` is in `hand`. Reload the witness profile and assert `threats["Zombie"].encounterCount === 2` and `threats["Zombie"].diedTo === true`.

8. **Abandoned run does not set diedTo.** Run a session, draw a hazard into hand, then abandon. Assert `diedTo` is not set to `true` for that threat.

9. **Corrupt witness profile discards gracefully.** Write invalid JSON to `shattered-worlds/witness/v1`. Load the witness profile. Assert it returns `{ version: 1, threats: {} }` and run stats are unaffected.

10. **Feats profile round-trip.** Write a `FeatRecord` entry, save, reload, and assert it appears in `earned`.

11. **Feats duplicate prevention.** Write the same `featId` twice. Assert `earned` contains it exactly once after both writes.

12. **Export includes profiles.** After populating witness and feats state, call `exportJson()` and parse the result. Assert both `witnessProfile` and `featsProfile` are present with correct content.

13. **Old export import does not wipe profiles.** Populate local witness state, then import an old-format payload (no `witnessProfile` field). Assert the existing witness profile is unchanged after `applyImport()`.

14. **Full-payload import replaces profiles.** Import a payload with `witnessProfile` and `featsProfile`. Assert both are replaced by the imported values.

15. **Opening-hand threat counted.** Start a run whose opening hand contains a world card named `X` (no action dispatched yet). Assert a `HazardAdded { templateId: 'X' }` is observed for the opening deal, and `encounterCount` for `X` includes the opening-hand instance.

16. **RunEnded carries final state.** Finish a run and assert `RunEnded.finalState` reflects the final `GameState` (`hp`, `energy`, `hand`), and that the `RunRecord`'s `finalHp` and `finalResources` match it. Repeat for a run abandoned before any action — `finalState` reflects the opening state.

17. **Malformed profile in import is rejected.** Import a payload whose `witnessProfile` is present but malformed. Assert `inspectImport` returns `{ ok: false }` and the stored witness profile is left unchanged.
