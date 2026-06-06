import { describe, expect, test } from 'bun:test'
import type { GameState } from '../../core/model/types'
import { createWorld } from '../../core/engine/world'
import { reduce } from '../../core/engine/reduce'
import { buildZombieWorld } from '../../data/zombieWorld'
import { checkIdAccounting } from '../accounting'
import { pickAction } from '../policy'

// ---------------------------------------------------------------------------
// Catalog + world descriptor — assembled once at module load
// ---------------------------------------------------------------------------

const { catalog, worldData } = buildZombieWorld()

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const MAX_ACTIONS = 500

function runWorld(seed: number): { finalState: GameState; turns: number; actions: number } {
  let state = createWorld(catalog, worldData, seed)
  let turns = 0
  let actions = 0

  while (state.status === 'playing' && actions < MAX_ACTIONS) {
    const action = pickAction(state)
    const result = reduce(catalog, state, action)
    state = result.state
    if (action.type === 'EndTurn') turns++
    actions++
  }

  return { finalState: state, turns, actions }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('policy', () => {
  test('never throws across 10 worlds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(() => runWorld(seed)).not.toThrow()
    }
  })

  test('at least 1 win in 50 worlds', () => {
    let wins = 0
    for (let seed = 1; seed <= 50; seed++) {
      const { finalState } = runWorld(seed)
      if (finalState.status === 'won') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(1)
  })

  test('ID accounting holds for 5 worlds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let state = createWorld(catalog, worldData, seed)
      let actions = 0

      while (state.status === 'playing' && actions < MAX_ACTIONS) {
        expect(() => checkIdAccounting(state)).not.toThrow()
        const action = pickAction(state)
        const result = reduce(catalog, state, action)
        state = result.state
        actions++
      }

      // Final state check
      expect(() => checkIdAccounting(state)).not.toThrow()
    }
  })

  test('all worlds reach terminal state within 500 actions', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { finalState, actions } = runWorld(seed)
      expect(
        finalState.status === 'won' || finalState.status === 'lost',
        `World seed=${seed} did not reach terminal state in ${actions} actions`,
      ).toBe(true)
    }
  })
})
