---
title: The Bargain (World 14 — Bargaining and Depression)
date: 2026-07-03
status: draft
tags: [world, walker-narrative, grief-arc, bargaining, depression, destiny-entity, keyword-cost-modifiers, concede]
modules: [core-effects, data-worlds]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-14-grief-mechanics.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/work/specs/the-quiet-before-noise.md
req-prefix: W14
---

# The Bargain world

The Walker learns what the Destiny actually is here — not by being told, but by finding the ledgers, the libraries on death, the Door. This is the second of three end-worlds, and where Bargaining (the search for another way out) gives way to Depression (the resigned choice that there isn't one). Its signature verb is **concede** — every act is some flavor of giving something up, whether it's spent chasing a deal or given up on chasing anything at all. Two new applied keywords, `Bargaining` and `Depression`, carry the weight, and `Destiny` continues its role from World 13 as the trouble — the same themed hazard entity, not the shared `Walker`/`Door` templates.

**Scope of this spec:** narrative shape and mechanism — the keyword/cost-modifier slice, the Destiny hazard's continuity from World 13, and card *roles* — not concrete final card templates, exact numbers, or deck counts. Those are an explicit authoring pass to follow (see Open Questions), matching how `the-quiet-before-noise.md` scoped World 13.

## Ratified decisions (2026-07-03)

- Grief-arc structure and act mapping (Act I Bargaining → Act II the Door as lore, not the mechanical closer → Act III Depression): `.lore/work/brainstorm/endworlds-destination.md`, `.lore/work/brainstorm/world-14-grief-mechanics.md`.
- The standard `The Walker` → `Door` → `SurviveWorld` Act 3 closer stays completely unmodified, same as World 13. `Destiny` remains a separate, additional entity, and remains "the trouble" here — the Door/Destiny role-flip is reserved exclusively for World 15.
- `.lore/reference/worlds/catalog/endworlds-trilogy-concept.md` is stale (describes the superseded Refusal/Acknowledgment fork and the Feat/Fragment-spending Bargain battle). Its correction is already tracked as a shipping blocker for the trilogy under `REQ-W13-26` — not duplicated here, but this world's implementation is blocked by the same fix.

## World Contract

<div id="REQ-W14-1"></div>

**REQ-W14-1:** `worldId` is `the-bargain`, identical kebab-case across the JSON `worldId`, world bundle id/meta, `VisualTheme.worldId`, registry entry, and asset bindings (RULE 0). Verified clear of collision against `src/data/worlds/registry.ts` and `.lore/work/specs/` at spec time.

<div id="REQ-W14-2"></div>

**REQ-W14-2:** The shared `The Walker`, `Summon Door`, and `Door` templates are used unmodified from starter source. No theme data redefines them (N1).

<div id="REQ-W14-3"></div>

**REQ-W14-3:** Act 3 ends with the fixed `{ "templateId": "The Walker", "count": 1 }` closer; discarding it adds `Door`; clearing `Door` fires `SurviveWorld` (D1). Nothing in this world's authoring touches that chain — "the Door" as a narrative concept appears earlier (Act II), but the mechanical closer card only appears at the fixed Act 3 position, same instance, same behavior as every other world.

## Narrative And Identity

<div id="REQ-W14-4"></div>

**REQ-W14-4:** The three-beat narrative spine maps to this world as:
1. Calm before: the Walker searching — an archive, a records room, somewhere that keeps track of the dead. Ambient unease is the discomfort of research, not attack. (Act I)
2. The intrusion: not a monster — the Walker's own findings start to matter, and the concept of the Door (not the mechanical closer card) becomes real and visible. (Act II)
3. The Door: unchanged from every other world as the fixed mechanical closer (REQ-W14-2/3). (Act 3, end only)

This world's three-beat narrative spine is deliberately **not** 1:1 with its three Acts, unlike the Zombie example table in `theme-authoring.md`: beats 1 and 2 land in Acts I and II respectively, but Act III (Depression) sits *between* beat 2 and the fixed beat-3 closer — it's the resigned aftermath of what beat 2 revealed, not a beat of its own. Depression's narrative content is carried in Act III's card recipe (REQ-W14-18) and the intro prose above, not as a fourth spine beat.

<div id="REQ-W14-5"></div>

**REQ-W14-5:** `Destiny` continues here exactly as introduced in World 13 (`the-quiet-before-noise.md` REQ-W13-6) — same themed, world-local hazard entity, not a shared template, not a new code-level type. No new naming decision needed; this world just continues using it. Glimpsed via lore in Act I, it becomes the thing carried onward by Act III (see REQ-W14-12/13).

<div id="REQ-W14-6"></div>

**REQ-W14-6:** Signature player verb: **concede**. Add a row to the theme-authoring.md signature-verb table: `the-bargain | concede | Bargaining and Depression keywords tax cost from two different directions — spending elsewhere (Bargaining) and settling into one thing (Depression) — every act gives something up`. Distinct from World 13's `compound` and all 12 existing verbs.

`Bargaining`'s tax shape (see REQ-W14-9) reuses the *value-summed-across-other-cards* modifier kind, which no shipped keyword currently uses — this is new ground, not a reskin of an owned mechanic. `Depression`'s shape reuses `Denial`'s self-tax pattern from World 13 (also `Lockdown`/`Reroute`'s shape) — permitted as a supporting-tool reuse, and deliberately *not* differentiated from Denial mechanically, because the brainstorm's open question ("does Depression compete with Bargaining, or does it settle instead") is resolved here as: Depression doesn't compete for anything, it just sits on the one card it's attached to and weighs on it. Reusing the plainest, least showy shape is the point.

