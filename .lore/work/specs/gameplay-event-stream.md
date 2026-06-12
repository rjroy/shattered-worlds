---
title: Gameplay event stream
date: 2026-06-11
status: draft
tags: [events, telemetry, progression, persistence, determinism]
modules: [core, game, sim]
related:
  - .lore/work/design/core-render-architecture.html
  - .lore/work/brainstorm/shattered-worlds-meta-progression.html
  - .lore/reference/vision.html
req-prefix: EVENTS
---

# Spec: Gameplay Event Stream

## Overview
A typed gameplay event stream makes the game's authoritative history available to non-rendering consumers without making the core impure. The system defined here treats gameplay events as the source of truth for telemetry, run stats, meta progression, and save checkpoint policy, while preserving the existing core contract that `dispatch` returns final state plus ordered events. In the current repository slice, a "run" means the playable session created for one world by `createGame`; future multi-world orchestration may compose multiple such sessions later, but that larger run model is out of scope here.

## Entry Points
- Player starts a world and the runtime creates a new single-world run session (from `createGame` and world setup)
- Player takes an action and the runtime receives `dispatch(action) -> { state, events }` (from the core/game seam)
- A non-rendering system needs authoritative run history, stats, or progression triggers (from telemetry, progression, or persistence consumers)

## Requirements
- REQ-EVENTS-1: The gameplay event stream must be an authoritative, ordered account of what happened in a run. For every accepted gameplay action, consumers must be able to observe the resulting gameplay events in the same causal order the core produced them.
- REQ-EVENTS-2: Gameplay events must remain domain events, not presentation cues. The stream must describe game truth such as card plays, progress dealt, cards discarded, act advancement, and run outcome; it must not encode Phaser timing, tween instructions, particle choices, or other renderer-only concerns.
- REQ-EVENTS-3: The event stream must continue to preserve the existing core seam contract that the authoritative final state and the ordered event list are produced together. Consumers may use the final state as corroborating context, but the stream itself is the primary source for gameplay-derived telemetry and progression.
- REQ-EVENTS-4: The event contract must be self-describing enough that the representative downstream checks named by this spec can be computed from the event stream without reconstructing intent from renderer state. At minimum, the payloads must support session correlation, card-play tracking, progress dealt tracking, discard/destruction tracking, act-boundary tracking, and terminal outcome tracking when those facts are authoritative for a stat or progression trigger.
- REQ-EVENTS-5: The runtime must provide a multi-consumer observation boundary outside `src/core/` that lets multiple non-rendering consumers observe the same authoritative run history from one dispatch flow. At minimum, the renderer, run-stats collection, meta-progression collection, and save/checkpoint policy must be able to consume the stream without redefining gameplay truth independently, and without changing gameplay resolution responsibilities inside the core. The observation boundary must be reachable from a composition root outside any single scene, so consumers that outlive one world session (lifetime stats, meta progression) can subscribe once and observe every session.
- REQ-EVENTS-6: The event system must define run lifecycle envelopes in addition to per-action gameplay events. In this spec, those lifecycle envelopes apply to the current single-world session created by the runtime. Consumers must be able to observe when that session starts and when it ends, with enough identity to correlate all emitted gameplay events to one session.
- REQ-EVENTS-7: The run-start envelope must identify the session being observed and the setup it belongs to. At minimum, it must include a unique session identifier, the `worldId`, the seed used to create the session, and any progression or setup modifiers actually applied before the first gameplay action. If no such modifiers are applied, the envelope still includes the first three fields.
- REQ-EVENTS-8: The run-end envelope must identify the outcome of the session and must close the stream exactly once per session. At minimum, it must include the same session identifier, the outcome (`won`, `lost`, or `abandoned`), and the final act reached. A session that ends in victory and a session that ends in loss must be distinguishable to subscribers without inferring outcome from renderer behavior. A session that is exited before reaching a gameplay-terminal state (the player leaves the world, the scene shuts down) must still close its stream, with outcome `abandoned`, so consumers such as run stats and save policy never observe a session that starts and silently never ends.
- REQ-EVENTS-9: The event stream must support per-act and per-run progression checks. Subscribers must be able to determine act boundaries and run boundaries from the authoritative stream so feat-like requirements can be evaluated without scraping UI state.
- REQ-EVENTS-10: The event stream must be safe for deterministic re-use. Adding event subscribers or persistence consumers must not change gameplay resolution, RNG behavior, or the ordering/content of the authoritative core event list for the same seed and action sequence.
- REQ-EVENTS-11: The event stream must remain optional for headless and test consumers. Systems such as the sim runner may ignore the stream entirely and still resolve a valid run, while systems that need metrics may consume it without requiring renderer code.
- REQ-EVENTS-12: This spec defines the foundation and subscriber boundaries only. Detailed requirements for run-stat aggregation, meta-progression rules, and save/checkpoint storage are out of scope here and must be specified separately.

