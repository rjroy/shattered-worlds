/**
 * Ring/connector feedback math for the table renderer.
 *
 * This is the headless, pure side of the live-play feedback: how full the
 * progress ring should be, and which visual connector a card-to-target line
 * should use. It imports core *types* only (no Phaser, no DOM, no core runtime
 * values), so it stays on the pure side of the renderer boundary and is
 * unit-tested headless — the same boundary `describe.ts` keeps.
 *
 * `describe.ts` owns the English strings; this module owns the numbers and the
 * style enum. They format the *same* (card, target, progress) data, so the
 * agreement test in `feedback.test.ts` pins `ringFraction` reaching 1.0 to
 * `previewPlay` reporting a clear.
 */
import type { CardEffect } from '../../core/index'

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
 * The CardEffect that runs at `step`, looking through a Sequence (steps line up
 * 1:1 with the compound targeting steps) or a Modal (step is the chosen branch
 * index). For a single effect, `step` is ignored and the effect is returned.
 * Returns null when the step/branch index is out of range.
 */
export function effectAtStep(effect: CardEffect, step: number): CardEffect | null {
  if (effect.kind === 'Sequence') return effect.steps[step] ?? null
  if (effect.kind === 'Modal') return effect.branches[step] ?? null
  return effect
}

/** The visual connector style a card's play draws toward its target. */
export type ConnectorStyle = 'progress' | 'destroy' | 'return'

/**
 * Pick the connector style for an effect, looking through `Modal`/`Sequence`
 * wrappers. A reachable `DealProgress` maps to 'progress', `DestroyCardInHand`
 * to 'destroy', and `ReturnWorldCards` to 'return'. Anything else (or an effect
 * that wraps none of these) yields null.
 *
 * Unlike `dealProgressOf` in `describe.ts`, this resolver has no chosen-branch
 * context — it answers "which connector could this card draw, pre-selection" —
 * so for a `Modal` it scans all branches and returns the first matching style
 * rather than resolving only the chosen `branchIndex`.
 */
export function selectConnectorStyle(effect: CardEffect): ConnectorStyle | null {
  switch (effect.kind) {
    case 'DealProgress':
      return 'progress'
    case 'DestroyCardInHand':
      return 'destroy'
    case 'ReturnWorldCards':
      return 'return'
    case 'Modal': {
      for (const branch of effect.branches) {
        const style = selectConnectorStyle(branch)
        if (style !== null) return style
      }
      return null
    }
    case 'Sequence': {
      for (const step of effect.steps) {
        const style = selectConnectorStyle(step)
        if (style !== null) return style
      }
      return null
    }
    // Effects that draw no targeting connector.
    case 'DealProgressScaled':
    case 'Draw':
    case 'Heal':
    case 'GainEnergy':
    case 'DiscardThenDraw':
    case 'AddCard':
    case 'AddWorldCardToDeck':
    case 'AddThreatToWorldDeck':
    case 'Damage':
    case 'DamageScaled':
    case 'GainCard':
    case 'AddPlayerCardToTop':
    case 'SurviveWorld':
    case 'ForceDestroy':
    case 'DestroySelf':
    case 'None':
    case 'Brace':
    case 'DealProgressAll':
    case 'ExileTopWorldCards':
      return null
  }
}
