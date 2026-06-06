import type { Card, GameState } from '../core/model/types'

/**
 * Verifies no card id appears in more than one zone. Throws on a duplicate.
 * Used as a runtime invariant by both the sim CLI and the sim tests.
 */
export function checkIdAccounting(state: GameState): void {
  const allZones: Card[] = [
    ...state.playerDraw,
    ...state.hand,
    ...state.playerDiscard,
    ...state.worldDraw,
    ...state.acts.flat(),
  ]
  const seen = new Set<string>()
  for (const card of allZones) {
    if (seen.has(card.id)) {
      throw new Error(
        `Duplicate card id: ${card.id} (${card.name}) appears in multiple zones`,
      )
    }
    seen.add(card.id)
  }
}
