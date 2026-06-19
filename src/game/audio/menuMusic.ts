import Phaser from "phaser";

import { mainThemeMusic } from "../data/audioManifest";

export function startMainTheme(scene: Phaser.Scene): Promise<void> {
  const existing = scene.sound.get(mainThemeMusic.key);
  if (existing !== null && existing !== undefined) {
    return playWhenUnlocked(scene, existing);
  }

  return new Promise((resolve, reject) => {
    const playMainTheme = () => {
      const music = scene.sound.add(mainThemeMusic.key, {
        loop: true,
        volume: 0.42,
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
