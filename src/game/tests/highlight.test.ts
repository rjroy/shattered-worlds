import { describe, expect, it } from 'bun:test'
import type { Card, PlayerCard, WorldCard } from '../../core/index'
import type { SelectionState } from '../interaction/selection'
import { classifyHighlight } from '../interaction/highlight'

function player(id: string): PlayerCard {
  return { kind: 'player', id, name: 'P', insetKey: undefined, sourceWorldId: 'test', effect: { kind: 'Draw', player: 1 }, energyCost: 0, keywords: [] }
}

function world(id: string, discardable = false): WorldCard {
  return {
    kind: 'world',
    id,
    name: 'W',
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable,
    canExile: true,
    onDiscarded: { kind: 'None' },
    onCleared: { kind: 'None' },
    onEndOfTurn: { kind: 'None' },
    onPartialClear: { kind: 'None' },
  }
}

const NONE = new Set<string>()
const set = (...ids: string[]): ReadonlySet<string> => new Set(ids)

function classify(sel: SelectionState, card: Card, opts: {
  playable?: ReadonlySet<string>
  discardable?: ReadonlySet<string>
  legal?: ReadonlySet<string>
} = {}) {
  return classifyHighlight(sel, card, opts.playable ?? NONE, opts.discardable ?? NONE, opts.legal ?? NONE)
}

describe('classifyHighlight', () => {
  it('marks the actively-selected card, undimmed', () => {
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p1',
      steps: [{ kind: 'hazard' }],
      stepIdx: 0,
      done: [],
      current: [],
    }
    expect(classify(sel, player('p1'))).toEqual({ kind: 'selected', dim: false })
  })

  it('marks a live legal target, undimmed', () => {
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p1',
      steps: [{ kind: 'hazard' }],
      stepIdx: 0,
      done: [],
      current: [],
    }
    expect(classify(sel, world('w1'), { legal: set('w1') })).toEqual({ kind: 'target', dim: false })
  })

  it('marks a discardable hazard only when idle', () => {
    const idle: SelectionState = { phase: 'idle' }
    expect(classify(idle, world('w1', true), { discardable: set('w1') })).toEqual({
      kind: 'discard',
      dim: false,
    })
    // During a selection, a discardable hazard that is not a target is dimmed.
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p2',
      steps: [{ kind: 'hazard' }],
      stepIdx: 0,
      done: [],
      current: [],
    }
    expect(classify(sel, world('w1', true), { discardable: set('w1') })).toEqual({
      kind: 'none',
      dim: true,
    })
  })

  it('leaves a playable player card neutral and undimmed when idle', () => {
    const idle: SelectionState = { phase: 'idle' }
    expect(classify(idle, player('p1'), { playable: set('p1') })).toEqual({
      kind: 'none',
      dim: false,
    })
  })

  it('dims an unplayable player card when idle', () => {
    const idle: SelectionState = { phase: 'idle' }
    expect(classify(idle, player('p1'))).toEqual({ kind: 'none', dim: true })
  })

  it('marks chosen return targets selected and the committed hazard distinct', () => {
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p1',
      steps: [{ kind: 'hazard' }, { kind: 'returnWorld', min: 1, max: 2 }],
      stepIdx: 1,
      done: [{ kind: 'hazard', targetId: 'w9' }],
      current: ['w2'],
    }
    expect(classify(sel, world('w2'))).toEqual({ kind: 'selected', dim: false })
    expect(classify(sel, world('w9'))).toEqual({ kind: 'committed', dim: false })
  })

  it('keeps a Cut It Loose destroy pick committed during hazard targeting', () => {
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p1',
      steps: [{ kind: 'destroyHand', min: 1, max: 1 }, { kind: 'hazard' }],
      stepIdx: 1,
      done: [{ kind: 'destroyHand', destroyId: 'p2' }],
      current: [],
    }
    expect(classify(sel, player('p2'))).toEqual({ kind: 'committed', dim: false })
    expect(classify(sel, world('w1'), { legal: set('w1') })).toEqual({
      kind: 'target',
      dim: false,
    })
  })

  it('legal-target precedence beats the committed mark', () => {
    const sel: SelectionState = {
      phase: 'targeting',
      cardId: 'p1',
      steps: [{ kind: 'hazard' }, { kind: 'returnWorld', min: 1, max: 2 }],
      stepIdx: 1,
      done: [{ kind: 'hazard', targetId: 'w9' }],
      current: [],
    }
    // If w9 is somehow still legal, the live-target highlight wins.
    expect(classify(sel, world('w9'), { legal: set('w9') })).toEqual({
      kind: 'target',
      dim: false,
    })
  })
})
