import type { GameState, Action, RngState } from '../core/types'
import { nextFloat } from '../core/rng'

/**
 * Given the current state and an rng, pick the next action uniformly at
 * random from the legal moves available:
 *
 * - If the hand is non-empty there are n+1 options:
 *     indices 0..n-1 → PlayCard for the card at that index
 *     index n        → EndTurn
 * - If the hand is empty there is only one option: EndTurn.
 *
 * Because EndTurn always refills the hand to 5 (via reduce → draw), this
 * policy never produces an illegal PlayCard action.
 *
 * Returns [action, nextRng] without mutating either input.
 */
export function pickAction(state: GameState, rng: RngState): [Action, RngState] {
  const { hand } = state

  if (hand.length === 0) {
    return [{ type: 'EndTurn' }, rng]
  }

  // n+1 choices: 0..n-1 are PlayCard, n is EndTurn
  const options = hand.length + 1
  const [raw, nextRng] = nextFloat(rng)
  const index = Math.floor(raw * options)

  if (index < hand.length) {
    // noUncheckedIndexedAccess: index is always < hand.length because
    // Math.floor(raw * options) where raw ∈ [0,1) and options = hand.length+1
    // gives a value in [0, hand.length]. The guard below satisfies the type
    // checker; it can never fire in practice.
    const card = hand[index]
    if (card === undefined) {
      return [{ type: 'EndTurn' }, nextRng]
    }
    return [{ type: 'PlayCard', cardId: card.id }, nextRng]
  }

  return [{ type: 'EndTurn' }, nextRng]
}
