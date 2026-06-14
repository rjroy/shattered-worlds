import type { WorldDataBundle } from '../types'
import cardsJson from './cards.json'
import type { RawCardSource } from '../../../core/model/catalog'
import { HIGHWAY_VOLCANO_THEME } from './theme'
import { HIGHWAY_VOLCANO_DISPLAY, HIGHWAY_VOLCANO_HELP } from './meta'

export const HIGHWAY_VOLCANO_BUNDLE: WorldDataBundle = {
  id: 'highway-volcano',
  source: cardsJson as unknown as RawCardSource,
  theme: HIGHWAY_VOLCANO_THEME,
  display: HIGHWAY_VOLCANO_DISPLAY,
  help: HIGHWAY_VOLCANO_HELP,
  musicKey: 'music-highway-volcano',
}
