# Fog Beach Party world: conceal / reveal & endure

- **Date:** 2026-06-13
- **Status:** draft
- **Tags:** world-design, fog-beach-party, conceal, reveal, light, numeric-keywords, core-effect
- **Modules:** core-engine, world-data, game-view, themes
- **Related:** [fog-beach-party-world.md](../brainstorm/fog-beach-party-world.md), [overgrown-mall.html](overgrown-mall.html), [shard-response-archetypes.html](../brainstorm/shard-response-archetypes.html), [new-world-concepts.md](../brainstorm/new-world-concepts.md), [theme-authoring.md](../../reference/theme-authoring.md), [visual-direction.html](../../reference/visual-direction.html)
- **Req prefix:** FOG

> Fog Beach Party · fifth world · one combined spec: numeric-keyword engine slice + the conceal world

"You can't aim at what you can't see, and it hurts you anyway." The fifth world. Threat-verb **conceal**: hazards arrive face-down, carrying a `Concealed:N` depth; the player holds one global `Light` level that decays each turn, and a card is visible *iff* `Light ≥ its Concealed:N`. Response archetype **reveal/endure** (light is the weapon; the clock is your own decision quality). This spec ships two slices as one identity: a world-agnostic **numeric-keyword engine generalization** (sequenced first, justified by Fog's `Concealed` and world 6's future `Frozen`), then the Fog world on top. Design settled in the [brainstorm](../brainstorm/fog-beach-party-world.md); the four-number tuning surface is deliberately soft (JSON-adjustable, playtest-owned) per the Mall precedent.

> Like the Mall spec, **card costs, counts, act distribution, Conceal depths, starting Light, decay rate, and kit light-restore amounts are initial tuning values** — freely adjustable in data without spec revision. Structure, hooks, and the visibility rule are requirements; the numbers are not. Three open brainstorm questions were resolved into this spec: one combined spec (Q6), ship-and-watch act-1 survivability with no mandated leg-up (Q2), and a flat-refuel Bonfire with no extra state (Q3).

## 1 · Core engine — numeric keywords (REQ-FOG-1 … 6)

A world-agnostic generalization of the keyword system so a keyword can carry an optional numeric value (`Concealed:N` now, `Frozen:N` in world 6). This mirrors the Mall rule (REQ-MALL-3): **extend the vocabulary before any consumer depends on it.** Today `Keyword` is a flat string union (`src/core/model/types.ts:9`: `"Hidden" | "Creature" | "Slow" | "Spore"`).

#### REQ-FOG-1 — Split `KeywordName` from runtime `Keyword` *(core)*

Introduce `KeywordName` (the string union, now including `"Concealed"`) and a runtime `Keyword = { name: KeywordName; value?: number }`. The references that match a keyword *by name, value ignored* become `KeywordName`: `CounterSpec.keyword` (`types.ts:13`), `DealProgress.bonus.tag` (`types.ts:19`), `DealProgressAll.bonus.tag` (`types.ts:59`), and `TargetSpec.hazard.tag` (`types.ts:147`). The carriers `PlayerCard.keywords` / `WorldCard.keywords` (`types.ts:79, 88`) become `readonly Keyword[]`.

#### REQ-FOG-2 — JSON keyword strings parse at mint *(core)*

Authoring stays string-based with a `"Name"` / `"Name:N"` convention (`keywords: ["Hidden", "Concealed:3"]`). The structured parse (`"Concealed:3"` → `{ name: "Concealed", value: 3 }`; `"Spore"` → `{ name: "Spore" }`) lands at card mint (`src/core/model/cards.ts`, `mintCard`) or in `assembleCatalog` (`src/core/model/catalog.ts`) — at or after the existing `cardsJson as unknown as RawCardSource` loader boundary, so the raw strings never have to satisfy the structured type at load. Existing flag keywords parse unchanged (no `value`). Invalid forms (non-numeric `N`, unknown name) fail loudly at parse, not silently.

#### REQ-FOG-3 — Name-match helper replaces every `.includes` *(core)*

