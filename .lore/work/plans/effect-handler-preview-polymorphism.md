---
title: "Implementation plan: effect-handler-preview-polymorphism"
date: 2026-06-30
status: executed
tags: [plan, refactor, action-preview, effect-handler, polymorphism]
modules: [core-effects, action-preview, core-engine]
related: [.lore/work/plans/effect-handler-preview-summaries.md, .lore/reference/effect-system-extension-pattern.md]
---

# Implementation plan: effect-handler-preview-polymorphism

## Goal

Make a new `CardEffect`'s preview copy live on its `EffectHandler` subclass, the
same way `apply`, `describe`, and `compile` already do. Adding a preview becomes
"override one method," not "register a function in a second dispatch table."

This **corrects** [.lore/work/plans/effect-handler-preview-summaries.md], which
shipped (commit `b0be8f2`) the opposite of what was asked. That plan added a
parallel `EXTERNAL_PREVIEW_FORMATTERS` registry keyed by `GameEvent["type"]`,
scattered formatter free-functions across seven modules, and left the
`summarizeEvent` switch standing with 14 hollow `EMPTY_LINES` stub arms. Net
result: the god-switch still exists, a *second* dispatch system was added beside
it, and ~984 lines were added to a task that should have removed code. The base
class `EffectHandler`'s own docstring says it exists to kill exactly this
"behavior scattered across `switch` statements" pattern; the prior plan
reintroduced it.

This is a behavior-preserving refactor. Every preview string stays byte-for-byte
identical. Only *where the code lives* and *how it is dispatched* changes.

## What was actually wrong

`EffectHandler` (`src/core/effects/EffectHandler.ts`) is a polymorphic base:
one handler class per `CardEffect["kind"]`, one method per concern, defaults on
the base for concerns most effects don't need. The correct expansion for a new
"preview copy" concern is one new method with a `null` default. Instead the prior
work:

- built `EXTERNAL_PREVIEW_FORMATTERS` in `actionPreview.ts:63` — a `Record<event
  type, function>`, i.e. a hand-rolled vtable next to the language's own vtable;
- put the formatters as loose `previewXEvent` functions in `appliedKeywords.ts`,
  `damage.ts`, `gainCard.ts`, `heat.ts`, `resources.ts`, `worldCards.ts`, and
  `engine/actBoonPreview.ts`;
- added `eventOwnership.test.ts` purely to police that registry;
- kept `summarizeEvent` exhaustive over `GameEvent["type"]`, so the 14 migrated
  events became `return EMPTY_LINES` stubs (`actionPreview.ts:576-590`) instead
  of going away.

## The crux: events don't partition by emitter

The prior plan assumed each event type belongs to one owner. The codebase
disproves it, and so did the first draft of *this* plan — its pre-filled
ownership table got `KeywordRemoved`, `DamageDealt`, and `BoonOffered` wrong.
The lesson is to **not** carry a guessed table into the plan at all, because any
classification printed here becomes a false anchor that survives the very
verification step meant to catch it. Step 1 derives the table from grep, from
empty.

Every event currently routed by the parallel registry must be sorted into one of
these four classes. The class decides where its copy lives:

- **effect-only** — emitted *only* inside a handler `apply`, so every instance
  flows through `dispatch()` and carries `sourceKind`. Copy moves to the
  handler's `previewEvent`; the switch arm is deleted.
- **dual-path** — emitted by a handler *and* by an engine/reducer path that does
  not pass through `dispatch()` (e.g. turn-start decay, exhaust, act cascades).
  The engine instances carry no `sourceKind`. Copy goes in one shared pure helper
  called by *both* the handler's `previewEvent` and a real (non-stub) switch arm.
- **engine-only** — never flows through `dispatch()`. Stays a normal switch arm;
  no handler involvement.
- **speculative** — type defined but no emitter exists. Give the handler a
  `previewEvent` anyway (harmless, avoids a future stub); no switch arm needed.

The 14 events to classify: `KeywordApplied`, `KeywordRemoved`,
`KeywordGuardConsumed`, `keywordGuardChanged`, `DamageDealt`, `HealReceived`,
`CardsFrozen`, `CardsThawed`, `CardsBurnedForHeat`, `CardDestroyed`,
`WorldCardsReturned`, `WorldCardsExiled`, `CardGained`, `BoonOffered`.

