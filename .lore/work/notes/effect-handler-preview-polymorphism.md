---
title: "Implementation notes: effect-handler-preview-polymorphism"
date: 2026-06-30
status: complete
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
- [x] Step 6 — Handle dual-path events with a shared helper (review clean; suite has 1
      expected failure, the obsolete `eventOwnership.test.ts`, deleted in Step 7)
- [x] Step 7 — Delete the apparatus (suite fully green, 1365 pass / 2 skip / 0 fail)
- [x] Step 8 — Tighten and document (reference doc updated, prior plan archived, this
      plan marked executed; lint/typecheck/build clean)
- [x] Final validation (holistic review against plan) — all 10 plan items PASS

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

### Interruption (between Step 5 and Step 6)
- Steps 1-5 were committed during a session-limit gap as `e646855 "Partial refactor
  of effect handler"`. Baseline verified green after the gap: typecheck clean, 78 pass/1 skip.
- An UNRELATED commit `654e933 "simple balance pass on Eden Prime"` (allCards.json,
  6 lines) landed on top during the gap — not part of this refactor; left untouched.
- The first Step 6 agent hit the session limit mid-run; its changes were NOT committed
  and are absent from the working tree. Step 6 re-dispatched from the clean baseline.

### DISCOVERED DIVERGENCE (Step 3 fallout, surfaced at Step 6 full-suite run)
- Running the FULL suite (first time since Step 2) revealed 5 engine-apply tests
  failing because Step 3's `sourceKind` stamp adds a field to events, and these tests
  assert EXACT event shape via `toContainEqual`/equality. Root cause confirmed by
  reading received output (e.g. `WorldCardsReturned` now carries
  `sourceKind: "ReturnWorldCards"`). NOT pre-existing — introduced by this refactor's
  Step 3; undetected because Steps 3-5 only ran targeted preview/observability tests.
- Affected: `reduce.test.ts` (applyEffect GainLight, Panic snapshot, Adrenaline
  discardPlayer), Whiteout HeatChanged, fog-beach-party GainLight.
- Fix: update the expected event shapes to include the correct `sourceKind` (the events
  genuinely carry it now by design). Faithful to existing exact-shape test style.
- Plan gap: Step 3 only named `observability-conformance` as the provenance test to
  keep green; it missed exact-shape engine tests elsewhere. LESSON: a field added to a
  widely-emitted event type needs a full-suite run, not just targeted tests.
- 6th failure `eventOwnership.test.ts` is the registry-police test; plan deletes it in Step 7.

### Step 6 (complete)
- 5 dual-path events migrated to "one shared helper, two call sites": `keywordRemovedLine`,
  `cardsThawedLine`, `boonOfferedLine` (in `engine/actBoonPreview.ts`, renamed from
  `previewBoonOfferedEvent`), `keywordAppliedLine`, `cardDestroyedLine`. Each called by the
  owning handler's `previewEvent` AND a real `summarizeEvent` switch arm.
- KeywordApplied trap: `ApplyKeywordHandler.previewEvent` serves `"ApplyKeyword"`-stamped
  hand instance; switch arm is catch-all for `"Draw"`-stamped (deferred nextWorldCard via
  DrawHandler) + unstamped (turn-start refill). DrawHandler has NO previewEvent.
- CardDestroyed: new `DestroyInHandLikeHandler` base (mirrors DamageLikeHandler) extended by
  DestroyCardInHand + DestroySelf; switch arm serves unstamped exhaust/forcedestroy; rng
  ForceDestroy snatch keeps its masked stamped path.
- `EXTERNAL_PREVIEW_FORMATTERS` now holds only `CardsBurnedForHeat`. Deleted
  `previewAppliedKeywordEvent`/`previewWorldCardsEvent`; stripped `previewHeatEvent` to the
  `CardsBurnedForHeat` branch only.
- Mandatory regression test added (`actionPreview.test.ts:202`): EndTurn Alarm expiry asserts
  `KeywordRemoved.sourceKind === undefined` (rides switch arm, not previewEvent) + "Remove
  Alarm from 1 card".
- Review clean on all technical points. Suite: 1367 pass/2 skip/1 fail (eventOwnership only).

