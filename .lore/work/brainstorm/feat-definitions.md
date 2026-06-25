---
title: Feat definitions and Memory Fragments
date: 2026-06-15
status: open
tags: [feats, meta-progression, memory-fragments, run-summary, rewards]
modules: [feats-profile, run-stats, run-summary-view]
related:
  - .lore/work/specs/extended-run-telemetry.md
  - .lore/work/brainstorm/shattered-worlds-meta-progression.md
---

# Feat definitions and Memory Fragments

## Starting point

The telemetry spec (`extended-run-telemetry.md`) established `FeatsProfile` (schema and storage) but explicitly deferred feat condition definitions and evaluation logic. This brainstorm explores what we need to make feat definitions work.

User's anchor: a feat is a **stat ID + operator + numeral**, rewarding some number of **Memory Fragments**. Unlocks may be a reward type later but don't exist yet.

---

## Code validation

Both questions from the brainstorm were confirmed against the code before saving.

**`RunRecord.worldId` exists** (line 29 of `runStats.ts`) — no prereq refactor needed for world-scoped feats.

**`LifetimeStats` queryable fields** — full inventory:

| Scope | Field | Notes |
|---|---|---|
| Per-run | `outcome` | `won` / `lost` / `abandoned` |
| Per-run | `worldId` | present on RunRecord |
| Per-run | `turns`, `cardsPlayed`, `progressDealt` | |
| Per-run | `damageTaken`, `hazardsResolved`, `hazardsDiscarded`, `cardsDiscarded` | |
| Per-run | `finalHp`, `healingReceived`, `finalResources` (energy/light/brace) | optional; new from telemetry spec |
| Per-run | `activeDurationMs` | |
| Lifetime | `runs`, `wins`, `losses`, `abandoned` | |
| Lifetime | `turns`, `cardsPlayed`, `progressDealt`, `damageTaken` | cumulative, completed runs only |
| Lifetime | `hazardsResolved`, `hazardsDiscarded`, `cardsDiscarded`, `durationMs` | |
| Per-world | `wins`, `losses`, `runs`, `abandoned` | via `byWorld[worldId]` |
| Per-world | `fewestTurnsWin`, `mostProgressInRun` | optional bests |

Plus `WitnessProfile`: `encounterCount` and `diedTo` per threat templateId. No data gaps for a first wave of feats.

---

## Condition schema

A feat condition is a **stat ID + operator + threshold value**. Multiple conditions on a single feat are implicitly AND'd — all must pass. OR logic is handled by defining a separate feat.

### Operators

For numeric stats: `gte`, `lte`, `gt`, `lt`, `eq`.

For categorical / boolean (`outcome`, `diedTo`): a separate `is` operator avoids forcing booleans into numerics. `eq` on `1`/`0` leaks representation into feat definitions and will confuse future authors.

`neq` might be useful but can be avoided (`healingReceived lte 0` beats `healingReceived neq 0`). Park for now.

### Stat ID space

Three natural scopes, and condition evaluation needs to know which scope to read from:

- **Per-run scalars** — evaluated against the just-completed `RunRecord`. Examples: `finalHp gte 20`, `healingReceived eq 0`, `outcome is won`, `worldId is fog-beach-party`.
- **Witness counters** — cross-run, keyed by threat name. Example: `witness.Zombie.encounterCount gte 10`, `witness.Zombie.diedTo is true`.
- **Lifetime counters** — cumulative. Example: `lifetime.wins gte 50`, `lifetime.byWorld.zombie-mall.wins gte 5`.

The dot-notation stat ID (e.g. `witness.Zombie.diedTo`, `lifetime.byWorld.zombie-mall.wins`) is a workable way to namespace these without separate condition types.

---

## Reward schema

Memory Fragments are a global point currency used to purchase unlocks. Not hooked up yet, but the schema needs to leave room for unlocks without requiring them.

### Option A — named fields

```typescript
type FeatReward = {
  memoryFragments: number
  unlock?: string  // unlock ID; undefined until unlocks exist
}
```

Simple, readable. Adding a second unlock type requires a new field.

### Option B — reward item union (preferred)

```typescript
type RewardItem =
  | { type: 'memoryFragments'; amount: number }
  | { type: 'unlock'; id: string }   // dormant until unlocks exist

type FeatReward = RewardItem[]
```

A new reward type is a new union member — additive, no schema change. Code that doesn't know about `unlock` yet can safely skip unknown item types. A feat with only Memory Fragments has a single-item array.

**Lean toward Option B.** The union list is the extensibility seam the user asked for.

---

## Feat definition shape (rough)

```typescript
type FeatCondition = {
  statId: string       // dot-path: 'finalHp', 'outcome', 'witness.Zombie.diedTo', 'lifetime.wins'
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'is'
  value: number | string | boolean
}

type FeatDefinition = {
  id: string
  name: string
  description: string
  conditions: FeatCondition[]   // all must pass (AND)
  reward: FeatReward
}
```

`conditions` is a flat list. Implicit AND covers 90% of feats at launch. OR = separate feat.

---

## Evaluator wiring

The evaluator needs three data sources at the moment of run-end:
- The just-finalized `RunRecord`
- The updated `WitnessProfile` (after witness collector runs)
- The current `LifetimeStats`

It runs **after** both run stats and witness are written (same ordering constraint as REQ-TELEM-25). The natural shape is a pure function:

```typescript
(definition: FeatDefinition, run: RunRecord, witness: WitnessProfile, lifetime: LifetimeStats) => boolean
```

Called for each un-earned feat after every run end. When it returns `true`, the evaluator appends a `FeatRecord` to `FeatsProfile` and persists. One-time check: if the feat is already in `earned`, skip evaluation entirely.

---

## Memory Fragments economy

Variable per-feat (harder condition = more fragments) is the right default. No tiers needed until the spend side exists. A number in the feat definition is sufficient.

---

## Run summary page — showing earned feats

`RunSummaryView` is a fixed 620×430px Phaser panel. Current layout:
- Stat rows: y = -92 to y = 110 (8 rows × 28px)
- Records badge: y = 142
- "Tap to continue": y = 184
- Panel bottom: y = 215

Feats are **one-time unlocks** — once earned they can't be re-earned. Most runs will earn zero feats. That shapes which display approach makes sense.

### Option 1 — Inline after records (cheapest)

Add a labeled row per feat earned this run, below the records badge. Panel grows to fit. Cap at 3–4 rows before it looks wrong. Matches the existing records pattern.

### Option 2 — Scrollable zone

Dedicated scrollable region with a mask + inner container. Handles unlimited feats cleanly. ~60 lines of Phaser plumbing. Overkill for a first implementation.

### Option 3 — Second dismiss step

"X feats earned! Tap to see" shows a feats-specific card before the main dismiss. Good for high ceremony around feat unlocks, awkward for zero-feat runs.

**Lean toward Option 1 for first implementation.** Feats earned per run will be low at launch; scrolling can be added if the panel overflows in practice. The inline pattern is consistent with how records badges work today.

---

## Open questions

- Does the evaluator live at the `gameplayRuntime` composition root, or does it get its own module? (Probably own module, wired at the root like the witness collector.)
- How are `FeatDefinition`s registered? Static catalog in code, or data file? A static catalog in `src/data/feats/` matches the pattern used for world definitions.
- What's the first wave of feat IDs? Not decided here — this is schema and plumbing only.
- Memory Fragment spend mechanic: how do fragments get read and decremented? Likely a separate store alongside `FeatsProfile`.