The known trap, the one this plan's first draft fell into: an event's
turn-start / cascade emit path is easy to miss. `KeywordRemoved` is emitted both
by `RemoveKeywordHandler` (via dispatch) and by `tickAppliedKeywordsAtTurnStart`
(`appliedKeywords.ts:287`, called from `energy.ts:117` outside dispatch), so it
is dual-path. `BoonOffered` is emitted by `OfferBoonHandler` (via dispatch) and
by the act cascade in `reduce.ts` (via `createBoonOffer`, outside dispatch), so
it is dual-path too. Step 1 must grep the *emit site* of each event and trace
whether every caller reaches `dispatch()`, not just the obvious handler.

**The switch legitimately survives** for engine-framing, preview-policy, and the
engine half of dual-path events. That is not the anti-pattern. The anti-pattern
was the *parallel registry*, the *dead stubs*, and *effect copy living away from
its effect*.

## Routing mechanism

`dispatch()` in `src/core/engine/effects.ts:109` is the single choke point:
`EFFECTS[effect.kind].apply(...)`. Provenance is **already** stamped a few lines
above it — the `selfId`/`sourceCardId` block (`effects.ts:87-98`) tags every
produced event whose field is still undefined, "innermost wins." We stamp the
originating effect kind the identical way.

1. Add `readonly sourceKind?: CardEffect["kind"]` to the `GameEvent` provenance
   intersection in `src/core/model/types.ts:464` (beside `sourceCardId`).
2. In `effects.ts`, stamp `sourceKind` at the `dispatch()` boundary using the
   same "only if undefined, innermost wins" rule. Composite handlers
   (Modal/Sequence) recurse through `dispatch()`, so a `DamageDealt` inside a
   `Sequence` correctly stamps `Damage`, not `Sequence`.
3. Preview routes effect-owned events through the registry that already exists:
   `EFFECTS[event.sourceKind].previewEvent(event, ctx)`. No second registry.

Engine-emitted events bypass `dispatch()`, so they carry no `sourceKind` and
fall through to the switch automatically. That is the mechanism that makes
dual-path events Just Work: the handler-emitted instance is stamped and routes
to `previewEvent`; the engine-emitted instance is unstamped and hits the switch
arm. To avoid duplicated copy, both sides call one shared pure helper.

## Steps

Ordered by dependency. Each step ends green before the next starts.

### Step 1 — Build the emitter topology from scratch (no code change)

`grep` the emit site (`type: "<Event>"`) for each of the 14 events across
`src/core/effects/` and `src/core/engine/`. For *each* emit site, trace whether
its caller chain reaches `dispatch()` (`effects.ts:109`) — a handler `apply` does;
a turn-start tick (`energy.ts`), a draw/exhaust path (`draw.ts`/`reduce.ts`), or
an act cascade (`reduce.ts`) does not. Classify each event effect-only /
dual-path / engine-only / speculative and record the table in the implementation
notes. Build it from empty; do not copy any classification from this plan's prose
(that prose names only known *traps*, not a finished answer).

*Gate:* every one of the 14 events has a confirmed emitter set with each emitter
traced to "reaches dispatch" or "does not." No event is classified effect-only
until *every* one of its emit sites is confirmed to pass through `dispatch()`.

### Step 2 — Add the `previewEvent` seam

In `EffectHandler.ts`, add:

```ts
/** Player-facing preview line(s) for an event this handler emitted, or null. */
previewEvent(_event: GameEvent, _ctx: PreviewFormatContext): PreviewEventSummary {
  return null;
}
```

Import `PreviewFormatContext` / `PreviewEventSummary` from
`../view/previewFormat` (the neutral module — no cycle back to
`actionPreview.ts`). Default `null` means "not mine," so most handlers inherit it
untouched.

*Gate:* `bun run typecheck` passes; no behavior change yet.

### Step 3 — Stamp `sourceKind` at the dispatch boundary

Add the field in `types.ts`; stamp it in `effects.ts` mirroring the existing
`sourceCardId` map. The stamp goes on the events *returned by* `dispatch()`
(`result.events.map(...)`), not on anything passed in — same shape as the
`sourceCardId` block at `effects.ts:87-98`, conditional spread for
`exactOptionalPropertyTypes`, "only if undefined" so innermost wins. Add a
focused core test asserting a `Sequence` containing a `Damage` stamps
`sourceKind: "Damage"` on the `DamageDealt` event (innermost wins, not
`"Sequence"`) and `sourceCardId` provenance is unchanged.

