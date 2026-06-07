/**
 * Zombie Big Box world fixture: the JSON card sources plus an assembled
 * catalog + world descriptor. Shared by the headless sim and the core tests
 * so the bootstrap lives in exactly one place. The Phaser renderer does NOT
 * use this — it loads the same JSON asynchronously through assetManifest.
 */
import { CatalogError } from '../core'
import { assembleCatalog } from '../core/model/catalog'
import type { RawCardSource, WorldData, AssembledWorld } from '../core/model/catalog'
import starterJson from './worlds/starter.json'
import zombieJson from './worlds/zombie-big-box.json'


/**
 * The worldManifest maps worldId to a builder function that assembles the catalog
 * and world descriptor for that world. This indirection allows us to export the
 * same assembled data for use by the headless sim and core tests, while still
 * loading the JSON asynchronously for the Phaser renderer.
 */
const STARTER_SOURCE = starterJson as unknown as RawCardSource
const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource

/** Assemble the catalog and world descriptor for the Zombie Big Box world. */
function buildZombieWorld(): AssembledWorld {

  if (STARTER_SOURCE === undefined || ZOMBIE_SOURCE === undefined) {
    throw new CatalogError('JSON not available in Phaser cache')
  }

  // starter.json defines starterDeck; zombie-big-box.json defines deckComposition.
  const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])
  const worldData: WorldData = {
    worldId: ZOMBIE_SOURCE.worldId,
    starterDeck: STARTER_SOURCE.starterDeck!,
    deckComposition: ZOMBIE_SOURCE.deckComposition!,
  }

  return { catalog, worldData }
}

export const worldManifest: Record<string, () => AssembledWorld> = {
  [ZOMBIE_SOURCE.worldId]: buildZombieWorld,
}

export function buildWorld(worldId: string): AssembledWorld {
  const builder = worldManifest[worldId]
  if (typeof builder !== 'function') {
    throw new CatalogError(`No world builder found for worldId "${worldId}"`)
  }
  return builder()
}