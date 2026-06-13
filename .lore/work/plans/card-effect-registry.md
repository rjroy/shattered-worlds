---
title: "Implementation plan: card-effect handler registry"
date: 2026-06-13
status: draft
tags: [plan, card-effect, refactor, registry, exhaustiveness, core]
modules: [core-model, core-engine, core-view, game-interaction]
related: [.lore/work/design/card-effect-registry.md, .lore/work/design/card-effect-token-ir.md]
---

# Implementation plan: card-effect handler registry

## Goal

Replace the seven `switch (effect.kind)` statements scattered across five files
with **one handler class per `kind`**, registered in an exhaustive map and
dispatched by `effect.kind`. Effect *data* stays plain JSON in `GameState`; only
the *behavior* becomes a class.

Source artifact: [.lore/work/design/card-effect-registry.md](../design/card-effect-registry.md).
Validation at the end checks the implementation against that design's Design
section and the "Does not buy / out of scope" list.

## Success criteria (from the design)

1. Adding a new effect kind touches **one handler file + one registry line**, and
   omitting any concern is a **compile error** (no silent `default:`).
2. The public surface is unchanged: `applyEffect`, `describeEffect`,
   `compileEffect`, `availableActions`, `previewPlay`, and everything re-exported
   from `src/core/contract.ts` keep their names and signatures. `contract.ts` is
   not edited.
3. All existing effect tests pass with only the **two sanctioned edits** below;
   every other test is **unedited** (≈2,659 lines across `effects.test.ts`,
   `available.test.ts`, `describe.test.ts`, `effectGlyphs.test.ts`,
   `feedback.test.ts`). A test that needs editing beyond these two is a signal
   behavior changed — stop and investigate, do not "fix the test."
   - **Sanctioned edit A (Step 8):** `feedback.test.ts` connector-style cases move
     to a core test, following the code that relocated.
   - **Sanctioned edit B — or avoid it entirely:** `effects.test.ts:2-10` and
     `world.test.ts:3` import helpers (`dealProgress`, `damage`, `gainCard`,
     `destroyInHand`, `resolveCounter`, `returnToActiveWorldDeck`) **by name from
     `../engine/effects`**. Step 6 relocates those helpers. The preferred fix is
     the **re-export facade** (pinned decision below), which keeps both test files
     unedited; if the facade is rejected, updating these two import lines is the
     fallback and counts as the second sanctioned edit.
4. The `core` lint boundary holds: nothing under `src/core/effects/` imports
   Phaser. `connectorStyle` ends up in core.
5. `bun run typecheck`, `bun test`, `bun run lint`, and `bun run build` are all
   green at every step boundary.

## Pinned implementation decisions

These are detail-level choices the design left open. Pinned here so
implementation does not guess; revisit only if a step proves one wrong.

- **`EffectContext` shape.** A single object replacing the positional
  `(catalog, state, action?, selfId?)` args of today's `applyEffect`:
  ```ts
  interface EffectContext {
    catalog: CardCatalog
    state: GameState
    // Pre-extracted targeting from the PlayCard action (undefined for
    // onDiscarded / onCleared / onEndOfTurn hooks that take no player input).
    targetId?: CardId
    returnIds?: readonly CardId[]
    destroyIds?: readonly CardId[]
    discardId?: CardId
    choice?: number
    // The world card whose hook is firing, for DestroySelf.
    selfId?: CardId
    // Recursion seam for composites — see Step 3. Bound to the dispatcher so
    // handler modules never import registry.ts.
    apply(ctx: EffectContext, effect: CardEffect): EffectResult
  }
  ```
  The `action?: Action` → field-extraction that `applyEffect` does today
  (`const play = action?.type === "PlayCard" ? action : undefined`) moves to the
  dispatcher, which builds the `EffectContext` once.
- **`EffectResult` unification.** Delete the duplicate local
  `type EffectResult` in `effects.ts`; the canonical
  `interface EffectResult { state; events }` (today in `energy.ts:8`) moves to
  `src/core/effects/EffectContext.ts` and both `energy.ts` and the handlers
  import it. `StartTurnResult extends EffectResult` is unaffected.
