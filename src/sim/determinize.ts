import type { Card, GameState, RngState, WorldCard } from "../core/model/types";
import { createRng, nextFloat, shuffle } from "../core/engine/rng";
import { hiddenZones } from "../core/model/observability";

/**
 * Produce a player-honest snapshot of `state` for a sim agent to plan on: every
 * zone hidden from a human (the draw piles and the not-yet-reached acts) is
 * reshuffled under the agent's own rng, so the agent learns no more from the
 * snapshot than a player would. Visible zones (`hand`, `playerDiscard`),
 * resources, and every card instance/id are left untouched — this is a REORDER
 * of the same objects, never a re-mint.
 *
 * Pure and seedable, mirroring core's rng helpers: `agentRng` is the pure
 * `RngState` form (not a `() => number` closure), and the advanced state is
 * threaded through every reshuffle and returned alongside the snapshot. The same
 * `agentRng` always yields the same determinization. The runner owns converting
 * the returned state to whatever closure form a policy wants.
 *
 * The act reshuffle is a baked decision: each queued act is shuffled the same
 * way `drawWorld` shuffles it when the run advances into it, so the agent learns
 * an act's contents no earlier than a human would and never their order.
 */
export function determinize(
  state: GameState,
  agentRng: RngState,
): [determinized: GameState, nextRng: RngState] {
  // hiddenZones is the single source of truth for "what the player cannot see".
  // Reshuffle each hidden collection in turn, threading the advanced rng state
  // exactly the way `shuffle` itself does (every call returns the next state).
  let rng = agentRng;
  const shuffledZones: Card[][] = [];
  for (const zone of hiddenZones(state)) {
    const [shuffled, next] = shuffle(zone, rng);
    rng = next;
    shuffledZones.push(shuffled);
  }

  // hiddenZones returns the zones in a fixed order: [playerDraw, worldDraw,
  // ...acts] (see core/model/observability.ts). Split positionally to rebuild
  // the structured fields. playerDraw and worldDraw are always present, so the
  // `!` holds. The WorldCard casts are safe because reshuffling only reorders
  // the same instances — the world-only piles still hold WorldCards — and they
  // mirror the `as WorldCard[]` cast drawWorld uses when it advances an act.
  const playerDraw = shuffledZones[0]!;
  const worldDraw = shuffledZones[1]! as WorldCard[];
  const acts = shuffledZones.slice(2) as WorldCard[][];

  // Reseed state.rng from the agent rng so the determinized run never replays
  // the real rng stream (which would leak future roll outcomes). Pull one value
  // and expand it with createRng, matching how core seeds a fresh RngState from
  // a numeric seed. 0x100000000 (2^32) inverts the scale nextFloat divides by.
  const [seedValue, rngAfterSeed] = nextFloat(rng);
  rng = rngAfterSeed;
  const reseeded = createRng(Math.floor(seedValue * 0x100000000));

  const determinized: GameState = {
    ...state,
    playerDraw,
    worldDraw,
    acts,
    rng: reseeded,
  };

  return [determinized, rng];
}