## The Bargaining/Depression Mechanic (core-engine slice, layered on Eden Prime and World 13)

<div id="REQ-W14-7"></div>

**REQ-W14-7:** Depends on Eden Prime's `ApplyKeyword`/`KeywordGate`/`RemoveKeyword` primitives and the `KEYWORD_COST_MODIFIERS` generalization they enabled (see World 13's `REQ-W13-8`). Reuse, do not reimplement. Verify all mechanism claims directly against `src/core/model/keywords.ts`, `src/core/engine/effectiveCards.ts`, and `src/core/effects/appliedKeywords.ts` (the last is where `ApplyKeyword`/`RemoveKeyword`/decay actually live, and where REQ-W14-8a's authored-vs-applied distinction comes from) — sibling spec prose (including World 13's own citations of New Derelict/Transit Authority) has already been found to drift from what shipped; code is the only source of truth.

<div id="REQ-W14-8"></div>

**REQ-W14-8:** Two new keyword names added to `KEYWORD_NAMES`: `Bargaining`, `Depression`. Neither is added to `PERSISTENT_KEYWORDS`, so when applied at runtime via `ApplyKeyword` (REQ-W14-8a) they decay one tick per turn like `Alarm`. This decay rule only governs *applied* instances — `tickAppliedKeywordsAtTurnStart` walks `card.appliedKeywords` exclusively (confirmed against `src/core/effects/appliedKeywords.ts`) and never touches a card's static, authored `keywords` array, which has no decay concept at all. Confirmed at spec time that neither name collides with the current vocabulary (`Obstructed, Creature, Slow, Spore, Concealed, Alarm, Lockdown, Reroute`) or with World 13's `Denial`/`Anger`.

<div id="REQ-W14-8a"></div>

**REQ-W14-8a:** Signature-threat and tool-fetch cards (REQ-W14-16/18) apply `Bargaining`/`Depression` to themselves at runtime via `{ "kind": "ApplyKeyword", "keyword": "...", "value": N, "target": "self" }`, mirroring New Derelict's `Lockdown` self-application pattern (`src/core/tests/newDerelict.test.ts`). This is required, not optional: `RemoveKeywordHandler` only strips entries from `appliedKeywords` — per its own code comment, "authored keywords are template traits and are never stripped" — so if these cards instead authored the keyword statically in their `keywords` field, REQ-W14-14's and REQ-W14-19's strip-via-`RemoveKeyword` reward cards would silently no-op against them, and REQ-W14-8's decay claim would be false for those instances.

`Destiny` is the deliberate exception: REQ-W14-12 authors its `Depression` statically, not via `ApplyKeyword`, specifically so it never decays and can never be stripped by a reward card. The weight `Destiny` carries is meant to be permanent and non-negotiable within this world — contrast with ordinary threats, whose Bargaining/Depression tax is a real, strippable, decaying burden the player can work off.

<div id="REQ-W14-9"></div>

