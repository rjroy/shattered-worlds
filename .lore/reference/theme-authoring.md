# Shattered Worlds - Theme Authoring Rules

<!--
date: 2026-06-10
status: current
tags: theme, world, authoring, rules, the-walker, deck, visual-theme, reference
fg-type: architecture
fg-sources: .lore/work/specs/overgrown-mall.html, .lore/work/specs/fog-beach-party.html, .lore/work/brainstorm/shard-response-archetypes.html
related: .lore/reference/visual-direction.html, .lore/reference/vision.html
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
6. **Signature player verb** - the world's exclusive mechanical identity. This is not a code field; it is an authorship invariant.

| World | Signature verb | Reward-card implication |
| --- | --- | --- |
| `zombie-big-box` | sweep and noise | Interact with `Creature`/`Slow` clusters and multi-clear moments |
| `highway-volcano` | everything is fuel | Convert discards or exhaust triggers into resources |
| `bird-building` | travel light | Trim hand size, recycle cheap cards, prefer efficiency over force |
| `overgrown-mall` | prune and profit | Self-pruning `Spore`; `Bloom` scales from Spores; owns `DealProgressScaled` |
| `fog-beach-party` | reveal and endure | Light economy; owns `GainLight`; reveals `Concealed` hazards |
| `whiteout-parking-garage` | freeze | Heat economy; owns `GainHeat`, `FreezeCards`, `ThawCards`, frozen cards stop hand usability |

This is a living registry — each new world adds an entry. The verb captures the exclusive mechanical identity of that world; no two worlds should feel interchangeable.

**SV1:** Enforce the signature verb at authorship time. If a reward card would fit another world's verb, reconsider whether it adds something genuinely new or just duplicates mechanical territory.

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

**Progress / Damage:** `DealProgress`, `DealProgressScaled` _(overgrown-mall exclusive)_, `DealProgressAll`, `Damage`, `DamageScaled`

**Draw / Return:** `Draw`, `DiscardThenDraw`, `ReturnWorldCards`, `ReturnPlayerDiscardToTop` _(Tidal: player-selected recall to draw top)_, `RecallPlayerDiscard` _(Tidal: automatic recall from discard)_

**Resource:** `Heal`, `GainEnergy`, `AddCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck` (use `bTop: true` for top-of-deck placement), `AddThreatToWorldDeck`, `GainRandomCard` _(rolled from named pool)_, `GainLight` _(fog-beach-party exclusive)_, `GainHeat`

**Hand / discard manipulation:** `DestroyCardInHand`, `ExileTopWorldCards`, `ForceDestroy`, `Brace`

**State change / terminal:** `FreezeCards`, `ThawCards`, `OfferBoon` _(boon selection)_, `Modal` _(player choice between branches)_, `Sequence` _(ordered steps)_, `DestroySelf` _(world card self-removal in onEndOfTurn)_, `SurviveWorld`, `None`

</details>

Theme-owned exclusive effects — reuse across worlds requires coordination:

| Effect | Owner | Note |
| --- | --- | --- |
| `DealProgressScaled` | `overgrown-mall` | Exclusive now; others may use it with design review |
| `GainLight` | `fog-beach-party` | The only way to lift `Concealed:N` depth — tied to Light resource |
| `GainHeat`, `FreezeCards`, `ThawCards` | `whiteout-parking-garage` | Heat/freeze/thaw economy suite

**C1a:** `DestroySelf` removes the firing world card from hand. It is only meaningful in `onEndOfTurn`, where the engine has a `selfId`.

**C2:** The current keyword vocabulary is `Obstructed`, `Creature`, `Slow`, `Spore`, and `Concealed`. These cover the engine's supported keyword semantics today. Introducing a new keyword is a valid design decision when a theme needs a semantic category that doesn't map to any existing one — but it requires wiring an engine handler.

**C2a:** Keywords are authored as strings in `keywords`: `"Name"` or `"Name:N"`. A bare keyword has no value; a numeric keyword parses to `{ name, value }`. Currently only `Concealed` uses a value (Light depth); future keywords can adopt other structures with engine support.

**C3:** Every world card defines `onDiscarded`, `onCleared`, and `onEndOfTurn`; use `{ "kind": "None" }` when a hook does nothing. Player cards define `effect`.

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
