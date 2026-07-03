---
title: Whiteout Parking Garage world
date: 2026-06-17
status: draft
tags: [world-design, whiteout-parking-garage, freeze, heat, frozen-cards, core-effect]
modules: [core-engine, world-data, game-view, themes]
related: [.lore/work/brainstorm/new-world-concepts.md, .lore/reference/worlds/authoring/theme-authoring.md, src/game/assets/themes/whiteout-parking-garage/CATACLYSM.md]
req-prefix: WHITEOUT
---

# Whiteout Parking Garage world

The sixth world is an upper level of a concrete parking garage during the first minutes of a flash blizzard that should not exist. The place was already emotionally cold: gray concrete, low ceilings, salt stains, dead fluorescent hum, cars left in numbered stalls. The Walker's passage makes that cold literal and final. The new ice age starts in a place built to store empty vehicles, and the garage becomes a freezer with ramps.

Threat verb: **freeze**. The world attacks hand usability by locking player cards. Response archetype: **heat economy**. The player survives by thawing key cards, burning cards for warmth, and choosing which tools can be sacrificed to keep a playable hand.

This spec assumes Fog's `Concealed` and `GainLight` work already exist, but Whiteout must not reuse them. Light is information. Heat is usability.

## World Contract

<div id="REQ-WHITEOUT-1"></div>

**REQ-WHITEOUT-1:** The world id must be `whiteout-parking-garage` everywhere: `cards.json`, `meta.ts`, `theme.ts`, `index.ts`, registry entry, `VisualTheme.worldId`, asset keys, and asset binding imports.

<div id="REQ-WHITEOUT-2"></div>

**REQ-WHITEOUT-2:** Theme assets must live under `src/game/assets/themes/whiteout-parking-garage/`. The existing reality, overlay, and cardfront files are the canonical base assets:

- `whiteout-parking-garage-reality.webp`
- `intrusion-overlay.webp`
- `whiteout-parking-garage-cardfront.webp`

<div id="REQ-WHITEOUT-3"></div>

**REQ-WHITEOUT-3:** The implementation must add one inset asset per Whiteout card under `src/game/assets/themes/whiteout-parking-garage/insets/`, using the `whiteout-inset-*` key namespace, and register each key in `src/game/worlds/assetBindings.ts`.

<div id="REQ-WHITEOUT-4"></div>

**REQ-WHITEOUT-4:** The world must register through the same data registry pattern as the other worlds, without one-off builders or special theme selection code.

## Narrative And Identity

<div id="REQ-WHITEOUT-5"></div>

**REQ-WHITEOUT-5:** The three-beat fiction is: ordinary upper parking deck in cold weather, Walker triggers impossible blizzard and deep freeze, the Door opens through the ice at the garage exit ramp.

<div id="REQ-WHITEOUT-6"></div>

**REQ-WHITEOUT-6:** The Walker, `Summon Door`, and `Door` remain shared starter templates. Whiteout data must not redefine any of them.

<div id="REQ-WHITEOUT-7"></div>

**REQ-WHITEOUT-7:** The exclusive signature verb is `freeze`: world hazards make player cards unusable until heat or time thaws them. No other world may use the Whiteout-only freeze/heat effects without a new design decision.

<div id="REQ-WHITEOUT-8"></div>

**REQ-WHITEOUT-8:** The disaster identity must show up in hazards, rewards, act shape, theme colors, help text, and cardfront. The world is not "snow damage"; it is "your hand stops working."

## Core Slice: Frozen Cards

<div id="REQ-WHITEOUT-9"></div>

**REQ-WHITEOUT-9:** Add a transient frozen state to cards in hand, represented on minted card instances rather than as a keyword. Initial shape: `frozen?: number`, where absent or `0` means playable and a positive number means locked for that many turn-start thaw ticks. Frozen player cards are retained in hand across end turn instead of being discarded with the rest of the player hand.

<div id="REQ-WHITEOUT-10"></div>

**REQ-WHITEOUT-10:** Frozen state must be instance-scoped. Freezing one copy of `Explore` must not freeze every `Explore` template or future copy.

<div id="REQ-WHITEOUT-11"></div>

**REQ-WHITEOUT-11:** Frozen player cards are excluded from `availableActions.playable`, even when the player has enough energy and the effect otherwise has legal targets.

<div id="REQ-WHITEOUT-12"></div>