A single seam — e.g. `hasKeyword(card, name)` / `keywordNames(card)` — routes all keyword matching. Every current consumer switches to it: `dealProgress.ts:72` (bonus match), `dealProgress.ts:112` (`KeywordInHand` counter), `dealProgress.ts:168` (`base===0` keyword-filtered `legalTargets`), `describe.ts:52` (preview math), `tokens.ts:31,35` (bonus/per rider text), `damage.ts:49` (`DamageScaled` describe). `KeywordInHand` counts every hand card (player or world) whose keyword *name* matches, value irrelevant. No `.includes` on a structured-keyword array survives.

#### REQ-FOG-4 — `Concealed` joins the keyword vocabulary *(core)*

`KeywordName` gains `"Concealed"`; any validation/enumeration of keywords handles it; theme-authoring C2 is amended (REQ-FOG-35). `Concealed:N` is a *permanent* keyword (the card is always that deep in potential fog) — see REQ-FOG-13 for why this is orthogonal to the transient concealed *condition*.

#### REQ-FOG-5 — Keyword display renders name + value *(core)*

Wherever keywords render as text, structured values surface. The renderer chip path (`src/game/view/CardView.ts:201-203, 244, 273-276`, currently `card.keywords.join(" · ")`) and the core riders (`tokens.ts`) format `{ name: "Concealed", value: 3 }` as a readable chip (e.g. "Concealed 3"). Help-screen keyword vocabulary (`HelpOverlayView.ts`) renders the same way. A bare `.join` over structured keywords is a spec failure.

#### REQ-FOG-6 — The generalization is value-add-only and world-agnostic *(core)*

Slice 1 changes types and matching plumbing only — it introduces no new effect, no new game state, and no Fog-specific concept. Existing worlds (zombie, bird, volcano, mall) build, play, and replay byte-identically after it (golden tests unaffected, or knowingly regenerated per REQ-FOG-38). The slice is independently coherent: if Fog were cut, this section would still stand.

## 2 · Core engine — Light & concealment (REQ-FOG-7 … 14)

The Fog mechanic, on top of slice 1. The model is a **decaying threshold, not a pool**: seeing is free and global; light is spent only by time.

#### REQ-FOG-7 — `light` on `GameState` *(core)*

`GameState` (`types.ts:122-143`) gains `light: number`, initialized in `createWorld` (`src/core/engine/world.ts:69-86`) from a `startLight` const in `WORLD_CONSTS` (`world.ts:7-14`). It behaves as a *level*: never consumed by seeing, only decremented by decay and increased by `GainLight`. Starting value is soft tuning (brainstorm leans a starting value that decays, refueled by cards; ship-and-watch, no mandated act-1 leg-up — Q2 resolved).

#### REQ-FOG-8 — Visibility is a derived comparison, nothing stored *(core)*

A helper `isConcealed(card, light)` = `concealOf(card) > light`, where `concealOf(card)` is the value of the card's `Concealed` keyword (**0 if absent**, so non-fog cards are never concealed). No `concealed` flag, no stored "revealed" set — visibility is recomputed live from `light` and the keyword. Used by targeting, describe, and the renderer; **exported from the core public surface** so the renderer calls it rather than reimplementing the comparison (the core/game boundary forbids the renderer reaching into core internals).

#### REQ-FOG-9 — `GainLight` effect *(core)*

New `CardEffect` kind `{ kind: "GainLight", amount: number }` in the union (`types.ts:15-64`), with a `GainLightHandler` (`light += amount`) registered in `src/core/effects/registry.ts` (the exhaustive `EFFECTS` map — a missing registration is a compile error). Because the post-#58 effect surface routes `apply` / `describe` / playability through the handler, the handler must implement all three; a handler that compiles but returns `[]` from `describe` or no-ops `apply` is a silent failure caught only by tests, not the compiler. It is a no-target effect: `structuralSpec` → `{ kind: 'none' }`, `isPlayable` → energy-permitting. The base defaults happen to be correct, but per the Mall gotcha (REQ-MALL-5) `available.ts` has *silent* default fallbacks, so the no-target decision is asserted by an explicit test (REQ-FOG-36), not assumed.

#### REQ-FOG-10 — `LightChanged` event *(core)*

