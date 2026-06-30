---
title: "Implementation notes: Eden Prime world"
date: 2026-06-30
status: complete
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

- [x] **Slice 1 — Core engine: applied keywords + Alarm** (REQ-EDEN-9..15, 45) — Gate G1
  - [x] 1.1 Types
  - [x] 1.2 Keyword helpers
  - [x] 1.3 Effect handlers
  - [x] 1.4 Progress signal
  - [x] 1.5 Turn lifecycle
  - [x] 1.6 Deferred next-world-card
  - [x] 1.7 Threat map
  - [x] Test (Gate G1)
  - [x] Review
- [x] **Slice 2 — World data + registration** (REQ-EDEN-1,4,6,7,16-35,46,47) — Gate G2
  - [x] 2.1 Card templates
  - [x] 2.2 Boon pool
  - [x] 2.3 Deck composition
  - [x] 2.4 Bundle files + registry
  - [x] Test (Gate G2)
  - [x] Review
- [x] **Slice 3 — Assets / presentation / help** (REQ-EDEN-2,3,5,8,36-42,48,49) — Gate G3 — *final inset media deferred*
  - [x] 3.1 Base art wiring
  - [~] 3.2 Insets — README/art direction complete; final media/bindings deferred
  - [x] 3.3 Renderer Alarm legibility
  - [x] 3.4 Help/display copy
  - [x] Test (Gate G3)
  - [x] Review
- [x] **Slice 4 — Conformance + seeded gameplay + docs** (REQ-EDEN-43,50, AI Val 1-7) — Gate G4
  - [x] 4.1 Seeded gameplay test
  - [x] 4.2 Docs (theme-authoring.md)
  - [x] 4.3 Full validation (test + lint + typecheck + build)
- [x] **Final validation** — holistic review against spec REQ-EDEN-1..50, with approved deferrals recorded below

## Log

