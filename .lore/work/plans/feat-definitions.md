---
title: "Implementation plan: feat definitions and Memory Fragments"
date: 2026-06-15
status: approved
tags: [plan, feats, meta-progression, memory-fragments, run-summary, evaluation]
modules: [feats-profile, feat-evaluator, run-stats, run-summary-view, gameplay-runtime]
related:
  - .lore/work/specs/feat-definitions.md
  - .lore/work/specs/extended-run-telemetry.md
  - .lore/work/brainstorm/feat-definitions.md
---

# Implementation plan: feat definitions and Memory Fragments

Source artifact: [.lore/work/specs/feat-definitions.md](../specs/feat-definitions.md) (REQ-FEAT-1 .. REQ-FEAT-23).

This plan wires a feat-evaluation subscriber into the existing `gameplayRuntime` event stream, defines the condition schema and static catalog, derives the Memory Fragment balance, and extends the run-end summary panel. The telemetry spec already shipped `FeatsProfile`, `FeatRecord`, and `FeatsStore` (`createFeatsStore`); this plan is the consumer that was deferred there.

## Spec validation — folded-in corrections

A fresh-eyes review of the spec against the live codebase confirmed the type shapes the spec assumes all exist and match (`FeatRecord`, `FeatsProfile`, `FeatsStore`, `RunRecord`, `LifetimeStats`, `RunStatsReader`, `WitnessProfile`, `WitnessStore`, `RunStreamSubscriber`, `RunEnded.sessionId`, `Clock`). The following imprecisions were found and are corrected in this plan:

- **REQ-FEAT-17 anchor coordinate is wrong.** The spec says the feats section anchors "at y=110" when no records badge is shown. The actual last stat row is `y = -92 + 7*28 = 104` (`RunSummaryView.ts:110`). This plan uses **y=104**, not 110.
- **REQ-FEAT-13 subscriber list is incomplete.** `createGameplayRuntime` already has a *third* anonymous subscriber that deletes the ended session from `openSessions` (`gameplayRuntime.ts:79-83`). The spec's three-line diagram omits it. `featEvaluator.subscriber` only needs to run after `runStats.subscriber` and `witnessStore.subscriber`; its order relative to the `openSessions` cleanup lambda is irrelevant. This plan subscribes it immediately after `witnessStore.subscriber`.
- **REQ-FEAT-18 corner-circle behavior is unspecified.** The frame's four corner circles are hardcoded at `(±260, ±160)`. When the panel grows they must move to stay in the corners. This plan derives them proportionally from the panel half-height (see Step 6) rather than leaving them fixed.
- **Module placement is unspecified, and the obvious guess is wrong.** The evaluator depends on runtime types that live in `src/game/runtime/`, and `src/core/**` is lint-forbidden from importing the game layer (`eslint.config.js:20-38`). The evaluator therefore lives in `src/game/runtime/`, **not** `src/core/`. See "Architecture decisions" below.
- **Resolver quirk (accepted).** REQ-FEAT-4 says `lifetime.*` resolves "all top-level numeric fields." A generic dot-path resolver also resolves `lifetime.version` (a literal `2`). No catalog feat uses it and the semantics are harmless (fail-closed everywhere else), so this plan implements a generic resolver and documents the quirk in a code comment rather than special-casing it.
- **Validation tests 11 and 14 are restated** (see Step 3) so they assert against the real `FeatRecord` shape (`{ featId, earnedAt, sessionId }`) and against `ctx.lifetime.lastRun` rather than call-timestamp ordering.

None of these block implementation. They are pixel/wording corrections plus one module-boundary call. They are listed here so validation has the corrected targets to check against.

## Architecture decisions

**Where each piece lives, and why.**

