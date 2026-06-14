import type { WorldDataBundle } from '../types'
import cardsJson from './cards.json'
import type { RawCardSource } from '../../../core/model/catalog'
import { OVERGROWN_MALL_THEME } from './theme'
import { OVERGROWN_MALL_DISPLAY, OVERGROWN_MALL_HELP } from './meta'

export const OVERGROWN_MALL_BUNDLE: WorldDataBundle = {
  id: 'overgrown-mall',
  source: cardsJson as unknown as RawCardSource,
  theme: OVERGROWN_MALL_THEME,
  display: OVERGROWN_MALL_DISPLAY,
  help: OVERGROWN_MALL_HELP,
  musicKey: 'music-overgrown-mall',
}
