import { describe, expect, it } from 'bun:test'
import { createRng } from '../../core/engine/rng'
import type { CardEffect, GameState, PlayerCard, WorldCard } from '../../core/index'
import { previewPlay } from '../../core/view/describe'
import { ringFraction, selectConnectorStyle, connectorLine, effectAtStep } from '../interaction/feedback'

// ---------------------------------------------------------------------------
// Helpers — mirror describe.test.ts so fixtures stay consistent.
// ---------------------------------------------------------------------------

function makeState(progress: Record<string, number> = {}): GameState {
  return {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    totalActs: 3,
    progress,
    hp: 10,
    energy: 0,
    skipDrawNext: false,
    pendingForceDestroy: 0,
    braceCharges: 0,
    status: 'playing',
    worldId: 'zombie-big-box',
    rng: createRng(0),
    nextId: 0,
  }
}

function player(effect: CardEffect): PlayerCard {
  return { kind: 'player', id: 'p1', name: 'Test', insetKey: undefined, sourceWorldId: 'test', effect, energyCost: 0 }
}

function hazard(over: Partial<WorldCard>): WorldCard {
  return {
    kind: 'world',
    id: 'w1',
    name: 'Zombie',
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: true,
    canExile: true,
    onDiscarded: { kind: 'None' },
    onCleared: { kind: 'None' },
    onEndOfTurn: { kind: 'None' },
    ...over,
  }
}

// ---------------------------------------------------------------------------
// ringFraction
// ---------------------------------------------------------------------------

