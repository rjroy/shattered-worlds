import type { Action, AvailableActions, CardTemplateId, GameEvent, GameState } from "../model/types";
import type { CardCatalog, WorldData } from "../model/catalog";
import type { CardTemplate } from "../model/cards";
import type { RunModifiers } from "../../data/unlocks/types";
import { createWorld } from "./world";
import { availableActions } from "./available";
import { reduce } from "./reduce";
import { intensity } from "./intensity";
import { previewAction } from "../view/actionPreview";
import type { ActionPreview } from "../view/actionPreview";

export interface GameCore {
  readonly state: GameState;
  readonly openingEvents: readonly GameEvent[];
  dispatch(action: Action): { state: GameState; events: GameEvent[] };
  /** Pure read: summarize an action against current state without mutating it. */
  preview(action: Action): ActionPreview;
  availableActions(): AvailableActions;
  intensity(): number;
  template(templateId: CardTemplateId): Readonly<CardTemplate> | undefined;
}

function logEvent(event: GameEvent): void {
  let baseString = `event: ${event.type}`;
  if (event.sourceKind || event.sourceCardId) baseString += ` source:`;
  if (event.sourceKind) baseString += ` ${event.sourceKind}`;
  if (event.sourceCardId) baseString += ` ${event.sourceCardId}`;

  switch (event.type) {
    case "CardPlayed":
      console.log(
        `${baseString} id: ${event.cardId} template: ${event.templateId} ordinal: ${event.templateOrdinalThisTurn}`,
      );
      break;
    case "HazardDiscarded":
      console.log(`${baseString} id: ${event.cardId} template: ${event.templateId}`);
      break;
    case "HazardResolved":
    case "HazardPartial":
      console.log(`${baseString} id: ${event.hazardId} template: ${event.templateId}`);
      break;
    case "ProgressDealt":
      console.log(
        `${baseString} id: ${event.hazardId} template: ${event.templateId} amount: ${event.amount} total: ${event.hazardTurnTotal}`,
      );
      break;
    case "DamageDealt":
    case "HealReceived":
      console.log(`${baseString} amount: ${event.amount}`);
      break;
    case "CardGained":
      console.log(
        `${baseString} id: ${event.id} template: ${event.templateId} dest: ${event.dest} rarity: ${event.rarity}${event.setName ? ` set: ${event.setName}` : ""}`,
      );
      break;
    case "PendingCardDestroy":
      console.log(`${baseString} count: ${event.count}`);
      break;
    case "CardDestroyed":
    case "WorldCardsReturned":
    case "CardsFrozen":
    case "CardsThawed":
    case "CardsBurnedForHeat":
    case "WorldCardsExiled":
      console.log(`${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")}`);
      break;
    case "CardsDiscarded":
      console.log(`${baseString} ids: ${event.cardIds.join(", ")} templates: ${event.templateIds.join(", ")}`);
      break;
    case "HpChanged":
      console.log(`${baseString} hp: ${event.hp}`);
      break;
    case "EnergyChanged":
      console.log(`${baseString} energy: ${event.energy}`);
      break;
    case "LightChanged":
      console.log(`${baseString} light: ${event.light}`);
      break;
    case "HeatChanged":
      console.log(`${baseString} heat: ${event.heat} delta: ${event.delta}`);
      break;
    case "DeckShuffled":
    case "TurnEnded":
    case "WorldWon":
      console.log(baseString);
      break;
    case "ActAdvanced":
      console.log(`${baseString} act: ${event.act}`);
      break;
    case "BoonOffered":
      console.log(
        `${baseString} source: ${event.source} set: ${event.setName} templates: ${event.templateIds.join(", ")} rarities: ${event.rarities.join(", ")}`,
      );
      break;
    case "BoonCardGranted":
      console.log(
        `${baseString} id: ${event.cardId} template: ${event.templateId} dest: ${event.dest} rarity: ${event.rarity}`,
      );
      break;
    case "CardsDrawn":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} hazard: ${event.bHazard}`,
      );
      break;
    case "WorldLost":
      console.log(`${baseString}${event.cause ? ` cause: ${event.cause}` : ""}`);
      break;
    case "BraceChanged":
      console.log(`${baseString} braceCharges: ${event.braceCharges}`);
      break;
    case "BraceConsumed":
    case "KeywordGuardConsumed":
      console.log(`${baseString} absorbed: ${event.absorbed} remaining: ${event.remaining}`);
      break;
    case "KeywordApplied":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} keyword: ${event.keyword} value: ${event.value}`,
      );
      break;
    case "KeywordRemoved":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} keyword: ${event.keyword}`,
      );
      break;
    case "keywordGuardChanged":
      console.log(`${baseString} keywordGuard: ${event.keywordGuard}`);
      break;
    case "HazardAdded":
      console.log(`${baseString} id: ${event.id} template: ${event.templateId}`);
      break;
    case "PlayerDiscardRecalled":
      console.log(
        `${baseString} ids: ${event.cardIds.join(", ")} templates: ${event.templateIds.join(", ")} source: ${event.source} dest: ${event.dest}`,
      );
      break;
    default: {
      const unhandled: never = event;
      throw new Error(`logEvent: unhandled event type ${(unhandled as GameEvent).type}`);
    }
  }
}

/**
 * Create a new game instance seeded with `seed`. The catalog and world
 * descriptor are captured in the closure and threaded through all dispatches.
 */
export function createGame(
  catalog: CardCatalog,
  world: WorldData,
  seed: number,
  runModifiers?: RunModifiers,
): GameCore {
  const { state: initialState, openingEvents } = createWorld(catalog, world, seed, runModifiers);
  let current = initialState;

  return {
    get state() {
      return current;
    },
    openingEvents,
    dispatch(action: Action) {
      const result = reduce(catalog, current, action);
      result.events.forEach(logEvent);
      current = result.state;
      return result;
    },
    preview(action: Action) {
      return previewAction(catalog, current, action);
    },
    availableActions() {
      return availableActions(current);
    },
    intensity() {
      return intensity(current);
    },
    template(templateId: CardTemplateId) {
      return catalog[templateId];
    },
  };
}
