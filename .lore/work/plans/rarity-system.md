---
title: "Implementation plan: rarity system"
date: 2026-06-19
status: draft
tags: [plan, rarity, rewards, boons, weighted-draw, determinism, renderer]
modules: [core-engine, card-effects, card-data, game-runtime, table-ui]
related: [.lore/work/specs/rarity-system.md, .lore/work/brainstorm/rarity-system.md, .lore/work/specs/offer-boon-rewards.md, .lore/work/specs/fortune-boon-cards.md, .lore/work/specs/action-impact-preview-and-confirmation.md]
---

# Implementation plan: rarity system

Source spec: [.lore/work/specs/rarity-system.md](../specs/rarity-system.md) (44 requirements, prefix `REQ-RARITY`). Every step below maps to requirement IDs and ends with a validation gate. The final step checks the whole implementation against the spec's AI Validation section.

## Structural decisions settled here

The spec left two structural questions open. This plan settles both so implementation does not guess:

**D1 — One shared named-pool concept (resolves spec Open Question 1).** Boon sets and `GainRandomCard` loot pools are the same shape: a named list of template IDs. The draw reads rarity off each template, so a "pool" carries no rarity data itself. Implementation introduces a single resolver both paths call, rather than a second parallel registry. The existing `BOON_SETS` (`src/data/worlds/boons/fortune.ts`, shape `{ source, templateIds }`) is the seed; loot pools are added to the same registry concept. Rationale: matches the brainstorm's "one generic named-pool lookup," keeps `OfferBoonHandler` and the new `GainRandomCardHandler` reading the same lookup, and avoids drift between two pool stores.

Two implementation caveats for D1:

- **Resolver reach is `OfferBoon` + `GainRandomCard` only, not all three pool paths.** The Fortune act-reward path does not read `BOON_SETS` by `setId` at all — `RunModifiers.actBoon` (`src/data/unlocks/types.ts`) carries `poolId` *and* `poolTemplateIds` directly, and `createActBoonOffer` passes `actBoon.poolTemplateIds` straight into `createBoonOffer`. That pre-existing unlock-configured pass-through is out of scope to unify here; the shared resolver covers `OfferBoonHandler` and `GainRandomCardHandler`, which both resolve by `setId`.
- **Prefer a sibling `LOOT_POOLS` table behind the resolver, not a merged literal.** `BOON_SETS` is typed `as const satisfies Record<string, BoonSetDefinition>` with closed literal keys; trying to merge new pools into that same `as const` object fights the literal-key typing. A separate table that the resolver function unions is the lower-risk shape.

