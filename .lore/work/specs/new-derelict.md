---
title: New Derelict world
date: 2026-06-29
status: draft
tags: [world-design, new-derelict, isolate, lockdown, persistent-modifier, effective-cost, deck-pressure, core-engine, art-direction]
modules: [world-data, themes, game-view, core-engine]
related: [.lore/reference/worlds/authoring/theme-authoring.md, .lore/reference/direction/visual-direction.md, src/game/assets/themes/README.md, src/game/assets/themes/new-derelict/CATACLYSM.md, .lore/work/specs/eden-prime.md, .lore/work/specs/effective-card-modifiers.md, .lore/work/specs/city-of-sleeping-giants.md]
req-prefix: DERELICT
---

# New Derelict world

New Derelict is a working starship when the player arrives: shift schedules, supply crates, admin desks, crew-mess traffic, officers too busy to ask why a stranger is on Deck 7. The Walker's passage does not tear the ship open. It convinces the ship that the disaster has already happened. The first alarms are procedural: a bulkhead seals because a checklist says it should, gravity flickers because emergency allocation prefers the spine, the captain begins an announcement and never reaches the verb. The crew keeps following training while the vessel, still intact and pressurized and full of living people, begins preserving a future wreck instead of the present crew. The disaster is not damage. It is protocol without context: a derelict in advance of its own ruin.

Threat verb: **isolate**. New Derelict attacks by cutting planned routes into sealed compartments. Its hazards do not (mainly) deal HP damage; they **seal** cards under **Lockdown**, and the more compartments are sealed, the more Progress it costs to reopen any one of them. The pressure is tempo spent reopening paths that were safe a turn ago, and the central question each turn is: *do I spend Progress restoring access now, or use the emergency system before it locks me on the wrong side of my own plan?* The ship is not a monster and its crew are not enemies; the pressure comes from automated safety logic making individually reasonable decisions that combine into a survival maze.

This spec targets a complete first implementation. Like `eden-prime`, New Derelict **does** take a bounded core-engine slice, but it is layered on top of Eden Prime's: it **reuses** the Eden Prime keyword primitives (`ApplyKeyword`, `RemoveKeyword`, `KeywordGate`, the runtime-applied keyword field, the `KeywordInHand` counter) and adds exactly one new general concept on top of them: a **persistent, keyword-conditioned effective-cost modifier** on world cards (the "+1 to clear per other Locked card" rule), surfaced in a card's hook list as a `persistent` line alongside `onCleared` / `onEndOfTurn`. The brief's fuller "sealed marker attached to a deck position" and a full linked-emergency release graph are captured as deferred future work.

## Ratified decisions (2026-06-29)

Resolved with the user during the clarifying pass and folded into the requirements below:

- **Lockdown is built on the Eden Prime keyword primitives, plus a new persistent cost-modifier concept.** The user chose "reuse Eden Prime primitives + sealed semantics" over both the no-core path (express Lockdown loosely with existing top-deck/return effects, which risks `isolate` collapsing into `stir`) and a full bespoke sealed-marker subsystem. New Derelict therefore **depends on the Eden Prime core slice landing first** (REQ-DERELICT-9, REQ-DERELICT-44).
- **The signature is a persistent cost modifier, not an unplayable wall.** Per the user: "a persistent effect on the card that is '+1 cost / other "locked" cards'. This keeps the new mechanics down ... just a new concept of 'modifier' ... would show up in the list like the 'onclear'/'onendturn' effects as 'persistent' or something." So Lockdown does not freeze a card out of play; it raises the **effective Progress cost to clear** a sealed world card by `+1 per other Locked card`. A lone seal is cheap; a cluster of seals makes each door progressively expensive.
- **Sealed = gated clear (extra Progress), not pinned-to-top and not frozen-unplayable.** The user picked "gated clear (needs extra Progress)." The persistent cost modifier *is* the gate: a Locked hazard can still be cleared, but it costs more, and clearing a *linked* emergency that strips Lockdown (`RemoveKeyword`) is the alternative release path. This keeps `isolate` distinct from `displace` (deck-order recall), `stir` (top-deck recurrence), `incubate` (delayed known cost), and `startle` (greed converts harmless to harmful).
- **Lockdown persists; it does not decay per turn.** Unlike Eden Prime's `Alarm` (transient, decays one per turn-start tick), `Lockdown` stays until the player spends the elevated Progress to clear the card or a reward/linked-clear removes it. This is the mechanical heart of "derelict before impact": seals accumulate.
- **Base art already exists and must be wired, not regenerated:** `new-derelict-reality.webp`, `intrusion-overlay.webp`, `new-derelict-cardfront.webp` are present under `src/game/assets/themes/new-derelict/`. Only the `insets/` directory and per-card insets remain to be authored.
- **Art direction is now a shipping constraint, not polish.** The base New Derelict images already exist and should not be regenerated by default mid-implementation, but they must be reviewed against the shared theme art direction (`src/game/assets/themes/README.md`) before the asset/presentation slice is accepted. If an existing base asset fails the art-direction contract, retouch/regenerate only that asset and keep the same asset key and binding path. The still-missing inset set must be authored with a New-Derelict-specific `src/game/assets/themes/new-derelict/insets/README.md` before or alongside the image files.
- **Panic reuse:** "adds Panic" is the shared starter `Panic` template added to the player deck (`AddPlayerCardToTop "Panic"` / `AddCard`), not a new card.
- **Stale-name guard:** the cataclysm brief's "initial implementation" suggestions are reference only. `AddWorldCardToTop` is authored as `AddWorldCardToDeck { bTop: true }`; `ReturnWorldCards` is not used (inert and boon-signed on world auto-hooks); the brief's `Hidden` hazard (`Administrative Misfile`) is authored as `Obstructed`.

