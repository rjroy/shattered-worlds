---
title: Feat definitions and Memory Fragments
date: 2026-06-15
status: approved
tags: [feats, meta-progression, memory-fragments, run-summary, rewards, evaluation]
modules: [feats-profile, feat-evaluator, run-stats, run-summary-view, gameplay-runtime]
related:
  - .lore/work/specs/extended-run-telemetry.md
  - .lore/work/brainstorm/feat-definitions.md
  - .lore/reference/destiny-progression.html
  - .lore/work/issues/notes-on-memories.md
req-prefix: FEAT
---

# Feat definitions and Memory Fragments

## Context

The telemetry spec (`extended-run-telemetry.md`) established `FeatsProfile` storage and the `FeatsStore` interface, explicitly deferring feat condition definitions and evaluation logic. This spec fills that gap.

A feat is a named achievement with a set of conditions that must all hold at run end. When a player satisfies all conditions for a feat they have not yet earned, they receive a reward denominated in **Memory Fragments** — a global point balance used for future unlock purchases. Feats are one-time: once earned, a feat never triggers again.

The `gameplayRuntime` already creates and exposes `featsStore`, but no subscriber evaluates conditions against it. This spec wires that subscriber and defines the condition schema, static catalog, Memory Fragment balance derivation, and run-summary display changes.

## Scope

**In scope:**
- `FeatCondition`, `FeatDefinition`, `RewardItem`, `FeatReward` type definitions
- Stat ID namespace and resolution rules
- `EvaluationContext`, `evaluateCondition`, `evaluateFeat` pure functions
- `FeatEvaluator` subscriber, `lastRunEarned()` accessor
- Wiring `featEvaluator` into `gameplayRuntime` and `GameplayRuntime` interface
- `computeFragmentBalance` — derived, never stored
- `RunSummaryData.featsEarned` field and `RunSummaryView` display changes
- First-wave feat catalog (`src/data/feats/catalog.ts`)

**Out of scope:**
- Per-act breakdown tracking (needed for act-scoped feats; deferred)
- Unlock definitions and the fragment spend mechanic
- Displaying feat history or Memory Fragment balance outside the run-end summary
- Whiteout Parking Garage world (not yet implemented)

## File layout and the core/game boundary

The evaluator depends on runtime types (`RunRecord`, `LifetimeStats`, `WitnessProfile`, `FeatsStore`, `RunStatsReader`, `WitnessStore`, `Clock`, `RunStreamSubscriber`) that all live in `src/game/runtime/`. `src/core/**` is lint-forbidden from importing the game layer, so the evaluator is **not** core. Placement:

- `src/data/feats/types.ts` — `FeatCondition`, `RewardItem`, `FeatReward`, `FeatDefinition` (pure data types).
- `src/data/feats/catalog.ts` — `FEAT_CATALOG` and `computeFragmentBalance` (the latter type-imports `FeatsProfile` from `game/runtime`; a type-only cross-layer import, matching the existing precedent at `src/data/worlds/types.ts`).
- `src/game/runtime/featEvaluator.ts` — `EvaluationContext`, `FeatEvaluator`, `evaluateCondition`, `evaluateFeat`, `createFeatEvaluator`.

---

## Requirements

### Type definitions

**REQ-FEAT-1:** Define `FeatCondition`:

```typescript
type FeatCondition = {
  statId: string
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'is'
  value: number | string | boolean
}
```

**REQ-FEAT-2:** Define the `RewardItem` union and `FeatReward` alias:

```typescript
type RewardItem =
  | { type: 'memoryFragments'; amount: number }
  | { type: 'unlock'; id: string }

type FeatReward = RewardItem[]
```

The `unlock` member is dormant — no unlock catalog exists yet. Code that processes `RewardItem` arrays must skip items whose `type` it does not recognise, without error. This keeps the array extensible without future breaking changes.

**REQ-FEAT-3:** Define `FeatDefinition`:

```typescript
type FeatDefinition = {
  id: string
  name: string
  description: string
  conditions: FeatCondition[]
  reward: FeatReward
}
```

`conditions` is an implicit AND: all conditions must pass. An empty `conditions` array is trivially satisfied (useful for "win or lose any run" feats — note that abandoned runs never trigger evaluation per REQ-FEAT-11, so a truly empty-conditions feat fires on any non-abandoned outcome).

---

### Stat ID namespace

**REQ-FEAT-4:** A `statId` is a dot-delimited path resolved from an `EvaluationContext` (defined in REQ-FEAT-9). The supported namespaces are:

