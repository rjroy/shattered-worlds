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
import birdRealityUrl from '../assets/themes/bird-building/bird-building-bg.webp'
import birdOverlayUrl from '../assets/themes/bird-building/bird-building-overlay.webp'
import birdCardfrontUrl from '../assets/themes/bird-building/bird-building-cardfront.webp'
import volcanoRealityUrl from '../assets/themes/highway-volcano/highway-volcano-bg.webp'
import volcanoOverlayUrl from '../assets/themes/highway-volcano/highway-volcano-overlay.webp'
import volcanoCardfrontUrl from '../assets/themes/highway-volcano/highway-volcano-cardfront.webp'
import volcanoInsetAshFallUrl from '../assets/themes/highway-volcano/insets/inset-ash-fall.webp'
import volcanoInsetDitchGearUrl from '../assets/themes/highway-volcano/insets/inset-ditch-gear.webp'
import volcanoInsetFloorItUrl from '../assets/themes/highway-volcano/insets/inset-floor-it.webp'
import volcanoInsetGridlockUrl from '../assets/themes/highway-volcano/insets/inset-gridlock.webp'
import volcanoInsetLavaFlowUrl from '../assets/themes/highway-volcano/insets/inset-lava-flow.webp'
import volcanoInsetSpotPathUrl from '../assets/themes/highway-volcano/insets/inset-spot-path.webp'
import volcanoInsetTremorsUrl from '../assets/themes/highway-volcano/insets/inset-tremors.webp'
import volcanoInsetVehicleUrl from '../assets/themes/highway-volcano/insets/inset-vehicle.webp'
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
import starterJsonUrl from '../../data/worlds/starter.json?url'
import zombieJsonUrl from '../../data/worlds/zombie-big-box.json?url'
import birdJsonUrl from '../../data/worlds/bird-building.json?url'
import volcanoJsonUrl from '../../data/worlds/highway-volcano.json?url'

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
  'bird-building-bg': birdRealityUrl,
  'bird-building-overlay': birdOverlayUrl,
  'bird-building-cardfront': birdCardfrontUrl,
  'highway-volcano-bg': volcanoRealityUrl,
  'highway-volcano-overlay': volcanoOverlayUrl,
  'highway-volcano-cardfront': volcanoCardfrontUrl,
  'volcano-inset-ash-fall': volcanoInsetAshFallUrl,
  'volcano-inset-ditch-gear': volcanoInsetDitchGearUrl,
  'volcano-inset-floor-it': volcanoInsetFloorItUrl,
  'volcano-inset-gridlock': volcanoInsetGridlockUrl,
  'volcano-inset-lava-flow': volcanoInsetLavaFlowUrl,
  'volcano-inset-spot-path': volcanoInsetSpotPathUrl,
  'volcano-inset-tremors': volcanoInsetTremorsUrl,
  'volcano-inset-vehicle': volcanoInsetVehicleUrl,
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
  // JSON files are loaded as URLs so Phaser can load them asynchronously.
  'world-starter': starterJsonUrl,
  'world-zombie-big-box': zombieJsonUrl,
  'world-bird-building': birdJsonUrl,
  'world-highway-volcano': volcanoJsonUrl,
}
