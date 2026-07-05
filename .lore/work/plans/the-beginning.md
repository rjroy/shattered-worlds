---
title: "Implementation plan: the-beginning (World 15)"
date: 2026-07-04
status: draft
tags: [world, walker-narrative, grief-arc, acceptance, destiny-entity, keyword-cost-modifiers, unburden, finale, plan]
modules: [core-effects, data-worlds, game-runtime]
related:
  - .lore/work/specs/the-beginning.md
  - .lore/work/design/the-beginning-card-design.md
  - .lore/work/plans/questions.md
  - .lore/work/plans/answers.md
  - .lore/work/brainstorm/world-15-grief-mechanics.md
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/reference/worlds/catalog/endworlds-trilogy-concept.md
---

# Implementation plan: the-beginning (World 15)

Source spec: `.lore/work/specs/the-beginning.md` (REQ-W15-1..30). `questions` (World 13) and `answers` (World 14) are both fully implemented and registered (`src/data/worlds/questions/`, `src/data/worlds/answers/`, `src/data/worlds/registry.ts`). `the-beginning` is a clean slate: no `src/data/worlds/the-beginning/` directory, no `Acceptance` anywhere in `src/`, though reality/overlay art is already pre-staged at `src/game/assets/themes/the-beginning/` (`the-beginning-reality.webp`, `intrusion-overlay.webp`).

## Deviation from the ratified spec — read this before touching Slice 1 or Slice 2

This deviation was worked out directly with the user during plan-prep, across two decision points. It changes REQ-W15-5, 9, 12, 13, 13a, 14, and 18 materially. **Do not implement REQ-W15-12 as literally written** — it is superseded in full by this section.

**Ground truth confirmed before writing this plan:** `Destiny` is not a per-world template — it is a single, global `allCards.json` entry (`cardTemplates["Destiny"]`), already reused unmodified by both `questions` and `answers` (`src/core/effects/gainCard.ts`'s `WORLD_THREAT_BY_WORLD_ID` maps both `"questions"` and `"answers"` to the literal string `"Destiny"`). Its current authored content, read directly from `allCards.json`:

| Field | Value |
|---|---|
| `name` | `"The Destiny"` (display only; templateId is `"Destiny"`) |
| `cost` | `15` |
| `keywords` | `[]` |
| `onCleared` | `SurviveWorld` |
| `onPartialClear` | `None` |
| `onEndOfTurn` | `Sequence[Damage 2, ExileTopWorldCards 1]` |

REQ-W15-5/18's "fresh instance... authored independently of Worlds 13/14's own Destiny cards" already contradicts this: template ids are globally unique (duplicate ids throw in `buildWorld`), and `"Destiny"` is claimed. `.lore/reference/worlds/catalog/endworlds-trilogy-catalog-concept.md`'s addendum (written during `answers`' plan) already predicts World 15 will "resolve it the same way" — reuse the shared template unmodified.

**Decision 1 (confirmed with the user):** `the-beginning` reuses the literal shared `Destiny` template, exactly as `questions`/`answers` do. **No change of any kind is made to `Destiny`'s authored JSON** — not its cost, not its keywords, not any hook. This protects `questions`/`answers`' already-shipped balance from a retroactive change, at the cost of REQ-W15-12's placeholder numbers (base cost `50`, applied `Acceptance` value `45`) becoming void: `Destiny`'s cost in `the-beginning` is `15`, the same as everywhere else it's used.

**Decision 2 (confirmed with the user):** Because `Destiny`'s `onPartialClear` cannot be touched (it's the shared template — changing it from `None` to anything else would also change `questions`/`answers`' behavior, since `Acceptance`'s cost modifier is a global registry entry that would apply to their copies of `Destiny` too, the instant it carried the keyword), REQ-W15-12's entire mechanism — "`Destiny`'s own `onPartialClear` applies `Acceptance` to itself" — is dropped. In the user's own words: *"Acceptance should not be specific to Destiny. It is a general concept. Destiny should not be tied to acceptance either... What acceptance should be is... a decreasing cost modifier based on the keyword... By having more acceptance applied to Destiny from some mechanism in other cards, you will decrease what is required to complete Destiny."*

