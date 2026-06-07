/**
 * Unit tests for reduce.ts.
 *
 * All tests operate on pure GameState — no Phaser, no browser globals.
 * Crafted minimal states are used wherever a full createWorld game would
 * introduce too many variables.
 */

import { describe, expect, it } from 'bun:test'
import { createWorld } from '../engine/world'
import { mintCard } from '../model/cards'
import { reduce } from '../engine/reduce'
import { IllegalActionError } from '../model/errors'
import type { GameState, PlayerCard, WorldCard } from '../model/types'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GameState seeded from createWorld(42) but with the hand,
 * piles, and progress replaced by what the test needs.
 */
function makeState(overrides: Partial<GameState>): GameState {
  const base = createWorld(catalog, worldData, 42)
  return {
    ...base,
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    status: 'playing',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. PlayCard basic: Explore on a 1-cost hazard auto-resolves
// ---------------------------------------------------------------------------

describe('PlayCard basic', () => {
  it('playing Explore on Rubble (cost 1) emits CardPlayed + ProgressDealt + HazardResolved', () => {
    // seed 42 starting hand: Rubble(id=12) + Screams(id=15) + Sprint(id=1) + Panic(id=8) + MedKit(id=7) + Explore(id=2)
    const state = createWorld(catalog, worldData, 42)
    const rubble = state.hand.find((c): c is WorldCard => c.kind === 'world' && c.name === 'Rubble')
    const explore = state.hand.find((c): c is PlayerCard => c.kind === 'player' && c.name === 'Explore')
    if (!rubble || !explore) throw new Error('Expected Rubble and Explore in seed 42 hand')

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: explore.id, targetId: rubble.id })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')

    // Rubble removed from hand
    expect(result.state.hand.some((c) => c.id === rubble.id)).toBe(false)
    // Explore removed from hand (played)
    expect(result.state.hand.some((c) => c.id === explore.id)).toBe(false)
    // Status still playing
    expect(result.state.status).toBe('playing')
  })
})

// ---------------------------------------------------------------------------
// 2. No carry-over: progress resets to {} after EndTurn
// ---------------------------------------------------------------------------

