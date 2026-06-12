import { describe, expect, it } from 'bun:test'
import { availableActions } from '../engine/available'
import { mintCard } from '../model/cards'
import { createWorld } from '../engine/world'
import type { GameState, PlayerCard, WorldCard } from '../model/types'
import { catalog, worldData } from './testFixture'
import { buildWorld } from '../../data/worldManifest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GameState for testing. Uses createWorld as a base so
 * nextId and rng are valid, then overrides hand and status as needed.
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

/** Mint a PlayerCard and advance state. */
function mintPlayer(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
): [PlayerCard, GameState] {
  const [card, next] = mintCard(catalog, state, name)
  if (card.kind !== 'player') throw new Error(`${name} is not a player card`)
  return [card as PlayerCard, next]
}

/** Mint a WorldCard and advance state. */
function mintWorld(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
): [WorldCard, GameState] {
  const [card, next] = mintCard(catalog, state, name)
  if (card.kind !== 'world') throw new Error(`${name} is not a world card`)
  return [card as WorldCard, next]
}

// ---------------------------------------------------------------------------
// 1. DealProgress absent without hazard
// ---------------------------------------------------------------------------

describe('DealProgress playability', () => {
  it('Explore is absent from playable when hand has only player cards', () => {
    const s0 = makeState()
    const [explore, s1] = mintPlayer(s0, 'Explore')
    const [sprint, s2] = mintPlayer(s1, 'Sprint')
    const state = { ...s2, hand: [explore, sprint] }

    const actions = availableActions(state)
    const exploreEntry = actions.playable.find((p) => p.cardId === explore.id)
    expect(exploreEntry).toBeUndefined()
  })

  it('Explore appears in playable with spec {kind:"hazard"} when a Zombie is in hand', () => {
    const s0 = makeState()
    const [explore, s1] = mintPlayer(s0, 'Explore')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [explore, zombie] }

    const actions = availableActions(state)
    const exploreEntry = actions.playable.find((p) => p.cardId === explore.id)
    expect(exploreEntry).toBeDefined()
    expect(exploreEntry!.spec).toMatchObject({ kind: 'hazard' })
  })
})

// ---------------------------------------------------------------------------
// 2. Panic playability
// ---------------------------------------------------------------------------

describe('Panic playability', () => {
  it('Panic is absent from playable when hand has only player cards', () => {
    const s0 = makeState()
    const [panic, s1] = mintPlayer(s0, 'Panic')
    const [med, s2] = mintPlayer(s1, 'Med Kit')
    const state = { ...s2, hand: [panic, med] }

    const actions = availableActions(state)
    const panicEntry = actions.playable.find((p) => p.cardId === panic.id)
    expect(panicEntry).toBeUndefined()
  })

  it('Panic appears in playable with compound spec when a world card is in hand', () => {
    const s0 = makeState()
    const [panic, s1] = mintPlayer(s0, 'Panic')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [panic, zombie] }

    const actions = availableActions(state)
    const panicEntry = actions.playable.find((p) => p.cardId === panic.id)
    expect(panicEntry).toBeDefined()

    const spec = panicEntry!.spec
    expect(spec.kind).toBe('compound')
    if (spec.kind !== 'compound') throw new Error('not compound')

    // steps[0]: ReturnWorldCards{1,2}
    expect(spec.steps[0]).toEqual({ kind: 'returnWorld', min: 1, max: 2 })
    // steps[1]: Draw → no target needed
    expect(spec.steps[1]).toEqual({ kind: 'none' })
  })
})

// ---------------------------------------------------------------------------
// 3. Sprint always playable (Modal card)
// ---------------------------------------------------------------------------