The `GameEvent` union (`types.ts:161-187`) gains `LightChanged` (mirroring `EnergyChanged` / `BraceChanged`), emitted by both `GainLight` resolution and the decay step. Event consumers are handled, not crashed: `runStats.ts` (the `event.type` switch ~line 382, which has no default) gets a case or a safe ignore. The renderer reads `LightChanged` as its cue to re-evaluate the hand and fade fog-shapes in/out.

#### REQ-FOG-11 — Decay at turn start *(core)*

`startTurn` (`src/core/engine/energy.ts:73-94`) applies `light = max(0, light − 1)` and emits `LightChanged` as part of its ordered event list. This is the clock: untended, light dims one step a turn and the deepest fog winks back out on its own (re-concealment for free, no bespoke mechanic). **Decay fires first in `startTurn`, before `gainEnergy` / `refillHand` / `resolveForceDestroy`**, so the turn opens with the fog already crept in over the cards the player kept, and only then are new cards drawn into the dimmer light. The ordering is fixed (it determines event sequence, hence determinism) and carries a code comment stating the rationale. `onEndOfTurn` for in-hand world cards already fires (the threat ticks whether seen or not) and needs no new plumbing.

#### REQ-FOG-12 — Concealment is exactly two things; everything else resolves on true data *(core)*

A concealed card (`isConcealed` true) is subject to **(1) no target** and **(2) no visible details**, nothing more. (1): single-target progress excludes concealed cards from its legal targets. In the current architecture `computeLegalTargets` in `available.ts` delegates to the handler, so the filter lands where the handler computes hazard targets (`HazardTargetingHandler.legalTargets`), not in a switch in `available.ts` — you cannot snipe unlit fog. (2) is renderer + describe only (REQ-FOG-14, 28). Everything else resolves on the card's *true* data with no core masking: `DealProgressAll` (a `{kind:'none'}` spec) does **not** skip concealed cards — it chews them, keyword bonuses and all; `onEndOfTurn` ticks; keyword bonuses apply. The rule in one line: *all effects still happen, you just don't know why.*

#### REQ-FOG-13 — `Hidden` keyword stays orthogonal to the concealed condition *(core)*

`Hidden` is a permanent, value-less tag ("this lurks", player cards bonus against it). The *concealed condition* is transient (`Light < Concealed:N`). They are independent: a card can be `Hidden` without any `Concealed:N` (`Door`), and concealed without being `Hidden`. Light changes visibility and **never touches keywords**. The payoff this protects: revealing a hazard leaves its `Hidden` keyword intact, so starter `Explore`'s `+1 vs Hidden` still lands the instant it becomes targetable — reveal-then-Explore is the snipe line.

#### REQ-FOG-14 — Describe text for concealment and `GainLight` *(core)*

