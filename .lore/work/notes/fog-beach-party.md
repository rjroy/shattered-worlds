---
title: "Implementation notes: Fog Beach Party world (conceal) + numeric-keyword engine"
date: 2026-06-14
status: complete
tags: [implementation, notes, fog-beach-party, conceal, numeric-keywords, light]
source: .lore/work/plans/fog-beach-party.md
modules: [core-engine, world-data, game-view, themes]
---

# Implementation notes: Fog Beach Party world (conceal) + numeric-keyword engine

Orchestrated implementation of [`.lore/work/plans/fog-beach-party.md`](../plans/fog-beach-party.md)
(builds spec REQ-FOG-1…38). Five phases, each gated. Work dispatched to sub-agents;
orchestrator does not write/test/review code directly.

## Progress tracker

- [x] **Phase 1 — Numeric-keyword engine** (slice 1, world-agnostic). REQ-FOG-1…6. ✅ COMPLETE
  - [x] 1.1 Split keyword type (`KeywordName` / structured `Keyword`)
  - [x] 1.2 Core keyword helpers (`keywords.ts`)
  - [x] 1.3 Author-as-string + parse at mint
  - [x] 1.4 Route consumers through helper (kill `.includes`)
  - [x] 1.5 Display name + value (kill `.join`)
  - [x] Gate 1 ✅ — 663 pass / 0 fail, typecheck+lint+build green, golden untouched, fresh-context review GO
- [x] **Phase 2 — Light & concealment core** (slice 2 core). REQ-FOG-7…14. ✅ COMPLETE
  - [x] 2.1 `light` state (per-world start, default 0)
  - [x] 2.2 `GainLight` effect + handler
  - [x] 2.3 `LightChanged` event
  - [x] 2.4 `light` IconId
  - [x] 2.5 Concealment helpers (`concealOf`/`isConcealed`)
  - [x] 2.6 Decay clock (emit only on change)
  - [x] 2.7 Targeting filter
  - [x] 2.8 Concealed describe
  - [x] Gate 2 ✅ — 687 pass / 0 fail, golden 9/9 byte-identical, omission-safety proven (TS2741), review GO
- [x] **Phase 3 — Renderer: HUD readout + fog-back**. REQ-FOG-28, 29. ✅ COMPLETE
  - [x] 3.1 `usesLight` flag + `worldUsesLightManifest.ts`
  - [x] 3.2 `effect-icon-light` asset (⚠️ PNG did NOT exist on disk — placeholder created)
  - [x] 3.3 HUD Light readout (visible at Light 0 in light-worlds, absent otherwise)
  - [x] 3.4 Fog-back CardView (instant toggle, not tween fade)
  - [x] Gate 3 ✅ — 694 pass / 0 fail, golden 9/9 byte-identical, cosmetic-only confirmed, review GO
- [x] **Phase 4 — Fog world data**. REQ-FOG-17…27, 29, 32, 33. ✅ COMPLETE
  - [x] 4.1 World folder + registration (5 worlds now)
  - [x] 4.2 `cards.json` (3 acts, startLight 4 → opens at Light 3)
  - [x] 4.3 `theme.ts` + asset bindings (⚠️ music = mall-track placeholder)
  - [x] 4.4 `meta.ts` (6 help notes, Light/conceal/blind-discard covered)
  - [x] Gate 4 ✅ — 720 pass / 0 fail, golden 9/9, discardability safety rule fully met, review GO
- [x] **Phase 5 — Docs + final validation**. REQ-FOG-35 + AI validation table. ✅ COMPLETE (AI scope)
  - [x] 5.1 Amend theme-authoring (C1 += GainLight, C2 += Concealed, C2a numeric convention, SV1 Fog row)
  - [x] 5.2 Final validation pass — 23/23 AI-verifiable rows MET
  - [~] Gate 5 ✅ AI scope — full spec table walked, all MET. ⏳ **Runtime browser smoke + 2 human-only
        playtest items (act-1 feel, strategic-triangle viability) handed to the user/playtest per Gate 5.**

## Lessons carried in from research (lore-researcher digest)

1. World layout VERIFIED current: `src/data/worlds/<id>/` + `registry.ts` + `types.ts`,
   `src/game/worlds/assetBindings.ts`, `src/game/data/assetManifest.ts`,
   `src/data/worldManifest.ts`, `src/game/view/themes/themeManifest.ts`. Plan matches reality.
2. `GainLight` needs an EXPLICIT `available.ts` case (silent-default gotcha) AND an entry in
   the exhaustive `EFFECTS` registry. Prove wiring by deleting the entry and watching `tsc` fail.
