import Phaser from 'phaser'
import worldSelectBgUrl from '../assets/world-select.webp'
import { assetManifest } from '../data/assetManifest'
import { worldManifest } from '../../data/worldManifest'
import { worldDisplayManifest, type WorldDisplayData } from '../../data/worldDisplayManifest'
import { selectTheme } from '../view/themes/themeManifest'
import { textStyle, TEXT } from '../view/presentation'
import { CANVAS_W, CANVAS_H, WORLD_SELECT_LAYOUT } from '../view/layout'

const CARD_W = WORLD_SELECT_LAYOUT.cardWidth
const CARD_H = WORLD_SELECT_LAYOUT.cardHeight
const CARD_GAP = WORLD_SELECT_LAYOUT.cardGap
const CARD_Y = WORLD_SELECT_LAYOUT.cardY // card center y — over the stone-path area of the title image
const SUBTITLE_Y = WORLD_SELECT_LAYOUT.subtitleY

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
      textStyle({ fontSize: '20px', fontStyle: 'italic', color: TEXT.textWorldTag }),
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
        hitAreaCallback: (hitArea: Phaser.Geom.Rectangle, x: number, y: number, _gameObject: Phaser.GameObjects.GameObject) => {
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
    const nameText = this.add.text(0, -CARD_H / 2 + WORLD_SELECT_LAYOUT.nameY, display.name,
      textStyle({ fontSize: '17px', color: TEXT.textWorldTitle, fontStyle: 'bold', align: 'center', wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding } }),
    ).setOrigin(0.5, 0)

    const tagLineY = Math.max(
      -CARD_H / 2 + WORLD_SELECT_LAYOUT.tagMinY,
      nameText.y + nameText.height + WORLD_SELECT_LAYOUT.textGap,
    )
    const tagText = this.add.text(0, tagLineY, display.tagline,
      textStyle({ fontSize: '12px', color: TEXT.textWorldTag, fontStyle: 'italic', align: 'center', wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding } }),
    ).setOrigin(0.5, 0)

    const storyLineY = Math.max(
      -CARD_H / 2 + WORLD_SELECT_LAYOUT.storyMinY,
      tagText.y + tagText.height + WORLD_SELECT_LAYOUT.textGap,
    )
    const storyText = this.add.text(0, storyLineY, display.story,
      textStyle({ fontSize: '12px', color: TEXT.textWorldStory, align: 'center', wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding } }),
    ).setOrigin(0.5, 0)

    container.add([bg, border, nameText, tagText, storyText])

    bg.on('pointerover', () => container.setScale(WORLD_SELECT_LAYOUT.hoverScale))
    bg.on('pointerout',  () => container.setScale(1.0))
    bg.on('pointerdown', () => {
      const seed = Math.floor(Math.random() * 2 ** 32)
      this.scene.start('Table', { worldId, seed })
    })
  }
}
