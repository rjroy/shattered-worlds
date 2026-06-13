---
title: Co-locating card-effect behavior — registry over scattered switches
date: 2026-06-13
status: implemented
tags: [card-effect, core, refactor, extensibility, exhaustiveness, registry]
modules: [core-model, core-engine, core-view, game-interaction]
related: [.lore/work/design/card-effect-token-ir.md]
---

# Co-locating card-effect behavior — registry over scattered switches

## Problem

Adding one new card effect is a five-file, seven-switch edit, and several of
those switches fail *open* — a new kind compiles and runs while quietly
behaving wrong.

A `CardEffect` is plain data: a discriminated union keyed by `kind`
(`src/core/model/types.ts:15`), authored directly in JSON world files
(`src/data/worlds/*.json`), carried inside cards inside `GameState`. It holds
no behavior. Every behavior an effect has is supplied by external code that
switches on `kind`. Those switches are spread across the codebase, one per
*concern*:

| Concern | Site | New-kind safety today |
|---|---|---|
| Type membership | `types.ts:15` `CardEffect` union | compile error |
| Runtime behavior | `effects.ts:295` `applyEffect` | exhaustive (no `default`) |
| Target shape | `available.ts:31` `structuralSpec` | **`default:` — silent** |
| Playability | `available.ts:78` `isPlayable` | **`default: return false` — silent** |
| Legal targets | `available.ts:158`, `:214` | **`default:` — silent** |
| Prose | `describe.ts:23` `describeEffect` | exhaustive |
| Progress lookahead | `describe.ts:150` `dealProgressOf` | **`default:` — silent** |
| Icon tokens | `effectGlyphs.ts:128` `compileEffect` | exhaustive |
| Connector style | `feedback.ts:73` `selectConnectorStyle` | **`default:` — silent** |

So a single conceptual addition is smeared across `model/`, `engine/`, and
`view/`, plus one file under `game/`. Three sites already fail closed: their
`switch` has no `default`, so TypeScript's exhaustiveness check refuses to
compile until the new kind is handled. The other five carry a `default:` clause
and fail open.

The worst is `isPlayable`'s `default: return false` (`available.ts:127`): a new
effect is silently treated as *unplayable*. No compile error, no test failure
unless someone wrote a targeted test, just a card that can never be played until
the missing case is noticed. `structuralSpec`, `computeLegalTargetsForEffect`,
`dealProgressOf`, and `selectConnectorStyle` have the same shape — a new kind
falls through to a benign-looking default and misbehaves.

This is the real friction behind "what makes an effect is hard to organize." It
is not that effects are data; it is that the *organization unit is the concern,
not the effect*. To understand everything `ExileTopWorldCards` does you read
seven files; to add `Foo` you must remember to touch all of them, and the
compiler only reminds you about three.

## What can be a class, and what can't

Two different things get called "the effect," and only one of them can become a
class. Keeping them straight is the whole design.

- **The effect *data*** — `{ kind: "DamageScaled", base: 0, per, amount }` — is
  authored as JSON (`overgrown-mall.json`), lives inside cards inside
  `GameState`, and is snapshotted by the runtime with `structuredClone`
  (`clone.ts:3`). `structuredClone` strips methods and prototypes; so does the
  `JSON.parse(JSON.stringify(...))` fallback. This value **must stay plain
  data** — a class instance round-tripped through cloning comes back as a bare
  object with its methods gone, and the deterministic, byte-comparable state
  model (CLAUDE.md) depends on state being plain anyway. So the *numbers* do not
  become a class.

- **The effect *behavior*** — apply, describe, compile, targeting — is a
  different thing entirely. It holds no per-run data; it is a set of functions
  that take effect data and game state as arguments. That **is** what becomes a
  class: one **handler class per `kind`**, instantiated once as a stateless
  singleton, held in a registry module, looked up by `effect.kind` at dispatch
  time. It is never stored in state and never cloned.

That is ordinary polymorphism: the data is the message, the handler class is the
behavior, and dispatch is `EFFECTS[effect.kind].apply(...)`. The earlier worry
("classes can't survive cloning") only ever applied to putting methods on the
*data*. Handlers sit outside the state graph, so it does not apply to them.

## Design

Invert the axis. Today the top-level unit is the concern (`applyEffect`,
`describeEffect`, …), each holding a `case` per kind. Flip it: the top-level unit
becomes the **handler class for one kind**, holding that kind's behavior for
every concern. Dispatchers stop being `switch` statements and become virtual
calls.

### 1. The base class carries the defaults

