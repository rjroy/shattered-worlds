# Refactor: Merge All Card Templates into Unified Catalog

## Summary
Merge every card template from individual world JSONs, boon sets, and starter files into a single global `templates.json` file. Deck compositions and starter deck definitions remain in their current locations.

---

## Current Architecture

### Data Files
| File | Contents | Template Count |
|------|----------|---------------|
| `worlds/*/cards.json` (8 files) | `worldId`, optional settings (`startLight`, `startHeat`, `onEndOfTurnPassive`), `cardTemplates`, `deckComposition` | ~93 |
| `boons/*.json` (6 files) | `worldId`, `cardTemplates` only — no deck info | ~26 |
| `starters/basic.json` | `worldId`, `cardTemplates` (starter player cards + The Walker/Door) | ~8 |
| `starters/starter*.json` (3 files) | Only `starterDeck: [{templateId, count}]` references | 0 templates |

### Assembly Flow
For each world, `buildWorld()` calls:
```ts
assembleCatalog([BASIC_SOURCE, ...BOON_SET_SOURCES, worldSource])
```
This merges basics + all 6 boon sets + that world's cards into one catalog per world.

### Existing Safety Net
- **572 tests pass** across 28 files — baseline to maintain
- `assembleCatalog` enforces strict uniqueness of template IDs across sources
- Template reference resolution is checked for all worlds in test suite
- Boon scoping rules (player-only, zero-cost, exhaust) are tested

---

## Transition Plan

### Phase 1: Data Extraction & Golden-File Generation
Write a script to extract **all** card templates from every source into `src/data/allCards.json`. Verify zero duplicate templateIds. Cross-validate that merged count matches current assembled catalog (~127 total).

**Safety**: No changes to existing code — just creates a new reference file and verifies it.

### Phase 2: Strip cardTemplates from Per-World JSONs
Remove `cardTemplates` from each world's `cards.json`. Remaining files become pure deck descriptors with only:
- `worldId`, optional settings (`startLight`/`startHeat`/`onEndOfTurnPassive`), `deckComposition`

Boon JSONs will be deleted entirely in Phase 7 (their content absorbed). The basic.json starter templates are also absorbed into unified catalog.

**Risk**: Templates removed before loader is updated — tests will break. Must pair with Phase 3 carefully or use the golden file to rehydrate during transition.

### Phase 3: Update Type Definitions and Loader Plumbing
- Create `WorldDeckDescriptor` type (replaces `RawCardSource` for world data files)
- `worldManifest.ts`: Load unified catalog once via static import instead of per-world `assembleCatalog()` call
- `buildWorld()` pairs the unified catalog with each world's deck descriptor + chosen starter — no more template merging at build time

### Phase 4: Update Boon Set Definitions
`fortune.ts` currently imports each boon JSON as `RawCardSource` to extract templates. Post-merge, `BOON_SETS` become pure metadata: `{ setId, templateIds[], setName }`. No more `.source.cardTemplates` — all template data lives in unified catalog.

### Phase 5: Update Tests That Depend on Current Data Design
| Test File | What Breaks | Fix |
|-----------|-------------|-----|
| `catalog.test.ts:17` | "merging starter and zombie-big-box produces 22 templates" — merges two specific sources | Rewrite to test unified catalog directly, or remove (merge completeness guaranteed by single-file authoring) |
| `worldManifest.test.ts:228` | Iterates `set.source.cardTemplates` for boon sync checks | Point at unified catalog — existence checks become simpler |
| `cityOfSleepingGiants.test.ts:69`, `emberOrchard.test.ts:54` | Iterate `bundle.source.cardTemplates` | Reference new world deck descriptor shape |
| `worldRegistry.test.ts` | Uses `bundle.source.cardTemplates` via registry bundles | Update registry to new shape |

### Phase 6: Template Reference Integrity Verification
Re-run critical invariant checks:
1. Every `GainCard`, `AddWorldCardToDeck`, `AddPlayerCardToTop` template reference resolves in unified catalog
2. Every deckComposition `{templateId, count}` resolves
3. Boon set OfferBoon `setId` values resolve
4. Loot pool GainRandomCard `setId` values resolve

### Phase 7: Cleanup Dead Code
- Delete boons/*.json files (content absorbed)
- Strip/remove cardTemplates from basic.json
- Remove unused `BoonSetDefinition.source` imports
- Simplify or remove `assembleCatalog` if no longer needed
- Run `tsc --noEmit`

### Phase 8: Full Regression + Diff Review
- Run all tests — everything must pass (572+ baseline)
- Review git diff to confirm no accidental deletions
- Check Vite build succeeds (asset paths unaffected)
- Commit with clear message and note for easy rollback if needed

---

## Key Risks & Mitigations

1. **TemplateId typos**: Far from definition makes typos harder to catch visually. *Mitigation: Phase 6 automated reference integrity checks.*
2. **Boon scoping rules breakage**: Tests currently check `set.source.cardTemplates`. *Mitigation: These become catalog lookups — same logic, different access pattern.*
3. **`buildWorld(starterId)` API surface**: Must maintain this for all worlds + starters. *Mitigation: Unified catalog loads once; per-world builder still exists but does deck lookup only.*
4. **Hardcoded merge-count assertions** (e.g., "22 templates" = 9 zombies + 12 basics). *Mitigation: Rewrite tests to not depend on intermediate merge counts.*

---

## Files Changed Summary

| File | Change Type | Impact |
|------|-------------|--------|
| `src/data/allCards.json` (new) | NEW — all ~127 templates in one place | — |
| `worlds/*/cards.json` (8 files) | Templates removed; deckComposition kept | High |
| `boons/*.json` (6 files) | DELETED — content absorbed | Medium |
| `starters/basic.json` | Templates removed/absorbed | Low |
| `src/data/worldManifest.ts` | Loader simplified — single catalog import replaces per-world assemble call chain | **HIGH** |
| `src/data/worlds/boons/fortune.ts` | Boon sets become pure templateId lists | Medium |
| `src/core/model/catalog.ts` | RawCardSource shape changes, maybe assembleCatalog simplified | Medium |
| `src/core/tests/catalog.test.ts` | Merge completeness tests rewritten | Low (test-only) |
| `src/core/tests/worldManifest.test.ts` | source.cardTemplates → catalog lookups | Medium (test-only) |
| Several world-specific tests | Similar source.cardTemplates → catalog adjustments | Low-Medium (test-only) |