describe('ringFraction', () => {
  it('is 0 at zero progress', () => {
    expect(ringFraction(0, 2)).toBe(0)
  })

  it('is 0.5 at half (progress 1, cost 2)', () => {
    expect(ringFraction(1, 2)).toBe(0.5)
  })

  it('is 1.0 when progress equals cost', () => {
    expect(ringFraction(2, 2)).toBe(1)
  })

  it('clamps to 1.0 when progress exceeds cost (progress 3, cost 2)', () => {
    expect(ringFraction(3, 2)).toBe(1)
  })

  it('clamps to 0 for negative progress', () => {
    expect(ringFraction(-5, 2)).toBe(0)
  })

  it('is correct at the cost-10 boss (progress 5, cost 10 -> 0.5)', () => {
    expect(ringFraction(5, 10)).toBe(0.5)
  })

  it('guards divide-by-zero: cost 0 -> 0', () => {
    expect(ringFraction(3, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// selectConnectorStyle
// ---------------------------------------------------------------------------

describe('selectConnectorStyle', () => {
  it('maps DealProgress -> progress', () => {
    expect(selectConnectorStyle({ kind: 'DealProgress', base: 1 })).toBe('progress')
  })

  it('maps DestroyCardInHand -> destroy', () => {
    expect(selectConnectorStyle({ kind: 'DestroyCardInHand', min: 0, max: 1 })).toBe('destroy')
  })

  it('maps ReturnWorldCards -> return', () => {
    expect(selectConnectorStyle({ kind: 'ReturnWorldCards', min: 0, max: 2 })).toBe('return')
  })

  it('resolves through a Modal branch (Sprint hit branch)', () => {
    const sprint: CardEffect = {
      kind: 'Modal',
      branches: [
        { kind: 'Draw', player: 2, world: 1 },
        { kind: 'DealProgress', base: 1, bonus: { tag: 'Slow', amount: 1 } },
      ],
    }
    expect(selectConnectorStyle(sprint)).toBe('progress')
  })

  it('resolves through a Sequence step (Barricade returns world cards)', () => {
    const barricade: CardEffect = {
      kind: 'Sequence',
      steps: [
        { kind: 'DealProgress', base: 1 },
        { kind: 'ReturnWorldCards', min: 0, max: 2 },
      ],
    }
    // First matching step wins; DealProgress comes first here.
    expect(selectConnectorStyle(barricade)).toBe('progress')
  })

  it('resolves a Sequence to return when no earlier kind matches', () => {
    const seq: CardEffect = {
      kind: 'Sequence',
      steps: [
        { kind: 'Heal', amount: 2 },
        { kind: 'ReturnWorldCards', min: 1, max: 1 },
      ],
    }
    expect(selectConnectorStyle(seq)).toBe('return')
  })

  it('returns null for an effect with none of the three kinds', () => {
    expect(selectConnectorStyle({ kind: 'Heal', amount: 2 })).toBeNull()
    expect(selectConnectorStyle({ kind: 'None' })).toBeNull()
    expect(
      selectConnectorStyle({
        kind: 'Modal',
        branches: [
          { kind: 'Draw', player: 1 },
          { kind: 'Heal', amount: 1 },
        ],
      }),
    ).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Agreement test (FEEDBACK-10): ringFraction reaches 1.0 exactly when
// previewPlay reports a clear, for the same numbers. We sample three points
// around the cost threshold using a real card + target + progress triple.
// ---------------------------------------------------------------------------

describe('ringFraction agrees with previewPlay (FEEDBACK-10)', () => {
  // Explore deals base Progress; The Walker is the cost-10 boss. We vary the
  // already-dealt progress so total lands at cost-1, cost, and cost+1, then
  // assert the *contract*: ringFraction reaches 1.0 exactly when previewPlay's
  // real output says the target clears. We read the "clears" verdict back from
  // previewPlay rather than pinning its wording, and we derive the per-play
  // `amount` from previewPlay too — so this test survives a change to the
  // sentence or to the card's base value, as long as the two thresholds still
  // agree.
  const explore = player({ kind: 'DealProgress', base: 1 })
  const cost = 10

  // previewPlay starts every line with "Make <amount> Progress →"; pull the amount out
  // of its real output so the test never restates the card's base value.
  function amountDealt(output: string | null): number {
    const match = output?.match(/Make (\d+) Progress/)
    if (match === null || match === undefined) throw new Error(`unexpected preview: ${output}`)
    return Number(match[1])
  }

  function previewClears(output: string | null): boolean {
    return output?.includes('clears') ?? false
  }

  // total = already-dealt + this play's amount. Offsets land total at the three
  // points around the cost threshold without assuming what `amount` is.
  for (const { label, offset } of [
    { label: 'not yet: total = cost-1', offset: -1 },
    { label: 'clears: total = cost', offset: 0 },
    { label: 'already over: total = cost+1', offset: 1 },
  ]) {
    it(`${label} -> ringFraction === 1 iff previewPlay clears`, () => {
      const walker = hazard({ id: 'w9', name: 'The Walker', cost })
      // Probe amount with zero prior progress, then place `already` so the
      // resulting total equals cost + offset.
      const amount = amountDealt(previewPlay(explore, walker, makeState({ w9: 0 })))
      const already = cost + offset - amount
      const total = already + amount
      expect(total).toBe(cost + offset)

      const output = previewPlay(explore, walker, makeState({ w9: already }))
      // The contract: the ring is full exactly when the preview reports a clear.
      expect(ringFraction(total, cost) === 1).toBe(previewClears(output))
    })
  }
})

// ---------------------------------------------------------------------------
// connectorLine
// ---------------------------------------------------------------------------

describe('connectorLine', () => {
  it('returns the source and target centres as the two endpoints', () => {
    const line = connectorLine({ x: 100, y: 420 }, { x: 300, y: 180 })
    expect(line.from).toEqual({ x: 100, y: 420 })
    expect(line.to).toEqual({ x: 300, y: 180 })
  })

  it('copies the points (does not alias the inputs)', () => {
    const source = { x: 10, y: 20 }
    const target = { x: 30, y: 40 }
    const line = connectorLine(source, target)
    source.x = 999
    target.y = 999
    expect(line.from).toEqual({ x: 10, y: 20 })
    expect(line.to).toEqual({ x: 30, y: 40 })
  })

  it('handles coincident source and target (zero-length line)', () => {
    const line = connectorLine({ x: 50, y: 50 }, { x: 50, y: 50 })
    expect(line.from).toEqual({ x: 50, y: 50 })
    expect(line.to).toEqual({ x: 50, y: 50 })
  })
})

// ---------------------------------------------------------------------------
// effectAtStep — resolve the per-step effect through Sequence / Modal
// ---------------------------------------------------------------------------

describe('effectAtStep', () => {
  const deal: CardEffect = { kind: 'DealProgress', base: 1 }
  const ret: CardEffect = { kind: 'ReturnWorldCards', min: 1, max: 2 }

  it('returns a single effect regardless of step', () => {
    expect(effectAtStep(deal, 0)).toEqual(deal)
    expect(effectAtStep(deal, 5)).toEqual(deal)
  })

  it('indexes Sequence steps and Modal branches by step', () => {
    const seq: CardEffect = { kind: 'Sequence', steps: [deal, ret] }
    expect(effectAtStep(seq, 0)).toEqual(deal)
    expect(effectAtStep(seq, 1)).toEqual(ret)

    const modal: CardEffect = { kind: 'Modal', branches: [deal, ret] }
    expect(effectAtStep(modal, 0)).toEqual(deal)
    expect(effectAtStep(modal, 1)).toEqual(ret)
  })

  it('returns null for an out-of-range step/branch', () => {
    expect(effectAtStep({ kind: 'Sequence', steps: [deal] }, 3)).toBeNull()
    expect(effectAtStep({ kind: 'Modal', branches: [deal] }, 3)).toBeNull()
  })
})
