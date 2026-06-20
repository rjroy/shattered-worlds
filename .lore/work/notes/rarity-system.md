---
title: "Implementation notes: rarity system"
date: 2026-06-19
status: complete
tags: [implementation, notes, rarity, rewards, boons, weighted-draw]
source: .lore/work/plans/rarity-system.md
modules: [core-engine, card-effects, card-data, game-runtime, table-ui]
---

# Implementation notes: rarity system

Orchestrating implementation of `.lore/work/plans/rarity-system.md` (44 requirements, prefix `REQ-RARITY`). No existing task breakdown or prior partial implementation found (confirmed via lore-researcher). No `.lore/lore-agents.md` registry exists — all roles (implementation, testing, review) use `general-purpose`.

Note: the plan file had an uncommitted local edit (decision D3) reconciling against PR #89's action-preview system, already present in the version read for this implementation.

## Progress

- [x] Step 1 — Rarity tier model in core
- [x] Step 2 — Authored rarity on templates, mint stamping, validation
- [x] Step 3 — Weighted-draw kernel
- [x] Step 4 — Migrate createBoonOffer to the kernel
- [x] Step 5 — Tier on events
- [x] Step 6 — GainRandomCard effect + shared pool resolver
- [x] Step 7 — World-data GainRandomCard example + loot pool
- [x] Step 8 — Fortune pool stratification
- [x] Step 9 — Renderer tier→visual map + surfacing
- [x] Step 10 — Full-suite, lint boundary, spec validation

## Log

(updated after each phase)

### Step 1 — Rarity tier model in core

- Implemented `src/core/model/rarity.ts` (`RarityTier`, `RARITY_ORDER`, `RARITY_WEIGHTS`), re-exported via `src/core/contract.ts`. New test `src/core/tests/rarity.test.ts`.
- Independent test pass: full suite 1049 pass/0 fail, lint clean, module-surface check confirms no presentation fields leaked.
- Independent review pass: no non-conformances against REQ-RARITY-1..5; matches sibling `keywords.ts` convention; core/game boundary respected.
- No divergences from plan.

### Step 2 — Authored rarity on templates, mint stamping, validation

