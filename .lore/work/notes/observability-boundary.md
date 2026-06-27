---
title: "Implementation notes: observability boundary"
date: 2026-06-26
status: complete
tags: [implementation, notes, observability, preview, sim, rng]
source: .lore/work/plans/observability-boundary.md
modules: [core, sim]
---

# Implementation notes: observability boundary

Implementing [.lore/work/plans/observability-boundary.md](../plans/observability-boundary.md)
(design: [.lore/work/design/observability-boundary.md](../design/observability-boundary.md)).

Orchestrated implementation: each phase dispatched to sub-agents (implement → test → review).

## Key context from research

- `actionPreview.ts` lives in **`src/core/view/actionPreview.ts`** (tests at
  `src/core/tests/actionPreview.test.ts`), NOT `src/game/`. Masking stays in core
  (preview is a pure core read-model). Plan line refs are relative to that file.
- The `sourceCardId` stamp lives on the `GameEvent` intersection at
  `src/core/model/types.ts:306,386`. Existing fail-pattern test:
  `src/core/tests/eventProvenance.test.ts` — mirror its structure for the
  conformance test.
- Reference constraint: "hidden consequences count as harmful for confirmation" —
  `classifyRisk`/`severityForRisk` must stay untouched.
- Sim today: `src/sim/run.ts` calls `pickAction(state, Math.random.bind(Math))`
  (non-seeded). `src/sim/policy.ts` exports `pickAction`. `src/sim/accounting.ts`
  has `checkIdAccounting`.
- No task files; phases come from the plan's 7 steps. No agent registry; all roles
  use `general-purpose`.

## Progress

- [x] Step 1 — Observability model helper (`src/core/model/observability.ts`)
- [x] Step 2 — Widen `GameEvent` + stamp at emit sites
- [x] Step 3 — Rule-based masking + fix two live leaks
- [x] Step 4 — Fail-closed conformance test
- [x] Step 5 — `determinize(state, rng)` helper (`src/sim/determinize.ts`)
- [x] Step 6 — `Policy` seam in `src/sim`
- [x] Step 7 — Final validation against the design

## Log

- 2026-06-26: Initialized. Read plan + design. lore-researcher confirmed
  architecture sound; surfaced the `actionPreview.ts` path correction (core/view,
  not game). No prior decisions contradict the plan.
- 2026-06-26: **Step 1 complete.** New `src/core/model/observability.ts` exports
  `hiddenZones(state)` → `[playerDraw, worldDraw, ...acts]` (shape:
  `readonly (readonly Card[])[]`) and `isHidden(card, state)` (folds `isConcealed`
  + id-membership). Re-exported from `contract.ts:26` (flows through `index.ts` via
  `export *`). New test `observability.test.ts` (4 tests). Test suite 1329 pass /
  0 fail; typecheck clean. Fresh-context review: PASS, no non-conformances.
- 2026-06-26: **Step 2 complete.** `GameEvent` intersection in `types.ts` widened
  with `randomized?` and `revealedFromHidden?`. All 9 audited sites stamped
  (draw.ts: drawPlayer/drawWorld CardsDrawn + HazardAdded revealedFromHidden,
  resolveForceDestroy CardDestroyed randomized coexisting with sourceCardId;
  worldCards ExileTopWorldCards revealedFromHidden; heat Freeze randomized;
  gainCard GainRandomCard randomized; recallDiscard random-only randomized via
  caller post-process, recallToTop signature untouched; actBoon createBoonOffer
  randomized covering both callers). Determinize-only sites left clean. New test
  `observability-stamps.test.ts` (12 tests). Suite 1342 pass / 0 fail; typecheck
  clean. Fresh-context review ran an independent two-axis audit against
  `effects/registry.ts` and all rng/hidden-zone consumers: PASS, no missed sites.
  Note: opening-hand CardsDrawn IS stamped (correct — genuine reveal); the
  "opening deal" exclusion refers to createWorld's event-less shuffles.
