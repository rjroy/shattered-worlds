/// <reference types="vite/client" />
import zombieBigBoxMusicUrl from '../assets/audio/zombie-big-box-music.mp3?url'
import birdBuildingMusicUrl from '../assets/audio/bird-building-music.mp3?url'
import highwayVolcanoMusicUrl from '../assets/audio/highway-volcano-music.mp3?url'

export interface WorldMusicAsset {
  key: string
  url: string
}

export const worldMusicManifest: Record<string, WorldMusicAsset> = {
  'zombie-big-box': {
    key: 'music-zombie-big-box',
    url: zombieBigBoxMusicUrl,
  },
  'bird-building': {
    key: 'music-bird-building',
    url: birdBuildingMusicUrl,
  },
  'highway-volcano': {
    key: 'music-highway-volcano',
    url: highwayVolcanoMusicUrl,
  },
}
