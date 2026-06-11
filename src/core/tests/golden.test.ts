/**
 * Golden replay tests for the reduce/game pipeline.
 *
 * Three invariants under test:
 *   1. A crafted 2-turn win via the Door (SurviveWorld onCleared) reaches status='won'.
 *   2. A crafted 1-step loss via HP depletion (Zombie discard) reaches status='lost'.
 *   3. Replay equivalence: same seed + same actions → deepEqual final state.
 *
 * All tests are deterministic: no randomness-dependent behaviour, no timers,
 * no Phaser, no browser globals.
 */

import { describe, expect, it } from 'bun:test'
import { createWorld } from '../engine/world'
import { mintCard } from '../model/cards'
import { reduce } from '../engine/reduce'
import type { GameState, PlayerCard, WorldCard } from '../model/types'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal state forked from createWorld(42) with specified overrides.
 * Clears all draw piles, acts, and progress unless the caller restores them.
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
    energy: 0,
    status: 'playing',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Golden win: Door resolve → SurviveWorld
//
// Setup:
//   Hand = [Door (cost 2, onCleared SurviveWorld), Explore1, Explore2]
//   Explore deals 1 progress per play (no Creature/Hidden bonus on Door).
//   Two Explore plays against the Door accumulate 2 progress → auto-resolves
//   → onCleared SurviveWorld → status='won'.
//
// Card IDs are deterministic because mintCard threads nextId through the
// same createWorld(42) base, always producing the same id sequence.
// ---------------------------------------------------------------------------

