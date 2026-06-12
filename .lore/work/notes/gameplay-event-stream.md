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

## Divergence

(Empty if implementation matched the source artifact)
