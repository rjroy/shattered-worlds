import type { Action, GameEvent, GameState } from './types'
import type { GameCore } from './contract'
import { buildLibrary } from './cards'
import { createRng } from './rng'
import { shuffle } from './rng'
import { draw } from './draw'
import { reduce } from './reduce'

/**
 * Create a new game instance seeded with the given number.
 * Builds the 10-card library, shuffles it, deals the first 5 cards to hand,
 * and returns a GameCore facade that owns the current state snapshot.
 */
export function createGame(seed: number): GameCore {
  const library = buildLibrary()
  const rng = createRng(seed)
  const [shuffled, rngAfterShuffle] = shuffle(library, rng)

  // Initial state before first draw
  const seedState: Pick<GameState, 'drawPile' | 'hand' | 'discard' | 'rng'> = {
    drawPile: shuffled,
    hand: [],
    discard: [],
    rng: rngAfterShuffle,
  }

  const firstDraw = draw(seedState, 5)

  let current: GameState = {
    drawPile: firstDraw.drawPile,
    hand: firstDraw.hand,
    played: [],
    discard: firstDraw.discard,
    runningTotal: 0,
    history: [],
    rng: firstDraw.rng,
  }

  return {
    get state(): GameState {
      return current
    },

    dispatch(action: Action): { state: GameState; events: GameEvent[] } {
      const result = reduce(current, action)
      current = result.state
      return result
    },
  }
}