3. Keywords stay TEXT, never icons — do NOT add an `IconId` for `Concealed`. (Only `GainLight`
   gets the new `light` IconId.)
4. Adding `light: number` to `GameState` breaks from-scratch test literals (not createWorld
   helpers). Let `tsc --noEmit` enumerate the sites; grep over-reports.
5. Reuse `CounterSpec { KeywordInHand }` / `DealProgressScaled` machinery for Whiteout — no
   bespoke counter. `resolveCounter` exported from `effects.ts`.
6. World JSON effect strings are unchecked `as unknown as RawCardSource` casts — bad fog JSON
   fails at RUNTIME only. Manifest/catalog-build test must resolve every template.
7. Renderer is state-diff based, not event-driven (`TableScene.drawAll()` reconciles against
   `state.hand`). `LightChanged` won't auto-produce feedback; fog-back re-eval is separate work.
8. Test command is ALWAYS `bun run test` (preload required), never `bun test`. Gates:
   `bun run typecheck / test / lint / build`.
9. `describeEffect` is the single pure English seam — concealed "lost in the fog" text and
   `GainLight` prose belong there/in the presentation seam, unit-tested headless.

## ⚠️ Carryover for Phase 4 authoring (do not rediscover as a "bug")

`createWorld` deals the opening hand via `startTurn`, which decays Light **once before the first
player turn**. So a world authored with `startLight: 4` opens at Light **3**. Intended + documented
(`world.ts:81`, test `world.test.ts:228`). **Whoever authors `fog-beach-party/cards.json` must set
`startLight` one HIGHER than the intended opening Light.** Decay rate is constant `LIGHT_DECAY = 1`
in `energy.ts`; `startLight` is the per-world dial.

## Log

- 2026-06-14 — Initialized. No task files, no agent registry, no prior notes. Phases = plan's
  five phases. Roles filled by `general-purpose` agents. Researcher digest captured above;
  verified plan's world-registration paths against current repo (post-consolidation) — accurate,
  no divergence.
- 2026-06-14 — **Phase 1 complete.** Keyword type split landed; 663 pass / 0 fail, golden tests
  byte-identical (mtime 12 Jun, not in diff). Files: `types.ts`, `keywords.ts` (new),
  `contract.ts` (re-exports), `cards.ts` (mint parse), `dealProgress.ts`, `describe.ts`,
  `tokens.ts`, `CardView.ts` (formatKeyword/formatKeywords), test fixtures + new `keywords.test.ts`.
  Notable: (a) the `tsc` worklist was 11 sites, ALL in test files — production compiled clean after
  the helper retypes. (b) `HelpOverlayView.ts` has NO keyword `.join` — plan's "mirror" step was a
  no-op (only prose strings there). (c) `parseKeyword` accepts negative/whitespace values; reviewer
  flagged as non-blocking — no current authored keyword needs guarding. (d) `formatKeyword(s)` are
  exported but display assertions deferred to Gate 3 per plan. Both test-verify (PASS) and
  fresh-context type-split review (GO, zero non-conformances) cleared Gate 1.
- 2026-06-14 — **Phase 2 complete.** Light state + concealment in pure core; 687 pass / 0 fail,
  golden 9/9 byte-identical. Files: `types.ts` (light/GainLight/LightChanged), `catalog.ts`
  (startLight), `world.ts` (init), `worldManifest.ts` (thread startLight), `resources.ts`
  (GainLightHandler), `registry.ts`, `effectGlyphs.ts` (light IconId), `effectLineLayout.ts`
  (texture/placeholder), `keywords.ts` (concealOf/isConcealed), `contract.ts` (exports),
  `energy.ts` (decay-first emit-on-change), `EffectHandler.ts` + `dealProgress.ts` (conceal filter),
  `describe.ts` (fog preview). tsc worklist = 7 from-scratch GameState literals (all tests) +
  worldManifest exactOptional. Divergences: (a) `runStats.ts` DOES have `default: break` — left
  untouched (safe ignore satisfied); (b) no existing no-target effect carries an explicit
  available.ts case — GainLight inherits base, playability asserted by test instead; (c) opening-turn
  decay semantics captured as carryover above. Test-verify PASS + targeting/decay review GO.
