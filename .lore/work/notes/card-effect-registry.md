---
title: "Implementation notes: card-effect handler registry"
date: 2026-06-13
status: in_progress
tags: [implementation, notes, card-effect, registry, refactor, core]
source: .lore/work/plans/card-effect-registry.md
modules: [core-model, core-engine, core-view, game-interaction]
related: [.lore/work/design/card-effect-registry.md]
---

# Implementation notes: card-effect handler registry

Orchestrated implementation of the card-effect handler registry refactor. Replaces
seven `switch (effect.kind)` statements across five files with one handler class per
`kind`, registered in an exhaustive map.

Branch: `effect-handler-registry` (off `master`).

## Setup findings

- **Token-IR collision is moot.** The researcher warned a `card-effect-token-ir`
  branch was unmerged and would collide on `compileEffect`/`describe.ts`. Verified
  against current master: `effectGlyphs.ts`/`compileEffect` and all other target
  files already exist on master (landed via #56/#57). No collision; proceed.
- **Real test command is `bun run test`** (`bun test --preload ./src/game/tests/testSetup.ts`),
  not bare `bun test`. Gate commands: `bun run typecheck`, `bun run test`,
  `bun run lint`, `bun run build`.
- All 6 `default:` sites confirmed at the plan's line numbers: available.ts (62, 127,
  202, 242), describe.ts (169), feedback.ts (95).
- No prior task files, no `.lore/lore-agents.md`. Roles filled by `general-purpose`
  (implementation/testing/review), with `typescript-quality` skill applied at Steps 2/5/7.

## Progress

<!-- Status: ☐ pending · ◐ in progress · ☑ done -->

- ☑ **Step 1** (Phase 0) — make silent switches fail closed (delete 6 `default:`, enumerate cases)
- ☑ **Step 2** (Phase 1) — scaffold EffectHandler base + EffectContext + EffectResult
- ☑ **Step 3** (Phase 1) — composite handlers (Modal/Sequence) + recursion seam
- ☑ **Step 4** (Phase 1) — DealProgress handlers + HazardTargetingHandler
- ☑ **Step 5** (Phase 1) — registry + dispatcher wiring (GO/NO-GO gate) → **GO**
- ☑ **Step 6** (Phase 2) — migrate remaining leaf kinds, grouped by file
- ☑ **Step 7** (Phase 2) — remove transitional fallback; exhaustive map
- ☑ **Step 8** (Phase 3) — relocate connectorStyle into core; slim feedback.ts
- ☑ **Step 9** — validation against design + browser smoke

## Log

### Init (2026-06-13)
- Read plan + design + frontmatter schema. No existing tasks/notes/agents registry.
- lore-researcher: only plan+design exist for the registry itself; adjacent token-IR
  design is context not a prerequisite; ForceDestroy retro warns deferred effects
  (`pendingForceDestroy`, `skipDrawNext`) split logic into draw.ts/energy.ts — a
  per-kind handler may not capture deferred resolution. Carry as a watch item.
- Created branch `effect-handler-registry`.

### Step 1 — fail-closed (complete)
- Implementer removed `default:` from all 6 switches, enumerated explicit cases. No
  test edits, no behavior change. `CardEffect` union has 24 kinds.
- Reviewer (fresh context) audited every added case against the old default value
  1:1 — all correct. `computeLegalTargets` leaf step-0 body preserved as shared
  fallthrough (not collapsed to `[]`). Noted intentional asymmetry: `DealProgressAll`
  → non-null in `dealProgressOf` but `null` in `selectConnectorStyle` (matches master).
- Gate green both runs: typecheck clean, 613 pass / 0 fail, lint clean.
- Commit: per-step on feature branch (recoverability across the 9-step refactor).
- Commit `fa72ee4`.

### Step 2 — scaffold base + context (complete)
- New: `src/core/effects/{EffectContext.ts, EffectHandler.ts, handState.ts}`.
  EffectContext.ts holds canonical `EffectResult` (moved from energy.ts), `EffectContext`
  (pinned shape w/ `apply` recursion seam), `CompileContext {worldId:string; compactSequences:boolean}`,
  and `ConnectorStyle = 'progress'|'destroy'|'return'`.
- **ConnectorStyle defined in core, not type-imported from game.** eslint `no-restricted-imports`
  blocks even `import type` from `**/game/**` into core (no `allowTypeImports` on the base rule).
  So core defines it; `feedback.ts` imports+re-exports. Pre-stages Step 8.
- `compile` returns `EffectLine` (exported from `view/effectGlyphs.ts:52`).
- **Test count 613→616 explained:** `structural.test.ts` is data-driven — one boundary-check
  case per file under `src/core/`. The 3 new core files add 3 passing cases that themselves
  assert Phaser-freeness. Not a behavior change; no test files edited.
- Reviewer confirmed: helpers verbatim, no `any`/`as never`/casts, base defaults exact,
  HazardTargetingHandler stays abstract. Gate green: typecheck, 616 pass / 0 fail, lint.
- Commit `7ae6ba7`.