| `statId` pattern | Source | Notes |
|---|---|---|
| `outcome` | `RunRecord.outcome` | `'won' \| 'lost' \| 'abandoned'` |
| `worldId` | `RunRecord.worldId` | e.g. `'zombie-big-box'` |
| `turns` | `RunRecord.turns` | |
| `cardsPlayed` | `RunRecord.cardsPlayed` | |
| `progressDealt` | `RunRecord.progressDealt` | |
| `damageTaken` | `RunRecord.damageTaken` | |
| `hazardsResolved` | `RunRecord.hazardsResolved` | |
| `hazardsDiscarded` | `RunRecord.hazardsDiscarded` | |
| `cardsDiscarded` | `RunRecord.cardsDiscarded` | |
| `finalActIndex` | `RunRecord.finalActIndex` | |
| `activeDurationMs` | `RunRecord.activeDurationMs` | |
| `finalHp` | `RunRecord.finalHp` | optional — may be undefined |
| `healingReceived` | `RunRecord.healingReceived` | optional — may be undefined |
| `energy` | `RunRecord.finalResources?.energy` | optional — may be undefined |
| `light` | `RunRecord.finalResources?.light` | optional — may be undefined |
| `brace` | `RunRecord.finalResources?.brace` | optional — may be undefined |
| `lifetime.{field}` | `LifetimeStats[field]` | e.g. `lifetime.wins`, `lifetime.runs`, `lifetime.losses`, `lifetime.turns`, `lifetime.damageTaken`, `lifetime.durationMs` — all top-level numeric fields on `LifetimeStats` |
| `world.{field}` | `LifetimeStats.byWorld[run.worldId][field]` | e.g. `world.wins`, `world.runs` — scoped to the current run's world; resolves to `undefined` if the world has no `byWorld` entry |
| `witness.{templateId}.encounterCount` | `WitnessProfile.threats[templateId].encounterCount` | |
| `witness.{templateId}.diedTo` | `WitnessProfile.threats[templateId].diedTo` | boolean |

No other `statId` forms are valid. An unrecognised `statId` resolves to `undefined`. The `lifetime.{field}` and `world.{field}` namespaces are resolved by a generic dot-path lookup against `LifetimeStats` / `WorldStats`, so any real field on those objects is reachable (e.g. `world.fewestTurnsWin`). The non-numeric fields `lifetime.version`, `lifetime.byWorld`, and `lifetime.lastRun` are reachable too but harmless: numeric operators against a non-number fail-closed (REQ-FEAT-6), and no catalog feat references them. Implementations need not special-case them.

**REQ-FEAT-5:** If a `statId` resolves to `undefined` (absent optional field, unrecognised path, or a `world.*` stat for a `worldId` not yet in `byWorld`), the condition evaluates to `false` and the feat is not earned for that run. Silent resolution failure never throws.

---

### Condition evaluation

**REQ-FEAT-6:** Operator semantics:

| Operator | Applies when | Passes when |
|---|---|---|
| `gte` | resolved and value are both `number` | resolved >= value |
| `lte` | resolved and value are both `number` | resolved <= value |
| `gt` | resolved and value are both `number` | resolved > value |
| `lt` | resolved and value are both `number` | resolved < value |
| `eq` | any type | `resolved === value` (strict equality) |
| `is` | string or boolean | `resolved === value` (strict equality; intended for `outcome`, `worldId`, `diedTo`) |

If a numeric operator is used and either the resolved value or `condition.value` is not a `number`, the condition evaluates to `false`. If `is` is used against a `number`, the condition evaluates to `false`. These fail-closed rather than throw.

**REQ-FEAT-7:** Export a pure function:

```typescript
function evaluateCondition(condition: FeatCondition, ctx: EvaluationContext): boolean
```

It resolves `condition.statId` from `ctx`, applies `condition.operator` against `condition.value`, and returns the result per REQ-FEAT-6 semantics.

**REQ-FEAT-8:** Export a pure function:

```typescript
function evaluateFeat(definition: FeatDefinition, ctx: EvaluationContext): boolean
```

Returns `true` when all conditions pass (`conditions.every(c => evaluateCondition(c, ctx))`). An empty `conditions` array returns `true`.

---

### EvaluationContext and FeatEvaluator

**REQ-FEAT-9:** Define `EvaluationContext`:

```typescript
type EvaluationContext = {
  run: RunRecord
  witness: WitnessProfile
  lifetime: LifetimeStats
}
```

