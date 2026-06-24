---
title: "Implementation plan: The Ember Orchard world"
date: 2026-06-20
status: draft
tags: [plan, world-design, the-ember-orchard, incubation, themes]
modules: [world-data, themes, game-view, unlocks]
related: [.lore/work/specs/the-ember-orchard.md, .lore/reference/theme-authoring.md, src/game/assets/themes/the-ember-orchard/CATACLYSM.md]
---

# Implementation plan: The Ember Orchard world

Implements [the-ember-orchard spec](../specs/the-ember-orchard.md) (REQ-EMBER-1..50). The Ember Orchard is the seventh world: threat verb **incubate** — immediate warmth that creates delayed, known future pressure. It ships entirely on the **current engine vocabulary**, with no new timed-state core feature (REQ-EMBER-9, REQ-EMBER-15).

The canonical template for this work is `whiteout-parking-garage` (most recent world, full inset set, tool-fetch + signature-threat shape). Mirror its file structure exactly.

## Key decisions (resolved before drafting)

These five were ambiguous in the spec, contradicted the code, or were reconsidered after newer effects landed; resolved with the user:

1. **`Hidden` → `Obstructed`.** The engine has no `Hidden` keyword. `KeywordName = "Obstructed" | "Creature" | "Slow" | "Spore" | "Concealed"` (`src/core/model/types.ts:12`). `Hidden` is the stale pre-rename name still used by the spec and by `theme-authoring.md`. **Every `Hidden` in REQ-EMBER-12/18/22/25/26 is authored as `Obstructed`.** The doc update (REQ-EMBER-44) also corrects this stale naming.
2. **Generate real inset art now.** All 14 card insets are produced via art-gen to the whiteout quality bar (REQ-EMBER-40/48). None exist yet — only the 3 base assets are present.
3. **Gate via the unlock system.** Ember is added to `UNLOCK_CATALOG` as a `worldUnlock` (like fog/whiteout), requiring an unlock + unlock art to appear in World Select. `buildWorld`/`selectTheme` still work in tests regardless (REQ-EMBER-43).
4. **Reward delivery is a boon choice, not a five-card dump.** REQ-EMBER-26's initial shape has `Hatchery Cellar` `onCleared` grant all five tools via `Sequence`[`GainCard` ×5]. With Hatchery Cellar at ×2 (Act 1) + ×1 (Act 2), that floods a starter-sized deck with up to **15 cards** across a run — pool-destroying dilution. **Decision: `onCleared` instead runs `OfferBoon { setId: "pool-ember-cellar", offeredCount: 3, chooseCount: 1 }`** — each clear offers three of the five tools and the player keeps one. Caps dilution at one chosen card per clear, adds player agency, and uses the `OfferBoon` effect that landed **after** this plan was drafted (commit #84; `src/core/effects/boonChoice.ts`). All six player rewards are **single-sourced** in a new boon source (Slice A8) so `OfferBoon` and the hazards' `GainCard`/`AddPlayerCardToTop`/`Modal` grants resolve from one definition — no duplicated card state. The `pool-ember-cellar` pool is the five Hatchery tools (Take One, Leave One, Star-Pruner, Glasshouse Lantern, Constellation Shears); `Dormant Star` lives in the same source for its `GainCard`/`AddPlayerCardToTop` refs but is **not** in the offer pool. This is a **deliberate spec deviation on REQ-EMBER-26** (effect-kind change, not just tuning) and changes REQ-EMBER-47's Hatchery test; flagged in the pre-flight table, A1, A8, C2, and risks. (Mirrors the same fix applied to the City of Sleeping Giants plan.)
5. **`Brace` needs a snatch source: creatures `ForceDestroy` instead of `Damage`.** The spec grants `Brace` on three reward cards (Dormant Star, Leave One, Glasshouse Lantern — REQ-EMBER-11/17/19) but **no hazard ever produces a snatch** — `ForceDestroy` is not even in REQ-EMBER-9's effect list. `Brace` only absorbs `ForceDestroy` snatches (`resources.ts:75` ↔ `worldCards.ts:171`), so **as specced, Brace is inert** — the player gains a defense against nothing. **Decision: the Ember *creatures* deal `ForceDestroy` (snatch cards) rather than `Damage`,** following the established `bird-building` language (Gripping Talon, a `Creature`: `onEndOfTurn ForceDestroy 1`, `onDiscarded ForceDestroy 2`; `Steady` grants the `Brace` counter). This revives Brace and reads better — the hatched swarm *eats your hand*. **Two cards change (A1):** **Ember Moth** (all three `Damage` hooks → `ForceDestroy`; it is Ember's Gripping Talon and is top-decked constantly, so Brace matters from act 1) and **Ground Constellation** (`onDiscarded Damage 3 → ForceDestroy 2`; keeps its signature `DamageScaled` end-of-turn for real HP pressure). Non-creature hazards (Rooted Meteor, The Orchard Counts Wrong) keep `Damage` so HP loss stays a real fail state. `ForceDestroy` is an existing engine effect, so REQ-EMBER-15's no-core-slice holds; it is an addition to REQ-EMBER-9's vocabulary list (existing effect, consistent with its spirit). Deliberate deviation on REQ-EMBER-27/29; flagged in the pre-flight table, A1, C2, and risks.

