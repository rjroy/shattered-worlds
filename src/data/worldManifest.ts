import { CatalogError } from '../core'
import { assembleCatalog } from '../core/model/catalog'
import type { RawCardSource, WorldData, AssembledWorld } from '../core/model/catalog'
import starterJson from './worlds/starter.json'
import { worldDataRegistry } from './worlds/registry'

const STARTER_SOURCE = starterJson as unknown as RawCardSource

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

export const worldManifest: Record<string, () => AssembledWorld> = Object.fromEntries(
  worldDataRegistry.map((bundle) => [bundle.id, makeWorldBuilder(bundle.source)])
)

export function buildWorld(worldId: string): AssembledWorld {
  const builder = worldManifest[worldId]
  if (typeof builder !== 'function') {
    throw new CatalogError(`No world builder found for worldId "${worldId}"`)
  }
  return builder()
}
