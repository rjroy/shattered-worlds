import { describe, expect, it } from 'bun:test'
import { createWorld } from './world'
import { applyEffect } from './effects'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// 1. Act 1 composition
// ---------------------------------------------------------------------------

describe('Act 1 composition', () => {
  it('worldDraw + hand world cards total 6 after opening deal', () => {
    const state = createWorld(catalog, worldData, 42)
    const handWorldCount = state.hand.filter((c) => c.kind === 'world').length
    expect(state.worldDraw.length + handWorldCount).toBe(6)
  })

  it('worldDraw + hand world cards contain 2 Strange Sounds, 2 Rubble, 2 Screams', () => {
    const state = createWorld(catalog, worldData, 42)
    const handWorldCards = state.hand.filter((c) => c.kind === 'world')
    const allAct1 = [...state.worldDraw, ...handWorldCards]
    const names = allAct1.map((c) => c.name)
    expect(names.filter((n) => n === 'Strange Sounds')).toHaveLength(2)
    expect(names.filter((n) => n === 'Rubble')).toHaveLength(2)
    expect(names.filter((n) => n === 'Screams')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 2. Act queuing
// ---------------------------------------------------------------------------

describe('act queuing', () => {
  it('acts has 2 entries', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(state.acts).toHaveLength(2)
  })

  it('acts[0] has 6 cards: Rubble×2, Zombie×3, Find Baseball Bat×1', () => {
    const state = createWorld(catalog, worldData, 42)
    const act2 = state.acts[0]
    if (act2 === undefined) throw new Error('acts[0] missing')

    expect(act2).toHaveLength(6)
    const names = act2.map((c) => c.name)
    expect(names.filter((n) => n === 'Rubble')).toHaveLength(2)
    expect(names.filter((n) => n === 'Zombie')).toHaveLength(3)
    expect(names.filter((n) => n === 'Find Baseball Bat')).toHaveLength(1)
  })

  it('acts[1] has 6 cards: Find Baseball Bat×1, Zombie×4, The Walker×1', () => {
    const state = createWorld(catalog, worldData, 42)
    const act3 = state.acts[1]
    if (act3 === undefined) throw new Error('acts[1] missing')

    expect(act3).toHaveLength(6)
    const names = act3.map((c) => c.name)
    expect(names.filter((n) => n === 'Find Baseball Bat')).toHaveLength(1)
    expect(names.filter((n) => n === 'Zombie')).toHaveLength(4)
    expect(names.filter((n) => n === 'The Walker')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. PlayerDraw
// ---------------------------------------------------------------------------

describe('playerDraw', () => {
  it('playerDraw + hand player cards total 10 after opening deal', () => {
    const state = createWorld(catalog, worldData, 42)
    const handPlayerCount = state.hand.filter((c) => c.kind === 'player').length
    expect(state.playerDraw.length + handPlayerCount).toBe(10)
  })

  it('playerDraw + hand player cards contain correct starter names', () => {
    const state = createWorld(catalog, worldData, 42)
    const handPlayerCards = state.hand.filter((c) => c.kind === 'player')
    const allStarter = [...state.playerDraw, ...handPlayerCards]
    const names = allStarter.map((c) => c.name)
    expect(names.filter((n) => n === 'Sprint')).toHaveLength(2)
    expect(names.filter((n) => n === 'Explore')).toHaveLength(3)
    expect(names.filter((n) => n === 'Barricade')).toHaveLength(2)
    expect(names.filter((n) => n === 'Med Kit')).toHaveLength(1)
    expect(names.filter((n) => n === 'Panic')).toHaveLength(1)
    expect(names.filter((n) => n === 'Adrenaline')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('two calls with the same seed produce identical Act 1 card name order', () => {
    const a = createWorld(catalog, worldData, 42)
    const b = createWorld(catalog, worldData, 42)
    expect(a.worldDraw.map((c) => c.name)).toEqual(b.worldDraw.map((c) => c.name))
  })

  it('two calls with the same seed produce identical playerDraw name order', () => {
    const a = createWorld(catalog, worldData, 42)
    const b = createWorld(catalog, worldData, 42)
    expect(a.playerDraw.map((c) => c.name)).toEqual(b.playerDraw.map((c) => c.name))
  })

  it('different seeds produce different opening hands (same card multiset, different order)', () => {
    const a = createWorld(catalog, worldData, 1)
    const b = createWorld(catalog, worldData, 2)

    // Compare full Act 1 card sequence: worldDraw + world cards in hand
    const aAct1 = [
      ...a.worldDraw,
      ...a.hand.filter((c) => c.kind === 'world'),
    ]
    const bAct1 = [
      ...b.worldDraw,
      ...b.hand.filter((c) => c.kind === 'world'),
    ]

    const aNamesStr = aAct1.map((c) => c.name).join(',')
    const bNamesStr = bAct1.map((c) => c.name).join(',')

    // Same multiset of names (both draw from the same act 1 spec)
    const aNamesSorted = aAct1.map((c) => c.name).sort().join(',')
    const bNamesSorted = bAct1.map((c) => c.name).sort().join(',')
    expect(aNamesSorted).toEqual(bNamesSorted)

    // Different order across the combined sequence (probability of accidental
    // equality is extremely low given different seeds)
    expect(aNamesStr).not.toEqual(bNamesStr)
  })
})

// ---------------------------------------------------------------------------
// 5. Unique ids across all piles
// ---------------------------------------------------------------------------

describe('unique ids', () => {
  it('all 28 card ids across all piles and hand are unique', () => {
    const state = createWorld(catalog, worldData, 42)

    const act2 = state.acts[0] ?? []
    const act3 = state.acts[1] ?? []

    // Include hand — Phase 3 deals cards out of the piles into hand
    const allCards = [...state.hand, ...state.playerDraw, ...state.worldDraw, ...act2, ...act3]
    const ids = allCards.map((c) => c.id)

    expect(ids).toHaveLength(28) // 6 hand + remaining piles = 28 total
    expect(new Set(ids).size).toBe(28)
  })
})

// ---------------------------------------------------------------------------
// 6. Opening hand (Phase 3 — refillHand wired in createWorld)
// ---------------------------------------------------------------------------

describe('hand', () => {
  it('createWorld deals an opening hand of 6 cards', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(state.hand).toHaveLength(6)
  })

  it('opening hand has exactly 2 world cards', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(state.hand.filter((c) => c.kind === 'world')).toHaveLength(2)
  })

  it('opening hand has exactly 4 player cards', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(state.hand.filter((c) => c.kind === 'player')).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// 7. Starter provenance (integration)
// ---------------------------------------------------------------------------

describe('starter provenance', () => {
  it('all player cards in playerDraw have sourceWorldId === "starter"', () => {
    const state = createWorld(catalog, worldData, 42)
    // Collect all player cards across playerDraw and hand
    const handPlayers = state.hand.filter((c) => c.kind === 'player')
    const drawPlayers = state.playerDraw.filter((c) => c.kind === 'player')
    const allPlayers = [...handPlayers, ...drawPlayers]

    expect(allPlayers.length).toBeGreaterThan(0)
    for (const card of allPlayers) {
      if (card.kind !== 'player') continue
      expect(card.sourceWorldId).toBe('starter')
    }
  })
})

// ---------------------------------------------------------------------------
// 8. Reward provenance
// ---------------------------------------------------------------------------

describe('reward provenance', () => {
  it('a GainCard reward mints a player card stamped with the active worldId', () => {
    // Start from a createWorld state so nextId and rng are valid, then override
    // worldId to 'zombie-big-box' before granting the reward.
    const base = createWorld(catalog, worldData, 1)
    const state = { ...base, worldId: 'zombie-big-box' }

    // Strange Sounds reward: { kind: 'GainCard', template: 'Listen' }
    const { state: after } = applyEffect(catalog, state, { kind: 'GainCard', template: 'Listen' })

    // The newly minted Listen card lands in playerDiscard
    expect(after.playerDiscard).toHaveLength(1)
    const listenCard = after.playerDiscard[0]
    if (listenCard === undefined) throw new Error('expected a card in playerDiscard')
    if (listenCard.kind !== 'player') throw new Error('expected player card')
    expect(listenCard.name).toBe('Listen')
    expect(listenCard.sourceWorldId).toBe('zombie-big-box')
  })
})
