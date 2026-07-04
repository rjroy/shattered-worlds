---
title: "Implementation plan: questions (World 13)"
date: 2026-07-04
status: executed
tags: [world, walker-narrative, grief-arc, denial, anger, destiny-entity, keyword-cost-modifiers, compound, plan]
modules: [core-effects, data-worlds, game-runtime, game-scenes]
related:
  - .lore/work/specs/questions.md
  - .lore/work/design/questions-card-design.md
  - .lore/work/brainstorm/endworlds-destination.md
  - .lore/work/brainstorm/world-13-grief-mechanics.md
  - .lore/work/brainstorm/player-support-message.md
  - .lore/reference/worlds/authoring/theme-authoring.md
  - .lore/reference/worlds/catalog/endworlds-trilogy-concept.md
  - .lore/work/specs/answers.md
  - .lore/work/specs/the-beginning.md
---

# Implementation plan: questions (World 13)

Source spec: `.lore/work/specs/questions.md` (REQ-W13-1..33). This plan sequences the work into five slices: a core-engine keyword slice, world content authoring, world wiring, the shared trilogy-level grief-support interstitial, and documentation/validation. No plan document exists yet for any prior world in this repo (Eden Prime, City of Sleeping Giants, The Ember Orchard all went spec → implement with no surviving plan artifact) — this is the first, so there is no local plan-format precedent to mirror beyond the spec itself and the shipped Eden Prime bundle used as structural template throughout.

**Cross-spec dependency:** Worlds 14 (`answers.md`) and 15 (`the-beginning.md`) are already drafted and both assume the exact keyword names and modifier kinds this plan introduces (`Denial`/`Anger` as `ClearCostPerSelfKeyword`/`ClearCostPerKeywordCount`). Renaming or reshaping them here breaks two other specs. Do not "clean up" the naming during implementation without flagging it back to the user first.

<div style="border-left: 4px solid #888; padding-left: 12px; margin: 12px 0;">
<strong>Legend:</strong> steps in the same slice can mostly proceed in file order; a step marked <strong>(depends on N)</strong> must wait for step N's edit to land first (mainly type/registry changes that later steps import). Slices execute in order 1→5 — Slice 2's card authoring uses the <code>Denial</code>/<code>Anger</code> keyword strings Slice 1 adds to <code>KEYWORD_NAMES</code>, so Slice 1 must fully land before Slice 2 begins even though no individual step cites it.
</div>

## Slice 1 — Core-engine keyword slice (REQ-W13-8..11, REQ-W13-28, REQ-W13-29.3)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 1.</strong> Add <code>"Denial"</code> and <code>"Anger"</code> to the <code>KeywordName</code> union in <code>src/core/model/types.ts</code> (currently 8 members ending <code>"Reroute"</code>).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 2 (depends on 1).</strong> In <code>src/core/model/keywords.ts</code>:
<ul>
<li>Add <code>"Denial"</code>, <code>"Anger"</code> to <code>KEYWORD_NAMES</code>.</li>
<li>Do <strong>not</strong> add either to <code>PERSISTENT_KEYWORDS</code> (currently <code>{"Lockdown", "Reroute"}</code>) — both must decay at turn start like <code>Alarm</code>, per REQ-W13-9.</li>
<li>Add two <code>KEYWORD_COST_MODIFIERS</code> entries, reusing existing <code>PersistentModifier</code> kinds (no new kind — REQ-W13-11):
<pre>Denial: { kind: "ClearCostPerSelfKeyword", costPer: 1 }
Anger:  { kind: "ClearCostPerKeywordCount", costPer: 1 }</pre>
</li>
</ul>
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 3 (depends on 2).</strong> No change needed in <code>src/core/engine/effectiveCards.ts</code> — <code>extraWorldCardCost</code>/<code>effectiveWorldCardCost</code> already iterate <code>KEYWORD_COST_MODIFIERS</code> generically. Confirm this by reading the function before writing tests, don't assume from the spec text alone.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 4 (depends on 2, 3).</strong> New unit tests, mirroring <code>src/core/tests/effectiveCards.test.ts</code>'s existing Lockdown/Alarm cost-modifier tests and <code>src/core/tests/transitAuthority.test.ts</code>'s Reroute test:
<ul>
<li><code>ClearCostPerSelfKeyword</code> computes correctly for <code>Denial</code> (self-authored value, e.g. <code>Denial:2</code> → +2 extra cost).</li>
<li><code>ClearCostPerKeywordCount</code> computes correctly for <code>Anger</code>, and — this is the REQ-W13-29.3 trap — assert it raises the cost of an <strong>unrelated, non-Anger-carrying card</strong> elsewhere in the same hand. A test scoped like <code>ClearCostPerOtherKeyword</code> (excluding the Anger card itself but nothing else) would pass incorrectly if the "all cards including self" semantics were implemented as "all other cards"; the test must target a second card that has neither <code>Anger</code> nor <code>Denial</code>.</li>
<li>Both modifiers stacking on the same card: a card authored with <code>Denial:2</code> plus a separate <code>Anger</code>-carrying card in hand → cost equals <code>baseCost + 2*costPer(Denial) + count*costPer(Anger)</code> (REQ-W13-29.4). This test doubles as the <code>Destiny</code> cost-stacking check once Destiny's template exists in Slice 2 — write it against a synthetic card here, then re-verify against the real <code>Destiny</code> template in Slice 2's validation pass.</li>
<li>Assert neither <code>Denial</code> nor <code>Anger</code> is in <code>PERSISTENT_KEYWORDS</code>.</li>
</ul>
</div>

