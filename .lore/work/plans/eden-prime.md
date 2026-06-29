---
title: "Implementation plan: Eden Prime world"
date: 2026-06-29
status: draft
tags: [plan, world-design, eden-prime, startle, alarm, applied-keywords, core-engine]
modules: [core-engine, world-data, themes, game-view]
related: [.lore/work/specs/eden-prime.md, .lore/reference/theme-authoring.md, .lore/work/specs/the-ember-orchard.md, .lore/work/specs/city-of-sleeping-giants.md]
---

# Implementation plan: Eden Prime world

Source spec: [.lore/work/specs/eden-prime.md](../specs/eden-prime.md) (REQ-EDEN-1..50). This plan implements the 10th world, Eden Prime (verb `startle`), which — unlike its siblings the-ember-orchard and city-of-sleeping-giants — takes a bounded **core-engine slice** introducing a general transient/applied-keyword mechanism with `Alarm` as its first instance.

The world-data, asset, and help work mirrors the established sibling pattern (`src/data/worlds/<id>/` + the unified `src/data/allCards.json` catalog). The novel work is Slice 1.

## Ratified design decisions

Folded in before drafting, on top of the spec's own ratified/post-review decisions:

- **Applied keywords are a general new field, not an Alarm-specific field** (user decision, 2026-06-29). Both `PlayerCard` and `WorldCard` gain a transient `appliedKeywords?: readonly Keyword[]` collection, distinct from the authored `keywords` array. `Alarm` is the first applied keyword; the field is intentionally general so future worlds (e.g. new-derelict's `Lockdown`, see `.lore/work/specs/new-derelict.md`) reuse it. This supersedes the spec's literal "a field analogous to `PlayerCard.frozen`" wording (REQ-EDEN-9/40) — same intent (a transient numeric-lifetime instance state separate from authored keywords), generalized.
- **`hasKeyword`/`keywordNames` union both sets.** A card "has" keyword X iff X is in `keywords` **or** in `appliedKeywords`. This makes `KeywordGate` counting, `CounterSpec.KeywordInHand` (REQ-EDEN-29 `DamageScaled`), and `DealProgress.bonus.tag` recognize applied Alarm for free, with no change to `resolveCounter`. This is the reconciliation that makes REQ-EDEN-11/29 consistent with REQ-EDEN-9.
- **Applied-keyword value is the lifetime.** `{ name: "Alarm", value: 2 }` means "alarmed for two turn-start ticks." Decay decrements the value each turn-start and removes the entry at 0 (mirrors `frozen`, generalized to any applied keyword). Counting "Alarm-bearing cards" counts cards with an applied `Alarm` entry (value > 0), not the sum of values.
- **`alarmGuard` is granted by a new `GainAlarmGuard { amount }` effect**, parallel to `Brace`/`BraceHandler`. REQ-EDEN-14's "adds exactly" list names "the alarmGuard charge" but not its granting effect; `Stillness Lesson` (REQ-EDEN-19) needs one, so the charge ships with a granting effect. Flagged as a minor spec-implied addition.
- **`progressDealtThisTurn` is read by a new `ProgressGate { min, then }` effect**, parallel to `KeywordGate` but conditioning on `state.progressDealtThisTurn >= min` instead of a keyword count. REQ-EDEN-12a makes the field part of the slice and REQ-EDEN-27 (`Flowers Face the Wrong Sun`) must gate its `onEndOfTurn` apply on it — but the four keyword/guard effects can only count cards, not read a `GameState` number. `ProgressGate` is the read mechanism that lets Eden author the *preferred* greed-conditioned form (value 2 Alarm to `firstWorldCardInHand` when `progressDealtThisTurn > 4`) rather than the degraded unconditional fallback REQ-EDEN-27 flags. Flagged as a spec-implied addition beyond REQ-EDEN-14's literal list, for the same reason as `GainAlarmGuard`.
- **`alarmGuard` is consumed inside `KeywordGate`.** The gate is the single choke point for every Alarm-caused disruption in Eden (`DiscardThenDraw`, top-deck recurrence, Panic, `ForceDestroy`). When a gate passes its threshold and `alarmGuard > 0`, one guard is consumed and the inner `then` is suppressed (REQ-EDEN-11a's "a gated startle is suppressed and one guard is consumed instead").
- **`progressDealtThisTurn` is incremented at one choke point:** the shared `dealProgress()` helper in `dealProgress.ts`, which all of `DealProgress`/`DealProgressScaled`/`DealProgressAll` route through. Reset at the turn boundary alongside `turnPlayHistory`.

## Engine landing spots (verified against current code)

| Concern | File:symbol | Note |
|---|---|---|
| Keyword vocab | `src/core/model/types.ts:12` `KeywordName` | add `"Alarm"` |
| Card fields | `types.ts:142` `PlayerCard.frozen`; `WorldCard` ~L151-171 | add `appliedKeywords?: readonly Keyword[]` to **both** |
| Effect union | `types.ts:41` `CardEffect` | add `ApplyKeyword`, `KeywordGate`, `ProgressGate`, `RemoveKeyword`, `GainAlarmGuard` |
| GameState | `types.ts:204` | add `alarmGuard: number`, `progressDealtThisTurn: number`, `pendingAlarmNextWorldCard?: number \| undefined` |
| Events | `types.ts:319` `GameEvent` | add `KeywordApplied`, `KeywordRemoved`, `AlarmGuardChanged`, `AlarmGuardConsumed` |
| Keyword parse/query | `src/core/model/keywords.ts:14` `KEYWORD_NAMES`, `hasKeyword`, `keywordNames` | add `"Alarm"`; union authored + applied sets; add apply/remove/tick helpers |
| Effect registry | `src/core/effects/registry.ts` `EFFECTS` | exhaustive map — must register the 4 new handlers |
| New handlers | new `src/core/effects/appliedKeywords.ts` | `ApplyKeywordHandler`, `KeywordGateHandler`, `RemoveKeywordHandler`; `GainAlarmGuardHandler` may live in `resources.ts` beside `BraceHandler` |
| Counter reuse | `src/core/effects/dealProgress.ts` `resolveCounter` (`KeywordInHand`) | works unchanged once `hasKeyword` unions applied keywords |
| Progress choke point | `dealProgress.ts` `dealProgress()` | increment `progressDealtThisTurn` by `amount` |
| Turn-start decay | `src/core/engine/energy.ts` `startTurn` (mirror `thawFrozenCardsAtTurnStart`) | add applied-keyword tick step |
| Turn-boundary reset | `src/core/engine/reduce.ts:208` (with `turnPlayHistory`) | set `progressDealtThisTurn: 0` |
| World-card draw | `src/core/engine/draw.ts` `drawWorld` (card pulled ~L111); model on `resolveForceDestroy` ~L211 | consume `pendingAlarmNextWorldCard` on first world card drawn |
| GameState init | `src/core/engine/world.ts:110` | init `alarmGuard:0`, `progressDealtThisTurn:0`, `pendingAlarmNextWorldCard:undefined` |
| `selfId` in hooks | confirmed: `dealProgress` passes `hazardId` as `selfId` to `onCleared`/`onPartialClear`; `DestroySelf` proves `onEndOfTurn` has `selfId` | REQ-EDEN-24's `target:"self"` works in `onEndOfTurn`/`onPartialClear` |
| Threat map | `src/core/effects/gainCard.ts` `worldThreatTemplateByWorldId` | add `"eden-prime": "Paradise Runs"` |
| World registry | `src/data/worlds/registry.ts` | append `EDEN_PRIME_BUNDLE` |
| Card catalog | `src/data/allCards.json` `cardTemplates` | author all Eden card templates here (NOT per-world cards.json) |
| Boon pool | `src/data/boonPools.json` | add `pool-eden-grove` |
| Asset bindings | `src/game/worlds/assetBindings.ts`, `src/game/data/assetManifest.ts` | register `eden-inset-*` + base keys |
| Visual theme type | `src/game/view/themes/theme.ts` `VisualTheme` | mirror sibling `theme.ts` |

`DamageScaled { per: { kind: "KeywordInHand", keyword: "Alarm" } }` (REQ-EDEN-29) needs **no** new scaling code — `CounterSpec.KeywordInHand` already exists (`types.ts:22`) and resolves through `hasKeyword`.

## Slice structure

The spec (REQ-EDEN-44) mandates ≥4 reviewable slices, each with its own tests; the core slice lands green before world data depends on it.

<div style="font-family:monospace; line-height:1.6;">
<b>Slice 1 — Core engine (applied keywords + Alarm)</b> &nbsp;⟶&nbsp; gate G1 (REQ-EDEN-45) must be green<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓ blocks<br>
<b>Slice 2 — World data + registration</b> &nbsp;⟶&nbsp; gate G2 (REQ-EDEN-46/47)<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓ blocks<br>
<b>Slice 3 — Assets / presentation / help</b> &nbsp;⟶&nbsp; gate G3 (REQ-EDEN-48/49)<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓ blocks<br>
<b>Slice 4 — Conformance + seeded gameplay + docs</b> &nbsp;⟶&nbsp; gate G4 (REQ-EDEN-50, AI Validation 1-7)
</div>

---

## Slice 1 — Core engine: applied keywords + Alarm

Covers REQ-EDEN-9, 10, 11, 11a, 12, 12a, 13, 14, 15, 45.

**Step 1.1 — Types.** In `types.ts`: add `"Alarm"` to `KeywordName`; add `appliedKeywords?: readonly Keyword[]` to `PlayerCard` and `WorldCard`; add the five `CardEffect` variants (`ApplyKeyword { keyword, value, target }` with `target: "hand" | "nextWorldCard" | "self" | "firstWorldCardInHand"`; `KeywordGate { keyword, min, zone, then }`; `ProgressGate { min, then }`; `RemoveKeyword { keyword, target, amount }`; `GainAlarmGuard { amount }`); add `alarmGuard`, `progressDealtThisTurn`, `pendingAlarmNextWorldCard` to `GameState`; add the four `GameEvent` variants (`KeywordApplied`, `KeywordRemoved`, `AlarmGuardChanged`, `AlarmGuardConsumed`).

**Step 1.2 — Keyword helpers.** In `keywords.ts`: add `"Alarm"` to `KEYWORD_NAMES`; change `hasKeyword`/`keywordNames` to union `card.keywords` and `card.appliedKeywords`; add pure helpers `withAppliedKeyword(card, kw)`, `withoutAppliedKeyword(card, name)`, `appliedKeywordValue(card, name)`, and `tickAppliedKeywords(card)` (decrement each value, drop at 0).

**Step 1.3 — Effect handlers.** New `src/core/effects/appliedKeywords.ts`:
- `ApplyKeywordHandler`: resolve target → `"hand"` (all cards in `state.hand`), `"self"` (`ctx.selfId`; available in `onEndOfTurn`/`onPartialClear` — confirmed), `"firstWorldCardInHand"` (world card in hand with the smallest mint-order id, **sorted by `parseInt(card.id, 10)` — NOT string comparison**, since ids are `String(nextId)` and lexicographic order inverts at id ≥ 10, e.g. `"10" < "2"`; a string sort is a latent determinism bug that only surfaces past 9 minted cards), `"nextWorldCard"` (set `pendingAlarmNextWorldCard = value`, no immediate card change). Apply via `withAppliedKeyword`, emit `KeywordApplied`.
- `KeywordGateHandler`: `count = cards in zone where hasKeyword(c, keyword)`. If `count >= min`: if `alarmGuard > 0`, decrement guard, emit `AlarmGuardConsumed`, **suppress** `then`; else `ctx.apply(ctx, then)`. If `count < min`: no-op (no else-branch — REQ-EDEN-11).
- `ProgressGateHandler`: if `state.progressDealtThisTurn >= min`, `ctx.apply(ctx, then)`; else no-op. Same no-else-branch shape as `KeywordGate`. (Does **not** consume `alarmGuard` — it is a greed signal, not an Alarm-caused disruption.)
- `RemoveKeywordHandler`: clear `keyword` from up to `amount` cards in target zone (deterministic order by numeric id), emit `KeywordRemoved`.
- `GainAlarmGuardHandler` (in `resources.ts` beside `BraceHandler`): `alarmGuard += amount`, emit `AlarmGuardChanged`.
- Each handler implements `describe`/`compile` (mandatory abstract methods). Add concrete glyph tokens following the `"brace"`/`"forceDestroy"` patterns in `src/core/effects/tokens.ts`: at minimum an `"alarm"` icon token and an `"alarmGuard"` count label, plus `describe` strings for the gates.
- Register all five in `registry.ts` `EFFECTS` (the map is exhaustive over `CardEffect["kind"]`, so a missing handler is a compile error).

**Step 1.4 — Progress signal.** In `dealProgress.ts` `dealProgress()`: increment `state.progressDealtThisTurn` by `amount` (single choke point for all three progress effects).

**Step 1.5 — Turn lifecycle.** In `energy.ts` `startTurn`: add an applied-keyword decay step (new `tickAppliedKeywordsAtTurnStart(state)` mirroring `thawFrozenCardsAtTurnStart`), emit-on-change `KeywordRemoved` for entries that expire. **Fixed order: light decay → thaw → applied-keyword decay → energy gain → refill → resolveForceDestroy.** Decay runs after thaw (both are "turn-start unfreeze" semantics) and before energy/refill; this order is load-bearing for the event stream and must be asserted by tests. In `reduce.ts:208`: reset `progressDealtThisTurn: 0` alongside `turnPlayHistory`. In `world.ts:110`: init `alarmGuard: 0`, `progressDealtThisTurn: 0`, and **omit** `pendingAlarmNextWorldCard` (optional field; a present-but-`undefined` literal is a compile error under `exactOptionalPropertyTypes`, matching the `pendingForceDestroySource` precedent at `world.ts:103`).

**Step 1.6 — Deferred next-world-card.** In `draw.ts` `drawWorld`: when a world card is pulled into hand and `pendingAlarmNextWorldCard` is set, apply the Alarm to that card, clear the flag, emit `KeywordApplied` (model exactly on `resolveForceDestroy`'s consume-and-clear pattern).

**Step 1.7 — Threat map.** In `gainCard.ts` `worldThreatTemplateByWorldId`: add `"eden-prime": "Paradise Runs"`.

<div style="background:#eef7ee; border-left:4px solid #2e7d32; padding:6px 10px;">
<b>Gate G1 (REQ-EDEN-45)</b> — new core tests prove, independent of Eden Prime: <code>ApplyKeyword</code> places <code>Alarm</code> (value 2) on the intended cards for all four targets and emits an event (incl. <code>firstWorldCardInHand</code> resolving by numeric id past 9 minted cards, and <code>nextWorldCard</code> consuming on the next world draw); <code>KeywordGate</code> and <code>ProgressGate</code> fire at/above <code>min</code> and are a no-op below (boundary tested <code>min-1</code>/<code>min</code>/<code>min+1</code>); <code>RemoveKeyword</code> and <code>GainAlarmGuard</code>+gate-consumption clear/absorb deterministically; applied keywords decay one per turn-start tick (in the fixed lifecycle order) and are removed at zero; and a world that applies no Alarm produces <b>byte-identical state and events</b> to before the slice (the no-op guarantee, incl. <code>progressDealtThisTurn</code>/<code>alarmGuard</code> written-but-unread). <code>bun run test</code> green.
</div>

---

## Slice 2 — World data + registration

Covers REQ-EDEN-1, 4, 6, 7, 16-35, 46, 47. Mirrors the city-of-sleeping-giants bundle structure. (REQ-EDEN-7's exclusive-verb authorship invariant is enforced by the card-effect authoring here and the REQ-EDEN-22 data-level scan in Gate G2.)

**Step 2.1 — Card templates** in `src/data/allCards.json` `cardTemplates`. World hazards (REQ-EDEN-23-29): `Fruit Offered Too Quickly`, `First Warning Cry`, `Curious Swarm`, `The Herd Misunderstands`, `Flowers Face the Wrong Sun`, `The Quiet Grove`, `Paradise Runs`. Reward cards (REQ-EDEN-17-21): `Take the Fruit`, `Gentle Approach`, `Stillness Lesson`, `Follow the Shade`, `Hush the Valley`. Plus a **named** fixed slow-step player template that `Follow the Shade` top-decks (REQ-EDEN-20) — author it as a distinct `templateId` (e.g. `Tread Softly`), since "the template `Follow the Shade` top-decks" must not be the reward card itself. `Flowers Face the Wrong Sun`'s `onEndOfTurn` is authored as `ProgressGate { min: 5, then: ApplyKeyword { keyword: "Alarm", value: 2, target: "firstWorldCardInHand" } }` (REQ-EDEN-27's preferred greed-conditioned form; `min: 5` expresses "progressDealtThisTurn > 4"). Each world card defines all four hooks (`None` where unused, REQ-EDEN-30); each references an `eden-inset-*` `insetKey`. Reward cards must not build their *main identity* on another world's signature mechanic (REQ-EDEN-7/22) — incidental supporting use of a shared effect is fine; this is an authorship invariant, not a hard effect ban. Use current effect names (`AddWorldCardToDeck { bTop:true }`, never stale `AddWorldCardToTop`; no `ReturnWorldCards`). `Panic` reuses the shared starter template (spec ratified decisions). At least one Act 1 hazard is low/no-damage on discard so a restrained player is never soft-locked (REQ-EDEN-31).

**Step 2.2 — Boon pool** `pool-eden-grove` in `boonPools.json` over the five reward cards (REQ-EDEN-28).

**Step 2.3 — Deck composition** `src/data/worlds/eden-prime/cards.json`: `worldId: "eden-prime"` + three acts per REQ-EDEN-33, Act 3 ending in `The Walker` x1 (REQ-EDEN-34).

**Step 2.4 — Bundle files** `eden-prime/meta.ts` (display + help, REQ-EDEN-41/42), `eden-prime/theme.ts` (REQ-EDEN-36), `eden-prime/index.ts` (`EDEN_PRIME_BUNDLE`, `musicKey: "music-eden-prime"`). Register in `registry.ts`.

<div style="background:#eef7ee; border-left:4px solid #2e7d32; padding:6px 10px;">
<b>Gate G2 (REQ-EDEN-46/47/31)</b> — world-data tests: no duplicate template ids; all Eden world cards define all hooks; all keywords valid (incl. `Alarm`); Act 3 ends with `The Walker`; bundle in `worldDataRegistry`; `eden-prime` threat mapping resolves; `buildWorld("eden-prime")` succeeds; an Act 1 hazard discarded by a restrained player deals no soft-lock (REQ-EDEN-31). (REQ-EDEN-7/22's startle-identity invariant is not a data scan — it is enforced by authorship review and the Slice 4 seeded gameplay test, since "main identity" is not a mechanically testable property.) Effect/data tests: `Take the Fruit` raises Alarm; `Curious Swarm`/`The Herd Misunderstands` inert on a calm board, fire (`DiscardThenDraw`/top-deck/Panic) past threshold; `Flowers Face the Wrong Sun` raises Alarm on a greedy turn (`progressDealtThisTurn` ≥ 5) via `ProgressGate` and no-ops on a restrained turn; `The Quiet Grove` `onCleared` offers `pool-eden-grove`; `Gentle Approach`/`Stillness Lesson`/`Hush the Valley` reduce/absorb Alarm; `Paradise Runs` keeps real HP pressure via `AddThreatToWorldDeck`. <code>bun run test</code> green.
</div>

---

## Slice 3 — Assets / presentation / help

Covers REQ-EDEN-2, 3, 5, 8, 36-40, 41, 42, 48, 49. (REQ-EDEN-5's three-beat fiction is expressed through Step 3.4's display/help copy.)

**Step 3.1 — Base art wiring.** Wire the existing `eden-prime-reality.webp`, `intrusion-overlay.webp`, `eden-prime-cardfront.webp` (already present) to keys `eden-prime-bg`, `eden-prime-overlay`, `eden-prime-cardfront` in `assetBindings.ts` + `assetManifest.ts` (REQ-EDEN-2). Do not regenerate.

**Step 3.2 — Insets.** Add one inset per Eden card under `src/game/assets/themes/eden-prime/insets/` with `eden-inset-*` keys, register each in `assetBindings.ts` + `assetManifest.ts` (REQ-EDEN-3). Inset *art generation* is out-of-band (art-gen pipeline / user); the code task is the keys + bindings resolving. Confirm the sibling pattern (whether final art or a documented placeholder) against an existing world before generating.

**Step 3.3 — Renderer Alarm legibility.** Render applied `Alarm` on a card (badge/overlay), mirroring the existing `frozen` render path as the model and applying to **both** `PlayerCard` and `WorldCard` instances. Locate where `frozen` currently renders in `src/game/view/` card components and add the Alarm badge alongside it, driven by the `appliedKeywords` field / `KeywordApplied`+`KeywordRemoved` events. Cosmetic only; never feeds back into core state.

**Step 3.4 — Help/display copy** verified to fit the world help budget (REQ-EDEN-42) and express the place-vs-disaster contrast (REQ-EDEN-41).

<div style="background:#eef7ee; border-left:4px solid #2e7d32; padding:6px 10px;">
<b>Gate G3 (REQ-EDEN-48/49)</b> — asset validation: every `eden-inset-*` key plus `eden-prime-cardfront`/`eden-prime-bg`/`eden-prime-overlay` has a binding in both `assetBindings.ts` and `assetManifest.ts` and loads without falling back to starter art. Presentation test/smoke: `selectTheme("eden-prime")` returns the Eden palette/backdrop/overlay/cardfront; a representative Eden card renders with its inset; applied Alarm is visible on a card. <code>bun run test</code> green.
</div>

---

## Slice 4 — Conformance + seeded gameplay + docs

Covers REQ-EDEN-43, 50, and AI Validation 1-7.

**Step 4.1 — Seeded gameplay test (REQ-EDEN-50).** Demonstrate the greed-tax identity end to end: a restrained line (decline gifts by discarding gift hazards, clear/discard `First Warning Cry`, no extra draw) keeps Alarm at zero and passes Act 1 hazards as harmless; a greedy line (clear gifts for reward, play `Take the Fruit`, over-draw) raises Alarm past `min: 2` and turns the same hazards into `DiscardThenDraw`, top-decked `Curious Swarm`, and Panic.

**Step 4.2 — Docs (REQ-EDEN-43).** Update `.lore/reference/theme-authoring.md`: add Eden Prime to the signature-verb table (`startle`, "greed raises Alarm; restraint/valve cards spend it"); add `Alarm` to the keyword vocabulary (C2) noting the first transient/applied keyword and the general `appliedKeywords` field; document `ApplyKeyword`/`KeywordGate`/`RemoveKeyword`/`GainAlarmGuard` in the effect vocabulary (C1) as general primitives Eden introduced; note Eden owns the greed-tax startle reward space. Correct the C2a note if needed (applied keywords vs authored).

**Step 4.3 — Full validation.** `bun run test`, then `bun run lint && bun run typecheck && bun run build`. Confirm the `core`/`game` boundary lint passes (all new core code is Phaser-free).

<div style="background:#eef7ee; border-left:4px solid #2e7d32; padding:6px 10px;">
<b>Gate G4 (final)</b> — AI Validation items 1-7 from the spec observable; full suite + lint + typecheck + build green; a local smoke run can select <code>eden-prime</code>, take a gift / over-draw to raise Alarm, observe a previously-harmless hazard startle, and use a valve reward to calm the board.
</div>

## Validation against source

Final step: walk REQ-EDEN-1 through REQ-EDEN-50 and confirm each maps to a step above or an explicit deferral. Known deferral, per spec: the auto-spreading "alarm chain" (REQ-EDEN-14) is out of scope; Alarm spreads only through authored card effects. Known generalization, per user decision: applied keywords are a general field, not Alarm-specific (REQ-EDEN-9/40 wording). Known minor additions beyond REQ-EDEN-14's literal effect list: `GainAlarmGuard` (grants the `alarmGuard` charge named in REQ-EDEN-11a/14) and `ProgressGate` (the read mechanism for `progressDealtThisTurn`, without which REQ-EDEN-27's preferred greed-conditioned form is unimplementable).
