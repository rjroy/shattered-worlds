import type { VisualTheme } from './theme'
import { STARTER } from './starter'
import { worldDataRegistry } from '../../../data/worlds/registry'
import { derive } from '../../../data/worlds/types'

export const themeManifest: Record<string, VisualTheme> =
  derive(worldDataRegistry, (b) => b.theme)

export function selectTheme(worldId: string): VisualTheme {
  return themeManifest[worldId] ?? STARTER
}