| Artifact | File | Layer | Rationale |
|---|---|---|---|
| `FeatCondition`, `RewardItem`, `FeatReward`, `FeatDefinition` | `src/data/feats/types.ts` (new) | data | Pure data types, no runtime dependencies. Catalog data lives in `src/data/`. |
| `FEAT_CATALOG`, `computeFragmentBalance` | `src/data/feats/catalog.ts` (new) | data | Spec REQ-FEAT-20/27 fix this location. `computeFragmentBalance` takes `FeatsProfile` as a **type-only** import from `game/runtime` — an established pattern (`src/data/worlds/types.ts:14` already type-imports from `game/view`). |
| `EvaluationContext`, `FeatEvaluator`, `evaluateCondition`, `evaluateFeat`, `createFeatEvaluator` | `src/game/runtime/featEvaluator.ts` (new) | game/runtime | Depends on `RunRecord`, `LifetimeStats`, `WitnessProfile`, `FeatsStore`, `RunStatsReader`, `WitnessStore`, `Clock`, `RunStreamSubscriber` — all in `game/runtime`. Cannot be `core` (lint boundary). Mirrors the colocated-types-plus-factory shape of `runStats.ts` / `witnessProfile.ts`. |

**Dependency direction (no runtime cycle):** `gameplayRuntime.ts` imports `FEAT_CATALOG` (value) from `data/feats/catalog.ts` and `createFeatEvaluator` (value) from `featEvaluator.ts`. `featEvaluator.ts` type-imports `FeatDefinition` from `data/feats/types.ts`. `catalog.ts` type-imports `FeatsProfile` from `game/runtime/featsProfile.ts`. All cross-layer imports into `data/` are `import type`, which is erased at build time, so there is no value-level cycle.

## Implementation steps

Ordered by dependency. Each step ends with a **Gate** that must pass before the next begins.

### Step 1 — Pure types + catalog + fragment balance

New files: `src/data/feats/types.ts`, `src/data/feats/catalog.ts`.

- `types.ts`: define `FeatCondition` (REQ-FEAT-1), `RewardItem` union + `FeatReward` (REQ-FEAT-2), `FeatDefinition` (REQ-FEAT-3). Exact shapes per spec.
- `catalog.ts`: define `export const FEAT_CATALOG: readonly FeatDefinition[]` with all 11 entries from REQ-FEAT-22; define and export `computeFragmentBalance(profile, catalog)` (REQ-FEAT-14) summing `memoryFragments` reward items for earned feats, skipping `earned` IDs with no matching definition. `computeFragmentBalance` must skip unrecognised `RewardItem.type` values without error (REQ-FEAT-2 forward-compat).

New test: `src/data/feats/catalog.test.ts`.

