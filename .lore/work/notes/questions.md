---
title: "Implementation notes: questions (World 13)"
date: 2026-07-04
status: in_progress
tags: [world, walker-narrative, grief-arc, denial, anger, destiny-entity, keyword-cost-modifiers, compound, notes]
modules: [core-effects, data-worlds, game-runtime, game-scenes]
source: .lore/work/plans/questions.md
related:
  - .lore/work/specs/questions.md
  - .lore/work/design/questions-card-design.md
  - .lore/work/specs/answers.md
  - .lore/work/specs/the-beginning.md
---

# Implementation notes: questions (World 13)

## Progress tracker

- [x] Phase 0: Initialize (prior-work research) — **done**
- [x] Phase 1: Slice 1 — Core-engine keyword slice (Steps 1-4) — **done**
- [x] Phase 2: Slice 2 — World content authoring (Steps 5a-7) — **done**
- [x] Phase 3: Slice 3 — World bundle wiring (Steps 8-13) — **done**
- [ ] Phase 4: Slice 4 — Grief-support interstitial (Steps 14-19)
- [ ] Phase 5: Slice 5 — Documentation and final validation (Steps 20-22)

## Log

### Phase 0: Initialize (2026-07-04)

Dispatched `lore-researcher` to check for prior work. Findings:
- Confirmed fully greenfield: no `src/data/worlds/questions/`, no `Denial`/`Anger` keyword references anywhere in `src/core/` or `allCards.json`, no `window.open` usage anywhere in `src/`, no `grief`/`interstitial` strings, no `seenOnce`-style flag.
- **Correction to plan's framing (Step 14):** the plan says "no existing store already holds a comparable seen-once flag" and cites `userSettings.ts` as the shape to mirror. More precise: `src/game/runtime/witnessProfile.ts` (and `featsProfile.ts`, `unlocksProfile.ts`) are the closer structural template — versioned profile object + storage key + type guard (`isWitnessProfile`) + empty-state constructor. Will instruct the implementation agent to model the new store on `witnessProfile.ts` specifically rather than `userSettings.ts`. Not a divergence requiring escalation — same pattern family, more precise pointer.

No `.lore/lore-agents.md` registry exists — using `general-purpose` for implementation, testing, and review roles throughout.

No task-file breakdown exists under `.lore/work/tasks/questions/` — phases below map 1:1 to the plan's five slices.

### Phase 1: Slice 1 — Core-engine keyword slice (2026-07-04)

Implemented, tested, and reviewed by three separate agents; all clean.

- `src/core/model/types.ts`: added `"Denial"`, `"Anger"` to `KeywordName` union.
- `src/core/model/keywords.ts`: added both to `KEYWORD_NAMES`; left `PERSISTENT_KEYWORDS` unchanged (`{"Lockdown","Reroute"}`) so both decay at turn start; added `KEYWORD_COST_MODIFIERS` entries (`Denial: ClearCostPerSelfKeyword costPer:1`, `Anger: ClearCostPerKeywordCount costPer:1`) — no new `PersistentModifier` kind invented.
- `src/core/engine/effectiveCards.ts`: confirmed unchanged, by direct reading — `extraWorldCardCost`/`effectiveWorldCardCost`/`activeKeywordCostModifiers` iterate `KEYWORD_COST_MODIFIERS` generically, switch only on `modifier.kind`, no keyword-name branching. Plan's Step 3 claim held; no divergence.
- New tests in `src/core/tests/effectiveCards.test.ts` (Denial self-cost, Anger whole-hand-count including a genuinely keyword-free `plain` card — closes the REQ-W13-29.3 false-positive trap explicitly — and Denial+Anger stacking math) and `src/core/tests/keywords.test.ts` (non-membership in `PERSISTENT_KEYWORDS`, decay-to-zero behavior).
- Full suite: 1489 pass / 0 fail / 2 skip. `lint` and `typecheck` clean.
- No files outside Slice 1 scope touched.

### Phase 2: Slice 2 — World content authoring (2026-07-04)

Implemented, tested, and reviewed by three separate agents.

- Added 15 card templates to `src/data/allCards.json`'s `cardTemplates` map (169 → 184), byte-for-byte identical to `.lore/work/design/questions-card-design.md`'s JSON: 3 Act 1 world cards, 4 Act 2 world cards, 4 Act 3 world cards (including `Destiny`), 4 reward player cards (`Ask The Question`, `Let It Out`, `Why`, `Sit With It a While`).
- No `insetKey` on any new card (no art exists yet for this world — matches plan Step 12's intent).
- Verified: all five hooks present on every world card; `He Isn't Coming Back`/`Destiny` author `Denial:2` statically (uncounterable by design), every other Denial/Anger card applies via `ApplyKeyword{target:"self"}` on draw; all `GainCard`/`AddWorldCardToDeck` template-name cross-references match exactly; `Destiny`'s cost has no bespoke effect (climbs purely from Slice 1's two modifiers); `Destiny.onCleared` is `ExileTopWorldCards{amount:3}`, not `SurviveWorld`; `The Walker`/`Summon Door`/`Door` untouched (0 diff). Full suite 1489 pass / 0 fail, typecheck and build clean.

