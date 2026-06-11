/**
 * Renderer-only selection state machine.
 *
 * Tracks the multi-step targeting process (idle → selected → collecting
 * targets → commit) without touching GameState. When a selection is
 * complete, `buildAction` emits a finished Action for dispatch.
 */
import type { Action, CardId, TargetSpec } from '../../core/index'

export type SelectionState =
  | { phase: 'idle' }
  | { phase: 'selected'; cardId: CardId, idx?: number }
  | { phase: 'awaiting-hazard'; cardId: CardId; idx?: number; targetId?: CardId; }
  | {
      phase: 'awaiting-return'
      cardId: CardId
      idx?: number
      selected: CardId[]
      min: number
      max: number
      targetId?: CardId
    }
  | { phase: 'awaiting-discard'; cardId: CardId; idx?: number; discardId?: CardId }
  | { phase: 'awaiting-destroy'; cardId: CardId; idx?: number; destroyId?: CardId }
  | { phase: 'awaiting-modal'; cardId: CardId; idx?: number }

export const IDLE: SelectionState = { phase: 'idle' }

// ---------------------------------------------------------------------------
// Pure state transitions
// ---------------------------------------------------------------------------

/**
 * From awaiting-modal, advance to the next phase based on the branch spec.
 * `choice` is the 0-based branch index; `spec` is the full modal TargetSpec.
 */
export function chooseModal(
  sel: SelectionState,
  choice: number,
  spec: Extract<TargetSpec, { kind: 'modal' }>,
): SelectionState {
  if (sel.phase !== 'awaiting-modal') return sel
  const branch = spec.branches[choice]
  if (branch === undefined) return sel
  const cardId = sel.cardId

  switch (branch.kind) {
    case 'hazard':
      return { phase: 'awaiting-hazard', cardId, idx: choice }
    case 'returnWorld':
      return {
        phase: 'awaiting-return',
        cardId,
        idx: choice,
        selected: [],
        min: branch.min,
        max: branch.max,
      }
    case 'none':
      // Immediate commit — caller should call buildAction after this
      return { phase: 'selected', cardId, idx: choice }
    default:
      return { phase: 'awaiting-hazard', cardId, idx: choice }
  }
}

/**
 * From selected, transition to the appropriate next phase based on the spec.
 */
export function getStepIndex(sel: SelectionState): number | undefined {
  return sel.phase === 'selected' || sel.phase === 'awaiting-hazard' || sel.phase === 'awaiting-return' || sel.phase === 'awaiting-discard' || sel.phase === 'awaiting-destroy' || sel.phase === 'awaiting-modal'
    ? sel.idx
    : undefined
}

/**
 * Add a target. For awaiting-return, appends to the multi-select list.
 * For awaiting-hazard, records the single hazard target.
 */
export function addTarget(sel: SelectionState, targetId: CardId): SelectionState {
  if (sel.phase === 'awaiting-return') {
    if (sel.selected.includes(targetId)) return sel
    if (sel.selected.length >= sel.max) return sel
    return { ...sel, selected: [...sel.selected, targetId] }
  }
  if (sel.phase === 'awaiting-hazard') {
    return { ...sel, targetId }
  }
  if (sel.phase === 'awaiting-discard') {
    return { ...sel, discardId: targetId }
  }
  if (sel.phase === 'awaiting-destroy') {
    return { ...sel, destroyId: targetId }
  }
  return sel
}

/** Remove a target from the return multi-select list. */
export function removeTarget(sel: SelectionState, targetId: CardId): SelectionState {
  if (sel.phase !== 'awaiting-return') return sel
  return { ...sel, selected: sel.selected.filter((id) => id !== targetId) }
}

/** Cancel from any state — always returns idle. */
export function cancel(): SelectionState {
  return IDLE
}

// ---------------------------------------------------------------------------
// Selection read-models (pure derivations from SelectionState)
// ---------------------------------------------------------------------------

