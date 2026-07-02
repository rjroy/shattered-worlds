---
title: "Implementation plan: New Derelict"
date: 2026-06-30
status: draft
tags: [world-design, new-derelict, isolate, lockdown, persistent-modifier, effective-cost, deck-pressure, core-engine, plan]
modules: [core, data, game, sim]
related: [.lore/work/specs/new-derelict.md, .lore/work/specs/eden-prime.md, .lore/work/specs/effective-card-modifiers.md, .lore/reference/theme-authoring.md, .lore/reference/effect-system-extension-pattern.md]
req-prefix: DERELICT
---

# Implementation plan: New Derelict

Source spec: [.lore/work/specs/new-derelict.md](../specs/new-derelict.md) (`status: draft`, req-prefix `DERELICT`). This plan implements REQ-DERELICT-1..50.

## What changed since the spec was written (2026-06-29)

The spec assumed Eden Prime's keyword slice was a pending prerequisite (REQ-DERELICT-9) and authored several requirements against an older data-authoring model. Both research passes (lore + codebase) confirm the following drift, folded into the steps below rather than left as open questions:

1. **Eden Prime already shipped.** Commits `bf4d684` and `44e7ba0` landed the full keyword slice on this branch — `KeywordName`, `ApplyKeyword`/`KeywordGate`/`ProgressGate`/`RemoveKeyword`/`GainKeywordGuard`, the `appliedKeywords` runtime field, and `tickAppliedKeywordsAtTurnStart`. REQ-DERELICT-9's "must land first" gate is already satisfied — this plan reuses the primitives directly, no prerequisite slice needed. (`eden-prime.md`'s own `status: draft` is stale too; step 4.5 corrects it.)
2. **Two additions beyond the Eden Prime spec's text exist in code and New Derelict must account for them:** a fifth `ApplyKeyword` target, `"randomWorldCardInHand"` (`src/core/model/types.ts:130,138`), and a fifth required `WorldCard`/`WorldCardTemplate` hook, `onDraw` (`types.ts:207`, `cards.ts:46`). New Derelict's card recipes (REQ-DERELICT-23..29) don't need the random target, but every New Derelict world-card template must define `onDraw` (default `{ "kind": "None" }`) — REQ-DERELICT-30's four-hook list is stale.
3. **Card templates no longer live in per-world `cards.json`.** A catalog-unification refactor moved every template body into one global `src/data/allCards.json` (`cardTemplates` map, assembled via `assembleCatalog`). Per-world `cards.json` now holds only `{ worldId, deckComposition }`. This is the single biggest place REQ-DERELICT-23..30 and REQ-DERELICT-46 read as stale — Slice 2 below authors against the real shape.
4. **`worldThreatTemplateByWorldId` is a hardcoded object literal**, not registry-derived: `WORLD_THREAT_BY_WORLD_ID` in `src/core/effects/gainCard.ts:27-38`. REQ-DERELICT-15a is one line there.
5. **Asset registration is single-source, not dual.** `src/game/worlds/assetBindings.ts` is where a new world's backdrop/overlay/cardfront/inset keys get bound; `src/game/data/assetManifest.ts` spreads `assetBindings.ts`'s exports in automatically (`assetManifest.ts:170`) rather than needing its own per-world entries. REQ-DERELICT-3/48's implied dual registration is corrected in Slice 3.
6. **A pre-existing test-coverage gap directly affects this world's own card recipes.** `src/core/tests/worldRegistry.test.ts`'s template-reference walker only checks `onDiscarded`/`onCleared`/`onEndOfTurn` (lines 38-40), not `onPartialClear` or `onDraw`. New Derelict's `Gravity Priority Shift` (REQ-DERELICT-25), `Corridor Becomes Lifeboat` (REQ-DERELICT-27), and `The Order Arrives` (REQ-DERELICT-29) all put template references inside `onPartialClear`. **Confirmed with the user:** this plan fixes the walker (step 2.1) rather than leaving it out of scope.
7. **No built-in mechanism makes an applied keyword skip turn-start decay** — `tickAppliedKeywordsAtTurnStart` is generic over every applied keyword, unlike REQ-DERELICT-10's requirement that `Lockdown` never decay. **Confirmed with the user:** this plan adds an explicit persistent-keyword allowlist (step 1.2) rather than an undefined-value sentinel.
8. **A genuine cross-card rendering gap exists for the effective-cost display.** A card's own render container is only rebuilt when *its own* `cardDisplaySignature` changes (`src/game/scenes/TableScene.ts:145-166`); that signature has no notion of "another card's Lockdown count changed." Step 1.6 spells out the fix (a reactive per-cycle update, mirroring how the progress ring already bypasses the signature check).
9. **`availableActions` (`src/core/engine/available.ts`) has no world-card-cost call site to wire.** REQ-DERELICT-12/45 name `availableActions` among the systems that must agree on the effective cost, but `available.ts` never reads a world card's `.cost` at all (its only cost-related logic is player-card energy affordability). Confirmed by direct inspection — this is not a gap, the requirement's `availableActions` clause is satisfied vacuously, and step 1.6's four-call-site list (resolution, preview, ring, card face) is the complete set.
10. **`REMOVE_KEYWORD`'s existing `zone: "hand"` handling already satisfies REQ-DERELICT-13's zone note with no code change.** `RemoveKeywordHandler` (`appliedKeywords.ts:236-266`) already operates over the combined `state.hand` (player + world cards) with no `kind` filter — the release valves work against Lockdown exactly as they already work against Alarm. Confirmed by inspection so Slice 2 authoring can rely on it directly.

