/**
 * The polymorphic base for card-effect behavior.
 *
 * Today every effect's behavior is scattered across seven `switch (effect.kind)`
 * statements, one per concern. This base inverts the axis: one handler class
 * per `kind` carries that kind's behavior for every concern. `apply`,
 * `describe`, and `compile` are abstract — every effect does something, says
 * something, and shows something. The targeting and connector concerns have
 * sensible defaults (most effects need no target), so a no-target effect
 * overrides only the three abstract methods and inherits the rest.
 *
 * Pure core — no Phaser, no DOM. Lint enforces the boundary.
 */
import { isConcealed } from '../model/keywords'
import type { CardEffect, CardId, GameState, TargetSpec } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import type { CompileContext, ConnectorStyle, EffectContext, EffectResult } from './EffectContext'
import { worldCardsInHand } from './handState'

/**
 * Behavior for one `CardEffect` kind. `E` is the narrowed effect type the
 * handler operates on (e.g. `Extract<CardEffect, { kind: "Heal" }>`); the
 * registry binds each kind to a handler over its own `E`.
 */
export abstract class EffectHandler<E extends CardEffect> {
  /** Apply the effect, returning the next state and the events it produced. */
  abstract apply(ctx: EffectContext, effect: E): EffectResult

  /** Full English prose lines (chooser labels, previews). */
  abstract describe(effect: E): string[]

  /** Compact icon/token lines for the card face. */
  abstract compile(effect: E, ctx: CompileContext): EffectLine[]

  /**
   * The structural target shape the UI needs to present the effect. Most
   * effects need no target.
   */
  structuralSpec(_effect: E): TargetSpec {
    return { kind: 'none' }
  }

  /**
   * Whether the effect has a legal play given the current hand. Most effects
   * are always playable; the no-target world-hook kinds that are never played
   * from hand override this to `false` in their own handlers.
   */
  isPlayable(_effect: E, _state: GameState, _selfId: CardId): boolean {
    return true
  }

  /** Concrete legal target ids. Most effects have no targets. */
  legalTargets(_effect: E, _selfId: CardId, _state: GameState): readonly CardId[] {
    return []
  }

  /** The visual connector the play draws toward its target, or none. */
  connectorStyle(_effect: E): ConnectorStyle | null {
    return null
  }
}

/**
 * Intermediate base for the hazard-targeting kinds (`DealProgress`,
 * `DealProgressScaled`). They all target a world card in hand and are playable
 * only when one exists, so `structuralSpec`, `isPlayable`, and `legalTargets`
 * live here once. Connector style and the `base === 0` keyword filter are
 * `DealProgress`-only specifics and stay on `DealProgressHandler`, not here.
 * Stays abstract: `apply` / `describe` / `compile` differ per kind.
 */
export abstract class HazardTargetingHandler<E extends CardEffect> extends EffectHandler<E> {
  override structuralSpec(_effect: E): TargetSpec {
    return { kind: 'hazard' }
  }

  override isPlayable(_effect: E, state: GameState, _selfId: CardId): boolean {
    // A single-target hazard play needs at least one UNCONCEALED world card.
    // Gating on legal targets (not merely "any world card in hand") means the
    // card goes unplayable when every world card is lost in the fog, rather
    // than presenting a dead-end click with zero legal targets. Outside Fog
    // nothing is concealed (light === 0, concealOf === 0), so this matches the
    // old "any world card in hand" behavior exactly.
    return this.legalTargets(_effect, _selfId, state).length > 0
  }

  override legalTargets(_effect: E, _selfId: CardId, state: GameState): readonly CardId[] {
    return worldCardsInHand(state)
      .filter((c) => !isConcealed(c, state.light))
      .map((c) => c.id)
  }
}