*Gate:* new stamp test green; `bun run test src/core/tests/observability-conformance.test.ts` green (provenance unchanged).

### Step 4 — Bridge the preview loop to `previewEvent`

In `actionPreview.ts`, replace `previewExternallyOwnedEvent` /
`EXTERNAL_PREVIEW_FORMATTERS` with:

```ts
function previewEffectOwnedEvent(event, context): PreviewEventSummary {
  if (event.sourceKind === undefined) return null;
  return EFFECTS[event.sourceKind].previewEvent(event, previewFormatContext(context));
}
```

`summarizeOwnedEvent` calls it first, falls back to `summarizeEvent`. **All
existing masking/aggregation gates in `summarizeEvents` run before this**, exactly
as today (concealed source, revealed-from-hidden, hidden-flow taint, progress
aggregation), so masking cannot regress. Keep the registry temporarily so this
step is a pure swap of the call path with formatters still as free functions.

*Gate:* `bun run test src/core/tests/actionPreview.test.ts` byte-for-byte green.

### Step 5 — Move copy onto handlers for the effect-only events

For each event Step 1 classified **effect-only**, move the formatter body from
its free function into the owning handler's `previewEvent` override, delete the
free function, and delete that event's arm from `summarizeEvent` (gone, not a
stub). Use this handler-ownership map to place each override (the *destination*;
the class still comes from Step 1):

- `appliedKeywords.ts`: `KeywordApplied`→`ApplyKeywordHandler`,
  `KeywordGuardConsumed`→`KeywordGateHandler` (its emitter, `appliedKeywords.ts:168`).
  Note `KeywordRemoved` is **dual-path** (turn-start decay at
  `appliedKeywords.ts:287`) — it is handled in Step 6, not here.
- `resources.ts`: `keywordGuardChanged`→`GainKeywordGuardHandler`,
  `HealReceived`→`HealHandler`.
- `worldCards.ts`: `WorldCardsReturned`→`ReturnWorldCardsHandler`,
  `WorldCardsExiled`→`ExileTopWorldCardsHandler`.
- `damage.ts`: `DamageDealt` is effect-only but emitted by *two* handlers
  (`DamageHandler`, `DamageScaledHandler`) through the shared `damage()` helper.
  The preview string doesn't vary, so put `previewEvent` on a shared base both
  extend (or on both directly). No switch arm.
- `gainCard.ts`: `CardGained`. Six handlers emit it (`AddCard`, `GainCard`,
  `GainRandomCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck`,
  `AddThreatToWorldDeck`). Follow the existing `HazardTargetingHandler` idiom:
  put `previewEvent` on a shared intermediate base (e.g. `GainCardLikeHandler`)
  the six extend, so the copy exists once. The `setName` random-mask branch
  stays — it reads an event field, not preview policy.

*Gate:* `bun run test src/core/tests/edenPrime.test.ts` and `actionPreview.test.ts` green.

### Step 6 — Handle dual-path events with a shared helper

For each event Step 1 classified **dual-path** (known so far: `KeywordRemoved`,
`BoonOffered`, and likely `CardDestroyed` and `CardsThawed` — confirm in Step 1):
extract the copy into one pure module-level helper (e.g. `keywordRemovedLine` in
`appliedKeywords.ts`, `damageLine`-style). The owning handler's `previewEvent`
returns it for the dispatch-stamped instance; a **real** switch arm in
`summarizeEvent` returns it for the unstamped engine-emitted instance (turn-start
decay, exhaust, act cascade). One source of copy, two call sites, no duplication,
no stub. For `BoonOffered` specifically, `OfferBoonHandler.previewEvent` may stay
`null` and rely on the switch arm for both paths — the handler-emitted instance
falls back to the switch — but the shared-helper form is preferred for
consistency.

*Gate:* tests covering **both** an effect/dispatch-emitted and an
engine-emitted instance of each dual-path event stay byte-for-byte stable. In
particular: an `EndTurn` that expires an Alarm keyword still previews the
"Remove Alarm from N cards" line (the `KeywordRemoved` turn-start path).

### Step 7 — Delete the apparatus

- `BoonOffered` (dual-path per Step 6) no longer needs `engine/actBoonPreview.ts`
  as a registry entry. Fold its copy into the shared helper / switch arm and
  delete `engine/actBoonPreview.ts`.