```ts
// src/core/effects/EffectHandler.ts
abstract class EffectHandler<E extends CardEffect> {
  // Every effect does something and shows something — these are abstract.
  abstract apply(ctx: EffectContext, effect: E): EffectResult
  abstract describe(effect: E): string[]
  abstract compile(effect: E, ctx: CompileContext): EffectLine[]

  // Most effects need no target. Subclasses override only what differs.
  structuralSpec(_effect: E): TargetSpec { return { kind: "none" } }
  isPlayable(_effect: E, _state: GameState, _selfId: CardId): boolean { return true }
  legalTargets(_effect: E, _selfId: CardId, _state: GameState): readonly CardId[] { return [] }
  connectorStyle(_effect: E): ConnectorStyle | null { return null }
}
```

This is where the class form pays off over a bag of functions. Roughly fifteen
kinds (`Heal`, `GainEnergy`, `Brace`, `Damage`, `Draw`, `AddCard`, `SurviveWorld`,
…) need *no* targeting — they inherit `structuralSpec → none`, `isPlayable →
true`, `legalTargets → []`, `connectorStyle → null` and override only `apply` /
`describe` / `compile`. An object-literal registry would force all four no-op
methods to be spelled out on every one of those kinds; inheritance deletes that
boilerplate and makes "this effect has no special targeting" the silent default.

Shared *non*-default behavior groups under an intermediate base. The two
hazard-targeting kinds are the clearest case:

```ts
abstract class HazardTargetingHandler<E extends CardEffect> extends EffectHandler<E> {
  override structuralSpec(_e: E): TargetSpec { return { kind: "hazard" } }
  override isPlayable(_e: E, state: GameState) { return worldCardsInHand(state).length > 0 }
  override legalTargets(_e: E, _self, state) { return worldCardsInHand(state).map((c) => c.id) }
  override connectorStyle(): ConnectorStyle { return "progress" }
}

class DealProgressHandler extends HazardTargetingHandler<DealProgressEffect> {
  override apply(ctx, e) { return dealProgress(ctx.catalog, ctx.state, ctx.targetId ?? "", e.base, e.bonus) }
  override describe(e) { /* the prose case from describe.ts */ }
  override compile(e) { /* the token case from effectGlyphs.ts */ }
  // Only DealProgress refines the spec with the keyword tag:
  override structuralSpec(e) { return e.bonus ? { kind: "hazard", tag: e.bonus.tag } : { kind: "hazard" } }
}
```

The three `available.ts` switches plus `selectConnectorStyle` that today each
re-list "DealProgress / DealProgressScaled" in parallel collapse into one shared
base. That parallel re-listing across four switches is exactly the kind of drift
risk inheritance removes.

### 2. The registry is an exhaustive map of singletons

```ts
// src/core/effects/registry.ts
export const EFFECTS: {
  [K in CardEffect["kind"]]: EffectHandler<Extract<CardEffect, { kind: K }>>
} = {
  DealProgress: new DealProgressHandler(),
  DamageScaled: new DamageScaledHandler(),
  ExileTopWorldCards: new ExileTopWorldCardsHandler(),
  // ...every kind, one stateless singleton each
}
```

The mapped type `{ [K in CardEffect["kind"]]: ... }` is the linchpin that keeps
the win from the three good switches and extends it to all of them: **omit a kind
and the object literal fails to compile**. No `default` to fall through, because
there is no `switch`. The handlers are constructed once at module load, hold no
state, and never enter the cloned game state.

### 3. Dispatchers become virtual calls

Each scattered switch collapses to a lookup that delegates to the handler:

```ts
// effects.ts
export function applyEffect(ctx, effect) {
  return EFFECTS[effect.kind].apply(ctx, effect as never)
}

// available.ts
function structuralSpec(effect) { return EFFECTS[effect.kind].structuralSpec(effect as never) }
function isPlayable(effect, state, selfId) { return EFFECTS[effect.kind].isPlayable(effect as never, state, selfId) }

// describe.ts
export function describeEffect(effect) { return EFFECTS[effect.kind].describe(effect as never) }

// effectGlyphs.ts
export function compileEffect(effect, worldId) { return EFFECTS[effect.kind].compile(effect as never, { worldId }) }
```

(The `as never` is the standard tax for dispatching a discriminated union through
a keyed map — TypeScript can't prove `EFFECTS[effect.kind]`'s handler binds the
*same* `E` the narrowed `effect` carries. It is confined to the one dispatcher
line; each handler method re-narrows to its own `E`. This cost is identical
whether handlers are classes or function bags.)