**REQ-FEAT-10:** Define `FeatEvaluator`:

```typescript
interface FeatEvaluator {
  readonly subscriber: RunStreamSubscriber
  lastRunEarned(): readonly FeatDefinition[]
}
```

`lastRunEarned()` returns the feat definitions earned in the most recently completed run (both won and lost; not abandoned). It resets to `[]` on each new `RunStarted`. Its value is stable between `RunEnded` and the next `RunStarted`, so the summary screen can read it after run close.

**REQ-FEAT-11:** Export a factory:

```typescript
function createFeatEvaluator(
  catalog: readonly FeatDefinition[],
  featsStore: FeatsStore,
  runStats: RunStatsReader,
  witnessStore: WitnessStore,
  clock: Clock,
): FeatEvaluator
```

On `RunEnded` (for outcomes `won` or `lost` only — not `abandoned`):

1. Build `EvaluationContext` from `runStats.lifetime()` and `witnessStore.getProfile()`. Both `runStats` and `witnessStore` have already processed this `RunEnded` (subscriber order guarantee from REQ-FEAT-13), so `runStats.lifetime().lastRun` is the just-completed run. If `runStats.lifetime().lastRun` is `undefined` when `RunEnded` fires, skip evaluation, log a warning, and return. (Subscriber ordering makes this impossible in production, but the guard prevents silent context corruption.)
2. For each `FeatDefinition` in `catalog`, skip if `featsStore.getProfile().earned` already contains that `featId`.
3. Call `evaluateFeat(definition, ctx)`. If `true`, call `featsStore.appendFeat({ featId: definition.id, earnedAt: clock(), sessionId: runEndedItem.sessionId })` (where `runEndedItem` is the `RunEnded` stream item) and record the definition in `lastRunEarned`.

Abandoned runs do not trigger any evaluation. `lastRunEarned` is not updated for abandoned runs.

---

### GameplayRuntime wiring

**REQ-FEAT-12:** `GameplayRuntime` interface gains a `featEvaluator: FeatEvaluator` field.

**REQ-FEAT-13:** In `createGameplayRuntime`, `featEvaluator` is created with `createFeatEvaluator(FEAT_CATALOG, featsStore, runStats, witnessStore, clock)` and subscribed to the stream after `witnessStore.subscriber`:

```
stream.subscribe(runStats.subscriber)        // 1st
stream.subscribe(witnessStore.subscriber)    // 2nd
stream.subscribe(featEvaluator.subscriber)   // 3rd — sees updated runStats and witness
```

This order ensures `runStats.lifetime().lastRun` and `witnessStore.getProfile()` already reflect the just-ended run when feat conditions are evaluated.

Note: `createGameplayRuntime` also has an existing anonymous subscriber that removes the ended session from `openSessions` on `RunEnded`. `featEvaluator.subscriber` only needs to run after `runStats.subscriber` and `witnessStore.subscriber`; its order relative to the `openSessions` cleanup is irrelevant. Subscribe `featEvaluator.subscriber` immediately after `witnessStore.subscriber` and leave the cleanup lambda where it is.

The `clock` argument is `Clock` (required). The call site resolves the fallback: `createFeatEvaluator(FEAT_CATALOG, featsStore, runStats, witnessStore, options.clock ?? Date.now)`.

---

### Memory Fragment balance

**REQ-FEAT-14:** Memory Fragment rewards are **not** stored separately. The balance is derived at read time from `FeatsProfile` and the catalog:

```typescript
function computeFragmentBalance(
  profile: FeatsProfile,
  catalog: readonly FeatDefinition[],
): number
```

For each `FeatRecord` in `profile.earned`, find its `FeatDefinition` in `catalog`, sum all `RewardItem`s of `type: 'memoryFragments'`. Return the total. Feat IDs in `earned` that have no matching definition contribute 0 (forward-compatibility guard for removed or renamed feats).

Export `computeFragmentBalance` from `src/data/feats/catalog.ts`.

---

### RunSummaryView changes

**REQ-FEAT-15:** `RunSummaryData` gains one new field:

```typescript
featsEarned: readonly FeatDefinition[]
```

When empty, the panel renders exactly as today.

**REQ-FEAT-16:** In `TableScene.buildRunSummaryData()`, populate `featsEarned` from `this.runtime_.featEvaluator.lastRunEarned()`.

