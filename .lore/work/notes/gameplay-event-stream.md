---
title: Implementation notes: gameplay-event-stream
date: 2026-06-11
status: active
tags: [implementation, notes]
source: .lore/work/plans/gameplay-event-stream.md
modules: [core, game, sim]
---

# Implementation Notes: Gameplay Event Stream

## Progress
- [x] Phase 1: Define the runtime event-stream contract
- [x] Phase 2: Build the multi-subscriber observation boundary
- [x] Phase 3: Wrap `createGame` with session lifecycle emission
- [x] Phase 4: Wire the renderer to the observed session boundary
- [x] Phase 5: Preserve headless and test optionality
- [x] Phase 6: Add requirement-driven tests and validation gates
- [x] Phase 7: Validate against the spec with a fresh-context reviewer
- [x] Phase 8: Make the boundary reachable — composition root, abandoned runs, first consumer

## Log

### Phase 1: Define the runtime event-stream contract
- Dispatched: Created a Phaser-free runtime contract in `src/game/runtime/gameplayEventStream.ts` plus unit coverage in `src/game/runtime/gameplayEventStream.test.ts`, and exported `GameEvent` through `src/core/contract.ts`.
- Result: Added `RunStreamItem = RunStarted | GameplayBatch | RunEnded` with grouped dispatch payloads (`action`, ordered `events`, corroborating `state`) and lifecycle envelopes carrying session identity, setup, and terminal outcome fields.
- Tests: Targeted test, lint, and build passed. Repository-wide `bun run typecheck` and the full test suite still report unrelated pre-existing failures outside this phase.
- Review: No significant requirement or boundary issues were flagged in fresh review.

### Phase 2: Build the multi-subscriber observation boundary
- Dispatched: Added a runtime `createGameplayEventStream()` API with `emit()` and `subscribe()`/unsubscribe behavior in `src/game/runtime/gameplayEventStream.ts`, plus boundary tests in `src/game/runtime/gameplayEventStream.test.ts`.
- Result: The stream now fans out synchronously to a snapshot of current subscribers, tolerates mid-emission subscribe/unsubscribe changes for later items only, ignores subscriber return values, and surfaces the first thrown subscriber error after finishing delivery.
- Review: Initial review found a REQ-EVENTS-10 violation because emitted batches exposed mutable authoritative references. A follow-up fix switched the stream to immutable snapshots so caller or subscriber mutation attempts cannot affect later subscribers or future gameplay state.
- Tests: Targeted event-stream tests passed after the fix, along with lint. Repository-wide `bun run typecheck` and the full suite still have unrelated pre-existing failures outside this phase.

### Phase 3: Wrap `createGame` with session lifecycle emission
- Dispatched: Built `src/game/runtime/gameplaySession.ts` and `src/game/runtime/gameplaySession.test.ts` to wrap `createGame(...)` with session lifecycle emission while preserving the `GameCore` shape.
- Result: `createGameplaySession(...)` now emits `RunStarted` once at creation, emits one grouped `GameplayBatch` per accepted dispatch, emits `RunEnded` exactly once on the first terminal transition, and injects `makeSessionId` for deterministic tests.
- Review: Initial review found that subscriber failures could escape the session boundary and change whether session creation or dispatch succeeded. The fix now reports subscriber failures explicitly through session-level reporting without changing gameplay success/failure semantics.
- Tests: Targeted runtime-session tests, lint, and build passed. Repository-wide `bun run typecheck` and the full suite still have unrelated pre-existing failures outside this phase.

### Phase 4: Wire the renderer to the observed session boundary
- Dispatched: Replaced `TableScene`'s direct `createGame(...)` usage with `createGameplaySession(...)` and added `src/game/tests/gameplaySessionIntegration.test.ts` to exercise the renderer/runtime seam.
- Result: The live scene now runs through the observed session boundary while still deriving redraws and transitions from authoritative session state. Multiple subscribers can observe one dispatch flow without introducing a second truth source inside `TableScene`.
- Tests: Targeted runtime and integration tests, lint, and build passed. Repository-wide `bun run typecheck` still has unrelated pre-existing failures outside this phase.
- Review: No significant renderer/runtime seam or scope issues were flagged.

### Phase 5: Preserve headless and test optionality
- Dispatched: Verified the opt-in boundary with tests only, leaving production sim code untouched. Added parity coverage in `src/game/runtime/gameplaySession.test.ts` and a boundary assertion in `src/sim/tests/sim.test.ts`.
- Result: `src/sim/run.ts` stayed unchanged and still resolves runs through pure core code with no runtime-stream or Phaser dependency. No shared export or type changes were required for headless consumers.
- Tests: Optional-stream runtime tests, sim boundary checks, lint, and `bun run sim -- 10` passed. Repository-wide `bun run typecheck` still has unrelated pre-existing failures, and the existing sim win-rate expectation in `src/sim/tests/sim.test.ts` remains flaky/pre-existing.
- Review: No hidden headless/runtime coupling issues were flagged.

