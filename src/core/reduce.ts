import type { Action, GameEvent, GameState } from './types'
import { IllegalActionError } from './errors'
import { draw } from './draw'

/**
 * Pure reducer: given a state and action, returns the next state and the
 * events produced. Never mutates the input state.
 */
export function reduce(
  state: GameState,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  switch (action.type) {
    case 'PlayCard': {
      const card = state.hand.find((c) => c.id === action.cardId)
      if (card === undefined) {
        throw new IllegalActionError(action, state)
      }

      const runningTotal = state.runningTotal + card.value
      const events: GameEvent[] = [
        { type: 'CardPlayed', cardId: card.id, value: card.value, runningTotal },
      ]

      return {
        state: {
          ...state,
          hand: state.hand.filter((c) => c.id !== action.cardId),
          played: [...state.played, card],
          runningTotal,
        },
        events,
      }
    }

    case 'EndTurn': {
      // 1. Record running total in history
      const total = state.runningTotal
      const history = [...state.history, total]

      // 2. Move hand + played into discard (hand cards first, then played cards)
      const discardedIds: readonly string[] = [
        ...state.hand.map((c) => c.id),
        ...state.played.map((c) => c.id),
      ]
      const discard = [...state.discard, ...state.hand, ...state.played]

      // Begin building event list with fixed-order prefix
      const prefixEvents: GameEvent[] = [
        { type: 'TurnEnded', total },
        { type: 'CardsDiscarded', cardIds: [...discardedIds] },
      ]

      // 3. Reset runningTotal; hand and played clear before the draw
      const afterDiscard: Pick<
        GameState,
        'drawPile' | 'hand' | 'discard' | 'rng'
      > = {
        drawPile: state.drawPile,
        hand: [],
        discard,
        rng: state.rng,
      }

      // 4. Draw 5 cards (handles reshuffle internally)
      const drawResult = draw(afterDiscard, 5)

      // drawResult.events = [...optional DeckShuffled, CardsDrawn]
      const allEvents: GameEvent[] = [...prefixEvents, ...drawResult.events]

      return {
        state: {
          drawPile: drawResult.drawPile,
          hand: drawResult.hand,
          played: [],
          discard: drawResult.discard,
          runningTotal: 0,
          history,
          rng: drawResult.rng,
        },
        events: allEvents,
      }
    }
  }
}
