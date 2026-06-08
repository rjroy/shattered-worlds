import { describe, expect, it } from 'bun:test'
import {
  applyEffect,
  damage,
  dealProgress,
  destroyInHand,
  gainCard,
  returnToActiveWorldDeck,
} from '../engine/effects'
import { mintCard } from '../model/cards'
import { createWorld } from '../engine/world'
import type { GameState, WorldCard } from '../model/types'
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
    energy: 0,
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
// 4. returnToActiveWorldDeck
// ---------------------------------------------------------------------------

describe('returnToActiveWorldDeck', () => {
  it('merges returned cards into the active world deck', () => {
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

    const { state: after, events } = returnToActiveWorldDeck(state, [xCard.id, yCard.id])

    // Total cards in worldDraw: 5 original + 2 returned = 7
    expect(after.worldDraw).toHaveLength(7)

    // The full deck is now shuffled together, so all 7 cards should be present.
    const shuffledIds = new Set(after.worldDraw.map((c) => c.id))
    const expectedIds = new Set([
      drawPile[0]!.id,
      drawPile[1]!.id,
      drawPile[2]!.id,
      drawPile[3]!.id,
      drawPile[4]!.id,
      xCard.id,
      yCard.id,
    ])
    expect(shuffledIds).toEqual(expectedIds)

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

    // Zombie has Slow keyword → 1 + 1 = 2 progress, and cost is 3 → not resolved yet
    expect(events.some((e) => e.type === 'ProgressDealt')).toBe(true)
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. applyEffect Sequence (Barricade) — resolved hazard skipped gracefully
// ---------------------------------------------------------------------------

describe('applyEffect Sequence (Barricade)', () => {
  it('resolves Rubble in step 0, then step 1 returnIds with the resolved id is skipped', () => {
    let state = makeState()
    const [rubble, s1] = mintWorld(state, 'Rubble')
    // Also mint extra world cards to return so the return step isn't entirely empty
    const [screams, s2] = mintWorld(s1, 'Screams')
    state = { ...s2, hand: [rubble, screams], worldDraw: [] }

    // Barricade: Sequence [ DealProgress{base:1}, ReturnWorldCards{min:0,max:2} ]
    const barricadeEffect = {
      kind: 'Sequence' as const,
      steps: [
        { kind: 'DealProgress' as const, base: 1 },
        { kind: 'ReturnWorldCards' as const, min: 0, max: 2 },
      ],
    }

    // action.returnIds includes the rubble id (which will be resolved by step 0)
    // and the screams id (which is still in hand)
    const action = {
      type: 'PlayCard' as const,
      cardId: 'barricade-id',
      targetId: rubble.id,
      returnIds: [rubble.id, screams.id] as readonly string[],
    }

    // Should not throw — missing rubble is skipped gracefully
    const { state: after, events } = applyEffect(catalog, state, barricadeEffect, action)

    // Step 0: Rubble resolved (cost 1, progress 1)
    expect(events.some((e) => e.type === 'HazardResolved')).toBe(true)

    // Step 1: Screams returned (rubble was not in hand at that point — skipped)
    const returnEvent = events.find((e) => e.type === 'WorldCardsReturned')
    expect(returnEvent).toBeDefined()
    if (returnEvent?.type === 'WorldCardsReturned') {
      // Only screams should be in the returned list
      expect(returnEvent.ids).toContain(screams.id)
      expect(returnEvent.ids).not.toContain(rubble.id)
    }

    // Screams is no longer in hand
    expect(after.hand.find((c) => c.id === screams.id)).toBeUndefined()
    // Screams is now in worldDraw
    expect(after.worldDraw.find((c) => c.id === screams.id)).toBeDefined()
  })

  it('handles Barricade with no valid returnIds (all already resolved)', () => {
    let state = makeState()
    const [rubble, s1] = mintWorld(state, 'Rubble')
    state = { ...s1, hand: [rubble], worldDraw: [] }

    const barricadeEffect = {
      kind: 'Sequence' as const,
      steps: [
        { kind: 'DealProgress' as const, base: 1 },
        { kind: 'ReturnWorldCards' as const, min: 0, max: 2 },
      ],
    }

    // returnIds only contains the rubble which will be resolved in step 0
    const action = {
      type: 'PlayCard' as const,
      cardId: 'barricade-id',
      targetId: rubble.id,
      returnIds: [rubble.id] as readonly string[],
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

// ---------------------------------------------------------------------------
// 12. applyEffect DestroySelf
// ---------------------------------------------------------------------------

describe('applyEffect DestroySelf', () => {
  it('removes the firing card from hand and emits CardDestroyed{ id: selfId }', () => {
    let state = makeState()
    const [corpse, s1] = mintWorld(state, 'Corpse')
    state = { ...s1, hand: [corpse] }

    const { state: after, events } = applyEffect(
      catalog,
      state,
      { kind: 'DestroySelf' },
      undefined,
      corpse.id,
    )

    expect(after.hand.find((c) => c.id === corpse.id)).toBeUndefined()
    const destroyed = events.find((e) => e.type === 'CardDestroyed')
    expect(destroyed).toBeDefined()
    if (destroyed?.type === 'CardDestroyed') {
      expect(destroyed.id).toBe(corpse.id)
    }
  })

  it('is a no-op when selfId is undefined', () => {
    let state = makeState()
    const [corpse, s1] = mintWorld(state, 'Corpse')
    state = { ...s1, hand: [corpse] }

    const { state: after, events } = applyEffect(
      catalog,
      state,
      { kind: 'DestroySelf' },
      undefined,
      undefined,
    )

    expect(after.hand).toHaveLength(1)
    expect(events).toHaveLength(0)
  })

  it('Sequence[AddWorldCardToTop(Zombie), DestroySelf] removes self and adds a Zombie on top', () => {
    let state = makeState()
    const [corpse, s1] = mintWorld(state, 'Corpse')
    state = { ...s1, hand: [corpse], worldDraw: [] }

    const sequence = {
      kind: 'Sequence' as const,
      steps: [
        { kind: 'AddWorldCardToTop' as const, template: 'Zombie' },
        { kind: 'DestroySelf' as const },
      ],
    }

    const { state: after, events } = applyEffect(catalog, state, sequence, undefined, corpse.id)

    // Corpse gone from hand
    expect(after.hand.find((c) => c.id === corpse.id)).toBeUndefined()

    // A Zombie is on top of worldDraw
    expect(after.worldDraw).toHaveLength(1)
    expect(after.worldDraw[0]!.name).toBe('Zombie')

    // Both events present
    expect(events.some((e) => e.type === 'CardGained')).toBe(true)
    const destroyed = events.find((e) => e.type === 'CardDestroyed')
    expect(destroyed).toBeDefined()
    if (destroyed?.type === 'CardDestroyed') {
      expect(destroyed.id).toBe(corpse.id)
    }
  })
})
