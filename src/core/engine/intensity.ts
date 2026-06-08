import type { GameState } from '../model/types'
import { WORLD_CONSTS } from './world'

/**
 * Tunable read-model: returns a value in [0.0, 1.0] expressing how intense
 * the current game state feels. Weights (0.6 act / 0.3 hp / 0.1 held-hazards)
 * are starting points — adjust them as playtesting reveals what drives tension.
 */
export function intensity(state: GameState): number {
  const actFraction = Math.min(1, state.actIndex / state.totalActs)

  // Clamp so heal-above-max (hp > 10) or death (hp = 0) stay in range.
  const rawHpFraction = 1 - state.hp / WORLD_CONSTS.startHp
  const hpFraction = Math.max(0, Math.min(1, rawHpFraction))

  const worldsInHand = state.hand.filter(c => c.kind === 'world').length
  const heldHazardFraction = Math.min(1, worldsInHand / WORLD_CONSTS.maxHandSize)

  return Math.min(1, 0.5 * actFraction + 0.5 * hpFraction + 0.5 * heldHazardFraction)
}
