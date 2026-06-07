import Phaser from 'phaser'
import { themeManifest } from '../view/themes/themeManifest'
import { rngFromSeed } from '../../core/engine/rng'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' })
  }

  create(): void {
    const worldIds = Object.keys(themeManifest)
    const seed = Math.floor(Math.random() * 2 ** 32)
    const rng = rngFromSeed(seed)
    const worldId = worldIds[Math.floor(rng() * worldIds.length)]
    this.scene.start('Table', { worldId, seed })
  }
}