`describeEffect` (`src/core/view/describe.ts`) now delegates to the per-handler `describe` (post-#58 registry), so the `GainLight` describe text (e.g. "gain 2 Light") lives on `GainLightHandler.describe`; there is no central switch and therefore no compile trip-wire for it — the REQ-FOG-36 test is the safety net (REQ-FOG-9). A concealed card describes as **"lost in the fog (needs Light N)"** — its real name/cost/effect/keywords are withheld, but its required Light (its `Concealed:N`) is shown, because light management needs that number (Q4 resolved: depth always shown).

## 3 · The light kit cards (REQ-FOG-15 … 17)

All "reveal" is just adding Light, so the kit is `GainLight` cards differentiated by magnitude/cost/persistence, plus the one sweep card. The single-target heavy hitter is starter `Explore` (`+1 vs Hidden`) — no Machete-equivalent needed. The kit is **unlocked, not starter** (granted by the Bonfire capstone), so it does not leak into other worlds — same containment as the Mall kit.

#### REQ-FOG-15 — The strategic triangle is live: snipe / sweep / see

The shipped composition must make all three answers to fog playable, each with its true cost: **Snipe** (single-target `Explore`, blocked until the target is lit), **Sweep** (area `DealProgressAll`, ignores light, fires blind and spread thin), **See** (raise `Light`, unlock the snipe and the information). Light is never strictly mandatory (sweep + blind-discard prevent soft-lock) but is almost always better — that is what makes the world about light. Viability is playtest-verified, tuned in data.

#### REQ-FOG-16 — Player light kit (initial tuning)

| Card | Effect (initial) | Role |
|---|---|---|
| Flashlight | `energyCost 1, GainLight 2`, repeatable (no exhaust) | Maintenance top-up; keep shallow fog lit turn to turn. |
| Flare Gun | `energyCost 1, exhaust, GainLight 6` | One-shot flood; "show me everything now", then the decay bleeds it away. |
| Bonfire (card) | `energyCost 2, GainLight 4`, repeatable (no exhaust) | Sustained centerpiece. **Flat refuel, no extra state** (Q3 resolved); distinctiveness is the higher cost and its repeatability vs Flare's exhausting one-shot, not new mechanics. |
| Searchlight | `energyCost 2, exhaust, DealProgressAll base 1, bonus { tag: "Hidden", amount: 1 }` | The sweep: hits every world card in hand including concealed ones, extra vs `Hidden` (which the fog all is). Passes straight through concealment. |

#### REQ-FOG-17 — Signature verb claim

Fog's exclusive signature is the `GainLight` light-economy kit. No other world's data may use `GainLight` until a future proposal claims it (mirrors REQ-MALL-16 / theme-authoring SV1). `DealProgressAll` and `Hidden` are shared verbs and remain reusable; only `GainLight` is claimed here.

## 4 · World data — the party turned mean (REQ-FOG-18 … 27)

#### REQ-FOG-18 — World identity

`worldId: "fog-beach-party"`, one folder under `src/data/worlds/fog-beach-party/` following the consolidated per-world pattern (`index.ts` + `meta.ts` + `theme.ts` + `cards.json`, as in `overgrown-mall/`), registered in `src/data/worlds/registry.ts`. Three acts via `deckComposition.acts`. The same kebab-case id is the join key everywhere (theme-authoring RULE 0).

#### REQ-FOG-19 — Threat roster (initial tuning)

Every hazard except the always-visible Bonfire and Walker carries a `Concealed:N` depth (the harmless Cooler included — that is the point of it) and the `Hidden` tag by convention, so the once-lit `Explore` / `Searchlight` payoffs apply. HP and depths are soft.

| Hazard | Act | Concealed:N | onEndOfTurn | Discardable / onDiscarded | Role |
|---|---|---|---|---|---|
| Rolling Fog | 1 | 1 | `Damage 1` | yes / `None` | Cheap creep; almost always visible. Teaches the loop. |
| Abandoned Cooler | 1 | 2 | `None` | yes / `None` | The false alarm — harmless, but identical to a depth-2 monster. Makes spending light a gamble. |
| The Bonfire (capstone) | 1–3 | none (visible) | `None` | yes / `None` | High cost, never concealed (it is light), ~3 copies in act 1. `onCleared` grants the light kit. Benign, just hard to clear; walk away and forfeit the kit. |
| Something in the Mist | 2 | 3 | `Damage 2` | yes / `Damage 2` | `Creature` + `Hidden`. Mauls blind and lunges if you flee. The high-stakes light target. |
| The Tide Coming In | 2–3 | 3 | `Damage 2` | yes / `Damage 2` | Mid-game squeeze; mean, so discardable. |
| Whiteout | 3 | 5 | `DamageScaled base 0, per { KeywordInHand: "Concealed" }, amount 1` | yes / `Damage 2` | The mechanic's capstone — deepest fog; 1 damage per `Concealed`-tagged card in hand (itself included). Only a flare-level burst sees it coming. |
| The Walker | 3 | none | `None` | (existing) | Shared run-capstone, one copy in act 3. |

#### REQ-FOG-20 — The discardability safety rule

**Every punishing, high-tick concealed hazard must be `discardable: true`**, so a reveal-starved player always has the blind-discard valve (flee the shape, gamble on its `onDiscarded`). Only gentle, low-tick concealed clutter may be non-discardable. This is the structural guarantee against soft-lock, alongside starter `Panic`/`Barricade` (return-to-deck, which re-conceals on redraw). No concealed hazard with a damaging `onEndOfTurn` ships non-discardable.

#### REQ-FOG-21 — The Bonfire dodges the chicken-and-egg

The capstone "The Bonfire" is the one hazard that is **not concealed** (a literal light source — of course it is visible). It is a high-cost, visible hazard with an `onCleared` grant of the REQ-FOG-16 light kit — a `Sequence` of `GainCard` effects, one per kit card (Flashlight, Flare Gun, Bonfire card, Searchlight), following the Garden Center precedent. ~3 copies in act 1 (like the Garden Center). Because it is visible, no reveal is needed to clear it, so there is no deadlock (need-reveal-to-get-reveal). Its HP is the one number with a structural floor, not pure tuning: it must be high enough to take several turns, or the kit arrives before the fog has taught anything. Early concealed clutter is gentle and discardable; the player survives the opening on blind-discard + starter cards while burning a Bonfire down.

#### REQ-FOG-22 — The Cooler is load-bearing, not filler

A harmless concealed card (Abandoned Cooler) is required: at equal Conceal depth every fog card looks identical, so the decision-quality clock — "is it worth the light to find out?" — only exists because some shapes are nothing. Without noise, light is rote. The composition ships at least one harmless concealed card at a depth shared with a dangerous one.

#### REQ-FOG-23 — Whiteout reuses the generalized counter

Whiteout's escalation is `DamageScaled { base: 0, per: { kind: "KeywordInHand", keyword: "Concealed" }, amount: 1 }` — no bespoke `ConcealedInHand` variant. It counts every `Concealed`-tagged card in hand (lit or not, itself included): "damage per fog-thing you're carrying", which is simpler and on-theme. This is the dependency that justifies slice 1's generalization being real, not cosmetic.

#### REQ-FOG-24 — Zero deck-pollution surface

There is **no Spore-equivalent junk card**. Conceal does not inject cards into the player deck; the hazards themselves are the threat, face-down. The Fog world JSON references no junk-injection template; its novelty is concentrated entirely in the concealment state.

#### REQ-FOG-25 — Walker capstone, untouched canon

Act 3 contains exactly one `The Walker`; `The Walker` and `Door` are referenced from the shared starter source, never redefined (canon N1).

#### REQ-FOG-26 — Distinct rewards

The Bonfire / clear-reward kit cards (Flashlight, Flare Gun, Bonfire card, Searchlight) are distinct from every other world's reward — no card identical in effect+cost to another world's reward (Mall rule D2). Searchlight in particular must differ from the Mall's Weed Killer / zombie sweep by its `Hidden` bonus and/or cost.

#### REQ-FOG-27 — Acts escalate by fog depth and bite

Act 1 is shallow and gentle (Conceal 1–2, ticks 0–1, the Cooler false alarm, ~3 visible Bonfires to clear). Act 2 introduces mid-depth damaging hazards (Conceal 3, `Damage 2`, lunge-on-flee). Act 3 is the deep end (Conceal 5 Whiteout whose damage scales with carried fog, plus the Walker). The escalation is depth + tick severity, against the decaying light.

## 5 · Visual & theme (REQ-FOG-28 … 32)

#### REQ-FOG-28 — The fog-back and the light-line animation

The renderer `CardView` renders a concealed card (`isConcealed` true) as a fog-shrouded back showing **only its `Concealed:N` chip** — depth visible, identity (name/cost/effect/other keywords/inset) hidden. A `LightChanged` event re-evaluates the hand and animates shapes fading in as light rises and back out as it decays (the fog closing in from the deep end first). The core exposes `light` + `Concealed:N`; the renderer derives `isConcealed` and hides — determinism untouched, cosmetic fog jitter never feeds back into state.

#### REQ-FOG-29 — Light reads out in the HUD power-up area; `effect-icon-light` serves it and the `GainLight` glyph

Light is a standing global resource the player must read every turn to compare against each card's `Concealed:N` chip, so it needs a persistent HUD readout — not just the per-card fog animation of REQ-FOG-28. `HUDView` shows a Light indicator in the power-up area via the existing `addPowerUp` path, displaying the current `light` value and updating on every `LightChanged`. A single new `effect-icon-light` asset sources both this indicator **and** the `GainLight` effect-line glyph — the brace precedent exactly (`effect-icon-brace` sources both brace's power-up indicator and the Brace effect line; see `HUDView.addPowerUp("effect-icon-brace")` and the effect-line glyph map).