### Step 7 (complete)
- Deleted the parallel-registry apparatus from `view/actionPreview.ts`:
  `EXTERNAL_PREVIEW_FORMATTERS`, `ExternallyPreviewedEventType`,
  `EXTERNALLY_PREVIEWED_EVENT_TYPES`, `previewExternallyOwnedEvent`, and the now-unused
  `ExternalPreviewFormatter` type. `summarizeOwnedEvent` is now just
  `previewEffectOwnedEvent(event, ctx) ?? summarizeEvent(event, context)`.
- Speculative `CardsBurnedForHeat`: copy moved (byte-for-byte) from the deleted
  `previewHeatEvent` branch into a REAL `case "CardsBurnedForHeat"` arm in
  `summarizeEvent` (uses local `plural`/`listNames`/`namesFromIds`, identical output),
  so an unstamped future emitter still previews. `previewHeatEvent` deleted entirely.
- `boonOfferedLine` relocated from `engine/actBoonPreview.ts` (which held ONLY that
  formatter) into `effects/boonChoice.ts` next to `OfferBoonHandler`; `actBoonPreview.ts`
  deleted. `boonChoice.ts` does NOT import `actionPreview.ts`; `actionPreview.ts` imports
  `boonOfferedLine` from `boonChoice.ts` (same direction as the existing EFFECTS dep — no
  new cycle).
- Deleted `tests/eventOwnership.test.ts` (registry-police test; imported the deleted
  `EXTERNALLY_PREVIEWED_EVENT_TYPES`).
- `summarizeEvent` final shape: real arms for the 5 dual-path events + speculative
  `CardsBurnedForHeat` + all engine/policy events; `default: return EMPTY_LINES` for the
  effect-only events that always route via `previewEvent`. NO `EMPTY_LINES` stub arms
  remain (the conditional revealed-hazard `EMPTY_LINES` in HazardResolved/HazardPartial are
  policy, not stubs; default is the only blanket one).
- Verify: typecheck clean, lint clean, targeted preview tests 77 pass/1 skip, full suite
  1365 pass/2 skip/0 fail. grep confirms zero references to any deleted symbol across src/.

## Finalization summary

All 8 plan steps done + holistic validation passed. Full suite green (1365 pass / 2
skip / 0 fail); typecheck, lint, build all clean.

**What was built:** the new "preview copy" concern is now polymorphic on `EffectHandler`
(`previewEvent`, default `null`), routed by a `sourceKind` field stamped at the
`dispatch()` boundary (innermost wins). 8 effect-only events override `previewEvent`;
5 dual-path events use one shared helper called by both the handler override and a real
`summarizeEvent` switch arm; 1 speculative event (`CardsBurnedForHeat`) is a switch arm.
The parallel `EXTERNAL_PREVIEW_FORMATTERS` registry, `previewExternallyOwnedEvent`, its
type/const helpers, `engine/actBoonPreview.ts`, `eventOwnership.test.ts`, and all 14
`EMPTY_LINES` stub arms are gone. Preview copy is byte-for-byte identical.

**Divergences from the plan (all recorded above):**
1. `KeywordApplied` reclassified effect-only → dual-path (Step 1 grep; plan prose was
   wrong). Handled via Step 6's shared-helper + catch-all switch arm because it stamps
   `"Draw"` (deferred nextWorldCard) or is unstamped (turn-start refill), not only
   `"ApplyKeyword"`. `CardDestroyed` similarly multi-emitter.
2. Discovered + fixed an integration gap the plan missed: Step 3's `sourceKind` field
   broke 5 exact-shape engine tests (`effects/reduce/whiteout/fogBeachParty`). Updated
   their expected event shapes to include the correct `sourceKind`. Lesson: a field
   added to a widely-emitted event needs a full-suite run, not just targeted tests.
3. Soft line-count target: apparatus removal is net down as predicted, but total
   production is +83 due to doc comments + reusable scaffolding (no duplication).

**Process note:** Steps 1-5 were committed mid-run as `e646855` during a session-limit
gap (an unrelated `654e933` balance commit also landed); the first Step 6 agent's work
was lost to the limit and redone from the clean baseline. Steps 6-8 + test fixes remain
uncommitted in the working tree.

**Deferred (not blocking):** the `default: return EMPTY_LINES` removes the compiler's
exhaustiveness tripwire for new event types (plan-sanctioned); micro-opt in `dispatch`
allocates an array per call even without stamping (reviewer: negligible).

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
