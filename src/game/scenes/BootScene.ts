import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' })
  }

  create(): void {
    const seed = Math.floor(Math.random() * 2 ** 32)
    this.scene.start('Table', { worldId: 'zombie-big-box', seed })
  }
}
