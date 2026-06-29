# Shattered Worlds - Theme Authoring Rules

<!--
date: 2026-06-10
status: current
tags: theme, world, authoring, rules, the-walker, deck, visual-theme, reference
fg-type: architecture
fg-sources: .lore/work/specs/overgrown-mall.html, .lore/work/specs/fog-beach-party.html, .lore/work/brainstorm/shard-response-archetypes.html
related: .lore/reference/visual-direction.md, .lore/reference/vision.md
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/data/worlds/registry.ts
    - src/game/worlds/assetBindings.ts
    - src/game/data/assetManifest.ts
    - src/game/view/themes/theme.ts
  tests:
    - src/core/tests/worldRegistry.test.ts
    - src/game/tests/worldAssetBindings.test.ts
    - src/game/tests/theme.test.ts
  symbols:
    - CardEffect
    - VisualTheme
    - worldId
-->

Use this when adding or reviewing a world theme. A theme is one `worldId` plus coordinated data, presentation, assets, and registration. The canonical model is `zombie-big-box`, but do not copy its palette verbatim.

This document blends structural contracts (rules the engine enforces) with conventions, patterns, and workflow guidance. Contract-level constraints are labeled **RULE**, **N**, **D**, **C**, **V** (when describing API shape), or **W**. Conventions marked **SV** are quality heuristics — strong recommendations that keep worlds distinct but aren't enforced by code. Unlabeled pattern recipes are techniques, not requirements.

## Theme Contract

| Layer | Current location | Holds |
| --- | --- | --- |
| Narrative | Design docs / card flavor | Walker arrival, catastrophe, mythic Door |
| Data | `src/data/worlds/<worldId>/cards.json` | Card templates and three-act deck composition |
| World bundle | `src/data/worlds/<worldId>/index.ts`, `meta.ts`, `theme.ts` | Registry-facing id, source, display/help/light metadata, theme |
| Registry | `src/data/worlds/registry.ts` | Adds the world bundle to the game |
| Visual | `src/data/worlds/<worldId>/theme.ts` | `VisualTheme`: palette, frames, backdrops, door/cardfront keys |
| Assets | `src/game/assets/themes/<worldId>/...` | Backdrop, intrusion overlay, cardfront, card insets |
| Asset bindings | `src/game/worlds/assetBindings.ts`, `src/game/data/assetManifest.ts` | Maps data keys to imported image assets |

**RULE 0:** `worldId` is the join key. It must be identical, kebab-case, in the JSON `worldId`, world bundle id/meta, `VisualTheme.worldId`, registry entry, and asset bindings. If it drifts, theme selection falls back to `STARTER` or `buildWorld` fails.

## Narrative Spine

Every world is a variation on the same three-beat arc:

1. **Calm before:** an ordinary place with ambient unease.
2. **The intrusion:** The Walker appears in the distance, not as an enemy, and triggers the world's signature catastrophe.
3. **The Door:** The Walker opens the mythic Door. Clearing it escapes the world.

**N1:** The Walker is never the enemy and is never themed. The shared `The Walker`, `Summon Door`, and `Door` templates live in the starter source. Theme data must not redefine them; duplicate template ids throw.

**N2:** The catastrophe is the theme identity. It should show up in the intrusion overlay, the signature threat card, obstacles, ambient cards, rewards, and act shape.

## Deck Structure

`deckComposition.acts` always has three acts. Act sizes are not fixed; the curve should express the threat verb:

| Act | Role | Zombie example |
| --- | --- | --- |
| 1 - Foreshadow | Ambient cards and minor obstacles. No real threat yet. | Strange Sounds, Rubble, Screams |
| 2 - Escalation | Signature threat appears in numbers. Add the tool-fetch that counters it. | Rubble, Zombie, Find Baseball Bat |
| 3 - Climax + exit | Peak threat density, then the fixed Walker closer. | Find Baseball Bat, Zombie, The Walker |

