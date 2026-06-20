---
title: "Implementation plan: City of Sleeping Giants world"
date: 2026-06-20
status: draft
tags: [plan, world-design, city-of-sleeping-giants, stirring, recurrence, themes]
modules: [world-data, themes, game-view, unlocks]
related: [.lore/work/specs/city-of-sleeping-giants.md, .lore/reference/theme-authoring.md, src/game/assets/themes/city-of-sleeping-giants/CATACLYSM.md, .lore/work/plans/the-ember-orchard.md]
---

# Implementation plan: City of Sleeping Giants world

Implements [the city-of-sleeping-giants spec](../specs/city-of-sleeping-giants.md) (REQ-GIANTS-1..49). The City of Sleeping Giants is the eighth world: threat verb **stir** — accumulating disturbance where unresolved or exploited hazards make the same body movement return at a larger or worse scale. It ships entirely on the **current engine vocabulary**, with no new awareness/Stir counter (REQ-GIANTS-9, REQ-GIANTS-14).

The canonical template for this work is `the-ember-orchard` (the most recent world, full inset set, tool-fetch + signature-threat shape, gated via the unlock system), which itself mirrors `whiteout-parking-garage`. Mirror that file structure exactly.

## Key decisions (resolved before drafting)

Three points were ambiguous in the spec or contradicted the engine; all are resolved.

1. **`Hidden` → `Obstructed`.** The engine has no `Hidden` keyword. `KeywordName = "Obstructed" | "Creature" | "Slow" | "Spore" | "Concealed"` (`src/core/model/types.ts:12`). `Hidden` is the stale pre-rename name still used by the spec and by `theme-authoring.md`. **Every `Hidden` in REQ-GIANTS-22/24/25/27 is authored as `Obstructed`,** and the `bonus Hidden +1` tag in REQ-GIANTS-19 (Contour Map) becomes `{ tag: "Obstructed", amount: 1 }`. Same fix the Ember Orchard plan applied.

2. **Recurrence is top-decked, not "returned" (resolved with the user).** This world's identity is recurrence, and the spec expresses it with `ReturnWorldCards` on world-card auto-hooks (REQ-GIANTS-23/27/28). **`ReturnWorldCards` does not work there.** `ReturnWorldCardsHandler.apply` reads `ctx.returnIds ?? []` (`src/core/effects/worldCards.ts:75`), which only a player target-selection supplies; `reduce.ts` fires `onEndOfTurn`/`onDiscarded`/`onCleared` with `undefined` in the selection slot (`reduce.ts:128,159`), so it is a **silent no-op** on every world hook. Where it *does* fire (a player card), it pulls a world card out of the player's hand back to the deck — a **boon**, wrong-signed for threat pressure. There is also **no world discard pile** (confirmed with the user; `GameState` has only `worldDraw`, `src/core/model/types.ts:174`), so there is nothing for a "return" to pull from. **Decision: express all recurrence with `AddWorldCardToDeck { bTop: true }` (top-deck a fresh copy of the relevant body-reflex hazard) and `AddThreatToWorldDeck` (recur the signature threat).** This preserves the spec's intent — "the same movement returns at a larger scale" — and is explicitly blessed by REQ-GIANTS-14 (complete without the counter if cards "reliably create repeated, escalating body-reflex pressure"). **The substitution touches three cards** — Fingerquake Ward (REQ-23), District Recall (REQ-27), and The Giant Turns In Sleep (REQ-28) — wherever the spec put `ReturnWorldCards` on a world hook. It changes one required test expectation (REQ-46); see the pre-flight table and Slice C2.

3. **Gate via the unlock system + generate real inset art now.** City of Sleeping Giants is added to `UNLOCK_CATALOG` as a `worldUnlock` (like fog/whiteout/ember), and all 13 card insets are produced to the existing quality bar (REQ-GIANTS-3/39/47). `buildWorld("city-of-sleeping-giants")` and `selectTheme("city-of-sleeping-giants")` still work in tests regardless of the gate (REQ-GIANTS-42).

