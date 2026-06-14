import type { GameState } from "../model/types";
import { refillHand, resolveForceDestroy } from "./draw";
import type { EffectResult } from "../effects/EffectContext";

// Light dims one step per turn. A constant (not per-world tuning): the decay
// model is "untended light fades", and the per-world dial is starting Light,
// not the decay rate. Soft per the spec; revisit in data if playtest demands.
const LIGHT_DECAY = 1;

// ---------------------------------------------------------------------------
// EffectResult type (used consistently across energy, draw, effects)
// ---------------------------------------------------------------------------

// The canonical `EffectResult` now lives in `../effects/EffectContext`. It is
// re-exported here so existing importers of `EffectResult` from `energy.ts`
// keep compiling.
export type { EffectResult };

export interface StartTurnResult extends EffectResult {
  playerCardsDrawn: number;
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
  const newEnergy = state.energy + 1;
  return {
    state: { ...state, energy: newEnergy },
    events: [{ type: "EnergyChanged", energy: newEnergy }],
  };
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
    return { state, events: [] };
  }

  const newEnergy = state.energy - cost;
  return {
    state: { ...state, energy: newEnergy },
    events: [{ type: "EnergyChanged", energy: newEnergy }],
  };
}

// ---------------------------------------------------------------------------
// startTurn
// ---------------------------------------------------------------------------

/**
 * Apply Light decay: light = max(0, light − LIGHT_DECAY), emitting LightChanged
 * ONLY when light was above 0. Emit-on-change is load-bearing for determinism:
 * non-Fog worlds always run with light === 0, so they emit no LightChanged here
 * and their event streams stay byte-identical to the pre-Light engine.
 */
function decayLight(state: GameState): EffectResult {
  if (state.light <= 0) {
    return { state, events: [] };
  }
  const newLight = Math.max(0, state.light - LIGHT_DECAY);
  return {
    state: { ...state, light: newLight },
    events: [{ type: "LightChanged", light: newLight }],
  };
}

/**
 * Compose decayLight, gainEnergy, refillHand, and resolveForceDestroy to
 * represent a complete turn start.
 *
 * Order guarantee: Light decay happens FIRST, before +1 energy and before the
 * hand refill, so the turn opens with the fog already crept in over the cards
 * the player kept, and only then are new cards drawn into the dimmer light.
 * Then +1 energy happens BEFORE hand refill (REQ-5). Forced destruction runs
 * LAST, so it acts on the just-dealt hand. This ordering is FIXED: it
 * determines the event sequence, hence determinism.
 *
 * Returns: { state, events }. In a light-world (light > 0) LightChanged is
 * emitted first, BEFORE EnergyChanged; in every other world decay emits nothing
 * and the stream opens with EnergyChanged exactly as before. Then all
 * draw/shuffle events, then any CardDestroyed events from pending ForceDestroy.
 */
export function startTurn(state: GameState): StartTurnResult {
  // Light decay first — before energy, refill, and force-destroy.
  const afterDecay = decayLight(state);
  const decayEvents = afterDecay.events;

  // Gain 1 energy
  const afterGain = gainEnergy(afterDecay.state);
  const stateWithEnergy = afterGain.state;
  const energyEvents = afterGain.events;

  const playerCountBeforeRefill = stateWithEnergy.hand.filter((c) => c.kind === "player").length;

  // Then refill the hand
  const refillResult = refillHand(stateWithEnergy);
  const playerCountAfterRefill = refillResult.state.hand.filter((c) => c.kind === "player").length;

  // Finally, drain any pending ForceDestroy charges against the new hand
  const destroyResult = resolveForceDestroy(refillResult.state);

  // Combine events: light decay first (when it fired), then energy gain, then
  // draw/shuffle, then destruction.
  return {
    state: destroyResult.state,
    events: [...decayEvents, ...energyEvents, ...refillResult.events, ...destroyResult.events],
    playerCardsDrawn: Math.max(0, playerCountAfterRefill - playerCountBeforeRefill),
  };
}
