import type { WorldDataBundle } from '../types'
import cardsJson from './cards.json'
import type { RawCardSource } from '../../../core/model/catalog'
import { ZOMBIE_BIG_BOX_THEME } from './theme'
import { ZOMBIE_BIG_BOX_DISPLAY, ZOMBIE_BIG_BOX_HELP } from './meta'

export const ZOMBIE_BIG_BOX_BUNDLE: WorldDataBundle = {
  id: 'zombie-big-box',
  source: cardsJson as unknown as RawCardSource,
  theme: ZOMBIE_BIG_BOX_THEME,
  display: ZOMBIE_BIG_BOX_DISPLAY,
  help: ZOMBIE_BIG_BOX_HELP,
  musicKey: 'music-zombie-big-box',
}