## World Contract

<div id="REQ-DERELICT-1"></div>

**REQ-DERELICT-1:** The world id must be `new-derelict` everywhere: `cards.json`, `meta.ts`, `theme.ts`, `index.ts`, registry entry, `VisualTheme.worldId`, asset keys, and asset binding imports.

<div id="REQ-DERELICT-2"></div>

**REQ-DERELICT-2:** Theme assets must live under `src/game/assets/themes/new-derelict/`. The existing base assets are canonical inputs and must be wired first, not regenerated by default mid-implementation:

- `new-derelict-reality.webp`
- `intrusion-overlay.webp`
- `new-derelict-cardfront.webp`

Before the asset/presentation slice is accepted, each base asset must be reviewed against the shared theme art direction. If one fails the contract, replace or retouch that asset in place while preserving the existing key/binding name so already-landed wiring does not churn.

<div id="REQ-DERELICT-3"></div>

**REQ-DERELICT-3:** The implementation must add one inset asset per New Derelict card under `src/game/assets/themes/new-derelict/insets/`, use a `derelict-inset-*` key namespace, and register every referenced inset key in `src/game/worlds/assetBindings.ts` and `src/game/data/assetManifest.ts`. The same directory must include `src/game/assets/themes/new-derelict/insets/README.md` with the New Derelict inset art style, prompt template, filename/key list, finishing pass, and thumbnail validation notes.

<div id="REQ-DERELICT-4"></div>

**REQ-DERELICT-4:** The world must register through the existing `WorldDataBundle` and `worldDataRegistry` pattern. Do not add one-off theme selection, world building, or manifest code when registry derivation can carry the world.

## Narrative And Identity

<div id="REQ-DERELICT-5"></div>

**REQ-DERELICT-5:** The three-beat fiction is: an ordinary working starship mid-shift with ambient unease, the Walker's passage convinces the ship that abandonment has already happened so its own safety systems begin sealing the vessel around the still-living crew, and the Door opens through a ship that has not exploded or lost atmosphere but has already decided it cannot be saved.

<div id="REQ-DERELICT-6"></div>

**REQ-DERELICT-6:** The Walker, `Summon Door`, and `Door` remain shared starter templates. New Derelict data must not redefine any of them.

<div id="REQ-DERELICT-7"></div>

**REQ-DERELICT-7:** The exclusive signature verb is `isolate`: hazards seal cards under `Lockdown`, and the **effective cost to reopen a sealed card rises with the size of the seal cluster**. New Derelict reward cards may use draw, progress, bracing, top-deck placement, and boon offers, but their identity must be "restoring access versus spreading it" — clearing Lockdown, declining shortcuts that seal new doors, or paying tempo to reopen routes — not Light, Heat, freezing, Spore scaling, concealment, incubation (delayed known cost), stir (unresolved-hazard top-deck recurrence), displace (discard/deck-order recall), or startle (greed converting harmless cards to harmful).

<div id="REQ-DERELICT-8"></div>

**REQ-DERELICT-8:** The catastrophe identity must appear in the Lockdown mechanic, the sealing hazards, the access-restoration rewards, deck composition, display/help copy, visual theme, intrusion overlay, cardfront, and card insets. The world is not "the crew turns hostile"; it is "a working ship's own safety logic rehearsing abandonment, sealing the player into a maze of its own emergency procedures."

## The Lockdown Mechanic (core-engine slice, layered on Eden Prime)

These requirements describe a small engine extension that **reuses** the Eden Prime keyword slice and adds one new general concept. Exact type names and storage representation are a design-phase decision; the **observable behavior** below is the contract.

<div id="REQ-DERELICT-9"></div>

**REQ-DERELICT-9:** This world depends on the Eden Prime core-engine slice (`.lore/work/specs/eden-prime.md`, REQ-EDEN-9..14): the runtime-applied keyword field on `PlayerCard` and `WorldCard`, `ApplyKeyword` (including its `"hand"`, `"nextWorldCard"`, `"self"`, and `"firstWorldCardInHand"` targets), `RemoveKeyword`, `KeywordGate`, and the `KeywordInHand` counter. New Derelict must reuse those primitives rather than re-implement a parallel Lockdown subsystem. If the Eden Prime slice has not landed when New Derelict is implemented, the Eden Prime primitives are a prerequisite slice and must land and be green first.

