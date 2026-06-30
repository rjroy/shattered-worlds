---
title: "Implementation plan: effect-handler-preview-summaries"
date: 2026-06-30
status: draft
tags: [plan, refactor, action-preview, effect-handler]
modules: [core-effects, action-preview]
related: [.lore/reference/action-preview-confirmation-system.md, .lore/reference/effect-system-extension-pattern.md, .lore/work/design/observability-boundary.md]
---

# Implementation plan: effect-handler-preview-summaries

## Goal

Move normal player-facing preview strings out of
`src/core/view/actionPreview.ts` when those strings clearly belong to an effect
family, so adding a new `CardEffect` such as `ApplyKeyword` also has an obvious
home for its preview copy.

This is a refactor, not a behavior change. `previewAction` remains the pure core
read-model over real reducer events. It keeps ownership of cross-event preview
policy: concealment masking, hidden/randomized masking, aggregation, risk
classification, resource cursor replay, and summary ordering.

## Current shape

- `EffectHandler` already owns `apply`, `describe`, `compile`, target shape,
  playability, legal targets, and connector style.
- `actionPreview.ts` owns one large `summarizeEvent(event, context)` switch over
  `GameEvent["type"]`.
- The preview strings for the applied-keyword family were added directly to
  `actionPreview.ts`:
  - `KeywordApplied`
  - `KeywordRemoved`
  - `AlarmGuardChanged`
  - `AlarmGuardConsumed`
- `GameEvent` values do not record the originating `CardEffect.kind`; they only
  carry optional provenance/observability fields such as `sourceCardId`,
  `randomized`, and `revealedFromHidden`.

## Architectural Decision

Add effect-adjacent preview formatting for normal visible copy, but do not route
by `GameEvent["type"]` alone.

Several event types are shared by multiple effects and by engine/reducer helper
paths. `CardGained`, for example, can represent fixed grants, random grants,
world-deck additions, and helper-driven additions. The migration must use
explicit event-family ownership instead of probing candidate handlers until one
returns lines.

Ownership rules:

- Effect-family formatters live beside the effect module when the effect module
  owns the event or the emitting helper.
- Preview-owned formatters stay in `actionPreview.ts` when the event depends on
  concealment, hidden/randomized masking, aggregation, ordered resource cursor
  replay, action framing, or reducer/engine framing.
- Shared helper-owned formatters live beside the helper module, not every effect
  handler that can reach that helper.
- External formatter dispatch must be exact: no "first handler wins", no
  candidate probing, and no multiple owners unless the dispatcher first narrows
  by disjoint event fields.

The contract should answer: "Given this already-unmasked event, can this
declared event-family formatter provide the normal summary line(s) for it?"

Do not move these responsibilities into effect modules:

- concealed-source masking;
- newly drawn hazard masking;
- `randomized` / `revealedFromHidden` generic copy;
- progress-family aggregation across multiple hazards;
- resource cursor diffing and masked-resource state;
- risk/severity classification;
- final pending destroy adjustment after event replay.

## Step 1: Classify Event Ownership

Before changing code, create a small ownership table in implementation notes or
in the first migration test. Every `GameEvent["type"]` must be categorized as
one of:

- `effect-family`: normal visible copy belongs next to a specific effect module
  or helper.
- `preview-policy`: copy depends on concealment, hidden/randomized masking,
  aggregation, resource cursor replay, or summary ordering.
- `engine-framing`: event is emitted by reducer/start-turn/draw/boon-choice
  framing rather than an effect handler.
- `terminal-status`: event describes run/world status rather than one effect.

Initial classification:

- `preview-policy`: `ProgressDealt`, `HazardResolved`, `HazardPartial`,
  `HpChanged`, `EnergyChanged`, `LightChanged`, `HeatChanged`, `BraceChanged`,
  and all concealed/randomized/revealed-from-hidden generic summaries.
- `engine-framing`: `CardPlayed`, `CardsDrawn`, `DeckShuffled`, `TurnEnded`,
  `ActAdvanced`, `HazardAdded`, `BoonCardGranted`, `PlayerDiscardRecalled`,
  `BraceConsumed`.
- `terminal-status`: `WorldWon`, `WorldLost`.
- `effect-family`: `KeywordApplied`, `KeywordRemoved`, `AlarmGuardChanged`,
  `AlarmGuardConsumed`, `DamageDealt`, `HealReceived`, `CardsFrozen`,
  `CardsThawed`, `CardDestroyed`, `WorldCardsReturned`, `WorldCardsExiled`,
  `CardGained`, `BoonOffered`, `HazardDiscarded`.