**Resolution:** `Acceptance` stays exactly as REQ-W15-9/10/11 already specify — `KEYWORD_COST_MODIFIERS.Acceptance = { kind: "ClearCostPerSelfKeyword", costPer: -1 }`, not `PERSISTENT_KEYWORDS`, decays like every other transient keyword. What changes is *how it gets onto `Destiny`*: this plan adds one small, generic, reusable core-engine primitive — a new `ApplyKeyword` target that names a specific card in hand by `templateId`, rather than "self"/"hand"/"first"/"random". World 15's own reward cards (the ones that strip `Denial`/`Anger`/`Bargaining`/`Depression` via `RemoveKeyword`, REQ-W15-15/20) each also stamp `Acceptance` onto `Destiny` by name, as a second step in the same effect `Sequence`, if `Destiny` happens to be in hand. This is deterministic and structurally guaranteed to never touch `Door` (it matches on `templateId === "Destiny"` specifically, never anything else), which resolves the exact concern REQ-W15-12's original design considered and rejected broader targeting options for. It also lands closer to `world-15-grief-mechanics.md`'s original brainstorm framing ("`RemoveKeyword` clears keywords one at a time... `ApplyKeyword` stamps `Acceptance` as those clear") than REQ-W15-13a's spec-level redesign was — the spec moved away from that framing specifically because it didn't know this targeted primitive was buildable.

**Consequences that ripple through the rest of this plan:**
- REQ-W15-12's placeholder numbers (`cost: 50`, applied value `45`) are void. `Destiny`'s cost is `15` (shared, unmodified); a fully-refreshed `Acceptance` stack needs to reach `15` to zero it out. This is a smaller swing than the spec imagined, and changes the "nigh-impossible without engagement" framing: the actual pressure comes from `Destiny`'s always-active `onEndOfTurn` punishment (2 damage + exile 1 world card every turn it sits uncleared) rather than a dramatic cost cliff. Flag to the user during Slice 5's manual playtest whether this still reads as "hard if you fight it, easy if you accept."
- REQ-W15-13's decay/refresh mechanics (decays 1/turn when not refreshed, refreshes-to-max not stacked on reapplication) are unchanged — they're a property of the applied-keyword system generically, not specific to how `Acceptance` gets applied.
- REQ-W15-14 ("must not introduce... a new `ApplyKeyword` target") is deliberately violated here, with the user's confirmation from this plan-prep session — this is a ratified exception, not an oversight. Flag prominently in Slice 5's documentation pass.
- REQ-W15-9/10/11 (the `Acceptance` keyword itself, its modifier kind, its exclusion from `PERSISTENT_KEYWORDS`) are unaffected and implemented as originally specced.
- REQ-W15-6/16 (companion-figure flavor text, no new mechanic) are unaffected.
- **REQ-W15-15 is also superseded, and this is a direct textual contradiction, not a paraphrase difference.** REQ-W15-15 states the `RemoveKeyword` reward cards are "a legitimate, separate mechanic from `Destiny`'s own `Acceptance` buildup ... which only ever grows through direct engagement with `Destiny` itself, never through outside application." This plan's whole mechanism *is* outside application — the `RemoveKeyword` reward cards themselves apply `Acceptance` to `Destiny` by name. That clause of REQ-W15-15 no longer holds and should be read as superseded alongside REQ-W15-12.

<div style="border-left: 4px solid #888; padding-left: 12px; margin: 12px 0;">
<strong>Legend:</strong> steps in the same slice can mostly proceed in file order; a step marked <strong>(depends on N)</strong> must wait for step N's edit to land first. Slices execute in order 1→5 — Slice 2's card authoring uses the <code>Acceptance</code> keyword string and the new named-target <code>ApplyKeyword</code> variant Slice 1 adds, so Slice 1 must fully land before Slice 2 begins.
</div>

