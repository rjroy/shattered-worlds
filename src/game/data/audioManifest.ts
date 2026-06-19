/// <reference types="vite/client" />

import mainThemeUrl from "../assets/audio/main-theme.mp3?url";

export type { WorldMusicAsset } from "../worlds/assetBindings";
export { worldMusicManifest } from "../worlds/assetBindings";

export interface AudioAsset {
  key: string;
  url: string;
}

export const mainThemeMusic: AudioAsset = {
  key: "music-main-theme",
  url: mainThemeUrl,
};
