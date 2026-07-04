---
title: The Beginning (World 15 — Acceptance, the finale)
date: 2026-07-03
status: draft
tags: [world, walker-narrative, grief-arc, acceptance, destiny-entity, keyword-cost-modifiers, unburden, finale]
modules: [core-effects, data-worlds]
related:
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-15-grief-mechanics.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/work/specs/questions.md
  - .lore/work/specs/answers.md
  - .lore/work/brainstorm/player-support-message.md
req-prefix: W15
---

# The Beginning world

The Walker arrives one last time, and everything from Worlds 13 and 14 is here at once — Denial, Anger, Bargaining, Depression, all reprised, all still taxing. But this world's actual subject isn't another world to survive. It's a decision about how long to keep fighting before sitting down. Its signature verb is **unburden** — every prior world's mechanical weight is still being carried in Act I/II, and Act III is the one place in the whole game where a keyword makes something *cheaper* instead of costlier. `Destiny` continues as the trouble, authored with a cost high enough to be nigh-impossible without real, repeated engagement — not avoidance, not more fighting, just staying with it.

**Scope of this spec:** narrative shape and mechanism — the keyword reprise, the `Acceptance` cost-discount slice, and card *roles* — not concrete final card templates, exact numbers, or deck counts. Matches the scope discipline `questions.md` and `answers.md` both used.

## Ratified decisions (2026-07-03)

