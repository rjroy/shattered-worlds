---
title: Gameplay Event Stream — Run Lifecycle Envelopes and the Multi-Consumer Boundary
date: 2026-07-02
status: current
tags: [events, telemetry, runtime, architecture, determinism, gameplayRuntime]
fg-type: architecture
fg-sources: [.lore/work/specs/gameplay-event-stream.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/gameplayEventStream.ts
    - src/game/runtime/gameplaySession.ts
    - src/game/runtime/gameplayRuntime.ts
    - src/game/main.ts
  tests:
    - src/game/runtime/gameplayEventStream.test.ts
    - src/game/runtime/gameplaySession.test.ts
  symbols:
    - RunStarted
    - GameplayBatch
    - RunEnded
    - RunStreamSubscriber
    - GameplayEventStream
---

# Gameplay Event Stream — Run Lifecycle Envelopes and the Multi-Consumer Boundary

The core's existing `dispatch(action) -> { state, events }` seam treats per-action events as an animation script for the renderer. This is not enough for consumers that outlive a single dispatch call or a single scene — run stats, witness knowledge, and feat evaluation all need an authoritative account of a whole run, not one action at a time. The gameplay event stream (`src/game/runtime/gameplayEventStream.ts`) extends that same authoritative history to non-rendering consumers without moving anything into `src/core/`: the core stays synchronous, deterministic, and ignorant that subscribers exist.

## Lifecycle Envelopes

Three envelope kinds compose the stream (`RunStreamItem = RunStarted | GameplayBatch | RunEnded`):

- **`RunStarted`** — carries `sessionId`, `worldId`, `seed`, `appliedModifiers` (a `SetupModifier[]` chronicle of which unlocks were active), plus `initialEvents` and `initialState`. The last two exist because the opening hand is dealt inside `createWorld`/`createGame` before any player action — without surfacing them, every run's opening world-card draws (and any opening-hand `HazardAdded`/`HealReceived` events) would never reach subscribers.
- **`GameplayBatch`** — one per accepted action, carrying `action`, the resulting `events`, and `state`. This is the direct descendant of the per-dispatch `{ state, events }` result, now stamped with `sessionId` and `timestamp` for cross-consumer correlation.
- **`RunEnded`** — closes the stream exactly once per session, carrying `outcome` (`'won' | 'lost' | 'abandoned'`), `finalActIndex`, and `finalState` (a full `GameState` snapshot taken in `gameplaySession`'s `closeRun` at the instant the run closes, for both terminal and abandoned outcomes). `finalState` is transient stream data — only the scalar fields subscribers extract from it (e.g. `finalHp`, `hand` contents) get persisted; the snapshot itself never lands in storage.

A session that never reaches a gameplay-terminal state (the player exits the world, the scene shuts down, `pagehide` fires) still emits `RunEnded` with `outcome: 'abandoned'` exactly once, so no subscriber ever observes a session that starts and silently never ends. `main.ts` wires a `pagehide` listener to `gameplayRuntime.abandonAll()` because scene shutdown does not fire on tab close, and this is the last reliable synchronous point to close any open stream.

## Multi-Consumer Boundary

`gameplayRuntime.ts` is the composition root — the one place outside any scene where the stream is created and subscribers are attached, so consumers that outlive one world session (run stats, witness knowledge, feats) can subscribe once and observe every session a player starts. As of this writing three subscribers attach in a fixed, meaningful order:

```
stream.subscribe(runStats.subscriber)        // 1st — folds the run into lifetime stats
stream.subscribe(witnessStore.subscriber)    // 2nd — updates per-threat witness data
stream.subscribe(featEvaluator.subscriber)   // 3rd — evaluates feat conditions against the now-updated runStats and witness state
```

This ordering is load-bearing, not incidental: the feat evaluator reads `runStats.lifetime().lastRun` and `witnessStore.getProfile()` inside its own `RunEnded` handler, so it must run after both. See [[feat-evaluation-memory-fragments]] for what the third subscriber does with this guarantee.

Stream items are deep-frozen before subscribers see them (`deepFreeze` in `gameplayEventStream.ts`), so no subscriber can mutate history for a later subscriber. Adding or removing subscribers never changes gameplay resolution, RNG behavior, or event ordering for a given seed and action sequence — the stream is a read-only tap on the same authoritative history the core already produces, not a second source of truth.

## What This Spec Deliberately Left Open

The originating spec (`gameplay-event-stream.md`) scoped itself to the envelope and subscriber-boundary shape only, explicitly deferring run-stat aggregation formulas, meta-progression rules, and save/checkpoint storage schema to follow-up specs. Those follow-ups shipped as [[run-stats-persistence-architecture]] (stats), [[witness-knowledge-system]] and [[feat-evaluation-memory-fragments]] (meta-progression), and the localStorage persistence covered in [[save-durability-and-migration-lesson]].
