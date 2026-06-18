---
title: "Implementation notes: effective-card-modifiers"
date: 2026-06-18
status: in_progress
tags: [implementation, notes, effective-cards, card-modifiers]
source: .lore/work/plans/effective-card-modifiers.md
modules: [unlocks, core-engine, card-system, table-scene]
related: [.lore/work/specs/effective-card-modifiers.md, .lore/work/brainstorm/unlocks-modifying-card-templates.md]
---

# Implementation notes: effective-card-modifiers

## Progress

- [x] Phase 1: Add modifier and history types
- [x] Phase 2: Build effective-card derivation
- [x] Phase 3: Wire effective cards into available actions
- [x] Phase 4: Wire snapshots into reducer play resolution
- [x] Phase 5: Add unlock catalog plumbing and playtest unlocks
- [x] Phase 6: Expose effective-card read models for the scene
- [x] Phase 7: Render visible hand from effective cards
- [x] Phase 8: Stabilize UI selected-card snapshots
- [x] Phase 9: Use selected snapshots for previews and connector styles
- [x] Phase 10: Full validation and cleanup
- [x] Holistic validation against source spec

## Log

### 2026-06-18

- Initialized from `.lore/work/plans/effective-card-modifiers.md`.
- No `.lore/work/tasks/effective-card-modifiers/` directory exists, so plan steps are the implementation phases.
- No prior `.lore/work/notes/effective-card-modifiers.md` existed.
- Research pass mapped the main risks: derive before history increment, keep durable base cards unmodified, route target-spec changes through `availableActions`, refresh reused `CardView` instances, and keep UI selected snapshots stable.
- Phase 1 complete. Added pure-data card modifier types, `RunModifiers.playerCardModifiers`, `TurnPlayHistory`, `GameState.turnPlayHistory`, and `createWorld` initialization. Phase 1 tester reported `bun run typecheck` passed. Phase 1 reviewer found no issues in the required type/history surface.
- A review pass initially flagged starter-deck/catalog changes as out of scope; those were user-owned changes and were restored before the user committed them separately. Future phases must not modify starter-contractor files unless explicitly required.
- Phase 2 complete. Added `effectivePlayerCard` in `src/core/engine/effectiveCards.ts` and focused tests in `src/core/tests/effectiveCards.test.ts`. Tester reported `bun test src/core/tests/effectiveCards.test.ts` and `bun run typecheck` passed. Reviewer found no Phase 2 non-conformances.
- Phase 3 complete. `availableActions` and `legalTargets` now derive effective cards for player-card affordability and target specs. Review found two modal/sequence target indexing issues; fixes added all-step `Sequence.isPlayable`, path-aware validation, and public `legalTargets(cardId, step, choice?)` support for nested `Sequence -> Modal` branch targets. Final review found no remaining Phase 3 issues; `bun test src/core/tests/available.test.ts` passed with 50 tests.
- Phase 4 complete. Reducer play resolution now derives an effective snapshot before history/event/spend/effect work, increments `turnPlayHistory` only for legal plays, emits strict `CardPlayed` metadata, uses snapshot cost/effect/exhaust, keeps base card identities in zones/events, and resets history on `EndTurn`. Retest passed reducer, available, effective-card, gameplay event stream, and typecheck gates. Final review found no issues.
- Phase 5 complete. Added `playerCardModifier` unlock effects, `buildRunModifiers` aggregation, and playtest unlocks for first Sprint free, Panic response, and second Explore push. Catalog, profile/store, core effective-card, reducer, and typecheck checks passed. Review found no issues and confirmed starter-contractor user work was untouched.
- Phase 6 complete. Exported `effectivePlayerCard`, `effectiveCard`, and `effectiveHand` through the core contract surface. Added pure mixed-hand helper coverage. Typecheck and focused effective-card tests passed; review found no import-boundary or helper issues.
- Phase 7 complete. `TableScene.drawAll` now renders hand rows from `effectiveHand`, preserves shared ids, and refreshes reused player-card containers when effective display signatures change. Focused card-object tests, core tests, typecheck, and the full game test suite passed. Review found no issues and confirmed selection/preview work was not pulled forward.
- Phase 8 complete. Table interaction now captures selected effective snapshots, starts targeting/modal specs from that snapshot, keeps active target steps stable through state changes, clears snapshots on modal dismissal/cancel/completion/end/discard/act-boon interruption, and leaves reducer validation authoritative. Corrected review findings around live legality recomputation and modal dismissal cleanup. Focused selection/card-object tests, full game tests, available tests, and typecheck passed; final review found no issues.
- Phase 9 complete. Target preview and connector style now use the selected effective snapshot for the active selected card, with preview gating through stable selection target eligibility. Added coverage for appended effective progress preview and progress/return/destroy connector styles after live modifiers are removed. Focused tests, full game tests, available tests, and typecheck passed; final review found no issues.
- Phase 10 complete. Full validation passed: `bun run typecheck`, `bun test --preload ./src/game/tests/testSetup.ts`, `bun run lint`, and `bun run build`. Final test count was 915 passed. Remaining warnings were expected failure-path test logs and Vite chunk-size warnings.
- Holistic validation complete. Review findings were corrected: gameplay session payload expectations now include strict `CardPlayed` metadata, modal snapshots persist through branch choice, scene target eligibility aligns with core handler semantics, `second-explore-push` avoids ambiguous duplicate hazard targeting, and nested modal steps inside compound effective selections open the chooser and complete with both `choice` and `targetId`.
