/**
 * Small shared selectors over the hand, used by both `available.ts` and the
 * targeting defaults in the effect handlers (e.g. `HazardTargetingHandler`).
 * Relocated here from `available.ts` so the handler base and the legacy
 * switches share one definition rather than duplicating the filter.
 *
 * Pure core — no Phaser, no DOM.
 */
import type { GameState, PlayerCard, WorldCard } from "../model/types";

export function worldCardsInHand(state: GameState): WorldCard[] {
  return state.hand.filter((c): c is WorldCard => c.kind === "world");
}

export function playerCardsInHand(state: GameState): PlayerCard[] {
  return state.hand.filter((c): c is PlayerCard => c.kind === "player");
}