- **`effectAtStep` stays a navigation helper, not a handler method.** It answers
  "which child effect runs at step N of a Sequence/Modal" — a composite-structure
  question, not per-kind behavior. It moves into core beside the composite
  handlers (`src/core/effects/composite.ts`, re-exported from
  `src/core/view/feedback`/index as needed) and `TableScene` imports it from
  there. The new core dispatcher `connectorStyleOf(effect)` replaces the direct
  `selectConnectorStyle` call; `TableScene` calls
  `connectorStyleOf(effectAtStep(card.effect, step))`. **Pin:** during Step 3,
  leave a re-export of `effectAtStep` at its old `feedback.ts` path so nothing
  breaks mid-migration; delete that stub in Step 8 when `TableScene` switches to
  the core import. (Not an either/or — both the stub now and the import swap in
  Step 8.)

- **`effects.ts` keeps a re-export facade for its relocated helpers.** When
  `dealProgress`, `resolveCounter`, `damage`, `heal`, `gainCard`, `gainEnergy`,
  `destroyInHand`, `returnToActiveWorldDeck`, and `worldThreatByWorldId` move to
  their handler files (Step 6), `effects.ts` re-exports them
  (`export { dealProgress } from "./effects/dealProgress"`, etc.). This keeps the
  `effects.test.ts` and `world.test.ts` imports (Success Criterion 3, edit B)
  compiling unedited, and keeps the helpers' single definition in their handler
  file. The facade is a deliberate, documented seam, not dead code; it can be
  retired in a later cleanup once tests import from the new paths.

- **`dealProgress`'s internal recursion uses the public `applyEffect`, not
  `ctx.apply`.** `dealProgress` fires `onCleared` / `onPartialClear` via
  `applyEffect(catalog, current, hazard.onCleared)` today (`effects.ts:76,82`).
  After relocation it remains a standalone helper with a `catalog`/`state`
  signature (no `ctx`), so it keeps calling the **public** `applyEffect` wrapper,
  which rebuilds a fresh `EffectContext` each call. This is intentional and
  correct — the public wrapper is the context-construction seam. Only the
  *composite* handlers (Modal/Sequence) use `ctx.apply`, because only they must
  avoid the `registry.ts` import cycle. `DealProgressAll`'s `apply` has the same
  property (it calls `dealProgress` in a loop). Do **not** try to thread `ctx`
  into `dealProgress`.
- **`compile` context.** The handler's `compile(effect, ctx)` takes
  `ctx = { worldId, compactSequences }` plus a compile-recursion callback, mirroring
  today's private `compile(effect, { compactSequences }, worldId)`. The
  join-vs-split budget logic stays in the `Sequence` handler (it is composition,
  not a leaf concern).

## Step sequence

