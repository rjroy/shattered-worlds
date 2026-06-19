---
title: OfferBoon rewards implementation plan
date: 2026-06-19
status: draft
tags: [plan, rewards, boons, world-cards, implementation]
modules: [core-engine, card-effects, game-runtime, table-ui, card-data]
related: [.lore/work/specs/offer-boon-rewards.md, .lore/work/brainstorm/offer-boon-world-clear-rewards.md, .lore/work/specs/fortune-boon-cards.md]
---

# OfferBoon rewards implementation plan

## Source

Primary source: `.lore/work/specs/offer-boon-rewards.md`

Supporting context:

- `.lore/work/brainstorm/offer-boon-world-clear-rewards.md`
- `.lore/work/specs/fortune-boon-cards.md`

## Implementation Strategy

Build this as a generalization of the current act boon path rather than a second reward path. The current `pendingActBoon`, `ChooseActBoon`, `ActBoonOffered`, and `ActBoonChoiceView` should become generic boon-choice concepts. Once Fortune runs on the generic path, add `OfferBoon` as a hook effect that produces the same pending choice.

Keep the first version intentionally narrow:

- only `chooseCount: 1`
- only exhaust player-card boon templates
- only one pending boon choice
- no queue
- one real world-card `onCleared` authoring site to exercise the effect

## Steps

### 1. Introduce generic boon-choice core types

Files:

- `src/core/model/types.ts`
- `src/core/contract.ts`
- tests that construct `GameState` fixtures

Changes:

- Add `BoonChoiceSource = "act" | "worldClear"` or an equivalent inline source union.
- Replace `ActBoonChoice` with `PendingBoonChoice`.
- Rename `GameState.pendingActBoon` to `pendingBoonChoice`.
- Replace action `{ type: "ChooseActBoon"; templateId }` with `{ type: "ChooseBoon"; templateId }`.
- Replace `ActBoonOffered` event with a generic `BoonOffered` event carrying at least `source`, `setId`, and `templateIds`.
- Extend `BoonCardGranted` with `dest: "hand" | "playerDiscard"`.
- Preserve act correlation by adding `act?: number` or equivalent payload on act-source `BoonOffered`.

Validation gate:

- `bun run typecheck` should reveal all remaining act-specific call sites.
- Existing tests may fail at this stage, but failures should be rename/migration failures, not unrelated type errors.

### 2. Generalize offer generation and choice resolution

Files:

- `src/core/engine/actBoon.ts` or a new `src/core/engine/boonChoice.ts`
- `src/core/engine/reduce.ts`
- `src/core/engine/world.ts`
- `src/core/engine/available.ts`
- `src/data/unlocks/types.ts`
- `src/data/unlocks/catalog.ts`

Changes:

- Create a generic helper, likely `createBoonOffer(catalog, state, config)`, that:
  - accepts `source`, `setId`, `poolTemplateIds`, `offeredCount`, `chooseCount`, and `bToDiscard`
  - filters to player cards with `exhaust: true`
  - deduplicates template IDs
  - uses deterministic RNG and advances RNG even for degenerate shuffles
  - returns unchanged/no-pending state when no legal templates exist
- Migrate Fortune act rewards to call the generic helper from `handleEndTurn`.
- Preserve Fortune behavior: source `act`, set `fortune-v1`, offer 3, choose 1, grant to hand, no Act 1 opening trigger.
- Replace `handleChooseActBoon` with `handleChooseBoon`.
- In `handleChooseBoon`, mint the selected template, enforce player exhaust, grant to either hand or `playerDiscard`, clear the pending choice, and emit `BoonCardGranted` with destination.
- Update reducer blocking so only `ChooseBoon` is accepted while `pendingBoonChoice` exists.
- Keep `RunModifiers.actBoon` if that is the smallest migration, but make it feed the generic helper. Avoid renaming unlock data unless implementation pressure justifies it.

Validation gate:

