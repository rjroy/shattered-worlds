---
title: "Implementation notes: answers (World 14)"
date: 2026-07-04
status: complete
tags: [world, walker-narrative, grief-arc, implementation, notes]
source: .lore/work/plans/answers.md
modules: [core-effects, data-worlds]
---

# Implementation notes: answers (World 14)

Orchestrated implementation of `.lore/work/plans/answers.md` (22 steps, 5 slices). No `.lore/lore-agents.md` registry exists — using `general-purpose` for implementation/testing/review roles throughout.

## Pre-flight (done)

- Researched prior work via `lore-researcher`: confirmed clean slate (no `src/data/worlds/answers/`, no `Bargaining`/`Depression` in `src/`, no prior notes). `feat/answers` branch has 3 planning-only commits (`7b1df52`, `5b2e0e5`, `0217efc`) — zero production code landed yet.
- Confirmed design doc (`answers-card-design.md`) is stale on the `Destiny` template specifically (still describes pre-`5b2e0e5` `Denial:2`/`ExileTopWorldCards` version) but current on everything else (all 14 world-card + 7 reward-card templates unaffected by the Destiny rewrite). Sub-agents must copy those templates verbatim from the design doc but defer to the plan header's corrected Destiny table/formula for anything touching that card.

## Progress tracker

### Slice 1 — Core-engine keyword slice (Steps 1-5) ✅ complete
- [x] Step 1: Add `Bargaining`/`Depression` to `KeywordName` union
- [x] Step 2: Register in `KEYWORD_NAMES`, `KEYWORD_COST_MODIFIERS` (not `PERSISTENT_KEYWORDS`)
- [x] Step 3: Add `"answers": "Destiny"` to `WORLD_THREAT_BY_WORLD_ID`
- [x] Step 4: Confirm no change needed in `effectiveCards.ts` (verification only)
- [x] Step 5: Unit tests in `effectiveCards.test.ts` + `keywords.test.ts`
- [x] Slice 1 test + review gate

### Slice 2 — World content authoring (Steps 6-10) ✅ complete
- [x] Step 6: Act 1 card templates
- [x] Step 7: Act 2 card templates
- [x] Step 8: Act 3 card templates
- [x] Step 9: Reward player cards + boon pool
- [x] Step 10: Deck composition (JSON drafted, held for Slice 3 to write to `cards.json`)
- [x] Slice 2 test + review gate

