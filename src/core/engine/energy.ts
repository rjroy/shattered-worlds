import type { GameState } from '../model/types'
import { refillHand, resolveForceDestroy } from './draw'
import type { EffectResult } from '../effects/EffectContext'

// ---------------------------------------------------------------------------
// EffectResult type (used consistently across energy, draw, effects)
// ---------------------------------------------------------------------------

// The canonical `EffectResult` now lives in `../effects/EffectContext`. It is
// re-exported here so existing importers of `EffectResult` from `energy.ts`
// keep compiling.
export type { EffectResult }

export interface StartTurnResult extends EffectResult {
  playerCardsDrawn: number
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
 * Compose gainEnergy, refillHand, and resolveForceDestroy to represent a
 * complete turn start.
 *
 * Order guarantee: +1 energy happens BEFORE hand refill (REQ-5). Forced
 * destruction runs LAST, so it acts on the just-dealt hand.
 *
 * Returns: { state, events } with EnergyChanged first, then all draw/shuffle
 * events, then any CardDestroyed events from pending ForceDestroy charges.
 */
export function startTurn(state: GameState): StartTurnResult {
  // Gain 1 energy first
  const afterGain = gainEnergy(state)
  const stateWithEnergy = afterGain.state
  const energyEvents = afterGain.events

  const playerCountBeforeRefill = stateWithEnergy.hand.filter((c) => c.kind === 'player').length

  // Then refill the hand
  const refillResult = refillHand(stateWithEnergy)
  const playerCountAfterRefill = refillResult.state.hand.filter((c) => c.kind === 'player').length

  // Finally, drain any pending ForceDestroy charges against the new hand
  const destroyResult = resolveForceDestroy(refillResult.state)

  // Combine events: energy gain first, then draw/shuffle, then destruction
  return {
    state: destroyResult.state,
    events: [...energyEvents, ...refillResult.events, ...destroyResult.events],
    playerCardsDrawn: Math.max(0, playerCountAfterRefill - playerCountBeforeRefill),
  }
}
