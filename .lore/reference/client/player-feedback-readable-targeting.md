---
title: Readable Targeting Feedback
date: 2026-07-02
status: current
tags: [feedback, targeting, connector, hover, progress-ring, ux]
fg-type: lesson
fg-sources: [.lore/work/specs/player-feedback-selection-and-progress.html, .lore/work/brainstorm/player-feedback-selection-and-progress.html, .lore/work/plans/player-feedback-selection-and-progress.html]
fg-status: current
fg-evidence:
  code:
    - src/game/interaction/feedback.ts
    - src/game/interaction/highlight.ts
    - src/game/view/connector.ts
    - src/game/scenes/TableScene.ts
  tests:
    - src/game/tests/feedback.test.ts
    - src/game/tests/highlight.test.ts
    - src/game/tests/selection.test.ts
  symbols:
    - connector
    - target
    - classifyHighlight
---

# Readable Targeting Feedback

Click-to-commit targeting is only fair if the hover state makes the outcome unmistakable before the click. The target read must be loud enough to stand on its own: not only a border tint, but a clear highlighted target, a connector from acting card to target, and a live preview of what will happen.

## Lessons

**The connector names the target.** It turns "match these two highlighted things in your head" into a visible line from actor to target. Connector style also communicates action type: progress, destroy, or return-to-deck.

**Instruction and preview need separate surfaces.** A phase hint and a target-specific live preview should not overwrite each other in one text slot. If they fight, the player loses either the current task or the consequence of committing.

**Progress reset must be taught visually.** Because hazard Progress resets at end of turn, the UI needs both a current-turn progress meter and a drain animation. A static meter communicates "some progress exists" but hides that the progress is temporary.

**Earlier picks in a multi-step play stay lit.** `classifyHighlight` in `highlight.ts` returns a `picked` state for any card chosen in the current step *or* recorded in a prior completed step (`sel.done.some(...)`), not just the current step's live picks. This closes the gap the original brainstorm flagged: during a compound play's later step, the player can still see which hazard an earlier step already committed to, instead of that earlier target going dark once the flow advances.