## Slice 1 — Core-engine additions (REQ-W15-9..11, 14 [superseded per deviation], 17, 29, 30.6/7)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 1.</strong> Add <code>"Acceptance"</code> to the <code>KeywordName</code> union in <code>src/core/model/types.ts</code> (currently 12 members ending <code>"Depression"</code>).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 2 (depends on 1).</strong> In <code>src/core/model/keywords.ts</code>:
<ul>
<li>Add <code>"Acceptance"</code> to <code>KEYWORD_NAMES</code>.</li>
<li>Do <strong>not</strong> add it to <code>PERSISTENT_KEYWORDS</code> — it must decay at turn start like every other grief keyword (REQ-W15-9).</li>
<li>Add <code>Acceptance: { kind: "ClearCostPerSelfKeyword", costPer: -1 }</code> to <code>KEYWORD_COST_MODIFIERS</code> — the first negative <code>costPer</code> in the registry (REQ-W15-9). Confirm by reading <code>effectiveCards.ts</code> before writing tests that <code>PersistentModifier.costPer</code> is a plain signed number with no floor anywhere in the summing logic (REQ-W15-9's own verified claim).</li>
</ul>
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 3 (depends on 1).</strong> Add a new <code>ApplyKeyword</code> target in <code>src/core/model/types.ts</code>: extend the effect shape (currently <code>target: "hand" | "nextWorldCard" | "self" | "firstWorldCardInHand" | "randomWorldCardInHand"</code>, no per-variant payload) to also accept <code>target: "worldCardInHandByTemplateId"</code> with a new required <code>templateId: CardTemplateId</code> field on the effect. Update the doc comment above the union (currently lines 146-156) to describe the new variant: applies to the one world card in hand matching <code>templateId</code> exactly, no-op if absent, never touches any other card regardless of hand contents — the deterministic-by-name counterpart to <code>firstWorldCardInHand</code>/<code>randomWorldCardInHand</code>.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 4 (depends on 3).</strong> In <code>src/core/effects/appliedKeywords.ts</code>'s <code>ApplyKeywordHandler.apply</code> switch (currently cases for <code>nextWorldCard</code>/<code>self</code>/<code>hand</code>/<code>firstWorldCardInHand</code>/<code>randomWorldCardInHand</code>, no <code>default</code> — TS2366 makes this exhaustiveness-checked despite the missing <code>default</code>, confirmed by reading the function's return type), add:
<pre>case "worldCardInHandByTemplateId": {
  const match = state.hand.find(
    (c): c is WorldCard => c.kind === "world" && c.templateId === effect.templateId,
  );
  return match === undefined ? { state, events: [] } : applyToHandIds(state, [match.id], kw);
}</pre>
reusing the existing <code>applyToHandIds</code> helper. No other call site needs a matching <em>compile-required</em> case — confirmed by reading every reference to <code>firstWorldCardInHand</code>/<code>randomWorldCardInHand</code> across <code>src/</code>: <code>compile()</code> on this handler doesn't reference <code>target</code> at all (card-face text is unaffected). <code>describe()</code> does interpolate <code>effect.target</code> directly as a string (`` `Apply ${effect.keyword}${suffix} to ${effect.target}` ``) and will render the raw literal <code>"worldCardInHandByTemplateId"</code> rather than naming <code>Destiny</code> — traced its only non-test consumer to <code>branchLabels.ts</code>'s Modal-branch fallback labels, not primary card text. Low practical exposure (this world's reward cards likely aren't `Modal` branches), but note it rather than silently leaving the ugly fallback in place if a `Modal` card does end up using this target.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 5.</strong> REQ-W15-11's cosmetic clamp: in <code>src/core/view/actionPreview.ts</code>'s progress-preview string (currently <code>` (${Math.min(event.hazardTurnTotal, cost)}/${cost})`</code>), clamp the displayed <code>cost</code> at 0 in the string only — do not clamp <code>effectiveWorldCardCost</code>'s actual return value, which must stay able to go negative or to zero for <code>Acceptance</code> to be meaningful.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 6 (depends on 1, 2).</strong> REQ-W15-17's <code>GainKeywordGuard</code> pre-loading needs a concrete mechanism, confirmed absent from the codebase today: <code>GainKeywordGuard</code> currently only exists as a played-card effect (Eden Prime's <code>Stillness Lesson</code>), never as a world-start seed, and <code>src/core/engine/world.ts:104-108</code> hardcodes <code>keywordGuard: 0</code> at world init, unconditionally.

<strong>Resolved with the user: charges scale with overall meta-progression, not a hand-picked set of Blessings.</strong> Every <code>UnlockDefinition</code> in <code>src/data/unlocks/catalog.json</code> already carries a <code>destinyWeight: number</code> field (confirmed: currently used only by <code>DestinyScene.ts</code> to draw "how much this matters" dots on the unlock-picker UI — never aggregated into anything). Rather than adding a new per-unlock effect type and deciding which specific entries should carry it (which would mean re-litigating the whole catalog), sum <code>destinyWeight</code> across every currently-<em>activated</em> unlock and derive starting <code>keywordGuard</code> from that total — this automatically scales with total earned progress across every Blessing and every Feat-granted unlock, with no per-entry special-casing:
<ul>
<li>Add <code>extraStartKeywordGuard: number</code> to <code>RunModifiers</code> and its <code>DEFAULT_RUN_MODIFIERS</code> (default <code>0</code>).</li>
<li>In <code>buildRunModifiers</code> (<code>src/data/unlocks/catalog.ts</code>), after the existing per-effect-type switch loop, separately sum <code>destinyWeight</code> across every id in <code>activeIds</code> matched against <code>catalog</code>, then set <code>extraStartKeywordGuard</code> via a small threshold formula, e.g. <code>Math.min(MAX_GUARD, Math.floor(totalWeight / WEIGHT_PER_CHARGE))</code>. This is a new, small aggregation alongside the existing per-effect switch, not a new <code>UnlockEffect</code> variant — no `catalog.json` edits needed at all for this to start producing nonzero values immediately, since every entry already has a `destinyWeight`.</li>
<li>Change <code>src/core/engine/world.ts</code>'s <code>keywordGuard: 0</code> to <code>keywordGuard: mods.extraStartKeywordGuard</code>.</li>
</ul>
<strong>Placeholder numbers, flag to the user:</strong> <code>WEIGHT_PER_CHARGE</code> and <code>MAX_GUARD</code> are unauthored guesses pending a real balance pass against the actual sum of `destinyWeight` across the full catalog (32 entries today) — same caveat as every other authored number in this plan. No new catalog entries are needed for this step; Slice 5's Step 21 (formerly "add a placeholder Blessing") is dropped, since the existing `destinyWeight` field already covers every unlock generically.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 7 (depends on 2, 3, 4, 6).</strong> New unit tests:
<ul>
<li><code>src/core/tests/effectiveCards.test.ts</code>, new <code>describe("effectiveWorldCardCost — Acceptance (World 15 Slice 1)", ...)</code>: negative <code>costPer</code> reduces cost correctly and can drive it to zero or below without throwing; confirm a single application at a given value produces the full discount immediately (not gradual); confirm decay by 1/turn when unrefreshed and refresh-to-max (not stacking) on reapplication, mirroring <code>keywords.test.ts</code>'s existing decay-test shape for <code>Denial</code>/<code>Bargaining</code>.</li>
<li><code>src/core/tests/appliedKeywords.test.ts</code>: the new <code>worldCardInHandByTemplateId</code> target applies only to the matching card in a hand containing multiple world cards (construct a hand with both a <code>Destiny</code>-templated card and a <code>Door</code>-templated card; assert only <code>Destiny</code> gains the keyword); no-op (state/events unchanged) when no card in hand matches the <code>templateId</code>.</li>
<li>A test proving <code>Door</code>'s effective cost is unaffected by any amount of <code>Acceptance</code>, <code>Denial</code>, <code>Anger</code>, <code>Bargaining</code>, or <code>Depression</code> present elsewhere in hand (REQ-W15-10, REQ-W15-30.5) — this is now also a direct regression guard for the new targeted <code>ApplyKeyword</code> variant never leaking onto <code>Door</code>.</li>
<li><code>RunModifiers</code>/world-init test: a set of activated unlocks with a known summed <code>destinyWeight</code> produces the expected starting <code>keywordGuard</code> value (per the Step 6 formula) in a built world's initial state; a fresh profile with nothing activated starts at <code>0</code>.</li>
<li>Confirm existing <code>Denial</code>/<code>Anger</code>/<code>Bargaining</code>/<code>Depression</code> cost-modifier tests still pass unmodified (REQ-W15-8, REQ-W15-29 — no re-tuning).</li>
</ul>
</div>

## Slice 2 — World content authoring (REQ-W15-4..7, 15..20)

`.lore/work/design/the-beginning-card-design.md` now exists (produced during this plan-prep pass, mirroring `questions-card-design.md`/`answers-card-design.md`'s role) — copy its JSON directly rather than re-deriving numbers during implementation. It also resolves the authored-vs-applied keyword split the same way `questions`/`answers` did (signature-threat/tool-fetch cards apply their keyword to themselves via `ApplyKeyword{target:"self"}` at runtime, not authored statically, so this world's own `RemoveKeyword` rewards can strip them) and carries the plan's `Acceptance` redesign into concrete card text: all four grief-release reward cards (`Say It Out Loud`, `Put It Down`, `Close the Book On It`, `Set It Down`) apply `Acceptance:15` to `Destiny` by name as a third `Sequence` step, chosen to exactly zero `Destiny`'s unmodified cost of `15` on first contact — see that document's own header section before touching Step 8.

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 8 (depends on Slice 1) — confirmed done.</strong> <code>.lore/work/design/the-beginning-card-design.md</code> exists and covers: Act I cards reprising <code>Denial</code>/<code>Anger</code> (faster saturation than World 13, REQ-W15-17); Act II cards reprising <code>Bargaining</code>/<code>Depression</code> (gentler than World 14, REQ-W15-18); the four grief-release reward cards that strip each keyword via <code>RemoveKeyword</code> AND, in the same effect <code>Sequence</code>, apply <code>Acceptance:15</code> to <code>Destiny</code> via the new <code>{ kind: "ApplyKeyword", keyword: "Acceptance", value: 15, target: "worldCardInHandByTemplateId", templateId: "Destiny" }</code> step; companion-figure flavor text on <code>Heal</code>/<code>GainLight</code>/<code>Brace</code>/<code>DealProgress</code> (REQ-W15-6/16, flavor only, no mechanical change); and deck composition counts (REQ-W15-21/22, 8/6/5 across the three acts). Read the design doc's own header section before implementing — it restates this plan's deviation in concrete card terms.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 9 (depends on 8) — Act I.</strong> Author Act I card templates into <code>src/data/allCards.json</code>'s <code>cardTemplates</code> map per the design doc. Every template defines all five hooks, <code>{ "kind": "None" }</code> where inert (C3, REQ-W15-17). <code>GainKeywordGuard</code> charges (this world's own reward cards, if any grant them directly) are separate from Slice 1 Step 6's world-start pre-load — both can coexist.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 10 (depends on 8) — Act II.</strong> Author Act II card templates per the design doc (REQ-W15-18). <code>Destiny</code>'s own <code>Depression</code>/<code>Denial</code>-style weight is <strong>not</strong> reprised on the shared <code>Destiny</code> template itself — it carries no keywords at all, shared or otherwise, per this plan's deviation section. If the design doc authors any card using <code>AddThreatToWorldDeck</code> (REQ-W15-18 explicitly calls for "smaller `AddThreatToWorldDeck` stakes"), it silently no-ops without Step 11a's registry fix landing first — do not author it before confirming that step is in place.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 11a.</strong> Register <code>"the-beginning": "Destiny"</code> in <code>src/core/effects/gainCard.ts</code>'s <code>WORLD_THREAT_BY_WORLD_ID</code> map, alongside the existing <code>questions</code>/<code>answers</code> entries. Without this, <code>AddThreatToWorldDeckHandler</code> resolves <code>worldThreatTemplateByWorldId("the-beginning")</code> to <code>undefined</code> and silently no-ops (confirmed by reading the handler) — any Act I/II card authored with this effect (REQ-W15-18) would do nothing in this world specifically, with no error to surface it.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 11 (depends on 8) — Act III.</strong> Author Act III card templates per the design doc: the <code>RemoveKeyword</code>+<code>Acceptance</code>-onto-<code>Destiny</code> reward cards (this plan's central mechanic), the tool-fetch card(s) granting them (REQ-W15-20), and any companion-flavored cards (REQ-W15-6/16). Do <strong>not</strong> author a new <code>Destiny</code> template — reference the existing shared one by id only in deck composition (Step 12). The fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer is likewise referenced only in deck composition, never redefined (REQ-W15-2/3).
</div>

