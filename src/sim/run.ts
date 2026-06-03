/**
 * Headless simulation runner — invoked via `bun run sim`.
 *
 * Drives createGame through the pickAction policy for STEPS actions.
 * After every dispatch it asserts the conservation invariant:
 *   drawPile + hand + played + discard must contain exactly 10 unique card ids.
 *
 * Exits 0 and prints a summary on success.
 * Exits 1 on any invariant violation or uncaught error.
 *
 * Imports ONLY from ../core/... and ./policy — no Phaser, no DOM, no game layer.
 */
import { createGame } from '../core/game'
import type { GameState } from '../core/types'
import { pickAction } from './policy'

const STEPS = (() => {
  const arg = process.argv[2]
  if (arg !== undefined) {
    const parsed = parseInt(arg, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return 1000
})()

const SEED = 42
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

/** Assert the conservation invariant. Throws on violation. */
function assertConservation(state: GameState, step: number): void {
  const ids = allCardIds(state)
  const unique = new Set(ids)

  if (ids.length !== TOTAL_CARDS) {
    throw new Error(
      `Conservation violation at step ${step}: total count is ${ids.length}, expected ${TOTAL_CARDS}`,
    )
  }

  if (unique.size !== TOTAL_CARDS) {
    throw new Error(
      `Conservation violation at step ${step}: ${unique.size} unique ids, expected ${TOTAL_CARDS} (duplicate detected)`,
    )
  }
}

function main(): void {
  const game = createGame(SEED)

  // Verify initial state before any dispatch
  assertConservation(game.state, 0)

  let rng = game.state.rng
  let turnsCompleted = 0

  for (let step = 1; step <= STEPS; step++) {
    const [action, nextRng] = pickAction(game.state, rng)
    rng = nextRng

    const result = game.dispatch(action)

    if (action.type === 'EndTurn') {
      turnsCompleted++
    }

    assertConservation(result.state, step)
  }

  const historyLength = game.state.history.length
  console.log(
    `Sim complete: ${STEPS} actions dispatched, ${turnsCompleted} turns ended, ${historyLength} history entries`,
  )
}

try {
  main()
  process.exit(0)
} catch (err) {
  console.error('Sim failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
}
