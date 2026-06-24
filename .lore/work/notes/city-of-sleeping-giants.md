---
title: "Implementation notes: City of Sleeping Giants"
date: 2026-06-21
status: complete
tags: [implementation, notes, world-design, city-of-sleeping-giants, stirring, recurrence]
source: .lore/work/plans/city-of-sleeping-giants.md
modules: [world-data, themes, game-view, unlocks, boons]
---

# Implementation notes: City of Sleeping Giants

Implementing [the city-of-sleeping-giants plan](../plans/city-of-sleeping-giants.md) (REQ-GIANTS-1..49). Eighth world, verb **stir** (recurrence/escalation of body-movement hazards). No core slice; all on existing engine vocabulary. Canonical template: `the-ember-orchard` (the twin), which mirrors `whiteout-parking-garage`. Orchestrated via `/implement` — all code/test/review through sub-agents.

## Approved deviations from spec (carried from plan decisions)

- **§1 / REQ-22/24/25/27 + REQ-19:** every `Hidden` authored as `Obstructed` (engine keyword); `bonus Hidden +1` → `{ tag: "Obstructed", amount: 1 }`.
- **§2 / REQ-23/27/28/46:** `ReturnWorldCards` on world auto-hooks is inert (`ctx.returnIds` undefined) + boon-signed where it fires + no world discard pile. Re-expressed as `AddWorldCardToDeck { bTop }` on three cards: Fingerquake Ward, District Recall, The Giant Turns In Sleep.
- **§4 / REQ-24/46:** Surveyors Mark A Pulse `onCleared` runs `OfferBoon { setId: "pool-survey-results", offeredCount 3, chooseCount 1 }` instead of `Sequence[GainCard ×5]`. Rewards single-sourced in `src/data/worlds/boons/giants.json` (A8).
- **§5 / REQ-23/28/46:** body-movement hazards deal `ForceDestroy` not `Damage` to revive `Brace`: Fingerquake Ward (`onDiscarded`/`onEndOfTurn` `Damage 1`→`ForceDestroy 1`), The Giant Turns In Sleep (`onDiscarded` `Damage 3`→`ForceDestroy 2`; keeps `onEndOfTurn Damage 2`).

## Decisions made during orchestration

- **2026-06-21: Art DEFERRED (user choice, mirrors Ember).** Wire all base/music bindings + turnkey TODO comments for the 13 insets + unlock art; asset-binding tests stay RED by design (do NOT add placeholder files); file a deferral issue. User generates the 14 images later.

## Prior-work anchors (from lore-researcher + Ember notes)

- `.lore/work/notes/the-ember-orchard.md` — the twin (7th world). **Critical infeasibility:** `OfferBoon` can only offer cards from a MERGED boon set; the `worldManifest` sync test requires `templateIds == cardTemplates` exactly; the merged boon source must resolve in EVERY world catalog. Reward cards that reference a **world** card cannot live in a boon set. For Giants this implicates **Follow The Vein** (`AddWorldCardToDeck{Vein-Road Surge}` — a world-card ref). Ember resolved by keeping world-referencing rewards in `cards.json` granted via `GainCard` on clear, and topping the boon pool with self-contained tools to reach 5 for the 3-of-5 offer. WATCH for this in Slice A8.
- `worldAssetBindings.test.ts` scans ONLY the world bundle's own `cards.json`, NOT the merged boon source — boon-tool inset keys ship silently unbound unless explicitly covered (Ember added a presentation test). Relevant to C3.
- `.lore/work/notes/the-tidal-archive.md` — code-anchored gotcha list confirms all five fixes. Browser smoke unavailable in this env → fall back to build + asset checks, report honestly.
- JSON catalogs are NOT typechecked; parameterized world tests are the only ref-resolution guard.

## Progress

- [x] **Slice A — World data, registration, unlock gating** (A1-A8) ✅ COMPLETE + COMMITTED (user)
  - [x] A1 cards.json (8 world cards + Follow The Vein player card)
  - [x] A2 theme.ts (intrusionHue `#9d6cff`, no collision)
  - [x] A3 meta.ts (user later revised copy at 07:03 — solid)
  - [x] A4 index.ts (bundle)
  - [x] A5 registry.ts
  - [x] A6 threat mapping (gainCard.ts)
  - [x] A7 unlock gating (catalog.ts, cost 5, destinyWeight 0)
  - [x] A8 boon source — **DIVERGENCE (Ember-blessed):** Follow The Vein references the Vein-Road Surge WORLD card, so it can't live in a merged boon set. `pool-survey-results` holds the 4 self-contained tools (Quiet Survey, Brace The Ward, Bone Pin, Contour Map); Follow The Vein stays in `cards.json`, granted via `GainCard` on Vein-Road Surge `onCleared` (changed that hook to `Sequence[GainEnergy 1, GainCard "Follow The Vein"]`). `OfferBoon` now offers 3-of-4, not 3-of-5. No new tools invented (faithful to spec's 5-reward roster).
  - [x] Gate A: 1214 pass / 4 fail (all expected: 2 giants asset/music deferrals + 2 pre-existing Ember art reds); typecheck + lint clean; review conformant.
