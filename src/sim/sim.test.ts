import { describe, it, expect } from 'bun:test'
import { createGame } from '../core/game'
import type { GameState } from '../core/types'
import { pickAction } from './policy'

const TOTAL_CARDS = 10

/** Collect all card ids across the four zones. */
function allCardIds(state: GameState): string[] {
  return [
    ...state.drawPile.map((c) => c.id),
    ...state.hand.map((c) => c.id),
    ...state.played.map((c) => c.id),
    ...state.discard.map((c) => c.id),
  ]
}

/** Returns null if conservation holds, or an error message if it doesn't. */
function checkConservation(state: GameState): string | null {
  const ids = allCardIds(state)
  const unique = new Set(ids)

  if (ids.length !== TOTAL_CARDS) {
    return `total count is ${ids.length}, expected ${TOTAL_CARDS}`
  }
  if (unique.size !== TOTAL_CARDS) {
    return `${unique.size} unique ids, expected ${TOTAL_CARDS} (duplicate detected)`
  }
  return null
}

describe('sim integration', () => {
  it('dispatches 1000 random-legal actions without errors or invariant violations', () => {
    const STEPS = 1000
    const game = createGame(42)

    // Conservation must hold on initial state before any actions
    const initialViolation = checkConservation(game.state)
    expect(initialViolation).toBeNull()

    let rng = game.state.rng
    let endTurnCount = 0
    let firstViolation: string | null = null

    for (let step = 1; step <= STEPS; step++) {
      const [action, nextRng] = pickAction(game.state, rng)
      rng = nextRng

      // This must not throw — no illegal actions from the policy
      const result = game.dispatch(action)

      if (action.type === 'EndTurn') {
        endTurnCount++
      }

      const violation = checkConservation(result.state)
      if (violation !== null && firstViolation === null) {
        firstViolation = `Step ${step}: ${violation}`
      }
    }

    // 1. No invariant violation at any step
    expect(firstViolation).toBeNull()

    // 2. Conservation holds on final state
    expect(checkConservation(game.state)).toBeNull()

    // 3. History has accumulated entries — at least a few EndTurn events happened.
    //    With 1000 actions and hands of up to 5 cards, we expect many turns.
    //    A conservative lower bound: at least 100 EndTurn events out of 1000 steps.
    expect(endTurnCount).toBeGreaterThan(100)
    expect(game.state.history.length).toBeGreaterThan(0)
    expect(game.state.history.length).toBe(endTurnCount)
  })

  it('policy never produces a PlayCard action for a card not in hand', () => {
    // Run a shorter stress test specifically checking that every PlayCard
    // action produced by pickAction references a card currently in hand.
    const STEPS = 500
    const game = createGame(99)
    let rng = game.state.rng

    for (let step = 1; step <= STEPS; step++) {
      const stateBefore = game.state
      const [action, nextRng] = pickAction(stateBefore, rng)
      rng = nextRng

      if (action.type === 'PlayCard') {
        const cardInHand = stateBefore.hand.some((c) => c.id === action.cardId)
        expect(cardInHand).toBe(true)
      }

      game.dispatch(action)
    }
  })

  it('conservation holds across two independent games with different seeds', () => {
    const STEPS = 200

    for (const seed of [1, 999]) {
      const game = createGame(seed)
      let rng = game.state.rng

      for (let step = 1; step <= STEPS; step++) {
        const [action, nextRng] = pickAction(game.state, rng)
        rng = nextRng
        game.dispatch(action)

        const violation = checkConservation(game.state)
        expect(violation).toBeNull()
      }
    }
  })
})
