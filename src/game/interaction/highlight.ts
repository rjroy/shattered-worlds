/**
 * Pure highlight classification for table cards.
 *
 * Decides which highlight a card should show and whether it should be dimmed,
 * from the selection state and the legal/playable/discardable sets. No Phaser:
 * `render.ts`'s applyCardHighlight/dimCard apply the verdict. Co-located with
 * the selection state it reads so the precedence rules have one home.
 */
import type { Card } from "../../core/index";
import { doesStepResultContain, type SelectionState } from "./selection";

/** Visual highlight applied to a card's overlay rectangle. */
export type HighlightKind = "selected" | "picked" | "target" | "discard" | "committed" | "none";

/**
 * Classify a card's highlight + dim state. Precedence (first match wins):
 * the acting card (selected), any card chosen during this play — current step
 * or a prior completed step (picked), a live legal target not yet chosen
 * (target), discardable hazard when idle (discard), playable player card when
 * idle (none/undimmed), then dimmed/neutral fall-through.
 *
 * Picks precede legal-target: a card in sel.current stays in legalTargetIds
 * (it can be un-picked), but must read as "already chosen", not "available".
 */
export function classifyHighlight(
  sel: SelectionState,
  card: Card,
  playableIds: ReadonlySet<string>,
  discardableIds: ReadonlySet<string>,
  legalTargetIds: ReadonlySet<string>,
): { kind: HighlightKind; dim: boolean } {
  const id = card.id;

  // Selected card (awaiting-modal and targeting both carry cardId)
  if ("cardId" in sel && sel.cardId === id) return { kind: "selected", dim: false };

  // Any card chosen during this play — accumulating in the current step or
  // recorded in a prior completed step — shows as "picked". Comes before the
  // legal-target check because a current pick stays in legalTargetIds (can be
  // un-picked), but must read as "already chosen", not "available".
  if (sel.phase === "targeting") {
    if (sel.current.includes(id)) return { kind: "picked", dim: false };
    if (sel.done.some((result) => doesStepResultContain(result, id))) return { kind: "picked", dim: false };
  }

  // Legal target during a targeting phase (not yet picked)
  if (legalTargetIds.has(id)) return { kind: "target", dim: false };

  // Discardable world card (only outside a selection)
  if (discardableIds.has(id) && sel.phase === "idle") return { kind: "discard", dim: false };

  // Playable player card (idle state)
  if (card.kind === "player" && playableIds.has(id) && sel.phase === "idle") {
    return { kind: "none", dim: false };
  }

  // Everything else: dimmed when a selection is active, or for an unplayable
  // player card outside a selection; otherwise neutral and undimmed.
  if (sel.phase !== "idle") return { kind: "none", dim: true };
  if (card.kind === "player" && !playableIds.has(id)) return { kind: "none", dim: true };
  return { kind: "none", dim: false };
}