- Add/update reducer tests covering Fortune migration and generic `ChooseBoon`.
- Run targeted tests: `bun test src/core/tests/reduce.test.ts src/game/runtime/gameplaySession.test.ts src/data/unlocks/catalog.test.ts`.

### 3. Add `OfferBoon` as a card effect

Files:

- `src/core/model/types.ts`
- `src/core/effects/registry.ts`
- new `src/core/effects/boonChoice.ts` or an existing effect module if cleaner
- `src/core/view/describe.ts`
- `src/core/view/effectGlyphs.ts`
- `src/core/tests/effectRegistry.test.ts`
- `src/core/tests/effects.test.ts` or `src/core/tests/reduce.test.ts`

Changes:

- Add `CardEffect` variant:

```typescript
{ kind: "OfferBoon"; setId: string; offeredCount: number; chooseCount: 1; bToDiscard?: boolean }
```

- Add an `OfferBoonHandler` registered in `EFFECTS`.
- The handler should:
  - look up the referenced boon set
  - call the generic offer helper with source `worldClear`
  - default `bToDiscard` to false
  - fail closed when there are no legal options
  - fail closed deterministically when a pending choice already exists
- Ensure `OfferBoon` is not playable by itself. It should be a hook reward effect.
- Add display description and glyph compilation for card faces.

Validation gate:

- Add tests for `OfferBoon` description/glyph output.
- Add reducer/effect tests where clearing a world card with `onCleared: OfferBoon` creates a pending choice and emits `BoonOffered`.
- Add tests for `bToDiscard` false/true destinations.

### 4. Expose boon sets outside the Fortune-only naming

Files:

- `src/data/worlds/boons/fortune.ts`
- `src/data/worldManifest.ts`
- `src/data/unlocks/catalog.ts`
- `src/core/tests/worldManifest.test.ts`
- `src/data/unlocks/catalog.test.ts`

Changes:

- Add a generic exported boon set registry, for example `BOON_SETS`, initially containing `fortune-v1`.
- Keep `FORTUNE_BOON_POOLS` as a compatibility alias if that minimizes churn.
- Make both unlock modifier building and `OfferBoon` set lookup use the same registry.
- Ensure every boon set template is present in assembled world catalogs.
- Keep current Fortune boon constraints intact: player-only, exhaust, no forbidden world-specific effects.

Validation gate:

- Run world manifest and unlock catalog tests.
- Add a manifest test that every authored `OfferBoon.setId` resolves to a known boon set.

### 5. Generalize gameplay UI

Files:

- `src/game/view/ActBoonChoiceView.ts` likely renamed to `BoonChoiceView.ts`
- `src/game/scenes/TableScene.ts`
- `src/game/tests/actBoonChoiceView.test.ts` likely renamed or updated
- `src/game/tests/cardObjects.test.ts`
- `src/game/tests/hud.test.ts`
- any fixtures that mention `pendingActBoon`

Changes:

- Rename/generalize view types:
  - `ActBoonChoiceView` -> `BoonChoiceView`
  - `ActBoonChoiceOption` -> `BoonChoiceOption`
  - config includes `source` or title/copy strings, plus `bToDiscard`
- Replace hard-coded "Fortune" copy with generic copy:
  - hand: "Pick one temporary card. It goes directly to your hand."
  - discard: "Pick one temporary card. It goes to your discard pile."
- Update `TableScene` to read `state.pendingBoonChoice`.
- Update number-key and pointer dispatch to use `ChooseBoon`.
- Keep missing-template error UI, but remove Fortune-specific wording.
- Keep modal behavior that clears selection/connectors and blocks table interaction.

Validation gate:

- Run UI tests for boon choice view and TableScene selection.
- Run `bun test src/game/tests/actBoonChoiceView.test.ts src/game/tests/cardObjects.test.ts src/game/tests/hud.test.ts` with updated filenames/paths as needed.

### 6. Update runtime/session event expectations

Files:

- `src/game/runtime/gameplaySession.ts`
- `src/game/runtime/gameplayEventStream.ts`
- `src/game/runtime/gameplaySession.test.ts`
- `src/game/runtime/gameplayEventStream.test.ts`
- any tests that assert `ActBoonOffered`, `ChooseActBoon`, or `pendingActBoon`

Changes:

- Update runtime action/event plumbing to the generic names.
- Ensure public runtime batches expose `BoonOffered` in the producing dispatch and `BoonCardGranted` in the choice dispatch.
- Preserve template lookup for boon choice card previews.
- Update tests to assert source/set/destination instead of act-specific event names.

Validation gate:

- Run gameplay runtime/session tests.
- Confirm Fortune still streams offer and grant events through the gameplay session.

### 7. Author one real `OfferBoon` world reward

Files:

- one `src/data/worlds/*/cards.json`
- corresponding world/card tests if present
- `src/core/tests/worldManifest.test.ts`

Recommended first target:

- Pick a cache-style or high-cost existing world reward that currently grants multiple fixed cards via `Sequence` of `GainCard`.
- Use `onCleared: { "kind": "OfferBoon", "setId": "fortune-v1", "offeredCount": 3, "chooseCount": 1 }` for the first exercise.

Avoid first:

- common low-cost hazards
- `onPartialClear`
- `onEndOfTurn`
- hazards likely to be cleared in bulk by `DealProgressAll`

Validation gate:

- Run world assembly/manifest tests.
- Run a reducer test or integration test clearing that specific card and choosing a boon.

### 8. Update tests and stale names across the repo

Files:

- `src/core/tests/*`
- `src/game/tests/*`
- `src/game/runtime/*test.ts`
- `src/sim/*` if action/event names are referenced
- docs/comments only when they would confuse future implementation

Changes:

- Replace fixture fields `pendingActBoon: null` with `pendingBoonChoice: null`.
- Replace test actions/events with `ChooseBoon` and `BoonOffered`.
- Update expectations for `BoonCardGranted` to include destination.
- Keep unrelated test refactors out of scope.

Validation gate:

- `rg "pendingActBoon|ChooseActBoon|ActBoonOffered|ActBoonChoice|ActBoonChoiceView"` should return only intentional compatibility comments or none.

### 9. Full validation

Run:

```bash
bun test
bun run typecheck
bun run lint
```

Manual/smoke validation:

- Start the app with `bun run dev`.
- In a run with Fortune active, advance acts and confirm the generic boon choice still appears and grants to hand.
- Clear the authored `OfferBoon` world card and confirm the same generic UI appears.
- Confirm `bToDiscard` behavior through tests; manual UI validation for discard destination is optional unless authored in world data.

Spec trace:

- Compare implementation against `.lore/work/specs/offer-boon-rewards.md` AI Validation items 1-12.
- Do not mark the spec implemented until every validation item is either passing or explicitly deferred with rationale.

## Risks And Decisions To Watch

- **Event naming churn:** This intentionally breaks act-specific names. Keep the migration complete rather than supporting duplicate action/event names unless compatibility pressure appears.
- **Degenerate RNG advancement:** Preserve the existing behavior from `createActBoonOffer`; tests should lock this down.
- **Multi-offer policy:** The spec says fail closed and no queue. Implementation should make this deterministic and testable.
- **No legal candidates:** Prefer no pending choice and no crash. Decide during implementation whether to emit no event or a diagnostic event; the spec leaves this open.
- **World-clear correlation:** Because `HazardResolved` is emitted after reward effects today, `BoonOffered` may appear before `HazardResolved` in the same batch. Tests should assert the batch has both and remains correlatable, not require a new event order unless implementation changes it deliberately.

## Not In This Plan

- Designing new boon pools beyond `fortune-v1`.
- Making permanent boon draft rewards.
- Adding a pending-choice queue.
- Rebalancing all world reward cards.
- Adding new art assets.
