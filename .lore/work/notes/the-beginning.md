---
title: "Implementation notes: the-beginning"
date: 2026-07-04
status: in_progress
tags: [world, walker-narrative, grief-arc, acceptance, destiny-entity, keyword-cost-modifiers, unburden, finale, implementation]
source: .lore/work/plans/the-beginning.md
modules: [core-effects, data-worlds, game-runtime]
---

# Implementation notes: the-beginning

Orchestrated implementation of World 15 ("the-beginning") per `.lore/work/plans/the-beginning.md`. This is the third and final Endworlds trilogy world. No task-breakdown directory exists (`.lore/work/tasks/the-beginning/`), so phases follow the plan's own slice/step structure directly. No `.lore/lore-agents.md` registry exists — using `general-purpose` for implementation, testing, and review roles throughout.

## Pre-flight (lore-researcher, complete)

Confirmed clean baseline: no `src/data/worlds/the-beginning/`, no `"Acceptance"`/`worldCardInHandByTemplateId`/`extraStartKeywordGuard` anywhere in `src/`. Both mirror-target worlds (`answers`, `questions`) confirmed in expected shape and registered. `.lore/work/design/the-beginning-card-design.md` confirmed to exist (20k, already updated to match this plan's revised Acceptance mechanic, not the original spec). No prior interrupted notes for this world.

## Progress tracker

- [x] Phase 1 — Slice 1 Steps 1-6: core-engine additions (Acceptance keyword, ApplyKeyword named-target variant, actionPreview clamp, destinyWeight-based keywordGuard)
- [x] Phase 2 — Slice 1 Step 7: unit tests for Phase 1
- [x] Phase 3 — Slice 2 Steps 9-12: world content authoring (Act I/II/III card templates, WORLD_THREAT_BY_WORLD_ID registration, deck composition) — Step 8 (design doc) already done, confirmed in pre-flight
- [x] Phase 4 — Slice 3 Steps 13-18: world bundle wiring (cards.json, theme.ts, insets README, meta.ts, index.ts + registry, assetBindings, world-specific test)
- [x] Phase 5 — Slice 4 Step 19: grief-support interstitial verification (no code change expected)
- [x] Phase 6 — Slice 5 Steps 20-23: unlock gating (Blessing catalog entry) + documentation (theme-authoring.md, endworlds-trilogy-concept.md)
- [ ] Phase 7 — Slice 5 Step 24: final validation gate (full test/lint/typecheck/build + manual checks)
- [ ] Phase 8 — Holistic validation against source plan
- [ ] Finalize notes, mark complete

## Ratified deviation (binding constraint for all phases)

The plan's own header section documents a deviation from the ratified spec, confirmed with the user during plan-prep:
- `Destiny` (shared `allCards.json` template, cost `15`, no keywords) is reused byte-for-byte unmodified — no edits of any kind, ever, to its authored JSON.
- `Acceptance` (`KEYWORD_COST_MODIFIERS.Acceptance = { kind: "ClearCostPerSelfKeyword", costPer: -1 }`, decaying, not persistent) is applied to `Destiny` by this world's own `RemoveKeyword` reward cards, via a new named-target `ApplyKeyword` variant (`worldCardInHandByTemplateId`) — never via `Destiny`'s own hooks.
- This voids REQ-W15-12 (placeholder cost 50/45) and partially supersedes REQ-W15-13/13a/14/15/18. Full detail in the plan's deviation section — implementation agents for Slice 1/2 must read that section, not just the numbered steps.

## Log

### Phase 3 (Slice 2 Steps 9-12) — complete, reviewed clean

Step 11a landed first (`"the-beginning": "Destiny"` in `WORLD_THREAT_BY_WORLD_ID`, `src/core/effects/gainCard.ts`). 19 new templates added to `src/data/allCards.json` (287 insertions, 0 deletions), grouped:
- **Act I:** `It's Fine, Actually` (Denial threat), `Somebody Else Will Handle It` (Anger threat), `A Story You've Told Yourself` / `Somebody Should Be Mad About This` (Obstructed tool-fetch, grant reward cards), `Every Excuse Sounds Thinner`, `One More Excuse` (keyword-free filler).
- **Act II:** `A Smaller Ask` (Bargaining, gentler), `It's Not So Bad` (Depression, gentler), `Terms You Already Know` / `The Same Tired Weight` (Obstructed tool-fetch, grant reward cards).
- **Act III:** `He's Still Fighting` (Obstructed tool-fetch), `The Weight You're Still Carrying` (filler); reward cards `Say It Out Loud`/`Put It Down`/`Close the Book On It`/`Set It Down` (each: DealProgress + RemoveKeyword{2} + ApplyKeyword{Acceptance:15, target:"worldCardInHandByTemplateId", templateId:"Destiny"} Sequence — this plan's central mechanic); companion-flavor rewards `Watch Over Him`/`Help Him Focus`/`Keep Him Upright`.

Deck composition recorded for Slice 3 (`src/data/worlds/the-beginning/cards.json`, not yet created): Act I 8 cards, Act II 6 cards, Act III 5 cards (incl. `Destiny` ×1 and `The Walker` ×1 closer) — matches plan's 8/6/5 (REQ-W15-21/22). `Destiny`/`Door`/`Summon Door`/`The Walker` confirmed untouched. Zero template-id collisions (grepped before writing). `bun run typecheck`/`lint`/`test` all clean, 1581/4/0, no regressions.

**Flag:** all 19 new templates omit `insetKey` (optional field, first time any of the 205 existing templates has omitted it) — matches Step 17's "ships without inset art initially," not a gap introduced silently, but noted since it's a first for the catalog.

**Review (independent, scripted diff-based):** clean, no findings. Confirmed programmatically (not just by inspection): all 4 reward-card→keyword-stripped cross-mappings correct (Say It Out Loud→Denial, Put It Down→Anger, Close the Book On It→Bargaining, Set It Down→Depression) each with correct `ApplyKeyword{Acceptance:15}` onto `Destiny`; all 12 world-kind templates define all 5 hooks; `Destiny`/`Door`/`Summon Door`/`The Walker` confirmed byte-identical (205→224 templates, +19/-0/0-altered); zero id collisions; signature-threat keywords applied via `ApplyKeyword{target:"self"}` in `onDraw` (not baked into static `keywords` field), matching the plan's required RemoveKeyword-strippable pattern. Tests/typecheck/lint independently reconfirmed clean.

### Phase 4 (Slice 3 Steps 13-18) — complete, reviewed clean

World bundle created: `src/data/worlds/the-beginning/{cards.json,theme.ts,meta.ts,index.ts}`, `src/game/assets/themes/the-beginning/insets/README.md` (three-Direction exception, flagged in its own opening note per plan). Registered as 15th entry in `src/data/worlds/registry.ts`. `assetBindings.ts` wired to the confirmed-present `the-beginning-reality.webp`/`intrusion-overlay.webp`. No music track exists — added `"the-beginning"` to `PENDING_MUSIC_TRACK` in `worldAssetBindings.test.ts` (matches `questions`/`answers` precedent, not a new gap). `theBeginning.test.ts` added mirroring `answers.test.ts`. Incidental fix required by registering a 15th world: `src/sim/tests/completeness.test.ts`'s hardcoded registry-length assertion bumped 14→15 (only surfaced by running the full suite). Full validation: `bun run test` 1602 pass/5 skip/0 fail, typecheck/lint/build all clean.

Two judgment calls, both sound: (1) `selectTheme` lives in `src/game/`, importing into `src/core/tests/` would violate the lint-enforced core/game boundary — `answers.test.ts` itself never calls it either, so left theme resolution to `worldRegistry.test.ts`'s existing generic conformance check instead. (2) Step 18's literal text ("Destiny... loses the corresponding grief keyword") contradicts the plan's own deviation section (Destiny authors `keywords: []`, never touched) — correctly read as an imprecise paraphrase; the test instead verifies the grief keyword is stripped from a separate hazard-carrier card in the same hand while Destiny specifically gains Acceptance, which is what the mechanism actually does. `difficulty: 4` in meta.ts is a placeholder (no explicit value specified anywhere), between answers' 3 and eden-prime's 5.

**Review (independent):** clean, no findings. Confirmed on disk that both art files exist and bundle correctly (`bun run build` output verified). Confirmed VisualTheme's hex values are genuinely distinct from both siblings (not relabeled), and grepped the full renderer path confirming no per-act theme switching exists anywhere. Confirmed the reward cards' actual authored Sequence (`[DealProgress, RemoveKeyword{target:"hand"}, ApplyKeyword{target:"worldCardInHandByTemplateId", templateId:"Destiny"}]`) matches what the test exercises. Independently reran full test/typecheck/lint/build, all clean (1602/0/5). One inherited, non-blocking observation: `theBeginning.test.ts`'s catalog-uniqueness assertion is tautological (JS object keys are always unique) — same pattern already present in `answers.test.ts`/`newDerelict.test.ts`, not a regression introduced here, not fixed (out of scope, pre-existing pattern across 3 files).

### Phase 5 (Slice 4 Step 19) — complete, verification only

Confirmed `GRIEF_SUPPORT_WORLD_IDS` in `src/game/scenes/griefSupportGate.ts` already lists `["questions", "answers", "the-beginning"]` — added together in commit `6aa8c61` (the `answers` completion commit), anticipating the trilogy gate; no new code needed for `the-beginning`. Traced the flow: a single trilogy-wide `hasSeenGriefSupportNotice` boolean (`localStorage`, not per-world) gates `GriefSupportScene` vs. direct-to-`Table` in `WorldSelectScene.ts`. No other duplicate gate constant found anywhere in `src/`. `bun run test` reconfirmed 1602/0/5, no regressions. No files modified.

### Phase 6 (Slice 5 Steps 20-23) — complete, reviewed clean

`world-the-beginning` Blessing added to `catalog.json` (cost 30, confirmed genuinely next in the 5/5/5→10/10/10→15/15/15→20→25→30 sequence), `effect: {type:"worldUnlock", worldId:"the-beginning"}`. `isWorldUnlocked` is fully generic (no per-world special-casing); existing `catalog.test.ts` coverage already exercises it generically, no new test needed. `theme-authoring.md` updated: signature-verb table row for `the-beginning`/`unburden`, `Acceptance` documented as prose (not a new keyword table row, per plan), new engine-primitive Signature-effects row for `worldCardInHandByTemplateId` (agent's judgment call: plan's "not a table row" instruction was scoped to the `Acceptance` keyword specifically, not the new primitive — reasonable reading). `endworlds-trilogy-concept.md` addendum rewritten prediction→confirmed fact; also fixed one directly-adjacent stale sentence (line 30, "the-beginning (not yet planned)...") beyond the letter of Step 23 but consistent with the doc's own established pattern of correcting referring sections when an addendum lands.

**Unplanned but necessary fix:** adding the catalog entry broke `src/game/tests/unlockAssetBindings.test.ts` (generic conformance: every catalog entry needs a bound icon asset) — not called out anywhere in the plan. Agent generated `src/game/assets/unlocks/world-the-beginning.webp` (256×256, matching sibling icon style, warm/amber-toned) and wired it into `assetManifest.ts`.

Full validation clean: `bun run test` 1602/0/5, typecheck/lint/build all pass. No commit made.

**Review (independent):** clean, no findings. Confirmed cost sequence (5,5,5,10,10,10,15,15,15,20,25,30) genuinely puts 30 next; catalog now 33 entries (32+1, matches Step 6's "32 entries today" reference). Confirmed `isWorldUnlocked` genuinely generic, existing `answers`-pattern test already covers this structurally, no gap. Confirmed icon conformance check is real (not invented), fix minimally scoped, format matches majority of siblings (23/32 lossy VP8). Confirmed `theme-authoring.md`'s "not a Signature Effects table row" prohibition is textually scoped to `Acceptance` only (verified against REQ-W15-26's exact wording) — the new primitive's own table row mirrors the `eden-prime` precedent and isn't a violation. Confirmed `endworlds-trilogy-concept.md`'s addendum matches the actual implemented Sequence in `allCards.json` exactly; the adjacent line-30 fix was necessary to avoid an internal contradiction in the same doc. Reconfirmed `Destiny` byte-identical to HEAD (Step 24.6's gate, satisfied early). Full suite/typecheck/lint/build reconfirmed clean.

### Phase 7a (Slice 5 Step 24, automated items 1-8) — complete

All 8 numbered validation items checked; 6 already covered by prior slices' tests, 2 genuine gaps filled:
- **Already covered:** Acceptance→Destiny cost negative/decay/refresh (Slice 1 + `theBeginning.test.ts`); Door immunity to Acceptance/Denial/Depression (correctly NOT claiming immunity to Anger/Bargaining, which legitimately tax Door by pre-existing design); `Destiny`/`Door`/`Walker`/`Summon Door` byte-identical diff (confirmed via `git diff master -- src/data/allCards.json`, single additive hunk, zero `-` lines); `keywordGuard` scoped-to-`the-beginning` seeding (Slice 1 review's scoping fix, `world.test.ts`).
- **New — Door/Destiny `onCleared` independence:** no prior world has both entities simultaneously, so no precedent existed. Added test in `theBeginning.test.ts` proving clearing Door doesn't consume/disable Destiny and vice versa (both fire `SurviveWorld` independently).
- **New — actionPreview negative-display guard:** no existing test exercised Acceptance driving a cost below zero through the preview string. Added test in `actionPreview.test.ts` confirming the rendered string never shows a negative number.

`bun run test` 1604 pass/0 fail (up from 1602, +2 new), lint/typecheck/build all clean. No production code changed, only tests added. Items 9-10 (manual playtest, grief-support recheck) deferred to next phase.

### Phase 7b (Slice 5 Step 24, manual playtest) — partial, handed to user

Dispatched a browser-driven playtest agent. It confirmed items 1-2 cleanly (grief-support interstitial trilogy-wide gating, unlock gating locked/unlocked via `purchased` list). Mid-Act-I playthrough it hit a real, pre-existing, non-`the-beginning`-specific bug: `src/core/engine/logEvent.ts` threw `Error: logEvent: unhandled event type KeywordReduced` on ANY non-persistent keyword decay flowing through `dispatch()` (Denial/Anger/Bargaining/Depression/Alarm/Acceptance — only `Lockdown`/`Reroute` are persistent/exempt), silently discarding that turn's state update since the throw happens before `dispatch()` reassigns `current = result.state`. Unit tests never caught this because they call `reduce()` directly, bypassing `dispatch()`'s `logEvent` wrapping entirely — a real test-coverage gap at the `dispatch()` boundary, not specific to this world.

**User fixed this directly, live, mid-session** (not through my agent orchestration): added `case "KeywordReduced":` falling through to the existing `KeywordRemoved` case in `logEvent.ts` (same event shape, no `value` field) — committed as `43027f4 "Fixed a logging bug."` (visible in this session's initial git log, meaning this happened concurrently with/before my dispatched work). Agent confirmed clean turn progression after the fix. **User also separately added `the-beginning-cardfront.webp`** (commit `b4895e9`, currently further modified on disk) — resolves Step 17's flagged "no cardfront art" gap, not yet wired into `assetBindings.ts`.

Agent did not reach Act III before being stopped — the core Acceptance loop, Destiny's per-turn punishment, and companion-flavor legibility remain unverified by automated playtest. **User decision: wire the cardfront now via agent dispatch; user will finish the Act III manual playthrough themselves** rather than redispatching the playtest agent. Also dispatching a `dispatch()`-level regression test for the keyword-decay logging gap, since this is a real coverage hole independent of this world.

### Phase 1 (Slice 1 Steps 1-6) — complete

All six steps implemented by an implementation agent. Files changed: `src/core/model/types.ts` (Acceptance keyword name; new `ApplyKeyword` target variant `worldCardInHandByTemplateId` + `templateId` field, as a sibling discriminated variant, not a modification of the original), `src/core/model/keywords.ts` (KEYWORD_NAMES, KEYWORD_COST_MODIFIERS.Acceptance, not added to PERSISTENT_KEYWORDS), `src/core/effects/appliedKeywords.ts` (new switch case, reuses `applyToHandIds`), `src/core/view/actionPreview.ts` (display-only clamp via new `displayCost` local, `effectiveWorldCardCost` itself unclamped), `src/data/unlocks/types.ts` (`extraStartKeywordGuard` on `RunModifiers`/`DEFAULT_RUN_MODIFIERS`), `src/data/unlocks/catalog.ts` (`WEIGHT_PER_CHARGE`/`MAX_GUARD` constants + aggregation in `buildRunModifiers`), `src/core/engine/world.ts` (`keywordGuard: mods.extraStartKeywordGuard`). `effectiveCards.ts` confirmed read-only, no-floor claim verified. `Destiny`'s authored template untouched. `bun run typecheck` and `bun run lint` both pass. No tests written/run yet (separate phase), no commit made.

**Finding — placeholder constants make Step 6 mechanism currently inert:** the catalog already has an existing `DESTINY_BUDGET = 5` enforced by `canActivate` (`activeWeight(profile, catalog) + def.destinyWeight <= DESTINY_BUDGET`), confirmed as the only production call site's gating (`gameplayRuntime.ts:136` calls `buildRunModifiers` with `activeProfile.activated`, which `canActivate` already bounds). With `WEIGHT_PER_CHARGE = 10`, `Math.floor(totalWeight / 10)` is 0 for every possible sum 0-5 today. So `extraStartKeywordGuard` will be 0 under every activation set achievable in the current game, not just fresh profiles — the feature doesn't yet demonstrate nonzero behavior with real data. The plan itself flagged these constants as placeholders pending a balance pass against the real catalog sum, so this isn't a plan violation, but it needs a numeric correction before Step 7's world-init test can show a meaningful nonzero case, and before Slice 5's manual validation. Decision: lower `WEIGHT_PER_CHARGE` (e.g. to `2`) as part of Phase 2 so the mechanism is observably alive under the existing `DESTINY_BUDGET`, still clearly marked as an unauthored placeholder pending a real `bun run sim`-informed balance pass. Flagging prominently again at Step 24.

### Phase 2 (Slice 1 Step 7 unit tests) — complete

`WEIGHT_PER_CHARGE` corrected from `10` to `2` (kept `MAX_GUARD = 3`) in `src/data/unlocks/catalog.ts`, placeholder-framing comment updated. Confirmed non-inert via new tests: 2-weight unlock set → `extraStartKeywordGuard: 1`; 13-weight set clamps at `MAX_GUARD = 3`. New tests added across `src/data/unlocks/catalog.test.ts` (3), `src/core/tests/world.test.ts` (1 integration test through `createWorld`), `src/core/tests/effectiveCards.test.ts` (Acceptance no-floor/immediate-discount/decay-refresh tests + Door regression), `src/core/tests/appliedKeywords.test.ts` (2, `worldCardInHandByTemplateId` target). One pre-existing test's hardcoded `extraStartKeywordGuard: 0` expectation was fixed since it was only true under the old broken constant (its ids sum to weight 7 → now correctly expects `3`). 11 new tests, suite at 1585 total (1581 pass, 4 skip, 0 fail), typecheck/lint clean.

### Phase 2b (Slice 1 review) — findings, one escalated to user

Review agent independently re-ran `bun run test`/`typecheck`/`lint` (all green) and confirmed every Slice 1 correctness property (Destiny byte-identical, Acceptance not persistent, no-floor cost summing, worldCardInHandByTemplateId isolation, actionPreview display-only clamp, zero catalog.json edits). Two additional findings:

1. **Escalated to user — resolved.** `extraStartKeywordGuard` is wired into the shared `createWorld` (`src/core/engine/world.ts`), so per the plan's literal instruction it applies to every world with `KeywordGate` (`questions`, `answers`, `eden-prime`, `new-derelict`), not just `the-beginning` — a retroactive cross-world balance change the plan's deviation section didn't consider (it was careful about this exact class of risk for the shared `Destiny` template, but not here). Currently inert in practice (max achievable guard under `DESTINY_BUDGET=5`/`WEIGHT_PER_CHARGE=2` is 2, below `MAX_GUARD=3`), but would silently activate if the catalog grows. **User decision: scope to `the-beginning` only.** Fixed: `keywordGuard: world.worldId === "the-beginning" ? mods.extraStartKeywordGuard : 0` in `createWorld`, with an explanatory comment. `world.test.ts`'s test updated to prove the scoping directly (same nonzero `RunModifiers`, `the-beginning` gets the guard, `questions` gets 0).
2. **Cosmetic, fixed.** Four "World 15 (the-vigil)" stale-name comments replaced with `the-beginning`; post-fix repo-wide grep for "the-vigil" confirmed clean (it was purely a leftover, not a real referenced entity).

**Slice 1 (Steps 1-7) fully complete and reviewed.** `bun run test` 1581 pass/4 skip/0 fail, typecheck/lint clean.

**Finding — plan's Door-isolation claim is imprecise, not fully wrong:** REQ-W15-10/30.5's claim that Door's cost is unaffected by "any amount of Acceptance, Denial, Anger, Bargaining, or Depression" only holds for Acceptance/Denial/Depression (all `ClearCostPerSelfKeyword`, self-only). Anger (`ClearCostPerKeywordCount`) and Bargaining (`ClearCostPerOtherKeyword`) are hand-wide by design and DO tax Door when present elsewhere in hand — this is pre-existing, intentional World 13/14 behavior, already covered by existing test blocks. The test-writing agent correctly scoped the new regression test to the three self-only keywords rather than asserting a false claim, and added a separate, narrower regression test confirming Door is untouched specifically by the new `worldCardInHandByTemplateId` target when aimed at another card. No code changed because of this — it's a plan-language imprecision, not a behavior bug.