- 2026-06-14 — **Phase 3 complete.** Renderer HUD + fog-back; 694 pass / 0 fail, golden 9/9
  byte-identical, cosmetic-only invariant confirmed (fog-back path writes nothing to core). First
  agent hit a SESSION LIMIT mid-work (~90% done); a second agent assessed the working-tree diff and
  finished step 3.2. Files: `worlds/types.ts` (usesLight), `worldUsesLightManifest.ts` (new, derive
  pattern), `HUDView.ts` (Light readout gated on worldUsesLight, visible at Light 0), `CardView.ts`
  (fog-back: revealObjects/fogObjects + applyConcealment toggle), `TableScene.ts` (drawAll re-evals
  HUD+conceal on every dispatch — no separate LightChanged subscription needed), `assetManifest.ts`
  (effect-icon-light), + tests hud/cardObjects/describe. Divergences flagged: (a) **`effect-icon-light.png`
  did NOT exist on disk despite the "assets already there" note → 128×128 placeholder created at
  `src/game/assets/effect-icons/`**; (b) fog reveal is an INSTANT visibility toggle, not a tween fade
  (deterministic + headless-testable; load-bearing behavior met); (c) one `as unknown as {setVisible}`
  Phaser-typing cast (trivial). Verify+review GO for Phase 4.
- 2026-06-14 — **Phase 4 complete.** Fog Beach Party world data; 720 pass / 0 fail, golden 9/9,
  registry now 5 worlds. Files: `fog-beach-party/{cards.json,theme.ts,meta.ts,index.ts}` (new),
  `registry.ts` (+FOG bundle), `assetBindings.ts` (reality/overlay/cardfront/10 insets/music),
  `fogBeachParty.test.ts` (new Gate-4 shape tests). `startLight: 4` → opens at Light 3. Roster:
  kit = Flashlight(GainLight 2)/Flare Gun(GainLight 6, exhaust)/Bonfire(GainLight 4)/Searchlight
  (DealProgressAll+Hidden bonus, exhaust); hazards Rolling Fog(C:1), Abandoned Cooler(C:1 harmless),
  Something in the Mist(C:3), The Tide Coming In(C:3), Whiteout(C:5, DamageScaled per KeywordInHand
  Concealed), The Bonfire capstone(no Concealed, onCleared grants 4-card kit, 3 act-1 copies, HP 8),
  Walker (1 act-3 copy from starter). **Discardability safety rule (REQ-FOG-20) fully met** — every
  concealed damaging-onEndOfTurn hazard is discardable (line-by-line review confirmed, zero soft-locks).
  Decisions: Cooler set to Concealed:1 to share depth with Rolling Fog (spec table had no collision at
  its listed depth; depths are soft). **⚠️ Music placeholder: `fogBeachPartyMusicUrl` imports the mall
  mp3** — needs a real fog track later (surfaced to user). Gate-verify PASS + cards.json line-by-line
  review GO for Phase 5.
- 2026-06-14 — **Phase 5 complete (AI scope).** 5.1 amended `theme-authoring.html` surgically
  (C1 += GainLight exclusive, C2 += Concealed + new C2a `"Name:N"` numeric-keyword convention, SV1
  signature table += fog row; removed a now-contradictory "only four keywords" sentence). 5.2
  holistic spec validation: **23/23 AI-verifiable rows MET, zero NOT-MET/PARTIAL**, suite 720 pass /
  0 fail, lint/build/typecheck green, golden byte-identical. REQ-FOG-31 fog-back is procedural (panel
  + chip), not a texture asset — intended. **Still pending (handed to user):** browser runtime smoke;
  human-only playtest items REQ-FOG-15 (strategic-triangle viability) and spec Q2 (act-1 survivability
  feel, ship-and-watch with startLight 4 and no leg-up).

## Final summary

Built across 5 phases, each gated with independent test-verify + fresh-context review. Net result:
720 tests pass / 0 fail (up from 663 at start), lint + typecheck + build green, golden tests
byte-identical (existing worlds untouched). Slice 1 (numeric-keyword engine) generalized keywords to
structured `{name, value?}` world-agnostically; slice 2 added Light economy + concealment to core,
a HUD readout + procedural fog-back to the renderer, and the Fog Beach Party world data.

**Two placeholders for the user to replace later:** (1) `effect-icon-light.png` (generated 128×128
placeholder — the "assets already there" note did not include this shared HUD glyph); (2) fog world
**music** (`fogBeachPartyMusicUrl` currently imports the mall mp3 — no fog track on disk).

**Remaining gate:** browser runtime smoke (select Fog, play a run; watch fog-backs show depth only,
Flare/Flashlight raise Light + HUD/shapes update, decay re-hides the deep end, blind-discard works,
Bonfire clear grants the kit, Searchlight hits concealed). Plus the two human-only playtest items.

Suggested next: `/simplify` on the changed files for clarity; then a runtime smoke before merge.