import type {
  CardEffect,
  CardTemplateId,
  Dest,
  GameEvent,
  GameState,
  WorldCard,
} from "../model/types";
import type { CardCatalog } from "../model/catalog";
import type { EffectLine } from "../view/effectGlyphs";
import { mintCard } from "../model/cards";
import { shuffle } from "../engine/rng";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, rider, text, value } from "./tokens";

type AddCardEffect = Extract<CardEffect, { kind: "AddCard" }>;
type GainCardEffect = Extract<CardEffect, { kind: "GainCard" }>;
type AddPlayerCardToTopEffect = Extract<CardEffect, { kind: "AddPlayerCardToTop" }>;
type AddWorldCardToDeckEffect = Extract<CardEffect, { kind: "AddWorldCardToDeck" }>;
type AddThreatToWorldDeckEffect = Extract<CardEffect, { kind: "AddThreatToWorldDeck" }>;

const WORLD_THREAT_BY_WORLD_ID: Record<string, CardTemplateId> = {
  "zombie-big-box": "Zombie",
  "highway-volcano": "Lava Flow",
  "bird-building": "Gripping Talon",
  "overgrown-mall": "Something in the Atrium",
  "fog-beach-party": "Something in the Mist",
};

export function worldThreatByWorldId(worldId: string): string {
  return WORLD_THREAT_BY_WORLD_ID[worldId] ?? "<Unknown>";
}

export function worldThreatTemplateByWorldId(worldId: string): CardTemplateId | undefined {
  return WORLD_THREAT_BY_WORLD_ID[worldId];
}

export function gainCard(
  catalog: CardCatalog,
  state: GameState,
  template: CardTemplateId,
  dest: Dest,
): EffectResult {
  const [card, nextState] = mintCard(catalog, state, template);

  let current: GameState;
  switch (dest) {
    case "playerDiscard":
      current = {
        ...nextState,
        playerDiscard: [card, ...nextState.playerDiscard],
      };
      break;
    case "playerDrawTop":
      current = {
        ...nextState,
        playerDraw: [card, ...nextState.playerDraw],
      };
      break;
    case "worldDraw": {
      const shuffled = shuffle([card as WorldCard, ...nextState.worldDraw], nextState.rng);
      current = {
        ...nextState,
        worldDraw: shuffled[0],
        rng: shuffled[1],
      };
      break;
    }
    case "worldDrawTop":
      current = {
        ...nextState,
        worldDraw: [card as WorldCard, ...nextState.worldDraw],
      };
      break;
  }

  const events: GameEvent[] = [{ type: "CardGained", id: card.id, dest }];
  return { state: current, events };
}

export class AddCardHandler extends EffectHandler<AddCardEffect> {
  override apply(ctx: EffectContext, effect: AddCardEffect): EffectResult {
    return gainCard(ctx.catalog, ctx.state, effect.template, effect.dest);
  }

  override describe(effect: AddCardEffect): string[] {
    return [`Gain a ${effect.template} card`];
  }

  override compile(effect: AddCardEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon("addCard"), value(effect.template, "reward")])];
  }
}

export class GainCardHandler extends EffectHandler<GainCardEffect> {
  override apply(ctx: EffectContext, effect: GainCardEffect): EffectResult {
    return gainCard(ctx.catalog, ctx.state, effect.template, "playerDiscard");
  }

  override describe(effect: GainCardEffect): string[] {
    return [`gain ${effect.template}`];
  }

  override compile(effect: GainCardEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon("addCard"), value(effect.template, "reward")])];
  }

  override isPlayable(): boolean {
    return false;
  }
}

export class AddPlayerCardToTopHandler extends EffectHandler<AddPlayerCardToTopEffect> {
  override apply(ctx: EffectContext, effect: AddPlayerCardToTopEffect): EffectResult {
    return gainCard(ctx.catalog, ctx.state, effect.template, "playerDrawTop");
  }

  override describe(effect: AddPlayerCardToTopEffect): string[] {
    return [`+${effect.template} to your deck`];
  }

  override compile(effect: AddPlayerCardToTopEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([icon("addCard"), value(effect.template, "reward")]),
      rider([text("top of deck")]),
    ];
  }

  override isPlayable(): boolean {
    return false;
  }
}

export class AddWorldCardToDeckHandler extends EffectHandler<AddWorldCardToDeckEffect> {
  override apply(ctx: EffectContext, effect: AddWorldCardToDeckEffect): EffectResult {
    return gainCard(
      ctx.catalog,
      ctx.state,
      effect.template,
      effect.bTop ? "worldDrawTop" : "worldDraw",
    );
  }

  override describe(effect: AddWorldCardToDeckEffect): string[] {
    return [`+${effect.template} to world deck`];
  }

  override compile(effect: AddWorldCardToDeckEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon("addCard"), value(effect.template, "penalty")])];
  }
}

export class AddThreatToWorldDeckHandler extends EffectHandler<AddThreatToWorldDeckEffect> {
  override apply(ctx: EffectContext, _effect: AddThreatToWorldDeckEffect): EffectResult {
    const template = worldThreatTemplateByWorldId(ctx.state.worldId);
    return template !== undefined
      ? gainCard(ctx.catalog, ctx.state, template, "worldDrawTop")
      : { state: ctx.state, events: [] };
  }

  override describe(_effect: AddThreatToWorldDeckEffect): string[] {
    return ["+theme threat to world deck"];
  }

  override compile(_effect: AddThreatToWorldDeckEffect, ctx: CompileContext): EffectLine[] {
    return [main([icon("addCard"), value(worldThreatByWorldId(ctx.worldId), "penalty")])];
  }
}
