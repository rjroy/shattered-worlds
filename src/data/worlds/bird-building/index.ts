import type { WorldDataBundle } from '../types'
import cardsJson from './cards.json'
import { BIRD_BUILDING_THEME } from './theme'
import { BIRD_BUILDING_DISPLAY, BIRD_BUILDING_HELP } from './meta'

export const BIRD_BUILDING_BUNDLE: WorldDataBundle = {
  id: 'bird-building',
  deck: { cardsImport: cardsJson },
  theme: BIRD_BUILDING_THEME,
  display: BIRD_BUILDING_DISPLAY,
  help: BIRD_BUILDING_HELP,
  musicKey: 'music-bird-building',
}