- 2026-06-27: **Step 3 complete.** `actionPreview.ts` (in `src/core/view/`):
  new `summarizeStampedEvent` runs first in the per-event loop; stamped events get
  generic name-free summaries. Both live leaks fixed (WorldCardsExiled → "Exile top
  N world cards"; randomized CardDestroyed → "Destroy N player cards"). setName
  keying replaced by `randomized` stamp for CardGained. Taint machinery contracted:
  removed CardsDrawn/HazardAdded/DeckShuffled cases, kept CardsDiscarded/CardsThawed
  + concealed-hook paths. classifyRisk/severityForRisk untouched (masked freeze/
  destroy still harmful). **Design note / approved refinement:** stamp check is
  guarded by `!eventIsConcealed` so a stamped-AND-concealed event gets wholesale
  concealed-masking (a generic "Freeze N" line would still betray that a concealed
  card freezes). Review confirmed this leaks nothing and preserves the validity of
  removing CardsDrawn/HazardAdded from taint. Suite 1345 pass / 0 fail; typecheck
  clean. Fresh-context review: PASS.
- 2026-06-27: **Step 4 complete.** New `observability-conformance.test.ts` drives
  real states through every audited path via `previewAction` and asserts both the
  stamp AND name-free summary (12 pass, 1 skip for unemitted CardsBurnedForHeat).
  Header documents the audit-two-axes rule. Fail-closed proven twice independently:
  implementer removed CardsFrozen stamp (failed→restored), reviewer removed
  CardGained stamp (failed→restored). Fresh-context review: PASS, name-free
  assertions confirmed non-vacuous (asserted-absent strings are real card names).
- 2026-06-27: **Step 5 complete.** New `src/sim/determinize.ts`:
  `determinize(state, agentRng: RngState): [GameState, RngState]`. Pure; reshuffles
  playerDraw/worldDraw/each acts entry via core `shuffle` (threaded rng), reseeds
  state.rng (float→uint32 via `createRng(floor(nextFloat*2^32))`, inverts nextFloat
  scale — sound, no degenerate collapse), leaves hand/discard/resources/ids
  byte-identical. Deep-path core imports (matches sim convention). New test
  `src/sim/tests/determinize.test.ts` (9 tests); sim suite 13 pass; typecheck clean.
  Fresh-context review: PASS. **Flagged improvement (non-blocking, for user):** the
  positional split of `hiddenZones(state)` (`[0]`/`[1]`/`slice(2)`) couples
  determinize to an ordering documented only in prose. Reviewer recommends making
  `hiddenZones` return a structured shape `{playerDraw, worldDraw, acts}` (only
  consumers are `isHidden` + determinize). Surface at finalization.
- 2026-06-27: **Step 6 complete.** `policy.ts`: `Policy = (view, rng:()=>number)
  => Action`; `randomPolicy = pickAction` (unchanged selection). `run.ts` rewired:
  single agent `RngState` (createRng(AGENT_SEED=12345, argv-overridable)) threaded
  across loop; each decision `determinize(state, agentRng)` → policy on `view` →
  `reduce` on REAL state → carry nextRng; RngState→closure bridge lives in runner;
  boon choices same path; `Math.random` removed. Sim: 0W/100L/0 violations, avg
  ~9.4 turns (similar range to before, reproducible per seed). New spy-policy seam
  test (sim suite 14 pass); typecheck clean. Fresh-context review: PASS on
  view-decides/real-applies, action legality, rng separation, seam validity.
  **Flagged improvement (non-blocking, for user):** run.ts's decision loop is a
  top-level script, so the seam test mirrors the wiring inline rather than
  executing run.ts; the real call site is only guarded by a string-grep test.
  Extracting the loop into a testable function would let the seam test cover the
  actual site. Surface at finalization.
- 2026-06-27: **Step 7 / final validation complete.** Holistic fresh-context
  validation against the design: design-conformant on every audit-table entry,
  both live leaks closed, all three determinize surfaces + rng reseed, playerDiscard
  untouched, stamps kept distinct, classifyRisk/severityForRisk untouched. Whole-tree
  gate: lint initially failed on one unused `RngState` import in
  `determinize.test.ts` (routed back, removed) — now lint / typecheck /
  `bun run test` (1368 pass, 1 skip, 0 fail) / build all clean; `bun run sim`
  completes (0W/100L/0 violations). Design doc → `implemented`, plan → `executed`.
- **Pre-existing observation (out of scope, surfaced by validator):** the sim's
  "at least 1 win in N worlds" smoke test is commented out at HEAD, and the random
  policy currently wins 0 (current balance), so a catastrophic policy/balance
  regression to zero wins is invisible to the suite. Not part of this feature; noted
  for a possible follow-up.

## Flagged improvements for the user (non-blocking)

1. **`hiddenZones` positional coupling (Step 5).** `determinize` splits
   `hiddenZones(state)` by index (`[0]`=playerDraw, `[1]`=worldDraw, `slice(2)`=acts).
   The ordering contract lives only in a prose comment. Recommend `hiddenZones`
   return a structured `{playerDraw, worldDraw, acts}` so the contract is structural;
   only consumers are `isHidden` + `determinize`.
2. **`run.ts` loop not testable (Step 6).** The decision loop is a top-level script,
   so the seam test mirrors the wiring inline rather than executing the real call
   site (guarded only by a string-grep test). Extracting the loop into a function
   would let the seam test cover the actual site.