<div id="REQ-DERELICT-10"></div>

**REQ-DERELICT-10:** Add `Lockdown` to the engine keyword vocabulary (`KeywordName`) as a **persistent** runtime-applied keyword. Unlike Eden Prime's `Alarm` (which decays one per turn-start tick), `Lockdown` does not decay: once applied it remains on the card instance until explicitly removed (by `RemoveKeyword`, or implicitly when the card leaves play). It is applied at runtime via `ApplyKeyword { keyword: "Lockdown", target }` and must be countable by `KeywordInHand` and gateable by `KeywordGate`, identically to `Alarm`. `Lockdown` does not require a numeric value (presence is the state); the design may model it as a bare keyword.

<div id="REQ-DERELICT-11"></div>

**REQ-DERELICT-11:** Add a new general **persistent effective-cost modifier** on world cards — the "persistent" hook the design calls for, sitting in the card's hook/effect list alongside `onCleared`, `onPartialClear`, `onDiscarded`, and `onEndOfTurn`. It is an optional world-card field (default absent / no-op) that declares an ongoing adjustment to the card's **effective clear cost** while a keyword condition holds. The v1 vocabulary must support exactly: "while this card bears `Lockdown`, add `+1` to its effective clear cost for each *other* card bearing `Lockdown` in hand" (i.e. effective extra cost `= max(0, lockdownCountInHand - 1)`). A lone Locked card pays no tax; a cluster of `k` Locked cards makes each Locked card cost `+(k-1)` to clear. This is the mechanical core of `isolate`.

Exact type names are a design-phase decision, but the card JSON needs a concrete authoring shape so world data can be written and `buildWorld` verified (REQ-DERELICT-46). Candidate field on the world-card source (final name to be resolved in the design doc before authoring): `"persistentModifier": { "kind": "ClearCostPerKeyword", "keyword": "Lockdown", "costPerOther": 1 }`, defaulting to absent (no-op). Cards in REQ-DERELICT-23/25/27/29 that "carry the persistent Lockdown cost modifier" author this field.

<div id="REQ-DERELICT-12"></div>

**REQ-DERELICT-12:** Add an **effective world-card cost** read-model derivation analogous to `effectivePlayerCard` (`.lore/work/specs/effective-card-modifiers.md`): a pure function deriving a world card's current effective clear cost from the base card, its persistent modifier, and `GameState`. It must not mutate the durable card objects in any zone, must return the base cost when no persistent modifier applies, and must be deterministic and seedable. `availableActions` (clear affordability and legal targets), targeting, target/clear previews, connector styling, and the reducer's clear resolution must all agree on the effective cost — the player must never see one number and pay another. (This mirrors REQ-CARDMOD-22..24/-30 for world-card clear cost.)

<div id="REQ-DERELICT-13"></div>

**REQ-DERELICT-13:** Lockdown must have a defined, deterministic **release rule** so paying tempo or clearing a linked emergency reopens access and the run is not an unconditional snowball. Release paths: (a) clearing the sealed card itself by paying its elevated effective cost; (b) a reward/valve card that runs `RemoveKeyword { keyword: "Lockdown", target, amount }`; (c) a hazard whose `onCleared` strips `Lockdown` from linked cards. There is no passive per-turn decay — restoring access is always a deliberate action, which is the point of `isolate`.

Zone note: in this world Lockdown lives on **world** cards, so `RemoveKeyword { keyword: "Lockdown", target: "hand" }` (REQ-DERELICT-18/19) must operate over `GameState.hand` as the combined play zone (which holds both player and world cards) and strip Lockdown from the world cards there. A player-card-only `RemoveKeyword` would make the release valves no-ops; the engine must strip from whichever cards in the combined hand bear the keyword.

<div id="REQ-DERELICT-14"></div>

**REQ-DERELICT-14:** The persistent cost-modifier concept must be world-agnostic, not a New-Derelict special case. It is a structural no-op in every world that declares no persistent modifier: with no Lockdown applied and no persistent field authored, the effective world-card cost equals the base cost, every `KeywordGate { keyword: "Lockdown" }` evaluates `count == 0 < min` and does nothing, and state and event streams are byte-identical to before the slice for all other worlds. This mirrors how Light, Heat, the end-turn passive, and Eden Prime's Alarm stay inert outside their owning worlds.

<div id="REQ-DERELICT-15"></div>

**REQ-DERELICT-15:** The core-engine slice for this world adds exactly: the `Lockdown` keyword, the persistent effective-cost-modifier field on the world-card source, the effective-world-card-cost derivation, and their wiring through `availableActions` / targeting / preview / reducer. It adds **no** new `ApplyKeyword` targets: the `"self"`, `"firstWorldCardInHand"`, `"hand"`, and `"nextWorldCard"` targets New Derelict's hooks use are all owned by the Eden Prime slice (REQ-EDEN-10) and reused here over `Lockdown` instead of `Alarm`. New Derelict must not introduce a second new keyword, an unplayable-card freeze for world cards, or a full deck-position sealed-marker. The brief's "sealed marker attached to a deck position" and an explicit linked-emergency release *graph* are explicitly deferred; the shipped version expresses linking through authored `onCleared` `RemoveKeyword` effects on specific cards.

