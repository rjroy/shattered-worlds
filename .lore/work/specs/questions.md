---
title: Questions (World 13 — Denial and Anger)
date: 2026-07-03
status: draft
tags: [world, walker-narrative, grief-arc, denial, anger, destiny-entity, keyword-cost-modifiers, compound]
modules: [core-effects, data-worlds]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/work/specs/eden-prime.md
  - .lore/work/specs/new-derelict.md
  - .lore/work/specs/transit-authority.md
  - .lore/work/brainstorm/player-support-message.md
req-prefix: W13
---

# Questions world

The Walker arrives somewhere ordinary gone quiet — a hospital corridor, a kitchen with a chair pulled up to an empty seat — and for the first time in the run, nothing attacks. The world's wrongness is absence, not assault. This is the first of three end-worlds closing out the game's 15-world arc, and the first to name what every prior world's flight was actually running from: losing a parent. Its signature verb is **compound** — the cost of confronting anything here climbs the longer it goes avoided or raged against, carried by two new applied keywords (`Denial`, `Anger`) and a new in-fiction hazard entity, `Destiny`, whose expense is a direct readout of how much grief the player is still carrying.

**Scope of this spec:** this fixes narrative shape and mechanism — the keyword/cost-modifier slice, the Walker/Door/Destiny structure, and card *roles* — not concrete final card templates, exact numbers, or deck counts. Those are an explicit authoring pass to follow (see Open Questions).

## Ratified decisions (2026-07-03)

- Grief-arc structure and three-act stage mapping (Loss/fear/helplessness → Denial → Anger), and the `Destiny` entity concept: `.lore/work/brainstorm/endworlds-destination.md`, `.lore/work/brainstorm/world-13-grief-mechanics.md`.
- Freeze/Thaw/Heat suite demoted to optional minor flavor only — that suite is `whiteout-parking-garage`'s signature.
- The standard `The Walker` → `Door` → `SurviveWorld` Act 3 closer stays completely unmodified. `Destiny` is a separate, additional entity, not a replacement.
- The Refusal/Acknowledgment ending-fork was dropped at the trilogy level; not relevant to this world's Act 3 (that resolution lives in World 15).

## World Contract

<div id="REQ-W13-1"></div>

**REQ-W13-1:** `worldId` is `questions`, identical kebab-case across the JSON `worldId`, world bundle id/meta, `VisualTheme.worldId`, registry entry, and asset bindings (RULE 0).

<div id="REQ-W13-2"></div>

**REQ-W13-2:** The shared `The Walker`, `Summon Door`, and `Door` templates are used unmodified from starter source. No theme data redefines them (N1).

<div id="REQ-W13-3"></div>

**REQ-W13-3:** Act 3 ends with the fixed `{ "templateId": "The Walker", "count": 1 }` closer; discarding it adds `Door`; clearing `Door` fires `SurviveWorld` (D1). Nothing in this world's authoring touches that chain.

## Narrative And Identity

<div id="REQ-W13-4"></div>

**REQ-W13-4:** The three-beat narrative spine maps to this world as:
1. Calm before: an ordinary, specific place — a hospital corridor, or the room with the empty chair. Ambient unease is absence, not assault; nothing attacks for the opening turns.
2. The intrusion: the Walker's arrival doesn't summon a monster — it triggers the actual event, the loss becoming real. The catastrophe *is* grief made mechanical, not a creature.
3. The Door: unchanged from every other world (see REQ-W13-2/3).

<div id="REQ-W13-5"></div>

**REQ-W13-5:** The last words "I'm outta here" are the emotional anchor and must surface as in-fiction card flavor at least once — candidate: a card whose only effect is `DestroySelf`, nothing else (see World Card Recipe, REQ-W13-16).

<div id="REQ-W13-6"></div>

**REQ-W13-6:** Naming note: `Destiny` is deliberately the same word as the game's existing meta-progression currency (Destiny Blessings/Destiny Progression — `.lore/reference/progression/destiny-and-unlocks/destiny-progression.md`). This is an intentional pun, not an oversight — the trilogy's premise is literally "the Walker is fleeing the Destiny," and this world is where that entity first takes in-fiction form. `Destiny` here is a themed world-card entity local to this world's data, not a shared template and not a new code-level type, so the collision is a narrative/documentation risk only, not an engine one. Any code comment or flavor text near the card should say so plainly, so a future reader doesn't confuse it with the progression system.