/**
 * The active step/branch index for the current targeting phase — the single
 * source of truth shared by click gating, highlight, and the connector so they
 * can never disagree. awaiting-return advances to step 1 once its hazard target
 * is chosen; awaiting-hazard keys off the chosen modal branch; everything else
 * is step 0.
 */
export function activeStep(sel: SelectionState): number {
  if (sel.phase === 'awaiting-return') return sel.targetId !== undefined ? 1 : 0
  if (sel.phase === 'awaiting-hazard') return sel.idx ?? 0
  return 0
}

/** The phase-instruction text (and whether to show it) for a selection state. */
export function hintForSelection(sel: SelectionState): { text: string; visible: boolean } {
  switch (sel.phase) {
    case 'awaiting-hazard':
      return { text: 'Select a Hazard target', visible: true }
    case 'awaiting-return':
      return {
        text: `Select ${sel.min}–${sel.max} world cards to return (${sel.selected.length} chosen)`,
        visible: true,
      }
    case 'awaiting-discard':
      return { text: 'Select a player card to discard', visible: true }
    case 'awaiting-destroy':
      return { text: 'Select a card to destroy (optional)', visible: true }
    case 'awaiting-modal':
      return { text: 'Choose an option above', visible: true }
    case 'idle':
    case 'selected':
      return { text: '', visible: false }
  }
}

// ---------------------------------------------------------------------------
// Completion checks and action building
// ---------------------------------------------------------------------------

/** True when the selection is ready to commit. */
export function isComplete(sel: SelectionState): boolean {
  switch (sel.phase) {
    case 'idle':
      return false
    case 'selected':
      // 'none' spec — immediate commit
      return true
    case 'awaiting-hazard':
      return sel.targetId !== undefined
    case 'awaiting-return':
      return sel.selected.length >= sel.min
    case 'awaiting-discard':
      return sel.discardId !== undefined
    case 'awaiting-destroy':
      // min is 0, so destroy is optional — always committable once in this phase
      return true
    case 'awaiting-modal':
      return false
  }
}

/**
 * Build the core Action when the selection is complete. Returns null if the
 * selection is not yet ready to commit.
 */
export function buildAction(sel: SelectionState): Action | null {
  switch (sel.phase) {
    case 'idle':
    case 'awaiting-modal':
      return null

    case 'selected':
      const action: Extract<Action, { type: 'PlayCard' }> = { 
        type: 'PlayCard', cardId: sel.cardId 
      }
      if (sel.idx !== undefined) {
        return { ...action, choice: sel.idx }
      }
      return action

    case 'awaiting-hazard': {
      if (sel.targetId === undefined) return null
      const action: Extract<Action, { type: 'PlayCard' }> = {
        type: 'PlayCard',
        cardId: sel.cardId,
        targetId: sel.targetId,
      }
      if (sel.idx !== undefined) {
        return { ...action, choice: sel.idx }
      }
      return action
    }

    case 'awaiting-return': {
      if (sel.selected.length < sel.min) return null
      let action: Extract<Action, { type: 'PlayCard' }> = {
        type: 'PlayCard',
        cardId: sel.cardId,
        returnIds: sel.selected,
      }
      if (sel.targetId !== undefined) {
        action = { ...action, targetId: sel.targetId }
      }
      if (sel.idx !== undefined) {
        action = { ...action, choice: sel.idx }
      }
      return action
    }

    case 'awaiting-discard': {
      if (sel.discardId === undefined) return null
      const action: Extract<Action, { type: 'PlayCard' }> = {
        type: 'PlayCard',
        cardId: sel.cardId,
        discardId: sel.discardId
      }
      if (sel.idx !== undefined) {
        return { ...action, choice: sel.idx }
      }
      return action
    }

    case 'awaiting-destroy': {
      // destroyId is optional (min 0)
      let action: Extract<Action, { type: 'PlayCard' }> = {
        type: 'PlayCard',
        cardId: sel.cardId,
      }
      if (sel.idx !== undefined) {
        action = { ...action, choice: sel.idx }
      }
      if (sel.destroyId !== undefined) {
        action = { ...action, destroyId: sel.destroyId }
      }
      return action
    }
  }
}
