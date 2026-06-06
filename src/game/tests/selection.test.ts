import { describe, expect, it } from 'bun:test'
import { activeStep, hintForSelection } from '../interaction/selection'
import type { SelectionState } from '../interaction/selection'

// ---------------------------------------------------------------------------
// activeStep — the shared step index for click gating / highlight / connector
// ---------------------------------------------------------------------------

describe('activeStep', () => {
  it('is 0 for non-targeting phases', () => {
    expect(activeStep({ phase: 'idle' })).toBe(0)
    expect(activeStep({ phase: 'selected', cardId: 'p1' })).toBe(0)
    expect(activeStep({ phase: 'awaiting-modal', cardId: 'p1' })).toBe(0)
    expect(activeStep({ phase: 'awaiting-discard', cardId: 'p1' })).toBe(0)
    expect(activeStep({ phase: 'awaiting-destroy', cardId: 'p1' })).toBe(0)
  })

  it('uses the chosen modal branch for awaiting-hazard, else 0', () => {
    expect(activeStep({ phase: 'awaiting-hazard', cardId: 'p1' })).toBe(0)
    expect(activeStep({ phase: 'awaiting-hazard', cardId: 'p1', modalChoice: 2 })).toBe(2)
  })

  it('advances awaiting-return to step 1 once its hazard target is chosen', () => {
    const base: SelectionState = {
      phase: 'awaiting-return',
      cardId: 'p1',
      selected: [],
      min: 1,
      max: 2,
    }
    expect(activeStep(base)).toBe(0)
    expect(activeStep({ ...base, targetId: 'w1' })).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// hintForSelection — phase instruction text + visibility
// ---------------------------------------------------------------------------

describe('hintForSelection', () => {
  it('hides the hint for idle and selected', () => {
    expect(hintForSelection({ phase: 'idle' })).toEqual({ text: '', visible: false })
    expect(hintForSelection({ phase: 'selected', cardId: 'p1' })).toEqual({
      text: '',
      visible: false,
    })
  })

  it('shows a fixed instruction for hazard / discard / destroy / modal phases', () => {
    expect(hintForSelection({ phase: 'awaiting-hazard', cardId: 'p1' })).toEqual({
      text: 'Select a Hazard target',
      visible: true,
    })
    expect(hintForSelection({ phase: 'awaiting-discard', cardId: 'p1' })).toEqual({
      text: 'Select a player card to discard',
      visible: true,
    })
    expect(hintForSelection({ phase: 'awaiting-destroy', cardId: 'p1' })).toEqual({
      text: 'Select a card to destroy (optional)',
      visible: true,
    })
    expect(hintForSelection({ phase: 'awaiting-modal', cardId: 'p1' })).toEqual({
      text: 'Choose an option above',
      visible: true,
    })
  })

  it('reports the min/max and running count for awaiting-return', () => {
    const hint = hintForSelection({
      phase: 'awaiting-return',
      cardId: 'p1',
      selected: ['w1'],
      min: 1,
      max: 3,
    })
    expect(hint.visible).toBe(true)
    expect(hint.text).toBe('Select 1–3 world cards to return (1 chosen)')
  })
})
