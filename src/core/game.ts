import type { Action, AvailableActions, GameEvent, GameState } from './types'
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
 * Create a new game instance seeded with `seed`. The returned object wraps
 * a mutable reference to the current state and exposes `dispatch` and
 * `availableActions` as the primary API for interacting with the game.
 */
export function createGame(seed: number): GameCore {
  let current = createWorld(seed)

  return {
    get state() {
      return current
    },
    dispatch(action: Action) {
      const result = reduce(current, action)
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
