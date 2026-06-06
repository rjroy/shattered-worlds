# Note: splitting the pure presentation logic out of render.ts

- **Status:** done (2026-06-06). All five phases shipped. `presentation.ts`
  holds the pure decisions and imports Phaser type-only; `presentation.test.ts`
  passes with no preload (17 tests). `render.ts` dropped 719 → 628 lines and
  keeps the apply wrappers + factories. Full suite 253 green, typecheck + lint
  clean. Fresh-context review confirmed zero behaviour change (the `none` case's
  `setStrokeStyle(0)` vs `setStrokeStyle(0, 0)` is pixel-identical because
  lineWidth 0 never reads the colour).
- **Date filed:** 2026-06-06
- **Area:** Phaser rendering (`src/game/render.ts`)
- **Follows from:** happy-dom test-preload swap (`9eec9fc`) and the
  CommonLabel/CommonButton extraction (`cec8fc7`). Those were the easy wins;
  this is the structural one we deferred.
- **Related:** `.lore/work/design/core-render-architecture.html` (the
  pure-core / thin-renderer split this extends one layer down),
  `issue-blurry-transparent-text.md` (touched `textStyle`, a candidate for the
  pure module).

## The goal in one sentence

Move the parts of `render.ts` that *decide* how something should look (which
colour, which texture key, what arc angle) into a module that never imports
Phaser, so their tests run with no DOM at all and `render.ts` shrinks toward a
thin layer that only talks to the engine.

## Why this is worth doing

`render.ts` is 719 lines and opens with a top-level `import Phaser from
'phaser'`. Because `class CommonButton extends Phaser.GameObjects.Container`
and the factory functions construct real game objects, importing this module
evaluates the whole engine. That evaluation is exactly what forces the test
preload to register a DOM (see `testSetup.ts`): the moment `render.test.ts`
imports `selectCardFrontKey` to test a card-to-string mapping, Phaser boots and
the engine probes `window`, `document`, and a 2D canvas context.

So today five functions in `render.test.ts` (`selectCardFrontKey`,
`updateCostRing`, `emphasizeCard`, `clearEmphasis`, `applyCardHighlight`) drag
the full DOM shim in to test logic that is, at its core, arithmetic and
look-up tables. happy-dom made that tax cheaper and more honest, but it did not
remove it. The seam is still in the wrong place.

## The misnomer to correct

"Pure presentation logic" is loose shorthand. Most of these functions are *not*
pure: they mutate Phaser objects (`bg.setStrokeStyle(...)`, `ring.clear()`,
`scene.tweens.add(...)`). What is pure is the **decision** tangled up with the
mutation. The work is to separate the decision from the push.

Three tiers exist in `render.ts` today:

1. **Genuinely pure** — input to output, no Phaser value touched.
   `selectCardFrontKey` (card to texture key), `textResolution` / `textStyle`
   (device DPI to style object), the cost-ring geometry (a fraction to start/end
   angles), the highlight colour table (a `kind` + `FrameStyle` to a stroke/fill
   descriptor), `clampUnit`. These can move out as-is and would need no DOM to
   test.

2. **Decision welded to mutation** — `applyCardHighlight` (computes a
   stroke/fill from `kind`, then calls `setStrokeStyle`/`setFillStyle`),
   `updateCostRing` + `drawCostRing` (compute clamped fraction and arc, then
   `ring.lineStyle`/`arc`/`strokePath` and a tween), `emphasizeCard` /
   `clearEmphasis` (glow geometry, then draw + tween). The computation is pure;
   the trailing engine calls are not. These need a small refactor, not just a
   move.

3. **Thin engine factories** — `createCardObject`, `createHUD`, `updateHUD`,
   `createWinScreen`, `createLossScreen`, the three button factories. Almost all
   `scene.add.*` wiring, little decision logic. These stay in `render.ts`. They
   are integration territory and were never unit-tested; that is correct, not a
   gap to fill.

## Proposed shape

Introduce a Phaser-free module (working name `presentation.ts`, or
`cardVisuals.ts` if it ends up card-scoped) that holds tier 1 outright, and the
extracted **decide** half of tier 2 as descriptor functions:

- `highlightDescriptor(kind, frameStyle): { strokeWidth, strokeColor, fillColor, fillAlpha }`
  — pure. `applyCardHighlight` in `render.ts` becomes a thin wrapper: call the
  descriptor, then push the four values onto the `bg` rectangle.
- `costRingArc(fraction): { clamped, start, end }` — pure. `drawCostRing` keeps
  only the `ring.lineStyle`/`beginPath`/`arc`/`strokePath` calls.
- `selectCardFrontKey`, `textStyle`, `textResolution`, the `TEXT` palette, and
  `clampUnit` move over unchanged.

The "compute a descriptor, then apply it" pattern is the seam. Tests target the
descriptor functions and never import Phaser. `render.ts` keeps the apply
wrappers and the tier-3 factories, and imports the descriptors from the new
module.

## What success looks like

`render.test.ts`'s pure assertions (and any new descriptor tests) import the
Phaser-free module and run without `testSetup` preloaded. The proof is concrete:
those tests pass even if the DOM registration is removed from their path. The
DOM shim then exists only for tests that genuinely construct game objects (the
factories), if any remain, rather than for arithmetic. `render.ts` drops well
under the 800-line heuristic and reads as "talk to the engine," with the
"what should it look like" decisions living elsewhere.

## Constraints and risks

- **Behaviour-preserving.** This is a refactor, not a feature. The split must
  not change a single drawn pixel or tween.
- **The cost-ring invariants are load-bearing.** `updateCostRing` carries
  careful comments about idempotency (epsilon no-op), first-render snap,
  tween killability tied to the S3 destruction pass, and not retaining a Tween
  reference across reconcile cycles. The descriptor extraction must leave the
  tween/kill logic exactly where it is; only the angle math moves. Re-read those
  comments before touching it.
- **Typing seams.** `FrameStyle` and `VisualTheme` come from `./theme`; the new
  module imports those types (type-only, so no Phaser leak). `textStyle`
  returns a `Phaser.Types.GameObjects.Text.TextStyle`, which is a type, not a
  value, so it can live in a Phaser-free module via `import type`.
- **Watch for a Phaser value sneaking in.** The whole benefit collapses if the
  new module imports `Phaser` as a value for even one constant. Keep it
  type-only or the DOM tax comes right back.

## Suggested phasing

1. Move tier 1 (the genuinely pure functions + `TEXT`) into the new module,
   update `render.ts` and any importers, run typecheck/lint/tests. Smallest
   possible diff, immediate payoff.
2. Extract `highlightDescriptor` and repoint `applyCardHighlight` at it. Add a
   DOM-free test for the descriptor.
3. Extract `costRingArc` from `drawCostRing`. Add a DOM-free test for the arc
   math. Leave the tween untouched.
4. Same for the glow geometry behind `emphasizeCard` if it pays off; stop if it
   does not.
5. Once the five currently-DOM-bound tests are split into pure descriptor tests
   plus thin integration coverage, reassess whether `render.test.ts` still needs
   the preload at all.

Each step is independently shippable and independently verifiable. If a later
step stops paying for itself, stopping early still leaves the codebase better
than it started.
