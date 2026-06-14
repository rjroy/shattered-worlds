import type { WorldDisplayData } from './worlds/types'
import { worldDataRegistry } from './worlds/registry'
import { derive } from './worlds/types'

export type { WorldDisplayData } from './worlds/types'

export const worldDisplayManifest: Record<string, WorldDisplayData> =
  derive(worldDataRegistry, (b) => b.display)
