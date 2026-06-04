import type { GameState } from '../core/index'
import { walkerProximityForAct } from './visualMappers'
import type { WalkerProximity } from './visualMappers'

export type WalkerPresentation =
  | { kind: 'proximity'; proximity: WalkerProximity }
  | { kind: 'foreground' }
  | { kind: 'hidden' }  // theme has no walker texture

/**
 * Derives the Walker's visual state from game state.
 * Pure: no Phaser, no side effects.
 */
export function walkerPresentation(state: GameState, hasWalker: boolean): WalkerPresentation {
  if (!hasWalker) return { kind: 'hidden' }
  if (state.hand.some((c) => c.name === 'The Walker')) {
    return { kind: 'foreground' }
  }
  return { kind: 'proximity', proximity: walkerProximityForAct(state.actIndex) }
}
