---
title: "Implementation plan: Fog Beach Party world (conceal) + numeric-keyword engine"
date: 2026-06-13
status: draft
tags: [plan, fog-beach-party, conceal, numeric-keywords, light, core-effect, world-data]
modules: [core-engine, world-data, game-view, themes]
related: [.lore/work/specs/fog-beach-party.html, .lore/work/brainstorm/fog-beach-party-world.md, .lore/work/specs/overgrown-mall.html]
---

# Implementation plan: Fog Beach Party world (conceal) + numeric-keyword engine

Builds [`.lore/work/specs/fog-beach-party.html`](../specs/fog-beach-party.html) (REQ-FOG-1…38). The spec ships two slices as one identity: a world-agnostic **numeric-keyword engine generalization** (slice 1), then the **Fog world** on top (slice 2). This plan sequences them into five phases, each with a validation gate. The phase boundary between slice 1 and the rest is the clean cut the spec promised — phase 1 must leave every existing world byte-identical before any Fog concept exists.

Tuning numbers (Conceal depths, HP, starting Light, decay, kit amounts) are **soft** per the spec — author plausible initial values in JSON; do not treat them as plan requirements.

## Decisions taken in this plan (review these first)

The spec delegated four choices to the plan. Each is baked in below with rationale; flag in review if any is wrong.

1. **`CardTemplate.keywords` becomes `readonly string[]` (authoring form), parsed to structured `Keyword` at `mintCard`** (REQ-FOG-2). `mintCard` is the single choke point where templates become cards (`cards.ts:56`), and JSON already arrives untyped through the `as unknown as RawCardSource` cast (`overgrown-mall/index.ts:9`), so parsing there fights nothing. Alternative (parse in `assembleCatalog`) is viable but spreads the concern; rejected.

2. **Single-target progress goes *unplayable* when every world card in hand is concealed**, not merely "no legal targets" (extends REQ-FOG-12). Offering Explore as playable with zero legal targets is a dead-end click. So `HazardTargetingHandler.isPlayable` also requires at least one *unconcealed* world card, mirroring the `legalTargets` filter. This touches shared code (`DealProgress`/`DealProgressScaled`) but is a no-op outside Fog (nothing is concealed when `concealOf` is 0). **If you'd rather keep it playable-but-untargetable, say so** — it's the one feel decision here.

3. **The HUD "world uses light" signal is an explicit `usesLight` flag on `WorldDataBundle`, surfaced as a derived `Record<worldId, boolean>` manifest** (REQ-FOG-29). The HUD has `GameState` (hence `worldId`) but no world metadata; the `derive()` manifest pattern (`worlds/types.ts:101`) is exactly how display/help reach the HUD today. Heuristics ("any Concealed card in play") were rejected — they flicker the indicator off when the hand happens to hold no fog. `usesLight: true` only on Fog.

4. **The concealed-card "lost in the fog" text is assembled in the card-text/presentation layer, not `describeEffect`** (refines REQ-FOG-14). `describeEffect` is effect-level and stateless; concealment is card-level and light-dependent. The card-face/preview assembly path (where name + cost + compiled effect lines come together, `effectLineView`/`CardView` + the core describe entry) is where identity gets suppressed in favor of the fog string. `describeEffect` itself only gains the `GainLight` line (via the handler).

## Open risk carried from the spec (not resolved here)

- **Act-1 survivability before a Bonfire clears** (spec Q2, ship-and-watch). The plan ships no leg-up; the fallback (start Light 4 / Flashlight-on-discard) is a JSON tweak if playtest demands it. First thing to watch in the runtime smoke.
- **Strategic-triangle viability** (REQ-FOG-15) is playtest territory, not gate-able here.

---

## Phase 1 — Numeric-keyword engine (slice 1, world-agnostic)

REQ-FOG-1…6. No new effect, no game state, no Fog concept. The type change in step 1.1 will light up compile errors at every consumer — that error list *is* the worklist for steps 1.3–1.5.

