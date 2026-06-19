---
title: "Implementation notes: offer-boon-rewards"
date: 2026-06-18
status: in_progress
tags: [implementation, notes, rewards, boons]
source: .lore/work/plans/offer-boon-rewards.md
modules: [core-engine, card-effects, game-runtime, table-ui, card-data]
---

# Implementation notes: offer-boon-rewards

## Progress

- [x] Phase 1: Introduce generic boon-choice core types
- [x] Phase 2: Generalize offer generation and choice resolution
- [x] Phase 3: Add `OfferBoon` as a card effect
- [x] Phase 4: Expose boon sets outside the Fortune-only naming
- [x] Phase 5: Generalize gameplay UI
- [ ] Phase 6: Update runtime/session event expectations
- [x] Phase 7: Author one real `OfferBoon` world reward
- [x] Phase 8: Update tests and stale names across the repo
- [ ] Holistic validation against source artifact

## Log

- Initialized from `.lore/work/plans/offer-boon-rewards.md`. No `.lore/work/tasks/offer-boon-rewards/` task files were present, so the plan's eight steps are the implementation phases.
- `.lore/lore-agents.md` was not present, so the implementation workflow is using the available default sub-agent roles.
- Phase 1 complete. Core type surface now uses generic `PendingBoonChoice`, `pendingBoonChoice`, `ChooseBoon`, destination-aware `BoonCardGranted`, and discriminated `BoonOffered` events where act-source offers require `act`. `bun run typecheck` still fails on expected unmigrated call sites, which Phase 2+ will address. Review caught the initial optional-act event shape; a correction tightened it before phase completion.
- Phase 2 complete. `createBoonOffer` now owns legal exhaust-player template filtering, dedupe, deterministic shuffle/RNG advancement, pending choice creation, and `BoonOffered` emission. Fortune act rewards call it through the existing `actBoon` modifier path and still do not trigger on the opening deal.
- Phase 2 choice resolution now uses `ChooseBoon`, validates offered exhaust player templates, grants to hand or `playerDiscard` from `bToDiscard`, clears `pendingBoonChoice`, and emits destination-aware `BoonCardGranted`.
- Validation passed: `bun test src/core/tests/reduce.test.ts src/game/runtime/gameplaySession.test.ts src/data/unlocks/catalog.test.ts` and `bun run typecheck`.
- Phase 3 complete. Added hook-only `OfferBoon` effect handling, world-clear boon offer creation through `createBoonOffer`, default hand destination, pending-choice fail-closed behavior, no-legal-options fail-closed behavior, unknown-set fail-closed behavior, and display/glyph output. Review rejected an initial local `fortune-v1` resolver shim; the correction now resolves through `FORTUNE_BOON_POOLS` until Phase 4 introduces a generic registry.
- Phase 3 surfaced the existing `registry -> composite -> describe/available -> registry` initialization cycle. Composite recursive describe/spec/playability dispatch now resolves the registry lazily at method call time, preserving behavior while avoiding module re-entry during registry construction.
- Validation passed: `bun test src/core/tests/effectRegistry.test.ts src/core/tests/effects.test.ts src/core/tests/reduce.test.ts src/game/tests/describe.test.ts src/game/tests/effectGlyphs.test.ts` and `bun run typecheck`.
- Phase 4 complete. Added `BOON_SETS` as the generic boon set registry with `fortune-v1`, kept `FORTUNE_BOON_POOLS` as a compatibility alias, and moved both unlock modifier building and `OfferBoon` lookup onto the shared registry. World assembly now includes all registered boon set sources. Manifest tests now verify registered boon templates are present in every assembled catalog, authored `OfferBoon.setId` references resolve recursively including `onPartialClear`, and boon set `templateIds` exactly match their source card templates. Validation passed: `bun test src/core/tests/worldManifest.test.ts src/data/unlocks/catalog.test.ts src/core/tests/effects.test.ts` and `bun run typecheck`.
- Phase 5 complete. Renamed the gameplay boon choice view/test to generic `BoonChoiceView` naming, added destination-aware hand/discard copy, removed Fortune-specific missing-template UI/log wording, and renamed TableScene's boon-choice private fields/methods while keeping modal blocking, selection clearing, connector clearing, pointer choice, and number-key `ChooseBoon` dispatch intact. Validation passed: `bun test src/game/tests/boonChoiceView.test.ts src/game/tests/cardObjects.test.ts src/game/tests/hud.test.ts` and `bun run typecheck`.