This table is intentionally conservative. Keeping more events preview-owned is
better than forcing false ownership into handlers.

Validation:

- Add a coverage test that fails when a new `GameEvent["type"]` is not
  categorized.
- Do not start migrating formatter code until this table is explicit.

## Step 2: Extract Preview Formatting Surface

Create `src/core/view/previewFormat.ts` or `src/core/effects/previewFormat.ts`
with pure types/helpers needed by external formatter functions.

Include:

- `PreviewFormatContext` with only the safe subset formatters need:
  - `before`, `after`
  - `beforeCards`, `afterCards`
  - `cardName`, `namesFromIds`, `destLabel`, `plural`, `listNames`
- `PreviewEventSummary` type alias, likely `readonly string[] | null`.
- `EMPTY_PREVIEW_LINES` shared constant if useful.

Do not expose a resource update callback through this context. Resource delta
events (`HpChanged`, `EnergyChanged`, `LightChanged`, `HeatChanged`,
`BraceChanged`) depend on the ordered preview cursor and masked-resource set, so
they stay preview-owned.

Validation:

- Typecheck passes.
- No preview behavior changes.
- No imports from effect modules back into `actionPreview.ts`.

## Step 3: Add Pure External Formatter Functions

Prefer small module-level formatter functions before adding a method to every
`EffectHandler<>`:

```ts
export function previewAppliedKeywordEvent(
  event: GameEvent,
  ctx: PreviewFormatContext,
): readonly string[] | null;
```

If implementation later shows a handler method is cleaner, add a default
`previewEvent` method only after ownership classification prevents multi-handler
probing.

Formatter rules:

- pure: no cursor mutation, RNG, state mutation, or masked-resource access;
- accepts an already-unmasked event;
- returns lines only for the exact event family it owns;
- returns `null` for everything else;
- never performs concealment or hidden/randomized policy checks.

Validation:

- Typecheck passes with the first formatter.
- Existing `describeEffect` and `effectGlyphs` imports do not form a cycle.

## Step 4: Bridge `actionPreview.ts` With Exact Dispatch

Add `summarizeOwnedEvent(event, context)` inside `actionPreview.ts`.

Dispatch rules:

- `summarizeEvents` keeps all existing masking and aggregation checks before any
  external formatter is called.
- `summarizeOwnedEvent` calls exactly one declared external formatter for an
  externally owned event type.
- If an event remains preview-owned, it uses the local preview switch.
- If an externally owned event has subcases that need different handling, narrow
  by event fields inside one declared owner, not by competing handlers.
- No formatter may be called speculatively if it can mutate context. The
  formatter contract is pure, but the dispatch design should not rely on
  callers remembering that under pressure.

Validation:

- `bun run test src/core/tests/actionPreview.test.ts`
- `bun run test src/core/tests/observability-conformance.test.ts`
- Existing summary text stays byte-for-byte stable.

## Step 5: Migrate Applied-Keyword Copy First

Move the strings that triggered this refactor into
`src/core/effects/appliedKeywords.ts` and `src/core/effects/resources.ts`.

Ownership:

- `appliedKeywords.ts`
  - `KeywordApplied`
  - `KeywordRemoved`
  - `AlarmGuardConsumed`
- `resources.ts`
  - `AlarmGuardChanged`

Keep these preview-owned:

- `HpChanged`
- `EnergyChanged`
- `LightChanged`
- `HeatChanged`
- `BraceChanged`
- `BraceConsumed`

Focused tests should assert:

- applying Alarm/Spore keywords previews the applied keyword line;
- removing a keyword previews the removal line;
- Alarm Guard gain and consumption preview through `previewAction`;
- concealed/drawn hazard masking still suppresses exact keyword hook details.

Validation:

- `bun run test src/core/tests/edenPrime.test.ts`
- `bun run test src/core/tests/actionPreview.test.ts`

## Step 6: Migrate Low-Risk Non-Resource Families

Move simple visible summaries whose emitters are clearly effect/helper-owned:

- `damage.ts`
  - `DamageDealt`
- `resources.ts`
  - `HealReceived` only; `HpChanged` remains preview-owned
- `heat.ts`
  - `CardsFrozen`
  - `CardsThawed`
  - `CardsBurnedForHeat` if/when emitted
- `worldCards.ts`
  - `CardDestroyed`
  - `WorldCardsReturned`
  - `WorldCardsExiled`