### Slice 1 — core engine (2026-06-29)
- Impl agent built all of Steps 1.1-1.7 + Gate G1 tests. `bun run test` = 1326 pass / 0 fail (17 new), typecheck + lint clean.
- Impl flagged decisions (accepted): no new `IconId` glyphs (deferred to visual Slice 3 — avoids forcing exhaustive renderer maps now; `compile()` emits text tokens); shallow gate `describe()` (registry init-order constraint, `compile()` recurses fine); `withAppliedKeyword` merge-by-max (refresh-don't-shorten, mirrors `setPlayerFrozen`); event shapes mirror `CardsFrozen`/`BraceChanged` (`{ids,templateIds,...}` not singular `cardId`); `RemoveKeyword.target` typed `"hand"`, strips applied-only.
- **Test verifier** (independent run): confirmed 1326 pass / 0 fail, typecheck clean; 15/17 tests catch intended regressions (numeric-id sort and guard-suppression verified). Three hardening gaps vs literal G1 contract: (5) guard "exactly one" implied not proven; (6) decay-order test asserts 2 adjacencies, not full 6-step chain; (7) no-op test is absence-of-Alarm proxy, not byte-identical baseline.
- **Conformance review**: all 12 contract items met. Findings: #1 `nextWorldCard` hardcodes Alarm, drops `effect.keyword` (should-fix, contradicts stated generality); #2 `KeywordApplied` emitted before `CardsDrawn` (should-fix, ordered-stream defect); #3/#4 hand-scoped lifetime/`self` (nits, document); #5 `as C` casts (nit, no action).
- **Correction pass dispatched** to original impl agent: Fix A (carry keyword through pending field), Fix B (emit KeywordApplied after CardsDrawn), Fix C (document hand-scoped lifetime), + harden tests #5/#6/#7. All within Slice 1 scope; not a divergence.
- **Correction pass completed**: deferred next-world-card application now carries `{ keyword, value }` instead of hardcoding Alarm; draw emits `CardsDrawn` before `KeywordApplied`; Gate G1 tests now cover non-Alarm deferred carry-through, exact single guard consumption, full turn-start lifecycle order, and normalized byte-identical no-op behavior. Impl reported `rtk bun test src/core/tests/edenPrime.test.ts` = 17 pass / 0 fail; `rtk bun run typecheck`, `rtk bun run lint`, and `rtk bun run test` clean (1326 pass, 2 skip).
- **Re-test clean**: independent verifier confirmed `rtk bun test src/core/tests/edenPrime.test.ts --preload ./src/game/tests/testSetup.ts` = 17 pass / 0 fail; full `rtk bun run test` = 1326 pass / 2 skip / 0 fail; typecheck and lint pass.
- **Re-review found one material risk**: `alarmGuard` was suppressing any passing `KeywordGate`, but REQ-EDEN-11a scopes the guard to Alarm-caused disruptions only.
- **Guard-scope fix completed**: `KeywordGateHandler` now consumes/suppresses only when `effect.keyword === "Alarm"`. Added regression proving a passing `Spore` gate runs, leaves `alarmGuard` unchanged, and emits no `AlarmGuardConsumed`.
- **Guard-scope verification clean**: focused Eden test now 18 pass / 0 fail; typecheck pass. Follow-up review clean. Residual coverage note: non-Alarm guard regression uses authored `Spore`, not applied `Spore`, but implementation path remains general through `hasKeyword`.

### Slice 2 — world data + registration (2026-06-30)
- Impl agent added Eden hazards/rewards/`Tread Softly` to `src/data/allCards.json`, `pool-eden-grove`, `src/data/worlds/eden-prime/` bundle files, registry entry, temporary `music-eden-prime` binding to the existing Ember Orchard track URL, Gate G2/G47 tests, and updated sim completeness expected world count from 9 to 10.
- Impl validation: focused Eden test = 30 pass; sim completeness = 4 pass / 1 skip; typecheck and lint pass.
- Known cross-slice failure after registration: full `rtk bun run test` reports `world asset bindings: "eden-prime" > all referenced asset keys are bound in assetManifest` missing `eden-prime-bg`, `eden-prime-overlay`, `eden-prime-cardfront`. This is expected until Slice 3 wires base assets.
- Independent test: Gate G2/G47 pass; `worldAssetBindings.test.ts` and full suite fail only on the known Slice 3 base asset binding gap; temporary `music-eden-prime` binding passes; typecheck and lint pass.
- Independent review: no Slice 2 non-conformances or material risks found.

### Slice 3 — assets / presentation / help (2026-06-30)
- Wired existing Eden base art in `src/game/worlds/assetBindings.ts`: `eden-prime-bg`, `eden-prime-overlay`, and `eden-prime-cardfront`. `assetManifest` receives these transitively through `worldAssetUrls`.
- Added mandatory `src/game/assets/themes/eden-prime/insets/README.md` with Eden-specific inset style, prompt template, filename/key list for all 13 Eden cards, finishing pass, and 100x100 contact-sheet validation. Final per-card inset WebPs remain out-of-band; no placeholder binary assets or nonexistent bindings were added.
- Added CardView applied-Alarm presentation helpers and a cosmetic Alarm overlay/badge for both player and world cards. Authored keywords still render through the existing keyword line only.
- Added `src/game/tests/edenPrimePresentation.test.ts` covering Eden theme keys, manifest base-key resolution, README requirements, pending Eden inset key/catalog alignment, and the applied Alarm formatting helper.
- Validation: `rtk bun test src/game/tests/edenPrimePresentation.test.ts --preload ./src/game/tests/testSetup.ts` = 5 pass / 0 fail; `rtk bun test src/game/tests/worldAssetBindings.test.ts --preload ./src/game/tests/testSetup.ts` = 20 pass / 0 fail; `rtk bun test src/core/tests/edenPrime.test.ts --preload ./src/game/tests/testSetup.ts` = 30 pass / 0 fail; `rtk bun run typecheck` pass; `rtk bun run lint` pass; full `rtk bun run test` = 1358 pass / 2 skip / 0 fail.
- Review note: Slice 3 did not implement final inset asset generation or bindings because those image files do not exist and the scope explicitly forbids fake final WebPs. The README/test now make the missing art set explicit.
- Independent review found a strict REQ-EDEN-48 gap: the 13 `eden-inset-*` keys referenced by the catalog are not bound in `worldAssetUrls`/`assetManifest` because the final WebP files do not exist. This means final inset media remains incomplete even though base art, README, and Alarm presentation are complete.
- **Approved divergence (2026-06-30):** user instructed to mark the missing Eden inset media/bindings for later and continue gameplay work. Final inset media will be added after gameplay.

### Slice 4 — conformance + seeded gameplay + docs (2026-06-30)
- Added REQ-EDEN-50 seeded gameplay coverage in `src/core/tests/edenPrime.test.ts`: a restrained line discards `Fruit Offered Too Quickly` and `First Warning Cry`, keeps Alarm absent, and proves `Curious Swarm`, `The Quiet Grove`, and `The Herd Misunderstands` remain inert; a greedy line clears a gift with `Explore`, plays `Take the Fruit`, overdraws with `Sprint`, lets `First Warning Cry` spread Alarm past thresholds, and proves the same hazard family fires `DiscardThenDraw`, top-decked `Curious Swarm`, and `Panic`.
- Updated `.lore/reference/theme-authoring.md` for REQ-EDEN-43: Eden Prime added to the signature verb table as `startle`; `Alarm` documented as the first transient/applied keyword; `ApplyKeyword`, `KeywordGate`, `ProgressGate`, `RemoveKeyword`, and `GainAlarmGuard` documented as Eden-introduced general primitives; C2a now distinguishes authored `keywords` from runtime `appliedKeywords`; Eden's greed-tax startle reward space is explicitly owned by Eden.
- Validation commands:
  - `rtk bun test src/core/tests/edenPrime.test.ts --preload ./src/game/tests/testSetup.ts` = 31 pass / 0 fail.
  - `rtk bun run test` = 1359 pass / 2 skip / 0 fail.
  - `rtk bun run lint` = pass.
  - `rtk bun run typecheck` = pass.
  - `rtk bun run build` = pass. Existing Vite warnings only: unresolved font URLs left for runtime resolution and large chunk size warning.
- AI Validation status:
  - Items 1-4 are covered by the full suite and focused Eden tests.
  - Item 5 is covered for base Eden art keys and inset README/style documentation; final `eden-inset-*` asset files and bindings remain intentionally deferred by approved user instruction.
  - Items 6-7 were not re-run as an interactive browser smoke in this pass; the build succeeds, base Eden art is registered, Alarm presentation has automated coverage, and final inset media remains explicitly deferred.

### Final validation (2026-06-30)
- REQ-EDEN-43 and REQ-EDEN-50 are now implemented.
- REQ-EDEN-1..47 and REQ-EDEN-49 are covered by the existing Eden core/data/presentation tests and the successful full suite.
- REQ-EDEN-48 remains partially deferred only for final inset WebP media plus `eden-inset-*` asset bindings. This is the approved divergence from Slice 3 and was not changed in Slice 4.
- Temporary `music-eden-prime` continues to reuse the approved existing track URL until a real Eden Prime music file is added.

### Initialization (2026-06-29)
- Read plan and spec. No task files; using plan slices as phases.
- Dispatched `lore-researcher` for prior sibling-world work (notes/retros/reference docs).
- Created this notes file.
- **Approved divergence (2026-06-30):** `WorldDataBundle` requires a `musicKey` and registered worlds must have a `worldMusicManifest` entry, but no real `eden-prime-music.mp3` exists yet. User approved temporarily mapping `music-eden-prime` to an existing track under the Eden key; a real file will be added later without changing the bundle key.
- **Research findings:**
  - Sibling `.lore/work/notes/` + `plans/` were deleted after distillation; replaced by reference docs.
  - Canonical guide for the core slice: `.lore/reference/effect-system-extension-pattern.md` (effect = union member + handler/registry + apply case + describe.ts text + playability/target-spec + data/catalog tests; deferred-effect pattern via GameState field resolved at a turn-cycle point).
  - Sibling reference docs: `.lore/reference/ember-orchard-world.md`, `.lore/reference/city-of-sleeping-giants-world.md`. `GainAlarmGuard` is the structural analog of Ember's Brace charges.
  - Core has zero existing Alarm/ApplyKeyword/KeywordGate primitives — Eden is genuinely first.
  - Model bundle on the four-file shape at `src/data/worlds/the-ember-orchard/` (index.ts, meta.ts, cards.json, theme.ts). Card templates go in `src/data/allCards.json`, NOT per-world cards.json.
  - Mirror tests: `src/core/tests/emberOrchard.test.ts`, `src/core/tests/cityOfSleepingGiants.test.ts`, `src/game/tests/emberOrchardPresentation.test.ts`.
  - Gotchas: author `Obstructed` (no `Hidden`); `ReturnWorldCards` inert on auto hooks. `.lore/learned/` and `.lore/work/retros/` are empty.
