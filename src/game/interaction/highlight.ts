/**
 * Pure highlight classification for table cards.
 *
 * Decides which highlight a card should show and whether it should be dimmed,
 * from the selection state and the legal/playable/discardable sets. No Phaser:
 * `render.ts`'s applyCardHighlight/dimCard apply the verdict. Co-located with
 * the selection state it reads so the precedence rules have one home.
 */
import type { Card } from '../../core/index'
import type { SelectionState, StepResult } from './selection'

/** Visual highlight applied to a card's overlay rectangle. */
export type HighlightKind = 'selected' | 'target' | 'discard' | 'committed' | 'none'

/** True when `id` appears in any completed step result. */
function isCommitted(done: readonly StepResult[], id: string): boolean {
  return done.some(
    (r) =>
      (r.kind === 'hazard' && r.targetId === id) ||
      (r.kind === 'destroyHand' && r.destroyId === id) ||
      (r.kind === 'returnWorld' && r.returnIds.includes(id)) ||
      (r.kind === 'discardPlayer' && r.discardId === id),
  )
}

/**
 * Classify a card's highlight + dim state. Precedence (first match wins):
 * the actively-selected card, a live legal target, a discardable hazard (idle),
 * a playable player card (idle), a pick in progress for the current step,
 * a card committed by an earlier completed step, then the dimmed/neutral fall-through.
 */
export function classifyHighlight(
  sel: SelectionState,
  card: Card,
  playableIds: ReadonlySet<string>,
  discardableIds: ReadonlySet<string>,
  legalTargetIds: ReadonlySet<string>,
): { kind: HighlightKind; dim: boolean } {
  const id = card.id

  // Selected card (awaiting-modal and targeting both carry cardId)
  if ('cardId' in sel && sel.cardId === id) return { kind: 'selected', dim: false }

  // Legal target during a targeting phase
  if (legalTargetIds.has(id)) return { kind: 'target', dim: false }

  // Discardable world card (only outside a selection)
  if (discardableIds.has(id) && sel.phase === 'idle') return { kind: 'discard', dim: false }

  // Playable player card (idle state)
  if (card.kind === 'player' && playableIds.has(id) && sel.phase === 'idle') {
    return { kind: 'none', dim: false }
  }

  // Picks accumulating for the current step stay lit as 'selected'.
  if (sel.phase === 'targeting' && sel.current.includes(id)) {
    return { kind: 'selected', dim: false }
  }

  // Cards committed by earlier completed steps stay lit with a muted 'committed'
  // mark — they are no longer live targets but must not go dark.
  if (sel.phase === 'targeting' && isCommitted(sel.done, id)) {
    return { kind: 'committed', dim: false }
  }

  // Everything else: dimmed when a selection is active, or for an unplayable
  // player card outside a selection; otherwise neutral and undimmed.
  if (sel.phase !== 'idle') return { kind: 'none', dim: true }
  if (card.kind === 'player' && !playableIds.has(id)) return { kind: 'none', dim: true }
  return { kind: 'none', dim: false }
}
