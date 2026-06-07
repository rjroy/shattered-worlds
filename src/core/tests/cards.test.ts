import { describe, expect, it } from 'bun:test'
import type { CardTemplateId, GameState } from '../model/types'
import { mintCard } from '../model/cards'
import { UnknownTemplateError } from '../model/errors'
import { createRng } from '../engine/rng'
import { catalog } from './testFixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyState(nextId = 0): GameState {
  return {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    totalActs: 3,
    progress: {},
    hp: 10,
    energy: 0,
    skipDrawNext: false,
    pendingForceDestroy: 0,
    status: 'playing',
    worldId: 'zombie-big-box',
    rng: createRng(0),
    nextId,
  }
}

const ALL_TEMPLATE_IDS: readonly CardTemplateId[] = [
  'Sprint',
  'Explore',
  'Barricade',
  'Med Kit',
  'Panic',
  'Adrenaline',
  'Listen',
  'Baseball Bat',
  'Regroup',
  'Summon Door',
  'Strange Sounds',
  'Rubble',
  'Screams',
  'Zombie',
  'Find Baseball Bat',
  'The Walker',
  'Door',
]

// ---------------------------------------------------------------------------
// 1. Catalog completeness
// ---------------------------------------------------------------------------

describe('catalog completeness', () => {
  it('all 17 CardTemplateIds mint a card without throwing', () => {
    for (const id of ALL_TEMPLATE_IDS) {
      expect(() => mintCard(catalog, makeEmptyState(), id)).not.toThrow()
    }
  })

  it('catalog has exactly 17 entries', () => {
    expect(Object.keys(catalog)).toHaveLength(17)
  })
})

// ---------------------------------------------------------------------------
// 2. Starter deck
// ---------------------------------------------------------------------------

