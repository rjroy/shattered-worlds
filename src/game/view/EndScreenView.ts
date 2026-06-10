import Phaser from 'phaser'
import { textStyle, TEXT } from './presentation'
import { CANVAS_W, CANVAS_H } from './layout'

/**
 * Config for end screen overlays (win/loss).
 * These are simple 2-line text overlays, but the structure allows for 
 * easy customization of the title, subtitle, and colors.
 */
export interface EndScreenConfig {
  title: string
  titleColor: string
  subtitle: string
}

/** Full-screen terminal overlay (hidden by default), centered on the canvas. */
export class EndScreenView extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, config: EndScreenConfig) {
    super(scene, CANVAS_W / 2, CANVAS_H / 2)
    scene.add.existing(this)
    this.setDepth(1000)
    this.setVisible(false)

    this.bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x000000, 0.8)
    this.add(this.bg)

    const text = scene.add.text(0, -30, config.title, textStyle({
      fontSize: '72px',
      color: config.titleColor,
      fontStyle: 'bold',
    }))
    text.setOrigin(0.5, 0.5)
    this.add(text)

    const sub = scene.add.text(0, 50, config.subtitle, textStyle({
      fontSize: '20px',
      color: TEXT.textLight
    }))
    sub.setOrigin(0.5, 0.5)
    this.add(sub)
  }

  setOnClick(callback: () => void) {
    if (this.bg) {
      this.scene.time.delayedCall(1000, () => {
        this.bg.setInteractive({ useHandCursor: true })
        this.bg.once('pointerdown', callback)
      })
    }
  }
}
