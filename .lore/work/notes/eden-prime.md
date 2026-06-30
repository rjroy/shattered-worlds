---
title: "Implementation notes: Eden Prime world"
date: 2026-06-29
status: in_progress
tags: [implementation, notes, eden-prime, startle, alarm, applied-keywords, core-engine]
source: .lore/work/plans/eden-prime.md
modules: [core-engine, world-data, themes, game-view]
---

# Implementation notes: Eden Prime world

Orchestrated implementation of the Eden Prime world (10th world, verb `startle`) from
[.lore/work/plans/eden-prime.md](../plans/eden-prime.md) (spec REQ-EDEN-1..50). The novel
work is Slice 1: a general applied-keyword core-engine mechanism with `Alarm` as its first
instance. Slices 2-4 mirror the established sibling pattern (the-ember-orchard,
city-of-sleeping-giants).

No `.lore/work/tasks/eden-prime/` existed, so the plan's four slices are the phases.
No `.lore/lore-agents.md`, so all three roles fall back to `general-purpose`.

## Progress

- [~] **Slice 1 — Core engine: applied keywords + Alarm** (REQ-EDEN-9..15, 45) — Gate G1 — *impl done, verify dispatched*
  - [x] 1.1 Types
  - [x] 1.2 Keyword helpers
  - [x] 1.3 Effect handlers
  - [x] 1.4 Progress signal
  - [x] 1.5 Turn lifecycle
  - [x] 1.6 Deferred next-world-card
  - [x] 1.7 Threat map
  - [~] Test (Gate G1) — verifier running; impl reports 1326 pass/0 fail, 17 new tests
  - [~] Review — conformance reviewer running
- [ ] **Slice 2 — World data + registration** (REQ-EDEN-1,4,6,7,16-35,46,47) — Gate G2
  - [ ] 2.1 Card templates
  - [ ] 2.2 Boon pool
  - [ ] 2.3 Deck composition
  - [ ] 2.4 Bundle files + registry
  - [ ] Test (Gate G2)
  - [ ] Review
- [ ] **Slice 3 — Assets / presentation / help** (REQ-EDEN-2,3,5,8,36-42,48,49) — Gate G3
  - [ ] 3.1 Base art wiring
  - [ ] 3.2 Insets
  - [ ] 3.3 Renderer Alarm legibility
  - [ ] 3.4 Help/display copy
  - [ ] Test (Gate G3)
  - [ ] Review
- [ ] **Slice 4 — Conformance + seeded gameplay + docs** (REQ-EDEN-43,50, AI Val 1-7) — Gate G4
  - [ ] 4.1 Seeded gameplay test
  - [ ] 4.2 Docs (theme-authoring.md)
  - [ ] 4.3 Full validation (test + lint + typecheck + build)
- [ ] **Final validation** — holistic review against spec REQ-EDEN-1..50

## Log

### Slice 1 — core engine (2026-06-29)
- Impl agent built all of Steps 1.1-1.7 + Gate G1 tests. `bun run test` = 1326 pass / 0 fail (17 new), typecheck + lint clean.
- Impl flagged decisions (accepted): no new `IconId` glyphs (deferred to visual Slice 3 — avoids forcing exhaustive renderer maps now; `compile()` emits text tokens); shallow gate `describe()` (registry init-order constraint, `compile()` recurses fine); `withAppliedKeyword` merge-by-max (refresh-don't-shorten, mirrors `setPlayerFrozen`); event shapes mirror `CardsFrozen`/`BraceChanged` (`{ids,templateIds,...}` not singular `cardId`); `RemoveKeyword.target` typed `"hand"`, strips applied-only.
- **Test verifier** (independent run): confirmed 1326 pass / 0 fail, typecheck clean; 15/17 tests catch intended regressions (numeric-id sort and guard-suppression verified). Three hardening gaps vs literal G1 contract: (5) guard "exactly one" implied not proven; (6) decay-order test asserts 2 adjacencies, not full 6-step chain; (7) no-op test is absence-of-Alarm proxy, not byte-identical baseline.
- **Conformance review**: all 12 contract items met. Findings: #1 `nextWorldCard` hardcodes Alarm, drops `effect.keyword` (should-fix, contradicts stated generality); #2 `KeywordApplied` emitted before `CardsDrawn` (should-fix, ordered-stream defect); #3/#4 hand-scoped lifetime/`self` (nits, document); #5 `as C` casts (nit, no action).
- **Correction pass dispatched** to original impl agent: Fix A (carry keyword through pending field), Fix B (emit KeywordApplied after CardsDrawn), Fix C (document hand-scoped lifetime), + harden tests #5/#6/#7. All within Slice 1 scope; not a divergence.

### Initialization (2026-06-29)
- Read plan and spec. No task files; using plan slices as phases.
- Dispatched `lore-researcher` for prior sibling-world work (notes/retros/reference docs).
- Created this notes file.
- **Research findings:**
  - Sibling `.lore/work/notes/` + `plans/` were deleted after distillation; replaced by reference docs.
  - Canonical guide for the core slice: `.lore/reference/effect-system-extension-pattern.md` (effect = union member + handler/registry + apply case + describe.ts text + playability/target-spec + data/catalog tests; deferred-effect pattern via GameState field resolved at a turn-cycle point).
  - Sibling reference docs: `.lore/reference/ember-orchard-world.md`, `.lore/reference/city-of-sleeping-giants-world.md`. `GainAlarmGuard` is the structural analog of Ember's Brace charges.
  - Core has zero existing Alarm/ApplyKeyword/KeywordGate primitives — Eden is genuinely first.
  - Model bundle on the four-file shape at `src/data/worlds/the-ember-orchard/` (index.ts, meta.ts, cards.json, theme.ts). Card templates go in `src/data/allCards.json`, NOT per-world cards.json.
  - Mirror tests: `src/core/tests/emberOrchard.test.ts`, `src/core/tests/cityOfSleepingGiants.test.ts`, `src/game/tests/emberOrchardPresentation.test.ts`.
  - Gotchas: author `Obstructed` (no `Hidden`); `ReturnWorldCards` inert on auto hooks. `.lore/learned/` and `.lore/work/retros/` are empty.