### Step 3 — composite handlers + recursion seam (complete)
- New `src/core/effects/composite.ts`: `ModalHandler`, `SequenceHandler`, relocated `effectAtStep`.
  All six concerns ported verbatim from the Modal/Sequence cases. `effectAtStep` re-export stub
  left in feedback.ts (TableScene import swap deferred to Step 8).
- **Recursion seam shape:** `apply` recurses via `ctx.apply`; `compile` via a new `ctx.compile`
  callback added to `CompileContext` (symmetric with `EffectContext.apply`). Modal forces
  `compactSequences:true`; Sequence threads inherited value. Sequence threads only `state` into
  children (`{...ctx, state}`), leaving targeting/selfId intact — matches master.
- **Cycle decision (KEY, validated by reviewer):** `apply`/`compile` are cycle-free (composite
  imports neither registry nor applyEffect). `describe`/`structuralSpec`/`isPlayable` recurse via
  direct imports of the public dispatchers (`describeEffect`; new `structuralSpecOf`/`isPlayableOf`
  wrappers exported from available.ts). After Step 5 this forms `registry→composite→{describe,
  available}→registry` paper cycles. **Verdict: BENIGN** — every cross-module call is call-time
  only, handlers have no fields/constructor, registry only allocates singletons. Safe under ESM
  live-bindings. **Gate-5 trigger (c) NOT tripped** (it concerns the apply→registry cycle, broken
  by ctx.apply). Step 5 must keep describe.ts/available.ts using EFFECTS call-time only.
- structuralSpec discriminants copied verbatim: Modal→`{kind:'modal'}`, Sequence→`{kind:'compound'}`.
- Two private token helpers (`text`/`main`) duplicated into composite.ts (module-private in
  effectGlyphs.ts). Reviewer: accept the dup — pure 2-line constructors, no logic to drift;
  importing them back re-adds the `composite→effectGlyphs` edge the seam avoids. Promote to a
  shared `effects/tokens.ts` only if a third user appears.
- Two verbatim-ported `!` non-null assertions (`steps[0]!`, `s[0]!`); `s[0]!` is guard-safe,
  `steps[0]!` carries master's "empty Sequence invalid by construction" assumption — add a comment
  when next touched.
- Gate green: typecheck, 617 pass / 0 fail (+1 = composite.ts boundary case), lint, build.
- Commit `b1b9e55`.

### Step 4 — DealProgress family (complete, with a correction)
- New `src/core/effects/dealProgress.ts`: relocated `dealProgress()`/`resolveCounter()` (facade
  re-exports them from effects.ts, keeping effects.test.ts unedited) + three handlers.
- **Three-way split (the crux):** DealProgressHandler & DealProgressScaledHandler extend
  HazardTargetingHandler; DealProgressAllHandler extends the BASE directly (it has no player
  target — extending the hazard base would silently regress structuralSpec/legalTargets/
  connectorStyle). Verified against actual available.ts/feedback.ts lines.
- **Reviewer caught two latent divergences** in HazardTargetingHandler (not regressions yet —
  handlers undispatched — but would break when wired). I verified both against master source:
  1. `connectorStyle 'progress'` is **DealProgress-only** in master (`DealProgressScaled`→null).
     The hazard base wrongly gave both 'progress'. **Activates Step 8.**
  2. `legalTargets` master filters DealProgress to tag-matching hazards when `base===0` &&
     `bonus.tag`; the hazard base returned all ids. **Activates Step 5** (computeLegalTargetsForEffect
     is wired there) — would have failed available.test.ts.
- **Fix:** removed `connectorStyle` from HazardTargetingHandler (→ base null); added
  `connectorStyle→'progress'` and the `base===0` tag-filter `legalTargets` override to
  DealProgressHandler ONLY. DealProgressScaled stays pure inherit (master ternary yields undefined
  tag for Scaled → always all ids, matches base). Hazard base now holds exactly the 3 genuinely
  shared behaviors. This is cleaner than the design's assumption (which wrongly treated both as shared).
- dealProgress keeps `(catalog, state,...)` signature, fires onCleared/onPartialClear via public
  `applyEffect` (recursion pin). dealProgress.ts↔effects.ts facade loop is call-time-safe.
- Gate green: typecheck, 618 pass / 0 fail (+1 dealProgress.ts boundary case), lint. Zero test edits.
- Commit `e821d27`.

### Step 5 — registry + dispatcher wiring → GO/NO-GO = **GO** (complete)
- New `src/core/effects/registry.ts`: `EFFECTS` Partial map, 5 migrated kinds (Modal, Sequence,
  DealProgress, DealProgressScaled, DealProgressAll). Step 7 tightens to exhaustive mapped type.
- `applyEffect` (public signature UNCHANGED) builds `EffectContext` once, calls internal
  `dispatch(ctx, effect)`: `h = EFFECTS[kind]; if (h) return h.apply(ctx, effect as never)` else
  fallback switch reading inputs from ctx. `ctx.apply` bound to internal `dispatch` (not public
  wrapper). compileEffect builds CompileContext `{worldId, compactSequences:false, compile:dispatchCompile}`.
