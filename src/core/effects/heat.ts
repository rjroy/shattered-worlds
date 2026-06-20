import type {
  CardEffect,
  CardId,
  GameEvent,
  GameState,
  PlayerCard,
  TargetSpec,
} from "../model/types";
import type { EffectLine } from "../view/effectGlyphs";
import { shuffle } from "../engine/rng";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, text, value } from "./tokens";
import { playerCardsInHand } from "./handState";

type GainHeatEffect = Extract<CardEffect, { kind: "GainHeat" }>;
type FreezeCardsEffect = Extract<CardEffect, { kind: "FreezeCards" }>;
type ThawCardsEffect = Extract<CardEffect, { kind: "ThawCards" }>;

function isFrozen(card: PlayerCard): boolean {
  return (card.frozen ?? 0) > 0;
}

export function gainHeat(state: GameState, amount: number): EffectResult {
  if (amount === 0) return { state, events: [] };
  const heat = state.heat + amount;
  return { state: { ...state, heat }, events: [{ type: "HeatChanged", heat, delta: amount }] };
}

function setPlayerFrozen(card: PlayerCard, duration: number): PlayerCard {
  const frozen = Math.max(card.frozen ?? 0, duration);
  return { ...card, frozen };
}

export function thawFrozenCardsAtTurnStart(state: GameState): EffectResult {
  const thawed: PlayerCard[] = [];
  const hand = state.hand.map((card) => {
    if (card.kind !== "player" || (card.frozen ?? 0) <= 0) return card;
    const nextFrozen = (card.frozen ?? 0) - 1;
    if (nextFrozen > 0) {
      const partialThawedCard = { ...card, frozen: nextFrozen };
      thawed.push(partialThawedCard);
      return partialThawedCard;
    } else {
      const { frozen: _frozen, ...thawedCard } = card;
      thawed.push(thawedCard);
      return thawedCard;
    }
  });

  if (thawed.length === 0) return { state, events: [] };

  return {
    state: { ...state, hand },
    events: [
      {
        type: "CardsThawed",
        ids: thawed.map((card) => card.id),
        templateIds: thawed.map((card) => card.templateId),
      },
    ],
  };
}

export class GainHeatHandler extends EffectHandler<GainHeatEffect> {
  override apply(ctx: EffectContext, effect: GainHeatEffect): EffectResult {
    return gainHeat(ctx.state, effect.amount);
  }

  override describe(effect: GainHeatEffect): string[] {
    return [`Gain ${effect.amount} Heat`];
  }

  override compile(effect: GainHeatEffect, _ctx: CompileContext): EffectLine[] {
    return [main([value(`+${effect.amount}`, "reward"), icon("heat")])];
  }
}

export class FreezeCardsHandler extends EffectHandler<FreezeCardsEffect> {
  override apply(ctx: EffectContext, effect: FreezeCardsEffect): EffectResult {
    const candidates = playerCardsInHand(ctx.state).filter(
      (card) => !isFrozen(card) && card.id !== ctx.sourceId,
    );
    const fallback = playerCardsInHand(ctx.state).filter((card) => !isFrozen(card));
    const pool = candidates.length > 0 ? candidates : fallback;
    if (pool.length === 0) return { state: ctx.state, events: [] };

    const [shuffled, rng] = shuffle(pool, ctx.state.rng);
    const selected = shuffled.slice(0, Math.min(effect.amount, shuffled.length));
    const selectedIds = new Set<CardId>(selected.map((card) => card.id));
    const hand = ctx.state.hand.map((card) =>
      card.kind === "player" && selectedIds.has(card.id)
        ? setPlayerFrozen(card, effect.duration)
        : card,
    );

    return {
      state: { ...ctx.state, rng, hand },
      events: [
        {
          type: "CardsFrozen",
          ids: selected.map((card) => card.id),
          templateIds: selected.map((card) => card.templateId),
        },
      ],
    };
  }

  override describe(effect: FreezeCardsEffect): string[] {
    const noun = effect.amount === 1 ? "card" : "cards";
    return [
      `Freeze ${effect.amount} ${noun} for ${effect.duration} turn${effect.duration === 1 ? "" : "s"}`,
    ];
  }

  override compile(effect: FreezeCardsEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([icon("freeze"), value(`${effect.amount}`, "penalty"), text(`for ${effect.duration}`)]),
    ];
  }
}

export class ThawCardsHandler extends EffectHandler<ThawCardsEffect> {
  override apply(ctx: EffectContext, effect: ThawCardsEffect): EffectResult {
    const legal = new Set(this.legalTargets(effect, ctx.sourceId ?? "", ctx.state));
    const requested = (ctx.thawIds ?? []).filter((id) => legal.has(id)).slice(0, effect.amount);
    if (requested.length === 0) return { state: ctx.state, events: [] };

    const totalCost = requested.length * effect.heatCost;
    if (ctx.state.heat < totalCost) return { state: ctx.state, events: [] };

    const thawed: PlayerCard[] = [];
    const selected = new Set<CardId>(requested);
    const hand = ctx.state.hand.map((card) => {
      if (card.kind !== "player" || !selected.has(card.id)) return card;
      const { frozen: _frozen, ...next } = card;
      thawed.push(next);
      return next;
    });

    const heat = ctx.state.heat - totalCost;
    const events: GameEvent[] = [
      { type: "HeatChanged", heat, delta: -totalCost },
      {
        type: "CardsThawed",
        ids: thawed.map((card) => card.id),
        templateIds: thawed.map((card) => card.templateId),
      },
    ];
    return { state: { ...ctx.state, hand, heat }, events };
  }

  override describe(effect: ThawCardsEffect): string[] {
    return [
      `Thaw ${effect.amount} card${effect.amount === 1 ? "" : "s"} for ${effect.heatCost} Heat each`,
    ];
  }

  override compile(effect: ThawCardsEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([
        icon("thaw"),
        value(`${effect.amount}`, "reward"),
        text("for"),
        value(`${effect.heatCost}`),
        icon("heat"),
      ]),
    ];
  }

  override structuralSpec(effect: ThawCardsEffect): TargetSpec {
    return { kind: "thawHand", amount: effect.amount, heatCost: effect.heatCost };
  }

  override isPlayable(effect: ThawCardsEffect, state: GameState, selfId: CardId): boolean {
    return state.heat >= effect.heatCost && this.legalTargets(effect, selfId, state).length > 0;
  }

  override legalTargets(
    _effect: ThawCardsEffect,
    selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    return playerCardsInHand(state)
      .filter((card) => card.id !== selfId && isFrozen(card))
      .map((card) => card.id);
  }
}
