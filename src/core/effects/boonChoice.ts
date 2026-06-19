import { createBoonOffer } from "../engine/actBoon";
import type { CardEffect, GameState } from "../model/types";
import type { EffectLine } from "../view/effectGlyphs";
import { BOON_SETS } from "../../data/worlds/boons/fortune";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, rider, text, value } from "./tokens";

type OfferBoonEffect = Extract<CardEffect, { kind: "OfferBoon" }>;

export class OfferBoonHandler extends EffectHandler<OfferBoonEffect> {
  override apply(ctx: EffectContext, effect: OfferBoonEffect): EffectResult {
    if (ctx.state.pendingBoonChoice !== null) {
      return { state: ctx.state, events: [] };
    }

    const boonSet = BOON_SETS[effect.setId as keyof typeof BOON_SETS];
    if (boonSet === undefined) {
      return { state: ctx.state, events: [] };
    }

    const result = createBoonOffer(ctx.catalog, ctx.state, {
      source: "worldClear",
      setId: effect.setId,
      poolTemplateIds: boonSet.templateIds,
      offeredCount: effect.offeredCount,
      chooseCount: effect.chooseCount,
      bToDiscard: effect.bToDiscard ?? false,
    });

    return {
      state: result.state,
      events: result.event === null ? [] : [result.event],
    };
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
    return false;
  }
}
