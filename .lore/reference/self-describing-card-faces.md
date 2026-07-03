---
title: Self Describing Card Faces
date: 2026-06-15
status: current
tags: [card-text, renderer, description, ux, modal, preview]
fg-type: decision
fg-sources: [.lore/work/retros/self-describing-card-faces.html, .lore/work/plans/world-deck-slice.html, .lore/work/specs/world-deck-slice.html]
fg-status: current
fg-evidence:
  code:
    - src/core/view/describe.ts
    - src/core/view/branchLabels.ts
    - src/game/view/CardView.ts
  tests:
    - src/game/tests/describe.test.ts
    - src/core/tests/golden.test.ts
  symbols:
    - describeEffect
    - resolveBranchLabels
---

# Self Describing Card Faces

The renderer chose bigger, self-describing card faces over hiding rules in a hover panel. Cards should explain their behavior directly on the face, including modal branches, sequence steps, penalties, rewards, and target previews.

## Decision

Card behavior text comes from one pure description module in the renderer layer. It imports core types but no Phaser. Modal labels and sequence descriptions are derived from the actual effect data, not hardcoded by card name or branch index. This prevents UI strings from lying when card data changes.

## Lesson

Target specs describe interaction shape, not the underlying effect text. When the UI needs to explain a modal branch, it must read the card's real effect, not infer text from the target spec. Plan "gaps" sections should be treated as implementation checklist items; the target-preview gap was real work, not optional prose.
