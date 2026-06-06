import type { Action, AvailableActions, GameEvent, GameState } from '../model/types'
import type { CardCatalog, WorldData } from '../model/catalog'
import { createWorld } from './world'
import { availableActions } from './available'
import { reduce } from './reduce'
import { intensity } from './intensity'

export interface GameCore {
  readonly state: GameState
  dispatch(action: Action): { state: GameState; events: GameEvent[] }
  availableActions(): AvailableActions
  intensity(): number
}

/**
 * Create a new game instance seeded with `seed`. The catalog and world
 * descriptor are captured in the closure and threaded through all dispatches.
 */
export function createGame(catalog: CardCatalog, world: WorldData, seed: number): GameCore {
  let current = createWorld(catalog, world, seed)

  return {
    get state() {
      return current
    },
    dispatch(action: Action) {
      const result = reduce(catalog, current, action)
      current = result.state
      return result
    },
    availableActions() {
      return availableActions(current)
    },
    intensity() {
      return intensity(current)
    },
  }
}
