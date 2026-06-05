/// <reference types="vite/client" />
import cardbackUrl from './assets/cardback.webp'
import cardfrontUrl from './assets/cardfront.webp'
import bigboxRealityUrl from './assets/themes/zombie-big-box/bigbox-reality.webp'
import zombieIntrusionUrl from './assets/themes/zombie-big-box/intrusion-overlay.webp'
import zombieWalkerUrl from './assets/themes/zombie-big-box/walker.png'
import zombieCardfrontUrl from './assets/themes/zombie-big-box/zombie-cardfront.webp'

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  'bigbox-reality': bigboxRealityUrl,
  'zombie-intrusion': zombieIntrusionUrl,
  'zombie-walker': zombieWalkerUrl,
  'zombie-cardfront': zombieCardfrontUrl,
}