- **Gate-5 triggers a/b/c ALL CLEAR.** `as never` confined to exactly 6 dispatcher lines (verified
  by grep — none in any handler body). No second cast. Cycle broken purely by ctx.apply/ctx.compile.
- **EffectContext optional fields** use conditional spread for `exactOptionalPropertyTypes`; reviewer
  verified field-by-field that absent==undefined yields identical `?? default` semantics to master
  (targetId??"" , returnIds??[], choice??0, selfId?[selfId]:[], discardId===undefined guard). No divergence.
- reduce.ts + contract.ts diffs empty. Gate green: typecheck, **619 pass / 0 fail**, lint, build.
- ⚠️⚠️ **STEP-7 TIME BOMB (carry forward):** DealProgress/DealProgressScaled/DealProgressAll handlers'
  `describe`/`compile` are STUBS that delegate to public `describeEffect`/`compileEffect` on their OWN
  node. So Step 5 routes ONLY Modal/Sequence through the describe/compile guards (DealProgress family
  falls through to the switch — identical output, no behavior change). **Step 6 MUST port the real
  prose/token bodies into these 3 handlers (de-stub) BEFORE Step 7 deletes the switch**, else
  `EFFECTS[kind].describe → describeEffect → same handler` = infinite recursion / stack overflow.
  apply side is already real (calls dealProgress, not self) — only describe/compile carry the hazard.
- Commit pending below.

### Step 6 — remaining leaf handlers (complete)
- Added grouped handlers for every remaining kind:
  `damage.ts`, `draw.ts`, `resources.ts`, `gainCard.ts`, `worldCards.ts`, `none.ts`,
  plus shared token constructors in `tokens.ts`.
- De-stubbed DealProgress/DealProgressScaled/DealProgressAll `describe` and `compile`
  before routing those concerns through handlers, avoiding the Step-7 recursion hazard.
- Relocated helper implementations to handler homes and kept `engine/effects.ts` as a facade
  for `dealProgress`, `resolveCounter`, `damage`, `heal`, `gainEnergy`, `gainCard`,
  `destroyInHand`, `returnToActiveWorldDeck`, and `worldThreatByWorldId`.
- Gate green: `bun run typecheck`; targeted effects/available/describe/effectGlyphs tests
  114 pass / 0 fail; `bun run lint`; full `bun run test` 626 pass / 0 fail.

### Step 7 — exhaustive registry + fallback removal (complete)
- `EFFECTS` is now the exhaustive mapped type
  `{ [K in CardEffect['kind']]: EffectHandler<Extract<CardEffect, { kind: K }>> }`.
- Deleted the transitional `effect.kind` fallback switches from `applyEffect`,
  `describeEffect`, `compileEffect`, and available/targeting dispatch.
- Replaced the leaf-target enumeration in `computeLegalTargets` with `effectAtStep`
  for composites and `step === 0` for leaves.
- Verified omission safety by temporarily deleting the `None` registry entry:
  `tsc` failed with TS2741 for the missing required key, then the entry was restored.
- Gate green: `bun run typecheck`, `bun run lint`, `bun run test` 626 pass / 0 fail,
  `bun run build`.

### Step 8 — connector style relocation (complete)
- Added core `connectorStyleOf(effect)` in `effects/registry.ts`; per-kind styles now live
  on handlers (`DealProgress`, `DestroyCardInHand`, `ReturnWorldCards`) with composite
  recursion in the core dispatcher.
- Slimmed `src/game/interaction/feedback.ts` to ring math, connector geometry, and type
  re-export; removed `selectConnectorStyle` and the `effectAtStep` re-export.
- Updated `TableScene` to import `effectAtStep` from core composite handlers and
  `connectorStyleOf` from the core registry.
- Moved connector-style and `effectAtStep` assertions from `feedback.test.ts` to
  new `src/core/tests/effectRegistry.test.ts` (the sanctioned Step-8 test move).
- Gate green: `bun run typecheck`, `bun run lint`, `bun run test` 627 pass / 0 fail,
  `bun run build`.

### Step 9 — final validation (complete)
- `rg "switch \\(effect.kind\\)|selectConnectorStyle|default:" src/core src/game` shows no
  leftover effect-kind dispatcher switches; the remaining `switch (effect.kind)` is
  `dealProgressOf` in `describe.ts`, intentionally kept as the progress-lookahead helper.
- `git diff -- src/core/contract.ts src/data` is empty: public contract and JSON data are unchanged.
- Protected test-file diff shows only the sanctioned `feedback.test.ts` relocation; no edits to
  `effects.test.ts`, `available.test.ts`, `describe.test.ts`, or `effectGlyphs.test.ts`.
- Browser smoke: `bun run dev -- --host 127.0.0.1 --port 5174` and headless Chromium with
  SwiftShader rendered the Phaser world-select screen to `/tmp/shattered-worlds-smoke3.png`.
- Final gate green: `bun run typecheck`, `bun run test` (627 pass / 0 fail),
  `bun run lint`, `bun run build`.
