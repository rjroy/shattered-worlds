import { VisualTheme } from './theme'
import { STARTER } from './starter'
import { ZOMBIE_BIG_BOX_THEME } from './zombie-big-box'

const themeManifest: Record<string, VisualTheme> = {
  'zombie-big-box': ZOMBIE_BIG_BOX_THEME,
}

export function selectTheme(worldId: string): VisualTheme {
  return themeManifest[worldId]  ?? STARTER
}