### Slice 3 — World bundle wiring (Steps 11-16) ✅ complete
- [x] Step 11: `cards.json`
- [x] Step 12: `theme.ts`
- [x] Step 13: `meta.ts`
- [x] Step 14: `index.ts` + registry
- [x] Step 15: `assetBindings.ts` (art gap flagged — see log; partially different from plan's assumption)
- [x] Step 16: `answers.test.ts` + confirm `worldRegistry.test.ts`
- [x] Slice 3 test + review gate

### Slice 4 — Grief-support interstitial (Step 17, verification only) ✅ complete
- [x] Step 17: confirmed `GRIEF_SUPPORT_WORLD_IDS` already includes `answers` (hardcoded list, no dependency on world registry); manual check deferred to Step 22

### Slice 5 — Unlock gating, docs, final validation (Steps 18-22)
- [x] Step 18: `world-answers` unlock catalog entry
- [x] Step 19: unlock test coverage
- [x] Step 20: `theme-authoring.md` update
- [x] Step 21: `endworlds-trilogy-concept.md` addendum
- [x] Step 22: Final validation gate (full test/lint/typecheck/build + manual checks — see log for live-browser limitation)

## Log

**2026-07-04 — Slice 1 complete.** Implemented, tested, reviewed. No divergences from plan.
- Implementation: `types.ts` (KeywordName +Bargaining/Depression), `keywords.ts` (KEYWORD_NAMES, KEYWORD_COST_MODIFIERS — `ClearCostPerOtherKeyword`/`ClearCostPerSelfKeyword`, neither PERSISTENT_KEYWORDS), `gainCard.ts` (`answers: "Destiny"` in WORLD_THREAT_BY_WORLD_ID). New tests in `effectiveCards.test.ts` and `keywords.test.ts`.
- Test gate: `bun run test` → 1534 pass (new tests included), 12 pre-existing unrelated failures (missing music assets for other worlds, confirmed via stash comparison against clean branch — not caused by this slice). `bun run typecheck` clean.
- Review gate: independently re-verified `ClearCostPerOtherKeyword`'s switch-arm behavior, the count-vs-value test trap, carrier-pays-nothing assertion, stacking formula, decay tests, and confirmed no exhaustiveness gaps (keywords render as plain text, no icon map to update). Zero non-conformances.

**2026-07-04 — Slice 2 complete.** 21 new card templates authored into `src/data/allCards.json` (Act 1/2/3 + 7 reward cards), plus `pool-ledger-reading` boon pool entry in `boonPools.json`. Deck composition JSON drafted and held for Slice 3.
- **Divergence found and resolved (approved by user):** the design doc itself never wires a granting source for the `Let It Go` reward card (REQ-W14-18's `DiscardThenDraw` "cycling" reward) — every other Act 3 reward card has a clear `onCleared` source, but `Let It Go` had none, in both the design doc's card list and its deck composition. This predates this implementation session; it's a gap in the design doc, not something introduced during authoring. Escalated to the user via AskUserQuestion; resolved by wiring `The Weight Doesn't Lift`'s `onCleared` (previously `{"kind":"None"}`) to `{"kind":"GainCard","template":"Let It Go"}` — thematically apt (clearing the Act 3 signature Depression threat grants the "let go and keep moving" reward), same effect shape as `A Reason to Keep Moving`→`Let It Sit` and `Just Keep Walking`→`Keep Walking`.
- No new `Destiny` template authored; existing `Destiny`/`The Walker`/`Summon Door`/`Door` untouched, confirmed unchanged against the plan header's corrected table.
- Test gate: `bun run test` → 1534 pass, 12 pre-existing unrelated failures (same set as Slice 1 baseline), `bun run typecheck` clean, `assembleCatalog` validation (duplicate-id/rarity checks) passes for all 21 new templates.
- Review gate: verified REQ-W14-8a's authored-vs-applied split (only `It Calcified` authors `Depression:2` statically; every other Bargaining/Depression card uses `ApplyKeyword{target:"self"}` on `onDraw`), Self-Transform pattern correctness for both pairs, REQ-W14-6's no-spreading constraint on `The Weight Doesn't Lift`, `RemoveKeyword` reward wiring, `AddThreatToWorldDeck`'s runtime resolution to `Destiny`, five-hook completeness, and no typos in effect kinds/keyword strings. One non-conformance found (`Let It Go`, above) and fixed; re-verified JSON validity, typecheck, and full test suite after the fix — no regressions.

**2026-07-04 — Slice 3 complete.** Created `src/data/worlds/answers/` bundle (`cards.json`, `theme.ts`, `meta.ts`, `index.ts`), registered `ANSWERS_BUNDLE` 14th in `registry.ts`, wired `assetBindings.ts`, added `src/core/tests/answers.test.ts` (7 tests).
- **Plan-premise correction (not a divergence needing approval, just a factual update):** the plan assumed zero art exists for `answers`. In fact `answers-reality.webp`/`intrusion-overlay.webp` already exist on disk (generated in an earlier commit alongside `questions`'s art set, landed in `6aa8c61`) — independently confirmed via `ls`. Wired those into `assetBindings.ts`. What's genuinely still missing: cardfront + all card insets (confirmed no `answers-cardfront.webp`, no `insets/` dir, no card template authors an `insetKey`) and a music track (no `answers-music.mp3`; added `'answers'` to `PENDING_MUSIC_TRACK` mirroring the existing `questions` precedent). These two gaps remain open per Step 15's instruction to flag rather than silently defer.
- **Regression caught and fixed:** `src/sim/tests/completeness.test.ts` had a hardcoded `expect(worldDataRegistry.length).toBe(13)` that broke once `answers` became the 14th registered world. Bumped to `14` (a plain stale-literal fix, confirmed not masking a deeper issue) — full suite back to baseline (1555 pass, 12 pre-existing unrelated failures, 0 new).
- Test gate: full `bun run test`, `lint`, `typecheck`, `build` all clean/passing at established baseline after the regression fix. `Destiny` cost-formula test independently reverified: `15 + 3×costPer(Bargaining) = 18`.
- Review gate: verified theme hue contrast against `questions` (cool blue `#8a95a3` vs. warm green `#9fae9a`), help text avoids naming grief stages while including the Destiny-reuse disambiguation note, art-gap claims independently confirmed on disk, `answers.test.ts`'s hook/keyword loop and Self-Transform tests exercise real effect application (not stubs), registry wiring shape-correct and non-duplicated. Zero non-conformances.

**2026-07-04 — Slice 4 verification.** Confirmed (no code change needed): `src/game/scenes/griefSupportGate.ts`'s `GRIEF_SUPPORT_WORLD_IDS` already includes `"answers"` (added during World 13's execution, trilogy-wide by design). Manual interstitial check deferred to Step 22's final validation gate.

**2026-07-04 — Slice 5 (Steps 18-21) complete.** Added `world-answers` Destiny Blessing entry to `src/data/unlocks/catalog.json` (cost 25, mirrors `world-questions` shape). Added gating tests to `src/data/unlocks/catalog.test.ts`. Updated `.lore/reference/worlds/authoring/theme-authoring.md` (signature-verb row, Bargaining/Depression C2 prose, Destiny-reuse note) and `.lore/reference/worlds/catalog/endworlds-trilogy-concept.md` (reuse addendum).
- **Test-coverage asymmetry found (not fixed, by design):** `world-questions` itself has zero dedicated per-entry gating tests — only generic mechanism tests via other worlds. `answers` now has more per-entry coverage than `questions`, per explicit instruction to add it anyway. Flagging, not silently resolving.
- **Real blocker found and fixed (escalated to user):** adding `world-answers` to the catalog broke previously-green `unlockAssetBindings.test.ts`, since every registered world's unlock entry requires a bound icon asset and none existed for `answers` — a gap the plan never named (parallel to the already-known cardfront/inset gap, but distinct and blocking, not deferred). Asked the user how to proceed; they chose to generate the icon now. Generated via `art-gen:generate-image` (flux-2-pro, 1:1, native webp): a padlock resting on a weathered ledger book beside a half-open door in cool blue-grey fog, matching the existing per-world padlock-icon convention (`world-questions.webp`'s prison-gate motif, `world-eden-prime.webp`'s garden motif) while fitting `answers`'s Bargaining/Door/Depression beats and cooler palette. Saved to `src/game/assets/unlocks/world-answers.webp`, wired into `assetManifest.ts`. `unlockAssetBindings.test.ts` and `bun run build` both pass.
- **Endworlds-trilogy-concept.md stale-prose note:** the implementer flagged that the doc's existing "continuous hazard entity" section still describes `Destiny` as independently authored per world with differing `onCleared` behaviors, which now contradicts the reuse decision — noted inline in the addendum but not rewritten (out of scope for the "small addendum" this step called for). Worth a follow-up pass.

**2026-07-04 — Step 22 final validation gate complete.**
- Automated gate: `bun run test` (1558 pass, 12 pre-existing unrelated failures, 0 new), `bun run lint`, `bun run typecheck`, `bun run build` all clean. All 9 itemized Step 22 assertions independently reverified (Bargaining value-vs-count trap, carrier-pays-nothing, Destiny cost formula = 18, Walker/Door/SurviveWorld wiring byte-identical, decay + RemoveKeyword-no-op coverage, full diff stat).
- **Live browser/manual playtest limitation:** no Chrome instance was available in this sandboxed environment (claude-in-chrome extension not connected, Playwright's `chrome` channel not installed). Manual playthrough and the grief-support interstitial click-through were verified **structurally** instead (reading `griefSupportGate.ts`/`griefSupportProfile.ts`, the existing `griefSupportGate.test.ts` coverage, and `AddThreatToWorldDeckHandler`'s runtime wiring) rather than live-clicked. If a real visual/interaction check is wanted, the user should run `bun run dev` themselves.
- **Real finding from static review, escalated and fixed:** `AddThreatToWorldDeckHandler.compile()` (in `src/core/effects/gainCard.ts`) rendered the raw template id `"Destiny"` in `A Deal Too Easy`'s preview token instead of the card's actual display name `"The Destiny"` — a generic bug affecting every world using `WORLD_THREAT_BY_WORLD_ID`, not answers-specific. User chose to fix it generically. Added `catalogDisplayName()` helper (backed by `CARD_CATALOG`, imported from `src/data/worldManifest` — confirmed core/game boundary-safe, matches existing `pools.ts` precedent), plus a regression test in `src/game/tests/effectGlyphs.test.ts` asserting `compileEffect({kind:"AddThreatToWorldDeck"}, "answers")` produces `"The Destiny"`.
- **Slice 5 review findings, both fixed:** (1) a redundant double-lookup in the `compile()` fix's fallback branch, simplified to a direct `"<Unknown>"` fallback; (2) `endworlds-trilogy-concept.md`'s pre-existing "continuous hazard entity" section still asserted the old per-world-independent-authorship model and stale `onCleared` values, directly contradicting the new addendum — corrected in place (not just noted) so the doc no longer holds two contradictory mechanical claims.
- Final full-suite state: 1558 pass, 4 skip, 12 fail (all pre-existing, unrelated to this world — missing music-asset bindings for 12 other worlds), lint/typecheck/build clean.

## Status: implementation complete

All 22 plan steps done across 5 slices. Every phase went through implement → test → review; 4 real issues were found and fixed along the way (the `Let It Go` unreachable-reward gap, the `completeness.test.ts` hardcoded world count, the missing unlock icon, and the `AddThreatToWorldDeck` display-name bug plus its own two follow-up review findings). One capability gap remains open: no live browser verification was possible in this environment. Suggest the user runs `/simplify` on the changed files, and separately spot-checks the game live via `bun run dev` for the interstitial/playthrough items this session couldn't reach.