<div id="REQ-DERELICT-15a"></div>

**REQ-DERELICT-15a:** `worldThreatTemplateByWorldId` must map `new-derelict` to its act-3 signature threat (REQ-DERELICT-29) so `AddThreatToWorldDeck` repeats the New Derelict signature threat.

## Reward Card Recipe (restore access vs spread it)

The following numbers are initial tuning. Costs, counts, and exact values may change during playtest as long as the roles remain intact.

<div id="REQ-DERELICT-16"></div>

**REQ-DERELICT-16:** New Derelict reward cards must split into two opposed families: **shortcut** cards that give strong immediate tempo but seal new doors (`ApplyKeyword Lockdown` / top-deck a hazard), and **release/valve** cards that are weak on an open board and strong when several compartments are sealed (`RemoveKeyword Lockdown`). The tension of the world is choosing between using the emergency system now and being locked on the wrong side of your own plan later.

<div id="REQ-DERELICT-17"></div>

**REQ-DERELICT-17:** `Emergency Route` must be a shortcut reward: strong immediate tempo that works because some other corridor is being closed. Initial effect: `Sequence` of `Draw player 1`, `GainEnergy 1`, and `ApplyKeyword { keyword: "Lockdown", target: "nextWorldCard" }`, `energyCost 0`, `exhaust: true`. Its role is tempo now with a known seal on the next hazard the ship reveals.

<div id="REQ-DERELICT-18"></div>

**REQ-DERELICT-18:** `Override Badge` must be a measured-clear reward that reopens one route. Initial effect: `Sequence` of `DealProgress base 3` and `RemoveKeyword { keyword: "Lockdown", target: "hand", amount: 1 }`, `energyCost 1`. Its role is pushing Progress while stripping one seal so the cluster tax does not compound.

<div id="REQ-DERELICT-19"></div>

**REQ-DERELICT-19:** `Manual Release` must be the cluster/late valve: it strips Lockdown across the board so the per-other-Locked-card cost tax collapses. Initial effect: `RemoveKeyword { keyword: "Lockdown", target: "hand", amount: 3 }`, `energyCost 1`, `exhaust: true`. It is weak when one or zero doors are sealed and critical when several emergency systems have chained.

<div id="REQ-DERELICT-20"></div>

**REQ-DERELICT-20:** `Follow the Checklist` must be a slow-and-survive reward expressing "make one future draw reliable at the cost of letting the ship dictate sequence." Initial effect: `Sequence` of `AddPlayerCardToTop { template: <fixed template> }` and a small `Brace 1` (or `Heal 2`), `energyCost 1`. The `<fixed template>` must be an **existing** player-card template id (a shared starter card or another New Derelict reward) so `buildWorld("new-derelict")` resolves it — it is not a tuning placeholder, since an unknown template id is a runtime failure, not a balance question. *(Scope decision 2026-06-29: a fixed-template top-deck rather than a player-chosen hand/discard card, which would require a new `TargetSpec` and `PlayCard` field beyond this slice — mirrors Eden Prime's `Follow the Shade` decision. Revisit if the fixed template weakens the card's identity.)* It must not duplicate Tidal's discard/deck-order-recall identity.

<div id="REQ-DERELICT-21"></div>

**REQ-DERELICT-21:** New Derelict reward cards must not claim another world's exclusive mechanics as their main identity. They must not use `GainLight`, `GainHeat`, `FreezeCards`, `ThawCards`, `DealProgressScaled`, `Concealed`, `Spore`, `ReturnPlayerDiscardToTop`, or `RecallPlayerDiscard`. They may use Eden Prime's `ApplyKeyword` / `RemoveKeyword` / `KeywordGate`, but only over `Lockdown`, not `Alarm`.

<div id="REQ-DERELICT-22"></div>

**REQ-DERELICT-22:** The reward kit must be fetchable through a boon offer (REQ-DERELICT-28), not a multi-card grant dump, mirroring the `Hatchery Cellar` / `Surveyors Mark A Pulse` / `The Quiet Grove` pattern.

## World Card Recipe

<div id="REQ-DERELICT-23"></div>

