import Phaser from 'phaser'

import { CANVAS_W, CANVAS_H } from '../view/layout'
import { textStyle, TEXT } from '../view/presentation'

export class BootScene extends Phaser.Scene {
  hasStarted: boolean = false
  constructor() {
    super({ key: 'Boot' })
  }

  create(): void {
      // subtitle only — logotype is in the image
    this.add.text(CANVAS_W / 2, CANVAS_H / 2, 'Loading...',
      textStyle({ fontSize: '40px', fontStyle: 'italic', color: TEXT.textWorldTitle }),
    ).setOrigin(0.5, 0.5)
  }

  update(_time: number, _delta: number): void {
    if (this.hasStarted) return
    this.hasStarted = true
    this.scene.start('WorldSelect')
  }
}