## Slice 2 — World content authoring (REQ-W13-4..7, 12..20)

Concrete templates, values, and deck counts for every step in this slice are authored in `.lore/work/design/questions-card-design.md` — copy its JSON directly rather than re-deriving numbers during implementation. That document also resolves the authored-vs-runtime-applied keyword question (only `Destiny` and the escalated `He Isn't Coming Back` author `Denial:2` statically and are intentionally uncounterable by the Denial-strip reward; every other Denial/Anger card gains its keyword via `ApplyKeyword{target:"self"}` on `onDraw` so it stays strippable).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 5a — Act 1 (REQ-W13-4, 5, 16).</strong> Author Act 1 card templates into <code>src/data/allCards.json</code>'s <code>cardTemplates</code> map (global catalog, not a per-world file — confirmed via Eden Prime's shipped structure): <code>Waiting Room Silence</code>, <code>I'm Outta Here</code>, <code>The Monitor Keeps Beeping</code> — exact JSON in the design doc's Act 1 section. Every template needs all five hooks (<code>onDiscarded</code>, <code>onCleared</code>, <code>onPartialClear</code>, <code>onEndOfTurn</code>, <code>onDraw</code>), <code>{ "kind": "None" }</code> where empty (C3). <code>I'm Outta Here</code>'s only effect is <code>DestroySelf</code> in <code>onEndOfTurn</code> (C1a — the hook must be <code>onEndOfTurn</code>, not <code>onCleared</code>, since that's the only hook with a <code>selfId</code>), satisfying REQ-W13-5. <code>The Monitor Keeps Beeping</code> is the <code>ForceDestroy</code>-queuing card with no <code>Brace</code>-granting card anywhere in this world by design (see design doc's closing note).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 5b — Act 2 (depends on Slice 1; REQ-W13-17, 19).</strong> Author Act 2 card templates: <code>Everyone Says It's Nothing</code> (signature Denial threat), <code>The Test Results Sit Unopened</code> (Obstructed tool-fetch, grants <code>Ask The Question</code>), <code>She Says She's Fine</code> → <code>He Isn't Coming Back</code> (Self-Transform Pattern — <code>AddWorldCardToDeck{bTop:true}</code> then <code>DestroySelf</code>, explicitly <strong>not</strong> <code>ReturnWorldCards</code>, which is inert on automatic world-card hooks). Exact JSON, costs, and the authored-vs-applied Denial split (only <code>He Isn't Coming Back</code> authors <code>Denial:2</code> statically; <code>Everyone Says It's Nothing</code>/<code>The Test Results Sit Unopened</code> apply it via <code>ApplyKeyword</code> so it stays strippable) are in the design doc's Act 2 section. Requires Slice 1's <code>KEYWORD_NAMES</code> addition to have landed first, or the <code>"Denial:2"</code> string won't parse.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 5c — Act 3 (depends on Slice 1; REQ-W13-6, 12, 13, 18).</strong> Author Act 3 card templates: <code>It Isn't Fair</code> (signature Anger threat), <code>Nobody Warned You</code> (Obstructed tool-fetch, grants <code>Let It Out</code>), <code>The Question That Has No Answer</code> (grants <code>Why</code>, the <code>DealProgressAll</code>-based "indiscriminate swing" reward per REQ-W13-18), and <code>Destiny</code> — exact JSON in the design doc's Act 3 section. Add a code comment or flavor-text note on the <code>Destiny</code> template stating plainly that this is a themed world-card entity local to this world's data, unrelated to the existing <code>DestinyScene</code> (registered in <code>src/game/main.ts</code>, referenced from <code>WorldSelectScene.ts</code>'s locked-world branch) or the Destiny Progression meta-system — the collision is real and already present in code, not hypothetical (REQ-W13-6). <code>Destiny</code> authors <code>Denial:2</code> statically (deliberately uncounterable), and its <code>onCleared</code> is <code>ExileTopWorldCards{amount:3}</code> (not <code>SurviveWorld</code> — that stays exclusively on the <code>Door</code> chain per REQ-W13-13); no bespoke cost effect needed, Slice 1's two modifiers derive its cost automatically. The fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer is <strong>not authored here</strong> — it's the shared starter template, referenced only in deck composition (Step 7).
</div>

