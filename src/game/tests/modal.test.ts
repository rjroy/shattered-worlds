import { describe, expect, it } from 'bun:test'
import { modalBranchViews } from '../view/modal'
import type { AvailableActions, CardEffect, TargetSpec } from '../../core/index'

function makeAvailable(targetsByStep: Record<number, string[]>): AvailableActions {
  return {
    playable: [],
    discardable: [],
    canEndTurn: true,
    legalTargets: (_cardId: string, step: number) => targetsByStep[step] ?? [],
  }
}

describe('modalBranchViews', () => {
  it('labels branches from their actual card effects', () => {
    const branchSpecs: TargetSpec[] = [
      { kind: 'none' },
      { kind: 'hazard' },
    ]
    const effectBranches: CardEffect[] = [
      { kind: 'Draw', player: 1 },
      { kind: 'DealProgress', base: 2, bonus: { tag: 'Slow', amount: 2 } },
    ]

    const views = modalBranchViews(branchSpecs, effectBranches, makeAvailable({ 1: ['w1'] }), 'p1')

    expect(views).toEqual([
      { label: 'Draw 1', isLegal: true },
      { label: 'Add 2 Progress\n(+2 vs Slow)', isLegal: true },
    ])
  })

  it('falls back to option labels when effect branch data is missing', () => {
    const views = modalBranchViews(
      [{ kind: 'none' }, { kind: 'none' }],
      [],
      makeAvailable({}),
      'p1',
    )

    expect(views.map((view) => view.label)).toEqual(['Option 1', 'Option 2'])
  })

  it('disables hazard branches with no legal targets for that branch index', () => {
    const branchSpecs: TargetSpec[] = [
      { kind: 'hazard' },
      { kind: 'hazard' },
      { kind: 'none' },
    ]

    const views = modalBranchViews(branchSpecs, [], makeAvailable({ 1: ['w1'] }), 'p1')

    expect(views.map((view) => view.isLegal)).toEqual([false, true, true])
  })
})
