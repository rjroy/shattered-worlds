---
title: "Implementation notes: oversized-hand-layout"
date: 2026-06-25
status: in_progress
tags: [implementation, notes, hand-layout]
source: .lore/work/plans/oversized-hand-layout.md
modules: [game-ui, game-tablescene, game-layout, tests]
---

# Implementation notes: oversized-hand-layout

## Progress

- [x] Phase 1: Add Pure Row Windowing Model
- [x] Phase 2: Add TableScene Row Window State
- [ ] Phase 3: Render Row Navigation Chrome
- [ ] Phase 4: Preserve Selection And Targeting Across Windows
- [ ] Phase 5: Update Scene And Interaction Tests
- [ ] Phase 6: Browser Smoke Test
- [ ] Holistic validation

## Log

- 2026-06-25: Started implementation from `.lore/work/plans/oversized-hand-layout.md`. No task breakdown files were present under `.lore/work/tasks/`, so the six plan steps are being used as implementation phases.
- 2026-06-25: Lore research found the main constraints: keep oversized hands legal in core state, window only renderer objects, rely on existing `desiredIds` cleanup for off-window `CardView`s, and treat selection/connector behavior as the highest-risk integration area.
- 2026-06-25: Phase 1 complete. Added pure row windowing helpers and tests in `src/game/view/tableLayout.ts` and `src/game/tests/tableLayout.test.ts`. Focused test run passed: `bun test src/game/tests/tableLayout.test.ts` with 15 tests and 62 assertions. Review found no Step 1 non-conformances.
- 2026-06-25: Phase 2 implementation added renderer row offsets and windowed `layoutRow()` calls in `TableScene.ts`. First validation failed before `cardObjects.test.ts` ran because Bun parsed `src/game/assets/audio/main-theme.mp3` through the `TableScene` import chain. Testing also flagged that the `cardObjects.test.ts` `layoutRow` harness likely needs the new positions-based signature.
- 2026-06-25: Phase 2 complete after correcting the focused test path. `src/game/tests/testSetup.ts` now mocks the MP3 URL import for Bun tests, and `cardObjects.test.ts` harnesses the positions-based `layoutRow()` signature. Focused validation passed: `bun test src/game/tests/tableLayout.test.ts src/game/tests/cardObjects.test.ts` with 88 tests. Review found no Step 2 non-conformances.
- 2026-06-25: Phase 3 first implementation added row nav chrome and passed focused tests/typecheck, but review found two non-conformances: controls at `x=286/450/614` and `y=260/300` overlap likely hover-scaled card space, and the added test called `navigateRow()` directly instead of exercising real button behavior or proving independent world/player paging.
- 2026-06-25: Phase 3 correction moved buttons to hard-left/hard-right side gutters (`x=28/872`), raised nav depth, and strengthened tests for real controls and independent paging. Re-review found the same pointer-safety class of issue remains for range labels: `world.labelX=92` and `player.labelX=780` still occupy edge-card hover space while rendering above hovered cards. This is the second failed attempt on the Step 3 overlap issue, so implementation is paused for user direction per the implement workflow.