Do not redefine <code>The Walker</code>, <code>Summon Door</code>, or <code>Door</code> anywhere in this world's data (REQ-W13-2; duplicate template ids throw in <code>buildWorld</code>).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 6 (depends on 5a, 5b, 5c).</strong> Reward player cards (REQ-W13-14/15): <code>Ask The Question</code> (strips <code>Denial</code>, granted by <code>The Test Results Sit Unopened</code>), <code>Let It Out</code> (strips <code>Anger</code>, granted by <code>Nobody Warned You</code>), <code>Why</code> (the <code>DealProgressAll</code>-based reward, granted by <code>The Question That Has No Answer</code>), and <code>Sit With It a While</code> (the one permitted Freeze/Thaw flavor touch, capped per REQ-W13-15 — a <code>Modal</code> between minor <code>ThawCards</code> and a plain <code>Heal</code>, not central to either reward or world identity). Exact JSON in the design doc's Reward Player Cards section.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 7 (depends on 5a, 5b, 5c, 6).</strong> Deck composition (REQ-W13-20/21): Act 1 — 7 cards (foreshadow-only); Act 2 — 8 cards; Act 3 — 8 cards including <code>Destiny</code> and the fixed <code>{ "templateId": "The Walker", "count": 1 }</code> closer. Exact per-template counts in the design doc's Deck Composition section — sizes match the 7/8/7-8 shape used by Eden Prime and New Derelict, with Denial/Anger keyword *density* (not raw card count) carrying Acts 2/3's extra weight.
</div>

## Slice 3 — World bundle wiring (REQ-W13-1, 22..24)

