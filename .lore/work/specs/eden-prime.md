---
title: Eden Prime world
date: 2026-06-29
status: draft
tags: [world-design, eden-prime, startle, alarm, applied-keywords, keyword-gate, progress-gate, deck-pressure, core-engine]
modules: [world-data, themes, game-view, core-engine]
related: [.lore/reference/theme-authoring.md, src/game/assets/themes/eden-prime/CATACLYSM.md, .lore/work/specs/the-ember-orchard.md, .lore/work/specs/city-of-sleeping-giants.md]
req-prefix: EDEN
---

# Eden Prime world

Eden Prime is a green paradise that has never needed the idea of danger. Animals approach anything new with open curiosity, plants grow fruit to be taken, insects land on skin because contact has never meant harm. The Walker's passage gives paradise a second sun, and every creature receives the first contradiction its body has ever known: the world is safe, and the world says run. The disaster is not predation. It is the invention of prey. By the end, nothing hunts Eden Prime, but everything behaves as though it has always been hunted.

Threat verb: **startle**. Eden Prime attacks by turning harmless abundance into involuntary reaction. Its hazards begin as gentle, low-pressure opportunities (fruit to take, creatures to pass, light to use). They stay harmless until the world becomes *alarmed* — and the thing that alarms the world is the player's own greed. Taking gifts, drawing more than your base hand, and pushing high-Progress turns teach paradise to flinch, converting future generosity into tempo shocks: forced discard, returned hazards, top-decked threats, and Panic.