describe('Sprint playability', () => {
  it('Sprint is playable even when no Slow hazard is in hand (branch 0 is Draw)', () => {
    const s0 = makeState()
    const [sprint, s1] = mintPlayer(s0, 'Sprint')
    // No world cards in hand — branch 1 (DealProgress Slow) is not legal,
    // but branch 0 (Draw) is always legal.
    const state = { ...s1, hand: [sprint], energy: 1 }

    const actions = availableActions(state)
    const sprintEntry = actions.playable.find((p) => p.cardId === sprint.id)
    expect(sprintEntry).toBeDefined()

    const spec = sprintEntry!.spec
    expect(spec.kind).toBe('modal')
    if (spec.kind !== 'modal') throw new Error('not modal')

    // Branch 0: Draw → no target needed
    expect(spec.branches[0]).toEqual({ kind: 'none' })
    // Branch 1: DealProgress{Slow} → hazard spec with Slow tag
    expect(spec.branches[1]).toEqual({ kind: 'hazard', tag: 'Slow' })
  })
})

// ---------------------------------------------------------------------------
// 4. discardable
// ---------------------------------------------------------------------------

describe('discardable', () => {
  it('Door (discardable:false) does NOT appear in discardable', () => {
    const s0 = makeState()
    const [door, s1] = mintWorld(s0, 'Door')
    const state = { ...s1, hand: [door] }

    const actions = availableActions(state)
    expect(actions.discardable).not.toContain(door.id)
  })

  it('Zombie (discardable:true) appears in discardable', () => {
    const s0 = makeState()
    const [zombie, s1] = mintWorld(s0, 'Zombie')
    const state = { ...s1, hand: [zombie] }

    const actions = availableActions(state)
    expect(actions.discardable).toContain(zombie.id)
  })
})

// ---------------------------------------------------------------------------
// 5. legalTargets — Barricade
// ---------------------------------------------------------------------------

describe('legalTargets Barricade', () => {
  it('step 0 returns world card ids in hand', () => {
    const s0 = makeState()
    const [barricade, s1] = mintPlayer(s0, 'Barricade')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const [rubble, s3] = mintWorld(s2, 'Rubble')
    const state = { ...s3, hand: [barricade, zombie, rubble] }

    const actions = availableActions(state)
    const targets = actions.legalTargets(barricade.id, 0)
    expect(targets).toHaveLength(2)
    expect(targets).toContain(zombie.id)
    expect(targets).toContain(rubble.id)
  })

  it('step 1 returns world card ids in hand', () => {
    const s0 = makeState()
    const [barricade, s1] = mintPlayer(s0, 'Barricade')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const [rubble, s3] = mintWorld(s2, 'Rubble')
    const state = { ...s3, hand: [barricade, zombie, rubble] }

    const actions = availableActions(state)
    const targets = actions.legalTargets(barricade.id, 1)
    expect(targets).toHaveLength(2)
    expect(targets).toContain(zombie.id)
    expect(targets).toContain(rubble.id)
  })
})

// ---------------------------------------------------------------------------
// 6. legalTargets — Adrenaline
// ---------------------------------------------------------------------------

describe('legalTargets Adrenaline', () => {
  it('returns other player card ids only — not self, not world cards', () => {
    const s0 = makeState()
    const [adrenaline, s1] = mintPlayer(s0, 'Adrenaline')
    const [explore, s2] = mintPlayer(s1, 'Explore')
    const [zombie, s3] = mintWorld(s2, 'Zombie')
    const state = { ...s3, hand: [adrenaline, explore, zombie] }

    const actions = availableActions(state)
    const targets = actions.legalTargets(adrenaline.id, 0)
    expect(targets).toHaveLength(1)
    expect(targets).toContain(explore.id)
    expect(targets).not.toContain(adrenaline.id)
    expect(targets).not.toContain(zombie.id)
  })
})

// ---------------------------------------------------------------------------
// 7. canEndTurn
// ---------------------------------------------------------------------------