**D3 — `GainRandomCard` must mask its rolled outcome in the action-preview/confirmation layer (added after validating against #89, "Implemented card action preview").** Card action preview (`.lore/work/specs/action-impact-preview-and-confirmation.md`) landed on `master` after this plan was drafted and changes the ground this plan stands on. It added `src/core/view/actionPreview.ts`: hovering or clicking any action now speculatively calls `reduce()` and shows the player the resulting events before they commit — and, per a confirmation mode, a modal **guarantees** that summary is shown. That spec already requires, cross-cuttingly: "Random effects must be summarized as random or uncertain when the exact affected card is not guaranteed to the player" (REQ-ACTIONPREV-24) — the same intent as this plan's REQ-RARITY-31, just enforced one layer up, at the preview/confirmation surface rather than the static card-face `describe`/`compile` text.

  The existing `summarizeEvent` switch in `actionPreview.ts` already complies for `BoonOffered` (`Boon offered from ${event.setName}` — never names the specific offered templates, even though the event carries them) and for `BoonCardGranted` (names the template, but that's fine: the player already saw and chose it from a revealed offer before this action). But its `CardGained` case unconditionally returns `` `Gain ${event.templateId} to ${destLabel(event.dest)}` `` — every existing `CardGained` source (`AddCard`, `GainCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck`, `AddThreatToWorldDeck`) is a fixed, authored template, so naming it is not a spoiler. `GainRandomCard` (Step 6) is the first source where the grant is a genuine blind roll the player has never seen, so without intervention the preview/confirmation would name the exact rolled template (and reveal its rarity) before the player commits to the clearing action — violating REQ-ACTIONPREV-24 and undercutting this plan's own REQ-RARITY-31.

  Resolution: give `CardGained` an optional `setName?: string`, populated only by `GainRandomCardHandler` (the four existing fixed-reward handlers leave it `undefined`), and branch on it in `actionPreview.ts`'s `CardGained` case to emit a generic line instead of naming the template. See Step 6 for the concrete change. This does not touch the shared `gainCard()` helper — `GainRandomCardHandler` post-processes the one event `gainCard()` returns.

**D2 — Author a fresh `GainRandomCard` example; leave identity loot fixed (resolves spec Open Question 2).** We do not convert an identity-loot reward (e.g. `Fire Axe`, `Nitro`) to a roll. Instead we add a small stratified loot pool and point one *generic-reward, cache-style* `onCleared` at `GainRandomCard`. Rationale: the duality (REQ-RARITY-27) exists precisely so world-identity loot stays deterministic; converting identity loot would erase the world's authored payoff. REQ-RARITY-30 needs only one real example.

## Dependency map

<div style="font-family: monospace; line-height: 1.6;">
<div>Step 1 ─ tier model (core)</div>
<div>&nbsp;└─ Step 2 ─ rarity on templates + mint stamping + validation</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;└─ Step 3 ─ weighted-draw kernel ⟨core, pure, heavy tests⟩</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ Step 4 ─ migrate createBoonOffer to kernel ⟨regenerates fixtures⟩</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ Step 5 ─ tier on events ⟨depends on 2⟩</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ Step 6 ─ GainRandomCard effect + shared pool resolver ⟨depends on 3, 5⟩</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ Step 7 ─ world-data example + loot pool ⟨depends on 6⟩</div>
<div>&nbsp;└─ Step 8 ─ Fortune pool stratification ⟨depends on 2⟩</div>
<div>&nbsp;└─ Step 9 ─ renderer tier→visual map + surfacing ⟨depends on 2, 5; Phaser expertise⟩</div>
<div>Step 10 ─ full-suite + lint-boundary + spec validation ⟨depends on all⟩</div>
</div>

Steps 4, 5, 6 can proceed in parallel once 3 lands (5 also needs 2). Steps 8 and 9 are independent of the kernel work and can land any time after 2 (9 also after 5).

---

## Step 1 — Rarity tier model in core

**Requirements:** REQ-RARITY-1, 2, 3, 4, 5.

- New file `src/core/model/rarity.ts`:
  - `export type RarityTier = "common" | "uncommon" | "rare" | "legendary";`
  - An ordered tier list (`RARITY_ORDER`) fixed at `[common, uncommon, rare, legendary]` — the single order used for any cumulative-weight walk (REQ-RARITY-5).
  - `RARITY_WEIGHTS: Record<RarityTier, number>` = `{ common: 60, uncommon: 25, rare: 12, legendary: 3 }` (REQ-RARITY-2).
  - No color/glyph/label here (REQ-RARITY-4); presentation lives in `src/game` (Step 9).
- Export from the core public barrel `src/core/contract.ts` (which `src/core/index.ts` re-exports) so the renderer can import the *type* without reaching into model internals.

**Gate:** new `src/core/tests/rarity.test.ts` asserts the four ordered members, the weight values, and that the module exports no presentation fields. `bun run test` green for the new file; `bun run lint` clean.

## Step 2 — Authored rarity on templates, mint stamping, validation

**Requirements:** REQ-RARITY-6, 7, 8, 10, 43.

- `src/core/model/cards.ts`: add `rarity?: RarityTier` to `BasicCardTemplate` (inherited by `PlayerCardTemplate` and `WorldCardTemplate`).
- `src/core/model/types.ts`: add `rarity: RarityTier` to the `PlayerCard` and `WorldCard` interfaces (always concrete on minted cards, mirroring how `keywords` is always present).
- `mintCard` (`cards.ts`): stamp `template.rarity ?? "common"` onto both minted card shapes (REQ-RARITY-7, 8).
- Catalog validation (REQ-RARITY-10): no general per-field validation exists today (`assembleCatalog` only checks duplicate IDs). Add a focused validation pass — either extend `assembleCatalog` or add a `validateTemplate` step — that rejects a `rarity` value outside `RarityTier`. Throw `CatalogError` for consistency with the existing duplicate-ID check.

**Gate:** `cards.test.ts` — a template without `rarity` mints Common; with an authored tier mints that tier. `catalog.test.ts` — an invalid `rarity` is rejected. Confirm every existing world assembles unchanged (run `world.test.ts`, `worldManifest.test.ts`). `bun run test` green; `bun run lint` clean.

## Step 3 — Weighted-draw kernel (shared, pure)

**Requirements:** REQ-RARITY-11, 12, 13, 14, 15, 16, 17, 18, 19.

- New file `src/core/engine/weightedDraw.ts` exporting one helper, e.g.:
  ```typescript
  function weightedDraw(
    catalog: CardCatalog,
    rng: RngState,
    candidateIds: readonly CardTemplateId[],
    count: number,
  ): { templateIds: CardTemplateId[]; rng: RngState };
  ```
- Algorithm per REQ-RARITY-12/13, for each of `count` slots:
  1. Group remaining candidates by their template rarity; the *present tiers* are those with ≥1 remaining (REQ-RARITY-12).
  2. Renormalize `RARITY_WEIGHTS` over present tiers; weighted roll using one `nextFloat` step, walking the cumulative sum in `RARITY_ORDER` (REQ-RARITY-5, 16).
  3. Uniform pick within the chosen tier using one `nextFloat` step (floor of `value * tierSize`).
  4. Remove the picked template; recompute present tiers next slot (without replacement — a depleted tier drops out, REQ-RARITY-13).
- Distinctness is guaranteed by removal (REQ-RARITY-14). Fewer candidates than `count` yields all of them (REQ-RARITY-15).
- RNG order is fixed and documented: per slot, tier roll consumes before within-tier pick; slots resolve in order (REQ-RARITY-16). Each **resolvable slot** consumes a **fixed two `nextFloat` calls** (one tier roll + one within-tier pick), regardless of how many candidates remain — including the single-candidate case, which still rolls both even though the outcome is forced. The **degenerate empty-pool attempt** (no resolvable slot) must still advance the RNG at least once as a guard (REQ-RARITY-18). This is a deliberate behavior change from today's `createBoonOffer`, where `shuffle` advances by a variable count (`length - 1` swaps, i.e. zero for an empty/single-element array) plus a conditional single-`nextFloat` fallback. Document the fixed-count contract so the determinism tests can assert exact RNG advancement.
- The caller supplies the already-legality-filtered candidate list; the kernel does not know about `exhaust`/`player` rules (REQ-RARITY-19, keeps the kernel reusable).

**Gate:** `src/core/tests/weightedDraw.test.ts` with a deterministic seeded RNG (`createRng`): present-tier renormalization correct; one Legendary among many Commons draws at ≈ Legendary weight (not 1/population) over a fixed sample; without-replacement drops an emptied tier; fewer-than-count returns all distinct; identical seed → identical ordered output; RNG advances for single-candidate and empty pools. `bun run test` green.

## Step 4 — Migrate createBoonOffer to the kernel

**Requirements:** REQ-RARITY-20, 21, 22, 23. Supersedes OFFER-BOON-40, FORTUNE-23 (shuffle wording).

- `src/core/engine/actBoon.ts` `createBoonOffer`: replace the `shuffle(legalIds)` + `slice(0, offeredCount)` block with `weightedDraw(catalog, state.rng, legalIds, offeredCount)`.
- Preserve the existing legality filter (dedup + `template?.kind === "player"`) before calling the kernel, and the always-advance-on-empty behavior (now satisfied inside the kernel, but verify the empty-pool early return still advances RNG).
- Both `source: "act"` (Fortune via `createActBoonOffer`) and `source: "worldClear"` (OfferBoon) inherit this automatically since both route through `createBoonOffer` (REQ-RARITY-20).
- All non-composition guarantees stay (action blocking, `ChooseBoon`, destinations, single-pending, Act-1 suppression) — these live outside `createBoonOffer` and are untouched (REQ-RARITY-21).
- **Fixture regeneration (REQ-RARITY-22):** offered IDs and all downstream RNG draws change for seeds that hit an offer. The seed-pinned offer fixtures live in `src/core/tests/reduce.test.ts` — it hardcodes literal offered-ID arrays for specific seeds (`seed777Offer`, `seed778Offer` at lines 1985-1986 as of `master`@`5044f43`, and standalone `offeredTemplateIds: [...]` expectations at lines 2464, 2536, 2613, 2654, 2677; re-grep before editing, these shift whenever the file changes upstream — the #89 action-preview commit alone moved every one of these by 30-60 lines from this plan's original estimate). Regenerate each by running the seed, capturing the actual offered IDs, and replacing the literal arrays — never hand-patch values. Treat a same-seed twice-identical result as the determinism proof. Note: the file also has an unrelated test helper literally named `offeredTemplateIds(result)` (extracts IDs from emitted events, around line 136) — don't confuse that helper with the `offeredTemplateIds` field being regenerated. Note: `golden.test.ts` (Door-win, Zombie-loss, replay-equivalence) does **not** touch `createBoonOffer` and should remain green untouched; if it diverges, that is a signal something broke beyond offer composition.

**Gate:** `reduce.test.ts` / `effects.test.ts` — Fortune and OfferBoon offers still create a pending choice, block actions, resolve via `ChooseBoon`, honor destinations, fail closed on empty pool. The regenerated `reduce.test.ts` seed-offer arrays pass, with a re-run confirming byte-identical repeat. `golden.test.ts` stays green unchanged. `bun run test` green.

## Step 5 — Tier on events

**Requirements:** REQ-RARITY-32, 32a, 33, 34, 35, 36.

- `src/core/model/types.ts`:
  - `BoonOffered`: add `rarities: readonly RarityTier[]` to **both** union arms (`act` and `worldClear`), index-aligned with `templateIds`, preserving the `source`/`act` discriminated split exactly (REQ-RARITY-32, 32a). Note: as of `master`@`5044f43` (#89, action preview) both arms already carry a `setName: string` field alongside `setId`/`templateIds` — add `rarities` alongside it, don't disturb it. `setName` is authored per-effect-instance (on the `OfferBoon` CardEffect, threaded through `createBoonOffer`/`createActBoonOffer`), not derived from `BOON_SETS`; the D1 pool resolver does not need to resolve it.
  - `CardGained`: add `rarity: RarityTier` (REQ-RARITY-33).
  - `BoonCardGranted`: add `rarity: RarityTier` (REQ-RARITY-34).
- Populate:
  - `actBoon.ts` `createBoonOffer`: build `rarities` from the offered templates' catalog rarity (resolve each `catalog[id].rarity ?? "common"`).
  - `gainCard.ts` `gainCard`: the minted card already carries `rarity` after Step 2 — emit it on `CardGained` (REQ-RARITY-35: event tier === minted-card tier).
  - The `ChooseBoon` resolution path that emits `BoonCardGranted` (locate in `reduce.ts`/boon-grant code): read the minted card's `rarity`.
- Batching/ordering unchanged (REQ-RARITY-36): the offer event stays in the producing dispatch, grant in the resolving dispatch.

**Gate:** event tests assert `BoonOffered.rarities` index-aligns with `templateIds` on both arms with the discriminated split intact; `CardGained`/`BoonCardGranted` carry tier; event tier equals minted-card tier; existing batching tests still pass. `bun run test` green.

## Step 6 — GainRandomCard effect + shared pool resolver

**Requirements:** REQ-RARITY-24, 25, 26, 27, 28, 29, 31; REQ-ACTIONPREV-24 (cross-spec, see D3). Implements D1, D3.

- **Shared pool resolver (D1):** introduce one lookup both paths use. Minimal shape: a `resolvePool(setId): readonly CardTemplateId[] | undefined` over a registry that includes the existing boon sets plus new loot pools. Keep `OfferBoonHandler` and the new handler reading the same resolver. (Implementation may generalize `BOON_SETS` or add a sibling `LOOT_POOLS` that the resolver unions — either satisfies D1 as long as there is a single resolution entry point.)
- `src/core/model/types.ts`: add to `CardEffect` union:
  ```typescript
  | { kind: "GainRandomCard"; setId: string; setName: string; bToDiscard?: boolean }
  ```
  (Default destination is `playerDiscard` to match `GainCard`; `bToDiscard` optional for future flexibility — REQ-RARITY-26. `setName` mirrors `OfferBoon`'s required field of the same name — see D3 for why it's needed: it's the human label the preview layer uses in place of the rolled card's identity, authored per-effect-instance rather than resolved from the pool.)
- `src/core/model/types.ts`: add an optional `setName?: string` to the shared `CardGained` event. Left `undefined` by every existing fixed-reward path (`AddCard`, `GainCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck`, `AddThreatToWorldDeck` — do not touch their call sites); set only by `GainRandomCardHandler` (D3).
- `src/core/effects/gainCard.ts`: add `GainRandomCardHandler`:
  - `apply`: resolve pool → filter legal candidates → `weightedDraw(catalog, state.rng, candidates, 1)` → `gainCard(catalog, state, drawnId, "playerDiscard")`, then map the single returned `CardGained` event to attach `setName: effect.setName`. (Don't add a `setName` parameter to the shared `gainCard()` helper itself — it has four other callers that must keep emitting `CardGained` without it; post-process the handler's own result instead.) The roll happens here at resolution/mint time and the concrete card + tier are revealed via the `CardGained` event to non-preview consumers (REQ-RARITY-25); see D3 for why the preview/confirmation layer must not surface that identity to the player ahead of commit.
  - Fail closed (REQ-RARITY-29): missing pool or no legal candidate → return state with RNG advanced, no card, no crash.
  - `isPlayable(): false` (REQ-RARITY-28).
  - `describe` / `compile`: name the pool and that the reward is randomized — not a specific tier or card (REQ-RARITY-31). Distinct glyph from `GainCard`'s single named reward.
  - No special provenance code needed: `applyEffect` (as of #89) auto-stamps `sourceCardId` on every event from a hook-driven effect (i.e. any effect reached via a card's `onCleared`, which is how this plan's Step 7 example invokes `GainRandomCard`) when `selfId` is set by the caller. The existing concealment masking in `actionPreview.ts` therefore already covers a `GainRandomCard` grant from a concealed world card for free.
- **`src/core/view/actionPreview.ts` (D3, closes the gap left by #89):** the `summarizeEvent` switch's `case "CardGained"` (currently `` `Gain ${event.templateId} to ${destLabel(event.dest)}` `` unconditionally) must branch: when `event.setName` is present, return a generic line such as `` `Gain a random card from ${event.setName}` `` instead of naming the template or its rarity; otherwise keep the existing behavior for fixed grants. This is the concrete fix for REQ-ACTIONPREV-24 / REQ-RARITY-31 at the preview/confirmation surface — without it, hovering or confirming the action that triggers a `GainRandomCard` would name the exact rolled card before the player commits.
- Register `GainRandomCard` in `src/core/effects/registry.ts`.
- Fixed `GainCard` is untouched (REQ-RARITY-27).

**Gate:** `effectRegistry.test.ts` — `GainRandomCard` recognized, described, glyph-compiled, not playable. `effects.test.ts` — on `onCleared`, mints exactly one pool card to `playerDiscard`, emits `CardGained` with tier and `setName`; missing/empty pool fails closed with RNG advanced; fixed `GainCard` still grants its single template with `setName` left `undefined`. `actionPreview.test.ts` — a `GainRandomCard`-sourced `CardGained` is summarized generically (no template name, no rarity) in the preview, while a fixed-reward `CardGained` still names its template; add this case alongside the existing `BoonOffered` coverage. `bun run test` green.

## Step 7 — World-data GainRandomCard example + loot pool

**Requirements:** REQ-RARITY-30. Implements D2.

- Add a small stratified loot pool (3 entries across tiers, e.g. one Uncommon + two Common, or include a Rare) as player-card templates, registered in the pool resolver from Step 6.
- Point exactly one *generic-reward, cache-style* `onCleared` at `{ "kind": "GainRandomCard", "setId": "<pool>", "setName": "<Display Name>" }` (`setName` is required per Step 6's effect shape — pick the label that will show in the masked preview line, e.g. "the cache"). Candidate target: a non-identity reward in an existing world (review `src/data/worlds/*/cards.json` `onCleared` `GainCard` entries; pick one whose specific card is not load-bearing world identity). Do **not** convert `Fire Axe`/`Nitro`-class identity loot (D2).
- Keep existing fixed `GainCard` rewards in place elsewhere.

**Gate:** `worldManifest.test.ts` / `world.test.ts` — the world still assembles; every loot-pool template mints; clearing the chosen card produces a rolled grant. `bun run test` green.

## Step 8 — Fortune pool stratification (alpha pass)

**Requirements:** REQ-RARITY-41, 42.

- In `src/data/worlds/boons/fortune.json` (the source behind `pool-fortune`), stamp the five templates: at least one `uncommon`, at least one `rare`, remainder `common`. No new cards, no balance changes.
- Verify the constraints from the Fortune spec still hold (boon-only, `exhaust: true`, no world-specific loot) — these are unchanged by adding a `rarity` field.

**Gate:** a test confirms `pool-fortune` has ≥1 Uncommon and ≥1 Rare, all templates still `exhaust: true` player cards, and an act-reward offer can surface a non-Common boon (drive the kernel with a seed that selects the higher tier). `bun run test` green.

## Step 9 — Renderer tier→visual map + surfacing (Phaser)

**Requirements:** REQ-RARITY-37, 38, 39, 40. *Specialized: Phaser/renderer expertise.*

- New renderer-only module, e.g. `src/game/view/rarity.ts`: the single `RarityTier → { color, glyph?, label }` map (REQ-RARITY-37). Common grey/bone, Uncommon green, Rare blue, Legendary gold/amber (REQ-RARITY-38). Unknown/missing tier → Common treatment (REQ-RARITY-40).
- Surface in the card face: in `CardView`, draw a rarity frame/border using the minted card's `rarity` (the card already carries it after Step 2). Reuse the existing overlay-rectangle pattern (`highlightRect` is list[1]); add a distinct rarity stroke that does not collide with selection/target highlights.
- Surface in `BoonChoiceView`: color each offered option from the **stamped template rarity**, read off `option.template.rarity` (defaulting to Common via Step 2's mint stamping). This is the path actually wired today — `TableScene.updateBoonChoiceView` builds `BoonChoiceOption[]` from `pending.offeredTemplateIds.map(id => this.game_.template(id))`, reading the catalog, not the event. `BoonOffered.rarities` (Step 5) is **not** consumed by the UI; it exists for non-UI consumers (runtime/replay/analytics). Do not build an event→render bridge — `PendingBoonChoice`/the catalog template already carry everything the view needs. Roll-mode grants color via the minted card on the table (REQ-RARITY-39).
- Core must not import this module (REQ-RARITY-37) — only the `RarityTier` type crosses, from `core/index`.

**Gate:** `cardObjects.test.ts` / `boonChoiceView.test.ts` — each tier maps to a distinct treatment; unknown tier falls back to Common; the rarity stroke coexists with highlight strokes. A lint-boundary check confirms `src/core` has no import of `src/game/view/rarity.ts`. `bun run test` green; `bun run lint` clean (the core/game boundary lint must pass).

## Step 10 — Full-suite, lint boundary, and spec validation

**Requirements:** all; closes the spec's AI Validation section.

- Run `bun run test` (full suite) and `bun run lint` (including the core/game boundary rule) — both green.
- Walk the spec's AI Validation items 1–12 against the implementation; confirm each is satisfied by an existing test or add the missing one.
- Confirm determinism end to end: a full run with a fixed seed replays byte-identically; the `reduce.test.ts` seed-offer arrays are regenerated, not hand-edited.
- **Honest invalidation (REQ-RARITY-44):** confirm what happens to any pre-rarity persisted run/seed. If a save/replay persistence layer exists, ensure a same-seed run that now produces different offers is surfaced (version mismatch / honest invalidation), not silently replayed as if unchanged. If no such persistence exists yet, state that explicitly as the justification — there is nothing to invalidate, and the requirement is satisfied vacuously.
- Spot-check in the running app (per project "fun + correct" gate): clear the Step-7 cache card and a Fortune act transition, confirm rarity colors render on offers and grants. Also hover (and, depending on confirmation mode, click) the action that clears the Step-7 cache card: confirm the preview/confirmation text says something generic like "Gain a random card from the cache" and never names the rolled template or its tier ahead of commit (D3, REQ-ACTIONPREV-24).

**Gate:** every AI Validation item maps to a passing test; full suite and lint green; manual app check confirms colored offers/grants.

---

## Risks and watch-items

- **RNG ordering ripples (Step 4).** Swapping shuffle-then-slice for the two-step kernel changes not just offered IDs but every subsequent RNG draw in a run that hits an offer. The seed-pinned arrays in `reduce.test.ts` will diverge widely; that is expected. The proof of correctness is same-seed reproducibility, not similarity to the old output. (`golden.test.ts` is unaffected — it has no boon-offer path.)
- **Legality filter placement.** The kernel must stay rarity-only and legality-agnostic (REQ-RARITY-19). Keep the `exhaust`/`player` filtering in `createBoonOffer` and the candidate-build in `GainRandomCardHandler`, not in `weightedDraw`, or the helper stops being reusable.
- **Event tier vs minted tier divergence (Step 5).** REQ-RARITY-35 forbids two sources of truth. Always derive the event tier from the same `catalog[id].rarity ?? "common"` (offers) or the minted card's stamped `rarity` (grants); never recompute differently.
- **Boundary lint (Step 9).** The tier→color map is the most likely accidental boundary violation. Only the `RarityTier` type may cross into core; the map stays renderer-side.
- **Pool resolver scope (Step 6/D1).** Keep the resolver a thin single entry point. Resist turning "one shared pool concept" into a larger pool-management refactor — out of scope.
- **Preview/confirmation spoiler (Step 6/D3).** The action-preview system (#89) runs every hover and every confirmation through a real `reduce()` call, so any newly-added effect that reads RNG is, by default, fully revealed to the player before they commit — there is no opt-out at the effect level. `GainRandomCard` is the first effect this plan adds after that system landed; don't add a second one (or a second `CardGained`-shaped reveal) without re-checking `actionPreview.ts`'s `summarizeEvent` switch for the same leak. The `setName`-presence branch in Step 6 is the precedent to follow, not a one-off hack.

## Out of scope (carried from spec)

Per-pool weight overrides, pity/luck modifiers, a fifth tier, effect-magnitude variance, full Fortune/loot rebalance, and removing fixed `GainCard` rewards. None of these are implemented here.
