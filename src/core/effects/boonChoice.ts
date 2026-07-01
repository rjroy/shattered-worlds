import { createBoonOffer } from "../engine/actBoon";
import type { CardEffect, GameEvent, GameState } from "../model/types";
import type { EffectLine } from "../view/effectGlyphs";
import type { PreviewEventSummary, PreviewFormatContext } from "../view/previewFormat";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { resolvePool } from "./pools";
import { icon, main, rider, text, value } from "./tokens";

type OfferBoonEffect = Extract<CardEffect, { kind: "OfferBoon" }>;

/**
 * Shared preview copy for `BoonOffered`. Single source for both call sites:
 * `OfferBoonHandler.previewEvent` (the `OfferBoon` dispatch-stamped worldClear
 * instance) and the `summarizeEvent` switch arm (the unstamped act-cascade
 * instance from `reduce.ts`, which does not pass through dispatch).
 */
export function boonOfferedLine(
  event: Extract<GameEvent, { type: "BoonOffered" }>,
  _context: PreviewFormatContext,
): readonly string[] {
  return [`Boon offered from ${event.setName}`];
}

export class OfferBoonHandler extends EffectHandler<OfferBoonEffect> {
  override apply(ctx: EffectContext, effect: OfferBoonEffect): EffectResult {
    const poolTemplateIds = resolvePool(effect.setId);
    if (poolTemplateIds === undefined) {
      return { state: ctx.state, events: [] };
    }

    const result = createBoonOffer(ctx.catalog, ctx.state, {
      source: "worldClear",
      setId: effect.setId,
      setName: effect.setName,
      poolTemplateIds,
      offeredCount: effect.offeredCount,
      chooseCount: effect.chooseCount,
      bToDiscard: effect.bToDiscard ?? false,
    });

    return {
      state: result.state,
      events: result.event === null ? [] : [result.event],
    };
  }

  override previewEvent(event: GameEvent, ctx: PreviewFormatContext): PreviewEventSummary {
    if (event.type !== "BoonOffered") return null;
    return boonOfferedLine(event, ctx);
  }

  override describe(effect: OfferBoonEffect): string[] {
    const dest = effect.bToDiscard === true ? "discard pile" : "hand";
    return [`Offer ${effect.offeredCount} boons; choose ${effect.chooseCount} to ${dest}`];
  }

  override compile(effect: OfferBoonEffect, _ctx: CompileContext): EffectLine[] {
    const dest = effect.bToDiscard === true ? "discard" : "hand";
    return [
      main([icon("addCard"), value(`${effect.chooseCount} of ${effect.offeredCount}`, "reward")]),
      rider([text("boon"), text("to"), text(dest)]),
    ];
  }

  override isPlayable(_effect: OfferBoonEffect, _state: GameState): boolean {
    return true;
  }
}
