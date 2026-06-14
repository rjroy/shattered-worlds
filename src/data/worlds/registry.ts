import { ZOMBIE_BIG_BOX_BUNDLE } from './zombie-big-box/index'
import { BIRD_BUILDING_BUNDLE } from './bird-building/index'
import { HIGHWAY_VOLCANO_BUNDLE } from './highway-volcano/index'
import { OVERGROWN_MALL_BUNDLE } from './overgrown-mall/index'
import { FOG_BEACH_PARTY_BUNDLE } from './fog-beach-party/index'
import type { WorldDataBundle } from './types'

export const worldDataRegistry: readonly WorldDataBundle[] = [
  ZOMBIE_BIG_BOX_BUNDLE,
  BIRD_BUILDING_BUNDLE,
  HIGHWAY_VOLCANO_BUNDLE,
  OVERGROWN_MALL_BUNDLE,
  FOG_BEACH_PARTY_BUNDLE,
]
