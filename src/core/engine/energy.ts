import type { GameEvent, GameState } from '../model/types'
import { refillHand } from './draw'

// ---------------------------------------------------------------------------
// EffectResult type (used consistently across energy, draw, effects)
// ---------------------------------------------------------------------------

export interface EffectResult {
  state: GameState
  events: GameEvent[]
}

// ---------------------------------------------------------------------------
// gainEnergy
// ---------------------------------------------------------------------------

/**
 * Gain 1 energy unconditionally.
 *
 * Returns: { state with energy += 1, events: [EnergyChanged] }
 */
export function gainEnergy(state: GameState): EffectResult {
  const newEnergy = state.energy + 1
  return {
    state: { ...state, energy: newEnergy },
    events: [{ type: 'EnergyChanged', energy: newEnergy }],
  }
}

// ---------------------------------------------------------------------------
// spendEnergy
// ---------------------------------------------------------------------------

/**
 * Spend energy (subtract cost). Assumes cost <= state.energy has been verified
 * by an affordability gate elsewhere (e.g., availableActions).
 *
 * Returns: { state with energy -= cost, events: [...] }
 * - If cost > 0: emits EnergyChanged event
 * - If cost === 0: returns empty events array (no change, no event)
 */
export function spendEnergy(state: GameState, cost: number): EffectResult {
  if (cost === 0) {
    return { state, events: [] }
  }

  const newEnergy = state.energy - cost
  return {
    state: { ...state, energy: newEnergy },
    events: [{ type: 'EnergyChanged', energy: newEnergy }],
  }
}

// ---------------------------------------------------------------------------
// startTurn
// ---------------------------------------------------------------------------

/**
 * Compose gainEnergy and refillHand to represent a complete turn start.
 *
 * Order guarantee: +1 energy happens BEFORE hand refill (REQ-5).
 *
 * Returns: { state, events } with EnergyChanged first, then all draw/shuffle events.
 */
export function startTurn(state: GameState): EffectResult {
  // Gain 1 energy first
  const afterGain = gainEnergy(state)
  const stateWithEnergy = afterGain.state
  const energyEvents = afterGain.events

  // Then refill the hand
  const refillResult = refillHand(stateWithEnergy)

  // Combine events: energy gain first, then draw/shuffle events
  return {
    state: refillResult.state,
    events: [...energyEvents, ...refillResult.events],
  }
}