**Divergence found and resolved (approved by user):** REQ-W13-6 requires a code comment or flavor-text note on the `Destiny` template disambiguating it from the existing `DestinyScene`/Destiny Progression meta-system. `allCards.json` is strict JSON — no comment syntax, and no `description`/`flavor`/`note` field exists anywhere in the `CardTemplate` type family (`src/core/model/cards.ts`). The design doc's own copyable JSON reproduced this gap (the disambiguating note lives only in the doc's prose, not the JSON block). Presented three options to the user (code comment in Slice 3's `questions/index.ts`, a schema field addition, or relying solely on Slice 5 Step 20's doc update). **User chose: rely on Step 20's `theme-authoring.md` update only** — no code-level note will be added. Slice 5's Step 20 must explicitly name the `DestinyScene` collision (not just describe the `compound` signature verb) for REQ-W13-6 to be genuinely satisfied by that entry alone.

### Phase 3: Slice 3 — World bundle wiring (2026-07-04)

Larger slice than planned — surfaced two real gaps and one unrelated pre-existing bug, both resolved with user sign-off.

**Core bundle wiring (as planned):**
- `src/data/worlds/questions/{cards.json,theme.ts,meta.ts,index.ts}` created, mirroring `eden-prime`'s bundle shape exactly. `QUESTIONS_THEME` uses a muted sage/ash/amber palette (`intrusionHue: "#9fae9a"`), no `worldCardfrontKey` (no cardfront art yet). `QUESTIONS_DISPLAY`/`QUESTIONS_HELP`: difficulty 5, cycle 4 (matches the highest existing values). Help text describes Denial/Anger mechanically only, no grief-stage naming (REQ-W13-24).
- Registered `QUESTIONS_BUNDLE` as 13th entry in `src/data/worlds/registry.ts`.
- Wired `questions-bg`/`questions-overlay` in `assetBindings.ts` to the two pre-staged webp files. No cardfront/inset imports (none exist).
- `src/core/tests/worldRegistry.test.ts`: added the five-hooks-per-world-card conformance test (genuinely new — confirmed no pre-existing world fails it, across all 97 templates / 13 worlds). Duplicate-template-id check confirmed redundant with `catalog.ts`'s existing throw-on-duplicate assembly logic — not added as a separate test.
- `src/sim/tests/completeness.test.ts`: updated hardcoded registry-length assertion 12 → 13.

**Divergence 1 (approved): world-unlock gating.** Plan flagged this as out-of-scope-but-raise-it. User chose to add a `worldUnlock` entry now rather than defer. Added `world-questions` to `src/data/unlocks/catalog.json` (cost 15, destinyWeight 0 — mirrors existing convention exactly, explicitly a placeholder not balance-tuned; revisit once `answers`/`the-beginning` exist and trilogy-wide unlock sequencing can be considered together).

**Divergence 2 (approved): missing asset conformance tests.** Adding the unlock entry + world registration triggered two conformance tests neither Slice 2 nor the plan anticipated: `src/game/tests/unlockAssetBindings.test.ts` (every unlock needs a matching icon) and `src/game/tests/worldAssetBindings.test.ts` (every world's `musicKey` must resolve in `worldMusicManifest`). Presented three options; user chose **generate the icon now, defer the music track**:
- Generated `src/game/assets/unlocks/world-questions.webp` (256x256) via the art-gen pipeline (`black-forest-labs/flux-2-pro`), following `.lore/reference/direction/unlock-art-style.md`'s "world unlock = access seal in place" brief — a sealed hospital-corridor door with a tarnished brass padlock, gold keyhole glow, thin ember-orange thread at the door's edge (quiet Act 3 foreshadow). Wired into `src/game/data/assetManifest.ts`.
- Added a documented `PENDING_MUSIC_TRACK` allowlist to `worldAssetBindings.test.ts`, using `it.skip` (matches existing `.skip` convention found via grep — no early-return pattern exists elsewhere in this repo) for `questions` specifically. Comment instructs removing the entry once a real track + `worldMusicManifest` entry land. No audio file fabricated.

**Unrelated pre-existing bug found and fixed (approved by user).** While chasing an unexpected 12-test failure pattern, independently confirmed (via `git stash`/clean-checkout re-run, not just trusting the first report) that `src/game/tests/boonChoiceView.test.ts` has called `mock.module(".../audioManifest", ...)` since commit `7b01707` (2026-07-01, predates this session) with no cleanup — Bun's `mock.module` leaks into whatever test file runs next in the same process, causing `worldAssetBindings.test.ts`'s musicKey checks to intermittently fail depending on file execution order. Confirmed present on a clean pre-session checkout too (1472 pass/12 fail there), so not caused by "questions" work. User chose to fix it now: added `afterAll(() => mock.restore())` to `boonChoiceView.test.ts`. Verified across 4 consecutive full-suite runs, all clean.

**Current full-suite state:** 1515 pass / 3 skip / 0 fail, consistent across repeated runs. Lint/typecheck/build all clean.
