import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' })
  }

  create(): void {
    this.scene.start('WorldSelect')
  }
}
