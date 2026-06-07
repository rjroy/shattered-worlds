/// <reference types="vite/client" />
import cardbackUrl from '../assets/cardback.webp'
import cardfrontUrl from '../assets/cardfront.webp'
import walkerUrl from '../assets/walker.webp'
import doorUrl from '../assets/door.webp'
import doorGlowUrl from '../assets/door-glow.webp'
import textBackUrl from '../assets/text-background.webp'
import bigboxRealityUrl from '../assets/themes/zombie-big-box/bigbox-reality.webp'
import zombieIntrusionUrl from '../assets/themes/zombie-big-box/intrusion-overlay.webp'
import zombieCardfrontUrl from '../assets/themes/zombie-big-box/zombie-cardfront.webp'
import starterJsonUrl from '../../data/worlds/starter.json?url'
import zombieJsonUrl from '../../data/worlds/zombie-big-box.json?url'
import insetSprintUrl from '../assets/insets/inset-sprint.webp'
import insetExploreUrl from '../assets/insets/inset-explore.webp'
import insetBarricadeUrl from '../assets/insets/inset-barricade.webp'
import insetMedKitUrl from '../assets/insets/inset-medkit.webp'
import insetPanicUrl from '../assets/insets/inset-panic.webp'
import insetAdrenalineUrl from '../assets/insets/inset-adrenaline.webp'
import insetDoorUrl from '../assets/insets/inset-door.webp'
import insetWalkerUrl from '../assets/insets/inset-walker.webp'
import zombieInsetBaseballUrl from '../assets/themes/zombie-big-box/insets/inset-baseball.webp'
import zombieInsetRegroupUrl from '../assets/themes/zombie-big-box/insets/inset-regroup.webp'
import zombieInsetRubbleUrl from '../assets/themes/zombie-big-box/insets/inset-rubble.webp'
import zombieInsetScreamsUrl from '../assets/themes/zombie-big-box/insets/inset-screams.webp'
import zombieInsetStrangeSoundsUrl from '../assets/themes/zombie-big-box/insets/inset-strange-sounds.webp'
import zombieInsetZombieUrl from '../assets/themes/zombie-big-box/insets/inset-zombie.webp'
import zombieInsetListenUrl from '../assets/themes/zombie-big-box/insets/inset-listen.webp'

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  walker: walkerUrl,
  door: doorUrl,
  'door-glow': doorGlowUrl,
  'text-back': textBackUrl,
  'bigbox-reality': bigboxRealityUrl,
  'zombie-intrusion': zombieIntrusionUrl,
  'zombie-cardfront': zombieCardfrontUrl,
  'world-starter': starterJsonUrl,
  'world-zombie-big-box': zombieJsonUrl,
  'inset-sprint': insetSprintUrl,
  'inset-explore': insetExploreUrl,
  'inset-barricade': insetBarricadeUrl,
  'inset-medkit': insetMedKitUrl,
  'inset-panic': insetPanicUrl,
  'inset-adrenaline': insetAdrenalineUrl,
  'inset-door': insetDoorUrl,
  'inset-walker': insetWalkerUrl,
  'zombie-inset-baseball': zombieInsetBaseballUrl,
  'zombie-inset-regroup': zombieInsetRegroupUrl,
  'zombie-inset-rubble': zombieInsetRubbleUrl,
  'zombie-inset-screams': zombieInsetScreamsUrl,
  'zombie-inset-listen': zombieInsetListenUrl,
  'zombie-inset-strange-sounds': zombieInsetStrangeSoundsUrl,
  'zombie-inset-zombie': zombieInsetZombieUrl,
}
