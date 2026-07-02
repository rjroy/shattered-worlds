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
import type { PreviewEventSummary, PreviewFormatContext } from "../view/previewFormat";
import { mintCard } from "../model/cards";
import { shuffle } from "../engine/rng";
import { filterLegalPlayerCandidates, weightedDraw } from "../engine/weightedDraw";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { resolvePool } from "./pools";
import { icon, main, rider, text, value } from "./tokens";

type AddCardEffect = Extract<CardEffect, { kind: "AddCard" }>;
type GainCardEffect = Extract<CardEffect, { kind: "GainCard" }>;
type GainRandomCardEffect = Extract<CardEffect, { kind: "GainRandomCard" }>;
type AddPlayerCardToTopEffect = Extract<CardEffect, { kind: "AddPlayerCardToTop" }>;
type AddWorldCardToDeckEffect = Extract<CardEffect, { kind: "AddWorldCardToDeck" }>;
type AddThreatToWorldDeckEffect = Extract<CardEffect, { kind: "AddThreatToWorldDeck" }>;

const WORLD_THREAT_BY_WORLD_ID: Record<string, CardTemplateId> = {
  "zombie-big-box": "Zombie",
  "highway-volcano": "Lava Flow",
  "bird-building": "Gripping Talon",
  "overgrown-mall": "Something in the Atrium",
  "fog-beach-party": "Something in the Mist",
  "whiteout-parking-garage": "The Garage Freezes Shut",
  "the-tidal-archive": "The Same Footprint",
  "the-ember-orchard": "Ground Constellation",
  "city-of-sleeping-giants": "The Giant Turns In Sleep",
  "eden-prime": "Paradise Runs",
  "new-derelict": "The Order Arrives",
  "transit-authority": "Entity Detected",
};

export function worldThreatByWorldId(worldId: string): string {
  return WORLD_THREAT_BY_WORLD_ID[worldId] ?? "<Unknown>";
}

export function worldThreatTemplateByWorldId(worldId: string): CardTemplateId | undefined {
  return WORLD_THREAT_BY_WORLD_ID[worldId];
}

/**
 * Shared base for the six card-gaining kinds (`AddCard`, `GainCard`,
 * `GainRandomCard`, `AddPlayerCardToTop`, `AddWorldCardToDeck`,
 * `AddThreatToWorldDeck`). All emit `CardGained` through the `gainCard()` helper
 * with identical preview copy, so the `previewEvent` override lives here once and
 * every `sourceKind` resolves to it via the EFFECTS registry. Stays abstract:
 * `apply` / `describe` / `compile` differ per kind.
 */
abstract class GainCardLikeHandler<E extends CardEffect> extends EffectHandler<E> {
  override previewEvent(event: GameEvent, ctx: PreviewFormatContext): PreviewEventSummary {
    if (event.type !== "CardGained") return null;

    // The setName random-mask branch reads an event field stamped by
    // GainRandomCard, not preview policy, so it stays inside the shared copy.
    if (event.randomized === true) {
      return event.setName !== undefined
        ? [`Gain a random card from ${event.setName}`]
        : ["Gain a random card"];
    }

    return [`Gain ${event.templateId} to ${ctx.destLabel(event.dest)}`];
  }
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

  const events: GameEvent[] = [
    { type: "CardGained", id: card.id, templateId: card.templateId, dest, rarity: card.rarity },
  ];
  return { state: current, events };
}

export class AddCardHandler extends GainCardLikeHandler<AddCardEffect> {
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

export class GainCardHandler extends GainCardLikeHandler<GainCardEffect> {
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
    return true;
  }
}

// The rolled sibling of GainCard (REQ-RARITY-27: the two coexist
// permanently). Resolves the pool, rolls exactly one template via the
// weighted-draw kernel, mints/grants it through the same gainCard() helper
// every fixed-reward handler uses, then stamps setName onto the single
// CardGained event gainCard() returns so the action-preview layer (D3) can
// mask the rolled template's identity before the player commits.
export class GainRandomCardHandler extends GainCardLikeHandler<GainRandomCardEffect> {
  override apply(ctx: EffectContext, effect: GainRandomCardEffect): EffectResult {
    const poolTemplateIds = resolvePool(effect.setId);
    const legalIds = filterLegalPlayerCandidates(ctx.catalog, poolTemplateIds ?? []);

    const { templateIds: drawn, rng: nextRng } = weightedDraw(
      ctx.catalog,
      ctx.state.rng,
      legalIds,
      1,
      ctx.state.runModifiers.rarityBonus,
    );

    const drawnId = drawn[0];
    if (drawnId === undefined) {
      // Fail closed (REQ-RARITY-29): missing pool or no legal candidate.
      // weightedDraw already advanced the RNG by its empty-pool guard.
      return { state: { ...ctx.state, rng: nextRng }, events: [] };
    }

    // bToDiscard is reserved for future destination flexibility (REQ-RARITY-26);
    // no alternate destination is specified yet, so this always grants to
    // playerDiscard, matching GainCard's default.
    const result = gainCard(ctx.catalog, { ...ctx.state, rng: nextRng }, drawnId, "playerDiscard");
    return {
      state: result.state,
      events: result.events.map((event) =>
        event.type === "CardGained"
          ? { ...event, setName: effect.setName, randomized: true }
          : event,
      ),
    };
  }

  override describe(effect: GainRandomCardEffect): string[] {
    return [`gain a random card from ${effect.setName}`];
  }

  override compile(effect: GainRandomCardEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon("randomCard"), value("random", "reward")]), rider([text(effect.setName)])];
  }

  override isPlayable(): boolean {
    return true;
  }
}

export class AddPlayerCardToTopHandler extends GainCardLikeHandler<AddPlayerCardToTopEffect> {
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
    return true;
  }
}

export class AddWorldCardToDeckHandler extends GainCardLikeHandler<AddWorldCardToDeckEffect> {
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

export class AddThreatToWorldDeckHandler extends GainCardLikeHandler<AddThreatToWorldDeckEffect> {
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
