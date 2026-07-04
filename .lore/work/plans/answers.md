---
title: "Implementation plan: answers (World 14)"
date: 2026-07-04
status: draft
tags: [world, walker-narrative, grief-arc, bargaining, depression, destiny-entity, keyword-cost-modifiers, concede, plan]
modules: [core-effects, data-worlds]
related:
  - .lore/work/specs/answers.md
  - .lore/work/design/answers-card-design.md
  - .lore/work/plans/questions.md
  - .lore/work/specs/the-beginning.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/reference/worlds/catalog/endworlds-trilogy-concept.md
---

# Implementation plan: answers (World 14)

Source spec: `.lore/work/specs/answers.md` (REQ-W14-1..29). Concrete card templates, costs, and deck counts are authored in `.lore/work/design/answers-card-design.md` (produced during this plan-prep pass, mirroring `questions-card-design.md`'s role for World 13) — copy its JSON directly rather than re-deriving numbers during implementation.

**Ground truth confirmed before writing this plan (all verified directly against code, not assumed from spec prose):**
- World 13 (`questions`) is fully implemented and registered (`src/data/worlds/questions/`, `src/data/worlds/registry.ts`). `answers` is a clean slate — no `src/data/worlds/answers/` directory, no `Bargaining`/`Depression` anywhere in `src/`.
- `ClearCostPerOtherKeyword` exists as a full `PersistentModifier` kind with working switch-arms in `src/core/engine/effectiveCards.ts` (both `activeKeywordCostModifiers` and `extraWorldCardCost`) and a render arm in `src/game/view/CardView.ts:539`, but **zero** `KEYWORD_COST_MODIFIERS` entries use it today — Bargaining will be its first real activation, exactly as the spec claims.
- `RemoveKeyword` only ever strips `card.appliedKeywords`, never authored/static `keywords` — confirmed in `src/core/effects/appliedKeywords.ts`'s own code comment. Decay (`tickAppliedKeywordsAtTurnStart`) is likewise `appliedKeywords`-only.
- `.lore/reference/worlds/catalog/endworlds-trilogy-concept.md` is **already current** (rewritten during World 13's plan execution, Step 21) — REQ-W14-26's "shared blocker" is already resolved; no action needed here beyond a small addendum (Slice 5) for the Destiny-reuse decision below.
- World 15 (`the-beginning`, spec-only, not yet planned) hard-depends on this world's Act III palette (its own REQ-W15-23: World 15 Act II reprises World 14's Act III palette) and confirms signature verb `concede` doesn't collide with World 15's `unburden`.
- **A pre-existing bug, found during this plan-prep, that this plan fixes:** `WORLD_THREAT_BY_WORLD_ID` in `src/core/effects/gainCard.ts` (the map `AddThreatToWorldDeck` resolves through) has no entry for `"questions"` — meaning that effect already silently no-ops in the shipped World 13 card that uses it (`The Question That Has No Answer`'s `onEndOfTurn`). Since this world's spec (REQ-W14-16) also requires `AddThreatToWorldDeck` to work, Slice 1 fixes both worlds' entries in the same step, per user decision.

**Deviation from the ratified spec, confirmed with the user during plan-prep — read `answers-card-design.md`'s "Decision superseding REQ-W14-12/13" section in full before touching Slice 2's Act 3 work.** Summary: rather than authoring a second, differently-keyed `Destiny`-flavored card template (blocked by global template-id uniqueness — `"Destiny"` is already claimed by World 13's card), this world **reuses World 13's existing `Destiny` template unmodified** in its own Act 3 deck composition. Consequences: Destiny's authored keyword stays `Denial:2` (not `Depression:2` as REQ-W14-12 specified), its `onCleared` stays `ExileTopWorldCards{amount:3}` (not `{kind:"None"}` as REQ-W14-13 specified), and its cost formula for validation is `baseCost + 2×costPer(Denial) + costPer(Bargaining)×sum(other Bargaining in hand)` — not the spec's original `baseCost + 2×costPer(Depression) + 3×costPer(Bargaining)`. This also means `WORLD_THREAT_BY_WORLD_ID["answers"]` resolves to the same `"Destiny"` template, letting an Act 1 card seed an early, uncleared copy of it — mechanically realizing REQ-W14-5's "glimpsed in Act I, carried into Act III" beat.

<div style="border-left: 4px solid #888; padding-left: 12px; margin: 12px 0;">
<strong>Legend:</strong> steps in the same slice can mostly proceed in file order; a step marked <strong>(depends on N)</strong> must wait for step N's edit to land first. Slices execute in order 1→5 — Slice 2's card authoring uses the <code>Bargaining</code>/<code>Depression</code> keyword strings and the <code>WORLD_THREAT_BY_WORLD_ID</code> fix Slice 1 adds, so Slice 1 must fully land before Slice 2 begins.
</div>

## Slice 1 — Core-engine keyword slice (REQ-W14-7..11, REQ-W14-28, REQ-W14-29.3/4)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 1.</strong> Add <code>"Bargaining"</code> and <code>"Depression"</code> to the <code>KeywordName</code> union in <code>src/core/model/types.ts</code> (currently 10 members ending <code>"Anger"</code>).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 2 (depends on 1).</strong> In <code>src/core/model/keywords.ts</code>:
<ul>
<li>Add <code>"Bargaining"</code>, <code>"Depression"</code> to <code>KEYWORD_NAMES</code>.</li>
<li>Do <strong>not</strong> add either to <code>PERSISTENT_KEYWORDS</code> (currently <code>{"Lockdown", "Reroute"}</code>) — both must decay at turn start like <code>Alarm</code>/<code>Denial</code>/<code>Anger</code>, per REQ-W14-8.</li>
<li>Add two <code>KEYWORD_COST_MODIFIERS</code> entries:
<pre>Bargaining: { kind: "ClearCostPerOtherKeyword", costPer: 1 }
Depression: { kind: "ClearCostPerSelfKeyword", costPer: 1 }</pre>
This is <code>ClearCostPerOtherKeyword</code>'s first real registration anywhere in the codebase (REQ-W14-9) — do not skip re-reading its switch-arm in <code>effectiveCards.ts</code> before writing tests; confirm firsthand that it sums <em>value</em> across other cards, excludes the priced card itself, and floors at 0 (`Math.max(0, matchingValue)`).</li>
</ul>
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 3.</strong> Fix the pre-existing bug: in <code>src/core/effects/gainCard.ts</code>'s <code>WORLD_THREAT_BY_WORLD_ID</code> map, add:
<pre>"questions": "Destiny",
"answers": "Destiny",</pre>
Both worlds' <code>Destiny</code> card is the same template (see the superseding-decision note above), so both entries point at the identical string. This is an unrelated-but-adjacent fix to a real bug found during this plan's research (World 13's own <code>AddThreatToWorldDeck</code> usage currently no-ops silently) — call it out in the PR description as a distinct fix, not folded silently into "add answers."
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 4 (depends on 2, 3).</strong> No change needed in <code>src/core/engine/effectiveCards.ts</code> — <code>extraWorldCardCost</code>/<code>effectiveWorldCardCost</code> already iterate <code>KEYWORD_COST_MODIFIERS</code> generically, including the <code>ClearCostPerOtherKeyword</code> arm. Confirm this by reading the function before writing tests, don't assume from the spec text alone.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 5 (depends on 2, 4).</strong> New unit tests in <code>src/core/tests/effectiveCards.test.ts</code>, in a new <code>describe("effectiveWorldCardCost — Bargaining/Depression (World 14 Slice 1)", ...)</code> block mirroring the existing Denial/Anger block:
<ul>
<li><code>ClearCostPerSelfKeyword</code> computes correctly for <code>Depression</code> (self-authored value, e.g. <code>Depression:2</code> → +2 extra cost) — same shape as the existing <code>Denial</code> test.</li>
<li><code>ClearCostPerOtherKeyword</code> computes correctly for <code>Bargaining</code> — this is the REQ-W14-29.3 trap: assert it sums the <em>summed value</em> across other cards, not card count. Construct one other card carrying <code>Bargaining:3</code> and a separate hand with three other cards each carrying <code>Bargaining:1</code>; both must produce identical extra cost (3 × costPer), proving value-summing rather than count-based tax like <code>ClearCostPerKeywordCount</code>.</li>
<li>REQ-W14-10 / REQ-W14-29.4: the card <em>carrying</em> <code>Bargaining</code> pays zero tax from its own value — construct a hand where only one card carries <code>Bargaining</code> and confirm that card's own effective cost is unaffected, while a second, unrelated card's cost rises by the full amount.</li>
<li>Both modifiers stacking on the same card: a card authored with <code>Depression:2</code> plus a separate <code>Bargaining</code>-carrying card elsewhere in hand → cost equals <code>baseCost + 2×costPer(Depression) + costPer(Bargaining)×(summed Bargaining on other cards)</code> (REQ-W14-29.5, generic-card version — the <code>Destiny</code>-specific version of this check happens in Slice 2's validation once the real template exists, using the <em>corrected</em> formula from the superseding-decision note, not REQ-W14-9's original text).</li>
<li>Assert neither <code>Bargaining</code> nor <code>Depression</code> is in <code>PERSISTENT_KEYWORDS</code>, and (mirroring <code>keywords.test.ts</code>'s existing decay tests) that an applied instance of each decays to zero and is removed after enough turns with no reapplication.</li>
</ul>
</div>

## Slice 2 — World content authoring (REQ-W14-4..6, 12..20)

All templates, exact JSON, and deck counts are in `.lore/work/design/answers-card-design.md` — copy directly. That document also resolves the authored-vs-applied split (REQ-W14-8a: every Bargaining/Depression-bearing card except `Destiny` and its self-transform escalation partner `It Calcified` gains its keyword via `ApplyKeyword{target:"self"}` on `onDraw`, staying strippable) and the Destiny-reuse deviation (see this plan's header note).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 6 — Act 1 (depends on Slice 1; REQ-W14-4, 15, 16).</strong> Author Act 1 card templates into <code>src/data/allCards.json</code>'s <code>cardTemplates</code> map: <code>The Ledger Never Closes</code> (signature Bargaining threat), <code>A Broker Who Owes Nothing</code> (Obstructed tool-fetch, grants <code>Call In The Favor</code>), <code>What Would You Give Up</code> (the required <code>Modal</code> genuine branch: destroy a hand card or take 2 damage), <code>The Archive Has a Price</code> (Obstructed hazard, <code>onCleared: AddPlayerCardToTop</code> queuing the lore card <code>A Page From the Ledger</code>), <code>A Deal Too Easy</code> (<code>onCleared: AddThreatToWorldDeck</code>, now resolving to <code>Destiny</code> per Slice 1's fix — this seeds an early copy at the front of Act 1's own draw pile, which is the intended mechanism for REQ-W14-5's "glimpsed in Act I, carried into Act III" beat, but <code>Destiny</code> is still <code>discardable: true</code> so nothing forces the player to leave it unresolved; whether it actually reads as "carried onward" rather than "cleared and forgotten in Act 1" is unconfirmed until Step 22.10's manual playtest, not a settled mechanical guarantee), and <code>A Reading of the Ledger</code> (<code>OfferBoon</code> reflavor per REQ-W14-15, drawing from the new <code>pool-ledger-reading</code>). Exact JSON in the design doc's Act 1 section.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 7 — Act 2 (REQ-W14-17).</strong> Author Act 2 card templates: <code>A Fracture Opens</code> → <code>Another Fracture</code> (Self-Transform Pattern — <code>AddWorldCardToDeck{bTop:true}</code> then <code>DestroySelf</code>, explicitly not <code>ReturnWorldCards</code>) and <code>The Point of No Return</code> (<code>ExileTopWorldCards{amount:2}</code>, foreshadowing Act 3's larger commitment). Neither card carries <code>Bargaining</code>/<code>Depression</code> — Act 2 is deliberately keyword-free per the spec, carrying the beat through accumulating hazard visibility, not tax. Exact JSON in the design doc's Act 2 section.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 8 — Act 3 (depends on Slice 1; REQ-W14-6, 12, 13, 18).</strong> Author Act 3 card templates: <code>The Weight Doesn't Lift</code> (signature Depression threat — self-tax only, no spreading escalation, per REQ-W14-6's "plainest, least showy shape" framing), <code>It Won't Go Away</code> → <code>It Calcified</code> (Depression's Self-Transform pair, mirroring <code>She Says She's Fine</code> → <code>He Isn't Coming Back</code> exactly — the escalated card authors <code>Depression:2</code> statically, is <code>discardable:false</code>, deliberately uncounterable), <code>A Reason to Keep Moving</code> (Obstructed tool-fetch, grants <code>Let It Sit</code>), and <code>Just Keep Walking</code> (grants the <code>Brace</code>-as-endurance reward <code>Keep Walking</code>). Do <strong>not</strong> author a new <code>Destiny</code> template here — it already exists from World 13; reference it by name only in deck composition (Step 9). The fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer is likewise referenced only in deck composition, never redefined (REQ-W14-2/3).
</div>

Do not redefine `The Walker`, `Summon Door`, `Door`, or `Destiny` anywhere in this world's data — all four already exist from starter source or World 13; duplicate template ids throw in `buildWorld`.

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 9 (depends on 6, 7, 8).</strong> Reward player cards (REQ-W14-14): <code>Call In The Favor</code> (strips <code>Bargaining</code>), <code>Let It Sit</code> (strips <code>Depression</code>), <code>A Page From the Ledger</code> (minor lore-delivery card, queued not granted), <code>Keep Walking</code> (<code>Brace</code> endurance reframe), <code>Let It Go</code> (<code>DiscardThenDraw</code> cycling reward), and the two <code>pool-ledger-reading</code> boons <code>Ask For More Time</code> / <code>Take What's Owed</code>. Also add the new pool entry to <code>src/data/boonPools.json</code>: <code>"pool-ledger-reading": ["Ask For More Time", "Take What's Owed"]</code>. Exact JSON in the design doc's Reward Player Cards and New Boon Pool sections.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 10 (depends on 6, 7, 8, 9).</strong> Deck composition (REQ-W14-20/21): Act 1 — 8 cards (heaviest, two <code>Modal</code> copies plus the boon-choice card); Act 2 — 6 cards (moderate); Act 3 — 9 cards including the reused <code>Destiny</code> and the fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer. Exact per-template counts in the design doc's Deck Composition section.
</div>

## Slice 3 — World bundle wiring (REQ-W14-1, 22..24)

No `src/data/worlds/answers/` directory exists yet — from-scratch bundle, structurally mirroring the shipped `src/data/worlds/questions/` bundle (`cards.json`, `index.ts`, `meta.ts`, `theme.ts`).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 11 (depends on 10).</strong> Create <code>src/data/worlds/answers/cards.json</code> (deck composition only, referencing Slice 2 template ids — copy directly from the design doc).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 12.</strong> Create <code>src/data/worlds/answers/theme.ts</code> exporting a <code>VisualTheme</code> (mirrors <code>QUESTIONS_THEME</code>'s shape): <code>worldId: "answers"</code>, <code>intrusionHue</code> trending cool/muted, desaturating further toward Act 3's grey-blue (REQ-W14-22/23 — the opposite direction from World 13's warming-toward-hot arc, and the specific palette World 15's own Act II is specced to reprise). <code>backdrop</code> keys <code>"answers-bg"</code>/<code>"answers-overlay"</code>.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 13.</strong> Create <code>src/data/worlds/answers/meta.ts</code> exporting <code>WorldDisplayData</code>/<code>WorldHelpData</code> (mirrors <code>QUESTIONS_DISPLAY</code>/<code>QUESTIONS_HELP</code>). Help text must not spell out the grief-stage metaphor (REQ-W14-24) — describe mechanics (Bargaining taxing every other card, Depression taxing itself, Destiny's cost as a running total) without naming "bargaining"/"depression" as emotional stages. Also note plainly, mirroring how <code>questions</code>'s own help/flavor disambiguates the Destiny/DestinyScene naming pun, that this world's <code>Destiny</code> card is the same card carried over from <code>questions</code>, not a new one — this is now load-bearing documentation given the superseding decision, not optional flavor.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 14 (depends on 11, 12, 13).</strong> Create <code>src/data/worlds/answers/index.ts</code> assembling the <code>WorldDataBundle</code> (mirrors <code>QUESTIONS_BUNDLE</code>), then register it in <code>src/data/worlds/registry.ts</code>'s <code>worldDataRegistry</code> array (14th entry).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 15.</strong> Wire <code>src/game/worlds/assetBindings.ts</code>: no reality/overlay/cardfront/inset art exists yet for this world. **Correction from an earlier draft of this plan, caught during fresh-eyes review:** only <code>bird-building</code> and <code>highway-volcano</code> actually shipped without card inset art — verified directly against <code>assetBindings.ts</code> and <code>src/data/worlds/questions/theme.ts</code>, <code>questions</code> itself has a full <code>worldCardfrontKey: "questions-cardfront"</code> plus a named inset binding for essentially every card, including the shared <code>Destiny</code> template (<code>questions-inset-destiny</code>). Shipping <code>answers</code> without art would make it the **first end-world in this trilogy** to ship art-less, not a continuation of existing practice for this specific comparison point — flag this distinction explicitly to the user rather than citing <code>questions</code> as settled precedent. If art generation isn't feasible before this world ships, that may still be the right call, but it should be made on accurate information.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
Add a music entry only if a track exists; otherwise flag as a follow-up rather than fabricating a placeholder.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 16 (depends on 14, 15).</strong> Confirm <code>src/core/tests/worldRegistry.test.ts</code>'s existing conformance suite (extended during World 13's plan to check duplicate template ids and all-five-hooks) picks up <code>answers</code> automatically since it iterates the registry generically — no new assertions needed there, just confirm it passes. Add a new <code>src/core/tests/answers.test.ts</code>, mirroring <code>newDerelict.test.ts</code>'s shape: registry/build sanity (<code>selectTheme("answers")</code> resolves, <code>buildWorld</code> assembles, no duplicate ids), a hook/keyword validation loop over all of this world's <code>WORLD_CARDS</code> against the current <code>VALID_KEYWORDS</code> set, and isolated effect tests for the Self-Transform pairs and the reused <code>Destiny</code> card's cost formula (see Slice 5's validation gate for the exact expected value). This satisfies REQ-W14-27.
</div>

## Slice 4 — Grief-support interstitial (trilogy-level: no new work)

<div style="background:#eef7ee;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 17 — verification only.</strong> This scaffolding is already fully built and already includes <code>answers</code>: confirmed directly in <code>src/game/scenes/griefSupportGate.ts</code>, whose exported <code>GRIEF_SUPPORT_WORLD_IDS</code> constant is <code>["questions", "answers", "the-beginning"]</code>, and in <code>WorldSelectScene.ts</code>'s constructor, which already threads a <code>GriefSupportStore</code>. No code changes needed for REQ-W14-27a. Add this to the manual validation pass only: on a fresh profile, select <code>answers</code> first (before ever touching <code>questions</code>) and confirm the interstitial shows; dismiss it; confirm selecting <code>questions</code> afterward skips straight to <code>Table</code> (proving the flag is genuinely trilogy-wide, not per-world, in both directions).
</div>

## Slice 5 — Unlock gating, documentation, and final validation (REQ-W14-25, 26, 29)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 18.</strong> Add a <code>worldUnlock</code> Destiny Blessing entry to <code>src/data/unlocks/catalog.json</code>, mirroring the existing <code>world-questions</code> entry exactly in shape:
<pre>{
  "id": "world-answers",
  "name": "Answers",
  "description": "Opens Answers in World Select.",
  "cost": 25,
  "destinyWeight": 0,
  "effect": { "type": "worldUnlock", "worldId": "answers" }
}</pre>
Cost <code>25</code> is the next escalation step above <code>questions</code>'s <code>20</code> (existing costs step 5→10→15→20 in three-world tiers) — a placeholder for balance tuning, not a resolved final value, same caveat as every other authored number in this plan. Without this entry, <code>isWorldUnlocked</code> would default <code>answers</code> to unlocked from game start, which is very likely wrong for a narrative-closer world reached only after progressing through the trilogy's earlier entries.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 19 (depends on 18).</strong> Extend <code>src/game/tests/unlockAssetBindings.test.ts</code>'s or the relevant unlock-catalog test's coverage to confirm the new <code>world-answers</code> entry resolves and gates <code>answers</code> correctly (mirroring however <code>world-questions</code> is currently covered, if at all — if no existing test asserts world-gating behavior per catalog entry, flag this as a pre-existing test gap rather than silently skipping coverage for the new entry).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 20.</strong> <code>.lore/reference/worlds/authoring/theme-authoring.md</code>: add the signature-verb table row <code>answers | concede | Bargaining/Depression keywords tax cost from two different directions — spending elsewhere (Bargaining) and settling into one thing (Depression) — every act gives something up</code> (REQ-W14-6), immediately following the <code>questions</code> row. Document <code>Bargaining</code>/<code>Depression</code> as C2 prose (extending the existing <code>Denial</code>/<code>Anger</code> paragraph), not a new Signature Effects table row (REQ-W14-25) — call out <code>Bargaining</code> explicitly as <code>ClearCostPerOtherKeyword</code>'s first real user. Also add a short note alongside the existing "naming collision, intentional (<code>questions</code>)" callout recording that <code>answers</code> reuses the same <code>Destiny</code> template rather than authoring its own — this is now the second place (with Step 13's help text) that needs to carry the superseding-decision note forward so it doesn't silently drift out of documentation.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 21.</strong> No update needed to <code>.lore/reference/worlds/catalog/endworlds-trilogy-concept.md</code>'s core structure — confirmed already current (rewritten during World 13's execution). Add only a small addendum noting the Destiny-reuse decision (one shared entity across all three end-worlds, not three reskins), so this reference doc doesn't drift out of sync with what Slice 2/3 actually ship.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;background:#eef7ee;">
<strong>Step 22 — Final validation gate (depends on all prior steps).</strong> Per REQ-W14-29 (with the Destiny formula corrected per the superseding-decision note):
<ol>
<li><code>bun run test</code> — all existing tests plus new Slice 1/3 tests pass.</li>
<li><code>bun run lint && bun run typecheck && bun run build</code> succeed.</li>
<li>Confirm via the Slice 1 unit test that one other card carrying <code>Bargaining:3</code> produces the same tax as three other cards each carrying <code>Bargaining:1</code> (both sum to 3) — the count-vs-value trap.</li>
<li>Confirm via the Slice 1 unit test that a card carrying <code>Bargaining</code> itself receives zero tax contribution from its own value, while every other card's cost rises (REQ-W14-10).</li>
<li>Verify <code>Destiny</code>'s effective cost in the <code>answers</code> world, with its authored <code>Denial:2</code> and a separate <code>Bargaining:3</code>-carrying card elsewhere in hand, equals <code>baseCost + 2×costPer(Denial) + 3×costPer(Bargaining)</code> — <strong>not</strong> the spec's original Depression-based formula (see the superseding-decision note; this is the corrected version of REQ-W14-29.5).</li>
<li>Confirm no engine change touched <code>The Walker</code>/<code>Door</code>/<code>SurviveWorld</code> wiring (REQ-W14-2/3) — byte-identical before and after.</li>
<li>Verify a signature-threat card's applied <code>Bargaining</code>/<code>Depression</code> (via <code>ApplyKeyword{target:"self"}</code>) decays to zero after enough turns with no reapplication, and that the matching <code>RemoveKeyword</code> reward strips it before then.</li>
<li>Verify a <code>RemoveKeyword</code> reward targeting <code>Destiny</code> is a no-op against its authored <code>Denial:2</code> (not <code>Depression</code> — corrected per the superseding decision), confirming the authored/applied asymmetry still holds for the reused card in this world too.</li>
<li>Manually verify the grief-support interstitial per Slice 4's Step 17 check (fresh profile, select <code>answers</code> first, confirm trilogy-wide flag behavior in both directions).</li>
<li>Manually play through <code>answers</code> once via <code>bun run dev</code> to confirm the Act 1 <code>A Deal Too Easy</code> → early-<code>Destiny</code> beat is visible and legible, and that the world isn't unlocked from a fresh profile without the Step 18 Blessing purchased.</li>
</ol>
</div>

## Open items carried forward (flag to the user, not silently resolved)

- Final `worldId`/title (`answers`) and the signature verb `concede` are still spec-level placeholders per the spec's own Open Questions — this plan proceeds with them as working names, not confirmed final.
- Whether `Bargaining`'s "the carrier pays nothing, everyone else pays" asymmetry reads clearly without an explicit UI callout is unresolved (spec's own open item) — flag during Slice 5's manual playtest.
- `cardfront`/inset art for this world does not exist yet (Step 15) — flagged as a gap, not silently deferred, same as `questions` shipped.
- The unlock cost of `25` (Step 18) is an unvalidated placeholder pending a `bun run sim` balance pass, same caveat the design doc raises for every other authored number.
- The Destiny-reuse decision (see header note) is the single biggest deviation from the ratified spec in this entire plan. It has real narrative-texture consequences (Destiny's clear in `answers` still reads as `questions`' dramatic "cut off future moments" rather than the spec's intended "quietly picked it up and kept walking"). Flag this to the user explicitly when the plan is reviewed — it is not a minor authoring-pass judgment call, and it should be revisited before World 15's own Destiny handling is planned, since the same template-id collision will recur there.
