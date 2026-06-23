import type { WorldDataBundle } from '../types'
import cardsJson from './cards.json'
import { OVERGROWN_MALL_THEME } from './theme'
import { OVERGROWN_MALL_DISPLAY, OVERGROWN_MALL_HELP } from './meta'

export const OVERGROWN_MALL_BUNDLE: WorldDataBundle = {
  id: 'overgrown-mall',
  deck: { cardsImport: cardsJson },
  theme: OVERGROWN_MALL_THEME,
  display: OVERGROWN_MALL_DISPLAY,
  help: OVERGROWN_MALL_HELP,
  musicKey: 'music-overgrown-mall',
}
