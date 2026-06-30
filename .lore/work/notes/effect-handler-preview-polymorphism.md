---
title: "Implementation notes: effect-handler-preview-polymorphism"
date: 2026-06-30
status: in_progress
tags: [implementation, notes, refactor, action-preview, effect-handler, polymorphism]
source: .lore/work/plans/effect-handler-preview-polymorphism.md
modules: [core-effects, action-preview, core-engine]
related: [.lore/work/plans/effect-handler-preview-summaries.md, .lore/reference/effect-system-extension-pattern.md]
---

# Implementation notes: effect-handler-preview-polymorphism

Behavior-preserving refactor: move `CardEffect` preview copy onto `EffectHandler`
subclasses via a new `previewEvent` method, stamp `sourceKind` on `GameEvent` at
the dispatch boundary, route effect-owned events through the existing `EFFECTS`
registry, and delete the parallel `EXTERNAL_PREVIEW_FORMATTERS` apparatus the
prior plan (commit `b0be8f2`) added. Every preview string must stay
byte-for-byte identical.

## Progress

- [x] Step 1 — Build the emitter topology from scratch (no code change)
- [x] Step 2 — Add the `previewEvent` seam
- [x] Step 3 — Stamp `sourceKind` at the dispatch boundary
- [x] Step 4 — Bridge the preview loop to `previewEvent`
- [x] Step 5 — Move copy onto handlers for effect-only events
- [ ] Step 6 — Handle dual-path events with a shared helper
- [ ] Step 7 — Delete the apparatus
- [ ] Step 8 — Tighten and document
- [ ] Final validation (holistic review against plan)

## Emitter topology table (filled by Step 1)

`dispatch()` boundary = `applyEffect` → `EFFECTS[effect.kind].apply(...)` at
`engine/effects.ts:109`. Composite handlers (Modal/Sequence) recurse through it.

| Event | Emit site(s) | Reaches dispatch? | Class |
|---|---|---|---|
| `KeywordApplied` | `appliedKeywords.ts:94` `applyToHandIds`←`ApplyKeywordHandler`; `draw.ts:129` `drawWorld`←`DrawHandler` (yes) AND ←`refillHand` turn-start (no) | mixed | **dual-path** |
| `KeywordRemoved` | `appliedKeywords.ts:228` `RemoveKeywordHandler` (yes); `appliedKeywords.ts:287` `tickAppliedKeywordsAtTurnStart`←`energy.ts:117` (no) | mixed | **dual-path** |
| `KeywordGuardConsumed` | `appliedKeywords.ts:168` `KeywordGateHandler.apply` | yes | **effect-only** |
| `keywordGuardChanged` | `resources.ts:117` `GainKeywordGuardHandler.apply` | yes | **effect-only** |
| `DamageDealt` | `damage.ts:23` `damage()`←`DamageHandler` & `DamageScaledHandler` only | yes | **effect-only** |
| `HealReceived` | `resources.ts:36` `heal()`←`HealHandler` only | yes | **effect-only** |
| `CardsFrozen` | `heat.ts:126` `FreezeCardsHandler.apply` | yes | **effect-only** |
| `CardsThawed` | `heat.ts:172` `ThawCardsHandler` (yes); `heat.ts:82` `thawFrozenCardsAtTurnStart`←`energy.ts:114` (no) | mixed | **dual-path** |
| `CardsBurnedForHeat` | none (only `types.ts:412` def + `heat.ts:34` defensive preview arm) | n/a | **speculative** |
| `CardDestroyed` | `worldCards.ts:94` `destroyInHand()`←`DestroyCardInHandHandler`/`DestroySelfHandler` (yes); `draw.ts:297` `resolveForceDestroy`←`energy.ts:131` (no); `reduce.ts:113` exhaust branch (no) | mixed | **dual-path** |
| `WorldCardsReturned` | `worldCards.ts:78` `returnToActiveWorldDeck()`←`ReturnWorldCardsHandler` only | yes | **effect-only** |
| `WorldCardsExiled` | `worldCards.ts:248` `ExileTopWorldCardsHandler.apply` | yes | **effect-only** |
| `CardGained` | `gainCard.ts:103` `gainCard()`←6 handlers (lines 110,124,169,195,216,237) | yes | **effect-only** |
| `BoonOffered` | `actBoon.ts:79-99` `createBoonOffer`←`OfferBoonHandler` (yes) AND ←`createActBoonOffer`/`applyActBoonCascades` `reduce.ts:29` (no) | mixed | **dual-path** |

**Key correction vs plan prose:** `KeywordApplied` is **dual-path**, not effect-only
(plan Step 5 destination map implied effect-only). Second emit site in `drawWorld`
handles deferred `target: "nextWorldCard"`, reachable via turn-start `refillHand`
outside dispatch. Routes to Step 6 treatment. `CardDestroyed` (←ForceDestroy turn-start
already manually `withSource`-stamped, +exhaust), `CardsThawed`, `KeywordRemoved`,
`BoonOffered` all confirmed dual-path as plan suspected. `CardsBurnedForHeat` speculative.

Routing summary:
- **Step 5 (effect-only → previewEvent, delete switch arm):** `KeywordGuardConsumed`,
  `keywordGuardChanged`, `DamageDealt`, `HealReceived`, `CardsFrozen`,
  `WorldCardsReturned`, `WorldCardsExiled`, `CardGained`.
- **Step 6 (dual-path → shared helper, previewEvent + real switch arm):**
  `KeywordApplied`, `KeywordRemoved`, `CardsThawed`, `CardDestroyed`, `BoonOffered`.