The public function names and signatures (`applyEffect`, `describeEffect`,
`availableActions`, …) **do not change**, so `contract.ts` and every caller are
untouched. This is an internal reorganization behind a stable surface.

`EffectContext` bundles what `applyEffect` threads today (`catalog`, `state`,
`action`'s targeting fields, `selfId`). Composite kinds (`Modal`, `Sequence`)
recurse through a callback on that context rather than importing the registry
directly, so the handler modules don't form an import cycle with `registry.ts`.

### 4. Where the boundary sits

The lint-enforced boundary is `core` vs `game` (Phaser-free), not
`engine` vs `view`. All of `apply`, `structuralSpec`, `isPlayable`,
`legalTargets`, `describe`, and `compile` are already pure and Phaser-free, so a
handler that holds all of them lives comfortably in `src/core/`. (Core's logic
is currently written without classes — pure functions returning `{ state,
events }`. That class-free style is precisely what scattered each effect across
seven files; the renderer next door is already class-based. This refactor brings
the same object orientation to core, where the domain is plainly polymorphic.)

`connectorStyle` (and the related `effectAtStep`) currently sit in
`src/game/interaction/feedback.ts`, but that file's own header says it imports
core *types* only and is headless-tested — it is pure core logic shelved on the
game side. Folding `connectorStyle` into the handler **moves it across into
`core/`**, which is where it belongs; `feedback.ts` keeps only the genuinely
geometric helpers (`connectorLine`, `ringFraction`). That is a real
simplification the current split obscures, not scope creep.

### 5. Proposed layout

```
src/core/effects/
  EffectHandler.ts  abstract base + intermediate bases (HazardTargetingHandler, …)
  EffectContext.ts  EffectContext, EffectResult, the recursion callback
  registry.ts       EFFECTS map (the exhaustive index of singletons)
  dealProgress.ts   DealProgressHandler + the dealProgress() helper it owns
  damage.ts         Damage / DamageScaled handlers + damage() helper
  draw.ts           DrawHandler
  gainCard.ts       AddCard / GainCard / AddPlayerCardToTop / AddWorldCardToDeck / AddThreat handlers
  composite.ts      Modal + Sequence handlers (recurse via ctx callback)
  ...one file per cohesive group
```

The free helper functions currently exported from `effects.ts` (`dealProgress`,
`gainCard`, `damage`, `heal`, `returnToActiveWorldDeck`, …) move next to the
handler that owns them, as private functions or `protected` methods on the
relevant base. `effects.ts` shrinks to the `applyEffect` dispatcher plus shared
utilities. `available.ts`, `describe.ts`, and `effectGlyphs.ts` shrink to their
dispatchers plus the cross-cutting layout logic that is not per-kind (e.g.
`compileEffect`'s sequence join-vs-split budget, which is a property of
*composition*, not of any single kind, and stays in `composite.ts`).

## What this does and does not buy

Buys:

- **One place per effect.** Everything `ExileTopWorldCards` does is one class.
  Adding `Foo` is one file plus one registry line.
- **Inheritance does real work.** No-target effects inherit four default
  methods; the hazard-targeting kinds share one base instead of re-listing
  themselves across four switches. Common behavior is written once and overridden
  only where it differs — the thing a `switch`-per-concern layout cannot express.
- **Uniform fail-closed.** The five `default:` holes become compile errors. A
  half-added effect cannot ship.
- **`connectorStyle` returns to core**, retiring a misplaced concern.
- **Stable public surface.** No `contract.ts` change; callers untouched.

Does not buy, and is explicitly out of scope:

- It does **not** make effects more dynamic or data-driven than today. The set
  of kinds is still closed and compiled in. (A JSON-pluggable effect system is a
  different, larger project; this is purely reorganization.)
- It does **not** touch the JSON authoring format. World files are unchanged.
- It does **not** fix `WORLD_THREAT_BY_WORLD_ID` (`effects.ts:23`), the hardcoded
  world-id → threat-template map embedded in the effect engine. That is a
  separate world-data-locality wart; noted here only so the refactor does not
  silently entrench it. The `AddThreatToWorldDeck` handler will still read it,
  just from its own file.

## Alternatives considered

**Function bags instead of handler classes** — an object literal of closures per
kind (`{ apply, describe, compile, ... }`) rather than a class. Structurally this
also works and also fails closed under the mapped type. Rejected because it
throws away the main reason to make the move: with no base class there are no
default methods, so all ~15 no-target kinds must spell out `structuralSpec`,
`isPlayable`, `legalTargets`, `connectorStyle` as no-ops, and the hazard group
has no shared base to inherit from. You can fake defaults with a
`makeHandler({...})` factory that fills missing keys, but that is a worse
re-implementation of what `extends` gives for free. The domain is polymorphic;
use the language's polymorphism.

**Per-concern registries** — separate `applyRegistry`, `describeRegistry`, …,
each `Record<EffectKind, fn>`. Gets fail-closed with a smaller diff but only
half-solves the problem: adding an effect still means visiting N maps in N files.
The cohesion ask — "everything about one effect in one place" — needs the
single-handler form. Kept only as a smaller-blast-radius fallback if Phase 1
surfaces a blocker.

**Methods on the effect *data*** (`new DealProgressEffect(3)` stored in
`GameState`). Rejected — this is the one place classes genuinely don't fit:
effect data is JSON-authored and cloned via `structuredClone`, which strips
methods. The handler is a class; the data it operates on stays plain. See *What
can be a class, and what can't*.

**Leave it as switches, just delete the `default:` clauses.** This is the
cheapest possible fix and gets the entire fail-closed safety win on its own — the
five silent switches become exhaustive, and the compiler starts enforcing all
seven sites. It does nothing for cohesion or discoverability (an effect is still
seven files), but it is real, and it is a strict subset of the full refactor.
Recommended as Phase 0 regardless, because it is valuable immediately and
independently testable.

## Risks and trade-offs

- **Sizable refactor of pure, well-tested code.** The effect engine and its view
  compilers carry near-complete coverage. The mitigation is that the tests are
  the safety net: they assert behavior through the *public* functions
  (`applyEffect`, `describeEffect`, `compileEffect`), whose signatures do not
  change, so they should pass untouched across the move. A test that needs
  editing is a signal the refactor changed behavior — investigate, do not "fix
  the test."
- **Indirection cost.** A reader chasing `applyEffect` now hops dispatcher →
  registry → handler instead of reading one switch. This is the standard
  virtual-dispatch trade: worse for "show me every effect at once," better for
  "show me everything about *this* effect." Given the stated goal is the latter,
  the trade favors it. The `registry.ts` map doubles as the at-a-glance index the
  switch used to provide.
- **Composite recursion via context.** `Modal`/`Sequence` must recurse without
  importing the registry (cycle). Threading a recursion callback through
  `EffectContext` is the standard fix, but it is the one piece of the design
  with real subtlety — validate it first (see Phasing) before committing to the
  pattern across all kinds.
- **`as never` at dispatch sites.** Keyed-map dispatch over a discriminated
  union loses the per-case narrowing a `switch` gives for free; the handler's
  generic `E` can't be tied to the indexed key without a cast. Confined to the
  one-line dispatcher — each handler method re-narrows internally — but it is a
  genuine ergonomic wart at the dispatch points, and worth seeing in real code
  (Phase 1) before adopting wholesale.

## Phasing

0. **Delete the five `default:` clauses** in `structuralSpec`, `isPlayable`,
   `computeLegalTargetsForEffect`/`computeLegalTargets`, `dealProgressOf`, and
   `selectConnectorStyle`; add the missing cases the compiler then demands.
   Ships the entire fail-closed safety win with no architecture change. Do this
   first whether or not the rest proceeds.
1. **Prove the pattern on the hard cases.** Build `EffectHandler` (base +
   `HazardTargetingHandler`), `EffectContext`, the registry scaffold, and migrate
   `Sequence` + `Modal` (composite recursion) and `DealProgress` (the
   most-referenced leaf, exercising the shared base). If the recursion-via-context
   and `as never` ergonomics hold up here, they hold up everywhere.
2. **Migrate the remaining leaf kinds**, one cohesive group per file, grouping
   shared behavior under intermediate bases as it emerges. Tests stay green by
   construction (public surface unchanged).
3. **Pull `connectorStyle` into core**, slim `feedback.ts` to geometry.

Phase 0 stands alone. Phases 1–3 are the handler-class reorganization.

## Decision

Pending. Recommendation: take Phase 0 unconditionally (pure upside, no
architecture change), then build the `EffectHandler` class hierarchy and registry
across Phases 1–3. One handler class per `kind`, polymorphic over a shared base,
registered as stateless singletons and dispatched by `effect.kind`. The effect
*data* stays plain JSON-authored values in state; the *behavior* is a class, the
way it should have been — bringing core in line with the renderer instead of
keeping the logic spread across seven switch statements.
