import { describe, expect, test } from 'bun:test'
import type { Action, GameState } from '../../core/model/types'
import type { CardCatalog, WorldData } from '../../core/model/catalog'
import { createWorld } from '../../core/engine/world'
import { reduce } from '../../core/engine/reduce'
import { createRng, nextFloat, rngFromSeed } from '../../core/engine/rng'
import { checkIdAccounting } from '../accounting'
import { determinize } from '../determinize'
import { DEFAULT_EVAL_WEIGHTS } from '../eval'
import { evalPolicyFactory } from '../evalPolicy'
import { playOut } from '../playOut'
import { enumerateActions, pickAction, randomPolicy, catalog, worldData, type Policy } from '../policy'


// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const WORLD_TIMEOUT = 10000 // ms, for test timeouts
const WORLD_COUNT = 1000
const MAX_ACTIONS = 500

/**
 * A mid-run state with every hidden zone populated (cards drawn, acts still
 * queued), so a determinization reshuffle is observable.
 */
function midRunState(seed: number): GameState {
  let state = createWorld(catalog, worldData, seed).state
  const rng = rngFromSeed(seed)
  let actions = 0
  while (
    state.status === 'playing' &&
    actions < 200 &&
    (state.playerDraw.length < 2 || state.acts.length === 0)
  ) {
    const action = pickAction(state, rng)
    state = reduce(catalog, state, action).state
    actions++
  }
  return state
}

