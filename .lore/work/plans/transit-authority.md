---
title: "Implementation plan: The Transit Authority world"
date: 2026-07-01
status: executed
tags: [world-design, transit-authority, reroute, forced-movement, deck-pressure, plan, keyword]
modules: [world-data, themes, game-view, core-engine]
related: [.lore/work/specs/transit-authority.md, .lore/reference/theme-authoring.md, .lore/work/specs/city-of-sleeping-giants.md]
---

# Implementation plan: The Transit Authority world

Source spec: `.lore/work/specs/transit-authority.md` (REQ-TRANSIT-1..48). This plan implements that spec with four decided deviations (items 1, 2, 3, 5 below), captured with rationale, plus one factual correction discovered while grounding the plan in the actual codebase (item 4).

## Deviations from the spec (decided during planning, 2026-07-01)

**1. REQ-TRANSIT-20 is dropped.** As written it bans Transit reward cards from ever using `GainLight`, `GainHeat`, `FreezeCards`, `ThawCards`, `DealProgressScaled`, `Concealed`, `Spore`, `ReturnPlayerDiscardToTop`, or `RecallPlayerDiscard`. This contradicts `.lore/reference/theme-authoring.md`'s explicit rule (lines 96-100): *"No mechanic is exclusive; identity is... any world may use any entry in the effect/keyword vocabulary as a supporting tool."* Identity protection is already fully handled by REQ-TRANSIT-7 (the verb carve-out against Tidal's `displace` and Giants' `stir`) and REQ-TRANSIT-48 (the distinctness test, renamed below). No card in this plan uses any effect from the dropped list, so this changes wording, not behavior.

**2. REQ-TRANSIT-48 is reframed as "distinctness," not "mechanical identity."** The underlying test is unchanged (two rewards are non-distinct only when they share the same ordered effect-kind sequence, numeric params, `energyCost`, and `exhaust`) — only the name changes, because "mechanical identity" implies a broader exclusivity than the test actually enforces. Two Transit cards may each use `Brace`, or each use `DealProgress`, and still be distinct.

**3. Reroute gets a real world-side keyword instead of being pure "authored feel."** The spec's folded-in decision (2026-06-29) was to ship Reroute on existing effects only, with zero core touch (REQ-TRANSIT-9/10, REQ-TRANSIT-42's "no core-engine slice required"). Per discussion, that leaves Reroute as several unrelated effects that happen to share flavor text, not a mechanic with any shared engine surface — unlike Lockdown (New Derelict) or Alarm (Eden Prime), which are real applied keywords with cost-tax and removal interactions. This plan adds `Reroute` as a **transient applied keyword** (decays at turn start, like `Alarm`) reusing the existing `ApplyKeyword`/`RemoveKeyword`/`KEYWORD_COST_MODIFIERS` primitives already built for those two worlds. Concrete design in its own section below. This supersedes REQ-TRANSIT-42's "no core-engine slice" claim (Slice 0 exists because of this) and extends REQ-TRANSIT-9's effect list with `ApplyKeyword` and `RemoveKeyword`.

  Scope boundary confirmed during research: `ApplyKeyword`'s `target` union (`src/core/model/types.ts:150-154`) is `"hand" | "nextWorldCard" | "self" | "firstWorldCardInHand" | "randomWorldCardInHand"` — all world-card-side. There is no `nextPlayerCard` target, so `Reroute` cannot tag a card forced to the top of the *player* deck (`AddPlayerCardToTop "Panic"`). That stays pure-effect, exactly as specced. Building a `nextPlayerCard` target was considered and explicitly declined as out of scope for this plan.

