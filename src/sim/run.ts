import type { Card, GameState } from '../core/types'
import { createWorld } from '../core/world'
import { reduce } from '../core/reduce'
import { pickAction } from './policy'

// ---------------------------------------------------------------------------
// ID accounting — verifies no card id appears in more than one zone
// ---------------------------------------------------------------------------

function checkIdAccounting(state: GameState): void {
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

// ---------------------------------------------------------------------------
// Main sim loop
// ---------------------------------------------------------------------------

const N = parseInt(process.argv[2] ?? '100', 10)
const MAX_ACTIONS_PER_WORLD = 500

let wins = 0
let losses = 0
let totalTurns = 0
let violations = 0
let hadError = false

for (let seed = 1; seed <= N; seed++) {
  try {
    let state = createWorld(seed)
    let turns = 0
    let actions = 0

    while (state.status === 'playing' && actions < MAX_ACTIONS_PER_WORLD) {
      checkIdAccounting(state)
      const action = pickAction(state)
      const result = reduce(state, action)
      state = result.state
      if (action.type === 'EndTurn') turns++
      actions++
    }

    checkIdAccounting(state)

    if (state.status === 'won') wins++
    else if (state.status === 'lost') losses++
    else violations++ // hit action cap without reaching a terminal state

    totalTurns += turns
  } catch (err) {
    hadError = true
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`World seed=${seed} threw: ${msg}`)
  }
}

const avgTurns = N > 0 ? (totalTurns / N).toFixed(1) : '0'

console.log(`Sim complete: ${N} worlds`)
console.log(`  Wins:   ${wins}`)
console.log(`  Losses: ${losses}`)
console.log(`  Violations (capped): ${violations}`)
console.log(`  Avg turns per world: ${avgTurns}`)

if (violations > 0 || hadError) {
  process.exit(1)
}