- **Step 7 (speculative → previewEvent, no switch arm):** `CardsBurnedForHeat`.

### Step 2 (complete)
- Added `previewEvent(_event, _ctx): PreviewEventSummary { return null; }` to base
  `EffectHandler` (`src/core/effects/EffectHandler.ts`); type-only imports from
  `../view/previewFormat` (`PreviewEventSummary = readonly string[] | null`). No
  `actionPreview`/`registry` import. `bun run typecheck` clean. No behavior change.

### Step 3 (complete)
- Added `readonly sourceKind?: CardEffect["kind"]` to GameEvent provenance in
  `types.ts` (beside `sourceCardId`, with explanatory comment).
- Stamped inside the private `dispatch()` fn in `effects.ts` (NOT `applyEffect`):
  `events.map(e => e.sourceKind === undefined ? {...e, sourceKind: effect.kind} : e)`.
  Placing it in `dispatch` (bound as `ctx.apply`) is what gives innermost-wins for
  composite handlers — `sourceCardId` stays in `applyEffect` because the hook id is
  constant across nested effects.
- New test `src/core/tests/sourceKindStamp.test.ts`: Sequence-wrapped Damage stamps
  `"Damage"` not `"Sequence"`; sourceCardId independent. typecheck + observability-
  conformance (12 pass/1 skip) + new test (2 pass) all green.
- Review: clean. Emit-site stamps (`randomized`/`revealedFromHidden`) untouched.
- DEFERRED MICRO-OPT (reviewer, low severity, "not worth doing speculatively"):
  `dispatch` now rebuilds the events array on every call even with no stamping. Easy
  guard if sim profiling ever flags it: return `result` unchanged when no event has
  undefined `sourceKind`. Not applied.

### Step 4 (complete)
- `actionPreview.ts`: added `import { EFFECTS } from "../effects/registry"` (no cycle;
  other view/ modules already import it). Added `previewEffectOwnedEvent(event, ctx)`
  routing to `EFFECTS[event.sourceKind].previewEvent(...)` (null when sourceKind
  undefined). Wired as first-choice in `summarizeOwnedEvent`, falling back to
  `previewExternallyOwnedEvent` then `summarizeEvent`.
- Call site position UNCHANGED (loop line ~264, after all masking/aggregation gates +
  the stamped-event default at ~473). Masking order preserved.
- Registry + switch (14 EMPTY_LINES arms) KEPT intact this step. Byte-for-byte: all
  previewEvent return null now → always falls through. 76 pass/1 skip across
  actionPreview + observability-conformance + edenPrime.

### Step 5 (complete)
- 8 effect-only events migrated to `previewEvent` overrides, byte-for-byte (only
  `context`→`ctx` rename). Shared bases `DamageLikeHandler` (Damage+DamageScaled) and
  `GainCardLikeHandler` (6 gain handlers) created so all `sourceKind`s resolve to one
  copy. `setName` random-mask branch kept in CardGained body (reads event field).
- Deleted free fns `previewHealEvent`, `previewkeywordGuardEvent`, `previewDamageEvent`,
  `previewGainCardEvent`; removed effect-only branches from shared `previewAppliedKeywordEvent`
  / `previewHeatEvent` / `previewWorldCardsEvent` (dual-path branches kept) + their
  registry entries + switch arms.
- Switch had NO assertNever; exhaustiveness was via every-member-returns. Added
  `default: return EMPTY_LINES` (plan-sanctioned). Dual-path/speculative arms kept explicit.
- Review clean: byte-for-byte verified via git diff; randomized CardGained + revealed
  WorldCardsExiled still route to handler via stamped path. 78 pass/1 skip, lint clean.
- KNOWN TRADEOFF (reviewer + plan Step 7): `default` removes the compile-time
  exhaustiveness tripwire — a future new event type with no override AND no arm would
  silently preview empty. Plan accepts this (eventOwnership.test deleted in Step 7).
  Revisit at finalization whether a test-level guard should replace it.

## Log

### Initialize
- No task files under `.lore/work/tasks/effect-handler-preview-polymorphism/`; phases = the plan's 8 steps.
- No prior notes file; fresh start.
- No `.lore/lore-agents.md`; using `general-purpose` for implementation/testing/review roles.
- Read prior plan (`effect-handler-preview-summaries.md`) and reference doc
  (`effect-system-extension-pattern.md`). Dispatched `lore-researcher` for prior work.
- Researcher findings:
  - `.lore/work/notes/effect-handler-preview-summaries.md` (status complete) is the
    authoritative inventory of what shipped (files/symbols to delete/move). Trust it
    over plan prose for current locations, but re-grep emitter sites (it inherits the
    misclassifications).
  - `previewFormat.ts` is the neutral type surface — **keep** it.
  - Observability design stamps `randomized`/`revealedFromHidden` at *emit sites* on
    purpose; `sourceKind` stamps at the `dispatch()` boundary like `sourceCardId`. Do
    NOT unify the two stamping sites.
  - Two fragile masking edge cases with existing regression tests: `ApplyKeyword`
    with `target: "nextWorldCard"` emits an UNstamped `KeywordApplied` after a hidden
    `CardsDrawn` (hidden-flow taint); `createBoonOffer` serves both act-cascade and
    world-clear paths (confirms `BoonOffered` dual-path).
  - No retro exists for the preview-summaries failure; no `.lore/learned/` dir.
