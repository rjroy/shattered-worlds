import type { Card, GameEvent, GameState, RngState } from './types'
import { shuffle } from './rng'

// Result type for draw operations
interface DrawResult {
  drawPile: readonly Card[]
  hand: readonly Card[]
  discard: readonly Card[]
  rng: RngState
  events: GameEvent[]
}

/**
 * Draw n cards from the front of the draw pile into hand.
 * If the draw pile runs out before n, shuffle the discard into a new draw pile
 * (emit DeckShuffled), then continue drawing.
 * Returns new zones + events. CardsDrawn is always emitted; DeckShuffled is
 * emitted only if a reshuffle occurred.
 */
export function draw(
  state: Pick<GameState, 'drawPile' | 'hand' | 'discard' | 'rng'>,
  n: number,
): DrawResult {
  let drawPile: readonly Card[] = state.drawPile
  let discard: readonly Card[] = state.discard
  let rng: RngState = state.rng
  const drawn: Card[] = []
  const events: GameEvent[] = []

  let remaining = n

  while (remaining > 0) {
    if (drawPile.length > 0) {
      // Draw from the front (index 0 is top)
      const take = Math.min(remaining, drawPile.length)
      const batch = drawPile.slice(0, take)
      drawPile = drawPile.slice(take)
      drawn.push(...batch)
      remaining -= take
    } else if (discard.length > 0) {
      // Draw pile is empty — shuffle discard into a new draw pile
      const [shuffled, nextRng] = shuffle(discard, rng)
      rng = nextRng
      drawPile = shuffled
      discard = []
      events.push({ type: 'DeckShuffled' })
      // Continue the loop to draw from the newly shuffled pile
    } else {
      // Both draw pile and discard are empty — nothing left to draw
      break
    }
  }

  events.push({ type: 'CardsDrawn', cardIds: drawn.map((c) => c.id) })

  return {
    drawPile,
    hand: [...state.hand, ...drawn],
    discard,
    rng,
    events,
  }
}
