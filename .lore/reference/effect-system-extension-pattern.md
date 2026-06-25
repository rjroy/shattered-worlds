# Effect System Extension Pattern

<!--
date: 2026-06-15
status: current
tags: card-effect, effect-system, deferred-effect, testing, exhaustive-switch
fg-type: lesson
fg-sources: .lore/work/retros/adding-forcedestroy-effect.html
fg-status: current
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/core/effects/registry.ts
    - src/core/view/describe.ts
    - src/core/engine/effects.ts
  tests:
    - src/core/tests/effects.test.ts
    - src/core/tests/effectRegistry.test.ts
    - src/game/tests/describe.test.ts
  symbols:
    - CardEffect
    - EffectHandler
    - ForceDestroy
-->

Adding a new card effect is rarely a one-file change. The effect union, apply logic, description text, playability or target spec, data authoring, tests, and renderer feedback all need consideration. Exhaustive switches are useful tripwires, but some areas have defaults that silently mask missing cases.

## Checklist

Add the union member and the effect handler or apply case. Add display text in the pure description path. Add explicit playability and target-spec handling when the defaults would be ambiguous. Add data and catalog tests because JSON is loaded across a cast boundary and is not typechecked like TypeScript.

Deferred effects need a queued field on `GameState` plus a well-defined resolution point in the turn cycle. `skipDrawNext` and `ForceDestroy` are the reference pattern: queue at trigger time, resolve later when the target state exists, and emit events when resolution actually happens.

Renderer feedback is separate work. A state-diff renderer may make the state change visible only by removing or redrawing cards; if the effect needs to feel impactful, add event-driven or explicit presentation handling.
