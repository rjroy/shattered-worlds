import type {
  Action,
  CardEffect,
  CardId,
  GameState,
} from "../model/types";
import type { CardCatalog } from "../model/catalog";
import type { EffectContext, EffectResult } from "../effects/EffectContext";
import { damage } from "../effects/damage";
import { dealProgress, resolveCounter } from "../effects/dealProgress";
import { gainCard, worldThreatByWorldId } from "../effects/gainCard";
import { EFFECTS } from "../effects/registry";
import { gainEnergy, heal } from "../effects/resources";
import { destroyInHand, returnToActiveWorldDeck } from "../effects/worldCards";

// ---------------------------------------------------------------------------
// dealProgress / resolveCounter facade
// ---------------------------------------------------------------------------

// `dealProgress` and `resolveCounter` now live in `../effects/dealProgress`
// (beside the DealProgress handler family). They are re-exported here so the
// existing `effects.test.ts` imports keep resolving unedited.
// dealProgress imports `applyEffect` from this module; that import is used only
// at call time inside its body, so no top-level evaluation cycle forms.
export { dealProgress, resolveCounter };

// ---------------------------------------------------------------------------
// gainCard
// ---------------------------------------------------------------------------

export { gainCard, worldThreatByWorldId };

// ---------------------------------------------------------------------------
// returnToActiveWorldDeck
// ---------------------------------------------------------------------------

export { destroyInHand, returnToActiveWorldDeck };

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

export { damage };

// ---------------------------------------------------------------------------
// heal
// ---------------------------------------------------------------------------

export { gainEnergy, heal };

// ---------------------------------------------------------------------------
// applyEffect
// ---------------------------------------------------------------------------

/**
 * Apply any CardEffect. Pass `action` for player-card effects that require
 * targeting information (DealProgress, ReturnWorldCards, etc.); omit it for
 * onDiscarded and onCleared effects that run without player input.
 *
 * `selfId` is the id of the world card whose hook is firing, for
 * self-referential effects like DestroySelf; undefined for player-played
 * effects.
 */
export function applyEffect(
  catalog: CardCatalog,
  state: GameState,
  effect: CardEffect,
  action?: Action,
  selfId?: CardId,
): EffectResult {
  // Narrow to PlayCard once and pre-extract its optional targeting fields so
  // every handler reads from the same context shape.
  const play = action?.type === "PlayCard" ? action : undefined;

  // Build the context once. The targeting fields are spread conditionally so an
  // absent field stays *absent* rather than explicitly `undefined`, which
  // `exactOptionalPropertyTypes` rejects on the optional `EffectContext` props.
  const ctx: EffectContext = {
    catalog,
    state,
    ...(play?.targetId !== undefined && { targetId: play.targetId }),
    ...(play?.returnIds !== undefined && { returnIds: play.returnIds }),
    ...(play?.destroyIds !== undefined && { destroyIds: play.destroyIds }),
    ...(play?.discardId !== undefined && { discardId: play.discardId }),
    ...(play?.choice !== undefined && { choice: play.choice }),
    ...(selfId !== undefined && { selfId }),
    // `apply` is the INTERNAL context-form dispatcher below, not this public
    // wrapper: composite handlers recurse via `ctx.apply(ctx, child)`.
    apply: dispatch,
  };

  return dispatch(ctx, effect);
}

/**
 * Context-form dispatcher. `ctx.apply` is bound to this function, so composite
 * handlers recurse here.
 *
 * `as never` is the standard discriminated-union-through-keyed-map tax: TS
 * can't prove `EFFECTS[effect.kind]` binds the same `E` the narrowed `effect`
 * carries. It is confined to this one dispatch line; the handler re-narrows.
 */
function dispatch(ctx: EffectContext, effect: CardEffect): EffectResult {
  const h = EFFECTS[effect.kind];
  return h.apply(ctx, effect as never);
}