<div id="REQ-W13-7"></div>

**REQ-W13-7:** Signature player verb: **compound**. Add a row to the theme-authoring.md signature-verb table: `questions | compound | Denial/Anger keywords tax cost the longer grief goes unaddressed; Destiny's cost is a direct readout of accumulated Denial+Anger`. Distinct from all 12 existing verbs and reserved ahead of Worlds 14/15, which need their own.

Denial's shape reuses `isolate`'s self-tax pattern and Anger's reuses `startle`'s ambient-tax pattern (both permitted as supporting tools per "no mechanic is exclusive; identity is"). What makes `compound` its own identity, not a reskinned isolate-plus-startle, is that both shapes land on the *same* entity (`Destiny`) simultaneously and stack rather than acting independently — the signature experience is watching one specific cost climb from two directions at once as two different emotional responses pile up, not either tax mechanic alone.

## The Denial/Anger Mechanic (core-engine slice, layered on Eden Prime)

<div id="REQ-W13-8"></div>

**REQ-W13-8:** Depends on Eden Prime's `ApplyKeyword`/`KeywordGate`/`RemoveKeyword`/`GainKeywordGuard` primitives and the `KEYWORD_COST_MODIFIERS` generalization they enabled. Reuse, do not reimplement. Verify the actual mechanism against `src/core/model/keywords.ts` and `src/core/engine/effectiveCards.ts` directly rather than trusting the `new-derelict.md`/`transit-authority.md` spec prose by example — those documents have already drifted from what shipped (e.g. New Derelict's spec describes Lockdown as a per-cluster tax, but the shipped `ClearCostPerSelfKeyword` only reads a card's own keyword value; Transit Authority's spec claims "no Reroute keyword," but `Reroute` ships as a full keyword with its own `KEYWORD_COST_MODIFIERS` entry). Code is the source of truth here, not sibling spec text.

<div id="REQ-W13-9"></div>

**REQ-W13-9:** Two new keyword names added to `KEYWORD_NAMES`: `Denial`, `Anger`. Both must be transient (decay at turn start like `Alarm`) and must **not** be added to `PERSISTENT_KEYWORDS` — grief that isn't engaged with fades on its own if left alone. Confirmed directly against `src/core/model/keywords.ts:25`: `PERSISTENT_KEYWORDS` currently contains `Lockdown` and `Reroute` (Reroute is persistent, not transient — do not use it as a "decays like this" example when implementing). `RemoveKeyword` remains available as an active clear on top of natural decay.

<div id="REQ-W13-10"></div>

**REQ-W13-10:** `KEYWORD_COST_MODIFIERS` gains two entries with deliberately different shapes, so the two keywords read as mechanically distinct rather than reskins of each other:
- `Denial: { kind: "ClearCostPerSelfKeyword", costPer: 1 }` — a card marked `Denial` is expensive to clear *itself*: the specific thing being avoided is the thing that's hard to face. Mirrors `Lockdown`/`Reroute`'s shape.
- `Anger: { kind: "ClearCostPerKeywordCount", costPer: 1 }` — any `Anger`-carrying card anywhere in hand taxes the clear cost of *every* card in hand. Mirrors `Alarm`'s shape. Anger doesn't stay contained to what caused it.

<div id="REQ-W13-11"></div>