**D1:** Act 3 always ends with `{ "templateId": "The Walker", "count": 1 }`. This is the fixed closer: `The Walker` discarded -> adds `Door`; `Door` cleared -> `SurviveWorld`.

**D2:** Starter decks are shared and selected separately. Theme JSON provides only `cardTemplates` and `deckComposition`. Reward player cards are where worlds diverge; if two worlds grant the same reward card or same mechanical identity, redesign one.

## Card Recipe

Map the world's fiction onto these roles.

1. **Ambient foreshadow** - cheap world cards, often discardable. They set mood and may seed reaction cards. Example: `Strange Sounds` -> `Listen`.
2. **Obstacle** - cheap world card that punishes neglect. Example: `Rubble` -> `Damage 1 on end-of-turn (if not cleared).`.
3. **Signature threat creature** - costly world card, usually `Creature` + `Slow`, with end-of-turn pressure and a discard penalty.
4. **Tool fetch** - `Obstructed` world card that grants the weapon/tool countering the threat.
5. **Reaction player cards** - rewards gained mid-run, tuned to the threat.
6. **Signature player verb** - the world's *signature* mechanical identity: the main mechanic the world is built around and known for. This is not a code field; it is an authorship invariant. It is exclusivity of *identity*, not of *effects* (see the rule below the table).

| World | Signature verb | Reward-card implication |
| --- | --- | --- |
| `zombie-big-box` | sweep and noise | Interact with `Creature`/`Slow` clusters and multi-clear moments |
| `highway-volcano` | everything is fuel | Convert discards or exhaust triggers into resources |
| `bird-building` | travel light | Trim hand size, recycle cheap cards, prefer efficiency over force |
| `overgrown-mall` | prune and profit | Self-pruning `Spore`; `Bloom` scales from Spores; leads with `DealProgressScaled` |
| `fog-beach-party` | reveal and endure | Light economy; leads with `GainLight`; reveals `Concealed` hazards |
| `whiteout-parking-garage` | freeze | Heat economy; leads with `GainHeat`, `FreezeCards`, `ThawCards`, frozen cards stop hand usability |
| `the-tidal-archive` | displace | Leads with discard/deck-order recall; rewards set up the top of the player deck deliberately (`ReturnPlayerDiscardToTop`); hazards/passive recall discards automatically (`RecallPlayerDiscard`) |
| `the-ember-orchard` | incubate | Leads with incubation-as-delayed-known-cost: warmth/benefit now that seeds a known future hazard; rewards trade immediate gain for top-decked threats that hatch into stronger cards at end of turn |
| `city-of-sleeping-giants` | stir | Leads with stirring-as-recurrence/escalation from unresolved or exploited body movement: hazards left unresolved (or whose movement is exploited) return and escalate; recurrence is delivered by re-seeding the top of the world deck |

This is a living registry — each new world adds an entry. The verb captures the *signature* mechanical identity of that world; no two worlds should feel interchangeable.

**No mechanic is exclusive; identity is.** There are no off-limits effects or keywords. Any world may use any entry in the effect/keyword vocabulary as a supporting tool. What must stay distinct is each world's *signature* — the main mechanic it is built around. The "leads with"/"signature of" columns elsewhere in this doc record which world a mechanic is the *identity* of; they are not a permission gate. The only constraint is: **do not build a new world's main identity on a mechanic that is already another world's signature.** (A separate, purely mechanical coupling can still make some effects poor fits — see the signature-effects note below — but that is engineering, not ownership.)

**SV1:** Enforce the signature *identity* at authorship time. A reward card may reuse an effect another world is known for as an incidental supporting tool; what to avoid is making that effect the new world's main mechanic. If a card's *identity* would fit another world's verb, redesign it.

---

The sections that follow are **authoring patterns** — techniques that have proven effective and are worth reaching for. They are not engine-enforced rules; use them when they serve the theme, ignore them when you have a better idea.

## Self-Transform Pattern

Use this for a world card that worsens if ignored. It spawns its successor on top of the world deck, then removes itself from hand:

```json
"onEndOfTurn": {
  "kind": "Sequence",
  "steps": [
    { "kind": "AddWorldCardToDeck", "bTop": true, "template": "<worse-card>" },
    { "kind": "DestroySelf" }
  ]
}
```

The threat resurfaces next turn rather than replacing the card in hand. Canonical example: `Corpse` creates `Zombie`, then `DestroySelf`.

## Effects, Keywords, And Card Fields

**C1:** The effect vocabulary is defined by the `CardEffect` union type in [`src/core/model/types.ts`](../../src/core/model/types.ts). This list below is organized by domain for readability. Add new kinds only when a theme needs mechanics that don't map to any existing one; that requires wiring an engine handler.

<details>
<summary>Complete effect kinds (expand)</summary>

**Progress / Damage:** `DealProgress`, `DealProgressScaled` _(overgrown-mall signature)_, `DealProgressAll`, `Damage`, `DamageScaled`

**Draw / Return:** `Draw`, `DiscardThenDraw`, `ReturnWorldCards` _(inert on world auto-hooks: it is boon-signed and no-ops when fired from a world card's automatic `onEndOfTurn`/`onClear`/etc. hooks; use `AddWorldCardToDeck { bTop: true }` to re-seed recurrence)_, `ReturnPlayerDiscardToTop` _(Tidal: player-selected recall to draw top)_, `RecallPlayerDiscard` _(Tidal: automatic recall from discard)_

**Resource:** `Heal`, `GainEnergy`, `AddCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck` (use `bTop: true` for top-of-deck placement), `AddThreatToWorldDeck`, `GainRandomCard` _(rolled from named pool)_, `GainLight` _(fog-beach-party signature)_, `GainHeat`

**Hand / discard manipulation:** `DestroyCardInHand`, `ExileTopWorldCards`, `ForceDestroy`, `Brace`

**State change / terminal:** `FreezeCards`, `ThawCards`, `OfferBoon` _(boon selection)_, `Modal` _(player choice between branches)_, `Sequence` _(ordered steps)_, `DestroySelf` _(world card self-removal in onEndOfTurn)_, `SurviveWorld`, `None`

</details>

**Signature effects.** Each effect below is the *identity* of one world — the mechanic that world is built around. This is **not** a permission gate: any world may use these as supporting tools. The only constraint is identity (do not make one your *main* mechanic if it is already another world's signature; see "No mechanic is exclusive; identity is" above). Two rows also carry a *mechanical coupling* — an engineering fact, separate from the identity point — that makes the effect a poor fit elsewhere regardless of intent.

| Effect | Signature of | Note |
| --- | --- | --- |
| `DealProgressScaled` | `overgrown-mall` | Its scaling-from-Spores identity. Freely reusable as a supporting tool. |
| `GainLight` | `fog-beach-party` | **Coupled:** the only way to lift `Concealed:N` depth. A world that authors `Concealed` hazards must supply a Light source, which makes Light part of that world's identity whether intended or not. |
| `GainHeat`, `FreezeCards`, `ThawCards` | `whiteout-parking-garage` | **Coupled:** a Heat/freeze/thaw suite; pulling in the suite pulls in the freeze identity. |
| `ReturnPlayerDiscardToTop`, `RecallPlayerDiscard` | `the-tidal-archive` | Its discard/deck-order recall identity — moving real player card instances from `playerDiscard` to the top of `playerDraw`. |

**C1a:** `DestroySelf` removes the firing world card from hand. It is only meaningful in `onEndOfTurn`, where the engine has a `selfId`.

**C2:** The current keyword vocabulary is `Obstructed`, `Creature`, `Slow`, `Spore`, and `Concealed`. These cover the engine's supported keyword semantics today. Introducing a new keyword is a valid design decision when a theme needs a semantic category that doesn't map to any existing one — but it requires wiring an engine handler.

**C2a:** Keywords are authored as strings in `keywords`: `"Name"` or `"Name:N"`. A bare keyword has no value; a numeric keyword parses to `{ name, value }`. Currently only `Concealed` uses a value (Light depth); future keywords can adopt other structures with engine support.

**C3:** Every world card defines `onDiscarded`, `onCleared`, and `onEndOfTurn`; use `{ "kind": "None" }` when a hook does nothing. Player cards define `effect`.

**C3a:** A world may define a per-world **end-turn passive** via the optional root field `onEndOfTurnPassive: CardEffect` on the card source (default `{ "kind": "None" }`). It runs once each turn after unretained player cards are discarded and before the turn-start refill, threaded onto `GameState.endOfTurnPassive` at `createWorld` time (the reducer never sees `WorldData`). The Tidal Archive uses it for Tidal Memory: `{ "kind": "RecallPlayerDiscard", "policy": "latest" }` recalls the most recent discard to the top of the deck every turn. Worlds that omit it are byte-identical to before — the `None` passive emits no events.

**C4:** Player cards may set `exhaust: true` to destroy themselves after play instead of going to discard. Default is false.

**C4a:** Player and world cards may set `canExile: false`. The default is true. `The Walker` and `Door` are canonical false cases because meta-progression exile must not permanently remove narrative-critical cards.

## Visual Identity

The `VisualTheme` contract requires:

- `worldId`
- `intrusionHue`
- `realityPalette`
- `frameStyle`
- `backdrop`

Optional but common:

- `doorGlowTint`
- `doorTint`
- `worldCardfrontKey`

**V1:** Each world should have a distinct color identity: intrusion hue, frame family, backdrop, and cardfront ought to read differently at a glance. This is an aspirational quality bar — worlds with overlapping palettes feel repetitive but won't break.

**V2:** Semantic color roles stay stable across themes. Danger/destruction reads warm; return/retreat reads cool; progress/ring/target accents should relate.

**Guidance:** `intrusionHue` is the theme keynote and usually matches `doorGlowTint`. Picking it first tends to produce coherent visual results, though working from palette or frame backward also works.

**Known debt:** `zombie-big-box` is still too close to `starter` visually. Do not treat its reused green palette as the standard.

## Assets And Wiring

**W1:** Theme assets live under `src/game/assets/themes/<worldId>/`, with card insets in `src/game/assets/themes/<worldId>/insets/`. A world usually needs:

- one reality/backdrop image
- one intrusion overlay
- one cardfront
- one inset per themed card

**W2:** Inset keys must be unique and registered. A card's `insetKey` in JSON must have a matching asset binding. Shared cards use shared `inset-*` keys.

**W3:** A new world is wired in these places:

1. `src/data/worlds/<worldId>/cards.json`
2. `src/data/worlds/<worldId>/meta.ts`
3. `src/data/worlds/<worldId>/theme.ts`
4. `src/data/worlds/<worldId>/index.ts`
5. `src/data/worlds/registry.ts`
6. `src/game/worlds/assetBindings.ts`
7. `src/game/data/assetManifest.ts`
8. Theme assets under `src/game/assets/themes/<worldId>/`

The derived manifests (`worldManifest`, `themeManifest`, display/help/light manifests) project from `worldDataRegistry`. Do not add one-off builders when the registry pattern can carry the world.

## Author Checklist

Use this as rough orientation, not a prescribed pipeline. Some authors design visuals first and retro-fit cards; others iterate simultaneously on assets and mechanics. The critical invariant is that every item below resolves before the world ships:

1. Pick the kebab-case `worldId`.
2. Write the three-beat fiction: ordinary place -> Walker + catastrophe -> Door.
3. Assign the exclusive signature player verb.
4. Fill the card recipe with themed names, flavor, existing effects, and valid keywords (or new ones with engine support).
5. Lay out three acts whose size curve expresses the threat; end act 3 with one `The Walker`.
6. Resolve the palette — `intrusionHue`, frame, backdrop, cardfront.
7. Add assets and asset bindings.
8. Register the world bundle in `worldDataRegistry`.
9. Verify `selectTheme(worldId)` returns the theme, `buildWorld(worldId)` assembles, no duplicate template ids exist, asset bindings resolve, and tests pass.
