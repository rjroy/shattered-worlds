---
title: "Implementation notes: card-effect-token-ir"
date: 2026-06-12
status: in_progress
tags: [implementation, notes, card-face, icons, rendering]
source: .lore/work/design/card-effect-token-ir.md
modules: [core-view, game-view]
---

# Implementation notes: card-effect-token-ir

Implementing the token IR design on branch `card-effect-token-ir`. Agent
registry absent; all roles use `general-purpose`.

## Progress

- [x] Phase 1 — Core compiler: `IconId`/`EffectToken`/`EffectLine` +
      `compileEffect` in `src/core/view/effectGlyphs.ts`, exhaustive
      no-default switch, tests for every vocabulary-table row
- [x] Phase 2 — Token-row renderer in `src/game/view`: `{ container, height }`
      contract, exhaustive `Record<IconId, string>` texture map, placeholder
      textures via assetManifest, scale-to-fit overflow warn
- [x] Phase 3 — Switch card faces in `CardView.ts`: player effect block, four
      world trigger blocks with trigger icons, delete `includes('Progress')`
      hack and unused addCardText paths
- [ ] Validation — holistic review against the design + browser screenshot
      pass of card faces

## Constraints from prior lore (researcher findings)

- Pure-side module may use `import type` only; one Phaser value import drags
  the DOM shim into tests (.lore/work/notes/splitting-pure-presentation-logic.md).
- Exhaustive switch with no `default` is the trip-wire for new effect kinds
  (.lore/work/retros/adding-forcedestroy-effect.html).
- All text through `textStyle()` factory; avoid fractional x positions —
  small-glyph blur (.lore/work/notes/issue-blurry-transparent-text.md).
- Texture keys must be registered in `assetManifest.ts` or runtime missing
  texture (.lore/reference/theme-authoring.html W2/W3).
- Typecheck/lint/tests insufficient for face layout changes; prior retro
  required a real-browser screenshot pass
  (.lore/work/retros/self-describing-card-faces.html).
- Keywords render as plain text, never icons (design §1 decision).

## Log

- 2026-06-12: Branch created, researcher pass complete, phases defined.
- 2026-06-12: Phase 1 complete (572 tests pass, typecheck/lint clean).
  Implement → test-verify → review → fix cycle ran. Review surfaced two
  contract gaps, resolved as design updates (recorded in the design doc §2):
  - Sequence split rule: 1–2 steps join one line; 3+ steps emit one line per
    step, continuations led by `then`. Driver: Garden Center's 4-step
    onCleared. Sequence branches inside a Modal stay one compact line.
  - Rider binding: a rider line renders at the indent of the preceding line.
  Decisions not in the original design (recorded as latent/accepted):
  - `None` inside Modal contributes no branch line; AddCard ignores `dest`
    and AddWorldCardToDeck ignores `bTop` (matches describeEffect's identical
    blindness; no authored card uses them today).
  - Emphasis extended beyond the mandated `progress`: `reward` on
    Heal/GainEnergy, `penalty` on Damage/DamageScaled. Riders carry none.
  Phase 2 handoffs: U+2212 minus in damage values (font must render it);
  DestroySelf compiles to an icon-only line (zero text tokens); Sprint's hit
  branch renders `[progress] 0` — check at the Phase 3 eyeball pass.
- 2026-06-12: Phase 2 complete (613 tests pass, typecheck/lint/build clean).
  New: `effectLineLayout.ts` (pure: icon texture map, placeholders, role
  styles, row math, stacking) + `effectLineView.ts` (Phaser apply:
  `ensureEffectIconTextures`, `addEffectLines`). EFFECT_ROW geometry in
  layout.ts; texture registration in TableScene.create() + lazy self-ensure.
  Review fixes applied: stacking/width math hoisted pure + tested; rider
  hang-floor rule (design §2 updated: hangIndent floors lines after a
  lead-icon line); height returned Math.ceil'd; two false comments fixed.
  Decisions/divergences: overflow warn is unconditional (no dev-flag
  convention exists; design updated); placeholder textures are canvas-
  generated in create(), not preload (placement choice); U+2212 normalized
  to ASCII hyphen renderer-side (couldn't verify glyph headlessly; en-dash
  ranges left alone — browser-check residual). Phase 3 handoffs: leadIcon
  opt per trigger; fontSize 10 + background for world blocks; never tween
  rows/tokens (killability depth); pass warnLabel = card name.
- 2026-06-12: Phase 3 complete (617 tests pass; typecheck/lint/build clean;
  CardView net -11 lines). Faces switched: player block via compileEffect +
  addEffectLines at old offsets; world blocks loop a typed triggerBlocks
  table (eachTurn/onDiscard/onClear/onPartialClear), None skipped without
  spacing. Deleted: includes('Progress') hack, addEffectBlock, describeEffect
  import, dead CardTextOpts paths (lineSpacing, backgroundAlpha, font).
  Review fixes: stale comments reworded; trigger order + per-block tints now
  pinned by a four-trigger fixture (Patient Zero) with color-tracking fakes.
  FOLLOW-UP FLAGGED (out of design scope): HelpOverlayView.ts draws mock
  hazard cards with prose effect text — now misleading vs real faces.
