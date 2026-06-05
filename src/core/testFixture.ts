/**
 * Shared test fixture: assembles catalog and worldData once for use across
 * all core test files. Import from here instead of duplicating setup.
 */
import { assembleCatalog } from './catalog'
import type { WorldData } from './catalog'
import { STARTER_SOURCE, ZOMBIE_SOURCE } from '../game/worldData'

export const catalog = assembleCatalog([STARTER_SOURCE, ZOMBIE_SOURCE])

export const worldData: WorldData = {
  worldId: ZOMBIE_SOURCE.worldId,
  // STARTER_SOURCE.starterDeck is guaranteed to exist — the starter JSON
  // defines the starter deck. ZOMBIE_SOURCE.deckComposition is guaranteed
  // to exist — the zombie JSON defines the deck composition.
  starterDeck: STARTER_SOURCE.starterDeck!,
  deckComposition: ZOMBIE_SOURCE.deckComposition!,
}