No `src/data/worlds/questions/` directory exists yet — this is a from-scratch bundle, structurally mirroring the shipped `src/data/worlds/eden-prime/` bundle (`cards.json`, `index.ts`, `meta.ts`, `theme.ts`).

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 8 (depends on 7).</strong> Create <code>src/data/worlds/questions/cards.json</code> (deck composition only, referencing Slice 2 template ids by <code>{ templateId, count }</code> per act — mirrors Eden Prime's <code>cards.json</code> shape exactly).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 9.</strong> Create <code>src/data/worlds/questions/theme.ts</code> exporting a <code>VisualTheme</code> (mirrors <code>EDEN_PRIME_THEME</code>'s shape): <code>worldId: "questions"</code>, <code>intrusionHue</code> muted/desaturated (Act 1) warming toward hot/saturated (Act 3 — matches World 15's Act 1 reprise per REQ-W13-22), <code>realityPalette</code>, <code>frameStyle</code>, <code>backdrop</code> pointing at <code>"questions-bg"</code>/<code>"questions-overlay"</code> asset keys. Palette must be distinct from every existing world, in particular <code>whiteout-parking-garage</code>'s cool freeze palette (REQ-W13-23) — this world uses Freeze/Thaw/Heat only as the capped flavor touch from Step 6, not identity.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 10.</strong> Create <code>src/data/worlds/questions/meta.ts</code> exporting <code>WorldDisplayData</code>/<code>WorldHelpData</code> (mirrors <code>EDEN_PRIME_DISPLAY</code>/<code>EDEN_PRIME_HELP</code>). Help text must not spell out the grief-stage metaphor explicitly (REQ-W13-24) — describe mechanics (Denial/Anger taxing cost, Destiny's cost climbing) without naming "denial"/"anger" as emotional stages the way Eden Prime's help text describes "greed" and "alarm" mechanically without moralizing.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 11 (depends on 8, 9, 10).</strong> Create <code>src/data/worlds/questions/index.ts</code> assembling the <code>WorldDataBundle</code> (mirrors <code>EDEN_PRIME_BUNDLE</code>), then register it in <code>src/data/worlds/registry.ts</code>'s <code>worldDataRegistry</code> array (13th entry).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 12.</strong> Wire <code>src/game/worlds/assetBindings.ts</code>: reality/overlay art already exists at <code>src/game/assets/themes/questions/questions-reality.webp</code> and <code>intrusion-overlay.webp</code> (pre-staged; confirmed present) — import and bind to <code>"questions-bg"</code>/<code>"questions-overlay"</code> keys as Eden Prime does. No <code>cardfront</code> or inset art exists yet for this world; per the established precedent (bird-building, highway-volcano shipped without card inset art as placeholder), ship without a <code>worldCardfrontKey</code>/insets for now rather than blocking on art generation — flag this gap explicitly rather than silently omitting it. Add a music entry only if a track exists; otherwise flag as a follow-up (do not fabricate a placeholder audio file).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 13 (depends on 11, 12).</strong> Extend <code>src/core/tests/worldRegistry.test.ts</code>'s conformance suite (or add a sibling test) to assert, for every registered bundle including <code>questions</code>: no duplicate template ids, and every world card template defines all five required hooks explicitly (this check does not exist yet in the current suite — confirmed by reading it directly). This satisfies REQ-W13-27 and doubles as a regression guard for every other world's data.
</div>

## Slice 4 — Grief-support interstitial (trilogy-level: REQ-W13-30..33)

This is shared scaffolding triggered by any of `questions`/`answers`/`the-beginning` — build it once here since World 13 is the first of the three to implement.

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 14.</strong> Add a new small profile store for the one-time flag, mirroring <code>src/game/runtime/userSettings.ts</code>'s load/validate/save/store shape (versioned object, tolerant of unknown keys, its own storage key e.g. <code>shattered-worlds/grief-notice/v1</code>). Single field: <code>hasSeenGriefSupportNotice: boolean</code>, default <code>false</code>. Confirmed no existing store already holds a comparable "seen once" flag — this is new, not an extension of an existing store.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 15 (depends on 14).</strong> Thread the new store through <code>src/game/runtime/gameplayRuntime.ts</code>'s composition root, same construction pattern as <code>userSettings</code>/<code>unlocksProfile</code>/etc.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 16.</strong> Build a small external-link helper (new ground — confirmed zero prior <code>window.open</code>/<code>http</code>/<code>mailto:</code> usage anywhere in <code>src/</code>, and this is a web-only build with no Electron/Tauri wrapper). Use <code>window.open(url, "_blank", "noopener,noreferrer")</code> from a DOM overlay element layered over the Phaser canvas (matching how other overlay views like <code>HelpOverlayView</code> render DOM/text), wrapped in a small named function so it's independently unit-testable (e.g. mock <code>window.open</code> and assert call args) per REQ-W13-33.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 17 (depends on 15, 16).</strong> Create a new Phaser scene (e.g. <code>GriefSupportScene</code>) rendering the verbatim copy from <code>.lore/work/brainstorm/player-support-message.md</code>: headline "Need support?", the grief/death/losing-a-parent body text, the findahelpline.com link, the two 988 links (988lifeline.org for U.S., 988.ca for Canada), the emergency-services line, and a single "Continue" acknowledgment control. On dismissal: set the Step 14 flag via the runtime store, then launch <code>Table</code> with the passed-through <code>worldId</code>/<code>seed</code>. Register the new scene in <code>src/game/main.ts</code>'s scene array, constructed with access to the Step 15 store the same way <code>WorldSelectScene</code> receives its runtime dependencies.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 18 (depends on 17).</strong> Branch <code>src/game/scenes/WorldSelectScene.ts</code>'s card <code>pointerdown</code> handler (currently an unconditional <code>this.scene.launch("Table", { worldId, seed })</code>): if <code>worldId</code> is one of <code>questions</code>/<code>answers</code>/<code>the-beginning</code> and the profile flag is unset, launch the Step 17 scene instead, passing <code>worldId</code>/<code>seed</code> through; otherwise (flag already set, or any other world) launch <code>Table</code> exactly as today. Do not touch <code>HelpOverlayView</code>, <code>SettingsOverlayView</code>, or any other world's card-click path (REQ-W13-32).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 19 (depends on 14..18).</strong> Tests: profile-store load/save/migration-tolerance tests (mirroring <code>userSettings.ts</code>'s test style); a test that the external-link helper calls <code>window.open</code> with the expected URLs and <code>noopener,noreferrer</code>; a scene/flow-level test (or manual browser check, since this is UI) verifying: fresh profile → selecting any of the three worlds shows the interstitial before <code>Table</code>; dismissing persists the flag; selecting a second of the three afterward skips straight to <code>Table</code> (REQ-W13-29.6).
</div>

## Slice 5 — Documentation and final validation (REQ-W13-7, 25, 26, 29)

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 20.</strong> <code>.lore/reference/worlds/authoring/theme-authoring.md</code>: add the signature-verb table row <code>questions | compound | Denial/Anger keywords tax cost the longer grief goes unaddressed; Destiny's cost is a direct readout of accumulated Denial+Anger</code> (REQ-W13-7). Document <code>Denial</code>/<code>Anger</code> as C2 prose alongside the existing <code>Lockdown</code>/<code>Reroute</code> entries — <strong>not</strong> a new row in the separate Signature Effects table, which lists <code>CardEffect</code> kinds only (REQ-W13-25).
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;">
<strong>Step 21.</strong> Rewrite <code>.lore/reference/worlds/catalog/endworlds-trilogy-concept.md</code> — currently self-flags as stale (confirmed: it still describes the superseded Refusal/Acknowledgment keyword fork, the Attachment meta-stat, and the Feat/Fragment-spending World-14 Bargain battle, none of which appear in the ratified <code>questions.md</code>/<code>answers.md</code>/<code>the-beginning.md</code> specs). Rewrite it to describe the ratified Denial/Anger → Bargaining/Depression → Acceptance grief-stage structure and the single-ending design, per REQ-W13-26. This is a hard shipping blocker per the spec, independent of code correctness — nothing in the automated validation below catches a stale reference doc.
</div>

<div style="background:#f6f6f6;border-radius:6px;padding:10px 14px;margin:8px 0;background:#eef7ee;">
<strong>Step 22 — Final validation gate (depends on all prior steps).</strong> Per REQ-W13-29:
<ol>
<li><code>bun run test</code> — all existing tests plus new Slice 1/3/4 tests pass.</li>
<li><code>bun run lint && bun run typecheck && bun run build</code> succeed.</li>
<li>Confirm (via the Slice 1 unit test, not manual read) that a hand containing an <code>Anger</code>-carrying card raises <code>effectiveWorldCardCost</code> on an unrelated non-Anger card in the same hand.</li>
<li>Confirm <code>Destiny</code>'s effective cost with both self-authored <code>Denial:2</code> and a separate Anger-carrying card in hand equals <code>baseCost + 2*costPer(Denial) + count*costPer(Anger)</code>.</li>
<li>Diff <code>The Walker</code>/<code>Door</code>/<code>SurviveWorld</code> template definitions before/after — byte-identical (REQ-W13-2/3).</li>
<li>Manually exercise the grief-support interstitial in a browser: fresh profile → select <code>questions</code> → interstitial shows → dismiss → <code>Table</code> loads → flag persists → selecting a second of the three worlds skips straight to <code>Table</code> → external links open via system browser, not in-game.</li>
</ol>
</div>

## Open items carried forward from the spec (not blocking this plan, but should be flagged to the user before or during Slice 2/5)

- **Resolved by `.lore/work/design/questions-card-design.md`:** concrete card templates, `costPer: 1` for both `Denial`/`Anger` (matches every existing `KEYWORD_COST_MODIFIERS` entry), `Destiny`'s authored `Denial:2` value, and deck-composition counts (7/8/8 across the three acts). These are now concrete enough to implement from directly, though not yet sim-balance-checked (see the design doc's closing note — a `bun run sim` pass is recommended once authored).
- Final `worldId`/title (`questions`) and the signature verb name `compound` are still spec-level placeholders, unresolved by the card-design pass.
- Whether `Denial`/`Anger` need distinct UI rendering (separate icon/color) is unaddressed by the spec and out of scope for this plan; flag as a possible follow-up if it comes up during Slice 4 manual testing.
- Whether the support notice needs a "view again" affordance elsewhere, and whether the interstitial should auto-advance vs. require an explicit tap, are both open per the spec — Slice 4 implements the explicit-tap-only version (REQ-W13-32) and does not add a settings-menu re-entry point unless the user asks for it during review.
- `cardfront`/inset art for this world does not exist yet (Step 12) — flagged as a gap, not silently deferred.
- **World-unlock gating is unaddressed by the spec.** Every other post-launch world has a `worldUnlock` catalog entry in `src/data/unlocks/catalog.json`, and `isWorldUnlocked` defaults to `true` when no entry exists for a `worldId`. Neither `questions.md` nor its siblings `answers.md`/`the-beginning.md` specify a `worldUnlock` entry for these three end-worlds, which means as currently specced they'd appear unlocked from the start of the game — plausibly wrong for the run's three final narrative-closer worlds. This plan does not add a Slice for it since it's outside REQ-W13-1..33's scope; raise it with the user before or during implementation rather than silently defaulting to unlocked or inventing a gating rule unprompted.
