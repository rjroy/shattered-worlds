---
title: "Implementation notes: The Ember Orchard"
date: 2026-06-20
status: in_progress
tags: [implementation, notes, world-design, the-ember-orchard, incubation]
source: .lore/work/plans/the-ember-orchard.md
modules: [world-data, themes, game-view, unlocks, boons]
---

# Implementation notes: The Ember Orchard

Implementing [the-ember-orchard plan](../plans/the-ember-orchard.md) (REQ-EMBER-1..50). Seventh world, verb **incubate**. No core slice; all on existing engine vocabulary. Canonical template: `whiteout-parking-garage`. Orchestrated via `/implement` — all code/test/review through sub-agents.

## Approved deviations from spec (carried from plan decisions)

- **§4 / REQ-EMBER-26/47:** Hatchery Cellar `onCleared` runs `OfferBoon { setId: "pool-ember-cellar", offeredCount 3, chooseCount 1 }` instead of `Sequence[GainCard ×5]`. Rewards single-sourced in `src/data/worlds/boons/ember.json` (A8).
- **§5 / REQ-EMBER-27/29:** Ember creatures deal `ForceDestroy` (snatch) not `Damage`, to revive `Brace`. Ember Moth all hooks → `ForceDestroy`; Ground Constellation `onDiscarded` `Damage 3`→`ForceDestroy 2` (keeps `DamageScaled` end-of-turn). Ember Moth's spec `ReturnWorldCards` half dropped (inert on auto-hooks).
- **§1 / REQ-EMBER-12 etc.:** every `Hidden` authored as `Obstructed` (engine keyword).

## Prior-work anchors (from lore-researcher)

- `.lore/work/notes/the-tidal-archive.md` — most recent world; code-anchored gotcha list confirms all of the above. Note: Tidal Slice C already touched `theme-authoring.md` (HEAD 2026-06-20) — verify what's already corrected before the B6 doc pass.
- `.lore/work/notes/whiteout-parking-garage.md` — canonical template, 5-phase rhythm, base assets already on disk.
- `.lore/work/notes/offer-boon-rewards.md` — `OfferBoon` is hook-only, fail-closed, needs `setName`; registry-init cycle risk fixed by lazy resolution.
- `.lore/work/plans/city-of-sleeping-giants.md` — twin plan (8th world), same five fixes.
- Watch items: JSON catalogs are NOT typechecked (parameterized world tests are the only ref-resolution guard); browser smoke unavailable in this env (fall back to build + asset checks, report honestly).

## Progress

- [x] **Slice A — World data, registration, unlock gating** (A1-A8) ✅ COMPLETE
  - [x] A1 cards.json (8 world + 3 world-referencing player cards)
  - [x] A2 theme.ts
  - [x] A3 meta.ts
  - [x] A4 index.ts (bundle)
  - [x] A5 registry.ts
  - [x] A6 threat mapping (gainCard.ts)
  - [x] A7 unlock gating (catalog.ts)
  - [x] A8 boon source (ember.json: 5 self-contained tools + fortune.ts) — pool expanded per user
  - [x] Gate A: test green (1180 pass, only expected asset-binding failures), review conformant
- [~] **Slice B — Assets, presentation, help, docs** (B1-B6) — CODE DONE, ART DEFERRED (user: "wire code now, art later")
  - [ ] B1 **16** card insets (art-gen) — DEFERRED, user generates later. See "Art TODO" below.
  - [ ] B2 unlock art (art-gen) — DEFERRED
  - [x] B3 base + music bindings wired (insets left unbound w/ turnkey TODO comment)
  - [x] B4 manifest reachable for base keys; unlock-art entry left as turnkey TODO comment
  - [x] B5 world-select pages already (no layout change needed)
  - [x] B6 theme-authoring doc: added `incubate` verb row (Tidal already fixed stale Hidden/AddWorldCardToTop tokens)
- [~] **Slice C — Tests and validation** (C1-C6) — LOGIC TESTS DONE, art/smoke deferred
  - [x] C1 world-data tests (in `src/core/tests/emberOrchard.test.ts`)
  - [x] C2 incubation-pattern effect tests (OfferBoon-on-clear from pool-ember-cellar, ForceDestroy, Brace absorption, Hatchery top-deck order)
  - [x] C3 asset coverage settled: existing test covered only 11 cards.json insets; ADDED boon-inset test (`emberOrchardPresentation.test.ts`) for the 5 boon keys — RED until art (by design)
  - [x] C4 theme palette assertion (card-inset render part deferred to manual smoke)
  - [x] C5 seeded three-act gameplay test
  - [ ] C6 manual smoke run — DEFERRED (needs art + browser)
  - [x] Gate C: 1202 pass / 2 fail (both expected art reds); typecheck + lint clean
- [x] **Validate** — holistic review against spec REQ-EMBER-1..50: SHIP-READY, no silently-dropped reqs, all 8 rewards reachable, tests genuine
- [~] **Finalize** — code complete; ART + C6 manual smoke remain (user-owned, deferred)

## Remaining (user-owned, deferred by choice)

1. **Generate 16 insets + 1 unlock art** (see "Art TODO" above), then wire the 16 inset bindings + unlock-art manifest entry (turnkey TODO comments in place at `assetBindings.ts` / `assetManifest.ts`).
2. After art lands, the 2 currently-red tests go green automatically (`worldAssetBindings.test.ts` 11 cards.json insets; `emberOrchardPresentation.test.ts` 5 boon insets).
3. **C6 manual smoke run** (needs art + browser): start `the-ember-orchard`, clear Hatchery Cellar → see the 3-of-5 boon offer, play Take One / Glasshouse Lantern → see a future Orchard hazard top-decked; confirm warm-orchard backdrop + Counterfall overlay + cardfront render without obscuring play.
4. Optional spec reconciliation: spec REQ-EMBER-26 text still names the old 5-tool GainCard offer; the shipped design (OfferBoon 3-of-5 + GainCard sources) is recorded here and in the plan. A spec amendment would remove the contradiction.

