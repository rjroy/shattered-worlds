/**
 * Pure highlight classification for table cards.
 *
 * Decides which highlight a card should show and whether it should be dimmed,
 * from the selection state and the legal/playable/discardable sets. No Phaser:
 * `render.ts`'s applyCardHighlight/dimCard apply the verdict. Co-located with
 * the selection state it reads so the precedence rules have one home.
 */
import type { Card } from '../../core/index'
import type { SelectionState } from './selection'

/** Visual highlight applied to a card's overlay rectangle. */
export type HighlightKind = 'selected' | 'target' | 'discard' | 'committed' | 'none'

/**
 * Classify a card's highlight + dim state. Precedence (first match wins):
 * the actively-selected card, a live legal target, a discardable hazard (idle),
 * a playable player card (idle), an already-chosen return target, the committed
 * hazard from an earlier step, then the dimmed/neutral fall-through.
 */
export function classifyHighlight(
  sel: SelectionState,
  card: Card,
  playableIds: ReadonlySet<string>,
  discardableIds: ReadonlySet<string>,
  legalTargetIds: ReadonlySet<string>,
): { kind: HighlightKind; dim: boolean } {
  const id = card.id

  // Selected card (all non-idle variants carry cardId)
  if ('cardId' in sel && sel.cardId === id) return { kind: 'selected', dim: false }

  // Legal target during a targeting phase
  if (legalTargetIds.has(id)) return { kind: 'target', dim: false }

  // Discardable world card (only outside a selection)
  if (discardableIds.has(id) && sel.phase === 'idle') return { kind: 'discard', dim: false }

  // Playable player card (idle state)
  if (card.kind === 'player' && playableIds.has(id) && sel.phase === 'idle') {
    return { kind: 'none', dim: false }
  }

  // During awaiting-return, mark already-selected return targets
  if (sel.phase === 'awaiting-return' && sel.selected.includes(id)) {
    return { kind: 'selected', dim: false }
  }

  // During awaiting-return, keep the hazard the earlier step locked onto lit with
  // a muted "committed" mark — it is no longer a live legal target but must not go
  // dark. After the legal-target/selected checks so an active card always wins.
  if (sel.phase === 'awaiting-return' && sel.targetId === id) {
    return { kind: 'committed', dim: false }
  }

  // Everything else: dimmed when a selection is active, or for an unplayable
  // player card outside a selection; otherwise neutral and undimmed.
  if (sel.phase !== 'idle') return { kind: 'none', dim: true }
  if (card.kind === 'player' && !playableIds.has(id)) return { kind: 'none', dim: true }
  return { kind: 'none', dim: false }
}
