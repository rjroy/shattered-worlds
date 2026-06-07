import { VisualTheme } from './theme'
import { STARTER } from './starter'
import { ZOMBIE_BIG_BOX_THEME } from './zombie-big-box'
import { BIRD_BUILDING_THEME } from './bird-building'
import { HIGHWAY_VOLCANO_THEME } from './highway-volcano'

export const themeManifest: Record<string, VisualTheme> = {
  'zombie-big-box': ZOMBIE_BIG_BOX_THEME,
  'bird-building': BIRD_BUILDING_THEME,
  'highway-volcano': HIGHWAY_VOLCANO_THEME,
}

export function selectTheme(worldId: string): VisualTheme {
  return themeManifest[worldId]  ?? STARTER
}


