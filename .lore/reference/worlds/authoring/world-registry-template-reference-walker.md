---
title: World Registry Template Reference Walker
date: 2026-07-02
status: current
tags: [conformance-test, world-registry, template-references, keyword-gate, testing-lesson]
fg-type: lesson
fg-sources: [.lore/work/plans/new-derelict.md]
fg-status: current
fg-evidence:
  code:
    - src/core/tests/worldRegistry.test.ts
  symbols:
    - templateRefs
    - allReferencedTemplates
---

# World Registry Template Reference Walker

`worldRegistry.test.ts`'s conformance suite walks every card template's effects to confirm every referenced template id resolves in the assembled catalog. The walker (`templateRefs`) recurses into `Modal.branches` and `Sequence.steps`, and it walks each world-card template's `onDiscarded`/`onCleared`/`onEndOfTurn` hooks — but for a long stretch it did not walk `onPartialClear` or `onDraw`, and did not recurse into `KeywordGate.then`/`ProgressGate.then`. A template reference nested inside a gate, or living in one of the two unwalked hooks, was invisible to the walker regardless of which world authored it.

This was discovered as a real, currently-live gap while building New Derelict: two of its planned cards (`Gravity Priority Shift`, `Corridor Becomes Lifeboat`, `The Order Arrives`) put template references inside `onPartialClear`, and `Systems Panel`/`The Order Arrives` nest a reference inside a `KeywordGate → then`. Confirmed by direct inspection that it was **already** silently affecting two shipped Eden Prime cards before New Derelict touched anything. The fix was folded into New Derelict's plan (rather than deferred) precisely so the new world's own recipes would get real coverage: extend the walker to cover both missing hooks and recurse into both gate kinds' `then` branch.

The general lesson: a template-reference walker (or any structural conformance checker) needs to be checked against the *complete* current effect-shape surface whenever a new effect kind or hook is added — not just extended reactively when a new world's card happens to need the missing branch. Running the full suite immediately after widening a walker like this is the right verification step; a newly-surfaced failure against an *existing* world's data is a real bug the gap was hiding, not a reason to special-case the walker back down.