describe('golden win: Door via two Explore plays', () => {
  // Mint the three cards we need from a fixed base state
  const base = createWorld(catalog, worldData, 42)
  const [door, s1] = mintCard(catalog, base, 'Door')
  const [explore1, s2] = mintCard(catalog, s1, 'Explore')
  const [explore2, finalMinted] = mintCard(catalog, s2, 'Explore')

  const doorCard = door as WorldCard
  const ex1Card = explore1 as PlayerCard
  const ex2Card = explore2 as PlayerCard

  // Verify expected IDs so the test is self-describing
  it('minted card ids are deterministic', () => {
    const base2 = createWorld(catalog, worldData, 42)
    const [d, t1] = mintCard(catalog, base2, 'Door')
    const [e1, t2] = mintCard(catalog, t1, 'Explore')
    const [e2] = mintCard(catalog, t2, 'Explore')

    expect(d.id).toBe(doorCard.id)
    expect(e1.id).toBe(ex1Card.id)
    expect(e2.id).toBe(ex2Card.id)
  })

  it('two Explore plays on Door accumulate 2 progress and win the game', () => {
    const state = makeState({
      ...finalMinted,
      hand: [doorCard, ex1Card, ex2Card],
      hp: 10,
    })

    // Turn 1, play 1: Explore on Door → 2 progress (Hidden bonus, cost 4, not resolved yet)
    const r1 = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: ex1Card.id,
      targetId: doorCard.id,
    })

    expect(r1.state.status).toBe('playing')
    expect(r1.state.progress[doorCard.id]).toBe(2)

    const r1Types = r1.events.map((e) => e.type)
    expect(r1Types).toContain('CardPlayed')
    expect(r1Types).toContain('ProgressDealt')
    expect(r1Types).not.toContain('HazardResolved')

    // Turn 1, play 2: Explore on Door → 4 total progress → auto-resolves → WorldWon
    const r2 = reduce(catalog, r1.state, {
      type: 'PlayCard',
      cardId: ex2Card.id,
      targetId: doorCard.id,
    })

    expect(r2.state.status).toBe('won')

    const r2Types = r2.events.map((e) => e.type)
    expect(r2Types).toContain('CardPlayed')
    expect(r2Types).toContain('ProgressDealt')
    expect(r2Types).toContain('WorldWon')
    expect(r2Types).toContain('HazardResolved')

    // Door removed from hand
    expect(r2.state.hand.some((c) => c.id === doorCard.id)).toBe(false)
  })

  it('no further actions are accepted after winning', () => {
    const state = makeState({
      ...finalMinted,
      hand: [doorCard, ex1Card, ex2Card],
      hp: 10,
    })

    const r1 = reduce(catalog, state, { type: 'PlayCard', cardId: ex1Card.id, targetId: doorCard.id })
    const r2 = reduce(catalog, r1.state, { type: 'PlayCard', cardId: ex2Card.id, targetId: doorCard.id })

    expect(r2.state.status).toBe('won')
    expect(() => reduce(catalog, r2.state, { type: 'EndTurn' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Golden loss: HP → 0 via Zombie discard
//
// Setup:
//   Hand = [Zombie (Damage 5 onDiscarded)]
//   HP = 5
//   DiscardHazard(Zombie) → Damage(5) → HP=0 → WorldLost → status='lost'
// ---------------------------------------------------------------------------

describe('golden loss: HP reaches 0 via Zombie discard', () => {
  const base = createWorld(catalog, worldData, 42)
  const [zombie, minted] = mintCard(catalog, base, 'Zombie')
  const zombieCard = zombie as WorldCard

  it('discarding Zombie at hp=5 transitions to status=lost', () => {
    const state = makeState({
      ...minted,
      hp: 5,
      hand: [zombieCard],
    })

    const result = reduce(catalog, state, { type: 'DiscardHazard', cardId: zombieCard.id })

    expect(result.state.hp).toBe(0)
    expect(result.state.status).toBe('lost')

    const types = result.events.map((e) => e.type)
    expect(types).toContain('HazardDiscarded')
    expect(types).toContain('DamageDealt')
    expect(types).toContain('HpChanged')
    expect(types).toContain('WorldLost')

    // Event order: HazardDiscarded first, damage events after
    const hdIdx = types.indexOf('HazardDiscarded')
    const lostIdx = types.indexOf('WorldLost')
    expect(hdIdx).toBeLessThan(lostIdx)
  })

  it('no further actions are accepted after losing', () => {
    const state = makeState({
      ...minted,
      hp: 1,
      hand: [zombieCard],
    })

    const result = reduce(catalog, state, { type: 'DiscardHazard', cardId: zombieCard.id })
    expect(result.state.status).toBe('lost')
    expect(() => reduce(catalog, result.state, { type: 'EndTurn' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Replay equivalence: same seed + same actions → deepEqual final state
//
// Run two independent replays from createWorld(42) through the same action
// sequence and assert the final states are identical. This proves that
// reduce is a pure function with no hidden mutable state.
// ---------------------------------------------------------------------------

describe('replay equivalence', () => {
  /**
   * Run a deterministic action sequence from seed 42 and return the final
   * state. The sequence exercises PlayCard, DiscardHazard, and EndTurn.
   */
  function runReplay(): GameState {
    const state0 = createWorld(catalog, worldData, 42)

    // seed 42 starting hand:
    //   Strange Sounds(id=11), Screams(id=14), Sprint(id=1), Panic(id=8), MedKit(id=7), Explore(id=2)
    const screams = state0.hand.find((c) => c.kind === 'world' && c.name === 'Screams')!
    const strangeSounds = state0.hand.find((c) => c.kind === 'world' && c.name === 'Strange Sounds')!
    const explore = state0.hand.find((c) => c.kind === 'player' && c.name === 'Explore')!
    const medKit = state0.hand.find((c) => c.kind === 'player' && c.name === 'Med Kit')!

    // Action 1: Play Explore on Screams (1 progress → resolves, onCleared=GainCard Regroup)
    const r1 = reduce(catalog, state0, {
      type: 'PlayCard',
      cardId: explore.id,
      targetId: screams.id,
    })

    // Action 2: Discard Strange Sounds (onDiscarded: None — no damage, no card gain)
    const r2 = reduce(catalog, r1.state, { type: 'DiscardHazard', cardId: strangeSounds.id })

    // Action 3: Play Med Kit (Heal 2)
    const r3 = reduce(catalog, r2.state, { type: 'PlayCard', cardId: medKit.id })

    // Action 4: EndTurn
    const r4 = reduce(catalog, r3.state, { type: 'EndTurn' })

    return r4.state
  }

  it('running the same action sequence twice produces deepEqual final states', () => {
    const stateA = runReplay()
    const stateB = runReplay()

    // Full structural equality of the final game state
    expect(stateA).toEqual(stateB)
  })

  it('replay state is consistent: hp, status, hand sizes match expected values', () => {
    const state = runReplay()

    // Med Kit healed +2; Strange Sounds onDiscarded=None (no damage); Screams onCleared=GainCard Regroup (no hp change)
    expect(state.hp).toBe(12) // 10 + 2 from Med Kit

    expect(state.status).toBe('playing')

    // After EndTurn, hand should be refilled to 6
    expect(state.hand.length).toBe(6)

    // Progress cleared
    expect(state.progress).toEqual({})
  })
})