- [x] **Slice B — Assets, presentation, help, docs** (B1-B6) — CODE DONE, ART DEFERRED
  - [ ] B1 13 card insets (art-gen) — DEFERRED (user generates later)
  - [ ] B2 unlock art (art-gen) — DEFERRED
  - [x] B3 base bindings (user, commit 046dc8c) + music wired. **Bug fixed:** music manifest entry had typo `city-of-the-sleeping-giants` (extra "the") → corrected to `city-of-sleeping-giants` / `music-city-of-sleeping-giants`, reusing `fogBeachPartyMusicUrl` (whiteout/ember precedent). Flipped city `musicKey is bound` test to green. Insets left w/ turnkey TODO.
  - [x] B4 base keys (`-bg/-overlay/-cardfront`) confirmed projecting into preload manifest via `...worldAssetUrls`; unlock-art added as deferred `// TODO(giants art)` comment (mirrors Ember line 133).
  - [x] B5 world-select pages automatically (`Object.keys(worldManifest)` + `VISIBLE_WORLD_COUNT`/paging in `worldSelectPaging.ts`); no layout change, no hide-fallback needed.
  - [x] B6 theme-authoring doc: added `stir` verb row; added `ReturnWorldCards` inert-on-auto-hooks caveat. `Hidden`/`AddWorldCardToTop` tokens were already fixed by prior passes.
  - [x] Gate B: 1212 pass / 6 fail; city base+music resolve, city insets RED by design.

## ⚠️ Unrelated red tests on this branch (USER-OWNED, not part of giants)

Confirmed via stash before/after — present in baseline, NOT introduced by giants work. Tied to the user's in-flight `recall` glyph commits (`01c5940`, `a0080bd`):
- `EFFECT_ICON_TEXTURES > maps every IconId...`
- `compileEffect > ReturnPlayerDiscardToTop`
- `compileEffect > RecallPlayerDiscard`

The final Gate C must NOT claim "all green" — report giants tests green + these 3 as user-owned recall-work reds. Do not fix or absorb them into this implementation.
- [ ] **Slice C — Tests and validation** (C1-C5)
  - [x] C1 world-data tests (5) — `src/core/tests/cityOfSleepingGiants.test.ts`
  - [x] C2 stirring-pattern effect tests (11) — same file; OfferBoon-on-clear, ForceDestroy, Brace absorption end-to-end, District Recall top-deck ordering, threat-mapping recurrence
  - [x] C3 asset validation — boon-inset coverage added in `src/game/tests/cityOfSleepingGiantsPresentation.test.ts` (RED by design until art)
  - [x] C4 presentation/theme test (2) — palette + base keys; inset-render half deferred to manual smoke
  - [x] C5 seeded three-act gameplay test (4) — deterministic
  - [x] Gate C (final) + holistic spec validation: **SHIP-READY**. No req gaps, no unacknowledged divergences, three deviations correct, all 5 rewards reachable, 3-act/Walker + soft-lock hold. 1236 pass / 7 fail (all accounted for: 4 deferred-art + 3 user recall reds).
- [x] **Finalize** — code/tests complete; art (13 insets + unlock art) DEFERRED to user, tracked in `.lore/work/issues/city-of-sleeping-giants-card-insets.md`.

## Log

- 2026-06-21: Initialized. lore-researcher run complete (anchors above). No task files / no agent registry; using `general-purpose` for all roles. Phases = plan slices A/B/C. User chose to DEFER art (mirrors Ember).
- 2026-06-21: **Slice A COMPLETE + committed by user.** Follow The Vein world-reference trap resolved the Ember way (pool-survey-results = 4 self-contained tools; Follow The Vein in cards.json via Vein-Road Surge onCleared GainCard; OfferBoon 3-of-4). intrusionHue `#9d6cff`, no collision. Gate A: 1214 pass, only expected asset reds; review conformant.
- 2026-06-21: **Slice B COMPLETE (code), art deferred.** User had pre-wired base assets (commit 046dc8c). Agent fixed a music-manifest typo (`city-of-the-sleeping-giants` → `city-of-sleeping-giants`), wired music (reuses fog track), added unlock-art TODO, confirmed world-select paging needs no change, added `stir` verb row + ReturnWorldCards caveat to theme-authoring.md. Flagged 3 unrelated user-owned recall reds.
- 2026-06-21: **Slice C COMPLETE.** 23 tests (22 pass + 1 expected-RED boon insets). No real bugs; all deviations asserted as shipped. Holistic validation SHIP-READY. Filed art-deferral issue. Notes finalized.
