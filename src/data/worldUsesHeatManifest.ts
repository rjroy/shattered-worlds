import { worldDataRegistry } from "./worlds/registry";
import { derive } from "./worlds/types";

/**
 * `Record<worldId, boolean>`: whether each world runs on the Heat economy.
 *
 * Heat can exist numerically from unlocks in any world, but the HUD only shows
 * it where the local world mechanics can spend it.
 */
export const worldUsesHeatManifest: Record<string, boolean> = derive(
  worldDataRegistry,
  (b) => b.usesHeat === true,
);