Do not redefine `The Walker`, `Summon Door`, `Door`, or `Destiny` anywhere in this world's data — all four already exist from starter source or the shared `Destiny` template; duplicate template ids throw in `buildWorld`.

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 12 (depends on 9, 10, 11).</strong> Deck composition (REQ-W15-21/22) per the design doc: Act I dense/fast, Act II lighter, Act III centered on the <code>RemoveKeyword</code>+<code>Acceptance</code> loop rather than card volume, including the referenced <code>Destiny</code> and the fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer.
</div>

## Slice 3 — World bundle wiring (REQ-W15-1, 23..25)

No `src/data/worlds/the-beginning/` directory exists yet — from-scratch bundle, structurally mirroring the shipped `src/data/worlds/answers/` bundle (`cards.json`, `index.ts`, `meta.ts`, `theme.ts`).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 13 (depends on 12).</strong> Create <code>src/data/worlds/the-beginning/cards.json</code> (deck composition only, referencing Slice 2 template ids by <code>{ templateId, count }</code> per act, plus the shared <code>Destiny</code> and fixed <code>The Walker</code> closer — mirrors <code>answers/cards.json</code>'s shape).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 14 — resolved.</strong> <code>VisualTheme</code> (<code>src/game/view/themes/theme.ts</code>) authors exactly one flat <code>intrusionHue</code>/<code>realityPalette</code>/<code>frameStyle</code>/<code>backdrop</code> per world, and no renderer path (checked <code>TableScene.ts</code>, <code>backdrop.ts</code>) switches palette by act index — confirmed, not a code change this plan will make. **Resolution, confirmed with the user:** keep `VisualTheme` as one flat palette, same as every other world (no renderer/type change) — the "reality"/frame/backdrop layer represents one synthesized identity for the world rather than three discrete acts. The three-act visual arc REQ-W15-23 actually wants (Act I saturated/fast, Act II muted grey-blue, Act III's warmth) is instead carried by **card inset art direction** (Step 14a) — the layer players actually look at most, and the one place a per-act style split is already a normal authoring choice, not a code change. Create <code>src/data/worlds/the-beginning/theme.ts</code> exporting a single <code>VisualTheme</code> (mirrors <code>ANSWERS_THEME</code>'s structure): <code>worldId: "the-beginning"</code>, <code>backdrop</code> keys <code>"the-beginning-bg"</code>/<code>"the-beginning-overlay"</code>, a palette leaning toward Act III's returning warmth as the world's overall signature (since that's the resolution the whole world builds toward), distinct from both `questions`' hot saturation and `answers`' cool grey-blue.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 14a.</strong> Author <code>src/game/assets/themes/the-beginning/insets/README.md</code>, mirroring the structure of <code>answers/insets/README.md</code> (filename/asset-key convention, Direction section, per-card intent list, prompt template, finishing-pass checklist) with one deliberate difference: **three distinct "Direction" subsections instead of one** — Act I, Act II, Act III — rather than the single-house-style-with-an-accent-color-per-act pattern every other multi-act world uses. Act I's direction reprises `questions`' saturated/intense inset style; Act II's reprises `answers`' cooler, muted grey-blue inset style; Act III's is a new, distinct "warmth returning" direction not reused from either. This is the mechanism carrying REQ-W15-23's three-act arc into the shipped game — note explicitly in the README's opening section that this world is a deliberate exception to the single-Direction-section convention, so a future reader doesn't assume it's an authoring mistake. Actual inset image generation (matching this guidance) is a separate follow-on art pass, not part of this plan — ships without insets initially, same as `answers` did (Step 17).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 15.</strong> Create <code>src/data/worlds/the-beginning/meta.ts</code> exporting <code>WorldDisplayData</code>/<code>WorldHelpData</code> (mirrors <code>ANSWERS_DISPLAY</code>/<code>ANSWERS_HELP</code>). Help text must not spell out the grief-stage metaphor or explicitly name <code>Destiny</code> as the "real" ending (REQ-W15-25). Document plainly (as `answers`' own help text does) that this world's <code>Destiny</code> card is the same shared card carried over from `questions`/`answers`, not a new one, and that clearing it fires the same <code>SurviveWorld</code> as <code>Door</code>.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 16 (depends on 13, 14, 15).</strong> Create <code>src/data/worlds/the-beginning/index.ts</code> assembling the <code>WorldDataBundle</code> (mirrors <code>ANSWERS_BUNDLE</code>), then register it in <code>src/data/worlds/registry.ts</code>'s <code>worldDataRegistry</code> array (15th entry).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 17.</strong> Wire <code>src/game/worlds/assetBindings.ts</code>: reality/overlay art already exists (<code>src/game/assets/themes/the-beginning/the-beginning-reality.webp</code>, <code>intrusion-overlay.webp</code>, confirmed present) — import and bind to <code>"the-beginning-bg"</code>/<code>"the-beginning-overlay"</code> keys. No cardfront or inset art exists yet — ship without them for now (matches <code>answers</code>' initial state before its own inset pass; Step 14a's README exists so the follow-on art pass has direction, but generating the actual images is out of this plan's scope), flagged as a gap rather than silently omitted. Add a music entry only if a track exists; otherwise flag as a follow-up.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 18 (depends on 16, 17).</strong> Confirm <code>src/core/tests/worldRegistry.test.ts</code>'s conformance suite picks up <code>the-beginning</code> automatically (generic over the registry). Add <code>src/core/tests/theBeginning.test.ts</code>, mirroring <code>answers.test.ts</code>'s shape: registry/build sanity (<code>selectTheme("the-beginning")</code> resolves, <code>buildWorld</code> assembles, no duplicate ids — in particular no card reuses <code>The Walker</code>'s template id for the companion figure, REQ-W15-6), a hook/keyword validation loop over all of this world's <code>WORLD_CARDS</code>, and isolated effect tests for the <code>RemoveKeyword</code>+<code>Acceptance</code> reward cards' behavior against a hand containing the shared <code>Destiny</code> card (REQ-W15-28).
</div>