**REQ-WHITEOUT-12:** Frozen world cards, if any effect ever freezes them, still tick at end of turn and remain discardable according to their normal `discardable` field. The first shipped Whiteout data should freeze player cards only.

<div id="REQ-WHITEOUT-13"></div>

**REQ-WHITEOUT-13:** End-turn order must be: emit `TurnEnded`, resolve world `onEndOfTurn` hooks that may freeze player cards, discard only unfrozen player cards, retain frozen player cards in hand, then start the new turn. Frozen counters decay by 1 at turn start after Light decay and before energy gain/refill. A counter reaching 0 removes the frozen state, but the thawed card remains in hand for that turn. This order makes freeze visible before the player gets a fresh energy/play decision.

<div id="REQ-WHITEOUT-14"></div>

**REQ-WHITEOUT-14:** Add `CardsFrozen` and `CardsThawed` events. They must carry card ids and template ids so renderer, telemetry, and tests can reason about state changes without inspecting object diffs.

<div id="REQ-WHITEOUT-15"></div>

**REQ-WHITEOUT-15:** Frozen cards must render with an ice treatment that preserves card identity: name, cost, rules, and inset remain visible, but the card is visibly locked and cannot be selected as playable.

## Core Slice: Heat

<div id="REQ-WHITEOUT-16"></div>

**REQ-WHITEOUT-16:** Add `heat: number` to `GameState`, initialized by `createWorld` from optional world source field `startHeat`, defaulting to 0 for non-Whiteout worlds.

<div id="REQ-WHITEOUT-17"></div>

**REQ-WHITEOUT-17:** Heat is a spendable resource, unlike Fog's Light. It does not decay automatically. It is gained by heat cards and spent by thaw effects.

<div id="REQ-WHITEOUT-18"></div>

**REQ-WHITEOUT-18:** Add `GainHeat` effect: `{ kind: "GainHeat", amount: number }`. It has no target, increases `state.heat`, emits `HeatChanged`, describes itself, compiles to an effect line with a heat icon, and is explicitly covered in playability tests. `HeatChanged` must include enough information for telemetry to distinguish gain from spend, e.g. `{ type: "HeatChanged", heat: number, delta: number }`, where positive deltas count toward `heatGained` and negative deltas count toward `heatSpent`.

<div id="REQ-WHITEOUT-19"></div>

**REQ-WHITEOUT-19:** Add `FreezeCards` effect: initial shape `{ kind: "FreezeCards", amount: number, duration: number }`. It chooses up to `amount` unfrozen player cards in hand at random, excluding the source card when possible, sets `frozen` to `max(existing, duration)`, and emits `CardsFrozen`. If no player cards are in hand, the effect fizzles rather than queuing hidden future state.

<div id="REQ-WHITEOUT-20"></div>

**REQ-WHITEOUT-20:** Add `ThawCards` effect: initial shape `{ kind: "ThawCards", amount: number, heatCost: number }`. It targets frozen player cards in hand, spends `heatCost` per selected card, clears their frozen state, and emits `HeatChanged` plus `CardsThawed`. `CardsThawed` must carry card ids and template ids so run telemetry can increment `cardsThawed` by the number of thawed cards.

<div id="REQ-WHITEOUT-21"></div>

**REQ-WHITEOUT-21:** Add `BurnForHeat` effect: initial shape `{ kind: "BurnForHeat", min: number, max: number, amountPerCard: number }`. It targets player cards in hand, destroys the selected cards, grants heat per destroyed card, and emits the normal destruction and heat events plus a burn-specific event or marker that lets run telemetry increment `cardsBurnedForHeat`. Frozen player cards are legal burn targets; burning a locked card is the emergency valve.

<div id="REQ-WHITEOUT-22"></div>

**REQ-WHITEOUT-22:** Heat must appear in the HUD only when the current world uses heat. Do not key HUD visibility on `state.heat > 0`, because a global starting-heat unlock can make non-heat worlds carry a numeric heat value that has no local meaning. Heat must use a dedicated `effect-icon-heat` asset, not `effect-icon-light`.

<div id="REQ-WHITEOUT-23"></div>

**REQ-WHITEOUT-23:** Run stats and replay/event-stream code must handle `HeatChanged`, `CardsFrozen`, and `CardsThawed` without crashing or silently dropping determinism.

## Whiteout Card Recipe

The following names and numbers are initial tuning. Costs, counts, durations, and heat amounts may change during playtest without revising this spec as long as the roles remain intact.

