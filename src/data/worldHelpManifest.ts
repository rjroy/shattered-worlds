import type { WorldHelpData } from './worlds/types'
import { worldDataRegistry } from './worlds/registry'
import { derive } from './worlds/types'

export type { WorldHelpData, WorldMechanicNote } from './worlds/types'

export const worldHelpManifest: Record<string, WorldHelpData> =
  derive(worldDataRegistry, (b) => b.help)
