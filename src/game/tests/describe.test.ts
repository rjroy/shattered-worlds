import { describe, expect, it } from 'bun:test'
import { createRng } from '../../core/engine/rng'
import type { CardEffect, GameState, PlayerCard, WorldCard } from '../../core/index'
import { describeEffect, previewPlay } from '../interaction/describe'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(progress: Record<string, number> = {}): GameState {
  return {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    progress,
    hp: 20,
    skipDrawNext: false,
    status: 'playing',
    worldId: 'zombie-big-box',
    rng: createRng(0),
    nextId: 0,
  }
}

function player(effect: CardEffect): PlayerCard {
  return { kind: 'player', id: 'p1', name: 'Test', insetKey: undefined, sourceWorldId: 'test', effect }
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
    onDiscarded: { kind: 'None' },
    onCleared: { kind: 'None' },
    onEndOfTurn: { kind: 'None' },
    ...over,
  }
}

// ---------------------------------------------------------------------------
// describeEffect — every kind, with recursion
// ---------------------------------------------------------------------------

describe('describeEffect', () => {
  it('describes DealProgress with and without a keyword bonus', () => {
    expect(describeEffect({ kind: 'DealProgress', base: 1 })).toEqual(['Add 1 Progress'])
    expect(
      describeEffect({ kind: 'DealProgress', base: 1, bonus: { tag: 'Hidden', amount: 2 } }),
    ).toEqual(['Add 1 Progress\n(+2 vs Hidden)'])
  })

  it('describes Draw with player and/or world counts', () => {
    expect(describeEffect({ kind: 'Draw', player: 2, world: 1 })).toEqual(['Draw 2, +1 world'])
    expect(describeEffect({ kind: 'Draw', world: 1 })).toEqual(['+1 world'])
    expect(describeEffect({ kind: 'Draw', player: 2 })).toEqual(['Draw 2'])
  })

  it('describes the simple effects', () => {
    expect(describeEffect({ kind: 'Heal', amount: 2 })).toEqual(['Heal 2 HP'])
    expect(describeEffect({ kind: 'DestroyCardInHand', min: 0, max: 1 })).toEqual([
      'Destroy a card in hand',
      '(optional)',
      '',
    ])
    expect(describeEffect({ kind: 'DiscardThenDraw', player: 2 })).toEqual([
      'Discard a card, then draw 2',
    ])
    expect(describeEffect({ kind: 'AddCard', template: 'Listen', dest: 'playerDiscard' })).toEqual([
      'Gain a Listen card',
    ])
    expect(describeEffect({ kind: 'AddWorldCardToTop', template: 'Door' })).toEqual([
      '+Door to world deck',
    ])
  })

  it('describes ReturnWorldCards as a range or a fixed count', () => {
    expect(describeEffect({ kind: 'ReturnWorldCards', min: 0, max: 2 })).toEqual([
      'Return 0–2 world cards to the deck',
    ])
    expect(describeEffect({ kind: 'ReturnWorldCards', min: 1, max: 1 })).toEqual([
      'Return 1 world card to the deck',
    ])
  })

  it('recurses into Modal — header plus a bullet per branch (Sprint)', () => {
    const sprint: CardEffect = {
      kind: 'Modal',
      branches: [
        { kind: 'Draw', player: 2, world: 1 },
        { kind: 'DealProgress', base: 1, bonus: { tag: 'Slow', amount: 1 } },
      ],
    }
    expect(describeEffect(sprint)).toEqual([
      'Choose one:',
      '• Draw 2, +1 world',
      '• Add 1 Progress\n(+1 vs Slow)',
    ])
  })

  it('recurses into Sequence — one line per step, later steps prefixed "then" (Barricade)', () => {
    const barricade: CardEffect = {
      kind: 'Sequence',
      steps: [
        { kind: 'DealProgress', base: 1 },
        { kind: 'ReturnWorldCards', min: 0, max: 2 },
      ],
    }
    expect(describeEffect(barricade)).toEqual([
      'Add 1 Progress',
      'then return 0–2 world cards to the deck',
    ])
  })
})

