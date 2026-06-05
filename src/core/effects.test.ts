import { describe, expect, it } from 'bun:test'
import {
  applyEffect,
  damage,
  dealProgress,
  destroyInHand,
  gainCard,
  returnToTopThree,
} from './effects'
import { mintCard } from './cards'
import { createWorld } from './world'
import type { GameState, WorldCard } from './types'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GameState for testing. Uses createWorld as a base so
 * nextId and rng are valid, then overrides piles as needed.
 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createWorld(catalog, worldData, 1)
  return {
    ...base,
    hand: [],
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    hp: 10,
    skipDrawNext: false,
    status: 'playing',
    ...overrides,
  }
}

/** Mint a single WorldCard and advance state. */
function mintWorld(state: GameState, name: Parameters<typeof mintCard>[2]): [WorldCard, GameState] {
  const [card, next] = mintCard(catalog, state, name)
  if (card.kind !== 'world') throw new Error(`${name} is not a world card`)
  return [card as WorldCard, next]
}

// ---------------------------------------------------------------------------
// 1. dealProgress keyword math
// ---------------------------------------------------------------------------

describe('dealProgress keyword math', () => {
  it('applies Creature bonus and auto-resolves Zombie (cost 1)', () => {
    let state = makeState()
    const [zombie, s1] = mintWorld(state, 'Zombie')
    state = { ...s1, hand: [zombie] }

    // Baseball Bat: base 2, bonus { tag: 'Creature', amount: 3 }
    const { state: after, events } = dealProgress(catalog, state, zombie.id, 2, {
      tag: 'Creature',
      amount: 3,
    })

    // Zombie has Creature keyword → total = 2 + 3 = 5
    const progressEvent = events.find((e) => e.type === 'ProgressDealt')
    expect(progressEvent).toBeDefined()
    if (progressEvent?.type === 'ProgressDealt') {
      expect(progressEvent.amount).toBe(5)
      expect(progressEvent.hazardTurnTotal).toBe(5)
    }

    // 5 >= cost 1: auto-resolved
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)
    expect(after.hand.find((c) => c.id === zombie.id)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 2. dealProgress no keyword bonus
// ---------------------------------------------------------------------------

describe('dealProgress no keyword bonus', () => {
  it('deals 1 progress to Strange Sounds with no bonus (no keywords, cost 2)', () => {
    let state = makeState()
    const [ss, s1] = mintWorld(state, 'Strange Sounds')
    state = { ...s1, hand: [ss] }

    // Explore: base 1, bonus { tag: 'Hidden', amount: 1 } — Strange Sounds has no keywords
    const { state: after, events } = dealProgress(catalog, state, ss.id, 1, {
      tag: 'Hidden',
      amount: 1,
    })

    const progressEvent = events.find((e) => e.type === 'ProgressDealt')
    expect(progressEvent).toBeDefined()
    if (progressEvent?.type === 'ProgressDealt') {
      // No keyword match → bonus not applied
      expect(progressEvent.amount).toBe(1)
      expect(progressEvent.hazardTurnTotal).toBe(1)
    }

    // 1 < 2 → not resolved
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(false)
    // Still in hand
    expect(after.hand.find((c) => c.id === ss.id)).toBeDefined()
    // Progress recorded
    expect(after.progress[ss.id]).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 3. Auto-resolve at threshold
// ---------------------------------------------------------------------------

describe('dealProgress auto-resolve at threshold', () => {
  it('resolves Strange Sounds when progress reaches cost 2', () => {
    let state = makeState()
    const [ss, s1] = mintWorld(state, 'Strange Sounds')
    // Pre-seed 1 progress from a previous turn
    state = { ...s1, hand: [ss], progress: { [ss.id]: 1 } }

    // Add 1 more → total = 2 = cost 2
    const { state: after, events } = dealProgress(catalog, state, ss.id, 1)

    const progressEvent = events.find((e) => e.type === 'ProgressDealt')
    expect(progressEvent).toBeDefined()
    if (progressEvent?.type === 'ProgressDealt') {
      expect(progressEvent.amount).toBe(1)
      expect(progressEvent.hazardTurnTotal).toBe(2)
    }

    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)
    expect(after.hand.find((c) => c.id === ss.id)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 4. returnToTopThree
// ---------------------------------------------------------------------------

describe('returnToTopThree', () => {
  it('merges returned cards into the first-3 pool and preserves the remainder', () => {
    let state = makeState()

    // Mint 5 world cards for the worldDraw pile
    const worldCardNames = [
      'Strange Sounds',
      'Rubble',
      'Screams',
      'Zombie',
      'Find Baseball Bat',
    ] as const
    const drawPile: WorldCard[] = []
    for (const name of worldCardNames) {
      const [card, next] = mintWorld(state, name)
      drawPile.push(card)
      state = next
    }

    // Mint 2 world cards to act as "returned" cards (currently in hand)
    const [xCard, s2] = mintWorld(state, 'Rubble')
    const [yCard, s3] = mintWorld(s2, 'Screams')
    state = { ...s3, hand: [xCard, yCard], worldDraw: drawPile }

    const { state: after, events } = returnToTopThree(state, [xCard.id, yCard.id])

    // Total cards in worldDraw: 5 original + 2 returned = 7
    expect(after.worldDraw).toHaveLength(7)

    // Positions 3 and 4 (0-indexed) must be the original D and E (indices 3 and 4)
    // drawPile[3] and drawPile[4] are the last two cards
    const trailD = drawPile[3]!
    const trailE = drawPile[4]!
    expect(after.worldDraw[5]).toEqual(trailD)
    expect(after.worldDraw[6]).toEqual(trailE)

    // The first 5 positions are a permutation of [A,B,C,X,Y]
    const topFive = after.worldDraw.slice(0, 5).map((c) => c.id)
    const expectedIds = new Set([
      drawPile[0]!.id,
      drawPile[1]!.id,
      drawPile[2]!.id,
      xCard.id,
      yCard.id,
    ])
    expect(new Set(topFive)).toEqual(expectedIds)

    // WorldCardsReturned event emitted with both ids
    const returnEvent = events.find((e) => e.type === 'WorldCardsReturned')
    expect(returnEvent).toBeDefined()
    if (returnEvent?.type === 'WorldCardsReturned') {
      expect(new Set(returnEvent.ids)).toEqual(new Set([xCard.id, yCard.id]))
    }

    // Cards removed from hand
    expect(after.hand).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 5. gainCard destinations
// ---------------------------------------------------------------------------

describe('gainCard destinations', () => {
  it('places card at front of playerDiscard', () => {
    const state = makeState()
    const { state: after, events } = gainCard(catalog, state, 'Sprint', 'playerDiscard')

    expect(after.playerDiscard).toHaveLength(1)
    const event = events.find((e) => e.type === 'CardGained')
    expect(event).toBeDefined()
    if (event?.type === 'CardGained') {
      expect(event.dest).toBe('playerDiscard')
      expect(after.playerDiscard[0]!.id).toBe(event.id)
    }
  })

  it('prepends card to playerDraw (playerDrawTop)', () => {
    let state = makeState()
    const [existing] = mintCard(catalog, state, 'Explore')
    state = { ...state, playerDraw: [existing] }

    const { state: after, events } = gainCard(catalog, state, 'Sprint', 'playerDrawTop')

    // New card is at index 0
    expect(after.playerDraw).toHaveLength(2)
    const event = events.find((e) => e.type === 'CardGained')
    expect(event).toBeDefined()
    if (event?.type === 'CardGained') {
      expect(event.dest).toBe('playerDrawTop')
      expect(after.playerDraw[0]!.id).toBe(event.id)
    }
  })

  it('prepends world card to worldDraw (worldDrawTop)', () => {
    let state = makeState()
    const [existingWorld] = mintCard(catalog, state, 'Rubble')
    state = { ...state, worldDraw: [existingWorld as WorldCard] }

    const { state: after, events } = gainCard(catalog, state, 'Door', 'worldDrawTop')

    expect(after.worldDraw).toHaveLength(2)
    const event = events.find((e) => e.type === 'CardGained')
    expect(event).toBeDefined()
    if (event?.type === 'CardGained') {
      expect(event.dest).toBe('worldDrawTop')
      expect(after.worldDraw[0]!.id).toBe(event.id)
    }
  })
})

// ---------------------------------------------------------------------------
// 6. damage and loss
// ---------------------------------------------------------------------------

describe('damage', () => {
  it('reduces HP and emits DamageDealt + HpChanged', () => {
    const state = makeState({ hp: 5 })
    const { state: after, events } = damage(state, 3)

    expect(after.hp).toBe(2)
    expect(after.status).toBe('playing')
    expect(events.some((e) => e.type === 'DamageDealt')).toBe(true)
    expect(events.some((e) => e.type === 'HpChanged')).toBe(true)
    expect(events.some((e) => e.type === 'WorldLost')).toBe(false)
  })

  it('sets status to lost and emits WorldLost when HP reaches 0', () => {
    const state = makeState({ hp: 5 })
    const { state: after, events } = damage(state, 5)

    expect(after.hp).toBe(0)
    expect(after.status).toBe('lost')
    expect(events.some((e) => e.type === 'WorldWon' === false)).toBe(true)
    expect(events.some((e) => e.type === 'WorldLost')).toBe(true)
  })

  it('sets status to lost when damage exceeds HP', () => {
    const state = makeState({ hp: 3 })
    const { state: after, events } = damage(state, 10)

    expect(after.hp).toBe(-7)
    expect(after.status).toBe('lost')
    expect(events.some((e) => e.type === 'WorldLost')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. SkipDrawNextTurn idempotent
// ---------------------------------------------------------------------------

describe('applyEffect SkipDrawNextTurn', () => {
  it('sets skipDrawNext to true', () => {
    const state = makeState({ skipDrawNext: false })
    const { state: after } = applyEffect(catalog, state, { kind: 'SkipDrawNextTurn' })
    expect(after.skipDrawNext).toBe(true)
  })

  it('is idempotent — calling twice still yields skipDrawNext true', () => {
    const state = makeState({ skipDrawNext: false })
    const { state: once } = applyEffect(catalog, state, { kind: 'SkipDrawNextTurn' })
    const { state: twice } = applyEffect(catalog, once, { kind: 'SkipDrawNextTurn' })
    expect(twice.skipDrawNext).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. SurviveWorld
// ---------------------------------------------------------------------------

describe('applyEffect SurviveWorld', () => {
  it('sets status to won and emits WorldWon', () => {
    const state = makeState()
    const { state: after, events } = applyEffect(catalog, state, { kind: 'SurviveWorld' })

    expect(after.status).toBe('won')
    expect(events.some((e) => e.type === 'WorldWon')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 9. applyEffect Modal
// ---------------------------------------------------------------------------

describe('applyEffect Modal (Sprint)', () => {
  it('choice=0 draws player+world cards', () => {
    let state = makeState()

    // Populate draw piles so draws can succeed
    const [p1, s1] = mintCard(catalog, state, 'Sprint')
    const [p2, s2] = mintCard(catalog, s1, 'Explore')
    const [w1, s3] = mintWorld(s2, 'Rubble')
    state = { ...s3, playerDraw: [p1, p2], worldDraw: [w1] }

    // Sprint effect: Modal [ Draw{player:2, world:1}, DealProgress{...} ]
    const sprintEffect = {
      kind: 'Modal' as const,
      branches: [
        { kind: 'Draw' as const, player: 2, world: 1 },
        { kind: 'DealProgress' as const, base: 1, bonus: { tag: 'Slow' as const, amount: 1 } },
      ],
    }

    const action = { type: 'PlayCard' as const, cardId: 'sprint-id', choice: 0 }
    const { state: after, events } = applyEffect(catalog, state, sprintEffect, action)

    // 2 player + 1 world drawn
    expect(after.hand.filter((c) => c.kind === 'player')).toHaveLength(2)
    expect(after.hand.filter((c) => c.kind === 'world')).toHaveLength(1)
    expect(events.some((e) => e.type === 'CardsDrawn')).toBe(true)
  })

  it('choice=1 deals progress to target', () => {
    let state = makeState()
    const [zombie, s1] = mintWorld(state, 'Zombie')
    state = { ...s1, hand: [zombie] }

    const sprintEffect = {
      kind: 'Modal' as const,
      branches: [
        { kind: 'Draw' as const, player: 2, world: 1 },
        { kind: 'DealProgress' as const, base: 1, bonus: { tag: 'Slow' as const, amount: 1 } },
      ],
    }

    const action = {
      type: 'PlayCard' as const,
      cardId: 'sprint-id',
      choice: 1,
      targetId: zombie.id,
    }
    const { events } = applyEffect(catalog, state, sprintEffect, action)

    // Zombie has Slow keyword → 1 + 1 = 2 progress, and cost is 1 → auto-resolves
    expect(events.some((e) => e.type === 'ProgressDealt')).toBe(true)
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 10. applyEffect Sequence (Barricade) — resolved hazard skipped gracefully
// ---------------------------------------------------------------------------

describe('applyEffect Sequence (Barricade)', () => {
  it('resolves Zombie in step 0, then step 1 returnIds with the resolved id is skipped', () => {
    let state = makeState()
    const [zombie, s1] = mintWorld(state, 'Zombie')
    // Also mint extra world cards to return so the return step isn't entirely empty
    const [rubble, s2] = mintWorld(s1, 'Rubble')
    state = { ...s2, hand: [zombie, rubble], worldDraw: [] }

    // Barricade: Sequence [ DealProgress{base:1}, ReturnWorldCards{min:0,max:2} ]
    const barricadeEffect = {
      kind: 'Sequence' as const,
      steps: [
        { kind: 'DealProgress' as const, base: 1 },
        { kind: 'ReturnWorldCards' as const, min: 0, max: 2 },
      ],
    }

    // action.returnIds includes the zombie id (which will be resolved by step 0)
    // and the rubble id (which is still in hand)
    const action = {
      type: 'PlayCard' as const,
      cardId: 'barricade-id',
      targetId: zombie.id,
      returnIds: [zombie.id, rubble.id] as readonly string[],
    }

    // Should not throw — missing zombie is skipped gracefully
    const { state: after, events } = applyEffect(catalog, state, barricadeEffect, action)

    // Step 0: Zombie resolved (cost 1, progress 1)
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)

    // Step 1: Rubble returned (zombie was not in hand at that point — skipped)
    const returnEvent = events.find((e) => e.type === 'WorldCardsReturned')
    expect(returnEvent).toBeDefined()
    if (returnEvent?.type === 'WorldCardsReturned') {
      // Only rubble should be in the returned list
      expect(returnEvent.ids).toContain(rubble.id)
      expect(returnEvent.ids).not.toContain(zombie.id)
    }

    // Rubble is no longer in hand
    expect(after.hand.find((c) => c.id === rubble.id)).toBeUndefined()
    // Rubble is now in worldDraw
    expect(after.worldDraw.find((c) => c.id === rubble.id)).toBeDefined()
  })

  it('handles Barricade with no valid returnIds (all already resolved)', () => {
    let state = makeState()
    const [zombie, s1] = mintWorld(state, 'Zombie')
    state = { ...s1, hand: [zombie], worldDraw: [] }

    const barricadeEffect = {
      kind: 'Sequence' as const,
      steps: [
        { kind: 'DealProgress' as const, base: 1 },
        { kind: 'ReturnWorldCards' as const, min: 0, max: 2 },
      ],
    }

    // returnIds only contains the zombie which will be resolved in step 0
    const action = {
      type: 'PlayCard' as const,
      cardId: 'barricade-id',
      targetId: zombie.id,
      returnIds: [zombie.id] as readonly string[],
    }

    // Should not throw
    expect(() => applyEffect(catalog, state, barricadeEffect, action)).not.toThrow()

    const { events } = applyEffect(catalog, state, barricadeEffect, action)
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)
    // No WorldCardsReturned event since nothing was actually returned
    expect(events.some((e) => e.type === 'WorldCardsReturned')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 11. destroyInHand
// ---------------------------------------------------------------------------

describe('destroyInHand', () => {
  it('removes the card from hand and emits CardDestroyed', () => {
    let state = makeState()
    const [sprint, s1] = mintCard(catalog, state, 'Sprint')
    state = { ...s1, hand: [sprint] }

    const { state: after, events } = destroyInHand(state, sprint.id)

    expect(after.hand).toHaveLength(0)
    expect(events.some((e) => e.type === 'CardDestroyed')).toBe(true)
  })

  it('does nothing when id is undefined (Regroup with no target)', () => {
    let state = makeState()
    const [sprint, s1] = mintCard(catalog, state, 'Sprint')
    state = { ...s1, hand: [sprint] }

    const { state: after, events } = destroyInHand(state, undefined)

    expect(after.hand).toHaveLength(1)
    expect(events).toHaveLength(0)
  })
})