**Step 1.1 — Split the keyword type.** `src/core/model/types.ts`: introduce `KeywordName = "Hidden" | "Creature" | "Slow" | "Spore" | "Concealed"` and `Keyword = { name: KeywordName; value?: number }`. Retarget the by-name references to `KeywordName`: `CounterSpec.keyword` (`:13`), `DealProgress.bonus.tag` (`:19`), `DealProgressAll.bonus.tag` (`:59`), `TargetSpec.hazard.tag` (`:147`). (`DealProgressScaled.per` and `DamageScaled.per` already reference `CounterSpec`, so they follow for free.) `PlayerCard.keywords` / `WorldCard.keywords` (`:79`, `:88`) stay `readonly Keyword[]` but `Keyword` is now structured.

**Step 1.2 — Core keyword helpers.** New file `src/core/model/keywords.ts`: `parseKeyword(s: string): Keyword` (`"Concealed:3"` → `{name:"Concealed",value:3}`; `"Spore"` → `{name:"Spore"}`; throws on non-numeric `N` or unknown name), `keywordNames(card): KeywordName[]`, `hasKeyword(card, name): boolean`. (`concealOf`/`isConcealed` are added here in phase 2 — same module.) Re-export the public ones from `src/core/index.ts`.

**Step 1.3 — Author-as-string + parse at mint.** `src/core/model/cards.ts`: change `PlayerCardTemplate.keywords?` and `WorldCardTemplate.keywords` to `readonly string[]` (authoring `"Name"`/`"Name:N"`); in `mintCard` (`:77`, `:88`) map through `parseKeyword`. Adjust `RawCardSource` in `catalog.ts` if it restates the keyword type. Existing JSON (`"Spore"`, `"Hidden"`) parses unchanged.

**Step 1.4 — Route every consumer through the helper.** Replace each `keywords.includes(...)` with `hasKeyword(...)` / a `keywordNames` match: `effects/dealProgress.ts:72` (bonus match against `hazard.keywords`), `:112` (`KeywordInHand` counter — match by name), `:168` (`base===0` keyword filter); `core/view/describe.ts:52` (`previewPlay` reconstructs the bonus: `target.keywords.includes(deal.bonus.tag)` → `hasKeyword(target, deal.bonus.tag)`, distinct from the handler sites). After this, no `.includes` on a keyword array survives in `src/core`. **Not `.includes` sites but type-coupled** (fix in the same pass): `effects/tokens.ts:28` `bonusRider(bonus: { tag: Keyword; ... })` → `tag: KeywordName` (it does `text(bonus.tag)`, no `.includes`); `perRider`/`damage.ts:49` read `CounterSpec.keyword`/`per.keyword`, which become `KeywordName` for free — verify they compile, no logic change.

**Step 1.5 — Display name + value.** `src/game/view/CardView.ts:201-203,244,273-276`: replace `keywords.join(" · ")` with a formatter that renders `{name, value}` (e.g. "Concealed 3"). Mirror in `HelpOverlayView.ts`. No bare `.join` over structured keywords remains in `src/game`.

<strong>Gate 1.</strong> `bun run test` + `bun run lint` + `bun run build` green. New unit tests (`cards.test.ts`, `effects.test.ts`): `parseKeyword` (valid/no-value/throws), `hasKeyword` ignores value, `KeywordInHand` counts by name across player+world carriers. **Golden tests byte-identical** for zombie/bird/volcano/mall (REQ-FOG-6/38) — if a shared path shifted ordering, regenerate deliberately and explain. Grep: no surviving `.includes`/`.join` on keyword arrays (REQ-FOG-3/5). **Reviewer: fresh-context review of the type-split blast radius before proceeding** — slice 1 is the highest-leverage change.

## Phase 2 — Light & concealment core (slice 2 core)

REQ-FOG-7…14. On top of phase 1.