## Slice 4 — Grief-support interstitial (trilogy-level: no new work)

<div style="background:#eef7ee;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 19 — verification only.</strong> Already fully built and already includes <code>the-beginning</code>: confirmed directly in <code>src/game/scenes/griefSupportGate.ts</code>, whose <code>GRIEF_SUPPORT_WORLD_IDS</code> constant is <code>["questions", "answers", "the-beginning"]</code>. No code changes needed for REQ-W15-27a. Add to the manual validation pass only: on a profile that has seen the notice via `questions` or `answers` already, confirm selecting `the-beginning` skips straight to `Table`; on a fresh profile, confirm selecting `the-beginning` first shows the interstitial.
</div>

## Slice 5 — Unlock gating, documentation, and final validation (REQ-W15-26, 27, 30)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 20.</strong> Add a <code>worldUnlock</code> Destiny Blessing entry to <code>src/data/unlocks/catalog.json</code>, mirroring <code>world-answers</code>'s shape:
<pre>{
  "id": "world-the-beginning",
  "name": "The Beginning",
  "description": "Opens The Beginning in World Select.",
  "cost": 30,
  "destinyWeight": 0,
  "effect": { "type": "worldUnlock", "worldId": "the-beginning" }
}</pre>
Cost <code>30</code> continues the existing escalation (5→5→5→10→10→10→15→15→15→20→25→30) — a placeholder pending balance tuning, same caveat as every other authored number here.
</div>