**REQ-W13-11:** This world must not introduce a third new keyword or a new `PersistentModifier` kind — `ClearCostPerSelfKeyword` and `ClearCostPerKeywordCount` already cover both needed shapes (mirrors REQ-EDEN-14's scope boundary).

<div id="REQ-W13-12"></div>

**REQ-W13-12:** `Destiny`'s Act III hazard card is authored carrying the `Denial` keyword (e.g. `Denial:2`), so it self-taxes per REQ-W13-10, and its cost additionally climbs for free via `Anger`'s ambient `ClearCostPerKeywordCount` tax whenever any Anger-carrying card is in hand. No bespoke `DealProgressScaled`/counter effect is needed — `effectiveWorldCardCost` already derives this from the two registered modifiers. This supersedes the brainstorm's original `DealProgressScaled`-off-`KeywordInHand` sketch, which turned out to be unnecessary once the modifier registry was checked directly.

This is a deliberate narrative change from both brainstorm docs' framing, not just an implementation swap: `world-13-grief-mechanics.md` and `endworlds-destination.md` both describe Destiny's cost scaling with "whichever of Denial/Anger is winning" (a contest, effectively a max of the two). What's specced here is unconditional stacking — both taxes always apply, added together, regardless of which is larger. "Whichever wins" isn't naturally expressible with the existing modifier kinds without new engine work, and the stacking version arguably fits the signature verb better anyway: grief *compounds* rather than resolving into a single dominant stage. Calling this out explicitly since it changes what the brainstorm implied.

<div id="REQ-W13-13"></div>

**REQ-W13-13:** `Destiny`'s `onCleared` uses `ExileTopWorldCards` — cutting off future moments entirely and permanently — distinct from `SurviveWorld`, which stays exclusively on the `Door` chain (REQ-W13-3). Clearing Destiny in this world is not a win condition; it's a costly, optional confrontation.

## Reward Card Recipe

<div id="REQ-W13-14"></div>

**REQ-W13-14:** Per D2, reward player cards must diverge mechanically from every other world's reward space. Candidates (not final, needs an authoring pass): a card that strips `Denial` from another card in hand (a supporting, not central, use of `RemoveKeyword`); a card that strips `Anger` from a card in hand, directly lowering the count that feeds `Anger`'s ambient `ClearCostPerKeywordCount` tax on everything else (also `RemoveKeyword`). Note: `GainKeywordGuard` was considered for the second candidate but doesn't fit — a `keywordGuard` charge only suppresses a `KeywordGate`'s `then` effect from firing; it has no path into `extraWorldCardCost`, so it cannot discount a cost tax. There is currently no primitive that refunds or discounts a `KEYWORD_COST_MODIFIERS` tax directly, and building one would be a new `PersistentModifier` kind, which REQ-W13-11 forbids.

<div id="REQ-W13-15"></div>

**REQ-W13-15:** No reward card in this world may make Freeze/Thaw/Heat its central identity — at most one flavor card may touch `FreezeCards`/`ThawCards`, matching the brainstorm's "a card or two" cap.

## World Card Recipe

<div id="REQ-W13-16"></div>

**REQ-W13-16:** Act 1 (Loss, fear, helplessness) — ambient foreshadow and obstacle cards only; no `Denial`/`Anger` present yet. Includes the "I'm outta here" card (`DestroySelf`-only, no other effect, per REQ-W13-5) and one `ForceDestroy`-queuing card with no `Brace` available yet. Every world card in this world defines all five required hooks — `onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`, and `onDraw` — using `{ "kind": "None" }` for any hook with no effect (C3); this applies across REQ-W13-16..19, not just this act.

<div id="REQ-W13-17"></div>

**REQ-W13-17:** Act 2 (Denial) — signature threat and tool-fetch cards carry `Denial`. Includes a hazard whose `onEndOfTurn` (or `onPartialClear`) uses `AddWorldCardToDeck { bTop: true }` to re-seed itself (or a related hazard template), then `DestroySelf` — rejecting the immediate confrontation only for it to resurface. **Not** `ReturnWorldCards`: per `theme-authoring.md` C1, that effect is inert (a no-op) when fired from a world card's own automatic hooks — it's boon-signed, meaning it only functions when a player card returns hazards as a reward effect. This corrects the brainstorm's original sketch, which missed that constraint; New Derelict and Transit Authority both hit this same pitfall and settled on the `AddWorldCardToDeck { bTop: true }` + `DestroySelf` pattern instead (see the Self-Transform Pattern in `theme-authoring.md`).

<div id="REQ-W13-18"></div>

**REQ-W13-18:** Act 3 (Anger) — signature threat and hazards carry `Anger`; includes the `Destiny` hazard (REQ-W13-12/13) and the fixed `The Walker` closer (REQ-W13-3). Includes a `DealProgressAll`-based card as the indiscriminate "Why" swing.

<div id="REQ-W13-19"></div>

**REQ-W13-19:** Tool-fetch card(s) (`Obstructed`, per the shared Card Recipe role) grant the means to strip `Denial`/`Anger` via `RemoveKeyword`, countering the signature threat per the standard recipe pattern.

## Deck Composition

<div id="REQ-W13-20"></div>

**REQ-W13-20:** Three acts, sizes expressing the threat verb: Act 1 lightest (foreshadow only), Acts 2 and 3 heavier as Denial/Anger keyword density climbs. Exact counts are deferred to the authoring pass; this spec fixes shape, not final numbers.

<div id="REQ-W13-21"></div>

**REQ-W13-21:** Act 3 always ends with `{ "templateId": "The Walker", "count": 1 }` (restates REQ-W13-3 at the deck-composition level, per D1).

## Visual Theme

<div id="REQ-W13-22"></div>

**REQ-W13-22:** `VisualTheme` fields required per contract: `worldId`, `intrusionHue`, `realityPalette`, `frameStyle`, `backdrop`. `intrusionHue` should read muted/desaturated in Act 1, warming through Act 2, and hot/saturated by Act 3 — matching World 15's brainstorm note that its own Act 1 visuals ("saturated, fast") are a reprise of this world's Act 3 palette.

<div id="REQ-W13-23"></div>

**REQ-W13-23:** Distinct from all existing worlds' palettes (V1), in particular distinct from `whiteout-parking-garage`'s cool freeze palette, since this world uses that suite only as minor flavor, not identity.

## Display And Help

<div id="REQ-W13-24"></div>

**REQ-W13-24:** Display/help metadata follows the standard world bundle shape (`meta.ts`). Help text should not spell out the grief-stage metaphor explicitly — the player should be able to feel it without being told, matching the trilogy's overall design intent.

## Documentation

<div id="REQ-W13-25"></div>

**REQ-W13-25:** Add `questions` as a new row in the theme-authoring.md signature-verb table (REQ-W13-7). Document `Denial`/`Anger` as **C2 prose**, not a Signature Effects table row — checked directly against `theme-authoring.md`: `Lockdown` and `Reroute` are documented as prose within C2 ("The current keyword vocabulary is..."), not as rows in the Signature Effects table (that table lists `CardEffect` kinds only, e.g. `DealProgressScaled`, `GainLight`, the `ApplyKeyword`/`KeywordGate`/etc. primitive family). This corrects the original version of this requirement, which stated the wrong document structure.

<div id="REQ-W13-26"></div>

**REQ-W13-26:** `.lore/reference/worlds/catalog/endworlds-trilogy-concept.md` currently describes the superseded Refusal/Acknowledgment ending fork, stale relative to the 2026-07-03 brainstorm decision. Updating it is a hard blocker on this world shipping (not merely this spec's implementation) — add it as a checklist item to whatever plan executes this spec, since nothing in Tests/AI Validation below would otherwise catch a stale reference doc.

## Player Support Notice

This is a trilogy-level UI concern, defined once here since all three grief-arc worlds trigger the same shared scaffolding; `answers.md` and `the-beginning.md` reference this section rather than re-specifying it (same pattern as REQ-W13-26).

<div id="REQ-W13-30"></div>

**REQ-W13-30:** The first time a player selects any of Worlds 13/14/15 (`questions`, `answers`, `the-beginning`) for play, a one-time interstitial scene is shown before the world's `Table` scene launches, presenting the player support copy from `.lore/work/brainstorm/player-support-message.md` verbatim: the headline, body naming grief/death/losing-a-parent directly, the findahelpline.com link, the 988 US/Canada links, and the emergency-services line. This resolves the brainstorm's open placement question as a dedicated interstitial, not a world-select-card link or a passive help-overlay entry — chosen specifically because it guarantees every player encounters the notice at least once rather than requiring them to discover and tap an optional affordance first.

<div id="REQ-W13-31"></div>

**REQ-W13-31:** "First time" is tracked per save profile, not per world and not per run: a single boolean flag (e.g. `hasSeenGriefSupportNotice`) persisted in the runtime profile store (`src/game/runtime/`), set once the interstitial is dismissed, regardless of which of the three worlds triggered it first. Selecting a second or third of these worlds afterward — in any order the unlock system permits — skips straight to `Table` like every other world; the notice is not re-shown per-world or per-run.

<div id="REQ-W13-32"></div>

**REQ-W13-32:** Mechanically: `WorldSelectScene`'s card `pointerdown` handler (currently a direct `this.scene.launch("Table", { worldId, seed })` for every world) branches only for these three `worldId`s — if the profile flag is unset, launch a new interstitial scene instead, passing `worldId`/`seed` through; that scene renders the copy plus a single acknowledgment control ("Continue"), and on dismissal sets the flag via the runtime store and then itself launches `Table`. This is new, additive scaffolding sitting between world-select and gameplay — it does not repurpose or modify `HelpOverlayView`, `SettingsOverlayView`, or the existing per-card help/settings buttons, and no other world's card-click path changes.

<div id="REQ-W13-33"></div>

**REQ-W13-33:** The interstitial's external links (findahelpline.com, 988lifeline.org, 988.ca) must open in the system's external browser, not in-game. This is the first outbound link in the codebase — a repo-wide grep for `window.open`/`http`/`mailto:` under `src/` currently returns nothing — so its opening mechanism is new ground requiring its own test coverage, not an assumption that an existing pattern already covers it.

## Tests And Validation

<div id="REQ-W13-27"></div>

**REQ-W13-27:** `worldRegistry.test.ts`-style conformance: `selectTheme("questions")` resolves the theme, `buildWorld` assembles without error, no duplicate template ids, and every world card defines all five hooks (`onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`, `onDraw`).

<div id="REQ-W13-28"></div>

**REQ-W13-28:** New unit tests for the `Denial`/`Anger` `KEYWORD_COST_MODIFIERS` entries, mirroring existing Lockdown/Alarm cost-modifier tests — confirm `ClearCostPerSelfKeyword` and `ClearCostPerKeywordCount` both compute correctly for the new names, that `Destiny`'s effective cost reflects both simultaneously, and that neither `Denial` nor `Anger` appears in `PERSISTENT_KEYWORDS` (both must decay at turn start).

## AI Validation

<div id="REQ-W13-29"></div>

**REQ-W13-29:** Before marking this spec's implementation complete, the AI must:
1. Run `bun run test` and confirm all existing tests plus new World 13 tests pass.
2. Confirm `bun run lint && bun run typecheck && bun run build` succeed.
3. Verify via a unit test (not just manual read) that a hand containing an `Anger`-keyword card raises `effectiveWorldCardCost` on an unrelated, non-Anger-carrying card in the same hand — this is the behavior that makes Anger's tax "indiscriminate" per REQ-W13-10, and it's easy to implement wrong (e.g. accidentally scoped like `ClearCostPerOtherKeyword` instead of the intended all-cards `ClearCostPerKeywordCount`).
4. Verify that `Destiny`'s effective cost, with both a self-authored `Denial:2` and a separate `Anger`-carrying card elsewhere in hand, equals `baseCost + 2*costPer(Denial) + count*costPer(Anger)` — both modifiers must stack, neither should override the other.
5. Confirm no engine change touched `The Walker`/`Door`/`SurviveWorld` wiring (REQ-W13-2/3) — the shared starter templates should be byte-identical before and after.
6. Verify the one-time grief-support interstitial (REQ-W13-30..33): on a fresh profile, selecting any of Worlds 13/14/15 for the first time shows the interstitial before `Table` launches; dismissing it persists the profile flag; selecting a second of the three worlds afterward skips straight to `Table`; and the interstitial's external links open via the system browser rather than in-game navigation.

## Open Questions

- Final worldId/title (`questions`) is a recommendation, renamed from the original brainstorm's working title ("The Quiet Before Noise") during spec review; not yet confirmed.
- Signature verb `compound` is a recommendation, not yet confirmed — it also needs to not collide with whatever verbs Worlds 14 and 15 end up with.
- Exact `costPer` values, `Destiny`'s authored `Denial` value (`Denial:2` is a placeholder), and final deck-composition counts are unauthored — this spec fixes shape and mechanism, not tuning.
- Whether `Denial`/`Anger` should render distinctly in the UI (separate icon/color per keyword) is unaddressed and may need a `game/` view-layer follow-up spec.
- Whether a dismissed support notice (REQ-W13-30..33) needs a persistent "view again" affordance elsewhere (e.g. settings) is unresolved — once-per-profile means a player who dismisses it quickly has no obvious way to find it again later.
- Whether the interstitial auto-advances after a delay or requires an explicit tap on "Continue" is unspecified; REQ-W13-32 assumes an explicit acknowledgment control but doesn't rule out also allowing a timeout.