- `BasicCardTemplate.rarity?`, required `rarity` on minted `PlayerCard`/`WorldCard`, `mintCard` stamps `template.rarity ?? "common"`, `assembleCatalog` rejects invalid rarity via `CatalogError` (matches existing duplicate-ID error style).
- Discovered fallout: making `rarity` required on `PlayerCard`/`WorldCard` broke `tsc --noEmit` across ~11 test files constructing card literals directly; fixed by adding `rarity: "common"` to each. Also updated `src/game/view/BoonChoiceView.ts`'s `previewCardFromTemplate` (a second, render-only template→card constructor) to stamp rarity identically to `mintCard`, confirmed no divergent default-rarity logic introduced.
- Independent test pass: full suite 1055 pass/0 fail, lint clean, `tsc --noEmit` clean; confirmed via `grep` that zero production world JSON authors `rarity` yet, so existing worlds prove the silent-default-to-common path end to end.
- Independent review pass: REQ-RARITY-6/7/8/10/43 all satisfied; `BoonChoiceView.ts` change is render-only, no boundary violation, no state-truth duplication.
- No divergences from plan; `bun run typecheck` confirmed as the right tool to catch required-field fallout (test runner alone doesn't typecheck).

### Step 3 — Weighted-draw kernel

- `src/core/engine/weightedDraw.ts`: `weightedDraw(catalog, rng, candidateIds, count) -> { templateIds, rng }`. Two nextFloat calls per resolvable slot (tier roll + within-tier pick), one guard call on empty pool, no legality filtering inside. 9 tests in `weightedDraw.test.ts`, including RNG-call-count verification by re-deriving expected rng state independently.
- Independent test pass: algorithm verified line-by-line against contract, statistical tests confirmed non-flaky (8 repeated runs, deterministic), RNG-count tests confirmed to be real (not shape-only).
- Independent review pass: matches codebase RNG-function conventions (immutable inputs, fresh state threading), no boundary/complexity issues.
- Finding from test pass: kernel has no defense against duplicate ids in `candidateIds` (skews probability) or catalog-missing ids (silently default to common). Decision: this is an intentional precondition, not a bug — callers (existing `createBoonOffer` legality filter, future `GainRandomCardHandler`) already guarantee a deduped, legality-filtered list; per project standards we don't add defensive validation for caller-guaranteed preconditions. Resolved by adding a precondition doc-comment to `weightedDraw.ts` rather than new logic. No further action needed.
- No other divergences from plan.

### Step 4 — Migrate createBoonOffer to the kernel

- `actBoon.ts`'s `createBoonOffer` now calls `weightedDraw` instead of shuffle+slice+manual-empty-guard; existing legality filter (dedup, `kind === "player"`) untouched, runs before the kernel call. Both `source: "act"` and `source: "worldClear"` inherit automatically via shared `createBoonOffer`.
- Regenerated `reduce.test.ts` fixtures by running the actual code: `seed777Offer` → `["Clear Path","Found Tool","Second Wind"]`, `seed778Offer` → `["Steady Nerve","Clear Path","Second Wind"]`. Confirmed byte-identical across repeated runs (determinism proof), not hand-derived.
- Independent test pass: re-derived both fixture values independently via throwaway repro, matched exactly; full suite 1066-1071 pass/0 fail; `golden.test.ts` untouched and green (no RNG leak outside offer composition); lint clean.
- Independent review pass: REQ-RARITY-20/21/22/23 satisfied; no non-composition logic touched; dead `shuffle`/`nextFloat` imports correctly removed from `actBoon.ts` (still used elsewhere); empty-pool RNG-advance guarantee now lives in the kernel rather than the caller (noted as a future-maintenance consideration, not a defect).
- No divergences from plan.

### Step 5 — Tier on events

- `BoonOffered` gets `rarities: readonly RarityTier[]` on both arms (index-aligned with `templateIds`, built in `actBoon.ts` from `catalog[id]?.rarity ?? "common"`). `CardGained`/`BoonCardGranted` get concrete `rarity: RarityTier`, populated in `gainCard.ts`/`reduce.ts` by reading directly off the minted card object (single source of truth, REQ-RARITY-35 verified).
- Independent test pass: full suite 1066 pass/0 fail, lint/typecheck clean, confirmed index-alignment and single-source-of-truth by inspection; confirmed no event-ordering/batching changes.
- Independent review pass: REQ-RARITY-32/32a/33/34/35/36 satisfied; noted (not a defect) that `actBoon.ts`'s diff for this step is intertwined with Step 4's prior weighted-draw swap since both touch the same function — correctly scoped.
- Follow-up: a newly-added line in `actBoon.ts` exceeded the repo's prettier print width (project has no prettier config/script, so this wasn't lint-blocking, but fixed via `npx prettier --write` scoped to that one file only). Tests/lint reconfirmed green after.
- No other divergences from plan.

### Step 6 — GainRandomCard effect + shared pool resolver

