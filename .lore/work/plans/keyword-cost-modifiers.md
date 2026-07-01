---
title: "Implementation plan: keyword-level cost modifiers"
date: 2026-07-01
status: draft
tags: [refactor, keywords, new-derelict, cardview, bugfix]
modules: [core-model, core-engine, game-view, new-derelict]
related:
  - .lore/work/specs/new-derelict.md
  - .lore/reference/theme-authoring.md
  - .lore/work/specs/effective-card-modifiers.md
---

# Implementation plan: keyword-level cost modifiers

## Why

`WorldCard.persistent?: PersistentModifier` (`src/core/model/types.ts:26-30,206`) currently authors the "sealed hazards cost more to clear per other sealed hazard" rule as a **per-template opt-in field**. Only 4 of New Derelict's 7 world-card templates declare it (`Bulkhead 7-C Seals`, `Gravity Priority Shift`, `Corridor Becomes Lifeboat`, `The Order Arrives` — `src/data/allCards.json:2260,2293,2320,2359`), all with the identical value `{ kind: "ClearCostPerKeyword", keyword: "Lockdown", costPerOther: 1 }`.

The other 3 templates (`Unfinished Captain's Address`, `Systems Panel`, `Administrative Misfile`) are still legal `ApplyKeyword` targets at runtime — `target: "firstWorldCardInHand"` and `"randomWorldCardInHand"` (`src/core/effects/appliedKeywords.ts:147-165`) filter over *every* world card in hand, with no check for whether the template declared `persistent`. So one of these three can be Lockdown-tagged, and its presence taxes every *other* Locked card in hand (`effectiveWorldCardCost`'s hand-count filter checks `hasKeyword`, not `persistent`), while its own clear cost never scales — because it has no `persistent` field to read. One-directional tax; confirmed live bug, not a hypothetical.

`.lore/work/specs/new-derelict.md` (REQ-DERELICT-11) already flagged the field shape as tentative pending a design doc that was never split out, and REQ-DERELICT-30 made the field explicitly permissive ("may define"). REQ-DERELICT-45's test matrix only asserts the cluster-tax behavior for cards that *do* declare `persistent` — it never asserts the inverse, which is exactly where the bug lives.

## Decision

Move `ClearCostPerKeyword` off the per-template `WorldCard.persistent` field onto a global keyword-keyed registry, parallel to the `PERSISTENT_KEYWORDS: ReadonlySet<KeywordName>` already in `src/core/model/keywords.ts` (which declares "Lockdown doesn't decay" once, globally, rather than per-template). `effectiveWorldCardCost` looks up the modifier by the card's actual keyword name instead of reading `card.persistent`. This:

- Fixes the bug at the root: any card that ever carries `Lockdown` is taxed identically, because the rule lives on the keyword, not on whichever templates happened to declare it. A future hazard template that becomes a Lockdown target gets correct behavior automatically — no authoring step to forget.
- Generalizes for free: "what if we add more modifiers" stops being "does one card need an array of modifiers" and becomes "does the registry have another entry." If a card someday carries two keywords that both carry cost rules, `effectiveWorldCardCost` sums over the card's keyword names — no schema change to `WorldCard`.
- Removes a field and a conditional-spread (`cards.ts:106`) instead of adding one.

**Out of scope:** `.lore/work/specs/effective-card-modifiers.md` (REQ-CARDMOD-4) separately punted "keyword-targeted card modifiers" for *player* cards as future work. This plan only touches world-card cost. Converging the two systems (`effectivePlayerCard`'s modifier patches vs. this keyword registry) is a follow-up worth naming in a retro, not folding in here — different trigger model (unlock-driven conditions vs. keyword presence), different risk if rushed together.

Also in scope: a static CardView face treatment for the modifier, so a template's cost-escalation rule is visible before it ever fires (currently only the runtime consequence — a red-tinted cost digit — is visible, and only after the fact).

## Steps

<div style="border-left: 3px solid #6b7280; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 1 — Registry: replace <code>WorldCard.persistent</code> with a keyword-keyed table</strong><br/>
<em>Files: <code>src/core/model/types.ts</code>, <code>src/core/model/keywords.ts</code>, <code>src/core/model/cards.ts</code>, <code>src/core/contract.ts</code></em>
<ul>
<li><code>types.ts:26-30</code> — narrow <code>PersistentModifier</code> to drop the <code>keyword</code> field (it becomes the registry key): <code>{ kind: "ClearCostPerKeyword"; costPerOther: number }</code>.</li>
<li><code>types.ts:206</code> — delete <code>WorldCard.persistent</code>.</li>
<li><code>keywords.ts:24</code> — add, next to <code>PERSISTENT_KEYWORDS</code>: <code>export const KEYWORD_COST_MODIFIERS: Partial&lt;Record&lt;KeywordName, PersistentModifier&gt;&gt; = { Lockdown: { kind: "ClearCostPerKeyword", costPerOther: 1 } };</code> (import <code>PersistentModifier</code> from <code>./types</code>).</li>
<li><code>cards.ts:43</code> — delete <code>WorldCardTemplate.persistent</code>; <code>cards.ts:106</code> — delete the conditional-spread mint line entirely.</li>
<li><code>contract.ts:21,32</code> — keep the <code>PersistentModifier</code> type export; add <code>KEYWORD_COST_MODIFIERS</code> to the same export block as <code>PERSISTENT_KEYWORDS</code> (line 32) since <code>CardView</code>, a <code>game/</code> consumer, needs it in Step 4.</li>
</ul>
</div>

<div style="border-left: 3px solid #6b7280; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 2 — Engine: rewrite <code>effectiveWorldCardCost</code> to read the registry</strong><br/>
<em>Depends on Step 1. File: <code>src/core/engine/effectiveCards.ts:10-18</code></em>
<ul>
<li>Replace the single-modifier read with: for each name in <strong><code>new Set(keywordNames(card))</code></strong> (dedupe before iterating — <code>keywordNames</code> concatenates authored + applied without deduping, so a keyword that ever ends up in both would otherwise double its tax; nothing in the type system prevents that today even though no current template does it), look up <code>KEYWORD_COST_MODIFIERS[name]</code>; if present, count other hand cards sharing that same keyword name (<code>state.hand.filter((c) =&gt; hasKeyword(c, name))</code>) and add <code>Math.max(0, count - 1) * modifier.costPerOther</code>. Sum across every keyword name the card carries that has a registered modifier (today only Lockdown resolves; the loop is what buys future-keyword generality for free).</li>
<li>No change to the function signature or its three call sites (<code>dealProgress.ts:99</code>, <code>actionPreview.ts:480</code>, <code>TableScene.ts:746</code>) — they all call <code>effectiveWorldCardCost(card, state)</code> and stay untouched.</li>
</ul>
</div>

<div style="border-left: 3px solid #6b7280; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 3 — Data: drop the now-redundant per-template field, verify the fixed templates</strong><br/>
<em>Depends on Steps 1-2. File: <code>src/data/allCards.json:2260,2293,2320,2359</code></em>
<ul>
<li>Delete the <code>"persistent": {...}</code> block from all 4 templates. The registry entry for <code>Lockdown</code> now covers all 7 New Derelict world-card templates uniformly (the 3 previously-missing ones included) — this is the actual bug fix, and it happens by deletion, not addition.</li>
</ul>
</div>

<div style="border-left: 3px solid #f59e0b; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 4 — CardView: static face treatment for a carried keyword's cost consequence</strong><br/>
<em>Depends only on Step 1 (needs <code>KEYWORD_COST_MODIFIERS</code> exported) — nothing in Steps 2/3/5/6 depends on Step 4, so it is genuinely separable. File: <code>src/game/view/CardView.ts</code>. Flag for review — new visual/UX surface, not just a data-plumbing change.</em>
<p><strong>Checkpoint before starting this step:</strong> confirm with whoever accepts the PR whether this ships bundled with the bugfix+refactor (Steps 1,2,3,5,6,7) or as a separate follow-on PR. Don't fold it in silently.</p>
<ul>
<li>Import <code>KEYWORD_COST_MODIFIERS</code> from core. In the world-card branch (constructor, ~line 393-545), after the <code>triggerBlocks</code> loop (after line 517, before the discard indicator at 520), build one static line per keyword name in <code>keywordNames(card)</code> that has a registry entry — e.g. for <code>ClearCostPerKeyword</code>: <code>"${name}: +${costPerOther} cost per other ${name} card in hand"</code>. Render with the same <code>addEffectLines</code>-style container-and-reveal pattern as the trigger blocks (push to <code>reveal</code> so concealment still hides it; advance <code>currY</code>).</li>
<li>This reads <code>card.keywords</code>/<code>card.appliedKeywords</code>, both already constructor arguments — no new prop threading into <code>CardView</code>. Because the whole container already rebuilds on <code>cardDisplaySignature</code> change (<code>TableScene.ts:150-171</code>, which includes <code>appliedKeywords</code>), this block updates correctly the instant a card is sealed or released, with no extra reactive wiring needed.</li>
<li>Decide (implementer's call, flag if unsure): does this line only show for keywords the card *currently* carries (only visible once sealed — mirrors the existing <code>formatAppliedKeywords</code> badge, so New Derelict cards would show it identically to today until sealed), or should every template that's a legal <code>ApplyKeyword</code> target for a registry keyword hint at the consequence before it's ever applied? The bug fix in Steps 1-3 doesn't depend on this choice; recommend the simpler "show once carried" version first since it requires no new "which keywords could this card ever receive" analysis, and revisit if playtesting shows it's not legible enough.</li>
</ul>
</div>

<div style="border-left: 3px solid #6b7280; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 5 — Tests: rewrite fixtures that construct <code>persistent</code> directly, and add the regression test for the fixed bug</strong><br/>
<em>Depends on Steps 1-3. Files: <code>src/core/tests/effectiveCards.test.ts</code>, <code>src/core/tests/actionPreview.test.ts</code>, <code>src/core/tests/newDerelict.test.ts</code></em>
<ul>
<li><code>effectiveCards.test.ts:314-353</code> — the <code>locked()</code> helper (315-329) currently spreads a per-card <code>persistent</code> conditionally; rewrite to rely on the <code>Lockdown</code> registry entry unconditionally (drop the <code>persistent</code> parameter). The second test (338-352, <code>"returns base cost when the card lacks the condition or modifier"</code>) currently asserts <code>locked("2", false)</code> — a Lockdown-carrying card with no <code>persistent</code> field — stays at base cost. <strong>That assertion encodes the bug being fixed and must be replaced</strong>: repoint it at a keyword with no registry entry (e.g. author a card with a static/authored <code>Obstructed</code> keyword instead of Lockdown — authored, not applied, matching how <code>Obstructed</code> is used everywhere else in the codebase) to keep testing "no registered modifier ⇒ no tax," now via a keyword that genuinely has none.</li>
<li><code>actionPreview.test.ts:34</code> — same fixture-shape update (drop the per-card <code>persistent</code> field, rely on the registry).</li>
<li><code>newDerelict.test.ts</code> — the <code>locked()</code> helper (line 48-50) stamps <code>appliedKeywords</code> only, so it's unaffected. Add a new test case cloning the existing clustered-cost test (lines 110-149) but using <code>Unfinished Captain's Address</code>, <code>Systems Panel</code>, or <code>Administrative Misfile</code> as one of the two clustered cards — this is the direct regression test proving the previously-untaxed templates now compound correctly. Assert <code>effectiveWorldCardCost</code> on that card returns <code>cost + 1</code> when clustered with one other Locked card, matching the existing assertion style at line 276.</li>
</ul>
</div>

<div style="border-left: 3px solid #6b7280; padding-left: 12px; margin-bottom: 16px;">
<strong>Step 6 — Docs: reconcile <code>.lore/reference/theme-authoring.md</code> with the new model</strong><br/>
<em>Depends on Steps 1-4 being settled (docs should describe what shipped, not what was proposed). File: <code>.lore/reference/theme-authoring.md</code></em>
<ul>
<li>Line 126 currently states: "Persistent modifiers are card-field behavior, not <code>CardEffect</code> entries... belong on the world-card template/runtime shape." Rewrite to describe the keyword-registry model: persistent modifiers are declared once per keyword, centrally, and apply uniformly to any card that carries that keyword (authored or applied) — not authored per-template.</li>
<li>Line 161 (C3) currently says "A world card may also declare a world-agnostic <code>persistent</code> modifier... worlds that omit the field are unchanged." Replace with: a keyword may carry a registered cost modifier in <code>KEYWORD_COST_MODIFIERS</code>; any card carrying that keyword is taxed by it automatically, with no per-template authoring step. Note that <code>WorldCard</code> no longer has a <code>persistent</code> field.</li>
<li>Line 94's world-verb summary and C2/C2a (lines 157-159, keyword semantics) describe player-facing behavior, not the field shape — leave as-is; they remain accurate.</li>
</ul>
</div>

<div style="border-left: 3px solid #16a34a; padding-left: 12px;">
<strong>Step 7 — Validation</strong>
<ul>
<li>Targeted: <code>bun run test src/core/tests/effectiveCards.test.ts src/core/tests/actionPreview.test.ts src/core/tests/newDerelict.test.ts</code> (per <code>CLAUDE.md</code>, always <code>bun run test</code>, never <code>bun test</code>).</li>
<li>Full: <code>bun run test</code>, then <code>bun run lint && bun run typecheck && bun run build</code> before calling this PR-ready — this touches core public exports (<code>contract.ts</code>) and a data file consumed by conformance tests.</li>
<li>Manual: run the app, seal a Systems Panel or Administrative Misfile in New Derelict (or drive it via the world's Emergency Route/firstWorldCardInHand paths), and confirm its cost ring/label now inflates alongside Bulkhead/Gravity/Corridor/Order — the concrete symptom that motivated this plan.</li>
<li>Cross-check against source: reread <code>.lore/work/specs/new-derelict.md</code> REQ-DERELICT-11/30/45 and confirm this plan's Step 3 + Step 5 regression test together supersede the permissive "may define" language — note in the retro that these three requirements are effectively revised by this plan, since editing historical spec text isn't this plan's job.</li>
</ul>
</div>

## Open questions surfaced during planning (resolved above, recorded for traceability)

- **Should the registry be exported publicly from `contract.ts`?** Yes — `CardView.ts` (a `game/` consumer) needs it for Step 4, so it has to cross the `core`/`game` boundary the same way `PERSISTENT_KEYWORDS` already does.
- **Does `PlayerCard` need an analogous registry?** No — `PersistentModifier`/`ClearCostPerKeyword` has never applied to player cards; `effective-card-modifiers.md` REQ-CARDMOD-4 already tracks that as separate, deferred work. Not folded in here.
- **Rename `PersistentModifier`?** Left as-is. The name described "persists across turns" before; it now also describes "keyed globally, not per-card" — slightly less precise, but a rename touches every import in Step 1 and Step 5 for no functional gain. Flagged here in case review disagrees.