describe('starter deck', () => {
  const STARTER_SPEC: ReadonlyArray<[CardTemplateId, number]> = [
    ['Sprint', 2],
    ['Explore', 3],
    ['Barricade', 2],
    ['Med Kit', 1],
    ['Panic', 1],
    ['Adrenaline', 1],
  ]

  it('mints the correct 10 cards with matching names and kinds', () => {
    let state = makeEmptyState()
    const cards: ReturnType<typeof mintCard>[0][] = []

    for (const [templateId] of STARTER_SPEC) {
      const [card, next] = mintCard(catalog, state, templateId)
      cards.push(card)
      state = next
    }

    // Build expected name multiset
    const expectedNames: string[] = []
    for (const [templateId, count] of STARTER_SPEC) {
      for (let i = 0; i < count; i++) expectedNames.push(templateId)
    }

    // Re-mint all 10
    state = makeEmptyState()
    const allCards: ReturnType<typeof mintCard>[0][] = []
    for (const [templateId, count] of STARTER_SPEC) {
      for (let i = 0; i < count; i++) {
        const [card, next] = mintCard(catalog, state, templateId)
        allCards.push(card)
        state = next
      }
    }

    expect(allCards).toHaveLength(10)
    const names = allCards.map((c) => c.name)
    expect(names.sort()).toEqual(expectedNames.sort())
    expect(allCards.every((c) => c.kind === 'player')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. World card properties
// ---------------------------------------------------------------------------

describe('world card properties', () => {
  it('Door is discardable:false', () => {
    const [card] = mintCard(catalog, makeEmptyState(), 'Door')
    if (card.kind !== 'world') throw new Error('expected world card')
    expect(card.discardable).toBe(false)
  })

  it('all other world cards are discardable:true', () => {
    const worldTemplateIds: CardTemplateId[] = [
      'Strange Sounds',
      'Rubble',
      'Screams',
      'Zombie',
      'Find Baseball Bat',
      'The Walker',
    ]
    for (const id of worldTemplateIds) {
      const [card] = mintCard(catalog, makeEmptyState(), id)
      if (card.kind !== 'world') throw new Error(`expected world card for ${id}`)
      expect(card.discardable).toBe(true)
    }
  })

  it('The Walker has cost 10', () => {
    const [card] = mintCard(catalog, makeEmptyState(), 'The Walker')
    if (card.kind !== 'world') throw new Error('expected world card')
    expect(card.cost).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// 4. Deterministic id sequencing
// ---------------------------------------------------------------------------

describe('id sequencing', () => {
  it('minting 3 cards in sequence gives ids "0","1","2" and advances nextId to 3', () => {
    let state = makeEmptyState(0)

    const [c0, s1] = mintCard(catalog, state, 'Sprint')
    state = s1
    const [c1, s2] = mintCard(catalog, state, 'Explore')
    state = s2
    const [c2, s3] = mintCard(catalog, state, 'Zombie')
    state = s3

    expect(c0.id).toBe('0')
    expect(c1.id).toBe('1')
    expect(c2.id).toBe('2')
    expect(state.nextId).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 5. Unique ids across starter deck
// ---------------------------------------------------------------------------

describe('unique ids', () => {
  it('minting all 10 starter cards yields 10 unique ids', () => {
    const starterSpec: ReadonlyArray<CardTemplateId> = [
      'Sprint',
      'Sprint',
      'Explore',
      'Explore',
      'Explore',
      'Barricade',
      'Barricade',
      'Med Kit',
      'Panic',
      'Adrenaline',
    ]

    let state = makeEmptyState()
    const ids: string[] = []
    for (const templateId of starterSpec) {
      const [card, next] = mintCard(catalog, state, templateId)
      ids.push(card.id)
      state = next
    }

    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// 6. Starter provenance
// ---------------------------------------------------------------------------

describe('starter provenance', () => {
  it('mintCard stamps sourceWorldId from state.worldId', () => {
    const state = makeEmptyState()
    // makeEmptyState sets worldId: 'zombie-big-box'; override to 'starter'
    const starterState: GameState = { ...state, worldId: 'starter' }
    const [card] = mintCard(catalog, starterState, 'Sprint')
    if (card.kind !== 'player') throw new Error('expected player card')
    expect(card.sourceWorldId).toBe('starter')
  })

  it('mintCard stamps the active worldId, not a hardcoded value', () => {
    const state = makeEmptyState()
    const worldState: GameState = { ...state, worldId: 'zombie-big-box' }
    const [card] = mintCard(catalog, worldState, 'Listen')
    if (card.kind !== 'player') throw new Error('expected player card')
    expect(card.sourceWorldId).toBe('zombie-big-box')
  })
})

// ---------------------------------------------------------------------------
// 7. Unknown template throws UnknownTemplateError
// ---------------------------------------------------------------------------

describe('unknown template', () => {
  it('mintCard throws UnknownTemplateError for an unrecognised templateId', () => {
    const state = makeEmptyState()
    expect(() => mintCard(catalog, state, 'Nope')).toThrow(UnknownTemplateError)
  })

  it('UnknownTemplateError message includes the bad templateId', () => {
    const state = makeEmptyState()
    let caught: unknown
    try {
      mintCard(catalog, state, 'Nope')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(UnknownTemplateError)
    if (caught instanceof UnknownTemplateError) {
      expect(caught.message).toContain('Nope')
    }
  })
})

// ---------------------------------------------------------------------------
// 8. Energy cost
// ---------------------------------------------------------------------------

describe('energy cost', () => {
  it('minting a player card without energyCost field yields energyCost: 0 (default)', () => {
    const state = makeEmptyState()
    const [card] = mintCard(catalog, state, 'Sprint')
    if (card.kind !== 'player') throw new Error('expected player card')
    expect(card.energyCost).toBe(0)
  })

  it('starter deck cards have correct energyCost values', () => {
    const starterCards: Array<[CardTemplateId, number]> = [
      ['Sprint', 0],
      ['Sprint', 0],
      ['Explore', 0],
      ['Explore', 0],
      ['Explore', 0],
      ['Barricade', 1],
      ['Barricade', 1],
      ['Med Kit', 0],
      ['Panic', 0],
      ['Adrenaline', 0],
    ]

    let state = makeEmptyState()
    for (const [templateId, expectedEnergyCost] of starterCards) {
      const [card, next] = mintCard(catalog, state, templateId)
      if (card.kind !== 'player') throw new Error(`expected player card for ${templateId}`)
      expect(card.energyCost).toBe(expectedEnergyCost)
      state = next
    }
  })
})