**Step 2.1 — `light` state (per-world start, default 0).** `types.ts`: `light: number` on `GameState` (`:122`). Starting Light is **per-world, not a global `WORLD_CONSTS` const** (that would start every world lit): add an optional `startLight` to the world data source (`RawCardSource`/deck composition that `createWorld` already reads, default 0); `createWorld` (`:69`) initializes `light` from it. **Load-bearing invariant: non-Fog worlds always run with `light === 0`** — only Fog sets `startLight > 0`. This is what makes the decay emit-on-change (step 2.6) and the Decision 2 `isPlayable` change (step 2.7) no-ops everywhere but Fog; assert it in a test.

**Step 2.2 — `GainLight` effect + handler.** `types.ts`: add `{ kind: "GainLight"; amount: number }` to `CardEffect`. New `GainLightHandler` in `effects/resources.ts` (beside Brace/GainEnergy/Heal): `apply` does `light += amount` and emits `LightChanged`; `describe` → e.g. "gain 2 Light"; `compile` emits the `light` icon line (step 2.4). No-target, so it inherits the base `structuralSpec`/`isPlayable` (assert this in tests — the `available.ts` defaults silently mask a missing case, REQ-MALL-5). Register in `effects/registry.ts` `EFFECTS` (compile-enforced).

**Step 2.3 — `LightChanged` event.** `types.ts`: add `{ type: "LightChanged"; light: number }` to `GameEvent` (mirror `EnergyChanged` `:177`). Handle in `runtime/runStats.ts` `event.type` switch (~`:382`): a case or an explicit safe ignore (no default there).

**Step 2.4 — `light` IconId.** `src/core/view/effectGlyphs.ts`: add `"light"` to `IconId`. The compiler then forces an entry in `EFFECT_ICON_TEXTURES` (`effectLineLayout.ts:29`) → `"effect-icon-light"` and in `EFFECT_ICON_PLACEHOLDERS` (`:64`). `GainLightHandler.compile` emits an EffectLine using the `light` IconId.

**Step 2.5 — Concealment helpers.** Add to `core/model/keywords.ts`: `concealOf(card): number` (value of the `Concealed` keyword, 0 if absent) and `isConcealed(card, light): boolean` = `concealOf(card) > light`. **Export both from `core/index.ts`** so the renderer calls them across the boundary (Decision 4 / REQ-FOG-8).

**Step 2.6 — Decay clock (emit only on change).** `engine/energy.ts` `startTurn` (`:73`): apply decay **first, before `gainEnergy`/`refillHand`/`resolveForceDestroy`** (REQ-FOG-11). **Critical for the golden gate: only decrement and emit `LightChanged` when `light > 0`.** If decay always emitted, every existing world (light always 0) would gain a `LightChanged` event each turn and all golden runs would change. Emit-on-change keeps non-Fog runs byte-identical (Gate 1/REQ-FOG-38). Update the existing `startTurn` JSDoc (`:63-72`, currently "EnergyChanged first") to document that, in light-worlds, `LightChanged` precedes `EnergyChanged`, and that the ordering is fixed for determinism.

**Step 2.7 — Targeting filter.** `effects/EffectHandler.ts` `HazardTargetingHandler.legalTargets` (`:79`): filter out `isConcealed(card, state.light)`. Per Decision 2, also gate `isPlayable` (`:75`) on at least one unconcealed world card. `DealProgressAll` is **not** a `HazardTargetingHandler` (no change — it resolves on true data, REQ-FOG-12).

**Step 2.8 — Concealed describe (concrete locations).** Per Decision 4, suppress identity for a concealed card ("lost in the fog (needs Light N)", `Concealed:N` shown, name/cost/effect/other keywords/inset withheld) in two named places: **(a) hover/preview** — `core/view/describe.ts` `previewPlay` returns the fog string (or null) when `isConcealed(target, state.light)`; **(b) the card face** — the world-card branch of `CardView.ts` (~`:251`) renders the fog-back (this overlaps step 3.4, do them together). `describeEffect` itself only gains the `GainLight` line via `GainLightHandler.describe` (step 2.2) — no concealment logic in the effect-level describe.