**REQ-DERELICT-23:** `Bulkhead 7-C Seals` must be the act-1 sealing hazard that teaches Lockdown. Initial shape: cost 2, discardable, carries the persistent Lockdown cost modifier (REQ-DERELICT-11); `onCleared: None`; `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: Sequence` of `ApplyKeyword { keyword: "Lockdown", target: "self" }` (the door seals if not cleared this turn) and `AddWorldCardToDeck { bTop: true, template: "Gravity Priority Shift" }` (traffic is redirected into a worse compartment). A single sealed bulkhead is cheap to reopen (cluster size 1, tax 0); the lesson is that seals are individually reasonable and accumulate. The top-deck is deliberately unconditional here — the act-1 teaching beat is the *self-seal*, and the redirected card is a *different* template (`Gravity Priority Shift`), not a re-seed of the same hazard, which is what keeps this distinct from `stir`'s same-template recurrence. If playtest shows turn-1 reads as top-decking rather than sealing, gate the `AddWorldCardToDeck` half behind `KeywordGate { keyword: "Lockdown", min: 1 }` so the redirect only appears once a seal already exists.

<div id="REQ-DERELICT-24"></div>

**REQ-DERELICT-24:** `Unfinished Captain's Address` must be the cheap announcement hazard. Initial shape: cost 1, discardable, no HP damage by itself; `onCleared: None`; `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: AddPlayerCardToTop "Panic"` (the sentence that never reaches its verb adds Panic as crew and player wait for an order that never arrives). The act-3 signature threat (REQ-DERELICT-29) is the moment this announcement finally completes.

<div id="REQ-DERELICT-25"></div>

**REQ-DERELICT-25:** `Gravity Priority Shift` must be the act-1/2 hand-disruption hazard. Initial shape: cost 3, discardable, carries the persistent Lockdown cost modifier; `onCleared: GainEnergy 1`; `onDiscarded: DiscardThenDraw player 1`; `onPartialClear: AddPlayerCardToTop <fixed template>` (a useful card is pinned to the top of the deck at the wrong time as power reroutes; the `<fixed template>` must be an existing player-card template id so `buildWorld` resolves it, per REQ-DERELICT-20); `onEndOfTurn: DiscardThenDraw player 1`. It disrupts sequence rather than dealing damage.

<div id="REQ-DERELICT-26"></div>

