# Effect System Extension Pattern

<!--
date: 2026-06-30
status: current
tags: card-effect, effect-system, deferred-effect, testing, exhaustive-switch, preview, polymorphism
fg-type: lesson
fg-sources:
  - .lore/work/retros/adding-forcedestroy-effect.html
  - .lore/work/plans/effect-handler-preview-polymorphism.md
fg-status: current
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/core/effects/registry.ts
    - src/core/effects/EffectHandler.ts
    - src/core/view/describe.ts
    - src/core/view/actionPreview.ts
    - src/core/view/previewFormat.ts
    - src/core/engine/effects.ts
  tests:
    - src/core/tests/effects.test.ts
    - src/core/tests/effectRegistry.test.ts
    - src/core/tests/sourceKindStamp.test.ts
    - src/core/tests/actionPreview.test.ts
    - src/game/tests/describe.test.ts
  symbols:
    - CardEffect
    - EffectHandler
    - ForceDestroy
    - previewEvent
    - sourceKind
-->

Adding a new card effect is rarely a one-file change. The effect union, apply logic, description text, playability or target spec, data authoring, preview copy, observability stamps, tests, and renderer feedback all need consideration. Exhaustive switches are useful tripwires, but some areas have defaults that silently mask missing cases.

## Checklist

Add the union member and the effect handler. Add display text in the pure description path. Add explicit playability and target-spec handling when the defaults would be ambiguous. Override `previewEvent` on the handler for any `GameEvent` the effect emits (see below); concealment, hidden/randomized masking, resource cursor replay, progress aggregation, and action framing stay in `actionPreview.ts`. Add or verify observability stamps when the effect chooses card identities from hidden zones or RNG (`sourceKind` is stamped automatically at dispatch; `randomized` and `revealedFromHidden` are stamped at the emit site). Add data and catalog tests because JSON is loaded across a cast boundary and is not typechecked like TypeScript.

## Preview copy lives on the handler

`EffectHandler` is a polymorphic base: one handler subclass per `CardEffect["kind"]`, one method per concern, with defaults on the base for concerns most effects don't need. Preview copy is one of those concerns. Adding the preview for a new effect means overriding one method, the same way you override `apply`, `describe`, `compile`, and the targeting hooks:

```ts
previewEvent(event: GameEvent, ctx: PreviewFormatContext): PreviewEventSummary {
  // return the player-facing line(s) for an event this handler emitted, or null
}
```

The base returns `null` ("not mine"), so handlers that emit nothing player-facing inherit it untouched. This replaced an earlier parallel `EXTERNAL_PREVIEW_FORMATTERS` registry of free functions keyed by event type; that registry was a second hand-rolled dispatch table beside the language's own vtable and is gone.

### How an event routes to its handler

Every event that flows through `dispatch()` carries a `sourceKind`, the originating `CardEffect["kind"]`. It is stamped at the dispatch boundary in `engine/effects.ts` using the same "only if undefined, innermost wins" rule as `sourceCardId`, so a `DamageDealt` emitted inside a `Sequence` stamps `"Damage"`, not `"Sequence"`. The preview loop in `actionPreview.ts` routes effect-owned events with `EFFECTS[event.sourceKind].previewEvent(event, ctx)`. There is no second registry: it reuses the same `EFFECTS` table that already dispatches `apply`.

`PreviewFormatContext` and `PreviewEventSummary` (`= readonly string[] | null`) live in the neutral `src/core/view/previewFormat.ts`. Handlers import those types from there and never import `actionPreview.ts`, so no cycle forms.

### Dual-path events need a shared helper

Some event types are emitted by a handler *and* by an engine path that bypasses `dispatch()` (turn-start keyword decay and card thaw, the exhaust branch, the act-boon cascade, deferred draw resolution). The engine-emitted instances carry no `sourceKind`, so they fall to `summarizeEvent`. To keep one source of copy, extract the line into one pure module-level helper called by **both** the handler's `previewEvent` and a real (non-stub) `summarizeEvent` switch arm. `KeywordApplied`, `KeywordRemoved`, `CardsThawed`, `CardDestroyed`, and `BoonOffered` are the current dual-path events; their helpers (`keywordAppliedLine`, `keywordRemovedLine`, `cardsThawedLine`, `cardDestroyedLine`, `boonOfferedLine`) are the pattern. Same string in a handler and the switch without a shared helper is a defect.

### What the switch is still for

The `summarizeEvent` switch legitimately survives for engine-framing events (`CardsDrawn`, `DeckShuffled`, `ActAdvanced`, ...), preview-policy events (resource cursor replay, revealed-hazard masking, progress aggregation), and the engine half of the dual-path events above. The only blanket `EMPTY_LINES` is the `default`, which covers effect-only events that always route via `previewEvent` and therefore never reach the switch. There are no per-event `EMPTY_LINES` stub arms; if you see one for a migrated effect family, it is leftover from the old registry.

Deferred effects need a queued field on `GameState` plus a well-defined resolution point in the turn cycle. `pendingKeywordNextWorldCard` (`ApplyKeyword` target `"nextWorldCard"`, resolved in `drawWorld`) and `ForceDestroy` (`pendingForceDestroy`, resolved at turn start) are the reference pattern: queue at trigger time, resolve later when the target state exists, and emit events when resolution actually happens.

Renderer feedback is separate work. A state-diff renderer may make the state change visible only by removing or redrawing cards; if the effect needs to feel impactful, add event-driven or explicit presentation handling. Keep preview, observability, tests, and renderer feedback in the same review as apply/describe/compile/targeting so a new effect is not technically functional but silent or leaky at the UI boundary.
