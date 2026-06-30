---
title: "Implementation notes: effect-handler-preview-summaries"
date: 2026-06-30
status: complete
tags: [implementation, notes, refactor, action-preview, effect-handler]
source: .lore/work/plans/effect-handler-preview-summaries.md
modules: [core-effects, action-preview]
related: [.lore/reference/action-preview-confirmation-system.md, .lore/reference/effect-system-extension-pattern.md, .lore/work/design/observability-boundary.md]
---

# Implementation notes: effect-handler-preview-summaries

## Progress

- [x] Phase 1: Classify event ownership and add coverage.
- [x] Phase 2: Extract preview formatting surface.
- [x] Phase 3: Add pure external formatter functions.
- [x] Phase 4: Bridge `actionPreview.ts` with exact dispatch.
- [x] Phase 5: Migrate applied-keyword copy first.
- [x] Phase 6: Migrate low-risk non-resource families.
- [x] Phase 7: Keep progress-family policy preview-owned.
- [x] Phase 8: Tighten exhaustiveness and update extension reference.
- [x] Final validation review.

## Event Ownership

| Category | Event types |
|---|---|
| `preview-policy` | `ProgressDealt`, `HazardResolved`, `HazardPartial`, `HpChanged`, `EnergyChanged`, `LightChanged`, `HeatChanged`, `BraceChanged`, concealed/randomized/revealed-from-hidden generic summaries |
| `engine-framing` | `CardPlayed`, `CardsDrawn`, `CardsDiscarded`, `DeckShuffled`, `TurnEnded`, `ActAdvanced`, `HazardAdded`, `BoonCardGranted`, `PlayerDiscardRecalled`, `BraceConsumed`, `HazardDiscarded` |
| `terminal-status` | `WorldWon`, `WorldLost` |
| `effect-family` | `KeywordApplied`, `KeywordRemoved`, `AlarmGuardChanged`, `AlarmGuardConsumed`, `DamageDealt`, `HealReceived`, `CardsFrozen`, `CardsThawed`, `CardsBurnedForHeat`, `CardDestroyed`, `WorldCardsReturned`, `WorldCardsExiled`, `CardGained`, `BoonOffered` |

## Log

