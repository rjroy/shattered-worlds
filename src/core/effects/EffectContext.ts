/**
 * Shared types for the card-effect handler registry.
 *
 * `EffectContext` bundles everything a handler's `apply` needs: the catalog,
 * the current state, the pre-extracted targeting fields from the PlayCard
 * action, and a recursion callback bound to the dispatcher (so composite
 * handlers recurse without importing `registry.ts` and forming an import
 * cycle). `EffectResult` is the canonical `{ state, events }` shape every
 * effect-producing function returns; it lives here so `energy.ts`, the
 * handlers, and the legacy switch in `effects.ts` all share one definition.
 *
 * Pure core types only — no Phaser, no DOM. Lint enforces the boundary.
 */
import type { CardEffect, CardId, GameEvent, GameState } from "../model/types";
import type { CardCatalog } from "../model/catalog";
import type { EffectLine } from "../view/effectGlyphs";

// ---------------------------------------------------------------------------
// EffectResult — the canonical { state, events } shape
// ---------------------------------------------------------------------------

/**
 * The result of applying an effect (or any effect-producing step): the next
 * state plus the ordered events that describe the transition. Moved here from
 * `energy.ts` so it has a single definition shared across the engine, the
 * handlers, and `StartTurnResult`.
 */
export interface EffectResult {
  state: GameState;
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// EffectContext — what a handler's apply() receives
// ---------------------------------------------------------------------------

/**
 * The context threaded into a handler's `apply`. Replaces today's positional
 * `applyEffect(catalog, state, action?, selfId?)` arguments: the dispatcher
 * pre-extracts the PlayCard targeting fields once and hands them over here.
 *
 * The targeting fields are `undefined` for `onDiscarded` / `onCleared` /
 * `onEndOfTurn` world-hook firings that take no player input.
 */
export interface EffectContext {
  catalog: CardCatalog;
  state: GameState;
  /** Single hazard / discard target from the PlayCard action. */
  targetId?: CardId;
  /** World cards to return (ReturnWorldCards). */
  returnIds?: readonly CardId[];
  /** Player cards to destroy (DestroyCardInHand). */
  destroyIds?: readonly CardId[];
  /** Player card to discard (DiscardThenDraw). */
  discardId?: CardId;
  /** Chosen branch index (Modal). */
  choice?: number;
  /** The world card whose hook is firing, for DestroySelf. */
  selfId?: CardId;
  /**
   * Recursion seam for composite handlers (Modal / Sequence). Bound to the
   * dispatcher so handler modules never import `registry.ts`, which would form
   * a `composite.ts -> registry.ts -> composite.ts` cycle.
   */
  apply(ctx: EffectContext, effect: CardEffect): EffectResult;
}

// ---------------------------------------------------------------------------
// CompileContext — what a handler's compile() receives
// ---------------------------------------------------------------------------

/**
 * The context threaded into a handler's `compile`. Mirrors today's private
 * `compile(effect, { compactSequences }, worldId)` in `effectGlyphs.ts`:
 * `worldId` resolves world-specific tokens (e.g. AddThreatToWorldDeck) and
 * `compactSequences` tells a nested Sequence to join onto one line.
 */
export interface CompileContext {
  worldId: string;
  compactSequences: boolean;
  /**
   * Recursion seam for composite handlers (Modal / Sequence) — the compile-time
   * mirror of `EffectContext.apply`. Bound to the dispatcher so composite
   * handlers compile their child branches/steps without importing `registry.ts`
   * (which would form a `composite.ts -> registry.ts -> composite.ts` cycle).
   * A composite recurses with `ctx.compile(child, { ...ctx, compactSequences })`,
   * choosing the child's `compactSequences` per its own composition rules.
   */
  compile(effect: CardEffect, ctx: CompileContext): EffectLine[];
}

// ---------------------------------------------------------------------------
// ConnectorStyle — the visual connector a card's play draws toward its target
// ---------------------------------------------------------------------------

/**
 * The visual connector style a card's play draws toward its target. Defined in
 * core (Phaser-free) so the handler base can carry a `connectorStyle` method;
 * `src/game/interaction/feedback.ts` re-exports the type for renderer modules.
 */
export type ConnectorStyle = "progress" | "destroy" | "return";
