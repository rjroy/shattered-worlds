import Phaser from 'phaser'
import worldSelectBgUrl from '../assets/world-select.webp'
import { assetManifest } from '../data/assetManifest'
import { worldManifest } from '../../data/worldManifest'
import { worldDisplayManifest, type WorldDisplayData } from '../../data/worldDisplayManifest'
import { selectTheme } from '../view/themes/themeManifest'
import { textStyle, CANVAS_W, CANVAS_H } from '../view/presentation'

const CARD_W = 240
const CARD_H = 350
const CARD_GAP = 30
const CARD_Y = 390        // card center y — over the stone-path area of the title image
const SUBTITLE_Y = 555

export class WorldSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'WorldSelect' }) }

  preload(): void {
    for (const display of Object.values(worldDisplayManifest)) {
      if (display.backgroundKey) {
        this.load.image(display.backgroundKey, assetManifest[display.backgroundKey])
      }
    }
    this.load.image('world-select-bg', worldSelectBgUrl)
  }

  create(): void {
    // title image fills canvas
    this.add.image(CANVAS_W / 2, CANVAS_H / 2, 'world-select-bg')
      .setDisplaySize(CANVAS_W, CANVAS_H)

    // subtitle only — logotype is in the image
    this.add.text(CANVAS_W / 2, SUBTITLE_Y, 'Choose your shard',
      textStyle({ fontSize: '13px', color: '#9aa3b2' }),
    ).setOrigin(0.5, 0.5)

    // world cards
    const worldIds = Object.keys(worldManifest)
    const totalW = worldIds.length * CARD_W + (worldIds.length - 1) * CARD_GAP
    const startX = (CANVAS_W - totalW) / 2 + CARD_W / 2

    worldIds.forEach((worldId, i) => {
      const display = worldDisplayManifest[worldId]
      if (display === undefined) {
        throw new Error(`WorldSelectScene: no display entry for worldId "${worldId}"`)
      }
      const accentColor = Phaser.Display.Color.HexStringToColor(selectTheme(worldId).intrusionHue).color
      const cardX = startX + i * (CARD_W + CARD_GAP)
      this.createWorldCard(worldId, cardX, CARD_Y, display, accentColor)
    })
  }

  private createWorldCardBackground(worldId: string, display: WorldDisplayData): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    if (display.backgroundKey) {
      const img = this.add.image(0, 0, display.backgroundKey)

      const tintColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1f1123),
        Phaser.Display.Color.HexStringToColor(selectTheme(worldId).intrusionHue),
        100, 10
      )
      img.setTint(tintColor.color)

      const scale = Math.max(CARD_W / img.width, CARD_H / img.height)
      img.setScale(scale)

      const cropX = (img.width - CARD_W / scale) / 2
      const cropY = (img.height - CARD_H / scale) / 2
      const cropW = CARD_W / scale
      const cropH = CARD_H / scale
      img.setCrop(cropX, cropY, cropW, cropH)

      // interactivity on background rect
      img.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(cropX, cropY, cropW, cropH),
        hitAreaCallback: (hitArea: Phaser.Geom.Rectangle, x: number, y: number, gameObject: Phaser.GameObjects.GameObject) => {
          return hitArea.contains(x, y)
        }
      })
      return img
    } else {
      const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x181c28)
      bg.setInteractive({ useHandCursor: true })
      return bg
    }
  }

  private createWorldCard(
    worldId: string,
    cx: number, cy: number,
    display: WorldDisplayData,
    accentColor: number,
  ): void {
    const container = this.add.container(cx, cy)

    // background + accent border
    const bg = this.createWorldCardBackground(worldId, display)
    const border = this.add.rectangle(0, 0, CARD_W, CARD_H)
    border.setStrokeStyle(2, accentColor)
    border.setFillStyle()  // transparent fill

    // content
    const nameText = this.add.text(0, -CARD_H / 2 + 30, display.name,
      textStyle({ fontSize: '17px', color: '#d4c8e0', fontStyle: 'bold', align: 'center', wordWrap: { width: CARD_W - 24 } }),
    ).setOrigin(0.5, 0)

    const tagLineY = Math.max(-CARD_H / 2 + 60, nameText.y + nameText.height + 10)
    const tagText = this.add.text(0, tagLineY, display.tagline,
      textStyle({ fontSize: '12px', color: '#c178bc', fontStyle: 'italic', align: 'center', wordWrap: { width: CARD_W - 24 } }),
    ).setOrigin(0.5, 0)

    const storyLineY = Math.max(-CARD_H / 2 + 90, tagText.y + tagText.height + 10)
    const storyText = this.add.text(0, storyLineY, display.story,
      textStyle({ fontSize: '12px', color: '#b69fc7', align: 'center', wordWrap: { width: CARD_W - 24 } }),
    ).setOrigin(0.5, 0)

    container.add([bg, border, nameText, tagText, storyText])

    bg.on('pointerover', () => container.setScale(1.15))
    bg.on('pointerout',  () => container.setScale(1.0))
    bg.on('pointerdown', () => {
      const seed = Math.floor(Math.random() * 2 ** 32)
      this.scene.start('Table', { worldId, seed })
    })
  }
}