**No core-engine slice.** Confirmed every effect/keyword/scaling the spec names already exists: `AddWorldCardToDeck` (with `bTop`), `AddThreatToWorldDeck`, `DamageScaled` with `per.kind: "KeywordInHand"`, `ExileTopWorldCards`, `Brace`, `DealProgressAll`, `DestroySelf`. Per REQ-EMBER-45, a core slice is only required if we add true timed incubation, which we are not.

## Pre-flight: engine truth vs. spec wording

| Spec says | Engine reality | Action |
|---|---|---|
| keyword `Hidden` | keyword is `Obstructed` | author `Obstructed` |
| `AddWorldCardToTop` (theme-authoring doc) | `AddWorldCardToDeck { bTop: true }` | use current name (spec REQ-EMBER-10 already correct) |
| world threat mapping | `WORLD_THREAT_BY_WORLD_ID` lives in `src/core/effects/gainCard.ts` | add `the-ember-orchard: "Ground Constellation"` there |
| music per world | whiteout reuses fog's music URL | reuse an existing track; dedicated track optional |
| world insets | file `insets/inset-<card>.webp`, key `<prefix>-inset-<card>` | files `inset-<card>.webp`, keys `ember-inset-<card>` |
| Ember Moth `onEndOfTurn` `ReturnWorldCards` + `Damage` (REQ-EMBER-27) | `ReturnWorldCards` boon-signed & inert on auto-hooks; `Damage` leaves the spec's `Brace` rewards with nothing to absorb | **drop `ReturnWorldCards`; convert Ember Moth's `Damage` → `ForceDestroy`** (creature snatch — decision §5) |
| `Brace` rewards with no `ForceDestroy` anywhere (REQ-EMBER-11/17/19) | `Brace` only absorbs `ForceDestroy` snatches; spec has no snatch source (`ForceDestroy` not in REQ-EMBER-9 list) | **add `ForceDestroy` to the creatures** (Ember Moth, Ground Constellation `onDiscarded`); existing effect, no core slice |
| `Sequence`[`GainCard` ×5] reward dump on Hatchery Cellar `onCleared` (REQ-EMBER-26) | floods a starter-sized deck (×3 copies → up to 15 cards/run); `OfferBoon` now exists (commit #84) | **replace with `OfferBoon { setId: "pool-ember-cellar", offeredCount 3, chooseCount 1 }`**; single-source the rewards in a boon source (A8) |

> ✅ **Ember Moth resolved (REQ-EMBER-27).** The spec's `Sequence[Damage 1, ReturnWorldCards min 0 max 1]` is wrong on two counts: (1) `ReturnWorldCards` returns a *player-selected* world card from hand to the deck, removing a hazard from the player's hand — a benefit to the player, backwards for a threat creature; and (2) it is inert on an unattended `onEndOfTurn` hook anyway (no selection input). **Decision (confirmed with user): drop the return entirely, and convert Ember Moth's remaining `Damage` to `ForceDestroy`** (decision §5 — it is the basic hatched *creature*, and creatures snatch cards so the spec's `Brace` rewards have something to absorb). Moth recurrence already comes from Cracked Hearth-Star, Lantern Brood, and Ground Constellation via working effects. No core change (`ForceDestroy` is an existing effect). Initial values per the A1 table, tunable in the C5 gameplay test.