## Slice 1 — Core-engine: Lockdown keyword + persistent effective-cost modifier

No dependency on other slices; must land and be green before Slice 2 authors cards against it (REQ-DERELICT-44).

**1.1 — Register the keyword.** Add `"Lockdown"` to `KeywordName` (`src/core/model/types.ts:12`) and to `KEYWORD_NAMES` (`src/core/model/keywords.ts:14-21`).

**1.2 — Make Lockdown persistent (explicit allowlist, per confirmed decision).** Add a `PERSISTENT_KEYWORDS: ReadonlySet<KeywordName>` constant next to `KEYWORD_NAMES` in `src/core/model/keywords.ts`, initially `new Set(["Lockdown"])`. Modify `tickAppliedKeywords` (`keywords.ts:125-136`) so any applied entry whose name is in `PERSISTENT_KEYWORDS` passes through unchanged instead of being decremented/dropped. `ApplyKeywordEffect.value` stays a required `number` (`types.ts:135-139`) — author Lockdown's `ApplyKeyword` calls with a nominal `value` (e.g. `1`) and a one-line comment noting it's unused for decay, since the allowlist — not the value — is what makes it persistent.

**1.2a — Bare-keyword display (per confirmed decision).** Since the allowlist, not the value, makes Lockdown persistent, the nominal value would otherwise leak into three player-facing render paths as a meaningless, unchanging "1": the applied-keyword badge (`formatKeyword`/`formatAppliedKeywords`, `CardView.ts:40-52`, rendered at `CardView.ts:543-553`), `ApplyKeywordHandler.describe()`'s rules text (`appliedKeywords.ts:174`, currently `` `Apply ${effect.keyword} (${effect.value}) to ${effect.target}` ``), and `ApplyKeywordHandler.compile()`'s compact effect-line token (`appliedKeywords.ts:177-179`). Special-case `PERSISTENT_KEYWORDS` members in all three to omit the value — bare "Lockdown" everywhere, matching REQ-DERELICT-10's own "presence is the state" framing. `Alarm`'s existing valued display is unaffected (it's not in the allowlist).

**1.3 — Add the `PersistentModifier` type.** In `src/core/model/types.ts`, near `Keyword`/`CardEffect`:
```ts
export type PersistentModifier = {
  kind: "ClearCostPerKeyword";
  keyword: KeywordName;
  costPerOther: number;
};
```
Export it from `src/core/contract.ts` alongside `Keyword`/`KeywordName` (contract.ts:19-20).

**1.4 — Add the field to the world-card shapes.** Optional `persistent?: PersistentModifier` on `WorldCardTemplate` (`src/core/model/cards.ts:32-47`) and `WorldCard` (`types.ts:186-211`). Wire it through `mintCard`'s world-card branch (`cards.ts` ~90-108): `persistent: template.persistent`.

**1.5 — Add the derivation.** `effectiveWorldCardCost(card: WorldCard, state: GameState): number` in `src/core/engine/effectiveCards.ts`, next to `effectivePlayerCard`/`effectiveCard`/`effectiveHand`:
- No-op (`card.cost` unchanged) when `card.persistent` is absent, or when the card doesn't currently carry `card.persistent.keyword` (via `hasKeyword`) — this is what makes REQ-DERELICT-14's no-op guarantee hold by construction for every world that authors no `persistent` field.
- Otherwise: count hand cards carrying that keyword (`hasKeyword`, mirroring `KeywordGateHandler`'s `zone: "hand"` semantics), subtract 1 for the card itself, floor at 0, multiply by `costPerOther`, add to `card.cost`.
- Export from `contract.ts` next to `effectiveCard`/`effectiveHand`/`effectivePlayerCard` (contract.ts:31).

**1.6 — Wire the derivation into every place REQ-DERELICT-12 requires to agree.** Four call sites currently read `card.cost` (or `hazard.cost`) directly:
- **Resolution** — `src/core/effects/dealProgress.ts:98`, `if (hazardTurnTotal >= hazard.cost)` → `effectiveWorldCardCost(hazard, current)`.
- **Preview** — `src/core/view/actionPreview.ts:478`, `const cost = card?.kind === "world" ? card.cost : undefined;` → `... ? effectiveWorldCardCost(card, context.before) : undefined` (`PreviewContext.before: GameState` is already in scope at `actionPreview.ts:37`).
- **Table ring** — `src/game/scenes/TableScene.ts:741`, `ringFraction(progress, card.cost)` → `ringFraction(progress, effectiveWorldCardCost(card, this.game_.state))`.
- **Card face digit** — `src/game/view/CardView.ts` builds the cost digit once at construction (~line 400-420) from `String(worldCard.cost)`, colored unconditionally `TEXT.textCost`, with no reactive update path. This is the cross-card gap from context item 8: `cardDisplaySignature` only tracks *this* card's own fields, so a sibling card becoming Locked won't trigger a rebuild. Fix: add an `updateCostLabel(cost: number, baseCost: number)` method to `CardView`, storing the cost text object as a class field (`costText`) the way `costRing` already is (`CardView.ts:188`) — mirror `updateCostRing`'s existing pattern exactly (`CardView.ts:647`). The method sets both the text (`String(cost)`) and the color by comparing against `baseCost`: unchanged (`cost === baseCost`) keeps the existing `TEXT.textCost`; higher (`cost > baseCost`) sets `TEXT.textPenalty`; lower (`cost < baseCost`) sets `TEXT.textReward` (both already defined in `presentation.ts:38-39` and used elsewhere on this same card face, e.g. `onCleared`'s token color at `CardView.ts:469`/`474`). Call it from `TableScene.layoutRow` every render cycle alongside the existing ring update (~line 741), passing `effectiveWorldCardCost(card, this.game_.state)` as `cost` and `card.cost` as `baseCost`, for the same reason the ring is already updated per-cycle ("progress and light have no dedicated change event" — neither does a sibling's Lockdown count).

**1.7 — Tests.**
- `src/core/tests/appliedKeywords.test.ts` / `keywords.test.ts`: `ApplyKeyword` places `Lockdown` on the `self`/`hand`/`firstWorldCardInHand`/`nextWorldCard` targets (reuse the existing per-target Alarm test shape); a direct side-by-side case showing `Lockdown` survives `tickAppliedKeywordsAtTurnStart` across a turn boundary where `Alarm` would have decayed; `RemoveKeyword` strips `Lockdown` deterministically.
- `src/core/tests/effectiveCards.test.ts`: `effectiveWorldCardCost` at cluster sizes 1 (tax 0), 2 (tax +1), 3 (tax +2); a card carrying `persistent` but not currently Locked returns base cost; a card with no `persistent` field returns base cost unchanged even when other hand cards carry Lockdown (the REQ-DERELICT-14 no-op case).
- A dispatch-level test (extend `dealProgress`'s existing test coverage, or `effects.test.ts`) building a hand with two Locked persistent-modifier cards, dealing progress, and asserting the resolution threshold matches what preview showed — the "player pays exactly the previewed cost" contract.
- `src/game/tests/` (a `CardView`-focused test, alongside any existing coverage of `updateCostRing`): `updateCostLabel(cost, baseCost)` sets `TEXT.textCost` when `cost === baseCost`, `TEXT.textPenalty` when `cost > baseCost`, and `TEXT.textReward` when `cost < baseCost` — the three-way color rule from step 1.6, checked directly rather than only through the manual smoke test in step 4.4.

## Slice 2 — World data: templates, registration, threat mapping

Depends on Slice 1 landing green.

**2.1 — Close the conformance-test gap first (confirmed decision) so the rest of this slice gets real coverage.** Extend `templateRefs`/`allReferencedTemplates` in `src/core/tests/worldRegistry.test.ts` (lines 14-44) two ways, both needed to fully close the gap this world's own recipes hit:
- Walk `template.onPartialClear` and `template.onDraw` for world-card templates (currently only `onDiscarded`/`onCleared`/`onEndOfTurn` are walked, lines 38-40).
- Recurse `templateRefs` into `KeywordGate.then` and `ProgressGate.then` (currently only `Modal.branches`/`Sequence.steps` recurse). Without this, a template reference nested inside a gate is invisible to the walker regardless of which hook holds it — confirmed this already silently affects two shipped Eden Prime cards (`allCards.json:1232,1250`) and would otherwise also miss two of this plan's own new cards: `Systems Panel`'s `onEndOfTurn` (REQ-DERELICT-28) and `The Order Arrives`' `onPartialClear` (REQ-DERELICT-29), both `KeywordGate → then: AddWorldCardToDeck`.

Run the full suite immediately after this change — if it newly fails against an *existing* world's data, that's a real bug the gap was hiding; report it rather than special-casing it away, per this project's "no pre-existing excuses" policy.

**2.2 — Author card templates into `src/data/allCards.json`** (`cardTemplates` map — the global catalog, not a per-world file):
- World-card hazards: `Bulkhead 7-C Seals`, `Unfinished Captain's Address`, `Gravity Priority Shift`, `Administrative Misfile`, `Corridor Becomes Lifeboat`, `Systems Panel`, `The Order Arrives` — shapes per REQ-DERELICT-23..29. Every one defines all five hooks (`onDiscarded`, `onCleared`, `onPartialClear`, `onEndOfTurn`, `onDraw` — default `onDraw: { "kind": "None" }` per context item 2 above) and the `persistent` field where REQ-DERELICT-11/23/25/27/29 call for it.
- Player-card rewards: `Emergency Route`, `Override Badge`, `Manual Release`, `Follow the Checklist` — shapes per REQ-DERELICT-17..20.
- Resolve the two "fixed template" placeholders to real ids during authoring, not left as strings to guess later: `Follow the Checklist`'s top-decked card (REQ-DERELICT-20) and `Gravity Priority Shift`'s `onPartialClear` pin (REQ-DERELICT-25) — each must be an existing template id (shared starter or another New Derelict reward) or `buildWorld` fails at runtime, not at review time.
- Every `WorldCardTemplate.keywords` array is required (`cards.ts:37`, no `?`) — author `[]` explicitly where a card has none.
- Each world-card template's `insetKey` must match the `derelict-inset-*` key chosen when authoring insets in step 3.2/3.3 — these two steps can run in parallel, but the key string is shared between them; the presentation test in 3.5 will catch a mismatch, but agree on the naming convention up front to avoid rework.

**2.3 — Create the four world files under `src/data/worlds/new-derelict/`**, mirroring `src/data/worlds/eden-prime/` exactly:
- `meta.ts` — `WorldDisplayData`/`WorldHelpData` per REQ-DERELICT-41/42.
- `theme.ts` — `VisualTheme` per REQ-DERELICT-36, same shape as `EDEN_PRIME_THEME`.
- `cards.json` — `{ "worldId": "new-derelict", "deckComposition": { "acts": [...] } }` only, counts per REQ-DERELICT-33.
- `index.ts` — assembles `NEW_DERELICT_BUNDLE: WorldDataBundle`. Confirm a `musicKey` during this step (check whether New Derelict has bound music anywhere already; if not, this is a small decision to make explicitly rather than leave as a TODO).

**2.4 — Register.** Add `NEW_DERELICT_BUNDLE` to `worldDataRegistry` in `src/data/worlds/registry.ts` (one import, one array entry).

**2.5 — Threat mapping.** Add `"new-derelict": "The Order Arrives"` to `WORLD_THREAT_BY_WORLD_ID` in `src/core/effects/gainCard.ts:27-38` (REQ-DERELICT-15a).

**2.6 — Tests.** Registration alone gets `worldRegistry.test.ts`'s generic conformance suite for free (id/theme/display/help/musicKey presence, asset-key non-emptiness, template-ref resolution — now covering `onPartialClear`/`onDraw`/`KeywordGate.then`/`ProgressGate.then` per 2.1). Add `src/core/tests/newDerelict.test.ts` mirroring `cityOfSleepingGiants.test.ts`'s **two** blocks, not just its effect-behavior one: the world-data-shape block (`REQUIRED_HOOKS`/`VALID_KEYWORDS`/duplicate-id/Act-3-ends-with-Walker checks — REQ-DERELICT-46) and the effect-behavior block (REQ-DERELICT-47). When mirroring `REQUIRED_HOOKS`, update it to list all five hooks including `onDraw` — the source file's version (`cityOfSleepingGiants.test.ts:17`) predates that hook and only lists four; copying it as-is would silently leave New Derelict's hook-completeness check three-wide short. Effect-behavior coverage: `Bulkhead 7-C Seals` self-seals and redirects if left uncleared; clearing two Locked hazards costs strictly more total Progress than clearing the same two hazards one at a time with no other Locked card present (the cluster tax observable end to end); `Administrative Misfile`'s `onEndOfTurn` seals `firstWorldCardInHand` and its `onCleared` grants `Override Badge`; `Systems Panel`'s `onCleared` creates a boon offer from `pool-derelict-override`; `Emergency Route` seals the next world card drawn; `Override Badge`/`Manual Release` strip Lockdown; `The Order Arrives` deals its non-zero base damage plus the Lockdown-scaled bonus and calls `AddThreatToWorldDeck`.

## Slice 3 — Assets & presentation

Asset authoring (3.1-3.3) has no dependency on Slice 2 and can start in parallel; its tests (3.5) need Slice 2's registration so `buildWorld("new-derelict")` resolves.

**3.1 — Review the three existing base assets** (`new-derelict-reality.webp`, `intrusion-overlay.webp`, `new-derelict-cardfront.webp`) against `src/game/assets/themes/README.md`'s art-direction contract (REQ-DERELICT-2/36-39). Retouch/regenerate in place only what fails, keeping filenames unchanged.

**3.2 — Author insets via `/art-gen:generate-image`.** One per New Derelict card template under `src/game/assets/themes/new-derelict/insets/`, plus `insets/README.md` mirroring `eden-prime/insets/README.md`'s structure (style, prompt template, filename/key list, finishing pass, thumbnail validation) per REQ-DERELICT-3/40. Note this departs from how the eden-prime README describes its own set ("final WebP inset art is still out-of-band") — for New Derelict, generation is in scope for this plan, not deferred to a separate manual pass:
- Draft the per-card prompt list first (subject, verb — `isolate` — framing, palette cues) in the README's "Per-card intent" section, one entry per template from 2.2, mirroring `eden-prime/insets/README.md`'s own per-card intent list.
- Invoke `/art-gen:generate-image` once per inset, at `600x600` (per `theme-authoring.md` W2a), passing that card's prompt plus the shared style paragraph (bold graphic-novel linework, chiaroscuro, one large foreground subject, simplified darker background — mirror the shared-style paragraph already in `eden-prime/insets/README.md`). [NOTE: Codex can use image-gen instead of art-gen.]
- Apply the same finishing pass documented in `theme-authoring.md` W2d (contrast `1.12`, brightness `0.99`, unsharp mask radius `1.1`/percent `80`/threshold `4`) to each generated image before saving it as `inset-<kebab-name>.webp`.
- Validate every inset at the `100x100` runtime thumbnail scale (W2a) before wiring keys in 3.3 — regenerate via the same skill invocation if a subject doesn't read clearly at that size, rather than shipping a miss and fixing it later.

**3.3 — Wire asset keys.** Add every backdrop/overlay/cardfront/`derelict-inset-*` import and its `worldAssetUrls` entry to `src/game/worlds/assetBindings.ts`, mirroring the `eden-prime` block exactly. Confirm `assetManifest.ts` needs no direct entries (its `...worldAssetUrls` spread at line 170 should cover it, as it does for Eden Prime's insets) rather than assuming REQ-DERELICT-3/48's dual-registration wording.

**3.4 — Update `.lore/reference/theme-authoring.md`** per REQ-DERELICT-43: add the `isolate` row to the signature-verb table (mirror the `eden-prime`/`startle` row, line 93); add `Lockdown` to the C2 keyword vocabulary paragraph (line 154), noting it's the first **persistent** applied keyword (contrast `Alarm`'s transience); document the persistent effective-cost modifier as a new C1/C3 concept.

**3.5 — Tests.** `src/game/tests/newDerelictPresentation.test.ts` mirroring `edenPrimePresentation.test.ts`: `selectTheme("new-derelict")` returns the right palette/backdrop/cardfront keys; base asset keys resolve in `assetManifest`; every inset key resolves; the insets README exists and documents style/prompt/filenames/finishing-pass/100x100 validation.

## Slice 4 — Full validation

Depends on Slices 1-3.

**4.1** `bun run test` (full suite) — confirms nothing regressed outside New Derelict, especially Eden Prime's `Alarm` behavior, since Slice 1 touches the shared `tickAppliedKeywords`/`appliedKeywords.ts` files.

**4.2** `bun run lint && bun run typecheck && bun run build`.

**4.3 — Seeded gameplay validation (REQ-DERELICT-50).** Add a test (in `newDerelict.test.ts` from 2.6, or `src/sim/tests/`) running two policy lines: one that promptly clears/discards sealing hazards and declines `Emergency Route`, staying at Lockdown count 0-1 through Act 1; one that leaves seals/takes shortcuts, building a cluster whose per-other-Locked tax climbs, then uses `Manual Release`/`Override Badge` to collapse it. `bun run sim` against `new-derelict` is auto-discovered via `worldDataRegistry` by `src/sim/completeness.ts` (per the per-world completeness checker landed in commit #123) — use it to sanity-check both lines before locking in a fixed-seed assertion.

**4.4 — Manual browser smoke test.** Select New Derelict; watch a seal accumulate and confirm a card's *displayed* clear cost climbs in real time — turning `textPenalty` (red) — as a *different* card becomes Locked; this is the one piece of this plan with no automated coverage (the CardView cross-card reactive update from 1.6, though the color-mapping rule itself is unit-tested per 1.7). Then use a release reward and confirm the displayed cost drops back down, turning `textReward` (green) while below the base cost and returning to the default `textCost` color once back at parity.

**4.5 — Close out.** Cross-check the finished implementation against REQ-DERELICT-1..50 (AI Validation section of the spec) and this plan's corrections; update `new-derelict.md`'s status to `implemented`. Housekeeping (outside the New Derelict spec's own scope, but a direct, zero-risk byproduct of this plan's research — see context item 1): correct `eden-prime.md`'s stale `status: draft` to `implemented`, since it fully shipped in commits `bf4d684`/`44e7ba0`.
