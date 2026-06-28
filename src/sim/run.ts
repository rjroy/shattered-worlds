import { createRng } from '../core/engine/rng'
import type { RngState } from '../core/model/types'
import { playOut } from './playOut'
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
    // playOut owns the decide-on-view / commit loop and the checkIdAccounting
    // call sites. We thread finalAgentRng forward exactly as the inline loop
    // threaded agentRng, so the random stream — and this output — is unchanged.
    const outcome = playOut(catalog, worldData, seed, policy, agentRng, {
      maxActions: MAX_ACTIONS_PER_WORLD,
    })
    agentRng = outcome.finalAgentRng

    if (outcome.status === 'won') wins++
    else if (outcome.status === 'lost') losses++
    else violations++ // hit action cap without reaching a terminal state

    totalTurns += outcome.turns
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
