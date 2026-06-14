import { worldDataRegistry } from './worlds/registry'
import { derive } from './worlds/types'

/**
 * `Record<worldId, boolean>`: whether each world runs on the Light economy.
 *
 * The HUD has `GameState` (hence `worldId`) but no world metadata, so this
 * derived manifest is how it reaches the `usesLight` flag. A world omitting the
 * flag is `false` — every non-light world is unaffected. Decision 3 in the Fog
 * plan: the Light indicator is visible whenever this is true (even at Light 0),
 * absent otherwise.
 */
export const worldUsesLightManifest: Record<string, boolean> =
  derive(worldDataRegistry, (b) => b.usesLight === true)
