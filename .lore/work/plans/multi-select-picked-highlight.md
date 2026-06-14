---
title: "Implementation plan: multi-select picked-card highlight"
date: 2026-06-14
status: draft
tags: [plan, highlight, selection, multi-select, ui, renderer]
modules: [interaction, view, themes]
related:
  - .lore/work/design/targeting-interaction.html
  - .lore/work/plans/player-feedback-selection-and-progress.html
---

# Implementation plan: multi-select picked-card highlight

## Goal

Give cards that belong to an in-progress multi-pick step their own visual identity: a distinct border/fill (`"picked"`) plus a non-color checkmark badge owned by `CardView`. Today every card in `sel.current` renders as `"selected"` — the same border as the single acting card — so a `destroyHand`/`returnWorld` batch is visually indistinguishable from the spell being resolved, and the only signal is border color, which this codebase explicitly treats as insufficient (the emphasis-glow rule: "unmistakable beyond a colour change").

This extends the established highlight precedence chain in `classifyHighlight` (which already distinguishes `selected`, `target`, `discard`, `committed`, `none`) with one more sibling kind. It changes no core logic and no rules — it is a renderer-side projection only.

### Scope decisions (carried from the design discussion)

- **Checkmark, not a number.** `destroyHand`/`returnWorld` are sets, not ordered, so a per-card index would imply an order that doesn't exist. The running count already lives in the hint text (`hintForSelection`). The per-card badge says only "in the set."
- **Only `stepMax > 1` steps get `"picked"`.** Single-target steps (`hazard`, `discardPlayer`, max 1) keep reading as `"selected"`, preserving today's behavior where the acting card and a single chosen target share one look.

## Affected files

| File | Change |
|---|---|
| `src/game/interaction/selection.ts` | Export `stepMax` (currently module-private) |
| `src/game/interaction/highlight.ts` | Add `"picked"` to `HighlightKind`; split the `current` branch by `stepMax` |
| `src/game/view/presentation.ts` | Add `"picked"` case to `highlightDescriptor` |
| `src/game/view/themes/theme.ts` | Add `pickedBorder: number` to `FrameStyle` |
| `src/game/view/themes/starter.ts` | Add `pickedBorder` to the literal |
| `src/data/worlds/{zombie-big-box,highway-volcano,fog-beach-party,overgrown-mall,bird-building}/theme.ts` | Add `pickedBorder` to each literal (5 files) |
| `src/game/view/CardView.ts` | Lazy checkmark `pickBadge` + idempotent toggle in `applyHighlight` |
| `src/game/tests/highlight.test.ts` | Cases for the new `picked` branch (multi vs single) |
| `src/game/tests/presentation.test.ts` | `highlightDescriptor("picked", …)` assertion |
| `src/game/tests/cardObjects.test.ts` | Badge appears for `picked`, hidden otherwise; idempotent |
| `src/game/tests/theme.test.ts` | `pickedBorder` present + distinct per theme |

No change to `TableScene.ts`: `applyHighlight` is the single entry point already called for every card every `drawAll` cycle, so the new kind and badge reconcile automatically when `togglePick` mutates `current`.

## Step sequence

The data plumbing (kind + color) must exist before the consumers (descriptor, classifier, CardView) compile. Order is dependency-driven.

```
S1 selection.ts ──┐
                  ├─► S3 highlight.ts ──┐
S2 theme.ts ──────┴─► S4 presentation ─┴─► S5 CardView ──► S6 tests ──► S7 validation
   (+ 6 literals)
```

### S1 — Export `stepMax` from `selection.ts`

`stepMax` is defined but module-private (`selection.ts:69`). `classifyHighlight` needs it to read the active step's cardinality. Change `function stepMax` to `export function stepMax`. No behavior change; `stepMin` stays private (only max gates the multi-pick look).

Note for the importer: `highlight.ts` already imports from `./selection` as **type-only** (`import type { SelectionState, StepResult } from "./selection"`). `stepMax` is a value, so this line must be restructured — either a separate `import { stepMax } from "./selection";` or an inline type modifier (`import { stepMax, type SelectionState, type StepResult }`). Don't just append to the existing `import type` line; that would fail to import a value.