- `gainCard.ts`
  - `CardGained`, with all subcases handled by one `gainCard` formatter that
    branches on event fields such as `randomized`, `setName`, and `dest`
- `boonChoice.ts`
  - `BoonOffered`

Keep these preview-owned unless a separate design adds event provenance:

- `CardsDrawn`
- `DeckShuffled`
- `BoonCardGranted`
- `PlayerDiscardRecalled`
- `BraceConsumed`
- `WorldWon`
- `WorldLost`
- `ActAdvanced`
- `TurnEnded`
- `HazardAdded`

For events emitted by shared helpers rather than a single handler, choose the
module that owns the helper.

Validation:

- Existing action-preview and observability tests remain green.
- Coverage test confirms every `GameEvent["type"]` is categorized and every
  externally owned event has exactly one declared formatter path.

## Step 7: Handle Progress-Family Events Last

Progress summaries are tightly coupled to preview policy:

- `ProgressDealt` needs card names, costs, progress totals, concealment, and
  newly drawn hazard suppression.
- `HazardResolved` and `HazardPartial` participate in aggregation and hook
  masking.
- `DealProgressAll` uses aggregate copy instead of per-event copy when multiple
  hazards are touched.

Plan:

1. Leave aggregation and hidden/concealed branching in `actionPreview.ts`.
2. Only consider moving visible single-event normal copy after the rest of the
   bridge is stable.
3. Keep `summarizeAggregatedProgress` preview-owned unless a later design
   cleanly separates policy from wording.

Validation:

- Broad-effect tests in `actionPreview.test.ts`.
- Concealed progress, drawn hazard, visible single target, and multi-hazard
  aggregate cases stay byte-for-byte stable.

## Step 8: Tighten Exhaustiveness

After migrated formatters cover the chosen effect-family events:

- Shrink the local preview switch to preview-owned events plus dispatch calls.
- Add a type-level or test-level guard:
  - every `GameEvent["type"]` is externally owned or explicitly preview-owned;
  - adding a new event type fails until categorized;
  - externally owned event types have exactly one formatter path unless an
    explicit disjoint narrowing rule exists.
- Update `.lore/reference/effect-system-extension-pattern.md`: new effects must
  consider `apply`, `describe`, `compile`, targeting, preview event summaries,
  observability stamps, tests, and renderer feedback.

Validation:

- Full core test suite.
- Full typecheck.
- Lint, if configured.

## Risks

- **Circular imports.** Handlers already import view token types for glyphs, but
  they must not import `actionPreview.ts`. Keep shared preview formatter types in
  a small neutral module.
- **Wrong ownership for shared events.** `CardGained` can be produced by several
  effects. Prefer ownership by emitting helper/module and disjoint event-field
  routing, not assumptions about the original action.
- **Resource cursor drift.** `HpChanged`/`EnergyChanged`/etc. depend on ordered
  preview replay. Keep them preview-owned unless a later design introduces a
  pure two-phase claim/render contract.
- **Masking regression.** External formatters must only run after the existing
  concealed/randomized/revealed-from-hidden gates.
- **Over-migration.** Some lines are not effect-owned. Keeping them in
  `actionPreview.ts` is correct when they describe action framing, engine
  framing, or preview policy.
- **Claim collision.** A formatter registry must fail fast if two external
  formatters claim the same event type without an explicit disjoint narrowing
  rule.

## Final Validation Checklist

- `bun run test src/core/tests/actionPreview.test.ts`
- `bun run test src/core/tests/observability-conformance.test.ts`
- `bun run test src/core/tests/edenPrime.test.ts`
- Byte-for-byte representative summary tests covering:
  - concealed resource change followed by visible resource change;
  - randomized `CardGained`;
  - hidden draw/refill masking;
  - multi-progress aggregation;
  - applied keyword apply/remove/guard consumption.
- Event ownership coverage test for every `GameEvent["type"]`.
- Full project typecheck.
- Full test suite if the focused tests pass.
- Manual code audit: `actionPreview.ts` should no longer contain per-effect
  normal-copy strings for migrated effect families, especially applied keywords.

## Review Status

Fresh-eyes review completed after the first draft. This revision incorporates
the five findings:

- event type alone cannot identify an owning handler;
- several engine/reducer events were incorrectly assigned to effect handlers;
- resource cursor mutation must remain preview-owned;
- `HpChanged` was missing from the resource discussion;
- validation needed byte-for-byte ordering and ownership coverage tests.