**No core-engine slice.** Every effect/keyword the spec names already exists. The only edit inside `src/core/` is one data-map entry in `WORLD_THREAT_BY_WORLD_ID` (Slice A6) — a registration row, not new engine logic. REQ-GIANTS-44 requires a core slice only if we add a true awareness counter, which we are not.

## Pre-flight: engine truth vs. spec wording

| Spec says | Engine reality | Action |
|---|---|---|
| keyword `Hidden` (REQ-22/24/25/27) | keyword is `Obstructed` | author `Obstructed` |
| `bonus Hidden +1` (REQ-19) | bonus tag must be a valid `KeywordName` | `{ tag: "Obstructed", amount: 1 }` |
| `AddWorldCardToTop` (cataclysm note) | `AddWorldCardToDeck { bTop: true }` | use current name (spec REQ-10 already correct) |
| `ReturnWorldCards` on world hooks (REQ-23/27/28) | no-op on auto-hooks (`ctx.returnIds` undefined); boon-signed where it fires; no world discard pile to pull from | **replace with `AddWorldCardToDeck { bTop }`** of the relevant escalation hazard (see roster) |
| `worldThreatTemplateByWorldId` (REQ-13) | constant is `WORLD_THREAT_BY_WORLD_ID` in `src/core/effects/gainCard.ts` | add `"city-of-sleeping-giants": "The Giant Turns In Sleep"` |
| inset namespace `giants-inset-*` (REQ-3) | matches `<prefix>-inset-<card>` pattern | files `inset-<card>.webp`, keys `giants-inset-<card>` |
| base keys (REQ-47) | files on disk are `*-reality.webp` / `intrusion-overlay.webp` / `*-cardfront.webp` | keys `city-of-sleeping-giants-bg` / `-overlay` / `-cardfront` |

> ✅ **District Recall recurrence (REQ-GIANTS-27 + REQ-GIANTS-46).** The spec's `onDiscarded: ReturnWorldCards min 1 max 1` and `onEndOfTurn: ReturnWorldCards min 1 max 2` are inert (no-op on auto-hooks) and would leave District Recall doing almost nothing. **Resolved (confirmed with user, given no world discard pile exists): District Recall instead top-decks known recurrence hazards** — `onDiscarded`/`onPartialClear` top-deck `Vein-Road Surge`; `onEndOfTurn` top-decks `Vein-Road Surge` **and** `Bone Anchor Failure` (two districts "recalled into the body"). REQ-GIANTS-46's test changes from "District Recall *returns* world cards" to "District Recall *top-decks* recurrence hazards" — one of the three cards (with Fingerquake Ward and The Giant Turns In Sleep) where the inert `ReturnWorldCards` is re-expressed as top-deck.

## Slices (REQ-GIANTS-44: at least three reviewable slices)

<div style="font-family:monospace;line-height:1.6;border:1px solid #888;padding:8px 12px;border-radius:6px;">
<b>A. World data + registration + gating</b> &nbsp;──▶&nbsp; <b>B. Assets / presentation / help / docs</b> &nbsp;──▶&nbsp; <b>C. Tests + validation</b><br>
<span style="color:#888;">A is the spine (data must exist first). B depends on A's card roster for inset keys. C validates A+B and runs the spec's AI-validation checklist.</span>
</div>

Within a slice, steps are independent unless an arrow says otherwise.

---

## Slice A — World data, registration, unlock gating

Goal: `buildWorld("city-of-sleeping-giants")` and `selectTheme("city-of-sleeping-giants")` assemble cleanly with the full card roster, and the world is registered and gated.

### A1. Author `src/data/worlds/city-of-sleeping-giants/cards.json`

`worldId: "city-of-sleeping-giants"`. No `startHeat`/Light fields (this world uses neither economy — REQ-GIANTS-20). Every world card defines all four hooks (REQ-GIANTS-29); use `{ "kind": "None" }` for unused. Each card carries `insetKey: "giants-inset-<kebab-name>"` (keys wired in Slice B).

**Player reward cards** (`kind: "player"`; not in `deckComposition` — granted via `GainCard`/`AddPlayerCardToTop`):