<strong>Gate 2.</strong> Core tests (`effects.test.ts`, `available.test.ts`, `world.test.ts`): `GainLight` resolution + `LightChanged` + asserted no-target playability; `isConcealed`/`concealOf` (incl. 0-for-absent); single-target `legalTargets` exclude concealed while `DealProgressAll` hits them; `isPlayable` false when all world cards concealed; raising light restores targetability and keeps `Hidden` (Explore bonus still applies); turn-start decay floors at 0 and emits, fires before energy/refill; determinism with light/conceal plays. `bun run lint` (core purity) + `build` green.

## Phase 3 — Renderer: HUD readout + fog-back

REQ-FOG-28, 29. The cosmetic layer; reads `light` + `Concealed:N`, never feeds back into state.

**Step 3.1 — `usesLight` flag + manifest (must precede the HUD step).** `src/data/worlds/types.ts`: add `readonly usesLight?: boolean` to `WorldDataBundle` (`:48`), default-absent = false; **every existing bundle is unaffected** (omits it). Add a `worldUsesLight` derived manifest via `derive(registry, b => b.usesLight === true)` (`:101` pattern). This is the field step 3.3 reads; it lands here, not in phase 4, so phase 3 compiles on its own. (Phase 4's Fog bundle sets `usesLight: true`.)

**Step 3.2 — `effect-icon-light` asset.** Mirror the mall precedent: import the icon in `src/game/worlds/assetBindings.ts` (the real per-world/icon import + key-binding file; `assetManifest.ts` spreads it) **and** register `"effect-icon-light"` in `src/game/data/assetManifest.ts` (placeholder art until the theme pass). Satisfies both the IconId texture map (step 2.4) and the HUD indicator (step 3.3).

**Step 3.3 — HUD Light readout.** `src/game/view/HUDView.ts`: add a Light indicator via the existing `addPowerUp("effect-icon-light")` path (the brace precedent, `:121`), value from `state.light`, refreshed in `update(state)` and on `LightChanged`. Visibility per Decision 3: a `worldUsesLight[state.worldId]` lookup (step 3.1) — **visible at Light 0, absent in non-light worlds**, never `light > 0`.

**Step 3.4 — Fog-back CardView.** `src/game/view/CardView.ts` (world-card branch ~`:251`, with step 2.8b): a card with `isConcealed(card, state.light)` renders as a fog-back showing **only its `Concealed:N` chip**, identity hidden. A `LightChanged` event re-evaluates the hand and animates shapes fading in/out (cosmetic; deterministic core untouched).

<strong>Gate 3.</strong> Renderer tests — `hud.test.ts` (HUD Light indicator: visible at Light 0 in a light-world, absent in a non-light world, value tracks `state.light`), `cardObjects.test.ts`/`presentation.test.ts` (structured-keyword chip; concealed card shows depth, hides identity), `describe.test.ts` ("lost in the fog (needs Light N)"). `build` green.

## Phase 4 — Fog world data

REQ-FOG-17…27, 29 (the `usesLight` flag), 32, 33. One folder, mirroring `overgrown-mall/`.

**Step 4.1 — World folder + registration.** `src/data/worlds/fog-beach-party/`: `cards.json` (with `startLight > 0` in its deck/source config per step 2.1), `theme.ts`, `meta.ts`, `index.ts` (export `FOG_BEACH_PARTY_BUNDLE` with `usesLight: true` — the field already exists from step 3.1). Append the bundle to `worlds/registry.ts`.

**Step 4.2 — `cards.json`.** 3 acts. Hazards carry `"Concealed:N"` + `"Hidden"` (REQ-FOG-19); **every concealed hazard with a damaging `onEndOfTurn` is `discardable: true`** (REQ-FOG-20). The Bonfire capstone: no `Concealed`, `onCleared` = `Sequence` of `GainCard` per kit card (Flashlight/Flare Gun/Bonfire card/Searchlight), ~3 act-1 copies, HP high enough to take several turns (Decision/REQ-FOG-21). Whiteout: `DamageScaled { base:0, per:{kind:"KeywordInHand",keyword:"Concealed"}, amount:1 }` (REQ-FOG-23). Abandoned Cooler: harmless concealed at a depth shared with a dangerous card (REQ-FOG-22). The Walker referenced from shared starter, one act-3 copy (REQ-FOG-25). Kit cards per REQ-FOG-16 (`GainLight` magnitudes + Searchlight = `DealProgressAll` + Hidden bonus). No junk-injection template (REQ-FOG-24).

**Step 4.3 — `theme.ts` + assets.** `VisualTheme` (golden-hour-vs-cold-fog hues, backdrop/intrusion/cardfront keys, fog-back texture key) per REQ-FOG-30/31; assets under `src/game/assets/themes/fog-beach-party/` (insets may be placeholders). Register exactly as the mall did: import the image URLs and bind the string keys in `src/game/worlds/assetBindings.ts` (backdrop/overlay/cardfront/fog-back/insets/music), which `assetManifest.ts` spreads; plus `worldManifest.ts` (`makeWorldBuilder` pattern) and `themeManifest.ts` (REQ-FOG-30).

**Step 4.4 — `meta.ts`.** `WorldDisplayData` (name + golden-hour-then-fog blurb) and `WorldHelpData` (≤6 notes incl. a Light note, a concealment note, a blind-discard note) — REQ-FOG-33/34.

<strong>Gate 4.</strong> `worldManifest.test.ts` catalog-build resolves every Fog template; display/help manifest completeness covers the new entries (REQ-FOG-37). World-JSON-shape checks (3 acts, one Walker, Bonfire visible + kit grant, discardability rule, Cooler depth-collision, no junk template). Signature claim: grep `GainLight` → only Fog (REQ-FOG-17). Distinct rewards vs other worlds (REQ-FOG-26). Full `bun run test` green.

## Phase 5 — Docs + final validation

REQ-FOG-35, plus the spec's whole AI Validation table.

**Step 5.1 — Amend theme-authoring.** `.lore/reference/theme-authoring.html`: C1 effect vocabulary += `GainLight`; C2 keyword list += `Concealed` and the `"Name:N"` numeric-keyword authoring convention; SV1 table gains the Fog row (*fog-beach-party · reveal & endure · light economy (`GainLight` kit) exclusive*).

**Step 5.2 — Final validation pass.** Walk the spec's AI Validation table end to end: suite/lint/build, keyword type split, parse correctness, no-surviving-`.includes`, GainLight semantics, visibility & targeting, decay (core + renderer), kit card shapes, Whiteout math, describe coverage, Light HUD readout, world JSON shape, distinct rewards, signature claim, registrations (incl. `effect-icon-light` + fog-back), help budget, docs amended. Then **runtime smoke** (browser-driven, the `verify`/`run` skill): select Fog, play a run — concealed fog-backs show depth only; Flare/Flashlight raises Light and the HUD readout + shapes update; decay re-hides the deep end; blind-discard works; clearing a Bonfire grants the kit; Searchlight hits concealed cards. **Watch act-1 survivability** (carried risk).

<strong>Gate 5 (final).</strong> Every AI-verifiable row in the spec table passes; the two human-only items (strategic-triangle viability, act-1 feel) are explicitly handed to playtest, not silently skipped.

---

## Review strategy (delegation guide)

- **After Gate 1**: fresh-context review of the type-split diff (highest blast radius; a missed `.includes` is a silent name/value bug). Use a sub-agent with no phase-1 context.
- **After Gate 2**: review the targeting filter and decay ordering specifically — these are the determinism-sensitive seams.
- **After Gate 4**: review `cards.json` against REQ-FOG-19/20 line by line (the discardability safety rule is data-only and easy to violate).
- **Before merge**: full diff review against the spec, per CLAUDE.md (portfolio game — typed, tested, *and* fun; both gates or it doesn't merge).

## Out of scope (from the spec)

World 6 / `Frozen:N`; Bonfire second-state mechanic; mandated act-1 leg-up; world-select carousel; counter-spec members beyond `KeywordInHand`; final inset art (placeholders ship).