- D1 resolver: new `src/core/effects/pools.ts` (`LOOT_POOLS` sibling table + `resolvePool(setId)` unioning it with `BOON_SETS`); `OfferBoonHandler` refactored to call it instead of reading `BOON_SETS` directly, behavior unchanged.
- D3 masking: `CardGained` gains optional `setName?: string` (set only by the new handler); `actionPreview.ts`'s `summarizeEvent` branches on its presence to emit `"Gain a random card from ${setName}"` instead of naming the rolled template/rarity, following the existing `BoonOffered` masking precedent.
- New `GainRandomCard` effect + `GainRandomCardHandler` in `gainCard.ts`: rolls one card via `weightedDraw`, delegates minting to the existing unmodified `gainCard()` helper, fails closed (RNG still advances) on unresolvable pool or no legal candidates, `isPlayable() === false`. `GainCard` untouched (REQ-RARITY-27 duality intact).
- Compiler-forced exhaustive-switch arms added in `effectiveCards.ts` (`cloneEffect`) and `describe.ts` (`dealProgressOf`) — both sensible analogs to sibling effects.
- Independent test pass: fail-closed/RNG-advance verified via throwaway repro; `gainCard()` confirmed unmodified; masking test confirmed to check real content (no template/rarity leak), not just non-crash.
- Independent review pass found two real gaps, both fixed in a follow-up cycle: (1) glyph was reusing `GainCard`'s `"addCard"` icon instead of being distinct per the plan's own Step 6 text — fixed by adding a new `IconId` `"randomCard"`, wired through `effectTooltips.ts`/`effectLineLayout.ts`/its test fixture, with a placeholder texture (no art asset yet, same fallback convention as other un-arted icons). (2) Duplicated legality-filter loop between `createBoonOffer` and `GainRandomCardHandler` — extracted into shared `filterLegalPlayerCandidates(catalog, templateIds)` in `weightedDraw.ts`, called from both sites, confirmed pure extraction (no behavior change).
- Re-verified after fixes: full suite green 3x in a row, lint/typecheck clean, `GainCard`'s own glyph confirmed unchanged (regression check).
- **Discovered issue (out of scope, logged not fixed):** a pre-existing circular import between `src/core/effects/registry.ts` and `composite.ts` (`registry.ts` imports `ModalHandler`/`SequenceHandler` from `composite.ts`, which imports `EFFECTS` back) causes a deterministic `ReferenceError` when certain narrow test-file subsets are run in isolation (confirmed reproducible, load-order-dependent, not flaky). Does NOT affect canonical `bun run test` (full suite passes consistently) — the full suite's incidental file-load order is safe today, but this is fragile to future test-file additions/reorganization or CI sharding. Predates this plan's work (confirmed by reverting Step 6 changes and reproducing the same issue). Flagging to the user; recommend a follow-up ticket to break the cycle, not part of this plan's scope.

### Step 7 — World-data GainRandomCard example + loot pool

