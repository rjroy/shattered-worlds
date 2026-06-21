---
title: "Implementation plan: The Tidal Archive world"
date: 2026-06-20
status: executed
tags: [plan, world-design, the-tidal-archive, core-effect, displacement, discard-recall]
modules: [core-engine, world-data, game-view, themes]
related: [.lore/work/specs/the-tidal-archive.md, .lore/reference/theme-authoring.md, src/game/assets/themes/the-tidal-archive/CATACLYSM.md]
---

# Implementation plan: The Tidal Archive world

Implements [the-tidal-archive spec](../specs/the-tidal-archive.md) (`REQ-TIDAL-1` … `REQ-TIDAL-58`). The Tidal Archive is the seventh world: threat verb **displace**, signature rule **Tidal Memory** (end of each turn the Archive recalls one player discard to the top of the player deck). It introduces two new core effects (`ReturnPlayerDiscardToTop`, `RecallPlayerDiscard`), a per-world end-turn passive hook, and a discard-targeting selection flow.

## Scope decisions (resolved before drafting)

These two choices shape the plan and intentionally diverge from the literal spec; the divergences are tracked so the spec can be reconciled at the end.

- **Card insets are deferred (omit `insetKey`).** Tidal cards ship with no `insetKey`. `REQ-TIDAL-3` (one inset per card, `tidal-inset-*` namespace) and the inset half of `REQ-TIDAL-46` are **deferred to a follow-up art pass**, matching the bird-building / highway-volcano precedent. `REQ-TIDAL-56` is satisfied for the base keys only (reality, intrusion, cardfront, music); with no `insetKey` references, `referencedAssetKeys(bundle)` returns only base keys, so asset validation passes without falling back to starter art. The discard chooser (`REQ-TIDAL-14`) will simply render no inset thumbnail for these cards.
- **Full discard chooser overlay.** The renderer gets the complete compact overlay from `REQ-TIDAL-14` (name, cost, modified/exhaust state; inset slot present but empty for now) with presentation tests per `REQ-TIDAL-57`.

Two smaller defaults, taken without a question because precedent makes them unambiguous:

- **Music reuses an existing track.** `bundle.musicKey = "music-the-tidal-archive"` bound in `worldMusicManifest` to an existing imported url (whiteout already reuses fog's track this way). No new audio asset is required for the world to load or pass tests.
- **World stays visible in select.** The world-select carousel scrolls (`visibleWorldCount: 3`, six worlds already work). Register Tidal normally and verify the carousel renders seven; `REQ-TIDAL-49`'s "data-ready but hidden" path is the documented fallback only if verification shows breakage.

## Review corrections (2026-06-20)

Found during a cross-plan review and resolved with the user; folded into Slice B and the spec reconciliation (Slice D). These mirror decisions already ratified into the Ember Orchard and City of Sleeping Giants plans/specs.

1. **`Hidden` → `Obstructed` (build blocker).** The engine has no `Hidden` keyword (`KeywordName = "Obstructed" | "Creature" | "Slow" | "Spore" | "Concealed"`, `src/core/model/types.ts:12`). This plan and `REQ-TIDAL-22` authored `Hidden` on `Wandering Stacks`, `Drowned Index`, and `Misfiled Century`; all become `Obstructed`. Without this the world fails keyword validation.
2. **Inert `Brace` → a creature snatches (`ForceDestroy`).** `Anchor the Memory` grants `Brace`, and `REQ-TIDAL-26` says its copy must describe "anchoring the next snatch or forced loss" — but no Tidal card produced a snatch, so `Brace` absorbed nothing. **`Chained Books Rising` (the `Creature`) now snatches:** its `onEndOfTurn` `Damage 1` → `ForceDestroy 1` (the rising books grab a page from your hand), following the `bird-building` creature-snatch language. `ForceDestroy` removes cards from hand outright (`draw.ts:254`), not to discard, so it does not feed Tidal Memory's recall. `ForceDestroy` is an existing effect — vocab addition only.
3. **`ReturnWorldCards` inert on a world auto-hook → top-deck recurrence.** `Bridge to Yesterday` `onCleared: ReturnWorldCards` is a silent no-op: auto-hooks never supply the player selection `ReturnWorldCards` reads (`ctx.returnIds` undefined), and the card's "you choose which world card to revisit" concept can't run on a clear hook. Re-expressed (mirroring City decision §2) as `onCleared: AddWorldCardToDeck { template: "Misfiled Century", bTop: true }` — clearing it revisits a known recurrence hazard, preserving "clearing is not pure upside." (`Waterproof Notes`' `ReturnWorldCards` is fine — it is player-played, so selection works.)
4. **Reward-dump → boon choice.** `Drowned Index` (the tool-fetch hazard) granted two fixed cards per clear via `Sequence[GainCard ×2]`, ×3 copies. Converted to `OfferBoon` over the Tidal reward kit (offer 3, choose 1), unifying reward delivery with Ember/City. The five reward cards are single-sourced in a new `tidal-boons` boon source (Slice B7) shared with the hazards' fixed `GainCard` grants. `OfferBoon` is an existing effect — vocab addition only.

## Architecture orientation (verified in code)

| Concern | File | Anchor |
|---|---|---|
| `CardEffect` union | `src/core/model/types.ts` | ~25–94 |
| `GameEvent` union | `src/core/model/types.ts` | ~272–337 |
| `TargetSpec` union | `src/core/model/types.ts` | ~247–255 |
| `PlayCard` action fields | `src/core/model/types.ts` | 145–152 |
| `GameState` (zones, `worldId`) | `src/core/model/types.ts` | 170–211 |
| Effect dispatch table | `src/core/effects/registry.ts` | `EFFECTS` 34–67 |
| `applyEffect` / `dispatch` | `src/core/engine/effects.ts` | 54–111 |
| `EffectContext` / `EffectResult` | `src/core/effects/EffectContext.ts` | 28–70 |
| Zone-move helper pattern | `src/core/effects/gainCard.ts` | `gainCard` 43–86; `isPlayable() => false` precedent 115/165/186 |
| `legalTargets` per handler | `src/core/engine/available.ts` | 77–138 |
| **Runtime action gate** (`TargetSpec` switch, **no `default`**) | `src/core/engine/available.ts` | `checkSpec` 164–251 |
| **Sim/bot policy** (`TargetSpec` switch) | `src/sim/policy.ts` | `buildPlayAction` 48–200 |
| End-turn orchestration | `src/core/engine/reduce.ts` | `handleEndTurn` 148–282 |
| `createWorld` (state bootstrap) | `src/core/engine/world.ts` | 75–153 |
| `WorldData` / `RawCardSource` | `src/core/model/catalog.ts` | 17–40 |
| `makeWorldBuilder` (source→WorldData) | `src/data/worldManifest.ts` | ~24–60 |
| Registry | `src/data/worlds/registry.ts` | 10–15 |
| `worldThreatTemplateByWorldId` | `src/core/effects/gainCard.ts` | `WORLD_THREAT_BY_WORLD_ID` 26–41 |
| Asset bindings + music manifest | `src/game/worlds/assetBindings.ts` | base ~1–33, insets ~78–91, music 107–226 |
| Selection state machine | `src/game/interaction/selection.ts` | 14–150 |
| Effect description / glyph text | `src/game/view/presentation.ts`, `effectLineView.ts`, `effectLineLayout.ts` | — |

**Key constraint 1 — passive threading:** `reduce(catalog, state, action)` does **not** receive `WorldData`. The per-world end-turn passive (`REQ-TIDAL-15/16`) therefore cannot be read from `WorldData` at reduce time. It must be threaded onto `GameState` once, in `createWorld`, as `endOfTurnPassive: CardEffect` (default `{ kind: "None" }`), sourced from `WorldData.onEndOfTurnPassive`. This keeps `handleEndTurn` pure and avoids passing `WorldData` through the reducer.

**Key constraint 2 — `TargetSpec` blast radius:** adding a new `TargetSpec` kind for discard targeting touches **eight `switch`/branch sites across three files** (most with no `default` case), all of which must gain a branch or fail compilation / throw at runtime:

1. `src/core/engine/available.ts` `checkSpec` (164–251) — the runtime gate every `PlayCard` passes through. Without a branch, the new reward cards throw `IllegalActionError` on play (or fail the exhaustiveness check). **This is mandatory, not optional.**
2. `src/game/interaction/selection.ts` — six branch sites (`stepMin` 54, `stepMax` 72, `doesStepResultContain` 89, `advance` 263, `hintForSelection` 381, `buildAction` 431). Miss any one and the chooser produces no hint text or never sets `recallIds` on the action.
3. `src/sim/policy.ts` `buildPlayAction` (48–200) — the sim/bot policy. Without a branch the bot can never legally play `Mark the Shelf`/`Shelf Map`, and tests that drive `pickAction` over a world's catalog may fail.

To reduce the near-anagram readability hazard with the pre-existing `discardPlayer` spec (which means "discard a hand card", the opposite intent), the new spec is named **`recallTarget`** rather than `playerDiscard`.

## Slice plan (three reviewable slices, per `REQ-TIDAL-51`)

<div style="font-family:monospace; line-height:1.5; padding:8px 0;">
<b>Slice A — Core: recall effects + end-turn passive</b> &nbsp;(no renderer, no world data)<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓ <i>depends on A's effect kinds + threat map shape</i><br>
<b>Slice B — World data + registration</b> &nbsp;(cards.json, bundle, registry, threat map)<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓ <i>depends on A's TargetSpec + B's keys</i><br>
<b>Slice C — Assets, selection UI, help, docs</b> &nbsp;(bindings, discard chooser, descriptions, theme-authoring)<br>
&nbsp;&nbsp;&nbsp;&nbsp;↓<br>
<b>Slice D — Validation</b> &nbsp;(replay/smoke/full-suite + spec reconciliation)
</div>

Each slice ends green on `bun run test` (note: **`bun run test`**, never `bun test` — preload is required) before the next begins.

---

## Slice A — Core: recall effects and end-turn passive

Pure `src/core/` work. No world data, no renderer. Covers `REQ-TIDAL-9` … `REQ-TIDAL-18`, plus the test requirements `REQ-TIDAL-52/53/54`.

### A1. Types and seams (`src/core/model/types.ts`)

- Add to the `CardEffect` union:
  - `{ kind: "ReturnPlayerDiscardToTop"; min: number; max: number }` (`REQ-TIDAL-10`)
  - `{ kind: "RecallPlayerDiscard"; count?: number; policy?: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst" }` (`REQ-TIDAL-11`)
- Add to the `GameEvent` union (`REQ-TIDAL-12`):
  - `{ type: "PlayerDiscardRecalled"; cardIds: readonly CardId[]; templateIds: readonly CardTemplateId[]; source: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst" | "playerSelected"; dest: "playerDrawTop" }`
- Add to the `TargetSpec` union: `{ kind: "recallTarget"; min: number; max: number }` (drives the chooser in Slice C; `legalTargets` returns ids from `playerDiscard`). Named `recallTarget` to avoid collision with the existing `discardPlayer` spec (see Key constraint 2).
- Add to the `PlayCard` action (after line 152): `recallIds?: readonly CardId[]` — the player-selected discard ids for `ReturnPlayerDiscardToTop`.
- Add to `GameState`: `endOfTurnPassive: CardEffect` (the threaded per-world passive; not optional on state — populated by `createWorld`).

### A2. Context plumbing and the `TargetSpec` switch sites

- `src/core/effects/EffectContext.ts`: add `readonly recallIds?: readonly CardId[]` to `EffectContext`.
- `src/core/engine/effects.ts` (`applyEffect`, ~54–98): destructure `recallIds` from the action alongside `targetId/returnIds/destroyIds/thawIds/discardId/choice` and place it in the built `EffectContext`. No change to the provenance-stamping logic.
- **`src/core/engine/available.ts` `checkSpec` (164–251) — mandatory.** Add `case "recallTarget":` mirroring the existing `case "returnWorld":` branch: validate that the action's `recallIds` count is within `[min, max]` and that each id is a member of `legalTargets`. Omitting this makes `Mark the Shelf`/`Shelf Map` throw `IllegalActionError` on every play (`REQ-TIDAL-10/23/27`).
- **`src/sim/policy.ts` `buildPlayAction` (48–200).** Add a `case "recallTarget":` branch (top-level switch ~57 and, if reachable inside `Sequence`/compound at ~133, that path too) so the bot/sim policy can emit a `PlayCard` with `recallIds` for these reward cards. Confirm whether `bun run test` exercises `policy.ts` against newly-registered worlds; if it does, this is a gating compile/runtime fix, not just bot completeness.

The renderer-side `selection.ts` switch sites (six of them) are handled in Slice C2, since `selection.ts` lives under `src/game/`.

### A3. New handler module `src/core/effects/recallDiscard.ts`

Mirror the structure of `worldCards.ts` (`returnToActiveWorldDeck` + handler classes). One shared helper plus two handlers:

- `recallToTop(state, ids, source): EffectResult` — the single zone-move entry point (avoids two code paths doing the same thing). For each id found in `state.playerDiscard`, remove it from `playerDiscard` and prepend to `playerDraw` **preserving the exact card instance** (id, templateId, modified, exhaust, frozen, keywords, rarity, sourceWorldId, all instance metadata — do not re-mint; `REQ-TIDAL-9`). Order: selected/selected-order cards land on top in the given order (`REQ-TIDAL-10`). Emits one `PlayerDiscardRecalled` with the recalled ids/templateIds, `source`, `dest: "playerDrawTop"`. Empty/!found ids → no-op, no event when nothing moved (`REQ-TIDAL-13`).
- `ReturnPlayerDiscardToTopHandler` — reads `ctx.recallIds`, validates count against `[min,max]`, calls `recallToTop(..., "playerSelected")`. Implements `legalTargets(effect, selfId, state)` (signature `(effect, selfId, state)`, confirmed) returning `state.playerDiscard` card ids (consumed by the `recallTarget` `TargetSpec`). Playability via `isPlayable`: if `min > 0` and fewer than `min` legal discard targets exist, the card is unplayable (`REQ-TIDAL-13`); `min: 0` makes zero-selection a legal no-op (`REQ-TIDAL-52`) — mirror `ReturnWorldCardsHandler`'s `isPlayable`/`legalTargets`/`connectorStyle` shape. Set `connectorStyle() => null` (the chooser is an overlay, not an in-hand connector line); state this rather than leaving it implicit.
- `RecallPlayerDiscardHandler` — automatic form for hazards/passive (`REQ-TIDAL-11`). It is **never played from hand** (only fired from `onEndOfTurn` hooks and the world passive), so override `isPlayable() => false` (precedent: `GainCardHandler`/`AddPlayerCardToTopHandler` in `gainCard.ts`) to keep `availableActions` from ever reporting it as a hand-playable target. Resolves `count ?? 1` cards from `playerDiscard` by `policy ?? "latest"`. All policy selection defensively filters `playerDiscard` to `kind === "player"` first (the `Card[]` type does not enforce the invariant even though every current discard path does):
  - `latest`: head of `playerDiscard` (most recently discarded — confirm discard insertion order is prepend; `handleEndTurn` prepends, so head = latest).
  - `lowestCost` / `highestCost`: by player card `energyCost` (world cards have no `energyCost`; restrict policy selection to player cards, tie-break by latest).
  - `panicFirst`: pick a `Panic` (template `"Panic"`, confirmed in `starters/basic.json`) if present, else fall back to `latest` (`REQ-TIDAL-11`).
  - `random`: pick via the seeded run RNG (`state.rng`, `nextFloat`/`shuffle` in `engine/rng.ts`), thread `rng` back into returned state, and emit enough in the event (the resolved `cardIds`) for replay verification (`REQ-TIDAL-11`, `REQ-TIDAL-53`).
  - Empty `playerDiscard` → no-op, no event (`REQ-TIDAL-13`). Calls `recallToTop` with the chosen ids.

### A4. Register handlers (`src/core/effects/registry.ts`)

Add `ReturnPlayerDiscardToTop: new ReturnPlayerDiscardToTopHandler()` and `RecallPlayerDiscard: new RecallPlayerDiscardHandler()` to `EFFECTS`. Confirm the union exhaustiveness check (the `as never` dispatch) still compiles.

### A5. Per-world end-turn passive hook

- `src/core/model/catalog.ts`: add `onEndOfTurnPassive?: CardEffect` to both `RawCardSource` (17–40) and `WorldData`. Default semantics: absent ⇒ `{ kind: "None" }`.
- `src/data/worldManifest.ts` (`makeWorldBuilder`, ~40): spread `onEndOfTurnPassive` into the built `WorldData` only when present (same `exactOptionalPropertyTypes` pattern used for `startLight`/`startHeat`).
- `src/core/engine/world.ts` (`createWorld`, skeleton ~86): set `endOfTurnPassive: world.onEndOfTurnPassive ?? { kind: "None" }` on the bootstrap `GameState`.
- `src/core/engine/reduce.ts` (`handleEndTurn`): insert the passive **after** unretained player cards are discarded (after ~167–185) and **before** `startTurn` (~187). Ordering per `REQ-TIDAL-17`: world `onEndOfTurn` hooks → discard unretained player cards → **passive recall from `playerDiscard` to top of `playerDraw`** → `startTurn` refill. Apply via `applyEffect(catalog, current, current.endOfTurnPassive, undefined, undefined)`; skip the call entirely (no event) when the passive is `{ kind: "None" }` so non-Tidal worlds are byte-identical (`REQ-TIDAL-18`). Respect the existing `status` short-circuit pattern after applying.

### A6. Tests (`src/core/tests/`)

New `recallDiscard.test.ts` (follow `effects.test.ts` `makeState`/`mintWorld` harness):

- `ReturnPlayerDiscardToTop` (`REQ-TIDAL-52`): select from `playerDiscard`; instance identity preserved (same `id`, `modified`/`exhaust`/`frozen` flags intact); multiple selected cards ordered on top of `playerDraw`; `PlayerDiscardRecalled` emitted with `source: "playerSelected"`; unplayable when `min` can't be met; `min: 0` zero-selection no-op.
- `RecallPlayerDiscard` (`REQ-TIDAL-53`): each policy (`latest`, `lowestCost`, `highestCost`, `panicFirst` incl. fallback, `random` deterministic across two identical seeded runs); empty-discard no-op; event emission; recalled instance data preserved.
- End-turn ordering (`REQ-TIDAL-54`): in a world whose `onEndOfTurnPassive` is `RecallPlayerDiscard latest`, a player card discarded at end of turn is recalled by the passive and then drawn during the same transition into the next turn. Use a synthetic `WorldData` with the passive set (does not depend on Slice B).
- Non-Tidal regression (`REQ-TIDAL-18`): a world with default passive emits no `PlayerDiscardRecalled` and produces an identical end-turn event sequence to the pre-change baseline.

> **Validation gate A:** `bun run test` green. Targeted run of `recallDiscard.test.ts` plus existing `effects.test.ts`, `golden.test.ts`, `reduce`/end-turn tests passes. Type-check clean (new union members exhaustive). No renderer or world-data file touched in this slice.

---

## Slice B — World data and registration

All `src/data/worlds/the-tidal-archive/` authoring plus the threat-map entry. Covers `REQ-TIDAL-1/4/5/6/7/19–41/47/48` (data portions) and the world-data tests `REQ-TIDAL-55`. Canonical structural reference: `src/data/worlds/whiteout-parking-garage/`.

### B1. `cards.json`

- `worldId: "the-tidal-archive"` (`REQ-TIDAL-1`).
- Root `onEndOfTurnPassive: { "kind": "RecallPlayerDiscard", "policy": "latest" }` (Tidal Memory; `REQ-TIDAL-15`).
- **Player reward cards** (`REQ-TIDAL-23–28`), effects use existing + new vocabulary only. Per review correction §4 these are authored in the new boon source `src/data/worlds/boons/tidal.json` (Slice B7), not `cards.json`, so one definition serves both `Drowned Index`'s `OfferBoon` and the hazards' fixed `GainCard` grants (`Waterproof Notes`, `Anchor the Memory`, `Shelf Map`); boon sources merge into every catalog, so all references resolve:
  - `Mark the Shelf` — `ReturnPlayerDiscardToTop min 1 max 1`.
  - `Cross-Reference` — `DiscardThenDraw player 2`.
  - `Waterproof Notes` — `Sequence [ DealProgress base 3, ReturnWorldCards min 0 max 1 ]`.
  - `Anchor the Memory` — `Sequence [ Brace amount 1, Draw player 1 ]`, `exhaust: true`; copy describes anchoring the next snatch, not universal immunity.
  - `Shelf Map` — `Sequence [ DealProgress base 1, ReturnPlayerDiscardToTop min 0 max 1 ]`.
- **World cards** (`REQ-TIDAL-29–36`), every card defines all four hooks `onDiscarded`/`onCleared`/`onPartialClear`/`onEndOfTurn` (`{ "kind": "None" }` where unused; `REQ-TIDAL-36`):
  - `Wandering Stacks` — cost 2, `Obstructed`, discardable, `onEndOfTurn: RecallPlayerDiscard latest`.
  - `Drowned Index` — cost 4, `Obstructed`, discardable, `onCleared: OfferBoon { setId: "tidal-boons", offeredCount: 3, chooseCount: 1 }` *(review correction §4: was `Sequence [ GainCard "Mark the Shelf", GainCard "Cross-Reference" ]`; offers 3 of the five tools, keep 1)*.
  - `Misfiled Century` — cost 3, `Obstructed`, discardable, `onEndOfTurn: AddThreatToWorldDeck`, `onDiscarded: Damage 1`.
  - `Bridge to Yesterday` — cost 3, discardable, `onCleared: AddWorldCardToDeck { template: "Misfiled Century", bTop: true }` *(review correction §3: was inert `ReturnWorldCards`; clearing revisits a known recurrence hazard)*, `onDiscarded: Damage 2`.
  - `Borrowed Catastrophe` — cost 4, `Slow`, discardable, `onEndOfTurn: AddWorldCardToDeck { template: "Misfiled Century", bTop: true }`, `onDiscarded: Damage 2`, `onCleared: GainCard "Waterproof Notes"`.
  - `Chained Books Rising` — cost 4, `Creature`, discardable, `onEndOfTurn: Sequence [ ForceDestroy 1, RecallPlayerDiscard lowestCost ]` *(review correction §2: `Damage 1` → `ForceDestroy 1` so `Anchor the Memory`'s Brace has a snatch to absorb)*, `onDiscarded: RecallPlayerDiscard latest`, `onCleared: GainCard "Anchor the Memory"`.
  - `The Same Footprint` — cost 6, `Slow`, discardable with high penalty, `onEndOfTurn: Sequence [ RecallPlayerDiscard panicFirst, AddThreatToWorldDeck ]`, `onCleared: GainCard "Shelf Map"`, `onDiscarded: Damage 3`.
- Keywords restricted to `Obstructed`, `Creature`, `Slow` only (`REQ-TIDAL-22`; review correction §1 — `Hidden` is not a valid engine keyword). No `insetKey` on any template (deferred-inset decision). No stale aliases — use `AddWorldCardToDeck { bTop: true }` and `AddCard { dest: "playerDrawTop" }`, never `AddWorldCardToTop` (`REQ-TIDAL-20`).
- `deckComposition.acts` exactly three acts per the `REQ-TIDAL-39` table; Act 3 ends with exactly `{ "templateId": "The Walker", "count": 1 }` (`REQ-TIDAL-40`). No junk-template pollution (`REQ-TIDAL-41`). Confirm at least one early hazard is low/no-damage on discard and one mid hazard makes clear-vs-discard a real choice (`REQ-TIDAL-37`).
- Do not redefine `The Walker` / `Summon Door` / `Door` (`REQ-TIDAL-6`).

### B2. `theme.ts` (`REQ-TIDAL-42`, structural only here; palette detail finalized in Slice C)

Export `THE_TIDAL_ARCHIVE_THEME: VisualTheme` with `worldId: "the-tidal-archive"`, `intrusionHue: "#7657ff"` (violet keynote, matches `doorGlowTint`), turquoise/coral semantic accents, `backdrop.realityKey: "the-tidal-archive-bg"`, `backdrop.intrusionKey: "the-tidal-archive-overlay"`, `worldCardfrontKey: "the-tidal-archive-cardfront"`.

### B3. `meta.ts` (`REQ-TIDAL-47/48`)

Export `THE_TIDAL_ARCHIVE_DISPLAY` (name, tagline, story = place-vs-disaster contrast, difficulty, `backgroundKey: "the-tidal-archive-bg"`) and `THE_TIDAL_ARCHIVE_HELP` with mechanics notes covering: Tidal Memory returns one discard to the top each turn; hazards change which card returns or what the world deck repeats; Tidal rewards let the player set up the top of the deck deliberately. Fit the existing 4–5 note budget.

### B4. `index.ts`

Export `THE_TIDAL_ARCHIVE_BUNDLE: WorldDataBundle` — `id: "the-tidal-archive"`, `source: cards.json as unknown as RawCardSource`, `theme`, `display`, `help`, `musicKey: "music-the-tidal-archive"`. (`usesLight`/`usesHeat` omitted.)

### B5. Registration

- `src/data/worlds/registry.ts`: import and append `THE_TIDAL_ARCHIVE_BUNDLE` (`REQ-TIDAL-4`). All derived manifests project automatically.
- `src/core/effects/gainCard.ts`: add `"the-tidal-archive": "The Same Footprint"` to `WORLD_THREAT_BY_WORLD_ID` (`REQ-TIDAL-21`).

### B6. Boon source + `BOON_SET` registration (review correction §4)

Author `src/data/worlds/boons/tidal.json` — a boon/reward card source mirroring `big-box.json`: `worldId: "tidal-boons"`, `cardTemplates` holding the five player reward cards (`Mark the Shelf`, `Cross-Reference`, `Waterproof Notes`, `Anchor the Memory`, `Shelf Map`) with the exact effects/costs from the B1 reward list. These are the **single** definition of the rewards — `cards.json` does not redefine them.

Register in `src/data/worlds/boons/fortune.ts`: import the JSON, export `TIDAL_BOON_SOURCE`, add a `"tidal-boons"` entry to `BOON_SETS` (`{ source: TIDAL_BOON_SOURCE, templateIds: [...the five...] }`) plus the matching `FORTUNE_BOON_POOLS` line. `worldManifest.ts` derives `BOON_SET_SOURCES` from `BOON_SETS`, so the source merges into every catalog automatically — that is what makes `Drowned Index`'s `OfferBoon` and the hazards' `GainCard` refs both resolve. Pick a `setName` for the offer UI (e.g. "The Reading Room"). `offeredCount 3, chooseCount 1` matches Ember/City; `chooseCount 2` is a tuning option if the kit should arrive faster.

### B7. Tests (`src/core/tests/`)

The registry-parameterized suites (`worldRegistry.test.ts`, `worldManifest.test.ts`) auto-cover Tidal; ensure they pass and add Tidal-specific assertions (`REQ-TIDAL-55`): no duplicate template ids; every Tidal world card defines all four hooks; only valid keywords (all `Obstructed`/`Creature`/`Slow`, no `Hidden`); Act 3 ends with `The Walker`; `THE_TIDAL_ARCHIVE_BUNDLE` is in `worldDataRegistry`; `buildWorld("the-tidal-archive")` succeeds; `worldThreatTemplateByWorldId("the-tidal-archive") === "The Same Footprint"`; the passive threads through to `GameState.endOfTurnPassive`. Drive the reducer for the review-correction patterns: `Drowned Index` `onCleared` creates a boon offer from the `tidal-boons` pool (not a two-card grant); `Chained Books Rising` `onEndOfTurn` queues `ForceDestroy` (not HP `Damage`) and a `Brace` charge absorbs the snatch end-to-end; `Bridge to Yesterday` `onCleared` top-decks `Misfiled Century`.

> **Validation gate B:** `bun run test` green. `buildWorld("the-tidal-archive")` and `selectTheme("the-tidal-archive")` succeed. All effect template refs in `cards.json` resolve in the assembled catalog. Note that `selectTheme` returns the real theme (not the `STARTER` fallback), proving `worldId` did not drift (`RULE 0`).

---

## Slice C — Assets, selection UI, help text, and docs

Renderer + bindings + documentation. Covers `REQ-TIDAL-2/14/42–46` (presentation), `REQ-TIDAL-49`, `REQ-TIDAL-50`, and presentation tests `REQ-TIDAL-57`. Card-inset visuals (`REQ-TIDAL-3`, inset half of `REQ-TIDAL-46`) are explicitly deferred.

### C1. Asset bindings (`src/game/worlds/assetBindings.ts`) (`REQ-TIDAL-2`)

- Import the three existing base assets (confirmed present under `src/game/assets/themes/the-tidal-archive/`): `the-tidal-archive-reality.webp`, `intrusion-overlay.webp`, `the-tidal-archive-cardfront.webp`. Do **not** regenerate them.
- Add to `worldAssetUrls`: `"the-tidal-archive-bg"`, `"the-tidal-archive-overlay"`, `"the-tidal-archive-cardfront"`.
- Add to `worldMusicManifest`: `"the-tidal-archive": { key: "music-the-tidal-archive", url: <reused existing music url> }`.
- No inset imports (deferred). `src/game/data/assetManifest.ts` spreads `worldAssetUrls`, so base keys flow through automatically — verify.

### C2. Discard chooser selection flow (`REQ-TIDAL-14`)

- `src/game/interaction/selection.ts` — add a `StepResult` variant carrying `recallIds`, and add a `case "recallTarget":` branch to **all six** switch/branch sites (confirmed by reading the file): `stepMin` (54), `stepMax` (72), `doesStepResultContain` (89), `advance` result-building switch (263), `hintForSelection` (381, supply the picker's instruction text), and `buildAction` (431, set `PlayCard.recallIds`). Missing any one silently breaks the chooser (no hint, or `recallIds` never set). Targets come from the core `legalTargets` (Slice A).
- New renderer overlay component (compact discard chooser): lists the player's `playerDiscard` cards showing **name, cost, inset slot (empty for Tidal), and modified/exhaust state**, enforces `min`/`max`, confirms selection. Reuse existing selection-overlay scaffolding/styling where one exists rather than a bespoke widget.
- **Trigger and dismissal / `min: 0` flow (resolve, don't guess):** playing `Mark the Shelf` opens the chooser (min 1) when `playerDiscard` is non-empty. For `min: 0` cards (`Shelf Map`) the flow must auto-skip cleanly when the pile is empty (no empty chooser shown) and otherwise show a chooser with a "confirm 0" affordance. Decide whether this reuses the existing zero-length `skipNoneSteps` auto-advance (selection.ts 47) or needs a parallel "zero legal targets and `min === 0`" skip, since `stepMin`/`stepMax` do not currently special-case empty legal-target sets. Spell out the chosen mechanism in the implementation note before building the overlay.

### C3. Effect descriptions / glyphs (`REQ-TIDAL-57`)

Add description + glyph text for `ReturnPlayerDiscardToTop` and `RecallPlayerDiscard` in the effect-description layer (`src/game/view/presentation.ts`, `effectLineView.ts`, `effectLineLayout.ts`). Extend `src/game/tests/effectGlyphs.test.ts` / `describe.test.ts` so both new effects render readable text.

### C4. Theme finalization (`REQ-TIDAL-42–45`)

Confirm `theme.ts` palette reads at a glance against the other six worlds: violet intrusion keynote, turquoise return/displace accents, coral danger accents, frame family distinct. Cardfront readable at card scale (existing asset; just wired).

### C5. World-select verification (`REQ-TIDAL-49`)

Verify the world-select carousel renders the seventh world cleanly (scrolling). If it does not, apply the spec's fallback: keep Tidal registered (so `buildWorld`/`selectTheme`/tests still work) but hidden from normal selection until the layout is extended — and capture that as a follow-up.

### C6. Documentation (`REQ-TIDAL-50`)

Update `.lore/reference/theme-authoring.md`: add Tidal to the signature-verb table (`displace`), add `ReturnPlayerDiscardToTop` and `RecallPlayerDiscard` to the effect vocabulary list and the exclusive-effects table (owner `the-tidal-archive`, "owns discard/deck-order recall"), and note the new per-world `onEndOfTurnPassive` hook.

While editing the effect-vocabulary section (the exact section being touched), also fix the stale aliases already present there that `REQ-TIDAL-20` confirms no longer exist in code: `AddWorldCardToTop` (lines 84, 96 → `AddWorldCardToDeck { bTop: true }`) and `SkipDrawNextTurn` (line 59, 96). Fixing this at the source prevents future worlds from reproducing the stale vocabulary the way this section already invited. If the user prefers to keep that cleanup out of this change, leave a follow-up note instead — but do not add the new, correct recall effects directly beside three known-wrong entries without flagging it.

### C7. Presentation tests

Cover the discard chooser overlay (renders the required fields, enforces min/max) and the two new effect descriptions (`REQ-TIDAL-57`).

> **Validation gate C:** `bun run test` green incl. `worldAssetBindings.test.ts` (all referenced keys bound, `musicKey` matches) and new presentation tests. Manual: launch the app, select `the-tidal-archive`, confirm backdrop/intrusion/cardfront load (no starter fallback) and the discard chooser appears when playing `Mark the Shelf` with a non-empty discard.

---

## Slice D — Validation and spec reconciliation

Maps to the spec's AI Validation checklist (`REQ-TIDAL-58` and items 1–6).

1. Full `bun run test` passes.
2. Targeted core run: recall effects, end-turn ordering, effect descriptions, selection legality.
3. Targeted world-data run: `buildWorld("the-tidal-archive")`, registry inclusion, unique template ids, all hooks defined, valid keywords, Walker closer.
4. Asset validation: base Tidal keys (`-bg`, `-overlay`, `-cardfront`) and `music-the-tidal-archive` registered and preloadable; **no** `tidal-inset-*` keys referenced (deferred).
5. Seeded replay test (`REQ-TIDAL-58`): one Tidal run segment where a hazard recalls from discard, the passive recalls after hand discard, and `Mark the Shelf` chooses a discard to top-deck; the event stream replays to the same final state across two identical seeds. Add under `src/core/tests/` next to `golden.test.ts`.
6. Smoke test via the `run` skill: select/start `the-tidal-archive`, clear `Drowned Index`, choose `Mark the Shelf` from the boon offer, play it from a non-empty discard, observe the chosen card on top of the player deck.
7. **Spec reconciliation:** the four review corrections (§1 `Hidden`→`Obstructed`; §2 Chained Books Rising `ForceDestroy`; §3 Bridge to Yesterday top-deck; §4 Drowned Index `OfferBoon`) are ratified into `.lore/work/specs/the-tidal-archive.md` (REQ-TIDAL-19/22/26/30/32/34), with `ForceDestroy` and `OfferBoon` added to the REQ-TIDAL-19 vocabulary. Additionally annotate `REQ-TIDAL-3`, the inset half of `REQ-TIDAL-46`, and the inset clause of `REQ-TIDAL-56` as deferred (follow-up art pass), and flip the spec `status` from `draft` toward `implemented` once gates A–C are green. Record the deferral as a `.lore` follow-up note.

> **Validation gate D (final):** every numbered item above is observed, not assumed. The plan is validated against the spec by walking `REQ-TIDAL-1` … `REQ-TIDAL-58` and confirming each is either implemented or explicitly deferred with a recorded rationale.

## Requirement coverage map

- **Core slice (A):** `REQ-TIDAL-9–18`, `52`, `53`, `54`.
- **World-data slice (B):** `REQ-TIDAL-1`, `4–7`, `19–41`, `47`, `48`, `55`.
- **Assets/presentation slice (C):** `REQ-TIDAL-2`, `14`, `42–46` (insets deferred), `49`, `50`, `57`.
- **Validation slice (D):** `REQ-TIDAL-51` (satisfied by the three-slice split), `56`, `58`.
- **Review corrections (2026-06-20), ratified into spec:** `REQ-TIDAL-22` (`Hidden`→`Obstructed`), `REQ-TIDAL-34` (Chained Books Rising `Damage`→`ForceDestroy`), `REQ-TIDAL-32` (Bridge to Yesterday `ReturnWorldCards`→top-deck), `REQ-TIDAL-30` (Drowned Index `Sequence[GainCard ×2]`→`OfferBoon` + `tidal-boons` source), `REQ-TIDAL-19` (vocab: add `ForceDestroy`, `OfferBoon`).
- **Deferred:** `REQ-TIDAL-3`, inset portions of `REQ-TIDAL-8`/`REQ-TIDAL-46`, inset clause of `REQ-TIDAL-56` — tracked for a follow-up art pass.
