import { describe, expect, it } from 'bun:test'
import { assembleCatalog } from '../model/catalog'
import { CatalogError } from '../model/errors'
import type { RawCardSource } from '../model/catalog'
import starterJson from '../../data/worlds/starter.json'
import zombieJson from '../../data/worlds/zombie-big-box.json'

const STARTER_SOURCE = starterJson as unknown as RawCardSource
const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource

// ---------------------------------------------------------------------------
// 1. Merge completeness
// ---------------------------------------------------------------------------

describe('assembleCatalog merge completeness', () => {
  it('merging starter and zombie-big-box sources produces 17 templates', () => {
    const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])
    expect(Object.keys(catalog)).toHaveLength(17)
  })

  it('merged catalog contains all expected template ids', () => {
    const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])
    const expectedIds = [
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
    for (const id of expectedIds) {
      expect(catalog).toHaveProperty(id)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Collision detection
// ---------------------------------------------------------------------------

describe('assembleCatalog collision detection', () => {
  it('throws CatalogError when two sources share a templateId', () => {
    const sourceA: RawCardSource = {
      worldId: 'world-a',
      cardTemplates: {
        Sprint: {
          kind: 'player',
          name: 'Sprint',
          effect: { kind: 'Heal', amount: 1 },
        },
      },
    }
    const sourceB: RawCardSource = {
      worldId: 'world-b',
      cardTemplates: {
        Sprint: {
          kind: 'player',
          name: 'Sprint',
          effect: { kind: 'Heal', amount: 2 },
        },
      },
    }
    expect(() => assembleCatalog([sourceA, sourceB])).toThrow(CatalogError)
  })

  it('CatalogError is instanceof CatalogError', () => {
    const sourceA: RawCardSource = {
      worldId: 'world-a',
      cardTemplates: {
        Clash: {
          kind: 'player',
          name: 'Clash',
          effect: { kind: 'Heal', amount: 1 },
        },
      },
    }
    const sourceB: RawCardSource = {
      worldId: 'world-b',
      cardTemplates: {
        Clash: {
          kind: 'player',
          name: 'Clash',
          effect: { kind: 'Heal', amount: 1 },
        },
      },
    }
    let caught: unknown
    try {
      assembleCatalog([sourceA, sourceB])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(CatalogError)
  })

  it('single source with no duplicates does not throw', () => {
    const source: RawCardSource = {
      worldId: 'world-a',
      cardTemplates: {
        CardA: { kind: 'player', name: 'Card A', effect: { kind: 'Heal', amount: 1 } },
        CardB: { kind: 'player', name: 'Card B', effect: { kind: 'Heal', amount: 2 } },
      },
    }
    expect(() => assembleCatalog([source])).not.toThrow()
  })
})
