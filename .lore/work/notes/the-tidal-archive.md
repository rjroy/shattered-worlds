---
title: "Implementation notes: The Tidal Archive world"
date: 2026-06-20
status: complete
tags: [implementation, notes, the-tidal-archive, world-design, core-effect, displacement]
source: .lore/work/plans/the-tidal-archive.md
modules: [core-engine, world-data, game-view, themes]
related: [.lore/work/specs/the-tidal-archive.md]
---

# Implementation notes: The Tidal Archive world

Implementing [the-tidal-archive plan](../plans/the-tidal-archive.md) (`REQ-TIDAL-1` … `REQ-TIDAL-58`) as orchestrator. Phases are the plan's four slices (A→B→C→D), executed via sub-agents (implement → test → review per slice). No task files existed, so phases come from the plan directly. Agent roles fall back to `general-purpose` (no `.lore/lore-agents.md`).

## Progress

- [x] **Slice A** — Core: recall effects + end-turn passive (`REQ-TIDAL-9..18, 52, 53, 54`) — DONE, review-clean, 20/20 recall tests pass, typecheck clean
- [x] **Slice B** — World data + registration + boon source (`REQ-TIDAL-1, 4-7, 19-41, 47, 48, 55`) — DONE, review-clean, full suite 1144 pass / 0 fail. C1 base-asset wiring pulled forward (parameterized asset test required base keys on registration). Pre-existing fog `setName` test fixed.
- [x] **Slice C** — Assets, selection UI, help, docs (`REQ-TIDAL-2, 14, 42-46, 49, 50, 57`) — DONE, review-clean, 1163 pass / 0 fail, typecheck clean, build succeeds. C3 divergence: effect text surfaced via core `recallDiscard.ts` describe/compile (renderer bottoms out there — confirmed renders real text). min:0/empty-pile auto-skip lives in TableScene (selection.ts stays pile-agnostic). Minor: worldSelectCarousel test asserts a mirror fn, not the real scene (strengthen in D).
- [x] **Slice D** — Validation + spec reconciliation (`REQ-TIDAL-51, 56, 58`) — DONE. Seeded replay test added (`tidalReplay.test.ts`, 3 mechanisms across 2 identical seeds, deepEqual). Pre-existing `effectLineView.ts` lint pair fixed. Carousel test strengthened (extracted pure `worldSelectPaging.ts` helper, test drives real paging). Spec reconciled (4 corrections ratified, insets annotated deferred, status→implemented). Deferral issue note created. Gates: test 1168/0, typecheck clean, lint clean, build OK. Browser smoke NOT run (env limitation, honestly reported).

## Key gotchas (from lore-researcher, code-anchored)

1. `recallTarget` TargetSpec touches 8 sites / 3 files, most with no `default`: `available.ts checkSpec` (mandatory), six `selection.ts` branches, `sim/policy.ts buildPlayAction`.
2. `ReturnWorldCards` inert on world auto-hooks (`ctx.returnIds` undefined) → use `AddWorldCardToDeck { bTop: true }`. Player-played is fine.
3. `Brace` only absorbs `ForceDestroy` (snatch), never `Damage`. `ForceDestroy` removes from hand outright (not to discard) → does NOT feed Tidal Memory recall.
4. `Hidden` is not a keyword (`Obstructed | Creature | Slow | Spore | Concealed`). theme-authoring.md is stale on this.
5. Boon cards single-sourced in `boons/tidal.json`, registered in `boons/fortune.ts`; auto-merge via `worldManifest.ts`. Do NOT redefine in `cards.json`.
6. Registry init cycle risk when adding handlers (offer-boon hit `registry -> composite -> describe/available -> registry`, fixed by lazy lookup). Watch for it.
7. JSON catalogs are NOT typechecked — parameterized world tests are the only guard for ref resolution.
8. Browser smoke likely unavailable; fall back to build + local-server HTTP 200 + asset checks (per whiteout notes).

## Log

- 2026-06-20: Initialized. lore-researcher confirmed City of Sleeping Giants plan is the closest mirror; whiteout-parking-garage notes + offer-boon-rewards notes are the relevant prior `/implement` logs.
- 2026-06-20: **Slice A complete.** Recall effects + end-turn passive implemented and review-clean (no non-conformances). 20/20 recall tests pass; full suite 1118 pass / 1 fail; typecheck clean. Out-of-scope but necessary: extended three exhaustive switches (`effectiveCards.ts cloneEffect`, `actionPreview.ts summarizeEvent`, `describe.ts dealProgressOf`) and added `endOfTurnPassive: {kind:"None"}` to 6 test-file GameState literals.
- 2026-06-20: **Pre-existing failure root-caused.** `worldManifest.test.ts:337,350` asserts fog cooler `setName: "the cooler"`, but commit `a675a9c "Rebalanced with random loot"` renamed the data to `"Cooler Stash"` (cards.json:103) without updating the test. Stale-test bug, data is source of truth. Unrelated to Tidal; fix folded into Slice B dispatch (update test to "Cooler Stash").
- 2026-06-20: **Slice B complete + review-clean.** World data, theme/meta/index, `tidal-boons` boon source, registration, threat map. Fog stale-test fixed. C1 base-asset wiring pulled forward (registration makes the parameterized asset test require base keys). Full suite 1144 pass / 0 fail; typecheck clean. `OfferBoon` requires a `setName` (spec shorthand omitted it) → "The Reading Room".
- 2026-06-20: **Slice C complete + review-clean.** Six `selection.ts` `recallTarget` sites, `DiscardChooserView`, TableScene wiring, theme-authoring doc + stale-alias cleanup. C3 divergence: effect text via core `recallDiscard.ts` describe/compile (renderer bottoms out there — verified renders real text). min:0/empty-pile auto-skip in TableScene (selection.ts stays pile-agnostic). 1163 pass / 0 fail; typecheck clean; build OK.
- 2026-06-20: **Slice D complete + holistic validation.** Seeded replay test (`tidalReplay.test.ts`). Pre-existing `effectLineView.ts` lint pair fixed (no suppress). Carousel test strengthened via extracted pure `worldSelectPaging.ts` helper. Spec reconciled (4 corrections ratified, insets→deferred, status→implemented); deferral issue note created.
- 2026-06-20: **COMPLETE.** Holistic spec validation: 55 MET / 3 DEFERRED (inset items, recorded in spec + `.lore/work/issues/the-tidal-archive-card-insets.md`) / 0 NOT-MET. Final gates: `bun run test` 1168 pass / 0 fail (67 files), typecheck clean, lint clean, build OK. Only unrun item: interactive browser smoke (env limitation, not fabricated). Plan flipped to `executed`.