**Visibility rule.** Unlike brace's `charges > 0` gate, the Light indicator must stay visible whenever the world uses light **including at Light 0** (the thickest-fog moment, the most important to read), and must be **absent in worlds that do not use light** (where `light` sits at 0 meaninglessly). So `light > 0` is explicitly the wrong predicate; the indicator keys off "this world uses concealment/light." The concrete signal (the in-core `worldId`, a world flag, or the presence of any `Concealed` card) is an implementation choice for the plan, but the two behaviors above are requirements.

#### REQ-FOG-30 — Five artifacts, three registrations

Per theme-authoring W3: world JSON, `src/game/view/themes/fog-beach-party.ts` (`VisualTheme`), assets under `src/game/assets/themes/fog-beach-party/` (+ `insets/`), and entries in `assetManifest.ts`, `worldManifest.ts` (using the existing `makeWorldBuilder(…_SOURCE)` pattern — do not invent a per-world builder), and `themeManifest.ts`. A missing registration is a spec failure, not a polish gap.

#### REQ-FOG-31 — Asset minimum, precedent art bar

Required: a `fog-beach-party-reality.webp` backdrop (golden-hour beach party, Walker distant), an intrusion/fog overlay, a `fog-beach-party-cardfront.webp`, a **fog-back texture** for concealed cards (REQ-FOG-28), an `effect-icon-light` glyph (REQ-FOG-29, serves the HUD Light readout and the `GainLight` effect line), and one inset key per themed card (`fog-inset-…` namespace, every key registered). Card insets may ship as placeholders (bird-building / highway-volcano / mall precedent).

