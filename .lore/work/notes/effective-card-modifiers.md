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
- [ ] Phase 3: Wire effective cards into available actions
- [ ] Phase 4: Wire snapshots into reducer play resolution
- [ ] Phase 5: Add unlock catalog plumbing and playtest unlocks
- [ ] Phase 6: Expose effective-card read models for the scene
- [ ] Phase 7: Render visible hand from effective cards
- [ ] Phase 8: Stabilize UI selected-card snapshots
- [ ] Phase 9: Use selected snapshots for previews and connector styles
- [ ] Phase 10: Full validation and cleanup
- [ ] Holistic validation against source spec

## Log

### 2026-06-18

- Initialized from `.lore/work/plans/effective-card-modifiers.md`.
- No `.lore/work/tasks/effective-card-modifiers/` directory exists, so plan steps are the implementation phases.
- No prior `.lore/work/notes/effective-card-modifiers.md` existed.
- Research pass mapped the main risks: derive before history increment, keep durable base cards unmodified, route target-spec changes through `availableActions`, refresh reused `CardView` instances, and keep UI selected snapshots stable.
- Phase 1 complete. Added pure-data card modifier types, `RunModifiers.playerCardModifiers`, `TurnPlayHistory`, `GameState.turnPlayHistory`, and `createWorld` initialization. Phase 1 tester reported `bun run typecheck` passed. Phase 1 reviewer found no issues in the required type/history surface.
- A review pass initially flagged starter-deck/catalog changes as out of scope; those were user-owned changes and were restored before the user committed them separately. Future phases must not modify starter-contractor files unless explicitly required.
- Phase 2 complete. Added `effectivePlayerCard` in `src/core/engine/effectiveCards.ts` and focused tests in `src/core/tests/effectiveCards.test.ts`. Tester reported `bun test src/core/tests/effectiveCards.test.ts` and `bun run typecheck` passed. Reviewer found no Phase 2 non-conformances.
