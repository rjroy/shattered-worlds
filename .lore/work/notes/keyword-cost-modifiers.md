---
title: "Implementation notes: keyword-level cost modifiers"
date: 2026-07-01
status: in_progress
tags: [refactor, keywords, new-derelict, cardview, bugfix]
source: .lore/work/plans/keyword-cost-modifiers.md
modules: [core-model, core-engine, game-view, new-derelict]
---

# Implementation notes: keyword-level cost modifiers

## Progress

- [x] Step 1 — Registry: replace `WorldCard.persistent` with a keyword-keyed table
- [x] Step 2 — Engine: rewrite `effectiveWorldCardCost` to read the registry
- [x] Step 3 — Data: drop the now-redundant per-template field, verify the fixed templates
- [x] Step 4 — CardView: static face treatment for a carried keyword's cost consequence
- [x] Step 5 — Tests: rewrite fixtures that construct `persistent` directly, add regression test
- [x] Step 6 — Docs: reconcile `.lore/reference/theme-authoring.md` with the new model
- [ ] Step 7 — Validation

## Initialization

Ran `lore-researcher` before resuming. Commit `3a2ea3b` had already implemented Steps 1-3, while this notes file still showed every step as pending. The working tree was clean. No task-file directory exists for this plan.

No `.lore/lore-agents.md` registry exists in this repo, so all three roles (implementation, testing, review) use the `general-purpose` agent fallback.

## Log

- 2026-07-01 — Step 1 was already implemented in `3a2ea3b`. Implementation inspection and review found no non-conformances; focused model tests passed 33/33. Repository typecheck remains blocked by three stale `persistent` test fixtures assigned to Step 5.
- 2026-07-01 — Step 2 was already implemented in `3a2ea3b`. Review found no non-conformances. Action-preview tests passed 36/36; the effective-cards suite had one obsolete assertion that expects the bug and is assigned to Step 5.
- 2026-07-01 — Step 3 was already implemented in `3a2ea3b`. Review found no non-conformances; focused catalog/cards/New Derelict tests passed 37/37.
- 2026-07-01 — User approved bundling Step 4 with this change. Use the plan's recommended current-keyword-only treatment; no speculative analysis of keywords a template could receive.
- 2026-07-01 — Step 4 implemented in `CardView.ts`. It renders deduplicated registered-modifier lines for currently carried keywords through the existing reveal-aware effect-line pattern. Review found no non-conformances; relevant view suites passed 96/96. Existing tests do not directly assert the new text/container; global typecheck remains blocked only by Step 5 fixtures.
- 2026-07-01 — Step 5 migrated stale fixtures, replaced the obsolete bug assertion with an authored `Obstructed` no-registry case, and added a Systems Panel Lockdown-cluster regression. Direct CardView text and conceal/reveal coverage was also added.
- 2026-07-01 — The CardView test initially exposed Bun loading a Vite-managed WebP through `TableScene`. First mock attempt omitted `mainThemeMusic`; the second supplied both runtime audio-manifest exports and passed. Final targeted result: 68/68 tests plus typecheck. Review found no non-conformances. The unrelated pre-existing `cardObjects.test.ts` direct Bun WebP-loader failure remains outside this phase.
- 2026-07-01 — Step 6 updated `theme-authoring.md` to document centralized keyword modifiers, uniform authored/applied behavior, and removal of `WorldCard.persistent`. Requirement verification passed and review found no non-conformances.
- 2026-07-01 — Step 7 targeted validation passes: 59/59 specified core tests, 9/9 focused CardView tests, lint, typecheck, and build. The first lint pass found an unused final `currY` assignment; the final correction restores cursor advancement and makes the discard indicator consume it with its previous bottom position as a cap. Review found no non-conformances.
- 2026-07-01 — Full suite result: 1393 pass, 2 skip, 5 fail in unrelated unlock asset binding, Whiteout feat, and Destiny/unlock-budget tests. These failures are outside the keyword-cost-modifier diff and were not changed.
- 2026-07-01 — Manual validation was attempted twice but could not reach the required clustered Lockdown state deterministically. The app generates a random seed, constructs `TableScene` state internally, exposes no state injection on `window`, and has no existing URL/debug fixture for this hand. Adding such tooling would expand beyond the plan and requires authorization.
- 2026-07-01 — Holistic review found no unmet implementation requirements or divergence. REQ-DERELICT-11/30/45's optional per-card field language is superseded by this plan and its Systems Panel regression; retain the historical spec text and note the supersession in a future retro.