## Approved divergences discovered during implementation

- **Plan A8 5-tool Hatchery offer is infeasible.** A merged boon source must resolve in every world catalog and the `worldManifest` sync test requires `templateIds == cardTemplates` exactly; `OfferBoon` can only offer cards from a merged set. Take One/Glasshouse Lantern/Dormant Star reference Ember **world** cards, so they cannot live in any boon set. Resolution: the 3 world-referencing rewards stay in `cards.json`, granted via `GainCard` on clear (Dormant Star ← Cracked Hearth-Star; **Take One ← Falling Fruit onCleared (added, diverges REQ-EMBER-23)**; **Glasshouse Lantern ← Rooted Meteor onCleared (added, diverges REQ-EMBER-24)**).
- **User decision (2026-06-21): "Bigger Hatchery pool".** Authored two NEW self-contained tools so `pool-ember-cellar` reaches 5 and Hatchery offers 3-of-5 (restores plan's sampling variety). New cards (beyond spec REQ-EMBER-16..20): **Keep Vigil** (`Sequence[Draw 1, Brace 1]`, exhaust, inset `ember-inset-keep-vigil`) and **Bank the Heat** (`GainEnergy 2`, exhaust, inset `ember-inset-bank-the-heat`). These add **2 more insets** to Slice B (16 total) and 2 more asset keys to validate. Hatchery stays `offeredCount 3, chooseCount 1`.

## Art TODO (deferred per user — generate later, then wire)

Generate to whiteout quality bar; keynote **warm-orange invaded by violet (#d45cff)**. Save insets to `src/game/assets/themes/the-ember-orchard/insets/inset-<kebab>.webp`, then add 16 import+map entries in `src/game/worlds/assetBindings.ts` (turnkey TODO comment is in place). Unlock art → `src/game/assets/unlocks/world-the-ember-orchard.webp`, then add `"unlock/world-the-ember-orchard"` to `src/game/data/assetManifest.ts` (turnkey TODO comment in place).

- **11 from cards.json:** dormant-star, take-one, glasshouse-lantern, cracked-hearth-star, falling-fruit, rooted-meteor, the-orchard-counts-wrong, hatchery-cellar, ember-moth, lantern-brood, ground-constellation
- **5 from ember.json:** leave-one, star-pruner, constellation-shears, keep-vigil, bank-the-heat
- **1 unlock art:** world-the-ember-orchard

Until generated: `worldAssetBindings.test.ts` "all referenced asset keys are bound" stays RED (the sole failing test). Do NOT add placeholder files to make it green.

## Log

- 2026-06-20: Initialized. lore-researcher run complete (see anchors above). No task files / no agent registry; using `general-purpose` for all roles. Phases = plan slices A/B/C.
- 2026-06-21: Slice A files landed (prior agent interrupted at session limit, but writes completed). Test agent: 1180 pass, typecheck + lint clean; only failures are expected Slice B asset-binding gaps. Flagged A8 infeasibility divergence; user chose "Bigger Hatchery pool". Dispatching A8 revision (2 new self-contained tools).
- 2026-06-21: A8 revision done — Keep Vigil + Bank the Heat added; pool-ember-cellar now 5 tools, Hatchery offers 3-of-5. Tests still 1180 pass / 2 expected fails.
- 2026-06-21: **Slice A COMPLETE.** Review conformant, no blocking issues. Downstream TODO: (1) spec REQ-EMBER-26 text still names old 5-tool offer — reconcile in B6 doc pass; (2) Hatchery onEndOfTurn top-deck order to verify in C2; (3) `worldAssetBindings.test.ts` only scans world bundle's own cards.json, NOT merged boon source — so the 5 boon-tool inset keys need EXPLICIT coverage in C3 or they ship silently broken. Slice B inset count = 16 (11 in cards.json + 5 in ember.json).
- 2026-06-21: User chose "wire code now, art later" for Slice B. Code portion done: base+music bindings, manifest reachability, doc verb row, world-select paging confirmed. 1181 pass / 1 expected fail (inset keys). **DISCREPANCY to settle in C3:** Slice B agent reported the failing test's missing-key list contains ALL 16 inset keys incl. the 5 boon ones — contradicting the A8 agent's claim that the test only scans cards.json. C3 must confirm definitively whether the 5 boon insets are covered; add explicit coverage if not.
- 2026-06-21: **Slice C logic tests DONE.** C3 discrepancy SETTLED: existing `worldAssetBindings.test.ts` covers ONLY the 11 cards.json insets (via `referencedAssetKeys` reading `bundle.source` only); the 5 boon insets were uncovered → added boon-inset test in `emberOrchardPresentation.test.ts` (red until art). New files: `src/core/tests/emberOrchard.test.ts` (C1/C2/C5, 18 tests), `src/game/tests/emberOrchardPresentation.test.ts` (C4 palette + C3). Hatchery top-deck order pinned: **Falling Fruit on top, Ember Moth beneath**. No logic bugs found. 1202 pass / 2 expected art-reds.
- 2026-06-21: **Holistic validation DONE — SHIP-READY.** All REQ-EMBER-1..50 accounted for; no silently-dropped requirements; new cards Keep Vigil/Bank the Heat clean on REQ-EMBER-21 (`GainEnergy` ≠ Heat economy); all 8 rewards reachable; tests genuine (real reducer, not tautological). typecheck + lint clean. Code implementation complete. Remaining = user-owned art generation + C6 manual smoke (see Remaining section).
