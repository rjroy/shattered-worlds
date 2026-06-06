/**
 * Reusable Phaser UI components shared across the table view.
 *
 * CommonLabel is a text label on a nine-slice backing panel; CommonButton is
 * the interactive variant. Both are plain Phaser game objects with no
 * knowledge of GameState — callers construct them and pass in text/style.
 */
import Phaser from 'phaser'

export class CommonLabel extends Phaser.GameObjects.Container {

  protected txtBg: Phaser.GameObjects.NineSlice
  protected label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, textStyle: Phaser.Types.GameObjects.Text.TextStyle) {
    super(scene, x, y)

    this.txtBg = scene.add
      .nineslice(
        0, 0,
        'text-back',
        undefined,
        30, 20,
        4, 4, 2, 2,
      )
      .setOrigin(0.5, 0.5)
      .setTint(0x888888)
    this.add(this.txtBg)

    this.label = scene.add.text(0, 0, text, textStyle)
    this.label.setOrigin(0.5, 0.5)
    this.txtBg.setSize(this.label.width + 20, this.label.height + 10)

    this.add(this.label)
    this.setPosition(x, y)
    scene.add.existing(this)
  }

  setText(text: string): void {
    this.label.setText(text)
    this.txtBg.setSize(this.label.width + 20, this.label.height + 10)
  }
}

export class CommonButton extends CommonLabel {

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, textStyle: Phaser.Types.GameObjects.Text.TextStyle) {
    super(scene, x, y, text, textStyle)
    this.txtBg.setInteractive({ useHandCursor: true })
  }

  on(event: string, callback: () => void): this {
    if (this.txtBg !== undefined) {
      this.txtBg.on(event, callback)
    }
    return this
  }

  disableInteractive(): this {
    if (this.txtBg !== undefined) {
      this.txtBg.disableInteractive()
    }
    return this
  }

  setInteractive(config?: Phaser.Types.Input.InputConfiguration): this {
    if (this.txtBg !== undefined) {
      this.txtBg.setInteractive(config)
    }
    return this
  }
}