This spec targets a complete first implementation. Unlike `the-ember-orchard` and `city-of-sleeping-giants`, Eden Prime **does** take a bounded core-engine slice: it adds a general **applied-keyword** mechanism (a transient, runtime-applied keyword collection separate from authored keywords), with **Alarm** as its first instance, plus the effect primitives that drive it (apply-keyword, a keyword-presence gate, a progress gate, a keyword-removal, and a guard-granting effect). These are not an Eden-Prime-only subsystem; they generalize patterns the engine already has (`DealProgress.bonus.tag`, `CounterSpec`, `frozen`), and are authored to be reusable by future worlds (e.g. New Derelict's `Lockdown`). The brief's fuller "alarm chain that auto-spreads from hazard to hazard" is captured as deferred future work.

## Ratified decisions (2026-06-29)

Resolved with the user during the clarifying pass and folded into the requirements below:

- **Alarm is a transient keyword, gated triggers are a new general primitive (not existing-effects-only).** The user steered away from the pure no-core path: "We can add a new concept which prevents hazard trigger effects without some N keywords being present" and "a new concept, adding a temp keyword to cards ... or even adding a temp keyword as part of a draw action (player and world)." So the first implementation adds `Alarm` to the keyword vocabulary as a transient (turn-ticking) keyword, an effect to apply it, and a gate that conditions a hazard's trigger effect on the count of `Alarm`-bearing cards. This reuses the keyword + keyword-condition machinery rather than inventing a standalone Alarm subsystem.
- **Exclusive identity is the greed/generosity tax.** The player's own beneficial actions (taking a gift/reward, extra draw, high-Progress turns) are what apply Alarm and convert future world cards into threats. This is the authorship invariant that keeps `startle` distinct from `stir` (unresolved hazards recur) and `incubate` (delayed known cost). "Player cards that add world cards" is one tool; applying Alarm to drawn/added cards is the other.
- **Base art already exists and must be wired, not regenerated:** `eden-prime-reality.webp`, `intrusion-overlay.webp`, `eden-prime-cardfront.webp` are present under `src/game/assets/themes/eden-prime/`. Only the `insets/` directory and per-card insets remain to be authored.
- **Panic reuse:** "adds Panic" is expressed by adding the shared starter `Panic` template to the player deck (`AddPlayerCardToTop "Panic"` / `AddCard`), not a new card.
- **Stale-name guard:** the cataclysm brief's "initial implementation" suggestions are reference only. `AddWorldCardToTop` is authored as `AddWorldCardToDeck { bTop: true }`, and `ReturnWorldCards` is not used (inert and boon-signed on world auto-hooks), matching the sibling specs.

### Post-review resolutions (2026-06-29)

A fresh-context spec review found the Alarm primitives and three reward cards were specified in prose without buildable/testable shapes. Resolved here and folded into the requirements below:

- **The gate is no-op-only; it has no else-branch.** A keyword-presence gate runs its inner effect at/above threshold and does nothing below it. State-conditional two-arm branching is explicitly *not* added (the engine's only branch primitive, `Modal`, branches on player choice, not GameState). Cards that need "do A when calm, B when alarmed" are authored as `Sequence[ unconditional A, gate(...) -> B ]`.
- **Alarm is a number, applied with value 2, decaying 1 per turn-start tick** (so unprovoked Alarm lasts two turns). Tuning, but a concrete default so tests are writable.
- **Gate thresholds are concrete pre-playtest defaults**, not placeholders (see each card).
- **Apply-keyword targets are narrowed to two implementable forms:** "cards currently in hand" and "the next world card drawn" (the latter via a deferred GameState flag, modeled on `pendingForceDestroy`). The "tag the cards a prior Draw step just drew" target is dropped — `Sequence` cannot pipe a step's output — and is approximated by applying Alarm to the hand after drawing.
- **Alarm reduction is a named primitive, not the Brace model.** Two engine additions: `RemoveKeyword { keyword: "Alarm", target, amount }` (clears Alarm), and an `alarmGuard` charge (analogous to `braceCharges`) that absorbs the next Alarm-caused disruption. `Brace` is left as the `ForceDestroy`-only absorber it is.
- **`Follow the Shade` uses a fixed-template top-deck**, not a player-chosen hand card, to keep the core slice bounded (a chosen-hand-card move would need a new `TargetSpec` and `PlayCard` field). Flagged as a deliberate scope-narrowing; revisit if the agency loss hurts the card's identity.
- **The greed signal is tracked state.** `Flowers Face the Wrong Sun` reads a new `GameState.progressDealtThisTurn` (and the existing `turnPlayHistory`); this tracking field is part of the core-engine slice because the greed-tax identity depends on it.
- **`Alarm` requires a new optional field on both `PlayerCard` and `WorldCard`** (analogous to `PlayerCard.frozen`, which exists only on player cards today). The mint path and the Alarm-application event shape are part of the core slice. *(Generalized below: the field is the shared `appliedKeywords` collection, not an Alarm-named field.)*

### Plan-derived resolutions (2026-06-29)

Folded back from the implementation plan ([.lore/work/plans/eden-prime.md](../plans/eden-prime.md)) and a fresh-context plan review. These are normative and supersede the conflicting earlier wording above:

- **The transient field is a general `appliedKeywords?: readonly Keyword[]` on both card interfaces, not an `Alarm`-named field.** Alarm is the first applied keyword; the collection is general so future worlds reuse it. This supersedes the "field analogous to `PlayerCard.frozen`" / "the `Alarm` field" wording in REQ-EDEN-9/14/40/44 (same intent — transient numeric-lifetime instance state separate from authored keywords — generalized). An applied keyword's `value` is its lifetime; "Alarm-bearing" means an applied `Alarm` entry with `value > 0`.
- **`hasKeyword`/`keywordNames` union the authored `keywords` array and the `appliedKeywords` collection.** This makes `KeywordGate`, `CounterSpec.KeywordInHand` (REQ-EDEN-29), and `DealProgress.bonus.tag` recognize applied Alarm with no change to `resolveCounter`.
- **The `alarmGuard` charge is granted by a new `GainAlarmGuard { amount }` effect** (parallel to `Brace`). The charge is consumed inside `KeywordGate`: when a gate passes threshold and `alarmGuard > 0`, one guard is spent and the inner effect is suppressed.
- **`progressDealtThisTurn` is read by a new `ProgressGate { min, then }` effect** (parallel to `KeywordGate`, conditioning on `state.progressDealtThisTurn >= min`). Without it, REQ-EDEN-27's preferred greed-conditioned form is unimplementable, since the keyword/guard effects can only count cards, not read a `GameState` number. It does not consume `alarmGuard` (it is a greed signal, not an Alarm-caused disruption).
- **The full core-effect set is five:** `ApplyKeyword`, `KeywordGate`, `ProgressGate`, `RemoveKeyword`, `GainAlarmGuard`. This supersedes REQ-EDEN-14's literal three-effect list.
- **`firstWorldCardInHand` resolves by numeric id** (`parseInt(card.id, 10)`), not string comparison: ids are `String(nextId)`, so lexicographic order inverts at id ≥ 10 (`"10" < "2"`). This is a determinism contract and must be tested past 9 minted cards.
- **`Follow the Shade`'s fixed slow-step top-deck is a distinct named template** (`Tread Softly`), not the reward card itself (REQ-EDEN-20).

## World Contract

<div id="REQ-EDEN-1"></div>

**REQ-EDEN-1:** The world id must be `eden-prime` everywhere: `cards.json`, `meta.ts`, `theme.ts`, `index.ts`, registry entry, `VisualTheme.worldId`, asset keys, and asset binding imports.

<div id="REQ-EDEN-2"></div>

**REQ-EDEN-2:** Theme assets must live under `src/game/assets/themes/eden-prime/`. The existing base assets are canonical and must be wired, not regenerated by default:

- `eden-prime-reality.webp`
- `intrusion-overlay.webp`
- `eden-prime-cardfront.webp`

<div id="REQ-EDEN-3"></div>

**REQ-EDEN-3:** The implementation must add one inset asset per Eden Prime card under `src/game/assets/themes/eden-prime/insets/`, use an `eden-inset-*` key namespace, and register every referenced inset key in `src/game/worlds/assetBindings.ts` and `src/game/data/assetManifest.ts`.

<div id="REQ-EDEN-4"></div>

**REQ-EDEN-4:** The world must register through the existing `WorldDataBundle` and `worldDataRegistry` pattern. Do not add one-off theme selection, world building, or manifest code when registry derivation can carry the world.

## Narrative And Identity

<div id="REQ-EDEN-5"></div>

**REQ-EDEN-5:** The three-beat fiction is: an ordinary paradise valley with no concept of danger, the Walker's passage gives the sky a second sun and teaches the ecosystem to flinch, and the Door opens beneath two suns as paradise finishes its first lesson that every stranger is a predator.

<div id="REQ-EDEN-6"></div>

**REQ-EDEN-6:** The Walker, `Summon Door`, and `Door` remain shared starter templates. Eden Prime data must not redefine any of them.

<div id="REQ-EDEN-7"></div>

**REQ-EDEN-7:** The exclusive signature verb is `startle`: the player's own beneficial actions raise Alarm, and raised Alarm converts otherwise-harmless world cards into tempo shocks. Eden Prime reward cards may use draw, progress, bracing, and top-deck placement, but their identity must be "greed teaches paradise to flinch" and the matching restraint/pressure-valve, not Light, Heat, freezing, Spore scaling, concealment, incubation (delayed known cost), or stir (unresolved-hazard recurrence).

<div id="REQ-EDEN-8"></div>

**REQ-EDEN-8:** The catastrophe identity must appear in the Alarm mechanic, the gift/gated hazards, the greed-tax rewards, deck composition, display/help copy, visual theme, intrusion overlay, cardfront, and card insets. The world is not "monsters attack paradise"; it is "a world with no word for fear inventing one all at once, taught by the player's reach."

## The Alarm Mechanic (core-engine slice)

These requirements describe a small, general engine extension. Exact type names and storage representation are a design-phase decision; the **observable behavior** below is the contract.

<div id="REQ-EDEN-9"></div>

**REQ-EDEN-9:** Add `Alarm` to the engine keyword vocabulary (`KeywordName`) as the first **transient** keyword. Unlike the static keywords (`Obstructed`, `Creature`, `Slow`, `Spore`), `Alarm` is applied to a card instance at runtime and carries a numeric lifetime. This requires a new general optional field `appliedKeywords?: readonly Keyword[]` on **both** `PlayerCard` and `WorldCard` (a transient, runtime-applied keyword collection separate from the authored `keywords` array; see Plan-derived resolutions). `hasKeyword`/`keywordNames` must union the authored and applied sets so the existing counting machinery recognizes applied Alarm. The default applied value is **2** (the card stays alarmed for two turn-start ticks); this value is tuning but must have a concrete default so decay and threshold tests are writable.

<div id="REQ-EDEN-10"></div>

**REQ-EDEN-10:** Add a general **apply-keyword** effect (`ApplyKeyword { keyword, value, target }`) that places `Alarm` on cards. It must support exactly these four targets, all implementable today and all reading current state rather than a prior step's output:

- **`"hand"`** — cards currently in hand (applies immediately to matching cards in `state.hand`).
- **`"nextWorldCard"`** — the next world card drawn, via a deferred `GameState` flag modeled on `pendingForceDestroy` (set now, consumed and cleared in the draw handler).
- **`"self"`** — the world card whose hook is firing, available only where the engine has a `selfId` (`onEndOfTurn`/`onPartialClear`); used by `First Warning Cry` to alarm itself (REQ-EDEN-24).
- **`"firstWorldCardInHand"`** — the world card with the smallest mint-order `id` currently in hand, for deterministic targeting; used by REQ-EDEN-24/27. Resolve by numeric id (`parseInt(card.id, 10)`), **not** string comparison: ids are `String(nextId)`, so lexicographic order inverts at id ≥ 10 (`"10" < "2"`).

It must be deterministic and seedable (same seed plus same actions applies Alarm to the same card instances) and emit an event the renderer reads so applied Alarm is visible. Note: tagging "the cards a prior `Draw` step just drew" is intentionally **not** a target — `Sequence` cannot pipe a step's output — so the greed-on-draw loop is approximated by drawing and then applying Alarm to the hand. (New Derelict reuses these targets for `Lockdown` and adds none of its own — see `.lore/work/specs/new-derelict.md` REQ-DERELICT-9/15.)

<div id="REQ-EDEN-11"></div>

**REQ-EDEN-11:** Add a general **keyword-presence gate** (`KeywordGate { keyword, min, zone, then }`) that runs its inner `then` effect only when at least `min` cards bearing the keyword are present in `zone` (`"hand"` for this world), and is a **no-op otherwise**. The gate has no else-branch: state-conditional two-arm branching is explicitly out of scope (the engine's only branch primitive, `Modal`, branches on player choice, not GameState). A card that must do one thing when calm and another when alarmed is authored as `Sequence[ unconditional-calm-effect, KeywordGate(...) -> alarmed-effect ]`. The gate generalizes the existing keyword-conditioned patterns (`DealProgress.bonus.tag`, `CounterSpec`) from additive scaling to conditional execution, and is the mechanical core of `startle`.

<div id="REQ-EDEN-11a"></div>

**REQ-EDEN-11a:** Add the Alarm pressure-valve primitives the reward kit depends on (the `Brace` model does not apply — `Brace` only absorbs `ForceDestroy`): `RemoveKeyword { keyword: "Alarm", target, amount }` which clears Alarm from up to `amount` cards in the target zone, and an `alarmGuard` charge on `GameState` (analogous to `braceCharges`) granted by a new `GainAlarmGuard { amount }` effect (parallel to `Brace`) that absorbs the next Alarm-caused disruption (consumed inside `KeywordGate`: a gated startle is suppressed and one guard is consumed instead). All are deterministic and emit events.

<div id="REQ-EDEN-12"></div>

**REQ-EDEN-12:** Alarm must have a defined, deterministic **clearing rule** so restraint calms the world and the run is not an unconditional snowball. The rule: each card's `Alarm` value decays by one at each turn-start tick (mirroring `frozen`) and the keyword is removed at zero; in addition, the valve rewards (REQ-EDEN-18/19/21) clear or suppress Alarm via REQ-EDEN-11a. The decay rate and applied value are tuning; the existence of both passive decay and player-driven valves is not.

<div id="REQ-EDEN-12a"></div>

**REQ-EDEN-12a:** Add `GameState.progressDealtThisTurn: number` (reset at turn start, incremented on every `DealProgress`/`DealProgressAll`/scaled-progress resolution via the shared `dealProgress()` choke point) so `Flowers Face the Wrong Sun` (REQ-EDEN-27) can read a concrete greed signal. The reader is a new `ProgressGate { min, then }` effect (parallel to `KeywordGate`) that runs `then` only when `progressDealtThisTurn >= min`. This field and effect are part of the core-engine slice and default to a no-op everywhere (written but read only by Eden Prime).

<div id="REQ-EDEN-13"></div>

**REQ-EDEN-13:** The Alarm primitives must be world-agnostic, not Eden-Prime special cases. They are structural no-ops in every world that never applies Alarm: with no `ApplyKeyword` effect authored, no card ever bears `Alarm`, so every `KeywordGate` evaluates `count == 0 < min` and does nothing, decay has nothing to tick, and `progressDealtThisTurn`/`alarmGuard` are written but unread. State and event streams must be byte-identical to before the slice for all other worlds. This mirrors how Light, Heat, and the end-turn passive stay inert outside their owning worlds.

<div id="REQ-EDEN-14"></div>

**REQ-EDEN-14:** The core-engine slice adds exactly: the `Alarm` keyword, the general `appliedKeywords` field on both card interfaces, the five effects `ApplyKeyword`, `KeywordGate`, `ProgressGate`, `RemoveKeyword`, `GainAlarmGuard`, the `alarmGuard` charge, `progressDealtThisTurn`, and their handlers/events. Eden Prime must not introduce a second new keyword or a timer system beyond Alarm. The brief's auto-spreading "alarm chain" (Alarm jumping hazard-to-hazard on its own each time the player draws/discards/over-spends) is explicitly deferred; the shipped version spreads Alarm only through authored card effects.

<div id="REQ-EDEN-15"></div>

**REQ-EDEN-15:** `worldThreatTemplateByWorldId` must map `eden-prime` to its act-3 signature threat (REQ-EDEN-29) so `AddThreatToWorldDeck` repeats the Eden Prime signature threat.

## Reward Card Recipe (greed/generosity tax)

The following numbers are initial tuning. Costs, counts, and exact values may change during playtest as long as the roles remain intact.

<div id="REQ-EDEN-16"></div>

**REQ-EDEN-16:** Eden Prime reward cards must split into two opposed families: **greed** cards that give strong immediate tempo and raise Alarm, and **restraint/valve** cards that are weak on a calm board and strong when Alarm is high. The tension of the world is choosing between them turn to turn.

<div id="REQ-EDEN-17"></div>

**REQ-EDEN-17:** `Take the Fruit` must be a greed reward: strong immediate tempo that teaches paradise to anticipate the player's reach. Initial effect: `Sequence` of `Draw player 2` and `ApplyKeyword { keyword: "Alarm", value: 2, target: "nextWorldCard" }`. Its role is greed with a known Alarm cost on the next hazard the world reveals.

<div id="REQ-EDEN-18"></div>

**REQ-EDEN-18:** `Gentle Approach` must be a measured-clear reward that clears the alarmed card without letting the flinch propagate. Initial effect: `Sequence` of `DealProgress base 3` and `RemoveKeyword { keyword: "Alarm", target: "hand", amount: 1 }`. Its role is removing Alarm from the board as it pushes progress.

<div id="REQ-EDEN-19"></div>

**REQ-EDEN-19:** `Stillness Lesson` must be a restraint valve: `exhaust: true`, granting one `alarmGuard` charge (REQ-EDEN-11a) that absorbs the next Alarm-caused disruption. It must be weak when the board is calm and excellent when the ecosystem is about to chain. It must use the `alarmGuard` primitive, not `Brace` (which only absorbs `ForceDestroy`, whereas the Alarm disruptions here are `DiscardThenDraw`, Panic, and top-deck recurrence).

<div id="REQ-EDEN-20"></div>

**REQ-EDEN-20:** `Follow the Shade` must be a slow-and-survive reward expressing "the player survives by moving slowly enough that the world can predict them without panicking." Initial effect: `Sequence` of `AddPlayerCardToTop { template: "Tread Softly" }` (a distinct named slow-step player template authored in `allCards.json`, **not** the reward card itself) and a small `Heal 2`. *(Scope decision 2026-06-29: uses a fixed-template top-deck rather than a player-chosen hand card, which would require a new `TargetSpec` and `PlayCard` field beyond the Alarm core slice. Revisit if the fixed template weakens the card's identity.)* It must not duplicate Tidal's discard-recall identity.

<div id="REQ-EDEN-21"></div>

**REQ-EDEN-21:** `Hush the Valley` must be the cluster/late answer: it clears Alarm across the board and applies modest pressure. Initial effect: `Sequence` of `DealProgressAll base 1` and `RemoveKeyword { keyword: "Alarm", target: "hand", amount: 3 }`, `exhaust: true`. It is the panic-cluster pressure valve in Act 3.

<div id="REQ-EDEN-22"></div>

**REQ-EDEN-22:** No effect is off-limits to Eden Prime, but its reward cards must not build their *main identity* on a mechanic that is another world's signature (see "No mechanic is exclusive; identity is" in `.lore/reference/theme-authoring.md`). The startle/greed-tax identity must not read as Light, the Heat/freeze suite, `DealProgressScaled` (overgrown-mall), `Concealed`/`Spore`, or the Tidal discard recalls (`ReturnPlayerDiscardToTop`/`RecallPlayerDiscard`). Incidental use of a shared effect as a supporting tool is permitted as long as it is not the card's identity. Note the genuine couplings still make some of these poor fits regardless of intent: authoring a `Concealed` hazard would require a `GainLight` source (pulling in the Fog identity), and the Heat/freeze/thaw suite is a unit.

## World Card Recipe

<div id="REQ-EDEN-23"></div>

**REQ-EDEN-23:** `Fruit Offered Too Quickly` must be the act-1 gift hazard. Initial shape: cost 2, `Obstructed`, discardable, `onCleared: Sequence` of a generous grant (`GainEnergy 1` or `Draw player 1`) and an apply-`Alarm` to the next world card; `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: None`. Taking the gift is what teaches paradise to flinch.

<div id="REQ-EDEN-24"></div>

**REQ-EDEN-24:** `First Warning Cry` must be the cheap Alarm-seeder. Initial shape: cost 1, discardable, does no damage by itself; `onEndOfTurn: Sequence` of `ApplyKeyword { keyword: "Alarm", value: 2, target: "self" }` (it alarms itself) and `KeywordGate { keyword: "Alarm", min: 2, zone: "hand", then: ApplyKeyword { keyword: "Alarm", value: 2, target: "firstWorldCardInHand" } }`. Once it is alarmed and at least one other alarmed card is present, the cry spreads. Because it alarms only *itself* on a quiet board, a player who clears or discards it keeps Alarm at zero — leaving it uncleared is the neglect that wakes the valley (see REQ-EDEN-31). "First world card in hand" means the world card with the smallest mint-order `id` currently in hand, for deterministic targeting.

<div id="REQ-EDEN-25"></div>

**REQ-EDEN-25:** `Curious Swarm` must be the act-1/2 timing-disruption creature. Initial shape: cost 3, `Creature`, discardable; `onEndOfTurn: KeywordGate { keyword: "Alarm", min: 2, zone: "hand", then: DiscardThenDraw player 2 }` (startled swarm scrambles the hand); `onPartialClear: KeywordGate { ..., min: 2, then: ForceDestroy 1 }`. Harmless interference until the world is alarmed, then a tempo shock.

<div id="REQ-EDEN-26"></div>

**REQ-EDEN-26:** `The Herd Misunderstands` must be the act-2 stampede blocker. Initial shape: cost 4, `Slow`, discardable; `onPartialClear: KeywordGate { keyword: "Alarm", min: 2, zone: "hand", then: AddWorldCardToDeck { template: "The Herd Misunderstands", bTop: true } }` (the stampede loops back through the valley); `onEndOfTurn: KeywordGate { ..., min: 3, then: AddPlayerCardToTop "Panic" }`. Slow and difficult to clear; recurrence is gated on Alarm, distinguishing it from `stir`.

<div id="REQ-EDEN-27"></div>

**REQ-EDEN-27:** `Flowers Face the Wrong Sun` must be the act-2 momentum-reader, reading the player's tempo as weather. Initial shape: cost 3, `Obstructed`, discardable; `onCleared: None`; `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: ProgressGate { min: 5, then: ApplyKeyword { keyword: "Alarm", value: 2, target: "firstWorldCardInHand" } }` — when `progressDealtThisTurn >= 5` (i.e. more than 4), apply `Alarm` to the first world card in hand; otherwise no-op. It is the engine that punishes high-Progress turns. The `ProgressGate` reader (REQ-EDEN-12a) makes this greed-conditioned form the shipped one, preserving the "greed, not time" invariant.

<div id="REQ-EDEN-28"></div>

**REQ-EDEN-28:** `The Quiet Grove` must be the tool-fetch hazard. Initial shape: cost 6, `Obstructed`, discardable; `onCleared: OfferBoon { setId: "pool-eden-grove", setName: "The Quiet Grove", offeredCount: 3, chooseCount: 1 }` over the reward kit (`Take the Fruit`, `Gentle Approach`, `Stillness Lesson`, `Follow the Shade`, `Hush the Valley`); `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: KeywordGate { keyword: "Alarm", min: 2, zone: "hand", then: AddWorldCardToDeck { template: "Curious Swarm", bTop: true } }`. Mirrors the `Hatchery Cellar` / `Surveyors Mark A Pulse` boon-fetch pattern (a boon choice, not a multi-card dump).

<div id="REQ-EDEN-29"></div>

**REQ-EDEN-29:** `Paradise Runs` must be the act-3 signature threat (the moment every living thing has learned a different version of fear). Initial shape: cost 6, `Creature` and `Slow`, discardable only with a high penalty; `onCleared: GainCard "Hush the Valley"`; `onDiscarded: ForceDestroy 2`; `onPartialClear: KeywordGate { keyword: "Alarm", min: 2, zone: "hand", then: AddWorldCardToDeck { template: "Curious Swarm", bTop: true } }`; `onEndOfTurn: Sequence` of `DamageScaled { base: 2, per: { kind: "KeywordInHand", keyword: "Alarm" }, amount: 1 }` and `AddThreatToWorldDeck`. The non-zero `base: 2` guarantees genuine HP pressure so loss stays a fail state even on a calm board, while the Alarm scaling makes greed actively lethal here.

<div id="REQ-EDEN-30"></div>

**REQ-EDEN-30:** Every Eden Prime world card must define `onDiscarded`, `onCleared`, `onPartialClear`, and `onEndOfTurn`. Use `{ "kind": "None" }` for unused hooks.

<div id="REQ-EDEN-31"></div>

**REQ-EDEN-31:** At least one early hazard must be low-damage or no-damage when discarded, and the player must not be soft-locked before the reward kit appears: a player who keeps Alarm low must be able to pass Act 1 hazards as the gentle, harmless cards they start as. Greed, not time, is what makes Eden Prime dangerous. "Restraint" is defined concretely as: declining gifts (discarding gift hazards rather than clearing them for reward), not over-drawing, keeping `progressDealtThisTurn` modest, and clearing or discarding the cheap `First Warning Cry` so it cannot seed Alarm. Leaving a hazard uncleared is itself a form of neglect that can raise Alarm; this is consistent with the invariant because clearing/discarding is the always-available restrained action.

## Deck Composition

<div id="REQ-EDEN-32"></div>

**REQ-EDEN-32:** The deck must have exactly three acts expressing the three-act escalation. Act 1 (Open Hands): gifts and gentle reactions, the player learns receiving a gift can frighten the giver. Act 2 (The Flinch Spreads): cleared hazards return as startled herds/swarms, extra draw and discard begin spreading Alarm. Act 3 (Paradise Runs): Alarm triggers in clusters, the signature threat repeats, and the Walker arrives beneath two suns.

<div id="REQ-EDEN-33"></div>

**REQ-EDEN-33:** Initial act composition should be:

| Act | Cards |
| --- | --- |
| Act 1 - Open Hands | `Fruit Offered Too Quickly` x3, `First Warning Cry` x2, `The Quiet Grove` x2 |
| Act 2 - The Flinch Spreads | `Curious Swarm` x3, `The Herd Misunderstands` x2, `Flowers Face the Wrong Sun` x2, `The Quiet Grove` x1 |
| Act 3 - Paradise Runs | `Curious Swarm` x2, `The Herd Misunderstands` x2, `Paradise Runs` x2, `The Walker` x1 |

Counts are tuning values; act roles and the fixed Walker closer are not.

<div id="REQ-EDEN-34"></div>

**REQ-EDEN-34:** Act 3 must always end with exactly one `{ "templateId": "The Walker", "count": 1 }`.

<div id="REQ-EDEN-35"></div>

**REQ-EDEN-35:** The deck must introduce `The Quiet Grove` early enough that the player can learn the greed/restraint reward kit before clustered Alarm pressure arrives. If playtest shows the kit appears too late, increase `The Quiet Grove` count in Act 1 rather than weakening Act 3 first.

## Visual Theme

<div id="REQ-EDEN-36"></div>

**REQ-EDEN-36:** The visual keynote is gentle paradise green pierced by an impossible violet-white second sun. Suggested values: `intrusionHue` in violet-white (the doubled sun), door glow tint matching, warm progress accents in garden gold-green, danger/destruction accents warm, return/retreat accents cool — keeping the stable semantic color roles (V2).

<div id="REQ-EDEN-37"></div>

**REQ-EDEN-37:** The reality backdrop must remain the gentle green valley: terraced garden structures grown into cliffs, clear water, flowering plants, offered fruit, curious birds and insects, and long-necked grazers that do not know how to run.

<div id="REQ-EDEN-38"></div>

**REQ-EDEN-38:** The intrusion overlay must transform those exact edge elements into the First Alarm as an irregular perimeter frame while preserving central play readability: a second sun intruding from an upper corner casting doubled, conflicting shadows; grazers becoming the first confused stampede; foreground fruit splitting early and dropping seed and pollen; birds and insects bending into startled spiral flight; flowers and terrace vines recoiling from the play area toward the violet-white glare; and repeated footprint shapes, tremor lines, and forked shadow geometry carried through water, leaves, and path edges. It must read as the same paradise misinterpreting its own abundance, not a separate disaster pasted over it.

<div id="REQ-EDEN-39"></div>

**REQ-EDEN-39:** The cardfront must read as paradise material under the doubled sun: garden green, fruit, vine, water, and feather, cut by violet-white second-sun light and forked shadow. Runtime text must remain readable at card scale.

<div id="REQ-EDEN-40"></div>

**REQ-EDEN-40:** Card insets must make the startle identity legible. Hazard insets should show gifts that are about to turn (low fruit, curious swarm, gentle herd, flowers facing the wrong sun, a bird mid-cry). Reward insets should show restraint and measured reach (a careful hand, stillness, walking in shade, hushing the valley). Insets should distinguish a card's calm face from its alarmed reading where the art allows.

## Display And Help

<div id="REQ-EDEN-41"></div>

**REQ-EDEN-41:** `meta.ts` display copy must describe the place-vs-disaster contrast: a paradise with no concept of danger that learns to flinch from the player's own hand after the Walker gives it a second sun.

<div id="REQ-EDEN-42"></div>

**REQ-EDEN-42:** Help text must fit the existing world help budget and cover: hazards are harmless until the world is *alarmed*; the player's own greed (taking gifts, extra draw, high-Progress turns) raises Alarm; alarmed hazards force discard, return, top-deck, and add Panic; Alarm decays when the player shows restraint; and `Gentle Approach` / `Stillness Lesson` / `Hush the Valley` are the pressure valves.

## Documentation

<div id="REQ-EDEN-43"></div>

**REQ-EDEN-43:** `.lore/reference/theme-authoring.md` must be updated when this world is implemented: add Eden Prime to the signature verb table (verb `startle`, reward implication "greed raises Alarm; restraint/valve cards spend it"), add `Alarm` to the keyword vocabulary (C2) noting it is the first transient keyword, document the apply-keyword and keyword-gate effects in the effect vocabulary (C1) as general primitives Eden Prime introduced, and note Eden Prime owns the greed-tax startle reward space.

<div id="REQ-EDEN-44"></div>

**REQ-EDEN-44:** Any implementation plan derived from this spec must split the work into at least four reviewable slices, each carrying its own tests (tests are not deferred to a final slice): (1) the **core-engine Alarm slice** — `Alarm` keyword, the general `appliedKeywords` field on `PlayerCard` and `WorldCard`, `ApplyKeyword` (with its `"hand"`, `"nextWorldCard"` deferred-flag, `"self"`, and `"firstWorldCardInHand"` targets), `KeywordGate`, `ProgressGate`, `RemoveKeyword`, `GainAlarmGuard` + the `alarmGuard` charge, `GameState.progressDealtThisTurn`, handlers, events, and the determinism/threshold/decay/no-op tests of REQ-EDEN-45; (2) world data and registration; (3) assets/presentation/help; (4) full conformance and seeded gameplay validation. The core slice must land and be green before the world data depends on it.

## Tests And Validation

<div id="REQ-EDEN-45"></div>

**REQ-EDEN-45:** Core-engine tests must cover the Alarm primitives independent of Eden Prime: `ApplyKeyword` places `Alarm` (value 2) deterministically on the intended cards for all four targets (`"hand"`, the `"nextWorldCard"` deferred-flag target consumed on the next world draw, `"self"`, and `"firstWorldCardInHand"` resolving to the smallest mint-order id **including a board with ≥ 10 minted cards to catch string-vs-numeric id ordering**) and emits an event; `KeywordGate` and `ProgressGate` run their inner effect at and above `min` and are a no-op below it (boundary tested at `min-1`, `min`, `min+1`); `RemoveKeyword`, `GainAlarmGuard`, and gate-consumption clear/absorb Alarm deterministically; Alarm decays by one per turn-start tick (in the fixed turn-start order) and the keyword is removed at zero; and a world that applies no Alarm produces byte-identical state and events to before the slice (the no-op guarantee, including `progressDealtThisTurn` and `alarmGuard` being written-but-unread).

<div id="REQ-EDEN-46"></div>

**REQ-EDEN-46:** World-data tests must verify no duplicate template ids, all Eden Prime world cards define all required hooks, all keywords are valid (including the new `Alarm`), Act 3 ends with `The Walker`, the Eden Prime bundle is in `worldDataRegistry`, the `eden-prime` threat mapping resolves, and `buildWorld("eden-prime")` succeeds.

<div id="REQ-EDEN-47"></div>

**REQ-EDEN-47:** Effect/data tests must cover the shipped startle patterns: `Take the Fruit` raises Alarm; `Curious Swarm` and `The Herd Misunderstands` do nothing on a calm board and fire (`DiscardThenDraw` / top-deck recurrence / Panic) once Alarm crosses the threshold; `Flowers Face the Wrong Sun` raises Alarm on a greedy turn; `The Quiet Grove` `onCleared` creates a boon offer from `pool-eden-grove`; `Gentle Approach` / `Stillness Lesson` / `Hush the Valley` reduce or absorb Alarm; and `Paradise Runs` keeps real HP pressure through `AddThreatToWorldDeck`.

<div id="REQ-EDEN-48"></div>

**REQ-EDEN-48:** Asset validation must verify every `eden-inset-*` key plus `eden-prime-cardfront`, `eden-prime-bg`, and `eden-prime-overlay` has a matching binding in both `assetBindings.ts` and `assetManifest.ts` and loads without falling back to starter art.

<div id="REQ-EDEN-49"></div>

**REQ-EDEN-49:** Presentation tests or a smoke run must verify `selectTheme("eden-prime")` returns the Eden palette, backdrop, intrusion overlay, and cardfront, that a representative Eden world card renders with its inset, and that applied Alarm is visible on a card.

<div id="REQ-EDEN-50"></div>

**REQ-EDEN-50:** A seeded gameplay test must demonstrate the greed-tax identity end to end: a restrained line (decline gifts by discarding gift hazards, clear/discard `First Warning Cry`, no extra draw) keeps Alarm at zero and passes Act 1 hazards as harmless, while a greedy line (clear gifts for reward, play `Take the Fruit`, over-draw) raises Alarm past `min: 2` and causes the same hazards to startle into `DiscardThenDraw`, top-decked `Curious Swarm`, and Panic.

## AI Validation

An AI implementing this spec should verify completion by running or observing:

1. `bun run test` passes.
2. A core-engine test confirms the Alarm keyword, apply-keyword effect, and gate effect are deterministic, threshold-correct at the `N-1/N/N+1` boundary, decay per turn, and are a no-op (byte-identical state/events) in worlds that never apply Alarm.
3. A world-data test confirms `buildWorld("eden-prime")`, registry inclusion, unique template ids, valid hooks, valid keywords including `Alarm`, the `eden-prime` threat mapping, and the Walker closer.
4. An effect test confirms a calm board leaves gated hazards inert while a greedy line raises Alarm and triggers them, and that the valve rewards reduce or absorb Alarm.
5. Asset validation confirms all `eden-inset-*` keys and the base Eden Prime image keys are registered and preloadable.
6. A local game smoke test can start or select `eden-prime`, take a gift / over-draw to raise Alarm, observe a previously-harmless hazard startle, then use a valve reward to calm the board.
7. A visual smoke test confirms the paradise backdrop, second-sun intrusion overlay, and cardfront render without obscuring the central play area or card text, and that Alarm is legible on cards.
