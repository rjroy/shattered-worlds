/**
 * Observability model — the single written-down statement of what the player
 * can and cannot see. Two later mechanisms (action-preview masking and sim
 * determinization) both derive from this file, so the table below IS the
 * reference: change the rules here, not in each consumer.
 *
 * | State / event                          | Visible to player?         |
 * |----------------------------------------|----------------------------|
 * | `hand`                                 | yes                        |
 * | `playerDraw`, `worldDraw` (order)      | no — hidden order          |
 * | `playerDiscard`                        | yes                        |
 * | `acts` beyond current                  | no                         |
 * | Concealed card identity + effects      | no (already modeled)       |
 * | Outcome of an rng roll before commit   | no                         |
 *
 * Pure core — no Phaser, no engine imports, no DOM.
 */
import { isConcealed } from "./keywords";
import type { Card, GameState } from "./types";

/**
 * The card collections whose contents and order are hidden from the player:
 * the player draw pile, the world draw pile, and every act's deck (the queued
 * acts the run has not reached yet). `playerDiscard` and `hand` are visible and
 * deliberately excluded.
 *
 * Returns the zones as an array of the underlying card arrays so callers can
 * enumerate exactly the hidden collections (and the cards within them) without
 * knowing how `GameState` names each zone. `WorldCard` is a `Card`, so the
 * world-only piles widen cleanly into the shared element type.
 */
export function hiddenZones(state: GameState): readonly (readonly Card[])[] {
  return [state.playerDraw, state.worldDraw, ...state.acts];
}

/**
 * Whether a card is hidden from the player: either it lives in a hidden zone
 * (a draw pile or an unreached act) or it is concealed in hand. Concealment is
 * folded in via `isConcealed` rather than reimplemented, so visibility
 * stays defined in exactly one place.
 */
export function isHidden(card: Card, state: GameState): boolean {
  if (isConcealed(card, state.light)) return true;
  return hiddenZones(state).some((zone) => zone.some((c) => c.id === card.id));
}