## Exit Points
| Exit | Triggers When | Target |
|------|---------------|--------|
| Renderer playback | Gameplay events are emitted for an accepted action | .lore/work/design/core-render-architecture.html |
| Run stats collection | A subscriber derives per-run or lifetime counters from the event stream | [STUB: run-stats-collection] *(planned follow-up spec)* |
| Meta progression updates | A subscriber evaluates unlocks, witness knowledge, or feat progress from the event stream | [STUB: meta-progression-consumers] *(planned follow-up spec)* |
| Save or checkpoint policy | A subscriber decides when to persist run/profile data based on run lifecycle or gameplay events | [STUB: save-checkpoint-policy] *(planned follow-up spec)* |

## Success Criteria
- [ ] The spec distinguishes which gameplay facts belong in the authoritative event stream and which remain renderer-only.
- [ ] The spec names the minimum lifecycle fields required to correlate a single-world session from start to terminal outcome.
- [ ] The spec states that telemetry, progression, and save systems subscribe to gameplay truth instead of inventing a separate source of truth.
- [ ] The spec defines the required subscriber boundaries and identifies run stats, meta progression, and save/checkpoint policy as planned follow-up specs rather than in-scope detail here.
- [ ] The spec preserves the repository's deterministic core/game seam rather than replacing it.

## AI Validation
How the AI verifies completion before declaring done.

**Defaults** (apply unless overridden):
- Unit tests with mocked time/network/filesystem/LLM calls (including Agent SDK `query()`)
- 90%+ coverage on new code
- Code review by fresh-context sub-agent

## Constraints
- The `core` / `game` boundary remains lint-enforced; this system must not move Phaser concerns into `src/core/`.
- Same seed plus same actions must still yield the same gameplay state and authoritative event history.
- The existing `dispatch -> { state, events }` seam is preserved; this spec does not replace it with callbacks, async actors, or renderer-owned truth.
- Multi-consumer observation lives outside `src/core/`; this spec does not require adding subscriber registration or persistence concerns to `GameCore`.
- The spec does not define storage technology, database schema, or migration strategy.
- The spec does not define the detailed unlock logic, feat catalog, or aggregate-stat formulas for downstream systems.
- The spec does not define a future multi-world orchestration layer; if the project later treats multiple world sessions as one higher-order run, that orchestration needs its own spec.

## Context
- The existing architecture already commits to `dispatch(action) -> { state, events }` and treats events as the renderer's animation script, while keeping the core synchronous and deterministic. This spec extends that same authoritative history to non-rendering consumers rather than introducing a second telemetry truth source (`.lore/work/design/core-render-architecture.html`).
- The current core event union already covers most within-run gameplay events, but the stream is ephemeral per dispatch and there are no run lifecycle envelopes or subscriber fan-out requirements yet (`src/core/model/types.ts`, `src/core/engine/game.ts`).
- The current shipped slice creates one world session at a time rather than a multi-world gauntlet, so this spec defines lifecycle at that level and leaves any larger run orchestration for later work (`src/game/scenes/TableScene.ts`, `.lore/work/specs/world-deck-slice.html`).
- Principle 6 explicitly says the game should instrument early and answer balance questions with data, which makes a trustworthy gameplay event stream a product requirement rather than a later implementation detail (`.lore/reference/vision.html`).
- The meta-progression brainstorm calls for feat-like unlocks, witness knowledge, echo-of-last-run behavior, and other systems that depend on authoritative act/run history while also keeping persistent progression outside the core simulation (`.lore/work/brainstorm/shattered-worlds-meta-progression.html`).