> **Gate:** `bun run test src/data/feats/catalog.test.ts` passes. Covers: catalog `id` uniqueness (REQ-FEAT-21, validation #16); `computeFragmentBalance` returns `30` for `{first-survivor, swift-clear}` and contributes `0` for an unknown earned id (validation #15).

### Step 2 — Pure condition evaluation

New file: `src/game/runtime/featEvaluator.ts` (evaluation half only).

- Define `EvaluationContext` (REQ-FEAT-9): `{ run: RunRecord, witness: WitnessProfile, lifetime: LifetimeStats }`.
- Implement a private `resolveStat(statId, ctx): unknown` per the REQ-FEAT-4 namespace table. Handle the fixed `run.*` leaves (`outcome`, `worldId`, `turns`, …, `finalHp`, `healingReceived`), `energy|light|brace` from `run.finalResources?.[k]`, the `lifetime.{field}` / `world.{field}` / `witness.{templateId}.{field}` dot-paths, and return `undefined` for anything unrecognised (REQ-FEAT-5). Document the `lifetime.version` quirk in a comment.
- Implement `evaluateCondition(condition, ctx): boolean` (REQ-FEAT-7) with the REQ-FEAT-6 operator table: numeric operators (`gte/lte/gt/lt`) fail-closed unless both resolved and `value` are numbers; `eq`/`is` strict-equal; `is` against a number fails-closed; undefined resolution → `false`; never throws.
- Implement `evaluateFeat(definition, ctx): boolean` (REQ-FEAT-8): `conditions.every(...)`, empty array → `true`.

New test: `src/game/runtime/featEvaluator.test.ts` (evaluation cases).

> **Gate:** `bun run test src/game/runtime/featEvaluator.test.ts` passes the pure-function cases: validation #2 (numeric `lte`), #3 (`is` on outcome), #4 (undefined `finalHp` → false), #5 (numeric op on string → false), #6 (AND semantics), #7 (empty conditions → true), #8 (`lifetime.wins` dot-path), #9 (`witness.Zombie.encounterCount`, absent → false), #10 (`world.wins`, absent world → false).

### Step 3 — FeatEvaluator subscriber + factory

Same file `src/game/runtime/featEvaluator.ts` (subscriber half).

- Define `FeatEvaluator` interface (REQ-FEAT-10): `readonly subscriber: RunStreamSubscriber`; `lastRunEarned(): readonly FeatDefinition[]`.
- Implement `createFeatEvaluator(catalog, featsStore, runStats, witnessStore, clock): FeatEvaluator` (REQ-FEAT-11):
  - Maintain a mutable `lastEarned: FeatDefinition[]`. On `RunStarted`, reset to `[]`. On `RunEnded`, only for outcome `won|lost` (skip `abandoned` entirely — do not reset on abandon, do not evaluate).
  - On a qualifying `RunEnded`: read `runStats.lifetime()` once; if `lifetime.lastRun` is `undefined`, log a warning and return (defensive guard, not reachable in production due to subscriber order). Read `witnessStore.getProfile()` once. Build `EvaluationContext { run: lifetime.lastRun, witness, lifetime }`.
  - For each catalog definition not already in `featsStore.getProfile().earned` (by `featId`), call `evaluateFeat`; on `true`, `featsStore.appendFeat({ featId, earnedAt: clock(), sessionId: item.sessionId })` and push the definition into `lastEarned`.
  - `lastRunEarned()` returns the array; stable between `RunEnded` and the next `RunStarted`.

Add to `src/game/runtime/featEvaluator.test.ts` (integration cases). Because Step 3 precedes the `gameplayRuntime` wiring (Step 4), these tests build the stream by hand: `createGameplayEventStream()`, subscribe `runStats.subscriber`, `witnessStore.subscriber`, `featEvaluator.subscriber` in that order, then emit `RunStarted` / `RunEnded` items directly. `runStats.test.ts` and `witnessProfile.test.ts` demonstrate this hand-built-stream pattern. (The end-to-end real-runtime flow is Step 4's wiring test.)

> **Gate:** `bun run test src/game/runtime/featEvaluator.test.ts` passes the subscriber cases:
> - #11 (restated): after a winning run, `featsStore.getProfile().earned` contains an entry where `featId === 'first-survivor'` (assert via `.find`/`toMatchObject`, not exact-equality — the record also has `earnedAt` and `sessionId`), and `lastRunEarned()` includes the `first-survivor` definition.
> - #12 (not re-earned across two wins), #13 (abandoned → `lastRunEarned()` empty and `earned` unchanged), #20 (`no-healing`), #21 (`century-push` on a loss), #22 (`veteran` cross-run via lifetime with `runs===9`), #23 (`light-keeper` world-scoped: earned on `fog-beach-party` win with `light>=10`, not earned on `zombie-big-box`).
> - #14 (restated): inject a stub `RunStatsReader` returning a pre-populated `LifetimeStats` with `lastRun` set; assert `evaluateFeat` ran against a context whose `lifetime.lastRun` is that run (proves the evaluator reads post-`RunEnded` state, not stale state).

### Step 4 — Wire into gameplayRuntime

Edit `src/game/runtime/gameplayRuntime.ts`:

- Add `readonly featEvaluator: FeatEvaluator` to the `GameplayRuntime` interface (REQ-FEAT-12).
- In `createGameplayRuntime`, after `featsStore` is created, add `const featEvaluator = createFeatEvaluator(FEAT_CATALOG, featsStore, runStats, witnessStore, options.clock ?? Date.now)`. **Clock convention (decided):** `createFeatEvaluator`'s signature is `clock: Clock` (required, per REQ-FEAT-11), so the call site resolves the fallback — pass `options.clock ?? Date.now`. The factory does **not** accept `Clock | undefined`. (`createRunStatsCollector` resolves the fallback internally instead; both are valid, but the spec fixes the evaluator's signature as required, so the call site resolves.) Pass `Date.now` as the function reference (not a captured timestamp) so `clock()` is evaluated at run-end.
- Subscribe in order (REQ-FEAT-13): `runStats.subscriber`, then `witnessStore.subscriber`, then `featEvaluator.subscriber`, leaving the existing `openSessions` cleanup lambda where it is.
- Add `featEvaluator` to the returned object.

Add a wiring test to `src/game/runtime/gameplayRuntime.test.ts`: a full `startSession → win → RunEnded` flow asserts `runtime.featEvaluator.lastRunEarned()` contains `first-survivor` after the run closes, proving the subscriber-order guarantee end-to-end through the real composition root.

> **Gate:** `bun run test src/game/runtime/gameplayRuntime.test.ts` passes, including the new wiring test. `tsc --noEmit` clean (`GameplayRuntime.featEvaluator` present).

### Step 5 — RunSummaryData + TableScene population

- Edit `src/game/view/RunSummaryView.ts`: add `readonly featsEarned: readonly FeatDefinition[]` to `RunSummaryData` (REQ-FEAT-15), importing `FeatDefinition` as a type.
- Edit `src/game/scenes/TableScene.ts` `buildRunSummaryData()` (`TableScene.ts:417`): populate `featsEarned: this.runtime_.featEvaluator.lastRunEarned()` (REQ-FEAT-16). Note `buildRunSummaryData()` returns `null` when `lastRun` is undefined; the feats field is only read on the non-null path, so no extra guard is needed.

> **Gate:** `tsc --noEmit` clean. Existing TableScene/runtime tests still green (`bun run test`).

### Step 6 — RunSummaryView feats section + panel growth

Edit `RunSummaryView.show()` (`RunSummaryView.ts:62-148`). All coordinates are relative to the container center `(0,0)`.

Layout rules (REQ-FEAT-17/18/19), with the corrected anchor:

- `anchor = recordLabels.length > 0 ? 142 : 104`.
- Determine rendered rows: if `featsEarned.length <= 4`, render one row per feat; if `> 4`, render the first 4 feats plus one `"+ N more"` row where `N = featsEarned.length - 4` (REQ-FEAT-19, style `TEXT.textMuted`, not bold). Let `rowCount` = rendered rows (feats capped at 4, plus the optional overflow row → max 5).
- Feat rows: `y = anchor + 28 + i * 22`. Feat name left-aligned at `x=-220` origin `(0,0.5)`; reward right-aligned at `x=220` origin `(1,0.5)` formatted `+{sum} Fragments` (sum of all `memoryFragments` reward items for that definition). Color `TEXT.textReward`, 14px bold (per spec; note this is 1px smaller than the 15px stat rows — intentional secondary emphasis).
- `lastFeatRowY = anchor + 28 + (rowCount - 1) * 22`.
- Move "Tap to continue" from its fixed `y=184` to `continueY = max(184, lastFeatRowY + 28)` (satisfies "≥24px below last feat row").
- **Panel growth — downward only, top edge fixed** when `featsEarned.length > 0`. The top edge stays at its current `y=-215`; the box extends *down* under the existing title/stats. Let `bottomEdge = continueY + 31` (preserves the current 31px bottom margin: when no feats, continue=184 → edge=215). Then:
  - `panelHeight = bottomEdge + 215`, rounded up to the nearest even pixel.
  - `panelCenterY = (bottomEdge - 215) / 2` (recreate the panel `Rectangle` at local `(0, panelCenterY)` with `panelHeight`, re-applying stroke + rounded corners). At zero feats this is `(0, 0)` / 430px — byte-identical to today.
  - frame rect: `strokeRect(-286, -186, 572, bottomEdge + 157)` (top inset unchanged at -186; bottom inset stays 29px above the new bottom edge).
  - corner circles: top two unchanged at `(±260, -160)`; bottom two at `(±260, bottomEdge - 55)` (preserves the 55px corner inset; resolves the corner-circle ambiguity). x unchanged because width is unchanged.
- **Deviation from REQ-FEAT-18's additive formula (intentional, folded into the spec patch).** The spec's `height = 430 + featRows*22` assumes symmetric growth and ignores the records-badge anchor shift. This plan derives height from actual laid-out coordinates so the box is guaranteed to contain the continue text and bottom margin in both the records-present and records-absent cases. The spec's REQ-FEAT-18 is being updated to describe downward growth and this coordinate-derived height (Open Decision #2, now resolved).
- When `featsEarned` is empty, none of the above runs and the panel renders byte-identical to today (REQ-FEAT-17/18 "renders exactly as today").

New test: `src/game/view/RunSummaryView.test.ts` (first view test — see Step 6 note on harness below).

> **Gate:** `bun run test src/game/view/RunSummaryView.test.ts` passes:
> - #17: `show()` with `[firstSurvivorDef]` adds a text element reading `First Survivor` and one reading `+10 Fragments`; the continue text's `y` is ≥24px greater than the feat row's `y`.
> - #18: `show()` with `featsEarned: []` adds no feat text elements (assert the child list matches the no-feats baseline).
> - #19: `show()` with 6 feats renders exactly 4 feat-name rows plus a `+ 2 more` row.

**Harness note:** there is no existing `src/game/view/*.test.ts`, but `RunSummaryView` already constructs cleanly under the `testSetup.ts` canvas stub (the runtime tests import Phaser fine). Step 6 must first prove a `RunSummaryView` can be instantiated headlessly (build a minimal `Phaser.Scene` or a lightweight scene stub exposing `.add.text/.rectangle/.graphics/.existing/.time.delayedCall`) and assert against `view.list`. If a real `Phaser.Scene` proves impractical headlessly, inject a scene-shaped stub — this is the seam. Resolve this before writing the three assertions; do not weaken the assertions to fit a broken harness.

### Step 7 — Final validation

> **Gate (full):**
> 1. `tsc --noEmit` clean — all new types present (validation #1).
> 2. `bun run lint` clean — confirms the core/game boundary holds (no `src/core` file imports the new evaluator; the evaluator correctly sits in `game/runtime`).
> 3. `bun run test` — entire suite green, no pre-existing failures masked.
> 4. Spec cross-check: walk REQ-FEAT-1 .. REQ-FEAT-22 (the spec has 22 requirements) and confirm each is satisfied or explicitly deferred per the spec's Out-of-scope list. Confirm all 23 AI-validation items are covered by a test or by the type-check. Note validation #14 spans two steps: the stub-reader half (evaluator reads post-`RunEnded` state) is Step 3's gate; the real-ordering half (proving `runStats.subscriber` ran before `featEvaluator.subscriber`) is Step 4's wiring test.
> 5. **Manual browser check** of the expanded summary panel (the panel-growth geometry is the one thing tests can confirm numerically but not visually). Win a run that earns ≥1 feat, then earn ≥5 in one run (via a seeded/forced scenario) and confirm the panel, frame, corner circles, feat rows, and "Tap to continue" all sit correctly and nothing clips. This mirrors the existing REQ-VIS-18 manual-verification precedent.

## Resolved decisions

1. **Panel-growth geometry → downward, top edge fixed.** The panel extends down under the existing title/stats (top stays at `y=-215`); see Step 6. No scroll: this panel shows only feats *earned in the just-ended run* (`lastRunEarned()`), bounded by the 11-feat catalog and capped at 4 rows + `+ N more` (REQ-FEAT-19). A scrollable browsable feat **history** with running fragment balance is a separate, future view (out of scope per the spec).
2. **Spec patched + approved.** Status moved to `approved`; the imprecisions above (y=104, subscriber-order note, downward growth + corner circles, module/boundary placement, resolver quirk, validation #11/#14 restatement) are written into the spec so spec and plan agree.