**REQ-W14-9:** `KEYWORD_COST_MODIFIERS` gains two entries, deliberately using two different modifier kinds so the pair reads as mechanically distinct:
- `Bargaining: { kind: "ClearCostPerOtherKeyword", costPer: 1 }` — a card's cost rises by the *summed value* of `Bargaining` carried on every **other** card in hand (excluding itself). This is the first real usage of `ClearCostPerOtherKeyword` in the codebase — the type and both engine switch-arms already exist (`src/core/model/types.ts:33`, `src/core/engine/effectiveCards.ts:36,73`) and are documented as "available for future use" in `.lore/reference/engine/effects-and-keywords/persistent-keyword-cost-modifiers.md:40`, but no keyword has ever registered it and no test exercises it. Treat this as genuinely new ground requiring its own test coverage, not a reuse of a proven path.
- `Depression: { kind: "ClearCostPerSelfKeyword", costPer: 1 }` — a card marked `Depression` is expensive to clear itself, mirroring `Denial`'s (World 13) and `Lockdown`/`Reroute`'s shape. Deliberately the plainest, most proven shape — see REQ-W14-6 for why that's the right call here rather than something more novel.

<div id="REQ-W14-10"></div>

**REQ-W14-10:** A deliberate, non-obvious consequence of `ClearCostPerOtherKeyword`'s semantics: the card *carrying* `Bargaining` is never taxed by its own `Bargaining` value (the modifier explicitly excludes the card being priced from the sum). Only *other* cards in hand pay for it. This is intentional, not a bug to fix later: bargaining with one specific thing is the "active negotiation" and stays cheap on its own terms, while every *other* unresolved thing in hand gets harder to deal with because the Walker's attention and leverage are elsewhere. Call this out explicitly in code comments near the registry entry so a future reader doesn't "fix" it into a self-tax.

<div id="REQ-W14-11"></div>

