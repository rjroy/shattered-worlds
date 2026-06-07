/**
 * Zombie Big Box world fixture: the JSON card sources plus an assembled
 * catalog + world descriptor. Shared by the headless sim and the core tests
 * so the bootstrap lives in exactly one place. The Phaser renderer does NOT
 * use this — it loads the same JSON asynchronously through assetManifest.
 */
import { CatalogError } from '../core'
import { assembleCatalog } from '../core/model/catalog'
import type { CardCatalog, RawCardSource, WorldData, AssembledWorld } from '../core/model/catalog'
import starterJson from './worlds/starter.json'
import zombieJson from './worlds/zombie-big-box.json'

export const STARTER_SOURCE = starterJson as unknown as RawCardSource
export const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource

/** Assemble the catalog and world descriptor for the Zombie Big Box world. */
function buildZombieWorld(): AssembledWorld {

  if (STARTER_SOURCE === undefined || ZOMBIE_SOURCE === undefined) {
    throw new CatalogError('JSON not available in Phaser cache')
  }

  const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])
  // starter.json defines starterDeck; zombie-big-box.json defines deckComposition.
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