- Delete `EXTERNAL_PREVIEW_FORMATTERS`, `ExternallyPreviewedEventType`,
  `EXTERNALLY_PREVIEWED_EVENT_TYPES`, and `previewExternallyOwnedEvent` from
  `actionPreview.ts`.
- Delete `src/core/tests/eventOwnership.test.ts` (it existed only to police the
  deleted registry). Its one durable guarantee — "every event type is handled" —
  is now enforced by the language: `summarizeEvent` stays an exhaustive switch
  over the engine/policy/dual-path events with a `default` that returns
  `EMPTY_LINES` for effect-only events that always route via `previewEvent`.

*Gate:* `bun run test` (full core suite) green; `previewFormat.ts` is the only
shared type surface between effects and `actionPreview.ts`; no effect module
imports `actionPreview.ts`.

### Step 8 — Tighten and document

- Confirm `summarizeEvent` no longer carries per-effect normal copy for migrated
  families and has no `EMPTY_LINES` stub arms.
- Update `.lore/reference/effect-system-extension-pattern.md`: a new effect now
  considers `apply`, `describe`, `compile`, targeting, `previewEvent`,
  observability stamps, tests, renderer feedback.
- Mark the prior plan `superseded` (well, `archived`) and note this plan replaced it.

*Gate:* `bun run lint && bun run typecheck && bun run build` clean.

## What this deletes vs adds

Adds: one method on `EffectHandler`, one optional field on `GameEvent`, one stamp
line in `effects.ts`, possibly one intermediate base for gain-card handlers.

Deletes: `EXTERNAL_PREVIEW_FORMATTERS` + its three exported type/const helpers,
`previewExternallyOwnedEvent`, `engine/actBoonPreview.ts`, `eventOwnership.test.ts`,
the seven `previewXEvent` free-function signatures (bodies move, not duplicate),
and the 14 dead stub arms. Expected net line count: **down**.

## Risks

- **Import cycles.** Handlers may import `previewFormat.ts` (neutral types) but
  never `actionPreview.ts`. `appliedKeywords.ts` is loaded by `energy.ts` before
  `registry.ts` builds (see its `apply`-recursion NOTE at line 49); `previewEvent`
  must not introduce a top-level `registry.ts` import. It won't — routing lives in
  `actionPreview.ts`, which already imports `EFFECTS`.
- **Dual-path duplication.** Mitigated by the shared-helper rule in Step 6. If a
  reviewer sees the same string in a handler and the switch without a shared
  helper, that's a defect.
- **Masking regression.** `previewEvent` runs only after the existing
  concealed/randomized/revealed gates in `summarizeEvents`. Step 4 must not move
  the call earlier in the loop.
- **`exactOptionalPropertyTypes`.** `sourceKind` is optional; stamp by spreading
  conditionally (as `sourceCardId` already does) so absent stays absent.
- **Speculative `CardsBurnedForHeat`.** Give it a `previewEvent` override anyway;
  harmless until an emitter appears, and avoids a future stub.

## Validation checklist

- `bun run test src/core/tests/actionPreview.test.ts`
- `bun run test src/core/tests/observability-conformance.test.ts`
- `bun run test src/core/tests/edenPrime.test.ts`
- New `sourceKind` stamp test (Sequence-nested Damage; innermost wins).
- **New dual-path regression test**: `EndTurn` that expires an Alarm keyword
  still previews "Remove Alarm from N cards" (the `KeywordRemoved` turn-start
  emit path that does not pass through `dispatch()`). This case does not exist
  today and is the specific gap that would let the refactor silently drop copy.
- Byte-for-byte representative cases: applied-keyword apply (PlayCard path) and
  remove (both PlayCard and EndTurn paths) and guard-consume; `DamageDealt` from
  both `Damage` and `DamageScaled`; effect vs deferred-ForceDestroy
  `CardDestroyed`; handler vs act-cascade `BoonOffered`; randomized `CardGained`;
  concealed→visible resource change; hidden draw/refill masking; multi-progress
  aggregation.
- `bun run lint && bun run typecheck && bun run build`.
- Manual audit: no `EXTERNAL_PREVIEW_FORMATTERS`, no `EMPTY_LINES` stub arms, no
  `previewXEvent` free functions; `actionPreview.ts` switch holds only
  engine/policy/dual-path arms.