**REQ-W14-11:** This world must not introduce a third new keyword beyond `Bargaining`/`Depression`, and must not introduce a new `PersistentModifier` kind — the existing three (`ClearCostPerSelfKeyword`, `ClearCostPerKeywordCount`, `ClearCostPerOtherKeyword`) already cover every shape this world needs (mirrors `REQ-W13-11`'s scope boundary).

<div id="REQ-W14-12"></div>

**REQ-W14-12:** `Destiny`'s Act III hazard card is authored carrying `Depression` statically (e.g. `Depression:2`, in its template `keywords` field, not via `ApplyKeyword` — see REQ-W14-8a), so it self-taxes per REQ-W14-9, permanently and without decay, and its cost additionally climbs via `Bargaining`'s ambient other-card tax whenever any other hand card carries `Bargaining`. No bespoke effect is needed beyond authoring the keyword — `effectiveWorldCardCost` derives the total automatically from the two registered modifiers (both `hasKeyword`/`keywordValue` union authored and applied keywords identically for tax purposes, per `src/core/model/keywords.ts`), the same pattern World 13 established for its own Destiny card (`REQ-W13-12`).

<div id="REQ-W14-13"></div>

**REQ-W14-13:** `Destiny`'s `onCleared` in this world is `{ "kind": "None" }` — deliberately no reward, conventional or otherwise. Clearing it here doesn't feel like a win; it just marks that the Walker picked it up and kept walking. This is a different texture from World 13's `ExileTopWorldCards` (destructive, dramatic) — Depression's flatness rather than Anger's finality. `SurviveWorld` stays exclusively on the `Door` chain (REQ-W14-3); clearing Destiny is not a win condition in this world either.

## Reward Card Recipe

<div id="REQ-W14-14"></div>

**REQ-W14-14:** Per D2, reward player cards must diverge mechanically from every other world's reward space, including World 13's. Candidates (not final, needs an authoring pass): a card that strips `Bargaining` from a hand card, directly lowering what everything *else* in hand pays (a supporting use of `RemoveKeyword` against the `ClearCostPerOtherKeyword` tax); a card that strips `Depression` from a specific card, relieving its self-tax.

<div id="REQ-W14-15"></div>

**REQ-W14-15:** `OfferBoon` reflavored as a "reading" (consulting the ledger of the dead) is a legitimate, existing-effect way to deliver Act I's lore beat as a genuine choice between two Destiny-adjacent boons — not a trap, a real option. This is flavor guidance, not a mechanical requirement beyond "use `OfferBoon` as authored."

## World Card Recipe

<div id="REQ-W14-16"></div>

**REQ-W14-16:** Act I (Bargaining) — signature threat and tool-fetch cards carry `Bargaining`. Includes a hazard whose `onCleared` uses `AddPlayerCardToTop` to queue a Destiny-lore card onto the very next draw (the "glimpse of libraries on death" beat), and at least one `Modal` card offering a genuine branch — pay in one currency or another (e.g., destroy a hand card *or* take a resource hit) — literalizing "what would you give up." `AddThreatToWorldDeck` seeds at least one hidden-cost hazard that surfaces later in the act. Every card defines all five hooks (`onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`, `onDraw`), using `{ "kind": "None" }` where inert (C3) — this applies across REQ-W14-16..19, not just this act.

<div id="REQ-W14-17"></div>

**REQ-W14-17:** Act II (the Door, as concept) — `AddWorldCardToDeck { bTop: true }` (not `ReturnWorldCards`, which is inert on world-card auto-hooks per `theme-authoring.md` C1 and confirmed against code during World 13's spec pass) seeds lingering hazards representing "eleven violet fractures hanging suspended" — the visible, accumulating cost of what the Walker is learning. `ExileTopWorldCards` foreshadows the point-of-no-return Act III commits to, without yet being that commitment.

<div id="REQ-W14-18"></div>

**REQ-W14-18:** Act III (Depression) — signature threat and hazards carry `Depression`; includes the `Destiny` hazard (REQ-W14-12/13) and the fixed `The Walker` closer (REQ-W14-3). Includes a `DiscardThenDraw` card framed as "let go and keep moving" — cycling rather than resolving — and at least one `Brace` card reframed as endurance rather than defense.

<div id="REQ-W14-19"></div>

**REQ-W14-19:** Tool-fetch card(s) (`Obstructed`, per the shared Card Recipe role) grant the means to strip `Bargaining`/`Depression` via `RemoveKeyword`, countering the signature threat per the standard recipe pattern.

## Deck Composition

<div id="REQ-W14-20"></div>

**REQ-W14-20:** Three acts, sizes expressing the threat verb: Act I heaviest on genuine branching choices (Modal bargains), Act II moderate (the accumulating-cost beat doesn't need volume, it needs visibility), Act III heavier on `Depression`-carrying cards as the weight settles in. Exact counts deferred to the authoring pass.

<div id="REQ-W14-21"></div>

**REQ-W14-21:** Act 3 always ends with `{ "templateId": "The Walker", "count": 1 }` (restates REQ-W14-3 at the deck-composition level, per D1).

## Visual Theme

<div id="REQ-W14-22"></div>

**REQ-W14-22:** `VisualTheme` fields required per contract: `worldId`, `intrusionHue`, `realityPalette`, `frameStyle`, `backdrop`. Act I should read as dry, archival, dust-toned; Act II introduces the violet fracture motif from `endworlds-destination.md`'s original imagery; Act III desaturates further into grey-blue, matching World 15's brainstorm note that its own Act II ("muted grey-blue, no threat music") reprises this world's Act III palette.

<div id="REQ-W14-23"></div>

**REQ-W14-23:** Distinct from all existing worlds' palettes (V1), and distinct from World 13's warming-toward-hot arc — this world should trend the opposite direction, toward cool and muted.

## Display And Help

<div id="REQ-W14-24"></div>

**REQ-W14-24:** Display/help metadata follows the standard world bundle shape (`meta.ts`). Help text should not spell out the grief-stage metaphor explicitly, matching REQ-W13-24's precedent.

## Documentation

<div id="REQ-W14-25"></div>

**REQ-W14-25:** Add `the-bargain` as a new row in the theme-authoring.md signature-verb table (REQ-W14-6), immediately following whatever row World 13's `compound` lands as. Document `Bargaining`/`Depression` as **C2 prose**, not a Signature Effects table row — checked directly against `theme-authoring.md`: `Lockdown` and `Reroute` are documented as prose within C2 ("The current keyword vocabulary is..."), not as rows in the Signature Effects table (that table only lists `CardEffect` kinds, e.g. `DealProgressScaled`, `GainLight`, the `ApplyKeyword`/`KeywordGate`/etc. primitive family). World 13's `REQ-W13-25` stated this incorrectly as a table entry; both this spec and World 13's are corrected to match the actual document structure. Call out `Bargaining` explicitly as the first real-world user of `ClearCostPerOtherKeyword`.

<div id="REQ-W14-26"></div>

**REQ-W14-26:** The `endworlds-trilogy-concept.md` staleness fix is a shared trilogy-level blocker already tracked under `REQ-W13-26` — not duplicated here, but this world's implementation shares that same blocking dependency.

## Tests And Validation

<div id="REQ-W14-27"></div>

**REQ-W14-27:** `worldRegistry.test.ts`-style conformance: `selectTheme("the-bargain")` resolves the theme, `buildWorld` assembles without error, no duplicate template ids, every world card defines all five hooks.

<div id="REQ-W14-28"></div>

**REQ-W14-28:** New unit tests for the `Bargaining`/`Depression` `KEYWORD_COST_MODIFIERS` entries. Since `ClearCostPerOtherKeyword` has zero existing test coverage anywhere in the codebase, this world's tests are the first to exercise it — cover at minimum: a card with no `Bargaining`-carrying peers pays no `Bargaining` tax; a card gains tax proportional to the *summed value* (not count) of `Bargaining` on other cards; the `Bargaining`-carrying card itself is excluded from its own tax (REQ-W14-10). Confirm neither `Bargaining` nor `Depression` appears in `PERSISTENT_KEYWORDS`.

## AI Validation

<div id="REQ-W14-29"></div>

**REQ-W14-29:** Before marking this spec's implementation complete, the AI must:
1. Run `bun run test` and confirm all existing tests plus new World 14 tests pass.
2. Confirm `bun run lint && bun run typecheck && bun run build` succeed.
3. Verify via a unit test that `ClearCostPerOtherKeyword` sums *value*, not card count — e.g. one other card carrying `Bargaining:3` produces the same tax as three other cards each carrying `Bargaining:1`, since both sum to 3. This is the detail most likely to be implemented wrong by analogy to `ClearCostPerKeywordCount` (which counts cards, ignoring value).
4. Verify that a card carrying `Bargaining` itself receives zero tax contribution from its own `Bargaining` value (REQ-W14-10) — construct a hand where only one card carries `Bargaining` and confirm that card's effective cost is unaffected by it, while every other card's cost rises.
5. Verify that `Destiny`'s effective cost, with a self-authored `Depression:2` and a separate `Bargaining:3`-carrying card elsewhere in hand, equals `baseCost + 2*costPer(Depression) + 3*costPer(Bargaining)` — both modifiers must stack.
6. Confirm no engine change touched `The Walker`/`Door`/`SurviveWorld` wiring (REQ-W14-2/3) — the shared starter templates should be byte-identical before and after.
7. Verify a signature-threat card's `Bargaining`/`Depression` (applied via `ApplyKeyword { target: "self" }` per REQ-W14-8a) actually decays to zero and is removed after enough turns pass with no reapplication, and that a `RemoveKeyword` reward card successfully strips it before then.
8. Verify a `RemoveKeyword` reward card targeting `Destiny` is a no-op against its authored `Depression` — confirming the deliberate authored/applied asymmetry from REQ-W14-8a actually holds, not just that it's documented.

## Open note on inherited scope

Neither this spec nor World 13's addresses whether `ClearCostPerKeywordCount`/`ClearCostPerOtherKeyword`-style ambient taxes are intended to inflate the effective cost of `The Walker`/`Door` themselves when they're in hand alongside Anger/Bargaining-carrying cards (both taxes apply to every world card in hand regardless of whether that card carries the keyword). This isn't a new gap introduced here — it already exists in World 13 — but it's called out explicitly so it gets resolved once, at the trilogy level, rather than drifting further across World 15.

This is a deliberate narrative resolution, not a silent one: `world-14-grief-mechanics.md`'s own "Open threads" left unresolved whether Bargaining/Depression should compete (max-of-two, "whichever is winning") like `endworlds-destination.md`'s general framing suggests, or whether Depression should fully eclipse Bargaining by Act III. REQ-W14-9/12 resolve this as unconditional additive stacking, same choice World 13 made for Denial/Anger (`REQ-W13-12`) — both taxes are always live, regardless of which is "bigger." This closes that brainstorm's open thread rather than leaving it open.

## Open Questions

- Final worldId/title (`the-bargain`) is a recommendation carried over from the original (superseded) brainstorm's title for this world, not yet confirmed.
- Signature verb `concede` is a recommendation, not yet confirmed — needs to also not collide with whatever World 15 ends up needing.
- Exact `costPer` values, `Destiny`'s authored `Depression` value (`Depression:2` is a placeholder), and final deck-composition counts are unauthored — this spec fixes shape and mechanism, not tuning.
- Whether `Bargaining`'s "the carrier pays nothing, everyone else pays" asymmetry (REQ-W14-10) reads clearly to a player without an explicit UI callout — flagged, not resolved; may need a `game/` view-layer follow-up.
- Whether `Bargaining`/`Depression` should render distinctly in the UI, same open item as World 13's `Denial`/`Anger`.