**REQ-DERELICT-26:** `Administrative Misfile` must be the act-2 status hazard (the brief's `Hidden` card, authored as `Obstructed`). Initial shape: cost 3, `Obstructed`, discardable; `onCleared: GainCard "Override Badge"` (correcting the record grants deck control); `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: ApplyKeyword { keyword: "Lockdown", target: "firstWorldCardInHand" }`. The hook fires every turn the misfile remains in hand — the fiction is "the ship accepts the wrong status as official and seals a route"; that flavor belongs in card text, not as a trigger condition. "First world card in hand" means the world card with the smallest mint-order `id` currently in hand, for deterministic targeting (mirrors REQ-EDEN-24).

<div id="REQ-DERELICT-27"></div>

**REQ-DERELICT-27:** `Corridor Becomes Lifeboat` must be the act-2/3 mass-seal hazard. Initial shape: cost 4, `Slow`, discardable, carries the persistent Lockdown cost modifier; `onCleared: None`; `onDiscarded: AddPlayerCardToTop "Panic"`; `onPartialClear: KeywordGate { keyword: "Lockdown", min: 2, zone: "hand", then: ApplyKeyword { keyword: "Lockdown", target: "firstWorldCardInHand" } }` (while the board is already sealing, the lifeboat logic spreads); `onEndOfTurn: ApplyKeyword { keyword: "Lockdown", target: "self" }`. Slow and difficult to clear; while present and the board is sealing, it makes more doors expensive.

<div id="REQ-DERELICT-28"></div>

**REQ-DERELICT-28:** `Systems Panel` must be the tool-fetch hazard. Initial shape: cost 6, `Obstructed`, discardable; `onCleared: OfferBoon { setId: "pool-derelict-override", setName: "Override Systems", offeredCount: 3, chooseCount: 1 }` over the reward kit (`Emergency Route`, `Override Badge`, `Manual Release`, `Follow the Checklist`); `onDiscarded: None`; `onPartialClear: None`; `onEndOfTurn: KeywordGate { keyword: "Lockdown", min: 2, zone: "hand", then: AddWorldCardToDeck { bTop: true, template: "Gravity Priority Shift" } }`. Mirrors the boon-fetch pattern (a boon choice, not a multi-card dump).

<div id="REQ-DERELICT-29"></div>

**REQ-DERELICT-29:** `The Order Arrives` must be the act-3 signature threat — the unfinished announcement finally reaching its verb: *abandon*. Initial shape: cost 6, `Creature` and `Slow`, carries the persistent Lockdown cost modifier, discardable only with a high penalty; `onCleared: GainCard "Manual Release"`; `onDiscarded: ForceDestroy 2`; `onPartialClear: KeywordGate { keyword: "Lockdown", min: 2, zone: "hand", then: AddWorldCardToDeck { bTop: true, template: "Corridor Becomes Lifeboat" } }`; `onEndOfTurn: Sequence` of `DamageScaled { base: 2, per: { kind: "KeywordInHand", keyword: "Lockdown" }, amount: 1 }` and `AddThreatToWorldDeck`. The non-zero `base: 2` guarantees genuine HP pressure so loss stays a fail state even on an open board, while the Lockdown scaling makes a sealed board actively lethal at the climax.

<div id="REQ-DERELICT-30"></div>

**REQ-DERELICT-30:** Every New Derelict world card must define `onDiscarded`, `onCleared`, `onPartialClear`, and `onEndOfTurn` (use `{ "kind": "None" }` for unused hooks), and may define the optional `persistent` cost-modifier field (REQ-DERELICT-11). Player cards define `effect`.

<div id="REQ-DERELICT-31"></div>

**REQ-DERELICT-31:** At least one early hazard must be low-damage or no-damage when discarded, and the player must not be soft-locked before the reward kit appears: a player who clears or discards sealing hazards promptly must be able to pass Act 1 keeping the Lockdown count at zero or one, where the cluster tax is nil. Sealing accumulates only when the player leaves seals in place or takes shortcuts; clearing/discarding is the always-available access-restoring action. Tempo, not time, is what makes New Derelict dangerous.

## Deck Composition

<div id="REQ-DERELICT-32"></div>

**REQ-DERELICT-32:** The deck must have exactly three acts expressing the three-act escalation. Act 1 (Routine Interruption): the crew still believes this is a drill — minor hazards seal one route or delay one action, and clearing grants access or tools. Act 2 (Conflicting Procedures): every department follows a different emergency script — cleared hazards re-seal, shortcuts spread Lockdown, and the cluster tax begins to bite. Act 3 (Derelict Before Impact): Lockdown triggers in clusters, the signature threat repeats, and the Walker arrives through a vessel that has already decided it cannot be saved.

<div id="REQ-DERELICT-33"></div>

**REQ-DERELICT-33:** Initial act composition should be:

| Act | Cards |
| --- | --- |
| Act 1 - Routine Interruption | `Bulkhead 7-C Seals` x3, `Unfinished Captain's Address` x2, `Systems Panel` x2 |
| Act 2 - Conflicting Procedures | `Gravity Priority Shift` x3, `Administrative Misfile` x2, `Corridor Becomes Lifeboat` x2, `Systems Panel` x1 |
| Act 3 - Derelict Before Impact | `Corridor Becomes Lifeboat` x2, `Gravity Priority Shift` x2, `The Order Arrives` x2, `The Walker` x1 |

Counts are tuning values; act roles and the fixed Walker closer are not.

<div id="REQ-DERELICT-34"></div>

**REQ-DERELICT-34:** Act 3 must always end with exactly one `{ "templateId": "The Walker", "count": 1 }`.

<div id="REQ-DERELICT-35"></div>

**REQ-DERELICT-35:** The deck must introduce `Systems Panel` early enough that the player can learn the shortcut/release reward kit before clustered Lockdown pressure arrives. If playtest shows the kit appears too late, increase the Act 1 `Systems Panel` count rather than weakening Act 3 first.

## Visual Theme

<div id="REQ-DERELICT-36"></div>

**REQ-DERELICT-36:** The visual keynote is cool fluorescent starship white-steel-teal overtaken by red emergency lighting, with violet-white Walker geometry pointing every route toward the same impossible evacuation path. Suggested values: `intrusionHue` in violet-white (the Walker wayfinding), door glow tint matching, danger/destruction accents warm emergency red-amber, return/retreat accents cool, and progress/target accents relating to the ship's own systems-panel cyan — keeping the stable semantic color roles (V2). The look must follow the shared theme art direction: gritty ink-and-wash concept art on warm weathered paper, dense scratch linework, restrained paint, imperfect black borders, tactile grain, desaturated reality, and vivid color reserved for emergency Lockdown, intrusion, and the shared Door.

<div id="REQ-DERELICT-37"></div>

**REQ-DERELICT-37:** The reality backdrop must remain the busy starship commons: Deck 7 corridor signage, engineering and crew-mess arrows, administration desks, systems panels, supply crates, fluorescent ceiling strips, and crew moving through ordinary work. It must be a 3:2 landscape reality layer that reads 95-98% normal: an intact, pressurized, working vessel before the Abandonment Drill, not a fully wrecked ship or a disaster already underway. Keep strong corridor perspective and large readable forms, leave the center usable under cards/HUD, favor environmental storytelling over character drama, and include no Walker, Door, logos, readable text, captions, watermarks, decorative UI, or full emergency overlay effects.

<div id="REQ-DERELICT-38"></div>

**REQ-DERELICT-38:** The intrusion overlay must transform those exact edge elements into the Abandonment Drill as an irregular perimeter frame while preserving central play readability: ceiling light strips and wall seams turning into red emergency bars, warning strobes, and sealed-bulkhead outlines; blast shutters and pressure doors dropping over the side corridors, engineering sign, administration desk, and crew-mess openings; tools, mugs, tablets, paperwork, and small supply objects lifting from the workstation edges as gravity flickers; systems panels, daily-assignment boards, and route signage corrupting into fractured announcement blocks and unreadable procedural warnings; ordinary arrows and wayfinding replaced with violet-white Walker geometry pointing every route toward the same evacuation path; and crew silhouettes isolated behind glass, pressure doors, warning light, or lockdown fields while keeping their calm workday posture. It must read as a normal workday being reorganized into a shipwide emergency faster than anyone can object, not a separate disaster pasted over it. It must ship as a true-alpha overlay, not a replacement backdrop: roughly 40-55% of the canvas remains fully transparent, strongest forms enter from the ship edges and openings, transition pixels are soft, and the overlay is reviewed composited over the New Derelict reality layer at half and full opacity. Do not include the Walker or Door in the overlay.

<div id="REQ-DERELICT-39"></div>

**REQ-DERELICT-39:** The cardfront must read as starship material under emergency lockdown: brushed steel, corridor signage, systems-panel cyan, supply-crate edges, cut by red emergency bars and violet-white Walker wayfinding. It must follow the shared cardfront contract: runtime ratio `150x196` (production may be `459x600`), roughly 60-70% low-detail near-black field for runtime title/rules, one strong New Derelict motif around the perimeter/lower third, quiet top-center title zone and corners, rounded transparent outer corners with opaque interior, and no baked-in words, numbers, labels, logos, or UI symbols. Runtime text must remain readable at card scale.

<div id="REQ-DERELICT-40"></div>

**REQ-DERELICT-40:** Card insets must make the isolate identity legible and follow `.lore/reference/worlds/authoring/theme-authoring.md` W2a-W2d. Author them as square `600x600` thumbnail-first event illustrations with one large foreground subject, a bold silhouette readable at `100x100`, a simplified darker starship background, and only one or two environmental cues. Hazard insets should show sealing in progress (a closing bulkhead, a gravity-flickered workstation, a misfiled status terminal, a corridor folding into a lifeboat, an announcement that never finishes). Reward insets should show access being restored or spread (an override badge, an emergency-route shortcut, a manual release lever, a checklist being followed). The palette should stay white-steel/teal/cyan with emergency red-amber and rare violet-white Walker wayfinding as the Lockdown accent; avoid busy console noise, legible UI copy, generic spaceship wreckage, explosions, combat scenes, logos, or crowded tiny props. Where the art allows, an inset should distinguish a card's open face from its sealed reading.

## Display And Help

<div id="REQ-DERELICT-41"></div>

**REQ-DERELICT-41:** `meta.ts` display copy must describe the place-vs-disaster contrast: a working, pressurized starship full of living crew whose own safety systems begin rehearsing abandonment after the Walker convinces the ship the disaster has already happened.

<div id="REQ-DERELICT-42"></div>

**REQ-DERELICT-42:** Help text must fit the existing world help budget and cover: hazards seal cards under `Lockdown`; a sealed card costs more Progress to clear for each *other* sealed card, so clusters of seals compound; Lockdown does not fade on its own — you reopen access by clearing the sealed card, clearing a linked emergency, or using a release reward; shortcut rewards (`Emergency Route`) give tempo now but seal a new door; and `Override Badge` / `Manual Release` are the release valves.

## Documentation

<div id="REQ-DERELICT-43"></div>

**REQ-DERELICT-43:** `.lore/reference/worlds/authoring/theme-authoring.md` must be updated when this world is implemented: add New Derelict to the signature verb table (verb `isolate`, reward implication "shortcuts spread Lockdown; release/valve cards strip it; sealed cards cost more to clear per other sealed card"), add `Lockdown` to the keyword vocabulary (C2) noting it is the first **persistent** runtime-applied keyword (contrast Eden Prime's transient `Alarm`), document the **persistent effective-cost modifier** as a new general world-card hook in the effect/card-fields section (C1/C3), note that it reuses Eden Prime's `ApplyKeyword` / `RemoveKeyword` / `KeywordGate`, and note New Derelict owns the `isolate` access-cost space.

<div id="REQ-DERELICT-44"></div>

**REQ-DERELICT-44:** Any implementation plan derived from this spec must split the work into at least four reviewable slices, each carrying its own tests (tests are not deferred to a final slice): (0) **the Eden Prime keyword slice as a prerequisite** if it has not already landed; (1) the **New Derelict core-engine slice** — the `Lockdown` keyword, the persistent effective-cost-modifier field, the effective-world-card-cost derivation, its wiring through `availableActions` / targeting / preview / reducer, the release rule, handlers, events, and the determinism/cluster-tax/no-op tests of REQ-DERELICT-45; (2) world data and registration; (3) assets/presentation/help; (4) full conformance and seeded gameplay validation. The core slice must land and be green before the world data depends on it.

## Tests And Validation

<div id="REQ-DERELICT-45"></div>

**REQ-DERELICT-45:** Core-engine tests must cover the Lockdown primitives independent of New Derelict: `ApplyKeyword` places `Lockdown` deterministically on the intended cards (hand, `self`, `firstWorldCardInHand`, and `nextWorldCard` targets) and emits an event; `Lockdown` does **not** decay across turn-start ticks (contrast Alarm); `RemoveKeyword` strips it deterministically; the persistent effective-cost modifier raises a Locked card's effective clear cost by `+1 per other Locked card in hand`, tested at cluster sizes 1 (tax 0), 2 (tax +1), and 3 (tax +2); `availableActions`, preview, and the reducer agree on the elevated cost (the player pays exactly the previewed cost); and a world that applies no Lockdown and declares no persistent modifier produces byte-identical state and events to before the slice (the no-op guarantee).

<div id="REQ-DERELICT-46"></div>

**REQ-DERELICT-46:** World-data tests must verify no duplicate template ids, all New Derelict world cards define all required hooks, all keywords are valid (including the new `Lockdown`), Act 3 ends with `The Walker`, the New Derelict bundle is in `worldDataRegistry`, the `new-derelict` threat mapping resolves, and `buildWorld("new-derelict")` succeeds.

<div id="REQ-DERELICT-47"></div>

**REQ-DERELICT-47:** Effect/data tests must cover the shipped isolate patterns: `Bulkhead 7-C Seals` seals itself and redirects traffic if left uncleared; clearing two Locked hazards costs more than clearing the same hazards in isolation (the cluster tax is observable end to end); `Administrative Misfile` `onEndOfTurn` seals the first world card in hand when ignored and `onCleared` grants `Override Badge`; `Systems Panel` `onCleared` creates a boon offer from `pool-derelict-override`; `Emergency Route` seals the next world card; `Override Badge` / `Manual Release` strip Lockdown; and `The Order Arrives` keeps real HP pressure through its non-zero `DamageScaled` base plus `AddThreatToWorldDeck`, scaling with the Lockdown count.

<div id="REQ-DERELICT-48"></div>

**REQ-DERELICT-48:** Asset validation must verify every `derelict-inset-*` key plus `new-derelict-cardfront`, `new-derelict-bg`, and `new-derelict-overlay` has a matching binding in both `assetBindings.ts` and `assetManifest.ts` and loads without falling back to starter art. It must also verify that `src/game/assets/themes/new-derelict/insets/README.md` exists and that the inset set has been reviewed as a `100x100` contact sheet against REQ-DERELICT-40.

<div id="REQ-DERELICT-49"></div>

**REQ-DERELICT-49:** Presentation tests or a smoke run must verify `selectTheme("new-derelict")` returns the New Derelict palette, backdrop, intrusion overlay, and cardfront, that the existing base art passes the art-direction review or has been retouched in place, that a representative New Derelict world card renders with its inset, that a Locked card shows its elevated effective clear cost on the card face, and that applied Lockdown is visible on a card. The visual smoke must check the reality layer stays readable under cards/HUD, the overlay preserves the central play area and true transparency, the cardfront keeps runtime text legible, and inset thumbnails still read at `100x100`.

<div id="REQ-DERELICT-50"></div>

**REQ-DERELICT-50:** A seeded gameplay test must demonstrate the isolate identity end to end: a line that promptly clears or discards sealing hazards (and declines `Emergency Route` shortcuts) keeps the Lockdown count at zero or one and clears Act 1 hazards at their base cost, while a line that leaves seals in place or takes shortcuts builds a Lockdown cluster whose per-other-Locked-card tax makes every door progressively more expensive to reopen, until a `Manual Release` / `Override Badge` valve collapses the tax or the climb of clear costs strands the player.

## AI Validation

An AI implementing this spec should verify completion by running or observing:

1. `bun run test` passes.
2. A core-engine test confirms the `Lockdown` keyword is persistent (does not decay), the persistent effective-cost modifier raises clear cost by `+1 per other Locked card` (verified at cluster sizes 1/2/3), `availableActions` / preview / reducer agree on the elevated cost, and the slice is a no-op (byte-identical state/events) in worlds that declare no persistent modifier and apply no Lockdown.
3. A world-data test confirms `buildWorld("new-derelict")`, registry inclusion, unique template ids, valid hooks, valid keywords including `Lockdown`, the `new-derelict` threat mapping, and the Walker closer.
4. An effect test confirms the cluster tax is observable (clearing two Locked hazards costs more than clearing them in isolation), that ignored sealing hazards spread Lockdown, that the boon fetch offers from `pool-derelict-override`, and that the release/valve rewards strip Lockdown.
5. Asset validation confirms all `derelict-inset-*` keys and the base New Derelict image keys are registered and preloadable, and that `src/game/assets/themes/new-derelict/insets/README.md` documents the New Derelict inset art style.
6. A local game smoke test can select `new-derelict`, leave a seal in place or take a shortcut to build a Lockdown cluster, observe a sealed card's clear cost climb, then use a release reward to collapse the tax.
7. A visual smoke test confirms the starship-commons backdrop, the emergency-lockdown intrusion overlay, and the cardfront render without obscuring the central play area or card text, that the overlay composites with true transparency, that representative insets remain readable at `100x100`, and that Lockdown and the elevated clear cost are legible on cards.