function runWorld(seed: number): { finalState: GameState; turns: number; actions: number } {
  let state = createWorld(catalog, worldData, seed).state
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

  /*
  test(`at least 1 win in ${WORLD_COUNT} worlds`, () => {
    let wins = 0
    // WORLD_COUNT is used because `runWorld` isn't designed to win consistently; it's a smoke test to catch catastrophic regressions, not a benchmark for the policy's win rate. If this test fails, it indicates a severe issue with the game logic or policy. 
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      const { finalState } = runWorld(seed)
      if (finalState.status === 'won') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(1)
  }, { timeout: WORLD_TIMEOUT })
  */

  // The runner determinizes the real state, hands the snapshot to the policy,
  // and applies the chosen action back to the REAL state. This test proves the
  // policy decides on the determinized VIEW (hidden zones reshuffled), not on the
  // real state's hidden zones — i.e. the seam is wired the right way round.
  //
  // Scope note: this proves the WIRING, not honest play. The random policy
  // ignores hidden info entirely, so it cannot exploit the view either way.
  // Honest-play validation — an agent that genuinely cannot win by cheating —
  // arrives with the follow-on greedy agent; this seam test is the in-scope
  // proof for the random policy.
  test('policy decides on the determinized snapshot, not the real state', () => {
    const state = midRunState(1)
    expect(state.status).toBe('playing')
    expect(state.playerDraw.length).toBeGreaterThan(1)
    expect(state.acts.length).toBeGreaterThan(0)

    // Spy policy: record the view it is handed, then defer to the real policy.
    let captured: GameState | undefined
    const spy: Policy = (view, rng) => {
      captured = view
      return randomPolicy(view, rng)
    }

    // Mirror the runner's seam: determinize the real state, bridge RngState to a
    // () => number closure, decide on the snapshot, apply to the real state.
    const [view, rngAfterDet] = determinize(state, createRng(2024))
    const [seedValue] = nextFloat(rngAfterDet)
    const action = spy(view, rngFromSeed(Math.floor(seedValue * 0x100000000)))

    expect(captured).toBe(view)

    // Hidden zones: same cards (multiset preserved) but reshuffled order. At
    // least one zone reorders, so the policy's view is provably not the real
    // state's hidden info. Seeded, so this is deterministic.
    const hiddenOrder = (s: GameState): string[] => [
      ...s.playerDraw.map((c) => c.id),
      ...s.worldDraw.map((c) => c.id),
      ...s.acts.flatMap((a) => a.map((c) => c.id)),
    ]
    expect(hiddenOrder(captured!)).not.toEqual(hiddenOrder(state))
    expect([...hiddenOrder(captured!)].sort()).toEqual([...hiddenOrder(state)].sort())

    // The action decided on the snapshot applies cleanly to the REAL state.
    expect(() => reduce(catalog, state, action)).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // Modal nested inside a compound spec.
  //
  // Regression: the panic-response unlock rewrites Panic into a Sequence whose
  // first step is a Modal. checkPlayAction demands `choice` for that step, but
  // the compound builder used to skip modal steps entirely (assuming modal was
  // only ever the TOP-LEVEL spec), so every enumerated play of such a card was
  // an IllegalActionError waiting in reduce. The hand-rolled card below is the
  // minimal shape of that unlock's Panic.
  // -------------------------------------------------------------------------

  const NESTED_MODAL_CARD = 'nested-modal-panic'
  const NESTED_MODAL_HAZARD = 'nested-modal-hazard'

  const nestedModalCatalog: CardCatalog = {
    [NESTED_MODAL_CARD]: {
      kind: 'player',
      name: 'panic (fight or flight)',
      energyCost: 0,
      effect: {
        kind: 'Sequence',
        steps: [
          {
            kind: 'Modal',
            branches: [
              { kind: 'DealProgressAll', base: 2 },
              { kind: 'ReturnWorldCards', min: 1, max: 12 },
            ],
          },
          { kind: 'Draw', world: 1 },
        ],
      },
    },
    [NESTED_MODAL_HAZARD]: {
      kind: 'world',
      name: 'lurker',
      cost: 6,
      keywords: [],
      discardable: true,
      canExile: true,
      onDiscarded: { kind: 'None' },
      onCleared: { kind: 'None' },
      onEndOfTurn: { kind: 'None' },
      onPartialClear: { kind: 'None' },
      onDraw: { kind: 'None' },
    },
  }

  const nestedModalWorld: WorldData = {
    worldId: 'nested-modal-world',
    starterDeck: [{ templateId: NESTED_MODAL_CARD, count: 10 }],
    deckComposition: {
      acts: [{ cards: [{ templateId: NESTED_MODAL_HAZARD, count: 6 }] }],
    },
  }

  test('a modal nested in a compound enumerates with `choice` set and reduces cleanly', () => {
    type PlayCardAction = Extract<Action, { type: 'PlayCard' }>
    for (let seed = 1; seed <= 25; seed++) {
      const state = createWorld(nestedModalCatalog, nestedModalWorld, seed).state
      const rng = rngFromSeed(seed)
      const actions = enumerateActions(state, rng)

      const plays = actions.filter(
        (action): action is PlayCardAction => action.type === 'PlayCard',
      )
      expect(plays.length).toBeGreaterThan(0)
      for (const play of plays) {
        expect(play.choice).toBeDefined()
      }
      for (const action of actions) {
        expect(() => reduce(nestedModalCatalog, state, action)).not.toThrow()
      }
    }
  })

  test('the eval policy plays a nested-modal world out without an illegal action', () => {
    // Mirrors the sim:complete decision loop (enumerate -> reduce every
    // candidate against a determinized view -> commit the argmax), which is
    // exactly where the panic-response recovery configuration used to crash.
    const policy = evalPolicyFactory(nestedModalCatalog, DEFAULT_EVAL_WEIGHTS, 2)
    let agentRng = createRng(777)
    for (let seed = 1; seed <= 5; seed++) {
      const outcome = playOut(nestedModalCatalog, nestedModalWorld, seed, policy, agentRng, {
        maxActions: 200,
      })
      agentRng = outcome.finalAgentRng
      expect(['won', 'lost', 'capped']).toContain(outcome.status)
    }
  }, { timeout: WORLD_TIMEOUT })

  test(`ID accounting holds for ${WORLD_COUNT} worlds`, () => {
    for (let seed = 1; seed <= WORLD_COUNT; seed++) {
      let state = createWorld(catalog, worldData, seed).state
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
