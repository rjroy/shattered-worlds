---
title: "Implementation notes: fortune-boon-cards"
date: 2026-06-17
status: complete
tags: [implementation, notes, fortune, boon-cards]
source: .lore/work/plans/fortune-boon-cards.md
modules: [data-unlocks, core-engine, game-runtime, card-data, table-ui]
related: [.lore/work/plans/fortune-boon-cards.md]
---

# Implementation notes: fortune-boon-cards

## Progress

- [x] Phase 1 - Unlock config and run modifier shape
- [x] Phase 2 - Boon-only card data and global pool assembly
- [x] Phase 3 - Core pending choice model, events, action gates, and template lookup
- [x] Phase 4 - Deterministic offer generation on real act advancement
- [x] Phase 5 - Runtime event stream compatibility
- [x] Phase 6 - Table scene boon-choice overlay
- [x] Holistic validation

## Log

- 2026-06-17: Started implementation from `.lore/work/plans/fortune-boon-cards.md`.
- 2026-06-17: Lore research completed. Relevant prior work confirms `act-reward` was intentionally inert, runtime unlock plumbing already exists, and Fortune must hook act advancement from the reducer rather than opening `startTurn`.
- 2026-06-17: Phase 1 completed. Fortune now has stable `act-reward` identity with cost 70, destiny weight 3, implemented copy, `RunModifiers.actBoon`, and a `fortune-v1` pool manifest. Validation passed: `bun run typecheck`, focused unlock/runtime tests, and stale `NotImplemented` grep.
- 2026-06-17: Phase 2 completed. Added global Fortune boon card data, included it in every assembled world catalog, and added tests for catalog presence, leak prevention, exhaust player-card shape, and recursive forbidden-effect validation. Validation passed: `bun run typecheck` and focused world manifest/registry/catalog tests.
- 2026-06-17: Phase 3 completed. Added `pendingActBoon`, `ChooseActBoon`, `ActBoonOffered`, `BoonCardGranted`, pending-action gates, direct-to-hand boon minting, and session template lookup. Validation passed: `bun run typecheck`, focused reducer/availability tests, and gameplay session tests.
- 2026-06-17: Phase 4 completed. Added deterministic act-boon offer creation, hooked it to real `ActAdvanced` batches from `EndTurn`, skipped post-refill loss checks while a boon choice is pending, and covered deterministic/recovery cases in reducer tests. Validation passed: `bun run typecheck` and focused reducer tests.
- 2026-06-17: Phase 5 completed. Runtime event tests now prove `ActAdvanced` and `ActBoonOffered` share the same gameplay batch, `ChooseActBoon` emits `BoonCardGranted`, and direct-to-hand boons do not emit `CardGained`. Runtime tests also cover purchased-but-inactive Fortune. Validation passed: `bun run typecheck` and focused runtime tests.
- 2026-06-17: Review pass over Phases 1-5 found a runtime test type-narrowing issue and a missing different-seed assertion. Both were corrected. Validation passed: `bun run typecheck` and focused reducer/gameplay session tests.
- 2026-06-17: Phase 6 completed. Added a dedicated template-based act-boon overlay, TableScene pending-choice rendering and interaction guards, pointer/number-key dispatch, missing-template error state, and focused UI tests. Validation passed: `bun run typecheck` and `bun run test src/game/tests/actBoonChoiceView.test.ts`.
- 2026-06-17: Holistic validation found stale full-suite card catalog expectations and an insufficient REQ-FORTUNE-21 authoring guard. Both were corrected. Validation passed: `bun run typecheck`, focused card/world manifest tests, and full `bun run test` with 877 passing tests.
- 2026-06-17: Holistic validation also found a plan divergence: `drawWorld` can emit multiple `ActAdvanced` events during one refill, but the implemented state model has only one `pendingActBoon`. Fully satisfying one choice per real `ActAdvanced` in that edge case requires either adding a queued pending-boon model or explicitly scoping Fortune to one offer per dispatch. Awaiting user direction before changing behavior.
- 2026-06-17: User approved the one-offer-per-dispatch divergence. Fortune now explicitly creates at most one pending act boon choice for a reducer dispatch, even when a single `EndTurn` refill emits multiple `ActAdvanced` events. The offer uses the first `ActAdvanced.act` from that refill event batch.
- 2026-06-17: Implementation complete. Final validation passed: `bun run typecheck`, focused reducer tests, and full `bun run test` with 878 passing tests.