## Slices (REQ-EMBER-45: at least three reviewable slices)

<div style="font-family:monospace;line-height:1.6;border:1px solid #888;padding:8px 12px;border-radius:6px;">
<b>A. World data + registration + gating</b> &nbsp;──▶&nbsp; <b>B. Assets / presentation / help / docs</b> &nbsp;──▶&nbsp; <b>C. Tests + validation</b><br>
<span style="color:#888;">A is the spine (data must exist first). B depends on A's card roster for inset keys. C validates A+B and is where the spec's AI-validation checklist runs.</span>
</div>

Within a slice, steps are independent unless an arrow says otherwise.

---

## Slice A — World data, registration, unlock gating

Goal: `buildWorld("the-ember-orchard")` and `selectTheme("the-ember-orchard")` assemble cleanly with the full card roster, and the world is registered and gated.

### A1. Author `src/data/worlds/the-ember-orchard/cards.json`

`worldId: "the-ember-orchard"`. No `startHeat` / Light fields (Ember uses neither economy). Full roster below — exact effects from the spec, `Hidden`→`Obstructed`. Every world card defines all four hooks (REQ-EMBER-30); use `{ "kind": "None" }` for unused.

**Player cards** (`kind: "player"`; not in `deckComposition`). Per decision §4 these are authored **not** in `cards.json` but in the new boon source `src/data/worlds/boons/ember.json` (Slice A8), so a single definition serves both `Hatchery Cellar`'s `OfferBoon` and the hazards' `GainCard`/`AddPlayerCardToTop` grants. They resolve from the merged catalog (boon sources merge into every world — `worldManifest.ts:17,44`), so all references below still work. Effects/costs unchanged:

| Card | REQ | Cost | exhaust | effect |
|---|---|---|---|---|
| Dormant Star | 11 | 0 | yes | `Sequence`[`Draw` player 1, `Brace` 1, `AddWorldCardToDeck`{`Ember Moth`, bTop}] |
| Take One | 16 | — | no | `Sequence`[`DealProgress` base 4, `AddWorldCardToDeck`{`Falling Fruit`, bTop}] |
| Leave One | 17 | — | yes | `Sequence`[`ExileTopWorldCards` 1, `Brace` 1] |
| Star-Pruner | 18 | — | no | `DealProgress` base 2, bonus `{ tag: "Obstructed", amount: 2 }` |
| Glasshouse Lantern | 19 | — | yes | `Sequence`[`Draw` player 2, `Brace` 1, `AddWorldCardToDeck`{`Cracked Hearth-Star`, bTop}] |
| Constellation Shears | 20 | — | yes | `DealProgressAll` base 1, bonus `{ tag: "Creature", amount: 1 }` |

Cost column `—` means the `energyCost` field is **omitted** (engine defaults it to 0); the spec assigns no reward-card costs, so all rewards ship at default cost as initial tuning. `Dormant Star` is explicitly cost 0 (REQ-EMBER-11).

**World cards** (`kind: "world"`, `discardable: true`):