**REQ-FEAT-17:** When `featsEarned` is non-empty, `RunSummaryView.show()` inserts a feats section below the records badge (or below the last stat row, at **y=104** — i.e. `-92 + 7*28`, the actual last stat row — when no records badge is shown). Each feat occupies one row: feat name left-aligned, Memory Fragment reward right-aligned (sum of all `memoryFragments` `RewardItem`s for that definition, formatted as e.g. `+10 Fragments`). Color: `TEXT.textReward`. Font: 14px, bold (intentionally 1px smaller than the 15px stat rows). Row height: 22px. First feat row starts at y = (records badge y of 142, or last stat row y of 104) + 28.

**REQ-FEAT-18:** When feats are present, the inner panel `Rectangle` (620×430) and the corner `Graphics` frame grow **downward only — the top edge stays fixed at y=-215** and the box extends down under the existing title/stats. Let `continueY` be the "Tap to continue" y (REQ-FEAT-19 places it at `max(184, lastFeatRowY + 28)`, satisfying "at least 24px below the last feat row") and `bottomEdge = continueY + 31` (preserving the current 31px bottom margin). Then:

- `panelHeight = bottomEdge + 215`, rounded up to the nearest even pixel; the `Rectangle` is re-created at local `(0, (bottomEdge - 215) / 2)` so its top edge stays at -215.
- frame rect: `strokeRect(-286, -186, 572, bottomEdge + 157)` (top inset unchanged).
- corner circles: top two unchanged at `(±260, -160)`; bottom two move to `(±260, bottomEdge - 55)` (preserving the 55px corner inset).

At zero feats this collapses to the original `(0,0)` / 430px panel, byte-identical to today. There is no scroll: this panel shows only feats earned in the just-ended run, bounded by the 11-feat catalog and capped per REQ-FEAT-19.

**REQ-FEAT-19:** If more than 4 feats are earned in a single run, the first 4 are shown by name and an additional row reads `+ N more` (plain style, `TEXT.textMuted`) where N is the remainder. This guards against layout overflow, not an expected flow.

---

### Static feat catalog

**REQ-FEAT-20:** Define all feat definitions in `src/data/feats/catalog.ts` as `export const FEAT_CATALOG: readonly FeatDefinition[]`. This is the single source of truth. No feat is evaluated unless it appears here.

**REQ-FEAT-21:** Feat IDs are kebab-case strings, unique within the catalog. A unit test asserts that no `id` appears more than once in `FEAT_CATALOG`.

**REQ-FEAT-22:** The initial catalog contains at least the following entries:

| `id` | `name` | Conditions | Fragments |
|---|---|---|---|
| `first-survivor` | First Survivor | `outcome is won` | 10 |
| `swift-clear` | Swift Clear | `outcome is won`, `turns lt 10` | 20 |
| `iron-will` | Iron Will | `outcome is won`, `finalHp gte 20` | 15 |
| `last-breath` | Last Breath | `outcome is won`, `finalHp lte 3` | 25 |
| `no-healing` | Pacifist | `outcome is won`, `healingReceived eq 0` | 25 |
| `century-push` | Century | `progressDealt gte 100` | 15 |
| `energy-hoard` | Energy Hoard | `outcome is won`, `energy gte 10` | 20 |
| `light-keeper` | Light Keeper | `outcome is won`, `worldId is fog-beach-party`, `light gte 10` | 25 |
| `brace-master` | Brace Master | `outcome is won`, `worldId is bird-building`, `brace gte 10` | 25 |
| `veteran` | Veteran | `lifetime.runs gte 10` | 30 |
| `conqueror` | Conqueror | `lifetime.wins gte 5` | 40 |

`century-push` intentionally has no `outcome` condition — it can be earned on a lost run if the player dealt enough progress.

`veteran` and `conqueror` use lifetime scope, demonstrating that cross-run feats evaluate correctly when `runStats.lifetime()` reflects the just-completed run.

---

## AI Validation

1. **Type check.** `tsc --noEmit` passes with `FeatCondition`, `FeatDefinition`, `RewardItem`, `FeatReward`, `EvaluationContext`, and `FeatEvaluator` defined, and `RunSummaryData.featsEarned` and `GameplayRuntime.featEvaluator` added.

2. **`evaluateCondition` — numeric operators.** Unit test: condition `{ statId: 'turns', operator: 'lte', value: 9 }` against `ctx.run.turns = 8` returns `true`; against `turns = 10` returns `false`.

3. **`evaluateCondition` — `is` operator.** Condition `{ statId: 'outcome', operator: 'is', value: 'won' }` returns `true` when `run.outcome === 'won'` and `false` when `'lost'`.

