import type { GameState } from "../model/types";
import { WORLD_CONSTS } from "./world";

/**
 * Tunable read-model: returns a value in [0.0, 1.0] expressing how intense
 * the current game state feels. Weights (0.6 act / 0.3 hp / 0.1 held-hazards)
 * are starting points — adjust them as playtesting reveals what drives tension.
 */
export function intensity(state: GameState): number {
  const actFraction = Math.max(0, Math.min(1, (state.actIndex + 1) / state.totalActs));
  const actPeak = Math.sqrt(actFraction);
  const actMin = actFraction * actFraction;

  // Clamp so heal-above-max (hp > 10) or death (hp = 0) stay in range.
  const rawHpFraction = 1 - state.hp / WORLD_CONSTS.startHp;
  const hpFraction = Math.max(0, Math.min(1, rawHpFraction));

  const worldsInHand = state.hand.filter((c) => c.kind === "world").length;
  const heldHazardFraction = Math.min(1, worldsInHand / WORLD_CONSTS.baseHandSize);

  const drawHazardFraction = Math.min(
    1,
    1 - state.worldDraw.length / WORLD_CONSTS.expectedDrawSize,
  );

  const totalFractions = drawHazardFraction + hpFraction + heldHazardFraction;
  const intensityScalar = Math.max(0, Math.min(1, totalFractions * 0.75));
  return actMin + (actPeak - actMin) * intensityScalar;
}
