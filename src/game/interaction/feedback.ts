/**
 * Ring/connector feedback math for the table renderer.
 *
 * This is the headless, pure side of the live-play feedback: how full the
 * progress ring should be and how connector endpoints are formed. Connector
 * style selection now lives in core handlers, beside the effect behavior.
 *
 * `describe.ts` owns the English strings; this module owns the numbers and the
 * style enum. They format the *same* (card, target, progress) data, so the
 * agreement test in `feedback.test.ts` pins `ringFraction` reaching 1.0 to
 * `previewPlay` reporting a clear.
 */
import type { ConnectorStyle } from '../../core/effects/EffectContext'

/**
 * Fraction of a hazard's cost that `progress` covers, in [0, 1].
 *
 * Clamps both ends: negative progress floors at 0, progress at or above cost
 * caps at 1.0. A cost of 0 (or less) yields 0 to guard divide-by-zero rather
 * than producing Infinity/NaN.
 */
export function ringFraction(progress: number, cost: number): number {
  return cost > 0 ? Math.min(1, Math.max(0, Math.min(progress, cost) / cost)) : 0
}

/** A 2D point in scene coordinates. */
export interface Point {
  x: number
  y: number
}

/**
 * Endpoints of the connector line from an acting card to its hovered target.
 *
 * Pure pass-through of the two container centres: the renderer reads each
 * container's live position and asks for the line to draw. Keeping it here (not
 * inline in the scene) makes the geometry unit-testable without Phaser, and is
 * the seam S8 will extend when per-style decoration (curves, arrowheads) needs
 * the same source/target pair.
 */
export function connectorLine(source: Point, target: Point): { from: Point; to: Point } {
  return { from: { x: source.x, y: source.y }, to: { x: target.x, y: target.y } }
}

/**
 * The visual connector style a card's play draws toward its target. The type
 * lives in core (`src/core/effects/EffectContext`) so the effect-handler base
 * can carry a `connectorStyle` method; re-exported here for renderer modules.
 */
export type { ConnectorStyle }
