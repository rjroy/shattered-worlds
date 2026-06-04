import type { GameState } from './types'

/**
 * Tunable read-model: returns a value in [0.0, 1.0] expressing how intense
 * the current game state feels. Weights (0.4 / 0.4 / 0.2) are starting
 * points — adjust them as playtesting reveals what actually drives tension.
 */
export function intensity(state: GameState): number {
  const actFraction = state.actIndex / 2

  // Clamp so heal-above-max (hp > 20) or death (hp = 0) stay in range.
  const rawHpFraction = 1 - state.hp / 20
  const hpFraction = Math.max(0, Math.min(1, rawHpFraction))

  const worldsInHand = state.hand.filter(c => c.kind === 'world').length
  const heldHazardFraction = Math.min(1, worldsInHand / 3)

  return 0.4 * actFraction + 0.4 * hpFraction + 0.2 * heldHazardFraction
}
