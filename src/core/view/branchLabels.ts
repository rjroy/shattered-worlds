/**
 */
import { describeEffect } from './describe'
import type { AvailableActions, CardEffect, TargetSpec } from '../index'

export interface BranchLabel {
  label: string
  isLegal: boolean
}

/** Label a branch from its actual effect, so the chooser can't drift from the card. */
function branchLabel(effectBranch: CardEffect | undefined, idx: number): string {
  return effectBranch !== undefined ? describeEffect(effectBranch).join(', ') : `Option ${idx + 1}`
}

/** A branch is legal unless it needs a hazard target and none are available. */
function branchIsLegal(
  spec: TargetSpec,
  idx: number,
  available: AvailableActions,
  cardId: string,
): boolean {
  if (spec.kind === 'hazard') {
    return available.legalTargets(cardId, idx).length > 0
  }
  return true
}

/** Resolve the label + legality for each branch. */
export function resolveBranchLabels(
  branchSpecs: readonly TargetSpec[],
  effectBranches: readonly CardEffect[],
  available: AvailableActions,
  cardId: string,
): BranchLabel[] {
  return branchSpecs.map((spec, idx) => ({
    label: branchLabel(effectBranches[idx], idx),
    isLegal: branchIsLegal(spec, idx, available, cardId),
  }))
}