<div style="background:#eef7ee;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 21 — dropped, verification only (depends on Slice 1 Step 6).</strong> No new catalog entry is needed here: Slice 1 Step 6 derives starting <code>keywordGuard</code> from <code>destinyWeight</code> already present on every existing catalog entry, not from a new dedicated Blessing. Verify instead that a profile with several activated unlocks (summing to a nonzero `destinyWeight` total) produces the expected nonzero starting `keywordGuard` in a built `the-beginning` world, and that a fresh profile with nothing activated starts at `0`.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 22.</strong> <code>.lore/reference/worlds/authoring/theme-authoring.md</code>: add the signature-verb table row <code>the-beginning | unburden | Reprises Worlds 13/14's four grief keywords (all cost-increasing), then introduces Acceptance — the only cost-decreasing keyword in the game</code> (REQ-W15-7), immediately after the `answers` row. Document `Acceptance` as C2 prose extending the existing keyword paragraph (not a new Signature Effects table row, REQ-W15-26), explicitly noting it as the first cost-decreasing `KEYWORD_COST_MODIFIERS` entry. Also document the new `worldCardInHandByTemplateId` `ApplyKeyword` target as a new primitive (where the doc lists engine primitives per world, alongside `ApplyKeyword`/`KeywordGate`/`RemoveKeyword`'s existing description) and record explicitly that it exists specifically because `Destiny` is a shared, cross-world template that cannot itself be modified per-world.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 23.</strong> <code>.lore/reference/worlds/catalog/endworlds-trilogy-concept.md</code>: update its addendum — no longer "World 15 is expected to resolve it the same way" (prediction), now confirmed fact, and record that <code>Acceptance</code> is deliberately NOT applied via <code>Destiny</code>'s own hooks (unlike the addendum's implicit assumption) but via the new named-target <code>ApplyKeyword</code> variant fired from this world's own reward cards. This is the third and final world confirming the shared-<code>Destiny</code> decision (REQ-W15-27's precedent).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;background:#eef7ee;">
<strong>Step 24 — Final validation gate (depends on all prior steps).</strong> Per REQ-W15-30, corrected for this plan's deviation:
<ol>
<li><code>bun run test</code> — all existing tests plus new Slice 1/3 tests pass.</li>
<li><code>bun run lint && bun run typecheck && bun run build</code> succeed.</li>
<li>Verify via unit test that applying <code>Acceptance</code> to <code>Destiny</code> via a <code>RemoveKeyword</code>+<code>ApplyKeyword</code> reward card drops its effective cost below <code>15</code> by the applied value. <strong>Correction: `ClearCostPerSelfKeyword`'s summing has no `Math.max(0, ...)` floor</strong> (confirmed by reading `extraWorldCardCost` directly — only the <em>other two</em> modifier kinds floor their counts before multiplying) — the effective cost is allowed to go negative, and only the Step 5 display string clamps at 0. Do not assert the cost floors at zero; assert it can go negative. Also verify that skipping a turn of engagement decays the applied value by 1; that re-engaging refreshes rather than stacks.</li>
<li>Verify <code>Destiny</code>'s <code>onCleared</code> firing <code>SurviveWorld</code> and <code>Door</code>'s <code>onCleared</code> firing <code>SurviveWorld</code> are independent paths — clearing one doesn't consume or disable the other.</li>
<li>Verify <code>Door</code>'s effective cost stays exactly its authored base cost regardless of how much <code>Acceptance</code>/<code>Denial</code>/<code>Anger</code>/<code>Bargaining</code>/<code>Depression</code> exists elsewhere in hand — including a hand where the new targeted <code>ApplyKeyword</code> variant is present but aimed at <code>Destiny</code>, proving it never leaks onto <code>Door</code>.</li>
<li><strong>Diff <code>Destiny</code>'s authored template in <code>allCards.json</code> before/after this plan's implementation — byte-identical.</strong> This is the concrete, testable form of this plan's central deviation decision (no change of any kind to the shared template). Also confirm no engine change touched <code>The Walker</code>/<code>Door</code> wiring.</li>
<li>Confirm the <code>actionPreview.ts</code> progress-preview string never displays a negative number, via a targeted test with a card's cost driven below zero.</li>
<li>Confirm a world built with a profile whose activated unlocks sum to a nonzero total <code>destinyWeight</code> starts with the expected non-zero <code>keywordGuard</code> value, per the Step 6 formula, and that a fresh/empty profile starts at exactly <code>0</code>.</li>
<li>Manually verify the grief-support interstitial per Slice 4's Step 19 check.</li>
<li>Manually play through <code>the-beginning</code> once via <code>bun run dev</code> to confirm the <code>RemoveKeyword</code>→<code>Acceptance</code>→cheaper-<code>Destiny</code> loop is visible and legible, that an unaddressed <code>Destiny</code>'s per-turn punishment is felt, and that the world isn't unlocked from a fresh profile without Step 20's Blessing purchased.</li>
</ol>
</div>

