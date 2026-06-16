---
title: Final validation sweep
date: 2026-06-15
status: complete
tags: [task, unlocks, validation, review]
source: .lore/work/plans/unlock-system.md
sequence: 10
modules: [unlocks]
---

# Final validation sweep

Whole-spec compliance gate before declaring the feature done. No new production code — verification only.

## What

1. Run the full gate: `bun run typecheck` (V1), `bun run test` (V2, V16, V17, V18, V19), `bun run lint` (V10). All exit 0.
2. Manual confirmations: V9 grep (no `balance`/`spend`/`spendable` JSON keys in persistence); V12 grep (`maxHandSize` gone from `src/core/**`, `src/data/**`, comments excepted); spot-check V3–V8 assertions exist in the named test files; browser pass for V13–V15, V17 (Destiny reachable, purchase end-to-end, affordability gating, budget block).
3. Spec-compliance walk: tick REQ-UNLK-1 … 37 against the implementation. Confirm deferred-by-design items are intentional (`act-reward` inert per REQ-UNLK-23; dedicated run-start loadout screen out of scope; real Blessing-card art separate).

## Validation

- Every validator **V1 … V19** passes (V13–V15, V17 confirmed in-browser).
- Every REQ-UNLK requirement is implemented or explicitly deferred with a recorded reason.
- Any requirement that could not be satisfied as written is flagged, not silently skipped.

## Why

Closes the spec's "AI Validation" section (V1–V19) and the plan's Phase 8. The compliance walk is the closing checklist that the per-phase gates feed into.

## Files

- None (verification only). Findings may prompt edits in earlier files.
