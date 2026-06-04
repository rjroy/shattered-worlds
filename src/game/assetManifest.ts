/// <reference types="vite/client" />
import cardbackUrl from './assets/cardback.webp'
import bigboxRealityUrl from './assets/themes/zombie-big-box/bigbox-reality.webp'
import zombieIntrusionUrl from './assets/themes/zombie-big-box/intrusion-overlay.webp'
import zombieWalkerUrl from './assets/themes/zombie-big-box/walker.png'

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  'bigbox-reality': bigboxRealityUrl,
  'zombie-intrusion': zombieIntrusionUrl,
  'zombie-walker': zombieWalkerUrl,
}