<div style="font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.5; border: 1px solid #444; border-radius: 8px; padding: 14px 16px; background: #16161c; color: #d6d6dd;">
  <div style="margin-bottom: 10px;"><b style="color:#f0c674;">PHASE 0 — fail-closed (independent, ships alone)</b></div>
  <div>① Delete 5 <code>default:</code> clauses &nbsp;<span style="color:#7fb37f;">▣ typecheck forces missing cases · tests green</span></div>
  <div style="margin: 10px 0 4px;"><b style="color:#8fb4f0;">PHASE 1 — prove the pattern</b> &nbsp;<span style="color:#888;">(depends on ①)</span></div>
  <div>② Scaffold <code>EffectHandler</code> base + <code>EffectContext</code> + <code>EffectResult</code> &nbsp;<span style="color:#7fb37f;">▣ typecheck</span></div>
  <div>③ <code>composite.ts</code>: Modal + Sequence handlers + recursion seam &nbsp;<span style="color:#888;">(depends on ②)</span></div>
  <div>④ <code>dealProgress.ts</code> + <code>HazardTargetingHandler</code> &nbsp;<span style="color:#888;">(depends on ②)</span></div>
  <div>⑤ Registry + wire all 4 dispatchers; <b>old switches still cover unmigrated kinds via fallback</b> &nbsp;<span style="color:#888;">(depends on ③④)</span> &nbsp;<span style="color:#7fb37f;">▣ full suite green — the go/no-go gate</span></div>
  <div style="margin: 10px 0 4px;"><b style="color:#b48ff0;">PHASE 2 — migrate the rest</b> &nbsp;<span style="color:#888;">(depends on ⑤)</span></div>
  <div>⑥ Migrate remaining leaf kinds, group by file &nbsp;<span style="color:#7fb37f;">▣ each group: typecheck + targeted tests green</span></div>
  <div>⑦ Remove the transitional fallback; registry is sole authority &nbsp;<span style="color:#7fb37f;">▣ mapped type now exhaustive — omission = compile error</span></div>
  <div style="margin: 10px 0 4px;"><b style="color:#e08fb0;">PHASE 3 — relocate connectorStyle</b> &nbsp;<span style="color:#888;">(depends on ⑦)</span></div>
  <div>⑧ <code>connectorStyle</code> → core handlers; slim <code>feedback.ts</code> to geometry &nbsp;<span style="color:#7fb37f;">▣ lint boundary + TableScene render</span></div>
  <div style="margin: 10px 0 4px;"><b style="color:#9fd0a0;">VALIDATION</b></div>
  <div>⑨ Cross-check against design; full gate + manual browser smoke &nbsp;<span style="color:#7fb37f;">▣ typecheck · test · lint · build · play</span></div>
</div>

> Legend: <span style="color:#7fb37f;">▣</span> = validation gate that must pass before the step is done.

---

### Step 1 — Phase 0: make the silent switches fail closed

**Independent of everything else. Do first; it is shippable on its own.**

Remove the `default:` clause from each fail-open switch and add the cases the
compiler then demands. After this step every effect-kind switch is exhaustive, so
the *current* code already gains the safety the registry will preserve.

Files and functions:
- `src/core/engine/available.ts`
  - `structuralSpec` (`default: return { kind: "none" }`, ~line 62) — enumerate
    the remaining kinds; most map to `{ kind: "none" }`, written explicitly.
  - `isPlayable` (`default: return false`, ~line 127) — the dangerous one;
    enumerate every kind so a new one cannot silently become unplayable.
  - `computeLegalTargetsForEffect` (`default: return []`, ~line 202).
  - `computeLegalTargets` (~line 242) — this one's `default:` is a *leaf
    fall-through* (step-0 logic), not a no-op. Convert the explicit no-target
    cases into `case`-fallthrough that share the existing step-0 body, then drop
    `default:` so new kinds must be classified as composite-vs-leaf deliberately.
- `src/core/view/describe.ts`
  - `dealProgressOf` (`default: return null`, ~line 169) — list the non-progress
    kinds explicitly returning `null`.