#### REQ-FOG-32 — Place-vs-disaster identity, visually distinct

The contrast is the joy of the party against the meanness of the Mist (the brighter the party, the crueler the turn) — the place-vs-disaster theme rule (new-world-concepts). Intrusion reads as cold fog rolling over warm golden-hour color and must be distinct at a glance from every shipped world. All visual-direction pass tests apply: ink-and-ash linework, desaturated reality with the intrusion as the dominant tonal shift, localized apocalypse radius, violet Door.

## 6 · Manifests & help (REQ-FOG-33 … 34)

#### REQ-FOG-33 — World select entry

`worldDisplayManifest.ts` gains a `fog-beach-party` entry (name, fiction blurb consistent with "golden-hour beach party; then the fog rolls in faster than fog should, and there is something in it").

> Dependency flagged, not owned here: world-select already overflows at 4 worlds (`WORLD_SELECT_LAYOUT` in `src/game/view/layout.ts`, `WorldSelectScene.ts`); the recorded fix is a shift-by-one carousel. World 5 worsens it but the carousel is a separate spec.

#### REQ-FOG-34 — Help entry within budget

`worldHelpManifest.ts` gains a `fog-beach-party` entry: at most 6 notes (REQ-HELP-13), at minimum a Light note (it decays each turn; visible iff Light ≥ a card's Concealed depth), a concealment note (concealed = can't target + details hidden, but it still hits you), and a blind-discard note (you can flee a concealed shape even though you can't aim at it).

## 7 · Documentation (REQ-FOG-35)

#### REQ-FOG-35 — Theme-authoring doc amended in the same spec

`.lore/reference/theme-authoring.md` updates (Mall rule REQ-MALL-24, amend-with not after): C1 effect vocabulary adds `GainLight`; C2 keyword list adds `Concealed` and documents the **numeric-keyword `"Name:N"` authoring convention** (a keyword may carry an optional value, matched by name); the SV1 archetype table gains the Fog row — *fog-beach-party · reveal & endure · light economy (`GainLight` kit) exclusive to this world; concealment = no-target + hidden-details over true data*. Existing stale marks (if any remain) are cleared in the same edit.

## 8 · Tests (REQ-FOG-36 … 38)

#### REQ-FOG-36 — Core coverage for every new behavior

Unit tests written alongside, extending the existing suites (`cards.test.ts`, `effects.test.ts`, `available.test.ts`, `world.test.ts`, `effectRegistry.test.ts`): numeric-keyword parse (`"Concealed:3"` → `{name,value:3}`; `"Spore"` → no value; invalid form throws); `hasKeyword` name-matching ignores value; `KeywordInHand` counts by name across player+world carriers; `GainLight` resolution (`light += amount`, `LightChanged` emitted) and its asserted no-target playability (explicit, because `available.ts` defaults hide a missing case); `isConcealed` = `concealOf > light` with 0-for-absent; single-target `legalTargets` exclude concealed cards while `DealProgressAll` hits them; turn-start decay `max(0, light−1)` + event; Whiteout `DamageScaled per KeywordInHand "Concealed"` math (incl. self-count); determinism (seeded Fog run with light/conceal plays replays byte-identically via the existing state-snapshot + event-sequence comparison).

#### REQ-FOG-37 — Catalog, manifest, and renderer tests cover the new world

`worldManifest.test.ts` catalog-build covers `fog-beach-party` (every referenced template resolves — the safety net for the unchecked JSON cast); `worldDisplayManifest.test.ts` / `worldHelpManifest.test.ts` completeness covers the new entries; renderer tests (`describe.test.ts`, `cardObjects.test.ts`/`presentation.test.ts`) cover the structured-keyword chip, the concealed "lost in the fog (needs Light N)" describe, and that depth shows on the fog-back while identity hides.

#### REQ-FOG-38 — Existing golden runs stay green or are knowingly regenerated

The keyword generalization (slice 1) must leave other worlds' golden runs byte-identical. If a shared code path shifts event ordering, regeneration is a deliberate, explained step — never a silent update.

## Not in scope

- **World 6 (Whiteout Parking Garage / freeze, `Frozen:N`)** — the second customer of the numeric-keyword generalization, separate spec. Slice 1 is built world-agnostic so `Frozen:N` is additive.
- **Bonfire second-state mechanic** (slow-decay / Light floor) — Q3 resolved to flat refuel; revisit only if playtest says samey. Out of scope here.
- **Mandated act-1 leg-up** (start Light 4 / Flashlight-on-discard) — Q2 resolved to ship-and-watch; the fallback is recorded in the brainstorm, not specced.
- **World-select carousel** — pre-existing overflow at 4 worlds; separate spec (REQ-FOG-33 note).
- Other counter-spec members beyond `KeywordInHand`; final inset art (placeholder precedent applies).
- The four-number tuning surface (starting Light, decay rate, per-act Conceal depths, kit restore amounts) — soft, owned by playtest against a playable build.

## AI Validation

How the AI verifies this spec is done. All commands from repo root.

| Check | Method | Covers |
|---|---|---|
| Full suite green | `bun run test` exits 0; new test names match REQ-FOG-36/37 behaviors | 1–14, 23, 36–38 |
| Core purity | `bun run lint` exits 0 (no Phaser in `src/core/`) | 6, 28 |
| Build works | `bun run build` exits 0 | all |
| Keyword type split | Inspect `types.ts`: `KeywordName` (string union incl. `Concealed`) distinct from `Keyword = {name; value?}`; `CounterSpec.keyword`, `DealProgress(.bonus).tag`, `DealProgressAll.bonus.tag`, `TargetSpec.hazard.tag` are `KeywordName` | 1, 4 |
| Parse correctness | Core test: `"Concealed:3"` mints to `{name:"Concealed",value:3}`; `"Spore"` to `{name:"Spore"}` (no value); a malformed string throws at parse | 2 |
| No surviving `.includes` | Grep `keywords.includes` / `.keywords)` over `src/core` and `src/game`: no structured-keyword array is matched by `.includes` or rendered by bare `.join`; all route through the name-match helper / value formatter | 3, 5 |
| GainLight semantics | Core test: dispatch `GainLight` from a seeded state — `light` rises by amount, `LightChanged` emitted, nothing else changes; no-target playability asserted explicitly | 9, 10 |
| Playability coverage | Confirm `GainLight`'s `isPlayable`/`structuralSpec` behavior is test-asserted (the `available.ts` defaults silently mask a missing case — REQ-MALL-5 gotcha) | 9 |
| Visibility & targeting | Core test: `isConcealed(card,light)` = `concealOf>light`, 0 for absent; single-target `legalTargets` exclude a concealed card; `DealProgressAll` deals to it; raising light makes it targetable and keeps its `Hidden` keyword (Explore bonus still applies) | 8, 12, 13 |
| Decay clock (core) | Core test: `startTurn` drops `light` by 1 (floored at 0), emits `LightChanged`, and fires the decay before `gainEnergy`/refill in the event order | 11 |
| Decay clock (renderer) | Renderer test: a `Concealed:3` card renders lit at `light≥3` and as a fog-back once decay brings `light` to 2 | 11, 28 |
| Light HUD readout | Renderer test + runtime: `HUDView` shows a Light indicator in the power-up area sourcing `effect-icon-light`, value updating on `LightChanged`; visible at Light 0 in Fog, absent in a non-light world (predicate is not `light>0`); `GainLight`'s effect-line glyph is `effect-icon-light` | 29 |
| Kit card shapes | Inspect `fog-beach-party` data: Flashlight (`GainLight 2`, no exhaust), Flare Gun (`GainLight 6`, exhaust), Bonfire card (`GainLight 4`, no exhaust), Searchlight (`DealProgressAll base 1, bonus Hidden +1`, exhaust) match REQ-FOG-16 | 16 |
| Whiteout math | Core test: hand with K `Concealed`-tagged cards → Whiteout end-of-turn damage = K (self included), via `DamageScaled per KeywordInHand "Concealed"`, no bespoke counter | 23 |
| Describe coverage | `describeEffect` returns text for `GainLight`; a concealed card describes "lost in the fog (needs Light N)" with depth shown, identity hidden; `tsc` compiles (no-default switch trip-wire) | 14 |
| World JSON shape | Inspect `fog-beach-party` data: 3 acts; act 3 has exactly one `The Walker`; The Bonfire has no `Concealed:N` and an `onCleared` kit grant; every concealed hazard with a damaging `onEndOfTurn` is `discardable:true`; at least one harmless concealed card shares a depth with a dangerous one; no junk-injection template referenced | 18–22, 24, 25, 27 |
| Distinct rewards | Diff kit templates against the other worlds' rewards — no identical effect+cost pair (Searchlight ≠ Weed Killer/zombie sweep) | 26 |
| Signature claim | Grep `GainLight` across world data: only `fog-beach-party` references it | 17 |
| Registrations | Grep `fog-beach-party` in `assetManifest.ts`, `worldManifest.ts`, `themeManifest.ts`, `worldDisplayManifest.ts`, `worldHelpManifest.ts` — all five hit; every `fog-inset-*` key referenced in JSON exists in the asset manifest; the fog-back texture and `effect-icon-light` are registered | 29, 30, 31, 33, 34 |
| Help budget | `fog-beach-party` help entry has ≤ 6 notes incl. a Light note, a concealment note, and a blind-discard note | 34 |
| Docs amended | theme-authoring.md: C1 lists `GainLight`; C2 includes `Concealed` + the `"Name:N"` numeric-keyword convention; SV1 has the Fog row | 35 |
| Runtime smoke | Launch the game, select Fog Beach Party, play one run: backdrop/cardfront/insets load (no magenta); concealed cards render as fog-backs showing only depth; a Flare/Flashlight raises Light and shapes fade in (and the HUD Light readout updates); light decays and the deepest fog winks back out; a concealed hazard can be blind-discarded; clearing a Bonfire grants the kit; Searchlight hits concealed cards. Confirms reachability only, not line viability | 15, 21, 28, 29 (manual / browser-driven) |

**Strategic-triangle check (REQ-FOG-15):** not AI-verifiable beyond existence (snipe/sweep/see all reachable in data); whether light is the skilled-but-optional line and act 1 survives without a leg-up is explicit human playtest territory — the brainstorm's stated single biggest tuning risk.

---
Spec · REQ-FOG · draft 2026-06-13 · source decisions: `.lore/work/brainstorm/fog-beach-party-world.md`