<div id="REQ-WHITEOUT-24"></div>

**REQ-WHITEOUT-24:** The Whiteout reward kit must contain these player-card roles:

| Card | Initial effect | Role |
| --- | --- | --- |
| Hand Warmers | `GainHeat 2` | steady heat top-up |
| Ice Scraper | `ThawCards amount 1, heatCost 1`; then `DealProgress base 1` as a modal or sequence if feasible | thaw one card and keep moving |
| Burn The Manual | `BurnForHeat min 1 max 1 amountPerCard 3` | sacrifice a card for emergency heat |
| Space Heater | `GainHeat 4`, exhaust | large one-shot heat |
| Jumper Cables | `ThawCards amount 2, heatCost 1`; exhaust | burst thaw for a locked hand |

<div id="REQ-WHITEOUT-25"></div>

**REQ-WHITEOUT-25:** The capstone world card that grants the heat kit is `Maintenance Closet`: a visible or low-threat `Hidden` world card with high cost and `onCleared` as a `Sequence` of `GainCard` effects for the kit.

<div id="REQ-WHITEOUT-26"></div>

**REQ-WHITEOUT-26:** The world hazard roster must include these roles:

| Hazard | Role |
| --- | --- |
| Powder Drift | act-1 ambient; low cost; no freeze; teaches the garage and blizzard |
| Frozen Puddle | act-1 obstacle; if ignored or partially cleared, freezes one card briefly |
| Dead Battery | act-1/2 utility hazard; clearing may grant `Hand Warmers` or heat, but ignoring it drains tempo |
| Black Ice Ramp | act-2 obstacle; `Slow`; freezes multiple cards if left unresolved |
| Snowblind Headlights | act-2 threat; prevents clean targeting through damage or discard pressure, not concealment |
| Ice-Locked Door | act-2/3 blocker; high cost; punishes partial clears by freezing cards |
| Plow Buried In Snow | act-3 heavy hazard; `Slow`; clearing gives a strong burst or removes freeze pressure |
| The Garage Freezes Shut | act-3 signature threat; freezes cards every turn and damages the player for each frozen card |

<div id="REQ-WHITEOUT-27"></div>

**REQ-WHITEOUT-27:** Whiteout must not introduce a new deck-pollution junk card. Its clock is how much of the current hand remains usable.

<div id="REQ-WHITEOUT-28"></div>

**REQ-WHITEOUT-28:** At least one early freeze hazard must be discardable, with a modest `onDiscarded` penalty, so a player can choose to flee instead of letting a hand lock compound.

<div id="REQ-WHITEOUT-29"></div>

**REQ-WHITEOUT-29:** At least one hazard must punish carrying frozen cards, e.g. damage scaled by frozen card count. This is the climax pressure that makes thawing different from ordinary healing.

<div id="REQ-WHITEOUT-30"></div>

**REQ-WHITEOUT-30:** Reward cards must not duplicate another world's reward identity. Heat gain, targeted thaw, and burning cards for heat are Whiteout's reward space; `GainLight`, `DealProgressScaled`, and `Brace` are not Whiteout's signature answers.

## Deck Composition

<div id="REQ-WHITEOUT-31"></div>

**REQ-WHITEOUT-31:** The deck must have exactly three acts. Act 1 introduces low freeze duration and at least two `Maintenance Closet` opportunities. Act 2 introduces multi-freeze and the main blocker. Act 3 peaks frozen-card pressure and ends with exactly one `The Walker`.

<div id="REQ-WHITEOUT-32"></div>

**REQ-WHITEOUT-32:** Act 3 must always end with `{ "templateId": "The Walker", "count": 1 }`.

<div id="REQ-WHITEOUT-33"></div>

**REQ-WHITEOUT-33:** A draft composition should target roughly 10 cards per act, matching nearby worlds, unless playtest shows the freeze clock needs a shorter or longer curve.

## Visual Theme

<div id="REQ-WHITEOUT-34"></div>

**REQ-WHITEOUT-34:** The visual keynote is blue-white cold against sodium-amber garage light. Suggested values: `intrusionHue #bfe9ff`, door glow tint `0xbfe9ff`, danger/destruction accents warm amber-orange, return/retreat accents cool steel blue.

<div id="REQ-WHITEOUT-35"></div>

**REQ-WHITEOUT-35:** The reality backdrop must remain mostly mundane: concrete deck, columns, parked cars, cold evening, a trace of windblown powder, and one frozen puddle. The full blizzard and deep ice belong to the intrusion overlay.