// ---------------------------------------------------------------------------
// onDiscarded and onCleared effect kinds
// ---------------------------------------------------------------------------

describe('describeEffect (hazard effect kinds)', () => {
  it('covers every hazard effect kind', () => {
    expect(describeEffect({ kind: 'Damage', amount: 1 })).toEqual(['-1 HP'])
    expect(describeEffect({ kind: 'SkipDrawNextTurn' })).toEqual(['skip next draw'])
    expect(describeEffect({ kind: 'GainCard', template: 'Panic' })).toEqual(['gain Panic'])
    expect(describeEffect({ kind: 'AddPlayerCardToTop', template: 'Summon Door' })).toEqual([
      '+Summon Door to your deck',
    ])
    expect(describeEffect({ kind: 'SurviveWorld' })).toEqual(['you survive the world'])
    expect(describeEffect({ kind: 'None' })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// previewPlay — the live math
// ---------------------------------------------------------------------------

describe('previewPlay', () => {
  it('adds the keyword bonus and reports a clear (Baseball Bat vs Zombie)', () => {
    const bat = player({ kind: 'DealProgress', base: 2, bonus: { tag: 'Creature', amount: 3 } })
    const zombie = hazard({ name: 'Zombie', cost: 1, keywords: ['Slow', 'Creature'] })
    expect(previewPlay(bat, zombie, makeState())).toBe('Deals 5 → clears Zombie')
  })

  it('omits the bonus when the target lacks the tag', () => {
    const explore = player({ kind: 'DealProgress', base: 1, bonus: { tag: 'Hidden', amount: 1 } })
    const zombie = hazard({ name: 'Zombie', cost: 1, keywords: ['Creature'] })
    expect(previewPlay(explore, zombie, makeState())).toBe('Deals 1 → clears Zombie')
  })

  it('reports remaining Progress and counts what was already dealt this turn', () => {
    const explore = player({ kind: 'DealProgress', base: 1 })
    const walker = hazard({ id: 'w9', name: 'The Walker', cost: 10 })
    expect(previewPlay(explore, walker, makeState())).toBe('Deals 1 → 9 more to clear The Walker')
    expect(previewPlay(explore, walker, makeState({ w9: 3 }))).toBe(
      'Deals 1 → 6 more to clear The Walker',
    )
  })

  it('selects the chosen Modal branch (Sprint hit branch) and is null for the draw branch', () => {
    const sprint = player({
      kind: 'Modal',
      branches: [
        { kind: 'Draw', player: 2, world: 1 },
        { kind: 'DealProgress', base: 1, bonus: { tag: 'Slow', amount: 1 } },
      ],
    })
    const zombie = hazard({ name: 'Zombie', cost: 1, keywords: ['Slow', 'Creature'] })
    expect(previewPlay(sprint, zombie, makeState(), 1)).toBe('Deals 2 → clears Zombie')
    expect(previewPlay(sprint, zombie, makeState(), 0)).toBeNull()
  })

  it('looks through a Sequence to the Progress step (Barricade)', () => {
    const barricade = player({
      kind: 'Sequence',
      steps: [
        { kind: 'DealProgress', base: 1 },
        { kind: 'ReturnWorldCards', min: 0, max: 2 },
      ],
    })
    const sounds = hazard({ name: 'Strange Sounds', cost: 2 })
    expect(previewPlay(barricade, sounds, makeState())).toBe(
      'Deals 1 → 1 more to clear Strange Sounds',
    )
  })

  it('returns null for a non-Progress card (Med Kit)', () => {
    const medkit = player({ kind: 'Heal', amount: 2 })
    expect(previewPlay(medkit, hazard({}), makeState())).toBeNull()
  })
})
