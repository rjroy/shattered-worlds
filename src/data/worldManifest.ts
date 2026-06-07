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
import birdJson from './worlds/bird-building.json'
import volcanoJson from './worlds/highway-volcano.json'


/**
 * The worldManifest maps worldId to a builder function that assembles the catalog
 * and world descriptor for that world. This indirection allows us to export the
 * same assembled data for use by the headless sim and core tests, while still
 * loading the JSON asynchronously for the Phaser renderer.
 *
 * starter.json supplies the shared player starterDeck (plus The Walker / Door
 * templates every world references); each world file supplies its own card
 * templates and deckComposition. Builders all follow the same shape, so they are
 * produced by makeWorldBuilder rather than hand-written per world.
 */
const STARTER_SOURCE = starterJson as unknown as RawCardSource
const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource
const BIRD_SOURCE = birdJson as unknown as RawCardSource
const VOLCANO_SOURCE = volcanoJson as unknown as RawCardSource

/**
 * Build a world by merging the shared starter source with one world-specific
 * source: the merged catalog holds both, the world descriptor pairs the starter
 * deck with the world's own act composition.
 */
function makeWorldBuilder(worldSource: RawCardSource): () => AssembledWorld {
  return () => {
    if (STARTER_SOURCE === undefined || worldSource === undefined) {
      throw new CatalogError('JSON not available in Phaser cache')
    }

    // Fail fast on an authoring mistake: the starter source must carry the
    // shared deck, and each world source must carry its own act composition.
    // A missing field here would otherwise surface as a confusing crash mid-run.
    if (STARTER_SOURCE.starterDeck === undefined) {
      throw new CatalogError('starter source is missing starterDeck')
    }
    if (worldSource.deckComposition === undefined) {
      throw new CatalogError(`world "${worldSource.worldId}" is missing deckComposition`)
    }

    const catalog = assembleCatalog([STARTER_SOURCE, worldSource])
    const worldData: WorldData = {
      worldId: worldSource.worldId,
      starterDeck: STARTER_SOURCE.starterDeck,
      deckComposition: worldSource.deckComposition,
    }

    return { catalog, worldData }
  }
}

export const worldManifest: Record<string, () => AssembledWorld> = {
  [ZOMBIE_SOURCE.worldId]: makeWorldBuilder(ZOMBIE_SOURCE),
  [BIRD_SOURCE.worldId]: makeWorldBuilder(BIRD_SOURCE),
  [VOLCANO_SOURCE.worldId]: makeWorldBuilder(VOLCANO_SOURCE),
}

export function buildWorld(worldId: string): AssembledWorld {
  const builder = worldManifest[worldId]
  if (typeof builder !== 'function') {
    throw new CatalogError(`No world builder found for worldId "${worldId}"`)
  }
  return builder()
}