<div id="REQ-WHITEOUT-36"></div>

**REQ-WHITEOUT-36:** The intrusion overlay must read as a perimeter whiteout: ice encroaches from exterior openings, ramps, ceiling seams, and under cars while leaving the central play area readable.

<div id="REQ-WHITEOUT-37"></div>

**REQ-WHITEOUT-37:** The cardfront must be a graphic material study of concrete, frost, tire tracks, fluorescent strips, and blue-white ice. It must keep the center dark enough for runtime text at 150x196.

## Display And Help

<div id="REQ-WHITEOUT-38"></div>

**REQ-WHITEOUT-38:** `meta.ts` must add display copy that makes the place-vs-disaster contrast explicit: a parking garage was already cold and impersonal; now it is where the new ice age starts.

<div id="REQ-WHITEOUT-39"></div>

**REQ-WHITEOUT-39:** Help text must fit the existing help budget and cover: frozen cards are unplayable, heat thaws or is gained by burning cards, frozen counters thaw over time, and the climax punishes carrying too many frozen cards.

<div id="REQ-WHITEOUT-40"></div>

**REQ-WHITEOUT-40:** World select must include Whiteout only after the world-select carousel can handle six worlds without card overlap or shrinking the cards below the established layout.

## Feats And Unlocks

<div id="REQ-WHITEOUT-41"></div>

**REQ-WHITEOUT-41:** Run telemetry must add Whiteout resource and mechanic counters before any Whiteout-specific feats are added. `RunRecord.finalResources` must include `heat: ended.finalState.heat`. The run accumulator must track `cardsFrozen`, `cardsThawed`, `heatGained`, `heatSpent`, and `cardsBurnedForHeat` from the new Whiteout events/effects. These counters must be optional-safe when loading older run history.

<div id="REQ-WHITEOUT-42"></div>

**REQ-WHITEOUT-42:** The feat evaluator stat namespace must resolve the Whiteout telemetry fields. Add `heat` to the resource stat set, resolving from `RunRecord.finalResources?.heat`, and add direct run fields for `cardsFrozen`, `cardsThawed`, `heatGained`, `heatSpent`, and `cardsBurnedForHeat`. Unknown or absent values continue to fail closed.

<div id="REQ-WHITEOUT-43"></div>

**REQ-WHITEOUT-43:** `FEAT_CATALOG` must add a first-win feat for this world:

```typescript
{
  id: "first-whiteout-parking-garage",
  name: "First Thaw",
  description: "Win your first run of the Whiteout Parking Garage.",
  conditions: [
    { statId: "outcome", operator: "is", value: "won" },
    { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
  ],
  reward: { items: [{ type: "memoryFragments", amount: 5 }] },
}
```

<div id="REQ-WHITEOUT-44"></div>

**REQ-WHITEOUT-44:** `FEAT_CATALOG` must add a Whiteout resource-mastery feat:

```typescript
{
  id: "heat-keeper",
  name: "Heat Keeper",
  description: "Win the Whiteout Parking Garage with 10 or more heat.",
  conditions: [
    { statId: "outcome", operator: "is", value: "won" },
    { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
    { statId: "heat", operator: "gte", value: 10 },
  ],
  reward: { items: [{ type: "memoryFragments", amount: 20 }] },
}
```

<div id="REQ-WHITEOUT-45"></div>

**REQ-WHITEOUT-45:** `FEAT_CATALOG` must add a freeze-response feat:

```typescript
{
  id: "master-thaw",
  name: "Master Thaw",
  description: "Win the Whiteout Parking Garage after thawing 10 or more frozen cards.",
  conditions: [
    { statId: "outcome", operator: "is", value: "won" },
    { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
    { statId: "cardsThawed", operator: "gte", value: 10 },
  ],
  reward: { items: [{ type: "memoryFragments", amount: 25 }] },
}
```

<div id="REQ-WHITEOUT-46"></div>

**REQ-WHITEOUT-46:** `FEAT_CATALOG` must add a Whiteout witness feat matching the existing slayer pattern:

```typescript
{
  id: "freeze-slayer",
  name: "Garage Breaker",
  description: "Defeat 25 The Garage Freezes Shut hazards across all runs.",
  conditions: [
    { statId: "witness.The Garage Freezes Shut.resolvedCount", operator: "gte", value: 25 },
  ],
  reward: { items: [{ type: "memoryFragments", amount: 20 }] },
}
```

