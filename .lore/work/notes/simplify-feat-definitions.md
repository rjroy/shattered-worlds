---
title: "Simplify notes: feat definitions"
date: 2026-06-15
status: complete
tags: [simplify, notes, feats, meta-progression]
source: .lore/work/notes/feat-definitions.md
modules: [feats-profile, feat-evaluator, run-summary-view]
related:
  - .lore/work/notes/feat-definitions.md
  - .lore/work/plans/feat-definitions.md
---

# Simplify notes: feat definitions

## Files processed

- `src/data/feats/types.ts`
- `src/data/feats/catalog.ts`
- `src/data/feats/catalog.test.ts`
- `src/game/runtime/featEvaluator.ts`
- `src/game/runtime/featEvaluator.test.ts`
- `src/game/runtime/gameplayRuntime.ts`
- `src/game/runtime/gameplayRuntime.test.ts`
- `src/game/view/RunSummaryView.ts`
- `src/game/view/RunSummaryView.test.ts`
- `src/game/scenes/TableScene.ts`

## Cleanup applied

1. `types.ts` — Removed `// REQ-FEAT-1/2/3` requirement-label comments
2. `catalog.ts` — Removed `// REQ-FEAT-22` comment
3. `featEvaluator.ts` — Stripped `REQ-FEAT-10, REQ-FEAT-11` references from section divider
4. `RunSummaryView.ts` — Collapsed duplicated "Tap to continue" text block: hoisted `continueY = 184` before the feats branch, feats branch updates it, single text creation follows. Eliminated the else-only copy.

## Gate results

- `bun run test`: 796/796 pass (behavior preserved)
- `tsc --noEmit`: clean
- `bun run lint`: clean

## Review findings — pre-existing spec deviations (not from simplification)

The plan-reviewer identified four non-conformances in the original implementation of `types.ts` and `catalog.ts`. These predate the simplification pass and were not introduced by it. All tests pass, so these are type-level gaps, not behavioral bugs.

| # | Location | Spec requirement | Implementation | Severity |
|---|---|---|---|---|
| 1 | `types.ts:4` | `value: number \| string \| boolean` | `value: number \| string` | Medium — boolean feats (`diedTo`) won't type-check |
| 2 | `types.ts:11-13` | `FeatReward = RewardItem[]` (plain alias) | `FeatReward = { items: RewardItem[] }` (wrapper) | Medium — multi-file structural mismatch |
| 3 | `types.ts:15-20` | `FeatDefinition.description: string` | `description` field absent everywhere | Medium — all 11 catalog entries lack descriptions |
| 4 | `types.ts:9` | `\| { type: 'unlock'; id: string }` explicit variant | Open catch-all `\| { type: string; [key: string]: unknown }` | Low — loses type specificity on the named variant |
| 5 | `featEvaluator.test.ts:522` | Test #22 setup should be `runs: 9` → +1 run → `runs: 10` | Stub already has `runs: 10` (correct post-run state) | Low — fidelity gap in test description, behavior correct |

Findings 1–4 need a follow-up fix pass. Finding 5 is acceptable.
