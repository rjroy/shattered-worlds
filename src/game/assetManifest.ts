/// <reference types="vite/client" />
import cardbackUrl from './assets/cardback.webp'
import cardfrontUrl from './assets/cardfront.webp'
import bigboxRealityUrl from './assets/themes/zombie-big-box/bigbox-reality.webp'
import zombieIntrusionUrl from './assets/themes/zombie-big-box/intrusion-overlay.webp'
import zombieWalkerUrl from './assets/themes/zombie-big-box/walker.png'
import zombieCardfrontUrl from './assets/themes/zombie-big-box/zombie-cardfront.webp'
import starterJsonUrl from '../data/worlds/starter.json?url'
import zombieJsonUrl from '../data/worlds/zombie-big-box.json?url'

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  'bigbox-reality': bigboxRealityUrl,
  'zombie-intrusion': zombieIntrusionUrl,
  'zombie-walker': zombieWalkerUrl,
  'zombie-cardfront': zombieCardfrontUrl,
  'world-starter': starterJsonUrl,
  'world-zombie-big-box': zombieJsonUrl,
}
