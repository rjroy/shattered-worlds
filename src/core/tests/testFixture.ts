/**
 * Shared test fixture: assembles catalog and worldData once for use across
 * all core test files. Import from here instead of duplicating setup.
 */
import { assembleCatalog } from '../model/catalog'
import type { RawCardSource, WorldData } from '../model/catalog'
import starterJson from '../../data/worlds/starter.json'
import zombieJson from '../../data/worlds/zombie-big-box.json'

const STARTER_SOURCE = starterJson as unknown as RawCardSource
const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource

export const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])

export const worldData: WorldData = {
  worldId: ZOMBIE_SOURCE.worldId,
  starterDeck: STARTER_SOURCE.starterDeck!,
  deckComposition: ZOMBIE_SOURCE.deckComposition!,
}