The description and threshold must not drift from each other; the current older slayer descriptions say "100" while testing a threshold of 25, and Whiteout should not repeat that mismatch.

<div id="REQ-WHITEOUT-47"></div>

**REQ-WHITEOUT-47:** Feat tests must cover the Whiteout additions: catalog ids remain unique, `first-whiteout-parking-garage` requires both a win and the Whiteout world id, `heat-keeper` requires final `heat >= 10`, `master-thaw` requires `cardsThawed >= 10`, and `freeze-slayer` resolves through the witness namespace.

<div id="REQ-WHITEOUT-48"></div>

**REQ-WHITEOUT-48:** The unlock system must grow a heat-aware starting-resource Blessing. Extend `RunModifiers` with `extraStartHeat: number`, extend `DEFAULT_RUN_MODIFIERS`, extend `UnlockEffect.startingStat.stat` with `"heat"`, and apply the modifier in `createWorld` as `heat: (world.startHeat ?? 0) + mods.extraStartHeat`. Non-heat worlds may carry a numeric heat value, but the HUD must not show it unless the world uses heat or heat becomes mechanically relevant.

<div id="REQ-WHITEOUT-49"></div>

**REQ-WHITEOUT-49:** `UNLOCK_CATALOG` must add this entry:

```typescript
{
  id: "extra-heat",
  name: "Thermal Cache",
  description: "A pocket of warmth saved for the worlds that can freeze your hands.",
  cost: 20,
  destinyWeight: 1,
  effect: { type: "startingStat", stat: "heat", amount: 2 },
}
```

This intentionally mirrors `extra-light` and `extra-brace` without adding a heat floor unlock. Heat is spendable and does not decay, so a `min-heat` floor would erase too much of Whiteout's burn/thaw pressure unless a later design revises heat economy globally.

<div id="REQ-WHITEOUT-50"></div>

**REQ-WHITEOUT-50:** Unlock tests must cover `extra-heat`: the catalog still has unique ids, `buildRunModifiers(["extra-heat"], UNLOCK_CATALOG)` returns `extraStartHeat: 2`, and `createWorld` applies it to Whiteout's starting heat. The Destiny budget helpers need no special Whiteout branch; `extra-heat` is a normal weight-1 Blessing.

## Documentation

<div id="REQ-WHITEOUT-51"></div>

**REQ-WHITEOUT-51:** `.lore/reference/worlds/authoring/theme-authoring.md` must be amended with Whiteout's signature row: `whiteout-parking-garage` uses `freeze` as threat verb and `heat economy` as response archetype. The effect vocabulary must add `GainHeat`, `FreezeCards`, `ThawCards`, and `BurnForHeat` when those effects ship.

<div id="REQ-WHITEOUT-52"></div>

**REQ-WHITEOUT-52:** `src/game/assets/themes/whiteout-parking-garage/CATACLYSM.md` is the local art-and-fiction reference for this world and must stay consistent with this spec.

## AI Validation

The AI should verify completion with these checks:

1. Search for `whiteout-parking-garage` and confirm the id appears in world data, metadata, theme, index, registry, asset binding, and manifests with no spelling drift.
2. Run typecheck and tests. At minimum: `bun run typecheck` and `bun test`.
3. Add focused core tests for frozen state, frozen player-card retention across end turn, freeze decay order, frozen playability exclusion, heat gain/spend, burn-for-heat, event emission, and deterministic replay.
4. Add world assembly tests proving `buildWorld("whiteout-parking-garage")` succeeds, the deck has three acts, act 3 ends with `The Walker`, no shared starter template is redefined, and every `insetKey` resolves.
5. Add feat/evaluator tests for `heat`, `cardsThawed`, `first-whiteout-parking-garage`, `heat-keeper`, `master-thaw`, and `freeze-slayer`.
6. Add unlock tests for `extra-heat`, `extraStartHeat`, and `createWorld` starting heat.
7. Smoke the game in a browser and inspect the Whiteout world: reality/backdrop renders, intrusion overlay has alpha, frozen cards are visibly locked, heat appears in the HUD, and the world-select carousel remains usable with six worlds.
8. Check asset dimensions with `file src/game/assets/themes/whiteout-parking-garage/*.webp`; backdrop and overlay should be 3:2 and the cardfront should match the existing 459x600 production ratio.