**4. Correction (not a decision, a fact): every Transit world card needs five hooks, not four.** REQ-TRANSIT-28 lists `onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`. The actual `WorldCardTemplate` interface (`src/core/model/cards.ts:39-53`) requires a fifth: `onDraw: CardEffect`. Every Transit world card must also author `"onDraw": { "kind": "None" }`, confirmed against `new-derelict`'s and `city-of-sleeping-giants`' shipped cards (both author all five; `new-derelict`'s own test names them `REQUIRED_HOOKS` with five entries).

**5. Card insets use an anime-but-gritty rendering style, not the shared ink-and-wash house style — rendering technique only, composition rules are unchanged.** REQ-TRANSIT-38 inherits its rendering direction from the shared theme art direction (`src/game/assets/themes/README.md`, echoed in REQ-TRANSIT-34/35: "gritty ink-and-wash concept art on warm weathered paper, dense scratch linework, restrained paint"). Per direction, Transit's 12 card insets specifically (not the 3 existing base backdrop/overlay/cardfront assets, which are reviewed-not-regenerated per REQ-TRANSIT-2) instead use an **anime-but-gritty** style: bold cel-shaded linework and high-contrast expressive shading, kept "gritty" via grime/wear texture, desaturation outside the accent palette, and imperfect edges rather than clean anime polish. This is a deliberate, Transit-specific divergence from `theme-authoring.md`'s W2c guidance ("inset style should match the world's reality/backdrop language") — the insets will share Transit's palette (sodium-amber/iron/cream + quarantine crimson/violet), nouns, and signature-verb cues with the backdrop, but not its ink-and-wash rendering technique. Not a change to the shared convention for other worlds.

  **Composition is explicitly out of scope for this deviation.** `theme-authoring.md` W2b's rules — one large foreground subject, a bold silhouette, a simplified darker background, only one or two environmental cues, no crowded props or anything competing with the main subject — apply exactly as they do to every other world's insets and take precedence over the rendering-style choice. "Anime" pulls toward compositional habits that would violate W2b if followed uncritically — multi-figure action panels, speed lines, screen-tone clutter, busy dynamic backgrounds — and none of those are wanted here. Prompts and generated insets must read as single-subject, bold-silhouette key art (the kind of restrained anime key visual that already satisfies W2b), not action-scene panel art. Image generation for these insets must go through the `art-gen:generate-image` skill, not an ad hoc equivalent.

## Architecture recap (grounds every step below)

Confirmed by reading the shipped code, not assumed from the spec:

- **Card templates are global, not per-world.** All `cardTemplates` — including every world's hazards and rewards — live in one file: `src/data/allCards.json`. A world's own `src/data/worlds/<worldId>/cards.json` holds only `{ "worldId": ..., "deckComposition": { "acts": [...] } }`, referencing template names by id. (Confirmed: `city-of-sleeping-giants/cards.json` has no `cardTemplates` key; `src/data/worldManifest.ts:26-27` builds `CARD_CATALOG` from `allCards.json` alone via `assembleCatalog`.)
- **Boon pools are also global.** `src/data/boonPools.json` is a flat `{ poolId: [templateNames] }` map (e.g. `pool-derelict-override`, `pool-survey-results` both live there, not in per-world files).
- **Registration is the `WorldDataBundle` pattern**: `id`, `deck.cardsImport`, `theme`, `display`, `help`, `musicKey`, appended to the `worldDataRegistry` array in `src/data/worlds/registry.ts`. Derived manifests (`worldManifest`, `themeManifest`, asset validation, the sim completeness harness) all project from that one array — adding the bundle is what makes every downstream test pick Transit up automatically.
- **Reference implementation:** `city-of-sleeping-giants` (closest structural mirror per the spec's own repeated "mirrors Giants" language) and `new-derelict` (freshest completed world, PR #128, includes the now-required 5th hook and the most current test conventions). Every file/test pattern below cites one or both.

## Reroute keyword design (concrete)

- **Add `"Reroute"`** to `KeywordName` (`src/core/model/types.ts:12-19`) and `KEYWORD_NAMES` (`src/core/model/keywords.ts:14-21`).
- **Transient**, not persistent: do **not** add it to `PERSISTENT_KEYWORDS` (`src/core/model/keywords.ts:23`). It decays at turn start like `Alarm`, matching Reroute's "just got reassigned" framing — the self-transform pattern usually replaces the card by then anyway.
- **Cost tax:** `KEYWORD_COST_MODIFIERS.Reroute = { kind: "ClearCostPerSelfKeyword", costPer: 1 }` (`src/core/model/keywords.ts:26-29`) — same shape and magnitude as `Lockdown`, i.e. a Rerouted card costs +1 to clear per its own keyword value (value is always authored as `1`).
- **Application:** `{ "kind": "ApplyKeyword", "keyword": "Reroute", "value": 1, "target": "nextWorldCard" }`, appended into the same `Sequence` as every world-to-world forced top-deck (`AddWorldCardToDeck { bTop: true }`) in a Transit hazard hook, and after every `AddThreatToWorldDeck` occurrence in `Entity Detected` (both `onPartialClear` and inside the `onEndOfTurn` `Sequence`) — `AddThreatToWorldDeckHandler` always resolves to `worldDrawTop` (`src/core/effects/gainCard.ts:243-248`), so it is mechanically identical to `AddWorldCardToDeck{bTop:true}` for this purpose and both occurrences must be tagged the same way. Single-effect hooks become two/three-step `Sequence`s to fit this in.
- **Removal:** `{ "kind": "RemoveKeyword", "keyword": "Reroute", "target": "hand", "amount": N }` appended to `Check the Board` (amount 2, matching its `ExileTopWorldCards amount 2`) and `Express Transfer` (amount 1, matching its `ExileTopWorldCards amount 1`) — the two rewards whose identity is explicitly route-control.

Every hook that needs the `ApplyKeyword` pairing (world-side only):

| Card | Hook | Existing shape (spec) | Add |
| --- | --- | --- | --- |
| `Service Change` | `onEndOfTurn` | `Sequence[AddWorldCardToDeck→Platform Reassignment, DestroySelf]` | insert `ApplyKeyword` after the `AddWorldCardToDeck` step |
| `Ticket Invalidated` | `onPartialClear` | `AddWorldCardToDeck→Service Change` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `Ticket Invalidated` | `onEndOfTurn` | `Sequence[ForceDestroy 1, AddWorldCardToDeck→Service Change]` | append `ApplyKeyword` |
| `Train Arrives From Nowhere` | `onPartialClear` | `AddWorldCardToDeck→Platform Reassignment` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `Train Arrives From Nowhere` | `onEndOfTurn` | `Sequence[DiscardThenDraw, AddWorldCardToDeck→All Departures Suspended, DestroySelf]` | insert `ApplyKeyword` between the `AddWorldCardToDeck` and `DestroySelf` steps |
| `All Departures Suspended` | `onDiscarded` | `AddWorldCardToDeck→Train Arrives From Nowhere` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `All Departures Suspended` | `onPartialClear` | `AddWorldCardToDeck→Platform Reassignment` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `All Departures Suspended` | `onEndOfTurn` | `Sequence[AddPlayerCardToTop→Panic, AddWorldCardToDeck→Platform Reassignment]` | append `ApplyKeyword` |
| `Reissue Credentials` | `onDiscarded` | `AddWorldCardToDeck→Service Change` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `Reissue Credentials` | `onEndOfTurn` | `AddWorldCardToDeck→Platform Reassignment` (single) | wrap in `Sequence[AddWorldCardToDeck, ApplyKeyword]` |
| `Entity Detected` | `onPartialClear` | `AddThreatToWorldDeck` (single) | wrap in `Sequence[AddThreatToWorldDeck, ApplyKeyword]` |
| `Entity Detected` | `onEndOfTurn` | `Sequence[Damage 2, AddPlayerCardToTop→Panic, AddThreatToWorldDeck]` | append `ApplyKeyword` after `AddThreatToWorldDeck` |
| `Board Anyway` (reward) | `effect` | `Sequence[DealProgress 3, GainEnergy 1, AddWorldCardToDeck→Platform Reassignment]` | append `ApplyKeyword` — reinforces "accept a known reroute" identity, and only strengthens the REQ-TRANSIT-48 distinctness gap from Giants' `Follow The Vein` |

`Platform Reassignment` and `Do Not Board Unknown Trains` need no change here — neither hook ever top-decks a *world* card (only `AddPlayerCardToTop`/`DiscardThenDraw`), so there's nothing for `ApplyKeyword{target:"nextWorldCard"}` to attach to.

Removal wiring:

| Card | Change |
| --- | --- |
| `Check the Board` | `ExileTopWorldCards amount 2` (single) → `Sequence[ExileTopWorldCards amount 2, RemoveKeyword{Reroute, hand, amount:2}]` |
| `Express Transfer` | `Sequence[DealProgress, ExileTopWorldCards amount 1]` → append `RemoveKeyword{Reroute, hand, amount:1}` |

`Reroute` is **never authored** in a card's static `keywords` array (only `Obstructed`/`Slow` are, per REQ-TRANSIT-43) — it only ever appears at runtime via `appliedKeywords`, exactly like `Alarm` and `Lockdown`.

**Slice sequencing note:** Slices 1 and 2 must land together as one reviewable unit (one branch/PR), not as independently-mergeable green commits. `worldAssetBindings.test.ts` iterates `worldDataRegistry` via `describe.each`, so adding the Transit bundle in Slice 1 without Slice 2's asset bindings fails that test with missing-key errors — this is expected mid-implementation, not a regression, and only needs to be green by the time the combined PR is reviewed. Slice 3 tests can be written alongside either slice but only pass once both are in place.

## Slices

### Slice 0 — Core engine: Reroute keyword plumbing

Files: `src/core/model/types.ts`, `src/core/model/keywords.ts`

1. Add `"Reroute"` to `KeywordName` and `KEYWORD_NAMES`.
2. Add `KEYWORD_COST_MODIFIERS.Reroute = { kind: "ClearCostPerSelfKeyword", costPer: 1 }`. Do not add to `PERSISTENT_KEYWORDS`.
3. No new `CardEffect` kinds — reuses `ApplyKeyword`/`RemoveKeyword` as-is.

**Validation gate:** `bun run typecheck` passes with the new keyword; `parseKeyword("Reroute")` round-trips in a quick scratch check before moving on.

### Slice 1 — World data, registration, and Reroute wiring

Files:
- `src/data/allCards.json` — add 12 `cardTemplates` entries (7 hazards, 5 rewards)
- `src/data/worlds/transit-authority/{cards.json,meta.ts,theme.ts,index.ts}` (new directory)
- `src/data/worlds/registry.ts` — import + append `TRANSIT_AUTHORITY_BUNDLE`
- `src/core/effects/gainCard.ts` — `WORLD_THREAT_BY_WORLD_ID["transit-authority"] = "Entity Detected"`
- `src/data/boonPools.json` — add `pool-reissued-credentials`
- `.lore/reference/theme-authoring.md` — verb table row + keyword vocabulary line

Steps:

1. Author the 7 hazard templates (`Service Change`, `Platform Reassignment`, `Ticket Invalidated`, `Train Arrives From Nowhere`, `Do Not Board Unknown Trains`, `All Departures Suspended`, `Reissue Credentials`, `Entity Detected` — REQ-TRANSIT-11, 21-27) exactly per the spec's initial shapes, plus: `"onDraw": { "kind": "None" }` on every one (deviation 4), the Reroute `ApplyKeyword` pairing from the table above, `insetKey` following `transit-inset-<kebab-name>` (REQ-TRANSIT-3), and a `rarity` tier consistent with sibling worlds' cost/role conventions (cheap act-1 fodder → `common`, escalating mid-hazards → `uncommon`/`rare`, `Entity Detected` → `signature`).
2. Author the 5 reward templates (`Temporary Credentials`, `Express Transfer`, `Check the Board`, `Board Anyway`, `Right of Way` — REQ-TRANSIT-15-19) exactly per spec shapes, plus the `RemoveKeyword` append on `Check the Board`/`Express Transfer` and the `ApplyKeyword` append on `Board Anyway`. `rarity: "uncommon"` for all five (matches Giants' reward tier).
3. `cards.json`: `worldId: "transit-authority"` + the three-act `deckComposition` verbatim from REQ-TRANSIT-31, ending act 3 with `{ "templateId": "The Walker", "count": 1 }` (REQ-TRANSIT-32).
4. `meta.ts`: `WorldDisplayData` (REQ-TRANSIT-39's place-vs-disaster contrast, plus the required non-optional `cycle: number` (1-3) and `difficulty: number` (1-5) fields — `src/data/worlds/types.ts:21-28`, both easy to under-specify since the spec doesn't mention them) and `WorldHelpData` (REQ-TRANSIT-40's five mechanic notes — include a note about the Reroute tax/removal interaction, since it's now a real mechanic worth surfacing), mirroring `city-of-sleeping-giants/meta.ts`'s shape.
5. `theme.ts`: `VisualTheme` per REQ-TRANSIT-34 — `intrusionHue: "#e23a5e"`, `doorGlowTint: 0xe23a5e`, `backdrop: { realityKey: "transit-authority-bg", intrusionKey: "transit-authority-overlay" }`, `worldCardfrontKey: "transit-authority-cardfront"` (suffix convention confirmed against `new-derelict/theme.ts`). **`realityPalette`** (`title`/`text`/`disabled`/`confirm`/`cancel` hex strings) and **`frameStyle`** (`FrameStyle`'s 11 numeric color fields: `selectedBorder`, `targetBorder`, `discardBorder`, `connectorProgress`, `connectorDestroy`, `connectorReturn`, `ringAccent`, `targetGlow`, `playableGlow`, `committedTarget`, `pickedBorder` — `src/game/view/themes/theme.ts`) are both **required, not optional**, and the spec's prose doesn't map onto them directly. Derive them from the spec's amber-gold/crimson/steel-blue/violet palette the same way `city-of-sleeping-giants/theme.ts` derives its own `frameStyle` from its violet/emerald/cyan/pink palette: amber-gold progress → `connectorProgress`; crimson danger → `discardBorder`/`connectorDestroy`; steel-blue return/retreat → `connectorReturn`; violet quarantine-band → `ringAccent`/`targetBorder`.
6. `index.ts`: `WorldDataBundle` with `id: "transit-authority"`, `musicKey: "music-transit-authority"`. **Flag for implementer:** confirm a matching audio file + `audioManifest.ts` entry actually exists or gets added — `new-derelict` shipped reusing `eden-prime`'s music key, which reads as a bug, not a pattern to repeat.
7. `registry.ts`: import and append the bundle (order matches world-select order; append at the end, after `NEW_DERELICT_BUNDLE`).
8. `gainCard.ts`: add the `"transit-authority": "Entity Detected"` line to `WORLD_THREAT_BY_WORLD_ID`.
9. `boonPools.json`: add `"pool-reissued-credentials": ["Temporary Credentials", "Express Transfer", "Check the Board", "Board Anyway", "Right of Way"]`.
10. `theme-authoring.md`: add the `transit-authority` / `reroute` row to the signature-verb table (REQ-TRANSIT-41), reflecting the corrected mechanic ("forced reassignment across both decks, world-side hazards tagged with a transient `Reroute` keyword that taxes clear cost until stripped by route-control rewards"); add `Reroute` to the C2 keyword-vocabulary sentence alongside `Alarm`/`Lockdown`.

**Validation gate:** a throwaway `buildWorld("transit-authority")` call (or the Slice 3 test file, whichever lands first) succeeds; no duplicate template ids across `allCards.json`; `worldDataRegistry` includes the bundle.

### Slice 2 — Assets, presentation, and help

Files: `src/game/assets/themes/transit-authority/insets/README.md` (new) + 12 inset images; possible in-place retouch of the 3 existing base assets; `src/game/worlds/assetBindings.ts`; `src/game/data/assetManifest.ts`; `src/game/data/audioManifest.ts` (music entry, per Slice 1 step 6's flag).

1. Art-direction review of the 3 existing base assets (`transit-authority-reality.webp`, `intrusion-overlay.webp`, `transit-authority-cardfront.webp`) against `src/game/assets/themes/README.md`'s shared contract and REQ-TRANSIT-35/36/37's specific checklists. Retouch/regenerate in place only what fails — same filename, same asset key (REQ-TRANSIT-2).
2. Write `insets/README.md` following the `eden-prime`/`new-derelict` template structure (prompt template, filename→key list, palette, W2d finishing pass: fit `600x600`, contrast `1.12`, brightness `0.99`, unsharp `1.1`/`80`/`4`, `100x100` contact-sheet review) — REQ-TRANSIT-38. Direction section documents the **anime-but-gritty** rendering style (deviation 5 above): bold cel-shaded linework, high-contrast expressive shading, grime/wear texture and imperfect edges to keep it "gritty" rather than clean-anime-polish, sodium-amber/iron/cream palette with quarantine crimson/violet accents, recurring reroute nouns (flipping boards, reassigned platform numbers, quarantine stamps). Name explicitly that this diverges from the shared ink-and-wash backdrop rendering in technique only — composition stays governed by W2b (one subject, bold silhouette, simplified background) exactly as for every other world. The prompt template itself should bake in "single subject, key-art composition, no action panel, no multiple figures, no speed lines/screen-tone clutter" as a standing constraint alongside the style description, so every generated prompt inherits it rather than relying on each individual generation to remember.
3. Generate the 12 inset images at `600x600`, `transit-inset-<kebab>` keys, **using the `art-gen:generate-image` skill** (required, not an ad hoc equivalent — invoke it directly for each inset with prompts drawn from the README's prompt template). Expect this step to need iteration against W2a/W2b (bold silhouette, one subject, readable at `100x100`) and against the anime-but-gritty direction specifically (avoid drifting into either clean shonen-style polish or pure ink-and-wash) — and independently re-check every generated image against W2b's composition rule before accepting it, since "anime" is the axis most likely to tempt a busier, multi-element composition than the house style would.
4. Wire `assetBindings.ts`: import + map `transit-authority-bg`/`-overlay`/`-cardfront` and all 12 `transit-inset-*` keys, following the exact import-block-then-key-map pattern used by `city-of-sleeping-giants` (lines ~39-41, ~156-168, ~343-345) and `new-derelict` (lines ~46-48, ~183-193, ~377-379).
5. **Conditional:** wire an `unlock/world-transit-authority` entry in `assetManifest.ts` only if Transit ships selectable through the unlock system now. If Open Question 3 in the spec (world-select capacity) resolves to "ship hidden," defer this — `buildWorld`/`selectTheme` don't require it.
6. Confirm/add the `music-transit-authority` asset and its `audioManifest.ts` entry — do not reuse another world's key (see Slice 1 step 6 flag).

**Validation gate:** `worldAssetBindings.test.ts` (auto-covers via registry, no new file needed) passes with zero missing-key errors once Slice 1 and Slice 2 land together; visual smoke per REQ-TRANSIT-46 (reality layer readable under cards/HUD, overlay true-transparency, cardfront legible, insets readable at `100x100`).

### Slice 3 — Tests, validation, and documentation close-out

Files: `src/core/tests/transitAuthority.test.ts` (new), `src/game/tests/transitAuthorityPresentation.test.ts` (new)

Mirror `src/core/tests/newDerelict.test.ts` and `src/core/tests/cityOfSleepingGiants.test.ts` structure and `src/game/tests/newDerelictPresentation.test.ts` structure exactly:

1. **World-data shape** (REQ-TRANSIT-43, corrected): registry inclusion, `buildWorld` succeeds, no duplicate template ids, all **five** hooks defined per world card (not four — deviation 4), authored keywords are `Obstructed`/`Slow` only (checked against the full global `KeywordName` set, which now includes `Reroute` — `Reroute` itself must never appear as an authored keyword), threat mapping to `Entity Detected`, Act 3 ends with `The Walker`.
2. **Effect/data tests** (REQ-TRANSIT-44): one `it` per named pattern — `Service Change` top-decks + self-destructs; `Platform Reassignment` pins `Panic` + grants `Check the Board`; `Ticket Invalidated` `ForceDestroy`+`Brace` end-to-end (not HP `Damage`); `Train Arrives From Nowhere` forces `DiscardThenDraw` + top-decks; `Reissue Credentials` `OfferBoon` (not a multi-card grant) + top-decks on discard/end-of-turn; `Entity Detected` uses `AddThreatToWorldDeck` through the Transit mapping. Plus new **Reroute-specific** assertions: a hazard drawn after the `ApplyKeyword` pairing carries `Reroute:1`; `effectiveWorldCardCost` reflects the +1 tax on a Rerouted card; `Check the Board`/`Express Transfer` strip it via `RemoveKeyword`.
3. **Distinctness tests** (REQ-TRANSIT-48, renamed): `Board Anyway` vs `Follow The Vein`, `Right of Way` vs `Bone Pin` — confirm the ordered-effect-kind-sequence test still resolves both pairs as distinct after the Reroute wiring lengthens their sequences. Also add `Check the Board` vs `highway-volcano`'s `Floor It` (`ExileTopWorldCards amount:2, exhaust:true, energyCost:0`) — nearly identical shape, distinct only by the same thin cost-delta pattern already used for `Right of Way`/`Bone Pin`, and by the appended `RemoveKeyword` step this plan adds. Worth naming explicitly rather than leaving undocumented. Drop the REQ-TRANSIT-20 effect-blocklist check (deviation 1) — nothing to test since the requirement is gone.
4. **Seeded three-act identity** (REQ-TRANSIT-47), mirroring Giants' "seeded three-act identity" describe block exactly: Act 1 produces at least one `AddPlayerCardToTop` event and the player reaches Act 2 at ≥ half starting HP; Act 2 hazards force `DiscardThenDraw` and top-deck related routes; Act 3 chains `Entity Detected` (repeated `AddThreatToWorldDeck`) until cleared, exiled, or the Door is reached.
5. **Presentation test**, mirroring `newDerelictPresentation.test.ts` exactly: `selectTheme("transit-authority")` returns palette/backdrop/overlay/cardfront; all base + 12 inset keys resolve through `assetManifest`; `insets/README.md` documents prompts, filenames, finishing pass, `100x100` validation, and the `reroute` term.
6. Confirm (no new file needed) that `worldRegistry.test.ts`, `worldAssetBindings.test.ts`, and `src/sim/tests/completeness.test.ts` all auto-pass once Transit is in `worldDataRegistry` — they iterate the registry via `describe.each`/`buildAllWorlds`.
7. **Full gate:** `bun run test`, then `bun run lint && bun run typecheck && bun run build`.

## Final validation against the spec

Every REQ-TRANSIT-1..48 maps to a slice above except the tracked deviations:

- **REQ-TRANSIT-20** — dropped (deviation 1). Not implemented; superseded by REQ-TRANSIT-7 + REQ-TRANSIT-48.
- **REQ-TRANSIT-28** — implemented with a correction: five hooks, not four (deviation 4).
- **REQ-TRANSIT-38** — implemented with a rendering-style deviation: insets are anime-but-gritty, not shared ink-and-wash (deviation 5). Composition rules (W2a/W2b/W2d), palette, and inset-key/README/manifest requirements are otherwise unchanged.
- **REQ-TRANSIT-42** — implemented with a correction: a core-engine slice (Slice 0) exists because of the Reroute keyword (deviation 3).
- **REQ-TRANSIT-48** — implemented under the "distinctness" framing (deviation 2); same test, different name.

All other requirements (REQ-TRANSIT-1..19, 21-27, 29-37, 39-41, 43-47) are implemented as specced, located in the slice/step tables above. AI Validation checklist items 1-6 from the spec map directly onto Slice 3 steps 6-7 and Slice 2's validation gate.
