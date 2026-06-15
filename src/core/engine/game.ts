import type { Action, AvailableActions, GameEvent, GameState } from "../model/types";
import type { CardCatalog, WorldData } from "../model/catalog";
import { createWorld } from "./world";
import { availableActions } from "./available";
import { reduce } from "./reduce";
import { intensity } from "./intensity";

export interface GameCore {
  readonly state: GameState;
  readonly openingEvents: readonly GameEvent[];
  dispatch(action: Action): { state: GameState; events: GameEvent[] };
  availableActions(): AvailableActions;
  intensity(): number;
}

/**
 * Create a new game instance seeded with `seed`. The catalog and world
 * descriptor are captured in the closure and threaded through all dispatches.
 */
export function createGame(catalog: CardCatalog, world: WorldData, seed: number): GameCore {
  const { state: initialState, openingEvents } = createWorld(catalog, world, seed);
  let current = initialState;

  return {
    get state() {
      return current;
    },
    openingEvents,
    dispatch(action: Action) {
      const result = reduce(catalog, current, action);
      current = result.state;
      return result;
    },
    availableActions() {
      return availableActions(current);
    },
    intensity() {
      return intensity(current);
    },
  };
}