- Initialized from `.lore/work/plans/effect-handler-preview-summaries.md`.
- Lore research found no prior implementation, no task breakdown, and no `.lore/lore-agents.md`; using fallback `general-purpose` roles through worker/explorer agents.
- Related observability implementation already exists. Preserve summary masking order in `actionPreview.ts`: stamped masking, concealed-source masking, revealed-hazard masking, hidden-flow taint, progress aggregation, then normal summaries.
- Added `src/core/tests/eventOwnership.test.ts` as the Phase 1 guard. It parses `GameEvent` discriminants from `src/core/model/types.ts`, checks every current event type has one ownership category, and checks every `effect-family` event has a declared owner module. `CardsDiscarded` and `CardsBurnedForHeat` were already present in `GameEvent`; they are included in the guard as `engine-framing` and `effect-family` respectively.
- Corrected the Phase 1 guard so the readonly array returned by `extractGameEventTypes()` is copied before comparison, keeping the assertion type-clean without changing runtime coverage.
- Approved Phase 1 divergence: reclassified `HazardDiscarded` from `effect-family` to `engine-framing` because it is emitted directly by the reducer's `DiscardHazard` action path, not by `worldCards` or an effect-owned helper.
- Completed Phase 2 by adding `src/core/view/previewFormat.ts` as a neutral preview formatting surface. It exposes only state snapshots, card maps, and pure formatting helpers, plus `PreviewEventSummary` and `EMPTY_PREVIEW_LINES`; no resource cursor or masked-resource callbacks are exposed.
- Completed Phase 3 by adding `previewAppliedKeywordEvent()` to `src/core/effects/appliedKeywords.ts`. The formatter is pure, accepts already-unmasked `GameEvent` values, handles only `KeywordApplied`, `KeywordRemoved`, and `AlarmGuardConsumed`, and returns `null` for all other event types. `AlarmGuardChanged` remains for the later `resources.ts` formatter per the ownership table.
- Did not wire `actionPreview.ts` dispatch and did not run the testing phase, per implementation scope.
- Completed Phase 4 by adding `summarizeOwnedEvent()` and exact external formatter dispatch in `src/core/view/actionPreview.ts`. The normal event loop still runs stamped masking, concealed-source masking, revealed-hidden masking, hidden-flow masking, and progress aggregation before calling external formatters. The stamped/randomized branch continues to use local generic copy instead of consulting external formatters.
- Completed Phase 5 by moving `AlarmGuardChanged` visible preview copy into `src/core/effects/resources.ts` as `previewAlarmGuardEvent()`, and by dispatching `KeywordApplied`, `KeywordRemoved`, and `AlarmGuardConsumed` through `previewAppliedKeywordEvent()` in `src/core/effects/appliedKeywords.ts`. Resource cursor events remain preview-owned in `actionPreview.ts`.
- Removed migrated applied-keyword and alarm guard normal-copy strings from the local `summarizeEvent()` switch; the migrated cases now produce no local visible copy if reached outside the declared owner path.
- Added focused `previewAction` coverage for applying/removing keywords, Alarm Guard gain/consumption, and concealed/newly drawn hazard masking of keyword details.
- Targeted validation run: `bun run test src/core/tests/actionPreview.test.ts` passed after correcting the drawn-hazard fixture so its hidden keyword hook had an eligible world-card target.
- Correction after review: `ApplyKeyword` with `target: "nextWorldCard"` emits an unstamped `KeywordApplied` after the hidden world `CardsDrawn` event, so the existing source-card/revealed-hazard mask did not catch it. Extended the revealed-hazard predicate to treat `KeywordApplied`/`KeywordRemoved` events touching ids drawn from the hidden world deck this action as hidden-flow events before exact external formatter dispatch.
- Added focused regression coverage for a player card that sequences `ApplyKeyword(nextWorldCard)` then `Draw(world: 1)`: the raw event stream still contains `KeywordApplied`, but preview summary shows generic hidden-draw warning copy and does not expose `Apply Alarm` or the drawn card name.
- Targeted validation run: `bun run test src/core/tests/actionPreview.test.ts` passed.
- Completed Phase 6 by moving low-risk normal visible summary copy into owner modules: `previewDamageEvent()` in `damage.ts`, `previewHealEvent()` in `resources.ts`, `previewHeatEvent()` in `heat.ts`, `previewWorldCardsEvent()` in `worldCards.ts`, `previewGainCardEvent()` in `gainCard.ts`, and `previewBoonOfferedEvent()` in `actBoonPreview.ts`.
- Extended exact dispatch in `summarizeOwnedEvent()` for `DamageDealt`, `HealReceived`, `CardsFrozen`, `CardsThawed`, `CardsBurnedForHeat`, `CardDestroyed`, `WorldCardsReturned`, `WorldCardsExiled`, `CardGained`, and `BoonOffered`. The local `summarizeEvent()` switch now returns empty lines for those externally owned normal summaries.
- Kept masking/stamped policy ahead of owner dispatch. The randomized `CardDestroyed` ForceDestroy copy stays preview-owned as a masking override; randomized `CardGained` now routes through the gain-card owner formatter so `setName`/random/fixed/destination subcases live together.
- Targeted validation run: `bun run typecheck` passed.
- Targeted validation run: `bun run test src/core/tests/actionPreview.test.ts src/core/tests/observability-conformance.test.ts src/core/tests/eventOwnership.test.ts` passed with 48 pass, 1 skip.
- Approved Phase 6 ownership correction: moved `BoonOffered` preview copy out of `src/core/effects/boonChoice.ts` into helper-owned `src/core/engine/actBoonPreview.ts`. `BoonOffered` is emitted by shared `createBoonOffer()` for both act and world-clear sources, so the formatter cannot be owned by only the `OfferBoon` effect handler. Kept the helper separate from `actBoon.ts` to avoid adding a direct engine-helper dependency on the view preview formatting surface.
- Completed Phase 7 by confirming `ProgressDealt`, `HazardResolved`, `HazardPartial`, and `summarizeAggregatedProgress()` remain preview-owned. Their copy is coupled to concealed-hazard masking, newly drawn world-card masking, multi-hazard aggregation, card cost/progress totals, and hook suppression, so no progress copy was migrated to effect modules.
- Completed Phase 8 by replacing the external preview switch with an exact `EXTERNAL_PREVIEW_FORMATTERS` registry in `actionPreview.ts` and exporting `EXTERNALLY_PREVIEWED_EVENT_TYPES`. `eventOwnership.test.ts` now checks that every `effect-family` event type is present in that runtime dispatch registry, without parsing `actionPreview.ts` source.
- Updated `.lore/reference/effect-system-extension-pattern.md` so new effects must consider preview event summaries, observability stamps, tests, and renderer feedback alongside apply/describe/compile/targeting.
- Targeted validation run: `bun run test src/core/tests/eventOwnership.test.ts` passed with 3 pass.
- Targeted validation run: `bun run typecheck` passed.
- Final validation correction: full-suite review found `unlock/world-eden-prime` missing from the asset manifest. Added a manifest binding in `src/game/data/assetManifest.ts` using a static Eden Prime cardfront import, then corrected the binding to satisfy typecheck.
- Final validation passed: `bun run typecheck`, focused plan tests (`actionPreview`, `observability-conformance`, `edenPrime`, `eventOwnership`), and full `bun run test` all passed. Final full-suite result was 1366 pass, 2 skip, 0 fail.
- Final validation correction: added the missing `unlock/world-eden-prime` asset manifest binding by reusing the existing Eden Prime cardfront asset URL. Typecheck correction: changed the binding from the unchecked `worldAssetUrls["eden-prime-cardfront"]` lookup to the guaranteed static Eden Prime cardfront import. Preview/event formatter behavior was not changed.
