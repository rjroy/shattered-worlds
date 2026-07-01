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

- [ ] Step 1 — Registry: replace `WorldCard.persistent` with a keyword-keyed table
- [ ] Step 2 — Engine: rewrite `effectiveWorldCardCost` to read the registry
- [ ] Step 3 — Data: drop the now-redundant per-template field, verify the fixed templates
- [ ] Step 4 — CardView: static face treatment for a carried keyword's cost consequence
- [ ] Step 5 — Tests: rewrite fixtures that construct `persistent` directly, add regression test
- [ ] Step 6 — Docs: reconcile `.lore/reference/theme-authoring.md` with the new model
- [ ] Step 7 — Validation

## Initialization

Ran `lore-researcher` before starting. Findings: no prior notes exist for this plan (fresh implementation). All file/line references in the plan were cross-checked against current source and match within 0-2 lines — no drift. No other lore document mentions `PersistentModifier`/`ClearCostPerKeyword`/`KEYWORD_COST_MODIFIERS` outside the files the plan already cites. Working tree clean apart from the plan file itself.

No `.lore/lore-agents.md` registry exists in this repo, so all three roles (implementation, testing, review) use the `general-purpose` agent fallback.

## Log

(updated per phase)