describe('progress reset on EndTurn', () => {
  it('partial progress on a 2-cost hazard is wiped on EndTurn', () => {
    // Screams costs 1 and would resolve with 1 Explore, but Strange Sounds costs 2.
    // We build a crafted state with a Strange Sounds (cost 2) and a single Explore.
    const base = createWorld(catalog, worldData, 42)
    const [strangeSounds, s1] = mintCard(catalog, base, 'Strange Sounds')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    const state = makeState({
      ...s2,
      hand: [strangeSounds as WorldCard, explore as PlayerCard],
    })

    // Play Explore on Strange Sounds → 1 progress (not enough to resolve)
    const r1 = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: explore.id,
      targetId: strangeSounds.id,
    })
    expect(r1.state.progress[strangeSounds.id]).toBe(1)

    // EndTurn should wipe progress
    const r2 = reduce(catalog, r1.state, { type: 'EndTurn' })
    expect(r2.state.progress).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 3. Hold vs discard: world cards stay in hand, player cards go to playerDiscard
// ---------------------------------------------------------------------------

describe('EndTurn hold vs discard', () => {
  it('world cards remain in hand; player cards move to playerDiscard', () => {
    // Use a large playerDraw so refillHand does not recycle the discarded card
    // back into hand immediately.
    const base = createWorld(catalog, worldData, 42)
    const [screams, s1] = mintCard(catalog, base, 'Screams')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    // Seed enough player draws so the discard is not re-drawn this turn
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, s6] = mintCard(catalog, s5, 'Explore')
    const [e6, finalState] = mintCard(catalog, s6, 'Explore')

    const state = makeState({
      ...finalState,
      hand: [screams as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard, e6 as PlayerCard],
      playerDiscard: [],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Screams (world) should still be in hand
    expect(result.state.hand.some((c) => c.id === screams.id)).toBe(true)
    // Explore (player) should be in playerDiscard (it was discarded, not re-drawn)
    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(true)
    // Explore should NOT be in hand (unless refillHand pulled it from discard,
    // which won't happen here because playerDraw has 5 cards to fill from)
    const handIds = result.state.hand.map((c) => c.id)
    expect(handIds).not.toContain(explore.id)
  })

  it('CardsDiscarded event lists the discarded player card ids', () => {
    const base = createWorld(catalog, worldData, 42)
    const [screams, s1] = mintCard(catalog, base, 'Screams')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, finalState] = mintCard(catalog, s5, 'Explore')

    const state = makeState({
      ...finalState,
      hand: [screams as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    const discardedEvent = result.events.find((e) => e.type === 'CardsDiscarded')
    expect(discardedEvent).toBeDefined()
    if (discardedEvent?.type === 'CardsDiscarded') {
      expect(discardedEvent.cardIds).toContain(explore.id)
      expect(discardedEvent.cardIds).not.toContain(screams.id)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. DiscardHazard legal: discarding Zombie applies Damage(5) onDiscarded
// ---------------------------------------------------------------------------

describe('DiscardHazard legal', () => {
  it('discarding Zombie (Damage 5) decrements HP', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')

    const state = makeState({
      ...s1,
      hp: 10,
      hand: [zombie as WorldCard],
    })

    const result = reduce(catalog, state, { type: 'DiscardHazard', cardId: zombie.id })

    expect(result.state.hp).toBe(5)

    const types = result.events.map((e) => e.type)
    expect(types).toContain('HazardDiscarded')
    expect(types).toContain('DamageDealt')
    expect(types).toContain('HpChanged')

    // HazardDiscarded should come before DamageDealt
    const hdIdx = types.indexOf('HazardDiscarded')
    const dmgIdx = types.indexOf('DamageDealt')
    expect(hdIdx).toBeLessThan(dmgIdx)
  })
})

// ---------------------------------------------------------------------------
// 5. DiscardHazard on Door throws IllegalActionError
// ---------------------------------------------------------------------------

describe('DiscardHazard on Door', () => {
  it('attempting to discard the Door throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [door, s1] = mintCard(catalog, base, 'Door')

    const state = makeState({
      ...s1,
      hand: [door as WorldCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'DiscardHazard', cardId: door.id })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 6. Post-terminal: any action throws after status=lost or status=won
// ---------------------------------------------------------------------------

describe('post-terminal throws', () => {
  it('any action after WorldLost throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')

    const lostState = makeState({
      ...s1,
      hp: 0,
      hand: [zombie as WorldCard],
      status: 'lost',
    })

    expect(() => reduce(catalog, lostState, { type: 'EndTurn' })).toThrow(IllegalActionError)
    expect(() =>
      reduce(catalog, lostState, { type: 'DiscardHazard', cardId: zombie.id }),
    ).toThrow(IllegalActionError)
  })

  it('any action after WorldWon throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')

    const wonState = makeState({
      ...s1,
      hand: [explore as PlayerCard],
      status: 'won',
    })

    expect(() => reduce(catalog, wonState, { type: 'EndTurn' })).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 7. PlayCard with no legal play throws
// ---------------------------------------------------------------------------

describe('PlayCard with no legal play', () => {
  it('playing Explore when no world card is in hand throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')

    const state = makeState({
      ...s1,
      // No world cards in hand — Explore requires a world card target
      hand: [explore as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: explore.id, targetId: 'nonexistent' })
    }).toThrow(IllegalActionError)
  })

  it('playing a card not in hand throws IllegalActionError', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: 'ghost-card-id' })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 8. Modal choice: Sprint
// ---------------------------------------------------------------------------

describe('Sprint modal', () => {
  it('Sprint choice=0 draws player and world cards', () => {
    // seed 42 hand contains Sprint (id=1); worldDraw has 4 remaining world cards
    const state = createWorld(catalog, worldData, 42)
    const sprint = state.hand.find((c) => c.kind === 'player' && c.name === 'Sprint')
    if (!sprint) throw new Error('Sprint not found in seed 42 hand')

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 0 })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('CardsDrawn')
  })

  it('Sprint choice=1 (Slow hazard) deals 2 progress on a Zombie and resolves it', () => {
    // Craft a state with Sprint + Zombie (Slow keyword, cost=1)
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')
    const [sprint, s2] = mintCard(catalog, s1, 'Sprint')

    const state = makeState({
      ...s2,
      hand: [zombie as WorldCard, sprint as PlayerCard],
    })

    // Sprint branch 1: DealProgress base=1 bonus={Slow,+1} → 1+1=2 on Zombie (cost=1) → resolves
    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: sprint.id,
      choice: 1,
      targetId: zombie.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')

    expect(result.state.hand.some((c) => c.id === zombie.id)).toBe(false)
  })

  it('Sprint choice=1 throws when no Slow hazard is in hand', () => {
    // Strange Sounds has no keywords, so Sprint branch 1 can't target it
    const base = createWorld(catalog, worldData, 42)
    const [strangeSounds, s1] = mintCard(catalog, base, 'Strange Sounds')
    const [sprint, s2] = mintCard(catalog, s1, 'Sprint')

    const state = makeState({
      ...s2,
      hand: [strangeSounds as WorldCard, sprint as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 1, targetId: strangeSounds.id })
    }).toThrow(IllegalActionError)
  })

  it('Sprint throws when choice is out of range', () => {
    const state = createWorld(catalog, worldData, 42)
    const sprint = state.hand.find((c) => c.kind === 'player' && c.name === 'Sprint')
    if (!sprint) throw new Error('Sprint not found in seed 42 hand')

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 5 })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 9. Compound: Barricade (DealProgress + ReturnWorldCards)
// ---------------------------------------------------------------------------

describe('Barricade compound', () => {
  it('Barricade deals 1 progress on Rubble (resolves) with empty returnIds', () => {
    const base = createWorld(catalog, worldData, 42)
    const [rubble, s1] = mintCard(catalog, base, 'Rubble')
    const [barricade, s2] = mintCard(catalog, s1, 'Barricade')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, barricade as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: barricade.id,
      targetId: rubble.id,
      returnIds: [],
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')
  })
})

// ---------------------------------------------------------------------------
// 10. discardPlayer: Adrenaline
// ---------------------------------------------------------------------------

describe('Adrenaline discardPlayer', () => {
  it('Adrenaline discards a player card and draws 2', () => {
    const base = createWorld(catalog, worldData, 42)
    const [adrenaline, s1] = mintCard(catalog, base, 'Adrenaline')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [rubble, s3] = mintCard(catalog, s2, 'Rubble')
    // Provide player cards to draw
    const [e1, s4] = mintCard(catalog, s3, 'Explore')
    const [e2, s5] = mintCard(catalog, s4, 'Explore')

    const state = makeState({
      ...s5,
      hand: [rubble as WorldCard, adrenaline as PlayerCard, explore as PlayerCard],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: adrenaline.id,
      discardId: explore.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('CardsDrawn')

    // explore moved to playerDiscard
    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(true)
    // adrenaline played, not in hand
    expect(result.state.hand.some((c) => c.id === adrenaline.id)).toBe(false)
  })

  it('Adrenaline throws when discardId is not a legal target', () => {
    const base = createWorld(catalog, worldData, 42)
    const [adrenaline, s1] = mintCard(catalog, base, 'Adrenaline')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')
    const [explore, s3] = mintCard(catalog, s2, 'Explore')

    const state = makeState({
      ...s3,
      hand: [rubble as WorldCard, adrenaline as PlayerCard, explore as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, {
        type: 'PlayCard',
        cardId: adrenaline.id,
        discardId: rubble.id, // world card — not a legal discard target
      })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 11. destroyHand: Regroup
// ---------------------------------------------------------------------------

describe('Regroup destroyHand', () => {
  it('Regroup with no destroyId plays without destroying anything', () => {
    const base = createWorld(catalog, worldData, 42)
    const [regroup, s1] = mintCard(catalog, base, 'Regroup')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, regroup as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: regroup.id })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).not.toContain('CardDestroyed')
  })

  it('Regroup with destroyId removes the card from hand permanently', () => {
    const base = createWorld(catalog, worldData, 42)
    const [regroup, s1] = mintCard(catalog, base, 'Regroup')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, regroup as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: regroup.id,
      destroyId: rubble.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardDestroyed')
    expect(result.state.hand.some((c) => c.id === rubble.id)).toBe(false)
    // Destroyed — not in discard either
    expect(result.state.playerDiscard.some((c) => c.id === rubble.id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 12. onEndOfTurn: world cards fire their effect at the end of each turn
// ---------------------------------------------------------------------------

describe('EndTurn onEndOfTurn', () => {
  function makeEndTurnState(worldCard: WorldCard, hp: number): GameState {
    const base = createWorld(catalog, worldData, 42)
    const [e1, s1] = mintCard(catalog, base, 'Explore')
    const [e2, s2] = mintCard(catalog, s1, 'Explore')
    const [e3, s3] = mintCard(catalog, s2, 'Explore')
    const [e4, s4] = mintCard(catalog, s3, 'Explore')
    const [e5, s5] = mintCard(catalog, s4, 'Explore')
    return makeState({
      ...s5,
      hp,
      hand: [worldCard],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })
  }

  it('Zombie in hand deals 1 damage at end of turn', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, _s1] = mintCard(catalog, base, 'Zombie')
    const state = makeEndTurnState(zombie as WorldCard, 10)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(9)
    expect(result.events.map((e) => e.type)).toContain('DamageDealt')
  })

  it('onEndOfTurn fires after TurnEnded and before CardsDiscarded', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, finalState] = mintCard(catalog, s5, 'Explore')

    const state = makeState({
      ...finalState,
      hp: 10,
      hand: [zombie as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    const types = result.events.map((e) => e.type)

    const turnEndedIdx = types.indexOf('TurnEnded')
    const damageIdx = types.indexOf('DamageDealt')
    const discardIdx = types.indexOf('CardsDiscarded')

    expect(turnEndedIdx).toBeLessThan(damageIdx)
    expect(damageIdx).toBeLessThan(discardIdx)
  })

  it('onEndOfTurn can kill the player and short-circuits to status=lost', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, _s1] = mintCard(catalog, base, 'Zombie')
    const state = makeEndTurnState(zombie as WorldCard, 1)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(0)
    expect(result.state.status).toBe('lost')
    expect(result.events.map((e) => e.type)).toContain('WorldLost')
  })

  it('world cards with onEndOfTurn=None deal no damage', () => {
    const base = createWorld(catalog, worldData, 42)
    const [rubble, _s1] = mintCard(catalog, base, 'Rubble')
    const state = makeEndTurnState(rubble as WorldCard, 10)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(10)
    expect(result.events.map((e) => e.type)).not.toContain('DamageDealt')
  })
})