4. **`evaluateCondition` — undefined stat.** Condition against `finalHp` when `run.finalHp` is `undefined` returns `false` without throwing.

5. **`evaluateCondition` — type mismatch fail-closed.** Condition `{ statId: 'outcome', operator: 'gte', value: 1 }` (numeric operator against string) returns `false`.

6. **`evaluateFeat` — AND semantics.** A feat with two conditions passes only when both pass; fails when either fails.

7. **`evaluateFeat` — empty conditions.** A feat with `conditions: []` returns `true` for any context.

8. **`evaluateCondition` — dot-path resolution.** Condition `{ statId: 'lifetime.wins', operator: 'gte', value: 5 }` resolves `ctx.lifetime.wins` and compares correctly.

9. **`evaluateCondition` — witness path.** Condition `{ statId: 'witness.Zombie.encounterCount', operator: 'gte', value: 3 }` resolves `ctx.witness.threats['Zombie'].encounterCount`. Resolves to `undefined` (→ `false`) when `threats['Zombie']` is absent.

10. **`evaluateCondition` — `world.*` path.** Condition `{ statId: 'world.wins', operator: 'gte', value: 1 }` resolves `ctx.lifetime.byWorld[ctx.run.worldId].wins`. Returns `false` if the world has no entry in `byWorld`.

11. **Feat earned on run end.** Run a session that satisfies `first-survivor` (`outcome is won`). After `RunEnded`, assert `featsStore.getProfile().earned` contains a record whose `featId === 'first-survivor'` (match on `featId` via `.find`/`toMatchObject` — the `FeatRecord` also carries `earnedAt` and `sessionId`, so exact-object equality will not match) and `featEvaluator.lastRunEarned()` returns the `first-survivor` definition.

12. **Feat not re-earned.** Earn `first-survivor` once. Run a second winning session. Assert `featsStore.getProfile().earned` still contains exactly one `first-survivor` entry.

13. **Abandoned run skips evaluation.** Run a session, abandon it. Assert `featEvaluator.lastRunEarned()` is empty and `featsStore.getProfile().earned` is unchanged.

14. **Subscriber order respected.** Two parts. (a) Inject a stub `RunStatsReader` returning a pre-populated `LifetimeStats` with `lastRun` set, and assert `evaluateFeat` runs against a context whose `lifetime.lastRun` is that run (proves the evaluator reads `runStats.lifetime()` at `RunEnded` time, not stale state). (b) Through the real `createGameplayRuntime`, run a winning session end-to-end and assert a feat that depends on the just-ended run's data is earned — proving the real `runStats.subscriber` ran before `featEvaluator.subscriber` so `lastRun` was populated in time.

15. **`computeFragmentBalance`.** A `FeatsProfile` with `first-survivor` and `swift-clear` earned returns `10 + 20 = 30`. An entry in `earned` with no matching catalog definition contributes 0.

16. **Catalog uniqueness.** Unit test: iterate `FEAT_CATALOG` and assert no `id` appears more than once.

17. **RunSummaryView — feats shown.** Call `runSummary.show()` with `featsEarned: [firstSurvivorDef]`. Assert the panel contains a text element with the feat name `'First Survivor'` and a text element with `'+10 Fragments'`. Assert the "Tap to continue" text element's y is at least 24px greater than the feat row's y.

18. **RunSummaryView — no feats, no section.** Call `show()` with `featsEarned: []`. Assert no feat-related text elements are added (panel identical to current behaviour).

19. **RunSummaryView — overflow guard.** Call `show()` with 6 feats in `featsEarned`. Assert exactly 4 feat rows are rendered and a `'+ 2 more'` row is present.

20. **`no-healing` feat.** Finish a winning run with `healingReceived === 0`. Assert `no-healing` is in `lastRunEarned()`. Finish a second run with healing. Assert `no-healing` does not re-appear.

21. **`century-push` on a lost run.** Finish a run with `outcome: 'lost'` and `progressDealt >= 100`. Assert `century-push` is earned despite the loss.

22. **`veteran` feat — cross-run.** Simulate lifetime stats where `runs === 9`, then complete one more run (any outcome). Assert `veteran` is earned on the 10th run.

23. **`light-keeper` world-scoped.** Finish a `fog-beach-party` run with `outcome: 'won'` and `light >= 10`. Assert `light-keeper` is earned. Finish an `outcome: 'won'` run on `zombie-big-box` (light will be 0 or absent). Assert `light-keeper` is not earned.