| Card | REQ | Cost | Keywords | onCleared | onDiscarded | onPartialClear | onEndOfTurn |
|---|---|---|---|---|---|---|---|
| Cracked Hearth-Star | 22 | 2 | Obstructed | `GainCard` Dormant Star | None | None | `Sequence`[`AddWorldCardToDeck`{Ember Moth, bTop}, `DestroySelf`] |
| Falling Fruit | 23 | 2 | Obstructed | `GainEnergy` 1 | `AddPlayerCardToTop` Dormant Star | `AddPlayerCardToTop` Dormant Star | `AddWorldCardToDeck`{Rooted Meteor, bTop} |
| Rooted Meteor | 24 | 3 | Slow | None | `Damage` 1 | `AddWorldCardToDeck`{Falling Fruit, bTop} | `Damage` 1 |
| The Orchard Counts Wrong | 25 | 4 | Obstructed | `GainCard` Star-Pruner | `Damage` 2 | `AddPlayerCardToTop` Dormant Star | `Sequence`[`Draw` player 1, `AddPlayerCardToTop` Dormant Star] |
| Hatchery Cellar | 26 | 6 | Obstructed | `OfferBoon`{setId "pool-ember-cellar", offeredCount 3, chooseCount 1} *(decision §4: was `Sequence`[`GainCard` ×5]; offers 3 of the five tools, keep 1 — caps dilution, adds agency)* | None | None | `Sequence`[`AddWorldCardToDeck`{Ember Moth, bTop}, `AddWorldCardToDeck`{Falling Fruit, bTop}] |
| Ember Moth | 27 | 4 | Creature | None | `ForceDestroy` 2 | `ForceDestroy` 1 | `ForceDestroy` 1 *(decision §5: creature snatches cards so `Brace` rewards matter; was `Damage`; spec's `ReturnWorldCards` half dropped — see ✅ above)* |
| Lantern Brood | 28 | 4 | Creature, Slow | `GainCard` Leave One | `AddWorldCardToDeck`{Ember Moth, bTop} | `AddWorldCardToDeck`{Ember Moth, bTop} | `AddThreatToWorldDeck` |
| Ground Constellation | 29 | 6 | Creature, Slow | `GainCard` Constellation Shears | `ForceDestroy` 2 | `AddWorldCardToDeck`{Ember Moth, bTop} | `Sequence`[`DamageScaled`{base 0, per `{kind:"KeywordInHand", keyword:"Creature"}`, amount 1}, `AddThreatToWorldDeck`] *(decision §5: `onDiscarded` `Damage 3`→`ForceDestroy 2`; keeps scaling-HP end-of-turn for a real fail state)* |

Self-transform pattern (REQ-EMBER-13) is satisfied by **Cracked Hearth-Star** and the **Falling Fruit → Rooted Meteor** end-of-turn chain (≥2 hazards using `AddWorldCardToDeck{bTop}` + the seed disappearing). Soft-lock safety (REQ-EMBER-31): Cracked Hearth-Star and Falling Fruit deal no discard damage; The Orchard Counts Wrong makes clear-vs-discard a real choice.

> ⚠️ **Hatchery Cellar order (REQ-EMBER-26).** `worldDrawTop` prepends (`[card, ...worldDraw]`, see `gainCard.ts:74`), so the **last** `AddWorldCardToDeck` step in a `Sequence` ends up on top. Step C verifies Ember Moth-then-Falling-Fruit lands Falling Fruit on top; if the intended top card differs, swap the step order — do **not** add new effects.

Each card carries `insetKey: "ember-inset-<kebab-name>"` (keys wired in Slice B).

`deckComposition.acts` (REQ-EMBER-32/33/34 — three acts, Walker closes act 3):

- **Act 1 — Warm Harvest:** Cracked Hearth-Star ×3, Falling Fruit ×3, Hatchery Cellar ×2
- **Act 2 — Cracked Lanterns:** Rooted Meteor ×3, The Orchard Counts Wrong ×2, Ember Moth ×2, Hatchery Cellar ×1
- **Act 3 — Ground Constellation:** Lantern Brood ×2, Rooted Meteor ×2, Ember Moth ×2, Ground Constellation ×2, `{ "templateId": "The Walker", "count": 1 }`

`The Walker` is referenced but **not** defined here (shared starter template; REQ-EMBER-6).

### A2. `src/data/worlds/the-ember-orchard/theme.ts`

Export `THE_EMBER_ORCHARD_THEME: VisualTheme` (model on whiteout `theme.ts`). `worldId: "the-ember-orchard"`. Palette from REQ-EMBER-36: `intrusionHue: "#d45cff"`, `doorGlowTint: 0xd45cff`, ember-gold progress accents, hot orange-red destroy/danger (`connectorDestroy`), cool violet return (`connectorReturn`). `backdrop.realityKey: "the-ember-orchard-bg"`, `backdrop.intrusionKey: "the-ember-orchard-overlay"`, `worldCardfrontKey: "the-ember-orchard-cardfront"`. Keep semantic color roles stable (V2).

### A3. `src/data/worlds/the-ember-orchard/meta.ts`

Export `THE_EMBER_ORCHARD_DISPLAY: WorldDisplayData` and `THE_EMBER_ORCHARD_HELP: WorldHelpData`. Display copy = place-vs-disaster contrast (REQ-EMBER-41): generous star-fruit orchard whose stored warmth hatches from inside after the Walker reverses the harvest. `backgroundKey: "the-ember-orchard-bg"`, pick a `difficulty`. Help mechanics (REQ-EMBER-42), fit existing budget: Dormant Stars give warmth but add future hazards; some hazards hatch into stronger cards at end of turn; partial clears/discards plant delayed threats; `Leave One`/`Star-Pruner` are the pressure valves.

### A4. `src/data/worlds/the-ember-orchard/index.ts`

Export `THE_EMBER_ORCHARD_BUNDLE: WorldDataBundle` (model on whiteout `index.ts`). `id: "the-ember-orchard"`, `source: cardsJson`, theme/display/help from A2/A3, `musicKey: "music-the-ember-orchard"`. No `usesHeat`/`usesLight`.

### A5. Register the bundle — `src/data/worlds/registry.ts`

Import `THE_EMBER_ORCHARD_BUNDLE` and append it to `worldDataRegistry`. This alone wires the derived manifests (`worldManifest`, `themeManifest`, display/help/music) via `derive()` — no one-off builders (REQ-EMBER-4).

### A6. Threat mapping — `src/core/effects/gainCard.ts`

Add `"the-ember-orchard": "Ground Constellation"` to `WORLD_THREAT_BY_WORLD_ID` (REQ-EMBER-14). This makes `AddThreatToWorldDeck` (used by Lantern Brood and Ground Constellation) recur the signature threat.

### A7. Unlock gating — `src/data/unlocks/catalog.ts`

Add an `UnlockDefinition` to `UNLOCK_CATALOG`, mirroring `world-whiteout-parking-garage`: `id: "world-the-ember-orchard"`, name/description, low `cost`, `destinyWeight: 0`, `effect: { type: "worldUnlock", worldId: "the-ember-orchard" }`. `isWorldUnlocked` and World Select gating then pick it up automatically.

### A8. Boon source + `BOON_SET` registration (decision §4)

Author `src/data/worlds/boons/ember.json` — a boon/reward card source mirroring `big-box.json`: `worldId: "pool-ember-cellar"`, `cardTemplates` holding **all six** player-reward cards (Dormant Star, Take One, Leave One, Star-Pruner, Glasshouse Lantern, Constellation Shears) with the exact effects/costs from the A1 player table and their `ember-inset-*` keys. These are the **single** definition of the rewards — `cards.json` (A1) does not redefine them.

Register in `src/data/worlds/boons/fortune.ts`: import the JSON, export `EMBER_BOON_SOURCE`, and add an `"pool-ember-cellar"` entry to `BOON_SETS` (`{ source: EMBER_BOON_SOURCE, templateIds: ["Take One", "Leave One", "Star-Pruner", "Glasshouse Lantern", "Constellation Shears"] }`) plus the matching `FORTUNE_BOON_POOLS` line. **`Dormant Star` is in the source but not in `templateIds`** — it is granted only by `Cracked Hearth-Star`/`Falling Fruit`/`The Orchard Counts Wrong`, never offered by Hatchery. `worldManifest.ts:17` derives `BOON_SET_SOURCES` from `BOON_SETS` automatically, so the new source merges into every catalog with no further wiring — that is what makes the hazards' `GainCard`/`AddPlayerCardToTop` refs and Hatchery's `OfferBoon` both resolve. Pick a `setName` for the offer UI (e.g. "Hatchery Harvest").

> ✅ **Gate A.** `bun run test` passes existing suites; the parametrized `worldRegistry.test.ts` now includes Ember and its `buildWorld` succeeds with all template refs (**rewards resolved from the `pool-ember-cellar` source**) resolving, and `OfferBoon { setId: "pool-ember-cellar" }` resolves its pool via `resolvePool`. Asset-key tests will fail until Slice B — expected; do not paper over by removing `insetKey`s.

---

## Slice B — Assets, presentation, help, docs

Goal: every Ember asset key resolves to real Ember art (no starter fallback), and the world is documented.

### B1. Generate 14 card insets (art-gen)

One inset per card (REQ-EMBER-3/40), saved to `src/game/assets/themes/the-ember-orchard/insets/inset-<kebab-name>.webp`. Imagery per REQ-EMBER-40 — hazards as eggs/moth-seeds/rooted meteors/cracked cellars/falling constellation fruit; rewards as harvest choices/pruning tools/lantern glass/one-star-left covenant. Files needed:

- Player: `inset-dormant-star`, `inset-take-one`, `inset-leave-one`, `inset-star-pruner`, `inset-glasshouse-lantern`, `inset-constellation-shears`
- World: `inset-cracked-hearth-star`, `inset-falling-fruit`, `inset-rooted-meteor`, `inset-the-orchard-counts-wrong`, `inset-hatchery-cellar`, `inset-ember-moth`, `inset-lantern-brood`, `inset-ground-constellation`

> This is the largest effort. Flag for art-gen tooling; keep the warm-orange-invaded-by-violet keynote consistent across all 14.

### B2. Generate unlock art

`src/game/assets/unlocks/world-the-ember-orchard.webp` (matches fog/whiteout `unlock/world-*` pattern), since Slice A7 gates via the unlock system.

### B3. Wire base + inset asset bindings — `src/game/worlds/assetBindings.ts`

The 3 base assets already exist on disk (`the-ember-orchard-reality.webp`, `intrusion-overlay.webp`, `the-ember-orchard-cardfront.webp`) — wire, don't regenerate (REQ-EMBER-2). Add imports + map entries:

- `"the-ember-orchard-bg"` → reality, `"the-ember-orchard-overlay"` → intrusion-overlay, `"the-ember-orchard-cardfront"` → cardfront
- 14 `"ember-inset-<card>"` → inset URLs (REQ-EMBER-3 namespace)
- `worldMusicManifest["the-ember-orchard"] = { key: "music-the-ember-orchard", url: <reused existing track> }` (reuse like whiteout reuses fog's). `worldMusicManifest` is defined here in `assetBindings.ts` and re-exported by `audioManifest.ts` — edit it here only.

### B4. Manifest + unlock art binding — `src/game/data/assetManifest.ts`

Add `"unlock/world-the-ember-orchard"` → the B2 webp (mirror whiteout entry). Confirm Ember base/inset keys are reachable through the derived preload manifest (they project from `assetBindings`).

### B5. World-select sanity

Ember appears as the 7th world when unlocked. The select scene already pages (`VISIBLE_WORLD_COUNT`, scroll arrows in `WorldSelectScene.ts`), so no layout change is required (REQ-EMBER-43's hide fallback is unnecessary). Verify in the smoke run (Slice C).

### B6. Update `.lore/reference/theme-authoring.md` (REQ-EMBER-44)

Add `the-ember-orchard` → signature verb **incubate** to the verb table; document that Ember owns **incubation-as-delayed-known-cost** as its exclusive reward space. While here, fix **every** stale `Hidden`→`Obstructed` and `AddWorldCardToTop`→`AddWorldCardToDeck { bTop }` reference in the document, not just a couple — they recur in the tool-fetch role copy (~line 61), the Self-Transform Pattern code sample (~lines 80-87), the C1 effect-vocabulary list (~line 96), and the C2 valid-keywords list (~line 108). A partial pass leaves the doc internally contradictory.

> ✅ **Gate B.** Asset-binding/manifest tests pass; `selectTheme("the-ember-orchard")` returns the Ember palette/backdrop/overlay/cardfront; no key falls back to starter art.

---

## Slice C — Tests and validation

Goal: the spec's AI-validation checklist (REQ-EMBER-46..50 + the six AI-validation steps) all pass. Use the core directly in tests; do not mock it.

### C1. World-data tests (REQ-EMBER-46)

New `src/core/tests/` file (or extend `worldRegistry.test.ts` coverage). Assert for `the-ember-orchard`: no duplicate template ids; every world card defines all four hooks; all keywords ∈ valid `KeywordName`; act 3 ends with `The Walker`; the bundle is in `worldDataRegistry`; `buildWorld("the-ember-orchard")` succeeds.

### C2. Incubation-pattern effect tests (REQ-EMBER-47)

Drive the reducer with assembled Ember catalog: `Dormant Star` adds `Ember Moth` to top of world deck; `Cracked Hearth-Star` end-of-turn self-transforms into `Ember Moth` (and removes itself); `Falling Fruit` discard/partial plants `Dormant Star` on player draw top; `Ground Constellation` end-of-turn `AddThreatToWorldDeck` resolves to `Ground Constellation` via A6 mapping. **Also verify Hatchery Cellar end-of-turn top-of-deck order** (resolves the REQ-EMBER-26 ordering note). **Hatchery Cellar `onCleared` creates a `worldClear` boon offer from the `pool-ember-cellar` pool** (offeredCount 3, chooseCount 1) — assert the offer is drawn from the five-tool pool, *not* that five cards land in the deck. *This is the decision-§4 deviation test: REQ-EMBER-26/47's initial shape grants all five via `GainCard`; we assert an `OfferBoon`.* Mirror `big-box`'s existing OfferBoon-on-clear test for the assertion shape. **Ember Moth `onEndOfTurn` queues `ForceDestroy 1`** (decision §5; assert `pendingForceDestroy` increments — not HP `Damage`), and **Ground Constellation `onDiscarded` queues `ForceDestroy 2`**; the spec's `ReturnWorldCards` half stays dropped. **Add a `Brace`→snatch absorption test end-to-end** (play a Brace reward, let a moth's `ForceDestroy` resolve at turn start, assert the brace charge absorbs the snatch instead of a card being destroyed) so the revived mechanic is actually covered.

### C3. Asset validation (REQ-EMBER-48)

Every `ember-inset-*` key + `the-ember-orchard-cardfront` / `-bg` / `-overlay` has a matching binding and loads without starter fallback. Extend the existing `worldAssetBindings`-style test to cover Ember.

### C4. Presentation/theme test or smoke (REQ-EMBER-49)

`selectTheme("the-ember-orchard")` returns Ember palette/backdrop/overlay/cardfront; a representative Ember world card renders with its inset.

### C5. Seeded three-act gameplay test (REQ-EMBER-50)

A seeded run demonstrating: early Dormant Stars give immediate benefit; mid-game hazards recur / top-deck hatch cards; the act-3 signature threat repeatedly adds Orchard threats until cleared/escaped. Deterministic (seeded), per the core contract.

### C6. Manual smoke run (AI-validation step 5–6)

`bun run test` green, then a local run: start/select `the-ember-orchard`, clear `Hatchery Cellar`, gain a reward card, play `Take One` or `Glasshouse Lantern`, observe a future Orchard hazard placed on top of the world deck; confirm warm orchard backdrop + Counterfall overlay + cardfront render without obscuring central play or card text.

> ✅ **Gate C (final).** All six spec AI-validation items pass. Run the full `bun run test` (project convention — never `bun test`). Then validate this implementation against the spec: walk REQ-EMBER-1..50 against the coverage map below and confirm none were dropped, with both deliberate deviations explicitly acknowledged: (a) Ember Moth's dropped `ReturnWorldCards` half (REQ-EMBER-27), and (b) the Hatchery Cellar `GainCard` ×5 → `OfferBoon` deviation (REQ-EMBER-26; changes REQ-EMBER-47's test).

---

## Requirement coverage map

| REQ | Where |
|---|---|
| 1 (worldId everywhere) | A1–A6, B3 |
| 2 (base assets wired, not regen) | B3 |
| 3 (insets + `ember-inset-*` + bindings) | A1 (keys), B1, B3 |
| 4 (registry derivation) | A4, A5 |
| 5 (three-beat fiction) | A3 copy, B1/B3 visuals |
| 6 (Walker/Door/Summon shared) | A1 (not redefined) |
| 7 (signature verb incubate) | A1 roster |
| 8 (identity everywhere) | A1, A3, B1, B3, B6 |
| 9, 10 (existing effects, current names) | A1 (incl. `ForceDestroy`, an existing effect added to the vocabulary — decision §5) |
| 11 (Dormant Star) | A1 |
| 12 (no new keyword; Obstructed/Creature/Slow) | A1, decision §1 |
| 13 (≥2 self-transform hazards) | A1 (Cracked Hearth-Star, Falling Fruit chain) |
| 14 (threat mapping) | A6 |
| 15 (complete without timed state) | whole plan; no core slice |
| 16–20 (reward recipe) | A1 player table (authored in boon source, A8) |
| 21 (no other-world mechanics) | A1 (no GainLight/Heat/Freeze/Spore/Concealed/DealProgressScaled) |
| 22–29 (world card recipe) | A1 world table |
| 26, 47 (Hatchery reward delivery) | A1, A8, C2 — **`GainCard` ×5 → `OfferBoon` deviation, decision §4** |
| 27, 29 (creatures: `Damage` → `ForceDestroy`) | A1, C2 — **decision §5, revives `Brace`** |
| 30 (all four hooks) | A1 |
| 31 (soft-lock safety) | A1 (Cracked/Falling no discard dmg; Orchard Counts choice) |
| 32–35 (deck composition) | A1 acts |
| 36–40 (visual theme) | A2 (palette), B1/B3 (art) |
| 41–42 (display/help) | A3 |
| 43 (availability) | A7, B5 (gated; pages fine) |
| 44 (theme-authoring doc) | B6 |
| 45 (≥3 slices) | this plan |
| 46–50 (tests) | C1–C5 |
| AI-validation 1–6 | C1–C6 |

## Risks / watch items

- **Spec deviation: `GainCard` ×5 → `OfferBoon` on Hatchery Cellar** (decision §4). Effect-kind change, not just tuning, so it is a real departure from REQ-EMBER-26's initial shape and changes REQ-EMBER-47's Hatchery test. Driven by dilution math (×3 copies × 5 cards = up to 15 cards into a starter deck) and the now-available `OfferBoon` effect. The six player rewards are single-sourced in `ember.json` (A8) to avoid duplicating card state; that source merges into every catalog (same precedent as `big-box-boons`), reachable only by the Ember cards that reference it. Recorded in decision §4, the pre-flight table, A1, A8, C2, and the coverage map.
- **`ForceDestroy` ↔ `Brace` balance (decision §5).** Ember Moth recurs heavily, so its `ForceDestroy` is the main hand pressure; amounts (Moth 2/1/1, Ground Constellation discard 2) are initial tuning. Watch in C5: (a) Brace supply (three reward cards at amount 1, plus boon offers) keeps pace with snatch volume; (b) `ForceDestroy` on a thin hand does not soft-lock by eating the player's only progress cards — if it does, drop Moth to `ForceDestroy 1` on every hook or restore one `Damage` hook. HP-loss fail state is preserved by the surviving `Damage`/`DamageScaled` on Rooted Meteor, The Orchard Counts Wrong, and Ground Constellation's end-of-turn.
- **Inset volume.** 14 generated images is the schedule risk; keep the violet-on-orange keynote consistent (B1).
- **Hatchery Cellar top-deck order** is an engine-semantics detail — pin it with C2, adjust step order only (never add effects).
- **Star-Pruner bonus tag** ships as `Obstructed`; spec allows a `Slow` swap after playtest (REQ-EMBER-18). Tuning, not structural.
- **Ground Constellation scaling** uses `DamageScaled` `KeywordInHand: Creature`; spec's `Damage 2` + top-deck Falling Fruit fallback (REQ-EMBER-29) is the escape hatch if Creature-in-hand pressure reads too weak in C5.
- **Music** reuses an existing track by default; a dedicated Ember track is optional polish, not a gate.
