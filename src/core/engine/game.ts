import type {
  Action,
  AvailableActions,
  CardTemplateId,
  GameEvent,
  GameState,
} from "../model/types";
import type { CardCatalog, WorldData } from "../model/catalog";
import type { CardTemplate } from "../model/cards";
import type { RunModifiers } from "../../data/unlocks/types";
import { createWorld } from "./world";
import { availableActions } from "./available";
import { reduce } from "./reduce";
import { intensity } from "./intensity";
import { previewAction } from "../view/actionPreview";
import type { ActionPreview } from "../view/actionPreview";
import { logEvent } from "./logEvent";

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
