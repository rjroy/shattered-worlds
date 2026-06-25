---
title: "Implementation notes: oversized-hand-layout"
date: 2026-06-25
status: complete
tags: [implementation, notes, hand-layout]
source: .lore/work/plans/oversized-hand-layout.md
modules: [game-ui, game-tablescene, game-layout, tests]
---

# Implementation notes: oversized-hand-layout

## Progress

- [x] Phase 1: Add Pure Row Windowing Model
- [x] Phase 2: Add TableScene Row Window State
- [x] Phase 3: Render Row Navigation Chrome
- [x] Phase 4: Preserve Selection And Targeting Across Windows
- [x] Phase 5: Update Scene And Interaction Tests
- [x] Phase 6: Browser Smoke Test
- [x] Holistic validation

## Log

- 2026-06-25: Started implementation from `.lore/work/plans/oversized-hand-layout.md`. No task breakdown files were present under `.lore/work/tasks/`, so the six plan steps are being used as implementation phases.
- 2026-06-25: Lore research found the main constraints: keep oversized hands legal in core state, window only renderer objects, rely on existing `desiredIds` cleanup for off-window `CardView`s, and treat selection/connector behavior as the highest-risk integration area.
- 2026-06-25: Phase 1 complete. Added pure row windowing helpers and tests in `src/game/view/tableLayout.ts` and `src/game/tests/tableLayout.test.ts`. Focused test run passed: `bun test src/game/tests/tableLayout.test.ts` with 15 tests and 62 assertions. Review found no Step 1 non-conformances.
- 2026-06-25: Phase 2 implementation added renderer row offsets and windowed `layoutRow()` calls in `TableScene.ts`. First validation failed before `cardObjects.test.ts` ran because Bun parsed `src/game/assets/audio/main-theme.mp3` through the `TableScene` import chain. Testing also flagged that the `cardObjects.test.ts` `layoutRow` harness likely needs the new positions-based signature.
- 2026-06-25: Phase 2 complete after correcting the focused test path. `src/game/tests/testSetup.ts` now mocks the MP3 URL import for Bun tests, and `cardObjects.test.ts` harnesses the positions-based `layoutRow()` signature. Focused validation passed: `bun test src/game/tests/tableLayout.test.ts src/game/tests/cardObjects.test.ts` with 88 tests. Review found no Step 2 non-conformances.
- 2026-06-25: Phase 3 first implementation added row nav chrome and passed focused tests/typecheck, but review found two non-conformances: controls at `x=286/450/614` and `y=260/300` overlap likely hover-scaled card space, and the added test called `navigateRow()` directly instead of exercising real button behavior or proving independent world/player paging.
- 2026-06-25: Phase 3 correction moved buttons to hard-left/hard-right side gutters (`x=28/872`), raised nav depth, and strengthened tests for real controls and independent paging. Re-review found the same pointer-safety class of issue remains for range labels: `world.labelX=92` and `player.labelX=780` still occupy edge-card hover space while rendering above hovered cards. This is the second failed attempt on the Step 3 overlap issue, so implementation is paused for user direction per the implement workflow.
- 2026-06-25: User authorized continuing the Phase 3 overlap fix. Subsequent corrections moved row nav chrome into hover-safe inter-row side gutters, added safe-rectangle tests for buttons/labels/card hover zones, fixed label/button and cross-row button overlap, and replaced direct `navigateRow()` test shortcuts with production `CommonButton` pointerdown wiring. Focused tests and typecheck passed, and final Phase 3 review found no non-conformances.
- 2026-06-25: Phase 4 complete. Targeting repaint now brings the acting player card into view; row navigation during targeting preserves selection, selected snapshot, completed picks, and current picks; range labels surface off-window legal targets; and `showConnector()` no-ops when an endpoint is hidden and redraws when both are visible. Focused `cardObjects`, `tableLayout`, and typecheck passed. Review found no non-conformances.
- 2026-06-25: Phase 5 first pass added 23-card harness coverage and passed focused tests/typecheck, but review found the scene tests too shallow: they stubbed `layoutRow()` so they did not prove real `CardView` creation/cleanup, and the off-window playable-card test called `onCardClick()` directly after a stubbed repaint rather than proving the card was recreated/rendered and clickable after navigation.
- 2026-06-25: Phase 5 complete after strengthening integration coverage. `makeDrawAllHarness()` now exercises real `drawAll()`/`layoutRow()`/`obtainCardContainer()` reconciliation while recording row slices; tests assert only visible cards have `CardView`s, off-window views are destroyed/recreated, an initially off-window card remains in `game_.state.hand`, and it can be acted on through a recreated `CardView` pointer path after navigation. Focused tests passed with 97 tests and typecheck passed. Review found no non-conformances.
- 2026-06-25: Phase 6 browser smoke passed with limitations. The Vite app ran at `http://127.0.0.1:5174/shattered-worlds/`, and an oversized browser-only state with 24 hand cards showed five full-size cards per row, accurate labels, and independent row paging. Screenshot captured at `/tmp/shattered-worlds-phase6-oversized-hand.png`. Help/settings opened, end-turn was visible, and normal-table targeting/cancel/confirmation/connector behavior was smoke-tested. Limitation: no persistent debug route or seed hook existed, so the oversized state was injected only into the live browser scene; run summary was not exercised.
- 2026-06-25: Holistic validation initially found keyboard navigation missing, then found a tension between keeping the acting card visible and reaching off-window player targets. Final fixes added bracket-key row paging and adjusted targeting navigation so actor pinning is relaxed only when needed to reveal a legal off-window player target. Final validation passed for `REQ-HANDLAYOUT-1` through `REQ-HANDLAYOUT-14` and plan steps 1-6. Final focused validation passed: `bun test src/game/tests/tableLayout.test.ts src/game/tests/cardObjects.test.ts` with 99 tests and 418 assertions, plus `bun run typecheck`.
