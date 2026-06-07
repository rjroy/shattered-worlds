import { describe, expect, test } from 'bun:test'
import type { GameState } from '../../core/model/types'
import { createWorld } from '../../core/engine/world'
import { reduce } from '../../core/engine/reduce'
import { rngFromSeed } from '../../core/engine/rng'
import { buildZombieWorld } from '../../data/worldManifest'
import { checkIdAccounting } from '../accounting'
import { pickAction } from '../policy'

// ---------------------------------------------------------------------------
// Catalog + world descriptor — assembled once at module load
// ---------------------------------------------------------------------------

const { catalog, worldData } = buildZombieWorld()

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const WORLD_TIMEOUT = 10000 // ms, for test timeouts
const WORLD_COUNT = 1000
const MAX_ACTIONS = 500

function runWorld(seed: number): { finalState: GameState; turns: number; actions: number } {
  let state = createWorld(catalog, worldData, seed)
  const rng = rngFromSeed(seed)
  let turns = 0
  let actions = 0

  while (state.status === 'playing' && actions < MAX_ACTIONS) {
    const action = pickAction(state, rng)
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
  test(`all worlds reach terminal state within ${MAX_ACTIONS} actions`, () => {
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      const { finalState, actions } = runWorld(seed)
      expect(
        finalState.status === 'won' || finalState.status === 'lost',
        `World seed=${seed} did not reach terminal state in ${actions} actions`,
      ).toBe(true)
    }
  }, { timeout: WORLD_TIMEOUT })

  test(`never throws across ${WORLD_COUNT} worlds`, () => {
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      expect(() => runWorld(seed)).not.toThrow()
    }
  }, { timeout: WORLD_TIMEOUT })

  test(`at least 1 win in ${WORLD_COUNT} worlds`, () => {
    let wins = 0
    // WORLD_COUNT is used because `runWorld` isn't designed to win consistently; it's a smoke test to catch catastrophic regressions, not a benchmark for the policy's win rate. If this test fails, it indicates a severe issue with the game logic or policy. 
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      const { finalState } = runWorld(seed)
      if (finalState.status === 'won') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(1)
  }, { timeout: WORLD_TIMEOUT })

  test(`ID accounting holds for ${WORLD_COUNT} worlds`, () => {
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      let state = createWorld(catalog, worldData, seed)
      const rng = rngFromSeed(seed)
      let actions = 0

      while (state.status === 'playing' && actions < MAX_ACTIONS) {
        expect(() => checkIdAccounting(state)).not.toThrow()
        const action = pickAction(state, rng)
        const result = reduce(catalog, state, action)
        state = result.state
        actions++
      }

      // Final state check
      expect(() => checkIdAccounting(state)).not.toThrow()
    }
  }, { timeout: WORLD_TIMEOUT })
})