describe('canEndTurn', () => {
  it('is true when status is playing', () => {
    const state = makeState({ status: 'playing' })
    expect(availableActions(state).canEndTurn).toBe(true)
  })

  it('is false when status is won', () => {
    const state = makeState({ status: 'won' })
    expect(availableActions(state).canEndTurn).toBe(false)
  })

  it('is false when status is lost', () => {
    const state = makeState({ status: 'lost' })
    expect(availableActions(state).canEndTurn).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8. Sprint legalTargets — modal branch dispatch
// ---------------------------------------------------------------------------

describe('legalTargets Sprint (modal)', () => {
  it('branch 0 (Draw) returns no targets', () => {
    const s0 = makeState()
    const [sprint, s1] = mintPlayer(s0, 'Sprint')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [sprint, zombie] }

    const actions = availableActions(state)
    expect(actions.legalTargets(sprint.id, 0)).toHaveLength(0)
  })

  it('branch 1 (DealProgress Slow) returns only Slow-keyword world cards', () => {
    const s0 = makeState()
    const [sprint, s1] = mintPlayer(s0, 'Sprint')
    // Construct cards directly to control keywords, independent of world data
    const slowCard: WorldCard = {
      kind: 'world', id: 'slow-1', name: 'Slow Hazard', insetKey: undefined,
      cost: 1, keywords: ['Slow'], discardable: false, canExile: true,
      onDiscarded: { kind: 'None' }, onCleared: { kind: 'None' }, onEndOfTurn: { kind: 'None' },
    }
    const otherCard: WorldCard = {
      kind: 'world', id: 'other-1', name: 'Other Hazard', insetKey: undefined,
      cost: 1, keywords: [], discardable: false, canExile: true,
      onDiscarded: { kind: 'None' }, onCleared: { kind: 'None' }, onEndOfTurn: { kind: 'None' },
    }
    const state = { ...s1, hand: [sprint, slowCard, otherCard], energy: 1 }

    const actions = availableActions(state)
    const targets = actions.legalTargets(sprint.id, 1)
    expect(targets).toContain(slowCard.id)
    expect(targets).not.toContain(otherCard.id)
  })
})

// ---------------------------------------------------------------------------
// 9. Barricade absent without world card in hand
// ---------------------------------------------------------------------------

describe('Barricade absent without world card', () => {
  it('Barricade is not in playable when hand has no world cards', () => {
    const s0 = makeState()
    const [barricade, s1] = mintPlayer(s0, 'Barricade')
    const [med, s2] = mintPlayer(s1, 'Med Kit')
    const state = { ...s2, hand: [barricade, med] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === barricade.id)
    expect(entry).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 10. Adrenaline absent without other player cards
// ---------------------------------------------------------------------------

describe('Adrenaline absent without other player cards to discard', () => {
  it('Adrenaline is not in playable when it is the only player card in hand', () => {
    const s0 = makeState()
    const [adrenaline, s1] = mintPlayer(s0, 'Adrenaline')
    // Only a world card alongside — no other player card to discard
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [adrenaline, zombie] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === adrenaline.id)
    expect(entry).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 11. DealProgressAll playability
// ---------------------------------------------------------------------------

describe('DealProgressAll playability', () => {
  it('DealProgressAll: not playable with zero world cards in hand', () => {
    const s0 = makeState()
    const [explore, s1] = mintPlayer(s0, 'Explore')
    // Shelf Sweep uses DealProgressAll — construct it inline to avoid catalog dependency
    const shelfSweep: PlayerCard = {
      kind: 'player',
      id: 'sweep-1',
      name: 'Shelf Sweep',
      insetKey: undefined,
      sourceWorldId: 'zombie-big-box',
      energyCost: 0,
      keywords: [],
      effect: { kind: 'DealProgressAll', base: 1, bonus: { tag: 'Creature', amount: 1 } },
    }
    const state = { ...s1, hand: [explore, shelfSweep] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === shelfSweep.id)
    expect(entry).toBeUndefined()
  })

  it('DealProgressAll: playable with one world card in hand', () => {
    const s0 = makeState()
    const [zombie, s1] = mintWorld(s0, 'Zombie')
    const shelfSweep: PlayerCard = {
      kind: 'player',
      id: 'sweep-2',
      name: 'Shelf Sweep',
      insetKey: undefined,
      sourceWorldId: 'zombie-big-box',
      energyCost: 0,
      keywords: [],
      effect: { kind: 'DealProgressAll', base: 1, bonus: { tag: 'Creature', amount: 1 } },
    }
    const state = { ...s1, hand: [zombie, shelfSweep] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === shelfSweep.id)
    expect(entry).toBeDefined()
    expect(entry!.spec).toEqual({ kind: 'none' })
  })
})

// ---------------------------------------------------------------------------
// 12. Energy affordability gate (was 11)
// ---------------------------------------------------------------------------

describe('Energy affordability gate', () => {
  it('Listen (cost 1) is absent from playable when energy === 0', () => {
    const s0 = makeState()
    const [listen, s1] = mintPlayer(s0, 'Listen')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [listen, zombie], energy: 0 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === listen.id)
    expect(entry).toBeUndefined()
  })

  it('Listen (cost 1) is present in playable when energy === 1', () => {
    const s0 = makeState()
    const [listen, s1] = mintPlayer(s0, 'Listen')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [listen, zombie], energy: 1 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === listen.id)
    expect(entry).toBeDefined()
  })

  it('Listen (cost 1) is present in playable when energy > 1', () => {
    const s0 = makeState()
    const [listen, s1] = mintPlayer(s0, 'Listen')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [listen, zombie], energy: 3 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === listen.id)
    expect(entry).toBeDefined()
  })

  it('ignoreEnergy: true bypasses the affordability check', () => {
    const s0 = makeState()
    const [listen, s1] = mintPlayer(s0, 'Listen')
    const [zombie, s2] = mintWorld(s1, 'Zombie')
    const state = { ...s2, hand: [listen, zombie], energy: 0 }

    const actions = availableActions(state, { ignoreEnergy: true })
    const entry = actions.playable.find((p) => p.cardId === listen.id)
    expect(entry).toBeDefined()
  })

  it('Cost-0 cards are always playable regardless of energy', () => {
    const s0 = makeState()
    const [medKit, s1] = mintPlayer(s0, 'Med Kit')
    const state = { ...s1, hand: [medKit], energy: 0 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === medKit.id)
    expect(entry).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 13. ExileTopWorldCards playability
// ---------------------------------------------------------------------------

/** Build a minimal exilable WorldCard directly. */
function makeExilable(id: string): WorldCard {
  return {
    kind: 'world', id, name: `Card-${id}`, insetKey: undefined,
    cost: 1, keywords: [], discardable: true, canExile: true,
    onDiscarded: { kind: 'None' }, onCleared: { kind: 'None' }, onEndOfTurn: { kind: 'None' },
  }
}

/** Build a non-exilable WorldCard (like Door or The Walker). */
function makeNonExilable(id: string): WorldCard {
  return { ...makeExilable(id), canExile: false }
}

/** Minimal PlayerCard with an ExileTopWorldCards effect for testing. */
function makeFloorIt(id: string): PlayerCard {
  return {
    kind: 'player',
    id,
    name: 'Floor It',
    insetKey: undefined,
    sourceWorldId: 'highway-volcano',
    energyCost: 0,
    exhaust: true,
    keywords: [],
    effect: { kind: 'ExileTopWorldCards', amount: 2 },
  }
}

describe('ExileTopWorldCards playability', () => {
  it('not playable when worldDraw has no exilable cards', () => {
    const s0 = makeState()
    const floorIt = makeFloorIt('fi-1')
    const ne1 = makeNonExilable('ne1')
    const ne2 = makeNonExilable('ne2')
    const state = { ...s0, hand: [floorIt], worldDraw: [ne1, ne2] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === floorIt.id)
    expect(entry).toBeUndefined()
  })

  it('playable when worldDraw has at least one exilable card', () => {
    const s0 = makeState()
    const floorIt = makeFloorIt('fi-2')
    const exilableCard = makeExilable('ex1')
    const state = { ...s0, hand: [floorIt], worldDraw: [exilableCard] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === floorIt.id)
    expect(entry).toBeDefined()
    expect(entry!.spec).toEqual({ kind: 'none' })
  })

  it('not playable when worldDraw is empty', () => {
    const s0 = makeState()
    const floorIt = makeFloorIt('fi-3')
    const state = { ...s0, hand: [floorIt], worldDraw: [] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === floorIt.id)
    expect(entry).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 14. Cut It Loose (Sequence: destroyHand → hazard)
// ---------------------------------------------------------------------------

describe('Cut It Loose (Sequence: destroyHand → hazard)', () => {
  const { catalog: birdCatalog, worldData: birdWorld } = buildWorld('bird-building')

  /** Build a minimal GameState for bird-building tests. */
  function makeBirdState(overrides: Partial<GameState> = {}): GameState {
    const base = createWorld(birdCatalog, birdWorld, 1)
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

  function mintBirdPlayer(state: GameState, name: Parameters<typeof mintCard>[2]): [PlayerCard, GameState] {
    const [card, next] = mintCard(birdCatalog, state, name)
    if (card.kind !== 'player') throw new Error(`${name} is not a player card`)
    return [card as PlayerCard, next]
  }

  function mintBirdWorld(state: GameState, name: Parameters<typeof mintCard>[2]): [WorldCard, GameState] {
    const [card, next] = mintCard(birdCatalog, state, name)
    if (card.kind !== 'world') throw new Error(`${name} is not a world card`)
    return [card as WorldCard, next]
  }

  it('appears in playable with compound spec when hand has ≥2 player cards AND ≥1 world card', () => {
    const s0 = makeBirdState()
    const [cutItLoose, s1] = mintBirdPlayer(s0, 'Cut It Loose')
    const [findFooting, s2] = mintBirdPlayer(s1, 'Find Footing')
    const [groaningGirders, s3] = mintBirdWorld(s2, 'Groaning Girders')
    const state = { ...s3, hand: [cutItLoose, findFooting, groaningGirders] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === cutItLoose.id)
    expect(entry).toBeDefined()

    const spec = entry!.spec
    expect(spec.kind).toBe('compound')
    if (spec.kind !== 'compound') throw new Error('not compound')

    expect(spec.steps[0]).toEqual({ kind: 'destroyHand', min: 1, max: 1 })
    expect(spec.steps[1]).toEqual({ kind: 'hazard' })
  })

  it('NOT in playable when only 1 player card in hand (self only — cannot destroy)', () => {
    const s0 = makeBirdState()
    const [cutItLoose, s1] = mintBirdPlayer(s0, 'Cut It Loose')
    const [groaningGirders, s2] = mintBirdWorld(s1, 'Groaning Girders')
    const state = { ...s2, hand: [cutItLoose, groaningGirders] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === cutItLoose.id)
    expect(entry).toBeUndefined()
  })

  it('legalTargets(cardId, 0) returns player cards excluding self', () => {
    const s0 = makeBirdState()
    const [cutItLoose, s1] = mintBirdPlayer(s0, 'Cut It Loose')
    const [findFooting, s2] = mintBirdPlayer(s1, 'Find Footing')
    const [steady, s3] = mintBirdPlayer(s2, 'Steady')
    const [groaningGirders, s4] = mintBirdWorld(s3, 'Groaning Girders')
    const state = { ...s4, hand: [cutItLoose, findFooting, steady, groaningGirders] }

    const actions = availableActions(state)
    const targets = actions.legalTargets(cutItLoose.id, 0)

    expect(targets).toHaveLength(2)
    expect(targets).toContain(findFooting.id)
    expect(targets).toContain(steady.id)
    expect(targets).not.toContain(cutItLoose.id)
    expect(targets).not.toContain(groaningGirders.id)
  })

  it('legalTargets(cardId, 1) returns world cards in hand', () => {
    const s0 = makeBirdState()
    const [cutItLoose, s1] = mintBirdPlayer(s0, 'Cut It Loose')
    const [findFooting, s2] = mintBirdPlayer(s1, 'Find Footing')
    const [groaningGirders, s3] = mintBirdWorld(s2, 'Groaning Girders')
    const [slidingDebris, s4] = mintBirdWorld(s3, 'Sliding Debris')
    const state = { ...s4, hand: [cutItLoose, findFooting, groaningGirders, slidingDebris] }

    const actions = availableActions(state)
    const targets = actions.legalTargets(cutItLoose.id, 1)

    expect(targets).toHaveLength(2)
    expect(targets).toContain(groaningGirders.id)
    expect(targets).toContain(slidingDebris.id)
    expect(targets).not.toContain(cutItLoose.id)
    expect(targets).not.toContain(findFooting.id)
  })
})

// ---------------------------------------------------------------------------
// None-effect playability (REQ-MALL-1 — Spore)
// ---------------------------------------------------------------------------

describe('None-effect playability (Spore)', () => {
  /**
   * Mint a Spore-shaped card: a paid no-op exhaust. There is no catalog
   * template yet, so mint any player card and spread the Spore shape onto it
   * (same pattern as the exhaust overrides in reduce.test.ts).
   */
  function mintSpore(state: GameState): [PlayerCard, GameState] {
    const [base, next] = mintPlayer(state, 'Explore')
    return [
      { ...base, name: 'Spore', effect: { kind: 'None' }, energyCost: 1, exhaust: true, keywords: ['Spore'] },
      next,
    ]
  }

  it('appears in playable with spec {kind:"none"} when energy >= 1', () => {
    const s0 = makeState({ energy: 1 })
    const [spore, s1] = mintSpore(s0)
    const state = { ...s1, hand: [spore] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === spore.id)
    expect(entry).toBeDefined()
    expect(entry!.spec).toEqual({ kind: 'none' })
  })

  it('is absent from playable when energy is 0', () => {
    const s0 = makeState({ energy: 0 })
    const [spore, s1] = mintSpore(s0)
    const state = { ...s1, hand: [spore] }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === spore.id)
    expect(entry).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// DealProgressScaled playability (REQ-MALL-5 — Bloom)
// ---------------------------------------------------------------------------

describe('DealProgressScaled playability', () => {
  function makeBloom(id: string): PlayerCard {
    return {
      kind: 'player',
      id,
      name: 'Bloom',
      insetKey: undefined,
      sourceWorldId: 'overgrown-mall',
      effect: {
        kind: 'DealProgressScaled',
        base: 1,
        per: { kind: 'KeywordInHand', keyword: 'Spore' },
        amount: 1,
      },
      energyCost: 1,
      exhaust: false,
      keywords: [],
    }
  }

  it('is absent from playable when no world card is in hand', () => {
    const state = makeState({ hand: [makeBloom('bloom-1')], energy: 1 })

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === 'bloom-1')
    expect(entry).toBeUndefined()
  })

  it('appears in playable with hazard spec and legal world targets', () => {
    const s0 = makeState({ energy: 1 })
    const bloom = makeBloom('bloom-2')
    const [zombie, s1] = mintWorld(s0, 'Zombie')
    const [rubble, s2] = mintWorld(s1, 'Rubble')
    const state = { ...s2, hand: [bloom, zombie, rubble], energy: 1 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === bloom.id)
    expect(entry).toBeDefined()
    expect(entry!.spec).toEqual({ kind: 'hazard' })
    expect(actions.legalTargets(bloom.id, 0)).toEqual([zombie.id, rubble.id])
  })

  it('is absent from playable when energy is too low', () => {
    const s0 = makeState({ energy: 0 })
    const bloom = makeBloom('bloom-3')
    const [zombie, s1] = mintWorld(s0, 'Zombie')
    const state = { ...s1, hand: [bloom, zombie], energy: 0 }

    const actions = availableActions(state)
    const entry = actions.playable.find((p) => p.cardId === bloom.id)
    expect(entry).toBeUndefined()
  })
})