- Chose `fog-beach-party`'s "Abandoned Cooler" `onCleared` (was `GainCard` → `Barricade`, a universal starter card with no world-specific identity) over any `Fire Axe`/`Nitro`-class identity loot, all of which were left untouched (confirmed scoped to exactly one world file via `git diff --stat`).
- New loot pool `fog-cooler-loot-v1` (registered in `pools.ts`'s `LOOT_POOLS`): `Half-Melted Ice` (common, GainLight 2), `Cooler Snack` (common, Heal 2), `Tide Pool Find` (uncommon, DealProgress 1 + Hidden bonus 2) — authored directly in `fog-beach-party/cards.json` since loot-pool cards are ordinary world player cards already merged by `worldManifest.ts`, unlike `BOON_SETS`' world-independent templates which need a paired `RawCardSource`.
- `onCleared` now `{ "kind": "GainRandomCard", "setId": "fog-cooler-loot-v1", "setName": "the cooler" }` — masked preview reads "Gain a random card from the cooler".
- Independent test pass: confirmed templates well-formed and power-scaled consistent with sibling cards (e.g. matches `Flashlight`/`Med Kit`/`Baseball Bat` magnitudes); confirmed `lootPoolSetRefs` test walker is generic across all worlds, not hardcoded; confirmed the seeded `applyEffect` test drives the real "Abandoned Cooler" `onCleared` field, not a disconnected repro; full suite 1087 pass/0 fail, no regression in other worlds.
- Independent review pass: D2 candidate choice judged well-reasoned (arguably the most defensible generic-reward candidate in the codebase); rarity stratification real (2 common + 1 uncommon); registration-location divergence from `BOON_SETS` judged deliberate and documented, not accidental inconsistency.
- No divergences from plan.

### Step 8 — Fortune pool stratification

- `src/data/worlds/boons/fortune.json` rarity stamped on all 5 templates: `Lucky Break`/`Second Wind`/`Found Tool` = common, `Steady Nerve` = uncommon, `Clear Path` = rare (3-step Sequence vs. flat single-stat commons vs. an 8-card-ceiling `ReturnWorldCards` outlier — judged a defensible power-tier read, not arbitrary). No cost/effect/keyword change; confirmed via `git diff` showing only added `rarity` lines. All 5 remain `kind: "player"`, `exhaust: true` (Fortune's boon-only/no-identity-loot constraints intact).
- New tests in `reduce.test.ts`: a "Fortune pool stratification" describe block (uncommon/rare presence + exhaust regression) and a seed-3 act-reward test asserting an exact non-Common offer (`["Steady Nerve","Second Wind","Clear Path"]` / `["uncommon","common","rare"]`).
- Second regeneration of the seed-777/778 `reduce.test.ts` fixtures (first regenerated in Step 4 for the kernel migration; this stratification shifts the same seeds' weighted outcome again since `weightedDraw` reads real tiers off Fortune's templates for the first time): seed 777 → `["Found Tool","Steady Nerve","Second Wind"]`, seed 778 → `["Found Tool","Second Wind","Lucky Break"]`. Comment added explaining the second regeneration; captured by running the seeds, not hand-patched.
- Independent test pass: rarity assignments, exhaust/kind regression, and both seed-3/seed-777/778 outputs independently re-derived twice each (determinism confirmed); full suite 1090 pass/0 fail; lint/typecheck clean; `golden.test.ts` confirmed untouched and unaffected (no boon-offer path).
- Independent review pass: REQ-RARITY-41/42 satisfied; rarity judgments defensible; Fortune's original constraints unchanged; fixture-regeneration discipline (comment + actually-run capture) confirmed for the second regeneration; seed-3 test confirmed to assert exact values, not a loose non-Common check.
- No divergences from plan.

### Step 9 — Renderer tier→visual map + surfacing (Phaser)

- New `src/game/view/rarity.ts`: `RarityTier → {color, glyph?, label}` map. Common=`0x9a958c` (grey/bone), Uncommon=`0x4caf50` (green), Rare=`0x4a90d9` (blue), Legendary=`0xe0a526` (gold/amber); `rarityStyle()` falls back to Common for `undefined` or any value outside the known tier set (REQ-RARITY-40).
- `CardView.ts`: new always-visible `rarityRect` (separate `Phaser.GameObjects.Rectangle`, stroke set once at construction from `card.rarity`) confirmed genuinely independent of the existing `highlightRect` (only the latter is ever mutated by `applyHighlight`) — both coexist without collision (REQ-RARITY-37).
- `BoonChoiceView.ts`: rarity coloring flows through the catalog template (`option.template.rarity` via the existing `previewCardFromTemplate`), never through `BoonOffered.rarities` — confirmed via grep that no rendering code reads the event field (REQ-RARITY-39). Roll-mode (`GainRandomCard`) grants color identically since `gainCard()`'s minted card flows through the same `CardView` constructor.
- Core/game boundary intact: only the `RarityTier` type crosses from `core/contract.ts` into `rarity.ts`; zero references to `game/view/rarity` anywhere in `src/core` (REQ-RARITY-37). `bun run lint`'s boundary rule passes.
- New tests in `cardObjects.test.ts` ("CardView rarity stroke", 5 tests) and `boonChoiceView.test.ts` ("rarity coloring", 2 tests) — both independently confirmed to assert real distinct colors and genuine coexistence (highlight changes color while rarity stroke stays fixed), not shape-only checks.
- Independent test pass: full suite 1097 pass/0 fail, lint/typecheck clean; all color values, fallback logic, and stroke independence verified by direct code reading, not just re-running the same commands.
- Independent review pass: REQ-RARITY-37/38/39/40 all satisfied; one minor non-blocking note that Legendary gold (`0xe0a526`) sits conceptually close to an existing world theme's selection/playable gold (`0xffe066`) though still pairwise-distinct (~92 RGB distance) — not treated as a defect.
- **Noted (not a defect):** the implementer's own summary mischaracterized `BoonChoiceView.ts`'s change as "no logic change needed." Both independent agents found this inaccurate — two lines (`rarity: template.rarity ?? "common"`) were in fact added to `previewCardFromTemplate`, necessary because `Card.rarity` became a required field. The code change itself is correct, minimal, and exactly what the plan called for; only the implementer's self-report description was misleading. No fix required.
- No divergences from plan requiring escalation.

### Step 10 — Full-suite, lint boundary, spec validation

Two parallel agents ran: one executed the gate mechanics, one ran a full holistic 44-requirement pass against the plan and spec (the skill's mandatory "Validate" phase, combined with Step 10's own gate since they overlap heavily).

- `bun run test` 1097 pass/0 fail (40922 expect() calls, 62 files); `bun run lint` clean (core/game boundary rule live and passing); `bun run typecheck` clean — all independently re-run, not trusted from prior steps.
- Spec's AI Validation items 1-12: all mapped to specific named tests. Item 10 (renderer map not imported by core) was initially flagged by one agent as having "no dedicated test, only the generic eslint rule" — resolved as a false alarm: `src/game/tests/structural.test.ts` (predates this feature, written for an earlier `REQ-FEEDBACK-11`) already asserts every file under `src/core` imports neither `src/game` nor `phaser`, a blanket rule that subsumes the narrower rarity-specific check. No new test needed.
- End-to-end determinism re-proven fresh (not assumed from earlier steps): a real run (world seed 30/policy seed 1 in one pass, world seed 100 in the other agent's pass) was found that exercises both a pick-mode `BoonOffered` and a roll-mode `GainRandomCard`→`CardGained` in the same playthrough, run twice, byte-identical events and final state both times.
- REQ-RARITY-44 (honest invalidation): vacuously satisfied. No save/replay-from-seed mechanism exists anywhere in the codebase — the one persisted `seed` field (`RunRecord` in `runStats.ts`/`runHistory.ts`) is forensic metadata only, never read back to reconstruct or replay a run. Confirmed independently by two separate agents tracing every `createWorld` call site.
- Full 44-requirement pass (REQ-RARITY-1 through 44): all satisfied. Cross-cutting check confirmed every card-minting effect kind routes through `mintCard` or the shared `gainCard()` helper, both unconditionally rarity-stamping — no bypass path exists. D1 (`resolvePool`), D2 (fresh loot pool), and D3 (`CardGained.setName` masking) all confirmed followed consistently everywhere they apply, not just at their first introduction; D3 specifically re-verified by tracing every `actionPreview.ts` consumer of `CardGained` and confirming a real test (`actionPreview.test.ts`) asserts none of the Fortune pool's template names leak into masked preview text.
- A claimed stray scratch file (`tmp-determinism-check.ts` at repo root) from one agent's own determinism repro was checked and confirmed NOT present — already cleaned up, false alarm in the agent's self-report.
- No divergences from plan; no findings required routing back to implementation.

## Discovered issues (out of scope, flagged not fixed)

- **Pre-existing circular import** between `src/core/effects/registry.ts` and `composite.ts` (discovered during Step 6): causes a deterministic `ReferenceError` when certain narrow test-file subsets are run in isolation/out of the canonical full-suite order. Confirmed to predate this plan's work. Does not affect `bun run test`'s actual invocation today (full suite passes consistently), but is fragile to future test reorganization or CI sharding changes. Recommend a follow-up ticket to break the cycle; explicitly not part of this plan's scope.
