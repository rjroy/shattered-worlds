---
title: RunRecord's finalHp/finalResources/healingReceived Fields and Their Source Events
date: 2026-07-02
status: current
tags: [telemetry, run-record, feats, healing, resources, architecture]
fg-type: architecture
fg-sources: [.lore/work/specs/extended-run-telemetry.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/runStats.ts
    - src/core/model/types.ts
    - src/core/effects/heal.ts
  symbols:
    - RunRecord
    - HealReceived
    - HazardAdded
---

# RunRecord's finalHp/finalResources/healingReceived Fields and Their Source Events

Three optional `RunRecord` fields exist to give the feat evaluator (see [[feat-definition-type-contract]]) end-of-run condition data that the original v1/v2 stats schema never captured: `finalHp`, `finalResources` (a `Record<string, number>`), and `healingReceived`. All three are `undefined` on any payload recorded before this extension, and the validator treats "absent" and "present with the correct type" as the only two valid states — a present-but-wrong-typed value (e.g. a string `finalHp`) is rejected outright.

`finalHp` and `finalResources` are read from `RunEnded.finalState` — the full `GameState` snapshot described in [[gameplay-event-stream-architecture]] — at the exact moment a run closes, for both terminal and abandoned outcomes. `finalResources` originally shipped with three fixed keys (`energy`, `light`, `brace`, each mapping to a `GameState` field that reads `0` on a world that doesn't use that resource) but has since grown a fourth key, `heat`, as later worlds added that resource (`src/game/runtime/runStats.ts`) — new resource keys are additive to this record, not a schema version bump.

`healingReceived` is a cumulative tally, not a snapshot: the core emits a `HealReceived { type: 'HealReceived', amount }` event alongside the existing `HpChanged` event whenever the `heal()` effect resolves, and `RunStatsCollector` sums `amount` across the run (including any healing during the opening deal, via the surfaced `initialEvents` on `RunStarted`) into the value written to `RunRecord.healingReceived` at `RunEnded`.

## HazardAdded — the Draw-Time Event Witness Knowledge Depends On

`HazardAdded { type: 'HazardAdded', templateId, id }` fires once per world-card instance drawn into `hand` — once per draw, not once per card type per turn. `templateId` is the card's `name` field, the de facto identifier used across world catalogs. Because the opening hand is dealt inside `createWorld` before any player action, and `refillHand` always draws at least one world card, every run's opening-hand threats would go uncounted unless those opening-deal events were surfaced — which is exactly what `RunStarted.initialEvents`/`initialState` do (see [[gameplay-event-stream-architecture]]).

This event is the sole data source for [[witness-knowledge-system]]'s per-threat `encounterCount`. Note the shipped `WitnessEntry` shape (`encounterCount`, `discardedCount`, `resolvedCount`, `diedTo`) is broader than the two fields (`encounterCount`, `diedTo`) this telemetry spec originally scoped — `discardedCount` and `resolvedCount` were added later as the witness system grew into a feat-gating input, not part of this extension.