> **Validation gate:** `bun run test` still green (no consumer change yet); `bun run typecheck` clean.

### S2 — Add `pickedBorder` to `FrameStyle` and every theme literal

Add `pickedBorder: number` to the `FrameStyle` interface in `theme.ts` with a comment ("in-progress multi-pick batch member; distinct from selectedBorder and committedTarget"). Then add a concrete value to all six literals: `starter.ts` plus the five world themes. Each value must be visually distinct from that theme's own `selectedBorder` (the acting card) and `committedTarget` (settled earlier picks) — pick a hue in the theme's family that reads as "grouped/active batch."

This is a mechanical fan-out across 6 files; once the interface field is non-optional, TypeScript flags every literal missing it, so the compiler drives completeness.

> **Validation gate:** `bun run typecheck` clean — no theme literal missing `pickedBorder`.

### S3 — Add `"picked"` kind and split the `current` branch

In `highlight.ts`:
- Add `"picked"` to the `HighlightKind` union (after `"selected"`).
- Import `stepMax` from `./selection`.
- Replace the picks-accumulating branch (`highlight.ts:62-65`) so a member of `sel.current` is `"picked"` when the active step is multi-pick, `"selected"` otherwise:

```ts
if (sel.phase === "targeting" && sel.current.includes(id)) {
  const step = sel.steps[sel.stepIdx];
  const multi = step !== undefined && stepMax(step) > 1;
  return { kind: multi ? "picked" : "selected", dim: false };
}
```

The acting-card branch (`sel.cardId === id`, line 47) is untouched — the spell being resolved stays `"selected"` even during a multi-pick step. Precedence is preserved: acting card → legal target → discard → playable → **picked/selected (current)** → committed → fall-through.

The real gate is `stepMax(step) > 1`, **not** the step kind. `destroyHand` is not inherently multi-pick: shipped cards carry `DestroyCardInHand min:1 max:1` (single-pick) as well as multi. A `destroyHand max:1` pick must read as `"selected"`, same as `hazard`/`discardPlayer`. Write the condition against cardinality so a future edit to "check `step.kind === 'destroyHand' || 'returnWorld'`" would be caught by tests (see S6).

> **Validation gate:** `bun run typecheck` clean. `highlightDescriptor` is now non-exhaustive over the union — S4 fixes it; expect a compile error here until S4 lands, so S3+S4 land together.

### S4 — Add the `"picked"` descriptor

In `presentation.ts`, add a case to `highlightDescriptor` (the only consumer of `HighlightKind` that switches exhaustively). Distinct border with a faint group-fill, sitting between bright `selected` (no fill) and muted settled `committed`:

```ts
case "picked":
  return {
    strokeWidth: 3,
    strokeColor: frameStyle.pickedBorder,
    fillColor: frameStyle.pickedBorder,
    fillAlpha: 0.22,
  };
```

> **Validation gate:** `bun run typecheck` clean (union exhaustive again); `bun run test` green.

### S5 — CardView checkmark badge (the extension)

In `CardView.ts`, add the non-color affordance, mirroring two existing patterns: the lazy `obtainGlow()` (line 524) and the idempotency tracker `concealedNow` (line 164).

- New private fields: `private pickBadge?: Phaser.GameObjects.Container;` and `private pickedNow: boolean | undefined = undefined;`.
- `private obtainPickBadge(color: number): Phaser.GameObjects.Container` — build once: a small filled circle (fill `color`, passed from `applyHighlight` as `frameStyle.pickedBorder` so chip and border share a hue) plus a checkmark glyph, positioned top-left inside the card edge, added to `this`. Return the cached container on subsequent calls. The color is consumed at construction time only, not stored — cards are rebuilt by `drawAll` on a world/theme change, so a cached badge never needs to repaint to a new `frameStyle`.
- **Geometry:** `(-CARD_W/2 + 12, -CARD_H/2 + 12)` = `(-63, -86)` is a *starting* coordinate, not final. The name text is centered at `y = -82` and world keywords add a line at `y = -73`, so an 8px-radius chip there overlaps the title. Expect to nudge down to roughly `(-63, -72)` to clear the name baseline; confirm in the browser pass.
- Extend `applyHighlight(kind, frameStyle)` to drive the badge from `kind`, idempotently:

```ts
applyHighlight(kind: HighlightKind, frameStyle: FrameStyle): void {
  const { strokeWidth, strokeColor, fillColor, fillAlpha } =
    highlightDescriptor(kind, frameStyle);
  this.highlightRect.setFillStyle(fillColor, fillAlpha);
  this.highlightRect.setStrokeStyle(strokeWidth, strokeColor);

  const picked = kind === "picked";
  if (this.pickedNow !== picked) {
    this.pickedNow = picked;
    this.obtainPickBadge().setVisible(picked);
  }
}
```

Idempotency matters: `applyHighlight` runs for every card every `drawAll` cycle, so an unchanged `picked` state must not rebuild or re-toggle the badge (no flicker), exactly as `applyConcealment` guards on `concealedNow`.

The non-`CardView` fallback path in the module-level `applyCardHighlight` (line 554) keeps working — it only restyles `list[1]` and never had a badge; cards routed through it are legacy/test containers, not multi-pick hand cards.

> **Validation gate:** `bun run typecheck` + `bun run lint` clean (watch the core/game boundary lint — all of this is renderer-side, so it should pass); `bun run test` green.

### S6 — Tests

- **`highlight.test.ts`** — a `returnWorld`/`destroyHand` step (max > 1) with a card in `current` classifies as `picked`; a `hazard`/`discardPlayer` step (max 1) with a card in `current` stays `selected`; **a `destroyHand` step with `max: 1` and a card in `current` stays `selected`** (the cardinality-not-kind guard — most likely future regression target); the acting card stays `selected` during a multi-pick step; precedence vs `committed` and `target` unchanged.
- **`presentation.test.ts`** — `highlightDescriptor("picked", frameStyle)` returns `pickedBorder` stroke, width 3, and the group fill.
- **`cardObjects.test.ts`** — `applyHighlight("picked", …)` makes the badge visible; any other kind hides it; calling twice with `"picked"` does not rebuild the badge (idempotent). Plus one assertion on the fallback path: `applyCardHighlight("picked", plainContainer, frameStyle)` on a non-`CardView` container applies the `pickedBorder` stroke/fill to `list[1]` and throws nothing (no badge, by design).
- **`theme.test.ts`** — every theme defines `pickedBorder`, and it differs from that theme's `selectedBorder` and `committedTarget`.

> **Validation gate:** `bun run test` green with the new cases; coverage on the new branch in `classifyHighlight` and the new `highlightDescriptor` case.

### S7 — Validation against this plan

Re-read this plan and confirm: (1) `"picked"` is applied only for `stepMax > 1` steps; (2) the acting card still reads `"selected"`; (3) the badge is a checkmark (no order number); (4) `applyHighlight` is the only touch point — `TableScene` unchanged; (5) all six theme literals carry a distinct `pickedBorder`; (6) the badge toggle is idempotent across reconcile cycles. Run the full gate: `bun run lint && bun run typecheck && bun run test`.

> **Validation gate:** all four checks pass; no core/game boundary violation; full suite green.

## Risks and notes

- **S3 and S4 are a single compile unit.** Adding `"picked"` to the union breaks `highlightDescriptor`'s exhaustiveness until its case exists. Land them in one change so the tree never has a red intermediate state.
- **Badge geometry vs. existing corners.** The top-left at `-CARD_W/2 + 12` should clear the name text (top-centered) and the energy badge (top-right, `CARD_W/2 - 16`). Confirm visually; nudge if it collides with name wrap on long titles.
- **Color distinctness is a judgment call per theme.** The `theme.test.ts` distinctness assertion is the guardrail, but "distinct enough to read at a glance" is a manual check — worth a browser pass (REQ-style visual verification) before merge, since automated tests can't see contrast.
- **Manual verification required.** Per project convention, runtime-visual behavior (does the batch read as a group; does the checkmark appear on toggle) needs a browser pass, not just green tests. Drive a `destroyHand`/`returnWorld` card and confirm the picked batch is unmistakable.
