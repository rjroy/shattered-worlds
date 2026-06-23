import Phaser from "phaser";

import { mainThemeMusic } from "../data/audioManifest";
import {
  MENU_MUSIC_BASE,
  effectiveVolume,
  musicGain,
} from "./audioVolume";
import type { UserSettingsStore } from "../runtime/userSettings";

export function startMainTheme(
  scene: Phaser.Scene,
  settings?: UserSettingsStore,
): Promise<void> {
  const existing = scene.sound.get(mainThemeMusic.key);
  if (existing !== null && existing !== undefined) {
    return playWhenUnlocked(scene, existing);
  }

  const gain =
    settings !== undefined
      ? musicGain(settings.get())
      : 1;

  return new Promise((resolve, reject) => {
    const playMainTheme = () => {
      const music = scene.sound.add(mainThemeMusic.key, {
        loop: true,
        volume: effectiveVolume(MENU_MUSIC_BASE, gain),
      });
      void playWhenUnlocked(scene, music).then(resolve);
    };

    if (!scene.cache.audio.exists(mainThemeMusic.key)) {
      scene.load.audio(mainThemeMusic.key, mainThemeMusic.url);
      scene.load.once(`filecomplete-audio-${mainThemeMusic.key}`, playMainTheme);
      scene.load.once("loaderror", (file: Phaser.Loader.File) => {
        if (file.key === mainThemeMusic.key) {
          reject(new Error(`Failed to load music asset: ${mainThemeMusic.key}`));
        }
      });
      scene.load.start();
    } else {
      playMainTheme();
    }
  });
}

export function stopMainTheme(scene: Phaser.Scene): void {
  scene.sound.stopByKey(mainThemeMusic.key);
  scene.sound.removeByKey(mainThemeMusic.key);
}

/**
 * Look up the currently-playing main-theme sound and re-apply the effective
 * volume. Used as a live-reapply hook when the user moves the Music slider or
 * toggles master mute while the track is already playing.
 */
export function setMainThemeVolume(
  scene: Phaser.Scene,
  settings?: UserSettingsStore,
): void {
  const music = scene.sound.get(mainThemeMusic.key);
  if (music === null || music === undefined) return;

  const gain =
    settings !== undefined
      ? musicGain(settings.get())
      : 1;
  // BaseSound doesn't expose setVolume but concrete subclasses do.
  (music as Phaser.Sound.WebAudioSound).setVolume(effectiveVolume(MENU_MUSIC_BASE, gain));
}

function playWhenUnlocked(scene: Phaser.Scene, music: Phaser.Sound.BaseSound): Promise<void> {
  if (!scene.sound.locked) {
    ensureMusicIsPlaying(music);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onUnlocked = () => {
      cleanup();
      const current = scene.sound.get(mainThemeMusic.key);
      if (current === music) {
        ensureMusicIsPlaying(music);
      }
      resolve();
    };
    const cleanup = () => {
      scene.sound.off(Phaser.Sound.Events.UNLOCKED, onUnlocked);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    };
    const onShutdown = () => {
      cleanup();
      resolve();
    };

    scene.sound.once(Phaser.Sound.Events.UNLOCKED, onUnlocked);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  });
}

function ensureMusicIsPlaying(music: Phaser.Sound.BaseSound): void {
  if (!music.isPlaying) music.play();
}
