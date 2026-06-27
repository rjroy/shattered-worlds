import { createWorld } from '../core/engine/world'
import { reduce } from '../core/engine/reduce'
import { createRng, nextFloat, rngFromSeed } from '../core/engine/rng'
import type { RngState } from '../core/model/types'
import { checkIdAccounting } from './accounting'
import { determinize } from './determinize'
import { randomPolicy, catalog, worldData } from './policy'


// ---------------------------------------------------------------------------
// Main sim loop
// ---------------------------------------------------------------------------

const N = parseInt(process.argv[2] ?? '100', 10)
const MAX_ACTIONS_PER_WORLD = 500

// The agent's randomness is fully separate from `state.rng`: one RngState is
// seeded here and threaded across every decision in the whole loop. A fixed
// (configurable via argv[3]) seed makes the entire sim reproducible — same seed,
// same worlds, same plays, byte for byte — without ever touching `Math.random`.
const AGENT_SEED = parseInt(process.argv[3] ?? '12345', 10)
let agentRng: RngState = createRng(AGENT_SEED)

const policy = randomPolicy

let wins = 0
let losses = 0
let totalTurns = 0
let violations = 0
let hadError = false

for (let seed = 1; seed <= N; seed++) {
  try {
    let state = createWorld(catalog, worldData, seed).state
    let turns = 0
    let actions = 0

    while (state.status === 'playing' && actions < MAX_ACTIONS_PER_WORLD) {
      checkIdAccounting(state)

      // Decide on a determinized, player-honest snapshot; apply to the REAL
      // state. determinize advances the threaded agent rng (its reshuffles), and
      // we carry the returned state forward so no two decisions repeat.
      const [view, rngAfterDet] = determinize(state, agentRng)

      // Bridge the pure RngState the runner threads to the `() => number` closure
      // the policy wants: pull one value, expand it into a stateful sfc32
      // closure, and thread the post-pull rng state forward. The closure's own
      // advances during a single decision stay local; only `agentRng` persists.
      const [seedValue, rngAfterPolicy] = nextFloat(rngAfterDet)
      const policyRng = rngFromSeed(Math.floor(seedValue * 0x100000000))
      agentRng = rngAfterPolicy

      // Boon choices ride the same path: determinize hides the unreached acts /
      // draw piles, the policy decides on the snapshot, and the action lands on
      // the real state. `pickAction` resolves a pending boon before anything else.
      const action = policy(view, policyRng)
      const result = reduce(catalog, state, action)
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