- Grief-arc structure (Act I Denial+Anger reprised, Act II Bargaining+Depression reprised, Act III Acceptance): `.lore/work/brainstorm/endworlds-destination.md`, `.lore/work/brainstorm/world-15-grief-mechanics.md`.
- The Refusal/Acknowledgment ending fork is dropped entirely — not carried forward even in reduced form. World 15 converges on a single Acceptance ending (see `endworlds-destination.md`'s "Design Decision: single convergent ending").
- `The Walker` and `Door` remain completely standard here — same authoring, same cost, no special-casing, exactly as in every other world. The ordinary escape every world has is still available, untouched, if the player never engages with `Destiny` at all.
- `Destiny` is authored with a base cost high enough to be nigh-impossible to clear without substantial `Acceptance` — an earned alternate path to `SurviveWorld`, not a change to `Door`'s difficulty and not a replacement for it.
- `.lore/reference/worlds/catalog/endworlds-trilogy-concept.md` staleness is a shared trilogy-level blocker already tracked under `REQ-W13-26`.

## World Contract

<div id="REQ-W15-1"></div>

**REQ-W15-1:** `worldId` is `the-beginning`, identical kebab-case across the JSON `worldId`, world bundle id/meta, `VisualTheme.worldId`, registry entry, and asset bindings (RULE 0). Verified clear of collision against `src/data/worlds/registry.ts` and `.lore/work/specs/` at spec time.

<div id="REQ-W15-2"></div>

**REQ-W15-2:** The shared `The Walker`, `Summon Door`, and `Door` templates are used unmodified from starter source, with zero special-casing (no cost tax targeted at them, no keyword ever applied to them by this world's cards). No theme data redefines them (N1).

<div id="REQ-W15-3"></div>

**REQ-W15-3:** Act 3 ends with the fixed `{ "templateId": "The Walker", "count": 1 }` closer; discarding it adds `Door`; clearing `Door` fires `SurviveWorld` (D1), exactly as in every other world. `Destiny`'s own `onCleared` *also* fires `SurviveWorld` (REQ-W15-13) — this is a second, independent path to the same terminal effect, not a modification of the first. Both `Door`'s and `Destiny`'s paths to `SurviveWorld` can coexist in the same world without conflict, since `SurviveWorld` simply sets `state.status = "won"` regardless of which card's `onCleared` invoked it.

## Narrative And Identity

<div id="REQ-W15-4"></div>

**REQ-W15-4:** The three-beat narrative spine compresses rather than maps 1:1 to this world's three acts: beat 1 (calm before) and beat 2 (the intrusion) both already happened, twice, in Worlds 13 and 14 — Act I and Act II here are a fast, familiar reprise of that same material, not a fresh telling. Beat 3 (the Door) still lands at the fixed Act 3 position (REQ-W15-3), but the world's actual dramatic center is Act III's introduction of `Destiny` as a second, earned path — new content this world adds, not part of the three-beat spine at all.

<div id="REQ-W15-5"></div>

**REQ-W15-5:** `Destiny` continues exactly as introduced in World 13 and carried through World 14 — same themed, world-local hazard entity, not a shared template. In World 15 specifically, its `onCleared` fires `SurviveWorld` (REQ-W15-13), which is new to this world (Worlds 13/14 used `ExileTopWorldCards`/`None` respectively — see REQ-W15-13 for why this world's version differs).

<div id="REQ-W15-6"></div>

**REQ-W15-6:** The "different version of the Walker" who is doing the actual fighting while the player supports him (per `world-15-grief-mechanics.md`'s Act III imagery) must **not** be authored as a new instance or reflavor of the shared `The Walker` template — duplicate template ids throw, and N1 forbids theming that template regardless. This companion figure needs no new card template at all: it is achieved entirely through **flavor text on existing player-card effects** (`Heal`, `GainEnergy`, `GainLight`, `Brace` — see REQ-W15-16), recast narratively as caretaking rather than self-preservation, with no new mechanic, effect, or template backing it. If a future authoring pass wants the companion figure to be a visible on-screen presence, that's a `game/` view-layer concern, out of scope here.

<div id="REQ-W15-7"></div>

**REQ-W15-7:** Signature player verb: **unburden**. Add a row to the theme-authoring.md signature-verb table: `the-beginning | unburden | Reprises Worlds 13/14's four grief keywords (all cost-increasing), then introduces Acceptance — the only cost-decreasing keyword in the game`. Distinct from World 13's `compound` (accumulation) and World 14's `concede` (giving something up under pressure) — `unburden` is specifically about release, the inverse motion of both. It is not a reskin of any existing verb: no other world's signature mechanic makes anything cheaper.

## The Reprise and Acceptance Mechanic (pure data — no core-engine change)

<div id="REQ-W15-8"></div>

**REQ-W15-8:** Depends on Eden Prime's `ApplyKeyword`/`KeywordGate`/`RemoveKeyword` primitives, the `KEYWORD_COST_MODIFIERS` generalization, and World 13/14's four keywords (`Denial`, `Anger`, `Bargaining`, `Depression`) exactly as those specs registered them. Reuse, do not reimplement, and do not re-tune their `costPer` values here — this world reprises the same keywords, not new variants.

<div id="REQ-W15-9"></div>

**REQ-W15-9:** One new keyword name added to `KEYWORD_NAMES`: `Acceptance`. Registered in `KEYWORD_COST_MODIFIERS` as `Acceptance: { kind: "ClearCostPerSelfKeyword", costPer: -1 }` — the same modifier *kind* World 13's `Denial` and World 14's `Depression` use, with the sign flipped. This is confirmed as a **pure data change, zero core-engine work required**: `PersistentModifier.costPer` (`src/core/model/types.ts:29-35`) is a plain signed `number` with no non-negative constraint anywhere in the type, the loader, or any test; `extraWorldCardCost`/`effectiveWorldCardCost` (`src/core/engine/effectiveCards.ts`) apply no floor to the summed result; and every downstream consumer (`dealProgress.ts`'s hazard-clear check, `feedback.ts`'s progress-ring rendering, `CardView.ts`'s cost label, which already has a tested `textReward` color path for `cost < baseCost`) already tolerates a cost at or below zero without crashing.

`Acceptance` is **not** added to `PERSISTENT_KEYWORDS` — it decays like `Alarm`, and that decay is deliberate, not an oversight: acceptance has to be practiced, not banked once and kept forever. See REQ-W15-12 for how repeated engagement keeps it refreshed and what happens when the player stops.

<div id="REQ-W15-10"></div>

**REQ-W15-10:** `ClearCostPerSelfKeyword` is chosen deliberately over `ClearCostPerKeywordCount`/`ClearCostPerOtherKeyword` for `Acceptance`, specifically *because* the self-only shape structurally guarantees `Door` and `Walker` can never be discounted by it — they never carry the `Acceptance` keyword, so the modifier never applies to them, with no special-casing required (REQ-W15-2). An ambient shape (mirroring `Anger`'s `ClearCostPerKeywordCount`) was considered and rejected for this exact reason: it would touch every card in hand, including `Door`, contradicting the "Door stays genuinely untouched" decision.

<div id="REQ-W15-11"></div>

**REQ-W15-11:** One cosmetic-only follow-up, not a blocker: `src/core/view/actionPreview.ts`'s progress-preview string (`Math.min(event.hazardTurnTotal, cost)}/${cost}`) would render something like `"(-2/-2)"` if a card's effective cost goes negative. Clamp the *displayed* cost at 0 in that one string; do not clamp the underlying cost math itself (REQ-W15-9 depends on the real value going negative or to zero to make Destiny reachable).

<div id="REQ-W15-12"></div>

**REQ-W15-12:** `Destiny`'s Act III hazard card is authored with a high base `cost` (placeholder: `50` — see Open Questions) and no authored keywords of its own initially. Its `onPartialClear` effect is `{ "kind": "ApplyKeyword", "keyword": "Acceptance", "value": 45, "target": "self" }` (placeholder value, see Open Questions) — every time the player deals any progress to `Destiny` without fully clearing it, `Destiny`'s own `Acceptance` is (re-)applied at this fixed value.

**Correction from an earlier draft of this requirement, verified against code before finalizing:** `ApplyKeyword`'s `"self"` target routes through `withAppliedKeyword` (`src/core/model/keywords.ts:106-116`), whose merge rule is an explicit refresh-to-max, not a sum: "if an applied entry of the same name already exists, its lifetime is raised to the larger of the two values... never shorten." Firing this effect twice with the same literal `value` does **not** accumulate a growing stack — it re-asserts the same fixed value (or leaves it unchanged if a larger one is already present). The mechanism therefore isn't "engagement builds up a growing discount"; it's "one engagement unlocks the full discount immediately, and continued engagement each turn keeps refreshing it before it can decay away." A single application of `value: 45` against `costPer: -1` (REQ-W15-9) already drops the effective cost from 50 to 5 — the dramatic swing happens on first contact, not gradually.

This is deterministic and guaranteed to land on `Destiny` specifically, never on `Door` or `Walker`: `dealProgress` passes the hazard's own id as `selfId` when invoking `onPartialClear` (confirmed in `src/core/effects/dealProgress.ts`), and `ApplyKeyword`'s `"self"` target resolves to exactly that id. Broader targeting options (`"hand"`, `"firstWorldCardInHand"`, `"randomWorldCardInHand"`) were considered and rejected: `"hand"` would also stamp `Door` (violating REQ-W15-2/10), and the other two are non-deterministic and might miss `Destiny` entirely.

<div id="REQ-W15-13"></div>

**REQ-W15-13:** Because `Acceptance` decays by 1 each turn start when not refreshed (REQ-W15-9), and `withAppliedKeyword` refreshes rather than shortens, the practical behavior is: engage with `Destiny` at least once per turn and its discount stays at full strength (45) indefinitely; stop engaging (chase `Door` instead, or ignore `Destiny` entirely) and the discount erodes by 1 per turn until it's gone and `Destiny`'s cost climbs back toward its full authored value. This is a deliberate mechanical reading of "acceptance has to be practiced, not banked once" — the player doesn't get to touch `Destiny` once and walk away with the discount permanently; they have to keep showing up for it. Once accumulated progress against `Destiny` meets or exceeds its currently-discounted effective cost, it clears and its `onCleared` fires `SurviveWorld` directly — a legitimate, independent use of the same generic effect `Door` also uses (REQ-W15-3).

<div id="REQ-W15-13a"></div>

**REQ-W15-13a:** This is a deliberate redesign of the brainstorm's framing, not a silent implementation swap: `world-15-grief-mechanics.md` describes `RemoveKeyword` clearing the four reprised grief keywords broadly across hand as what produces `Acceptance`, with its discount spreading across "the remaining hand." The mechanism specified here instead ties `Acceptance` exclusively to direct, repeated engagement with `Destiny` itself, decoupled from whether the other four keywords have been cleared elsewhere. The change is made for two concrete reasons: it structurally protects `Door` from ever being discounted (REQ-W15-10), and it avoids relying on a stacking/accumulation behavior the engine's actual merge semantics don't support (see the correction embedded in REQ-W15-12). The narrative beat — repeated presence, not avoidance, is what earns the discount — survives the redesign even though the mechanical delivery changed.

<div id="REQ-W15-14"></div>

**REQ-W15-14:** This world must not introduce a sixth new keyword, a new `PersistentModifier` kind, or a new `ApplyKeyword` target — `Acceptance`'s self-only shape and `Destiny`'s own-hook self-targeting (REQ-W15-9/12) already accomplish everything this world's mechanic needs within the existing primitive set.

## Reward Card Recipe

<div id="REQ-W15-15"></div>

**REQ-W15-15:** Per D2, reward cards diverge from every other world's reward space. Candidates (not final): cards that strip `Denial`/`Anger`/`Bargaining`/`Depression` (via `RemoveKeyword`) from *other* hand cards, lowering their ambient/self taxes — this is a legitimate, separate mechanic from `Destiny`'s own `Acceptance` buildup (REQ-W15-12), which only ever grows through direct engagement with `Destiny` itself, never through outside application.

<div id="REQ-W15-16"></div>

**REQ-W15-16:** `Heal`, `GainEnergy`, `GainLight`, `Brace`, and `DealProgress` (against `Destiny` specifically) player-card effects are reflavored in this world's card copy as caretaking/supporting the companion figure (REQ-W15-6) rather than self-preservation or direct combat — `DealProgress` against `Destiny` reads as "helping him focus on this," not "the player striking it." No mechanical change to any of these effects — flavor text only.

## World Card Recipe

<div id="REQ-W15-17"></div>

**REQ-W15-17:** Act I (Denial + Anger, reprised) — signature-threat/tool-fetch cards apply `Denial`/`Anger` to themselves at runtime via `{ "kind": "ApplyKeyword", "target": "self" }` (mirroring World 13's `REQ-W13-8a`-equivalent pattern and World 14's `REQ-W14-8a` explicitly — **not** authored statically in their `keywords` field, since `RemoveKeyword`'s reward/tool-fetch stripping (REQ-W15-15/20) only strips from `appliedKeywords` and would silently no-op against an authored trait). Saturation is faster (smaller thresholds/more frequent application) than World 13 used, reflecting "less patience, same shapes." `GainKeywordGuard` charges are pre-loaded from the player's actually-earned Destiny Blessings/Feats at world start rather than generated in-act — a run that skipped unlocks hits every `KeywordGate` trigger unguarded. Every card in this world defines all five hooks (`onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`, `onDraw`), using `{ "kind": "None" }` where inert (C3) — applies across REQ-W15-17..20.

<div id="REQ-W15-18"></div>

**REQ-W15-18:** Act II (Bargaining + Depression, reprised) — same authored-vs-applied requirement as REQ-W15-17: signature-threat/tool-fetch cards apply `Bargaining`/`Depression` via `ApplyKeyword{target:"self"}` at runtime, not authored statically, so this world's `RemoveKeyword` cards function against them. Intensity is lower (smaller `AddThreatToWorldDeck` stakes, gentler `Modal` bargains) than World 14 used. `ResourceGate` checks stay calm here; nothing ambushes low HP the way Act I's aggression does.

`Destiny`'s own `Depression`/`Denial`-style weight is not reprised here — `Destiny` in this world carries only `Acceptance` (REQ-W15-12), applied via its own `onPartialClear`, not any of the four grief keywords. It is a fresh instance of the `Destiny` entity for this world's data, authored independently of Worlds 13/14's own `Destiny` cards (each world's card templates are separate per the standard per-world `cards.json` pattern).

<div id="REQ-W15-19"></div>

**REQ-W15-19:** Act III (Acceptance) — includes the `Destiny` hazard (REQ-W15-12/13) and the fixed `The Walker` closer (REQ-W15-2/3). `Destiny` sits in hand alongside `Door`, unremarked and untouched (REQ-W15-2).

<div id="REQ-W15-20"></div>

**REQ-W15-20:** Tool-fetch card(s) (`Obstructed`, per the shared Card Recipe role) grant the means to strip the four reprised grief keywords via `RemoveKeyword`, same pattern as Worlds 13/14's own tool-fetch cards.

## Deck Composition

<div id="REQ-W15-21"></div>

**REQ-W15-21:** Three acts. Act I fast and dense (reprising two worlds' worth of tax at once). Act II lighter, slower-paced. Act III centers on `Destiny`'s repeated-engagement loop rather than card volume. Exact counts deferred to the authoring pass.

<div id="REQ-W15-22"></div>

**REQ-W15-22:** Act 3 always ends with `{ "templateId": "The Walker", "count": 1 }` (restates REQ-W15-3 at the deck-composition level, per D1).

## Visual Theme

<div id="REQ-W15-23"></div>

**REQ-W15-23:** `VisualTheme` fields required per contract: `worldId`, `intrusionHue`, `realityPalette`, `frameStyle`, `backdrop`. Act I saturated and fast (reprising World 13's Act III palette). Act II muted grey-blue, no threat music (reprising World 14's Act III palette). Act III's color returns as warmth, not intensity — distinct from both reprised palettes.

<div id="REQ-W15-24"></div>

**REQ-W15-24:** `Destiny` and `Door` need a distinct visual tell in Act III so a player can tell them apart without being told outright which one is the earned path — not addressed further here, flagged as an authoring-pass and possibly `game/` view-layer concern.

## Display And Help

<div id="REQ-W15-25"></div>

**REQ-W15-25:** Display/help metadata follows the standard world bundle shape (`meta.ts`). Help text should not spell out the grief-stage metaphor or explicitly tell the player Destiny is the "real" ending, matching REQ-W13-24/REQ-W14-24's precedent.

## Documentation

<div id="REQ-W15-26"></div>

**REQ-W15-26:** Add `the-beginning` as a new row in the theme-authoring.md signature-verb table (REQ-W15-7). Document `Acceptance` as C2 prose (not a Signature Effects table row — see the correction made to both `REQ-W13-25` and `REQ-W14-25`), explicitly noting it as the first cost-*decreasing* `KEYWORD_COST_MODIFIERS` entry in the game.

<div id="REQ-W15-27"></div>

**REQ-W15-27:** The `endworlds-trilogy-concept.md` staleness fix is the same shared trilogy-level blocker tracked under `REQ-W13-26` — this is the third and final world depending on it.

## Player Support Notice

<div id="REQ-W15-27a"></div>

**REQ-W15-27a:** The one-time grief-support interstitial is a shared trilogy-level concern, fully specified once under `REQ-W13-30..33` in `questions.md` — not duplicated here. `the-beginning` is the third of the three `worldId`s that can trigger the interstitial's first showing; if either `questions` or `answers` was entered first, selecting this world must skip straight to `Table` per `REQ-W13-31`. This is the third and final world sharing that same scaffolding, matching REQ-W15-27's precedent for the trilogy-concept-doc blocker.

## Tests And Validation

<div id="REQ-W15-28"></div>

**REQ-W15-28:** `worldRegistry.test.ts`-style conformance: `selectTheme("the-beginning")` resolves the theme, `buildWorld` assembles without error, no duplicate template ids (in particular: no card in this world reuses `The Walker`'s template id for the companion figure — REQ-W15-6), every world card defines all five hooks.

<div id="REQ-W15-29"></div>

**REQ-W15-29:** New unit tests for `Acceptance`: confirm negative `costPer` correctly reduces `effectiveWorldCardCost` and can drive it to zero or below without error; confirm a single `ApplyKeyword{target:"self", value:45}` application already produces the full discount (not a gradual accumulation — REQ-W15-12's correction); confirm the applied value decays by 1 at each turn start when not refreshed and is restored to 45 (not stacked higher) by a subsequent application in the same or a later turn; confirm `Denial`/`Anger`/`Bargaining`/`Depression`'s existing World 13/14 cost-modifier tests still pass unmodified when the same registry entries are reprised in this world's data (no re-tuning, per REQ-W15-8); confirm `Door`'s effective cost is unaffected by any amount of `Acceptance` present elsewhere in hand (REQ-W15-10).

## AI Validation

<div id="REQ-W15-30"></div>

**REQ-W15-30:** Before marking this spec's implementation complete, the AI must:
1. Run `bun run test` and confirm all existing tests plus new World 15 tests pass.
2. Confirm `bun run lint && bun run typecheck && bun run build` succeed.
3. Verify via a unit test that dealing partial progress to `Destiny` once already drops its effective cost by the full discount (REQ-W15-12's corrected mechanism — this does not grow with repetition), that skipping a turn of engagement decays the applied value by 1 (raising effective cost back by `costPer`), and that re-engaging refreshes it back to the full value rather than stacking past it.
4. Verify that `Destiny`'s `onCleared` firing `SurviveWorld` and `Door`'s `onCleared` firing `SurviveWorld` are independent code paths that don't interfere with each other — clearing one does not consume, disable, or require the other.
5. Verify `Door`'s effective cost stays exactly equal to its authored base cost regardless of how much `Acceptance`, `Denial`, `Anger`, `Bargaining`, or `Depression` exists elsewhere in hand — this is the concrete, testable form of "Door remains genuinely untouched."
6. Confirm no engine change touched `The Walker`/`Door` wiring, the `ApplyKeyword` target enum, or the `PersistentModifier` type (REQ-W15-9/14) — a diff against those files should be empty.
7. Confirm the `actionPreview.ts` progress-preview string never displays a negative number (REQ-W15-11), via a targeted test with `Destiny`'s cost driven below zero.

## Open Questions

- Final worldId/title (`the-beginning`, renamed from the original "The Vigil") and signature verb (`unburden`) are recommendations, not yet confirmed.
- `Destiny`'s placeholder base cost (`50`), `Acceptance`'s applied `value` (`45`), and `costPer` (`-1`) are unauthored guesses that happen to net a clean `5` remaining after one engagement — real tuning (including whether a single-engagement swing this dramatic feels right versus something more gradual, which would need a different mechanism than the one specced here) needs a real numbers-and-feel pass, not just the shape of the idea.
- `GainKeywordGuard` pre-loading from earned Blessings/Feats (REQ-W15-17) needs a concrete mapping (which unlocks grant how many charges) before it's buildable.
- Whether `Destiny` needs its own distinct visual tell versus `Door`'s (REQ-W15-24) is unresolved.
- Whether the companion-figure reflavor (REQ-W15-6/16) is emotionally legible through flavor text alone, or needs a `game/` view-layer follow-up to actually render a distinct presence on screen — flagged, not decided.