| Card | REQ | energyCost | exhaust | effect |
|---|---|---|---|---|
| Quiet Survey | 15 | 1 | — | `Sequence`[`ExileTopWorldCards` amount 1, `Draw` player 1] |
| Brace The Ward | 16 | 1 | — | `Sequence`[`DealProgress` base 2 bonus `{ tag: "Slow", amount: 2 }`, `Brace` amount 1] |
| Follow The Vein | 17 | 0 | yes | `Sequence`[`Draw` player 2, `GainEnergy` 1, `AddWorldCardToDeck`{`Vein-Road Surge`, bTop}] |
| Bone Pin | 18 | 1 | — | `Modal`[`AddPlayerCardToTop` "Quiet Survey", `AddPlayerCardToTop` "Brace The Ward"] |
| Contour Map | 19 | 2 | yes | `DealProgressAll` base 1 bonus `{ tag: "Obstructed", amount: 1 }` |

Costs/counts are initial tuning (REQ-GIANTS spec preamble). REQ-GIANTS-18 allows a `Modal`[`Draw` player 1, `Brace` amount 2] fallback for Bone Pin if self-referential reward generation reads repetitive in playtest — role unchanged, swap is data-only.

**World cards** (`kind: "world"`, `discardable: true`). `Hidden`→`Obstructed`; world-hook `ReturnWorldCards`→`AddWorldCardToDeck { bTop }` per decision §2:

| Card | REQ | cost | keywords | onCleared | onDiscarded | onPartialClear | onEndOfTurn |
|---|---|---|---|---|---|---|---|
| Minor Tremor | 21 | 1 | — | None | None | None | `Sequence`[`AddWorldCardToDeck`{Fingerquake Ward, bTop}, `DestroySelf`] |
| Relocation Order | 22 | 2 | Obstructed | `GainCard` Quiet Survey | `AddPlayerCardToTop` Panic | None | `AddPlayerCardToTop` Panic |
| Fingerquake Ward | 23 | 3 | Slow | `GainCard` Brace The Ward | `Damage` 1 | `AddWorldCardToDeck`{Minor Tremor, bTop} | `Sequence`[`Damage` 1, `AddWorldCardToDeck`{Minor Tremor, bTop}] *(spec's soft `ReturnWorldCards` half re-expressed as top-deck — inert + boon-signed as written; keeps this card's spec role as the "unresolved tremor recurs" teacher rather than diffusing it elsewhere)* |
| Surveyors Mark A Pulse | 24 | 6 | Obstructed | `Sequence`[`GainCard` ×5: Quiet Survey, Brace The Ward, Follow The Vein, Bone Pin, Contour Map] | `AddWorldCardToDeck`{Minor Tremor, bTop} | None | `AddWorldCardToDeck`{Vein-Road Surge, bTop} |
| Vein-Road Surge | 25 | 3 | Obstructed | `GainEnergy` 1 | `DiscardThenDraw` player 1 | `DiscardThenDraw` player 1 | `Sequence`[`DiscardThenDraw` player 1, `AddWorldCardToDeck`{Bone Anchor Failure, bTop}, `DestroySelf`] |
| Bone Anchor Failure | 26 | 4 | Slow | `GainCard` Bone Pin | `Damage` 2 | `AddWorldCardToDeck`{Fingerquake Ward, bTop} | `Damage` 2 |
| District Recall | 27 | 4 | Obstructed, Slow | `GainCard` Contour Map | `AddWorldCardToDeck`{Vein-Road Surge, bTop} | `AddWorldCardToDeck`{Vein-Road Surge, bTop} | `Sequence`[`AddWorldCardToDeck`{Vein-Road Surge, bTop}, `AddWorldCardToDeck`{Bone Anchor Failure, bTop}] *(spec's `ReturnWorldCards` re-expressed as top-deck; see ✅ above)* |
| The Giant Turns In Sleep | 28 | 6 | Slow | None | `Damage` 3 | `AddThreatToWorldDeck` | `Sequence`[`Damage` 2, `AddWorldCardToDeck`{Bone Anchor Failure, bTop}, `AddThreatToWorldDeck`] *(spec's `ReturnWorldCards` half re-expressed as top-deck)* |

`The Giant Turns In Sleep` is "discardable only with a high penalty" (REQ-GIANTS-28): `discardable: true` with `onDiscarded: Damage 3`. `The Walker`/`Panic` are shared starter templates (`src/data/worlds/starters/starter.json`) referenced but **not** redefined here (REQ-GIANTS-6).

**Self-transform pattern (REQ-GIANTS-12, ≥2 hazards).** Satisfied by **Minor Tremor** (`onEndOfTurn` Sequence[`AddWorldCardToDeck`{bTop}, `DestroySelf`]) and **Vein-Road Surge** (same shape). The civic problem vanishes and its body-reflex successor appears on top.

**Soft-lock safety (REQ-GIANTS-30).** Early hazards with no discard damage: Minor Tremor (`onDiscarded: None`) and Relocation Order (`onDiscarded: AddPlayerCardToTop Panic`, no damage). Mid-game clear-vs-discard choices: Vein-Road Surge (clear→energy vs discard→DiscardThenDraw) and Bone Anchor Failure (clear→Bone Pin reward vs discard→`Damage` 2). No top-deck loop can lock the player before `Surveyors Mark A Pulse` grants the reward kit.

`deckComposition.acts` (REQ-GIANTS-31/32/33 — three acts, Walker closes act 3):

- **Act 1 — Civic Tremors:** Minor Tremor ×3, Relocation Order ×3, Fingerquake Ward ×1, Surveyors Mark A Pulse ×3
- **Act 2 — Reflex Districts:** Fingerquake Ward ×2, Vein-Road Surge ×3, Bone Anchor Failure ×2, District Recall ×1, Surveyors Mark A Pulse ×2
- **Act 3 — The Body Remembers:** Bone Anchor Failure ×2, District Recall ×2, Vein-Road Surge ×2, The Giant Turns In Sleep ×3, `{ "templateId": "The Walker", "count": 1 }`

Counts are tuning; act roles and the fixed Walker closer are not (REQ-GIANTS-32/33). Surveyors Mark A Pulse appears ×3 in Act 1 so the reward kit lands before Act 2 recurrence densifies (REQ-GIANTS-34).

### A2. `src/data/worlds/city-of-sleeping-giants/theme.ts`

Export `CITY_OF_SLEEPING_GIANTS_THEME: VisualTheme` (model on Ember/whiteout `theme.ts`). `worldId: "city-of-sleeping-giants"`. Palette from REQ-GIANTS-35: `intrusionHue: "#9d6cff"`, `doorGlowTint: 0x9d6cff`, emerald progress accents (`connectorProgress`), warm violet-pink danger (`connectorDestroy`), cool cyan return/retreat (`connectorReturn`), bone-white `targetGlow`. `backdrop.realityKey: "city-of-sleeping-giants-bg"`, `backdrop.intrusionKey: "city-of-sleeping-giants-overlay"`, `worldCardfrontKey: "city-of-sleeping-giants-cardfront"`. Keep semantic color roles stable; `theme.test.ts` guards a unique `intrusionHue` per theme — `#9d6cff` must not collide with an existing world.

### A3. `src/data/worlds/city-of-sleeping-giants/meta.ts`

Export `CITY_OF_SLEEPING_GIANTS_DISPLAY: WorldDisplayData` and `CITY_OF_SLEEPING_GIANTS_HELP: WorldHelpData`. Display copy = place-vs-disaster contrast (REQ-GIANTS-40): a beautiful violet-cyan metropolis built across sleeping giant bodies becomes dangerous once the Walker makes those bodies remember the player's route. `backgroundKey: "city-of-sleeping-giants-bg"`; pick a `difficulty`. Help mechanics (REQ-GIANTS-41), fit the existing help budget: unresolved hazards return or top-deck stronger reflexes; some rewards quiet or survey the next movement; `Follow The Vein` trades tempo for a known future hazard; the signature threat repeatedly returns known problems until cleared or escaped.

### A4. `src/data/worlds/city-of-sleeping-giants/index.ts`

Export `CITY_OF_SLEEPING_GIANTS_BUNDLE: WorldDataBundle` (model on Ember `index.ts`). `id: "city-of-sleeping-giants"`, `source: cardsJson as unknown as RawCardSource`, theme/display/help from A2/A3, `musicKey: "music-city-of-sleeping-giants"`. No `usesHeat`/`usesLight`.

### A5. Register the bundle — `src/data/worlds/registry.ts`

Import `CITY_OF_SLEEPING_GIANTS_BUNDLE` and append it to `worldDataRegistry`. This alone wires the derived manifests (`worldManifest`, `themeManifest`, display/help/music) — no one-off builders (REQ-GIANTS-4).

### A6. Threat mapping — `src/core/effects/gainCard.ts`

Add `"city-of-sleeping-giants": "The Giant Turns In Sleep"` to `WORLD_THREAT_BY_WORLD_ID` (REQ-GIANTS-13). This makes `AddThreatToWorldDeck` (used by The Giant Turns In Sleep `onPartialClear`/`onEndOfTurn`) recur the signature threat — the "relive the same movement at greater scale" loop.

### A7. Unlock gating — `src/data/unlocks/catalog.ts`

Add an `UnlockDefinition` to `UNLOCK_CATALOG`, mirroring `world-the-ember-orchard`/`world-whiteout-parking-garage`: `id: "world-city-of-sleeping-giants"`, name/description, low `cost`, `destinyWeight: 0`, `effect: { type: "worldUnlock", worldId: "city-of-sleeping-giants" }`. `isWorldUnlocked` and World Select gating pick it up automatically.

> ✅ **Gate A.** `bun run test` passes existing suites; the parametrized registry/manifest tests now include City of Sleeping Giants and its `buildWorld` succeeds with all template refs (Panic, The Walker, all five rewards, all eight hazards) resolving. Asset-key tests will fail until Slice B — expected; do not paper over by removing `insetKey`s.

---

## Slice B — Assets, presentation, help, docs

Goal: every City of Sleeping Giants asset key resolves to real art (no starter fallback), and the world is documented.

### B1. Generate 13 card insets (art-gen)

One inset per card (REQ-GIANTS-3/39), saved to `src/game/assets/themes/city-of-sleeping-giants/insets/inset-<kebab-name>.webp`. Imagery per REQ-GIANTS-39 — hazards show tremoring wards, marked pulses, vein-roads, bone anchors, district-recall geometry, the sleeping giant's reflex; rewards show survey instruments, braced neighborhoods, vein-following transit routes, bone pins, contour maps. Keep the violet-cyan-city-invaded-by-emerald-vascular-and-bone-white keynote consistent. Files:

- Player: `inset-quiet-survey`, `inset-brace-the-ward`, `inset-follow-the-vein`, `inset-bone-pin`, `inset-contour-map`
- World: `inset-minor-tremor`, `inset-relocation-order`, `inset-fingerquake-ward`, `inset-surveyors-mark-a-pulse`, `inset-vein-road-surge`, `inset-bone-anchor-failure`, `inset-district-recall`, `inset-the-giant-turns-in-sleep`

> This is the largest effort and the main schedule risk. Flag for art-gen tooling.

### B2. Generate unlock art

`src/game/assets/unlocks/world-city-of-sleeping-giants.webp` (matches the fog/whiteout/ember `unlock/world-*` pattern), since A7 gates via the unlock system.

### B3. Wire base + inset asset bindings — `src/game/worlds/assetBindings.ts`

The 3 base assets already exist on disk (`city-of-sleeping-giants-reality.webp`, `intrusion-overlay.webp`, `city-of-sleeping-giants-cardfront.webp`, verified present) — wire, don't regenerate (REQ-GIANTS-2). Add imports + map entries:

- `"city-of-sleeping-giants-bg"` → reality, `"city-of-sleeping-giants-overlay"` → intrusion-overlay, `"city-of-sleeping-giants-cardfront"` → cardfront
- 13 `"giants-inset-<card>"` → inset URLs (REQ-GIANTS-3 namespace)
- `worldMusicManifest["city-of-sleeping-giants"] = { key: "music-city-of-sleeping-giants", url: <reused existing track> }` (reuse like whiteout reuses fog's). `worldMusicManifest` is defined here and re-exported by `audioManifest.ts` — edit it here only.

### B4. Manifest + unlock art binding — `src/game/data/assetManifest.ts`

Add `"unlock/world-city-of-sleeping-giants"` → the B2 webp (mirror the ember/whiteout entry). Confirm City base/inset keys are reachable through the derived preload manifest (they project from `assetBindings` via `worldAssetUrls`).

### B5. World-select sanity

City of Sleeping Giants appears as the next world when unlocked. `WorldSelectScene` already pages (`VISIBLE_WORLD_COUNT`, scroll arrows), so no layout change is required; REQ-GIANTS-42's hide fallback is unnecessary. Verify in the Slice C smoke run.

### B6. Update `.lore/reference/theme-authoring.md` (REQ-GIANTS-43)

Add `city-of-sleeping-giants` → signature verb **stir** to the verb table; document that this world owns **Stirring as recurrence/escalation from unresolved or exploited body movement**. While here, fix any remaining stale `Hidden`→`Obstructed` and `AddWorldCardToTop`→`AddWorldCardToDeck { bTop }` references the Ember pass may not have caught — a partial pass leaves the doc internally contradictory.

> ✅ **Gate B.** Asset-binding/manifest tests pass; `selectTheme("city-of-sleeping-giants")` returns the City palette/backdrop/overlay/cardfront; no key falls back to starter art.

---

## Slice C — Tests and validation

Goal: the spec's AI-validation checklist (REQ-GIANTS-45..49 + the five AI-validation steps) all pass. Use the core directly in tests; do not mock it.

### C1. World-data tests (REQ-GIANTS-45)

Extend the parametrized `src/core/tests/worldRegistry.test.ts` / `worldManifest.test.ts` coverage (they auto-iterate the registry). Assert for `city-of-sleeping-giants`: no duplicate template ids; every world card defines all four hooks; all keywords ∈ valid `KeywordName`; Act 3 ends with `The Walker`; the bundle is in `worldDataRegistry`; `buildWorld("city-of-sleeping-giants")` succeeds.

### C2. Stirring-pattern effect tests (REQ-GIANTS-46)

Drive the reducer with the assembled City catalog and assert the shipped recurrence patterns:

- `Minor Tremor` end-of-turn top-decks `Fingerquake Ward` (and removes itself).
- **`Fingerquake Ward` end-of-turn top-decks `Minor Tremor`** (the re-expressed recurrence half; assert the top-deck fires alongside `Damage 1`).
- `Surveyors Mark A Pulse` `onCleared` grants the five-card reward kit; ignored (`onEndOfTurn`) it top-decks `Vein-Road Surge`.
- `Vein-Road Surge` end-of-turn creates `Bone Anchor Failure` (and removes itself).
- **`District Recall` top-decks recurrence hazards** (`onDiscarded`/`onPartialClear` → `Vein-Road Surge`; `onEndOfTurn` → `Vein-Road Surge` + `Bone Anchor Failure`). *This is the spec-deviation test: REQ-GIANTS-46 says "returns world cards"; we assert top-deck, per decision §2.*
- **`The Giant Turns In Sleep` end-of-turn top-decks `Bone Anchor Failure`** (the re-expressed recurrence half) **and** resolves `AddThreatToWorldDeck` to `The Giant Turns In Sleep` via the A6 mapping; `onPartialClear` also resolves the threat mapping.

Verify top-of-deck ordering where a `Sequence` adds multiple world cards (`worldDrawTop` prepends, so the **last** `AddWorldCardToDeck` step lands on top — pin this for District Recall's two-card end-of-turn; adjust step order only, never add effects).

### C3. Asset validation (REQ-GIANTS-47)

Every `giants-inset-*` key + `city-of-sleeping-giants-cardfront`/`-bg`/`-overlay` has a matching binding and loads without starter fallback. Extend the existing `worldAssetBindings`-style test to cover this world.

### C4. Presentation/theme test or smoke (REQ-GIANTS-48)

`selectTheme("city-of-sleeping-giants")` returns the City palette/backdrop/overlay/cardfront; a representative City world card renders with its inset.

### C5. Seeded three-act gameplay test (REQ-GIANTS-49)

A seeded run demonstrating: Act 1 creates manageable civic tremors; Act 2 hazards repeatedly top-deck or recur related reflex cards; Act 3 chains `The Giant Turns In Sleep` (via `AddThreatToWorldDeck`) until the player clears it, quiets the deck, or reaches the Door. Deterministic (seeded), per the core contract.

> ✅ **Gate C (final).** All five spec AI-validation items pass. Run the full `bun run test` (project convention — never `bun test`). Then validate this implementation against the spec: walk REQ-GIANTS-1..49 against the coverage map below and confirm nothing was dropped, with the three-card `ReturnWorldCards`→top-deck deviation (Fingerquake Ward REQ-23, District Recall REQ-27, The Giant Turns In Sleep REQ-28; REQ-46 test expectation changed) explicitly acknowledged.

---

## Requirement coverage map

| REQ | Where |
|---|---|
| 1 (worldId everywhere) | A1–A6, B3 |
| 2 (base assets wired, not regen) | B3 |
| 3 (insets + `giants-inset-*` + bindings) | A1 (keys), B1, B3 |
| 4 (registry derivation) | A4, A5 |
| 5 (three-beat fiction) | A3 copy, B1/B3 visuals |
| 6 (Walker/Door/Summon shared) | A1 (not redefined) |
| 7 (signature verb stir) | A1 roster |
| 8 (identity everywhere) | A1, A3, B1, B3, B6 |
| 9, 10 (existing effects, current names) | A1, decision §2 |
| 11 (Minor Tremor low-tier teacher) | A1 |
| 12 (≥2 self-transform hazards) | A1 (Minor Tremor, Vein-Road Surge) |
| 13 (threat mapping) | A6 |
| 14 (complete without counter) | whole plan; no core slice; decision §2 |
| 15–20 (reward recipe) | A1 player table |
| 21–29 (world card recipe) | A1 world table |
| 23, 27, 28, 46 (recurrence on world hooks) | A1, C2 — **`ReturnWorldCards`→top-deck deviation, 3 cards** |
| 30 (soft-lock safety) | A1 |
| 31–33 (deck composition + Walker closer) | A1 acts |
| 34 (Surveyors early) | A1 (Act 1 ×3) |
| 35–39 (visual theme + insets) | A2 (palette), B1/B3 (art) |
| 40–41 (display/help) | A3 |
| 42 (availability / gated, tests still work) | A7, B5 |
| 43 (theme-authoring doc) | B6 |
| 44 (≥3 slices) | this plan |
| 45–49 (tests) | C1–C5 |
| AI-validation 1–5 | C1–C5 + final gate |

## Risks / watch items

- **Spec deviation: `ReturnWorldCards`→top-deck on three cards** (Fingerquake Ward, District Recall, The Giant Turns In Sleep). The only place this implementation departs from literal spec text. Driven by hard engine reality (inert on auto-hooks, boon-signed, no world discard pile) and confirmed with the user. As written the spec would have shipped three silently-inert hooks; the substitution makes them deliver the spec's intended escalating pressure. Only REQ-46's test expectation changes wording. Recorded in decision §2, the ✅ callout, the roster table, C2, and the coverage map so review verifies intent rather than flagging a gap.
- **Inset volume.** 13 generated images is the schedule risk; keep the violet-cyan/emerald/bone-white keynote consistent (B1).
- **`intrusionHue` collision.** `#9d6cff` must be unique across themes (`theme.test.ts` guards it); confirm no existing world already uses a near-identical violet before authoring A2.
- **Top-deck ordering.** District Recall's two-card end-of-turn and any multi-`AddWorldCardToDeck` Sequence depend on `worldDrawTop` prepend order — pin with C2, adjust step order only.
- **Fingerquake Ward ↔ Minor Tremor loop.** Fingerquake Ward's end-of-turn now top-decks `Minor Tremor`, and Minor Tremor's end-of-turn top-decks `Fingerquake Ward` — a deliberate recurrence loop. It is bounded and safe: `Minor Tremor` is cost 1 and discardable with no penalty (`onDiscarded: None`), so the player can always shed it. If C5 shows it reads oppressive while Fingerquake Ward sits as a Slow card, drop Fingerquake Ward's top-deck half back to `Damage 1` only — data-only, no new effect.
- **Music** reuses an existing track by default; a dedicated track is optional polish, not a gate.