- `src/game/interaction/feedback.ts`
  - `selectConnectorStyle` (`default: return null`, ~line 95).

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 1:</b> <code>bun run typecheck</code> compiles (proves exhaustiveness — TS errors on any unlisted kind during editing, none remain after). <code>bun test</code> fully green (behavior identical — every added case reproduces the old default's value). <code>bun run lint</code> clean.
</div>

> Note: Step 1 changes no behavior — each new explicit case returns exactly what
> the deleted `default:` returned for those kinds. The win is purely that the
> *next* kind cannot be forgotten.

---

### Step 2 — Phase 1: scaffold the base class and context

Create `src/core/effects/` and the shared types. No behavior moves yet.

- `src/core/effects/EffectContext.ts` — `EffectContext` (pinned shape above),
  `EffectResult` (moved from `energy.ts`; update `energy.ts` to import it),
  `CompileContext` (`{ worldId; compactSequences }`).
- `src/core/effects/EffectHandler.ts` — the abstract `EffectHandler<E>` base with
  abstract `apply` / `describe` / `compile` and default
  `structuralSpec` / `isPlayable` / `legalTargets` / `connectorStyle`, exactly as
  in the design's §1. Plus the `HazardTargetingHandler<E>` intermediate base.
  Move the small shared helpers it needs (`worldCardsInHand`,
  `playerCardsInHand`) from `available.ts` into a `src/core/effects/handState.ts`
  and re-import them in `available.ts` to avoid duplication.

> **Specialized expertise (TypeScript).** The generic base + the registry mapped
> type in Step 5 are the type-discipline heart of this refactor. Apply the
> `typescript-quality` skill for the variance of `EffectHandler<E>`, the
> `Extract<CardEffect, { kind: K }>` mapping, and keeping the `as never` confined.

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 2:</b> <code>bun run typecheck</code> green (new types compile, <code>energy.ts</code> still builds against moved <code>EffectResult</code>). <code>bun test</code> green (nothing wired yet). <code>bun run lint</code> clean — confirms <code>src/core/effects/</code> is Phaser-free from the start.
</div>

---

### Step 3 — Phase 1: composite handlers + recursion seam

The hardest part; do it before any leaf migration so the seam is proven.

- `src/core/effects/composite.ts` — `ModalHandler` and `SequenceHandler`
  extending `EffectHandler`. Each concern (`apply`, `describe`, `compile`,
  `structuralSpec`, `isPlayable`, `legalTargets`) ports the current
  Modal/Sequence `case` bodies from `effects.ts`, `describe.ts`, `effectGlyphs.ts`,
  and `available.ts`, but recurses through the **context callback**
  (`ctx.apply(ctx, branch)`) instead of calling `applyEffect` directly — this is
  what avoids the `composite.ts → registry.ts → composite.ts` import cycle.
  - `apply`: Modal selects `ctx.choice` branch; Sequence folds steps threading
    state + events (matches `effects.ts:368-386`).
  - `compile`: the join-vs-split budget and `compactSequences` propagation
    (`effectGlyphs.ts:205-245`) live here; branch/step recursion uses a
    compile-recursion callback passed in `CompileContext`.
  - `structuralSpec` → `{ kind: "modal" | "compound", ... }`;
    `isPlayable`/`legalTargets` mirror `available.ts` composite cases.
- Move `effectAtStep` here from `feedback.ts` and re-export it (per pinned
  decision); leave a re-export stub or update the `TableScene` import in Step 8.

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 3:</b> <code>bun run typecheck</code> green. Composite handlers compile against the base and the recursion callback with no import cycle (verify: <code>composite.ts</code> does not import <code>registry.ts</code>). Full <code>bun test</code> still green — composites are defined but not yet dispatched to.
</div>

---

### Step 4 — Phase 1: DealProgress handler (exercises the shared base)

- `src/core/effects/dealProgress.ts` — Move the `dealProgress()` and
  `resolveCounter()` helpers from `effects.ts` here (and re-export from
  `effects.ts` per the facade decision). Three handlers in this file, and they
  **do not all share a base** — getting this split right is the point of Step 4:
  - `DealProgressHandler extends HazardTargetingHandler<DealProgressEffect>` —
    inherits hazard `isPlayable`/`legalTargets`/`connectorStyle`; overrides
    `structuralSpec` to add the keyword tag (`e.bonus ? {kind:"hazard",
    tag:e.bonus.tag} : {kind:"hazard"}`).
  - `DealProgressScaledHandler extends HazardTargetingHandler<...>` — pure
    inherit of the hazard targeting behaviors; only `apply`/`describe`/`compile`
    differ.
  - **`DealProgressAllHandler extends EffectHandler<...>` directly — NOT
    `HazardTargetingHandler`.** `DealProgressAll` auto-targets every hazard in
    hand; it has no player target. Current behavior (verified):
    `structuralSpec → {kind:"none"}` (`available.ts:56`), `legalTargets → []`
    (`available.ts:197`), no `selectConnectorStyle` case (→ `null`). All three are
    the base-class defaults, so it extends the base and overrides **only**
    `isPlayable` → `worldCardsInHand(state).length > 0` (`available.ts:101`) plus
    `apply`/`describe`/`compile`. Extending `HazardTargetingHandler` here would
    silently regress `structuralSpec`, `legalTargets`, and `connectorStyle` — a
    behavior change no compile error would catch. Its `apply` loops `dealProgress`
    over a frozen hand snapshot (`effects.ts:432-445`), calling the public
    `applyEffect` internally per the recursion pin above.
- This is the proof that the intermediate base eliminates parallel re-listing for
  the kinds that genuinely share targeting (the two real hazard kinds) **without**
  over-applying it to a kind that only looks similar (`DealProgressAll`).

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 4:</b> <code>bun run typecheck</code> green. <code>bun test</code> green (still dispatched via old switches). Confirm the three hazard-targeting behaviors are now written once in <code>HazardTargetingHandler</code>, not three times.
</div>

---

### Step 5 — Phase 1: registry + dispatcher wiring (go/no-go gate)

Wire the four public dispatchers to the registry for the migrated kinds, with a
**transitional fallback** so unmigrated kinds still resolve through the old
switches. This keeps the suite green mid-migration.

- `src/core/effects/registry.ts` — `EFFECTS` partial map containing the kinds
  migrated so far (`Modal`, `Sequence`, `DealProgress`, `DealProgressScaled`,
  `DealProgressAll`). Typed loosely for now (`Partial<...>`); Step 7 tightens it
  to the exhaustive mapped type.
- Dispatchers delegate to a handler when present, else fall through to the
  existing switch body:
  - `effects.ts` `applyEffect` — build `EffectContext` (extract `play` fields,
    set `ctx.apply = applyEffect`-bound), `const h = EFFECTS[effect.kind];
    if (h) return h.apply(ctx, effect as never)`. Keep `reduce.ts` callers
    unchanged (signature preserved — the dispatcher adapts positional args to the
    context internally).
  - `available.ts` `structuralSpec`, `isPlayable`, `computeLegalTargetsForEffect`
    — same `if (h) return h.<m>(...)` guard ahead of the switch.
  - `describe.ts` `describeEffect`, `effectGlyphs.ts` `compileEffect` — same.
- The `as never` cast is confined to these dispatcher lines.

<div style="border-left: 3px solid #f0c674; padding: 6px 12px; background:#23200f55; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 5 (DECISION POINT):</b> <code>bun run typecheck</code> + full <code>bun test</code> + <code>bun run lint</code> + <code>bun run build</code> all green. <b>Concrete bail-out triggers</b> (not vibes): fall back to per-concern registries if any of — (a) <code>as never</code> appears anywhere beyond the four dispatcher lines; (b) any handler method needs a second cast to operate on its own <code>E</code>; (c) breaking the <code>composite.ts → registry.ts</code> cycle needs anything more than the <code>ctx.apply</code> callback (e.g. a dynamic import or a lazy getter). If none of those fire, the pattern holds — proceed to Phase 2. Phase 0 is already banked either way.
</div>

---

### Step 6 — Phase 2: migrate the remaining leaf kinds

With the pattern proven, port every remaining kind, grouped by cohesive file per
the design's §5 layout. Each kind's `apply`/`describe`/`compile`/targeting bodies
move verbatim from the current switches into a handler; most extend
`EffectHandler` directly and inherit the no-target defaults.

Remaining kinds and home files:
- `damage.ts` — `Damage`, `DamageScaled` (+ `damage()` helper).
- `draw.ts` — `Draw` (+ `DiscardThenDraw`, which uses `drawPlayer`).
- `resources.ts` — `Heal`, `GainEnergy`, `Brace`. **Name-collision note:**
  `effects.ts` exports `gainEnergy(state, n)` (amount-based) while `energy.ts`
  exports a different `gainEnergy(state)` (always +1, used by `startTurn`). Keep
  the relocated amount-based helper **private to `GainEnergyHandler`** (or rename
  it, e.g. `addEnergy`) so the two never collide in a shared import; if the
  facade re-exports it, re-export under the original `gainEnergy` name only if
  no file imports both.
- `gainCard.ts` — `AddCard`, `GainCard`, `AddPlayerCardToTop`,
  `AddWorldCardToDeck`, `AddThreatToWorldDeck` (+ `gainCard()` helper; this file
  reads `WORLD_THREAT_BY_WORLD_ID` / `worldThreatByWorldId` — keep it here, out of
  scope to refactor per design).
- `worldCards.ts` — `ReturnWorldCards`, `DestroyCardInHand`, `DestroySelf`,
  `ForceDestroy`, `ExileTopWorldCards`, `SurviveWorld` (+ `returnToActiveWorldDeck`,
  `destroyInHand` helpers).
- `none.ts` — `None` (apply: no-op; compile: `[]`; describe: `["no effect"]`).

Register each in `EFFECTS` as it lands. Add intermediate bases opportunistically
only where two+ kinds genuinely share non-default behavior (do not invent
abstractions for a single user).

Watch items (behavior that must port exactly):
- `DealProgressAll` already migrated in Step 4 snapshots hand before the sweep —
  confirm `worldCards.ts` siblings don't duplicate that logic.
- `ForceDestroy` emits no event at apply time (queues `pendingForceDestroy`).
- `dealProgressOf` in `describe.ts` (used by `previewPlay`) is **not** a handler
  method — it is a progress-lookahead helper. Leave it in `describe.ts`; it now
  has explicit cases from Step 1.

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 6:</b> After each file-group: <code>bun run typecheck</code> + the relevant tests (<code>effects.test.ts</code>, <code>available.test.ts</code>, <code>describe.test.ts</code>, <code>effectGlyphs.test.ts</code>) green. After all groups: full <code>bun test</code> green, <b>still unedited</b>.
</div>

---

### Step 7 — Phase 2: remove the transitional fallback

Now that every kind has a handler, tighten and delete the bridge.

- Retype `EFFECTS` to the exhaustive mapped type
  `{ [K in CardEffect["kind"]]: EffectHandler<Extract<CardEffect, { kind: K }>> }`.
  TS now errors if any kind is missing — this is the success-criterion-1 gate.
- Delete the `if (h) … else <old switch>` fallback in all four dispatchers; each
  collapses to the one-line virtual call. Delete the now-dead switch bodies and
  the orphaned helper functions left behind in `effects.ts` / `available.ts` /
  `describe.ts` / `effectGlyphs.ts`.
- `effects.ts` shrinks to the `applyEffect` dispatcher + the `EffectContext`
  build. `available.ts` keeps `availableActions`, `checkPlayAction`, `checkSpec`
  (these consume `TargetSpec`, not `effect.kind` per se — verify they need no
  per-kind switch; `checkSpec` switches on `spec.kind`, which is unaffected).

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 7:</b> <code>bun run typecheck</code> green with the exhaustive map (temporarily delete one registry entry locally to confirm it now fails to compile, then restore). Full <code>bun test</code> + <code>bun run lint</code> + <code>bun run build</code> green. No dead code remains (grep for the removed helper names returns only their new homes).
</div>

---

### Step 8 — Phase 3: relocate connectorStyle into core

- Each handler already carries `connectorStyle` (default `null` in base;
  `"progress"` in `HazardTargetingHandler`; `"destroy"` on `DestroyCardInHand`'s
  handler; `"return"` on `ReturnWorldCards`'s). Add a core dispatcher
  `export function connectorStyleOf(effect: CardEffect): ConnectorStyle | null`
  (in `registry.ts` or a thin `dispatch.ts`).
- `ConnectorStyle` type moves to core (it is `'progress' | 'destroy' | 'return'`,
  Phaser-free).
- `src/game/interaction/feedback.ts` — delete `selectConnectorStyle` and
  `effectAtStep` (moved in Step 3); keep `ringFraction`, `connectorLine`, `Point`.
- `src/game/scenes/TableScene.ts` (~line 926) — replace
  `selectConnectorStyle(effectAtStep(...))` with
  `connectorStyleOf(effectAtStep(...))`, importing both from core. Update the
  imports at `TableScene.ts:45-46`.
- Update `feedback.test.ts`: the `selectConnectorStyle` cases move to a core test
  (e.g. assert via `connectorStyleOf`); the geometry tests stay. **This is the one
  sanctioned test move** — it follows code that physically relocated, not a
  behavior change.

<div style="border-left: 3px solid #7fb37f; padding: 6px 12px; background:#13201355; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Gate 8:</b> <code>bun run lint</code> green — confirms <code>connectorStyle</code> logic now lives in core without pulling Phaser in, and <code>feedback.ts</code> is geometry-only. <code>bun test</code> green (relocated connector tests + untouched geometry tests). <code>bun run build</code> green.
</div>

---

### Step 9 — Validation against the design

Fresh-context check that the implementation matches
[the design](../design/card-effect-registry.md), not just that tests pass.

Checklist:
- **Success criterion 1:** adding a hypothetical `Foo` kind requires exactly one
  new handler file + one `EFFECTS` line, and leaving any abstract method
  unimplemented or omitting the registry entry is a compile error. Verify by
  spiking a throwaway `Foo` locally, confirming the compiler blocks the
  half-addition, then reverting.
- **Success criterion 2:** `git diff src/core/contract.ts` is empty; public
  function signatures unchanged (`reduce.ts`, `TableScene.ts`, `CardView.ts`,
  `HelpOverlayView.ts`, `branchLabels.ts` call sites compile without edits beyond
  the Step 8 import swap).
- **Success criterion 3:** `git diff` on the five test files shows **only** the
  sanctioned `feedback.test.ts` connector-case relocation from Step 8.
- **Out-of-scope honored:** JSON world files unchanged
  (`git diff src/data/` empty); `WORLD_THREAT_BY_WORLD_ID` still present (relocated,
  not redesigned); no new data-driven plumbing.
- **Determinism intact:** handlers hold no per-run state; nothing in
  `src/core/effects/` is stored into `GameState`. Spot-check `golden.test.ts`
  passes (seed-stable run).
- **Fresh-eyes review:** invoke the `lore-development:design-reviewer` or a
  general review subagent on the final diff.
- **Manual browser smoke (REQ-style runtime check):** `bun run dev`, play a
  hand in at least two worlds (e.g. `zombie-big-box` and `overgrown-mall`),
  exercise a Modal card (Sprint), a Sequence card (Barricade/Adrenaline), a
  hazard-targeting card, and a world card's `onCleared`/`onEndOfTurn` trigger.
  Confirm card faces render (compile path), the chooser labels render (describe
  path), targeting works (available path), and connectors draw (Step 8 path).
  Tests do not catch wiring/rendering regressions — this step is mandatory.

<div style="border-left: 3px solid #9fd0a0; padding: 6px 12px; background:#14201555; margin:8px 0; font-family: ui-monospace, monospace; font-size:12.5px;">
<b>▣ Final gate:</b> <code>bun run typecheck</code> · <code>bun test</code> · <code>bun run lint</code> · <code>bun run build</code> all green, plus the manual browser smoke and the checklist above. Then flip the design <code>status: proposed → implemented</code> and this plan <code>status: draft → executed</code>.
</div>

## Risks carried from the design

- **Composite recursion cycle** — mitigated by the context callback (Step 3);
  the Gate-5 decision point is where it is proven before committing the rest.
- **`as never` at dispatch** — accepted, confined to dispatcher lines; reassess at
  Gate 5 if it metastasizes.
- **Sizable refactor of well-tested code** — mitigated by the unchanged public
  surface (tests are the net) and the transitional fallback (Steps 5–6) keeping
  the suite green throughout rather than going red for the whole migration.

## Suggested commits

One per step (Step 6 may be several, one per file-group). Phase 0 (Step 1) is a
self-contained commit shippable independently of the rest. All on a feature
branch (e.g. `effect-handler-registry`); no direct commits to `master`.
