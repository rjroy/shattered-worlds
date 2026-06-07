import type { GameState } from '../../core/index'
import { walkerProximityForAct, VISUAL_CONSTS, doorProximityForAct  } from './visualMappers'
import type { WalkerProximity} from './visualMappers'

export type WalkerPresentation =
  | { kind: 'proximity'; proximity: WalkerProximity }
  | { kind: 'foreground'; proximity: WalkerProximity }
  | { kind: 'hidden' }  // theme has no walker texture

/**
 * Derives the Walker's visual state from game state.
 * Pure: no Phaser, no side effects.
 */
export function walkerPresentation(state: GameState, hasWalker: boolean): WalkerPresentation {
  if (!hasWalker) return { kind: 'hidden' }
  if (state.hand.some((c) => c.name === 'The Walker')) {
    return { kind: 'foreground', proximity: { size: VISUAL_CONSTS.walker.proximity.present.size, alpha: VISUAL_CONSTS.walker.proximity.present.alpha } }
  }
  return { kind: 'proximity', proximity: walkerProximityForAct(state.actIndex, state.totalActs) }
}

export function doorPresentation(state: GameState, hasWalker: boolean): WalkerPresentation {
  if (!hasWalker) return { kind: 'hidden' }
  if (state.hand.some((c) => c.name === 'The Walker')) {
    return { kind: 'foreground', proximity: { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.present.alpha } }
  }
  return { kind: 'proximity', proximity: doorProximityForAct(state.actIndex, state.totalActs) }
}