## Open items carried forward (flag to the user, not silently resolved)

- **The single biggest deviation in this plan** (see the dedicated section above): `Destiny`'s cost stays `15` (not the spec's placeholder `50`), and `Acceptance` is applied by this world's own reward cards via a new targeted `ApplyKeyword` variant rather than `Destiny`'s own `onPartialClear` hook. This directly supersedes REQ-W15-12, and partially supersedes REQ-W15-13/13a/14/15/18 (REQ-W15-15's "never through outside application" clause is now false by design). Confirmed with the user during this plan-prep session across two decision points, but the spec document itself (`the-beginning.md`) has not been edited to match — consider whether it should be, or whether this plan's deviation section is sufficient record.
- **Resolved:** `the-beginning-card-design.md` (Slice 2 Step 8) has been produced, mirroring `questions`/`answers`' precedent. Slices 2-5 are no longer blocked.
- **Resolved:** `GainKeywordGuard` pre-loading (Slice 1 Step 6) scales with overall meta-progression rather than a hand-picked set of Blessings — starting `keywordGuard` derives from the sum of `destinyWeight` (an existing, currently UI-only field) across every activated unlock, via a small threshold formula. No new catalog entries needed; Slice 5's former "add a placeholder Blessing" step is dropped (now verification-only). The formula's two constants (`WEIGHT_PER_CHARGE`, `MAX_GUARD`) are unauthored placeholders — see the balance-numbers item below.
- **Resolved:** `VisualTheme` cannot express a genuinely different palette per act (confirmed — one flat palette per world, no renderer path switches by act index). Rather than a renderer/type change, the user confirmed the three-act visual arc (REQ-W15-23) is carried by card inset art direction instead — Step 14a authors an insets README with three distinct per-act "Direction" sections (a deliberate exception to every other world's single-Direction convention), while `VisualTheme` itself stays one flat, synthesized identity leaning toward Act III's returning warmth. Actual inset image generation matching that guidance remains a follow-on art pass, not part of this plan.
- `cardfront`/inset art for this world does not exist yet (Step 17) — flagged as a gap, matching `answers`' initial ship state.
- The unlock cost of `30` (Step 20), the `Acceptance` value(s) authored in the design doc (Step 8), and Step 6's `WEIGHT_PER_CHARGE`/`MAX_GUARD` constants are all unvalidated placeholders pending a `bun run sim` balance pass — the last of these specifically needs checking against the real sum of `destinyWeight` across the full 32-entry catalog, not just guessed.
- Whether `Destiny`'s reduced stakes (cost 15, not 50) still deliver the "hard if you fight it, easy if you accept" feeling the spec and brainstorm both intend is unconfirmed until Slice 5's manual playtest (REQ-W15-24's Destiny/Door visual-tell question remains open too, unaddressed by this plan per the spec's own scope note).
- Whether the companion-figure reflavor (REQ-W15-6/16) is emotionally legible through flavor text alone remains open per the spec, unaddressed by this plan.