### Phase 6: Add requirement-driven tests and validation gates
- Dispatched: Added three requirement-driven tests to `src/game/runtime/gameplaySession.test.ts` and a two-act world fixture helper.
- Result: All gaps in REQ-EVENTS-4 and REQ-EVENTS-9 coverage are now filled. New tests: (1) `HazardDiscarded` appears in stream batches when a discardable hazard is removed via `DiscardHazard`; (2) `CardDestroyed` and `CardsDiscarded` appear in EndTurn batches when world cards self-destruct via `onEndOfTurn: DestroySelf`; (3) `ActAdvanced` appears in stream batches when gameplay crosses an act boundary (two-act fixture, act 0 exhausts at turn start, EndTurn draw triggers advance).
- Tests: 488 pass (up 3), 9 fail (all pre-existing). Lint clean. No typecheck errors in changed files.
- Coverage: All eight Phase 6 checklist items confirmed across the runtime test suite.

### Phase 7: Validate against the spec with a fresh-context reviewer
- Dispatched: Fresh-context review agent read the spec requirements REQ-EVENTS-1 through REQ-EVENTS-12 against all implementation and test files.
- Result: All 12 requirements confirmed covered. No conformance failures.
- Findings: Four minor gaps identified. Gap 1 (untested `runEnded` guard path — structurally dead under current core behavior) and Gap 3 (string-match renderer seam test — brittle to rename) acknowledged as acceptable. Gap 2 (throwing `onSubscriberError` reporter silently consumed) and Gap 4 (`RunStarted.appliedModifiers` clone isolation) addressed with two additional tests.
- Tests: 490 pass (up 5 total from Phase 6 start), 9 fail (all pre-existing, unrelated to this branch).

### Phase 8: Make the boundary reachable — composition root, abandoned runs, first consumer
- Why: post-implementation review found the Phases 1–7 system structurally complete but unreachable in production. `TableScene` created the session privately with zero subscribers, the renderer consumed only the dispatch return value, nothing ever called `subscribe`, and a player exiting mid-run left the stream open with no `RunEnded`. The stream was emitting fully-cloned batches into a void on every dispatch.
- Composition root: `src/game/runtime/gameplayRuntime.ts` owns one long-lived stream; `main.ts` builds the runtime with `localStorage`-backed stats and injects it into `TableScene` (scene instances in the Phaser config instead of classes). Cross-run consumers subscribe once at boot and see every session's `RunStarted → RunEnded` history. `createGameplaySession` accepts an injected shared stream; `session.subscribe` is now session-scoped (filtered by sessionId) and released when the run closes so a long-lived stream does not accumulate dead filters.
- Abandoned runs: `GameplaySession.abandon()` closes the stream with new outcome `abandoned`; `TableScene` calls it on scene shutdown, no-op when the run already ended in a win or loss. Spec REQ-EVENTS-8 amended accordingly.
- Error handling: the stream now takes an `onSubscriberFailure` handler and reports *every* subscriber failure (the old design rethrew only the first error and silently dropped the rest, then caught its own rethrow one frame up). Emit never throws back into gameplay.
- Snapshot policy: items are cloned once and deep-frozen at construction instead of cloned per subscriber per emit (was N+1 full-state clones per dispatch). Subscriber mutation attempts now throw and surface as reported failures rather than being silently absorbed.
- First consumer: `src/game/runtime/runStats.ts` derives per-run records and lifetime aggregates (turns, cards played, progress dealt, damage taken, hazards resolved/discarded, discards, outcomes per world) purely from the stream, persisted under a versioned `localStorage` key with injected storage. Partial runs (collector attached mid-run) are ignored rather than recorded with understated counts. This is a deliberately minimal validating consumer; the full run-stats system still gets its own follow-up spec.
- Tests: 512 pass (up 22), same 9 pre-existing failures. Lint clean, build clean, typecheck clean for changed files.
- Review round: fresh-context review verified determinism, restart lifecycle, and spec conformance, then flagged two real bugs and assorted polish, all fixed: (1) a stored stats payload claiming `version: 1` but malformed would crash the fold on every RunEnded and never be overwritten — `loadLifetime` now validates full shape (numeric counters, well-formed `byWorld`) before trusting it; (2) `dispatch` after `abandon()` could emit batches after the closing RunEnded and suppress a real terminal outcome — dispatch now throws once the run is closed; (3) TableScene's shutdown hook registers immediately after `startSession` so a later `create()` failure can't orphan an open run; (4) page unload never fired scene shutdown — the runtime tracks open sessions and `abandonAll()` is wired to `pagehide` in main.ts; (5) lifetime aggregates gained the `hazardsDiscarded`/`cardsDiscarded` counters already tallied per run; plus unsubscribe pruning, the named `RunStatsReader` type, reuse of `RunTerminalOutcome`, an import-statement-based Phaser scan, and a documented plain-data assumption on `deepFreeze`. Final: 516 pass, same 9 pre-existing failures.

## Divergence

- REQ-EVENTS-8 originally limited the run-end outcome to `won` | `lost`, which left sessions exited mid-run permanently open. Phase 8 added `abandoned` as a third closing outcome and amended the spec (status: draft) rather than recording an unresolved gap.
- REQ-EVENTS-5 said consumers "must be able to" observe the stream, which Phases 1–7 satisfied in tests only. Phase 8 amended the requirement to demand a composition root outside any single scene, matching what the named consumers actually need.
- The run-stats exit point was scoped as a follow-up spec; Phase 8 ships a minimal collector ahead of that spec as the validating consumer the foundation otherwise lacked. The follow-up spec still owns the full stat catalog and any UI surface.
