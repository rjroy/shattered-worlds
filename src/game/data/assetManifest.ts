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
}
