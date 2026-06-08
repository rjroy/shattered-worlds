import Phaser from 'phaser'
import titleBgUrl from '../assets/title.webp'
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
    this.load.image('world-select-bg', titleBgUrl)
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

  private createWorldCard(
    worldId: string,
    cx: number, cy: number,
    display: WorldDisplayData,
    accentColor: number,
  ): void {
    const container = this.add.container(cx, cy)

    // background + accent border
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x181c28)
    const border = this.add.rectangle(0, 0, CARD_W, CARD_H)
    border.setStrokeStyle(2, accentColor)
    border.setFillStyle()  // transparent fill

    // content
    const nameText = this.add.text(0, -CARD_H / 2 + 30, display.name,
      textStyle({ fontSize: '17px', color: '#c8cde0', fontStyle: 'bold' }),
    ).setOrigin(0.5, 0)

    const tagText = this.add.text(0, -CARD_H / 2 + 60, display.tagline,
      textStyle({ fontSize: '12px', color: '#6b7099', fontStyle: 'italic' }),
    ).setOrigin(0.5, 0)

    const storyText = this.add.text(0, -CARD_H / 2 + 90, display.story,
      textStyle({ fontSize: '12px', color: '#a0a8c0', wordWrap: { width: CARD_W - 24 } }),
    ).setOrigin(0.5, 0)

    container.add([bg, border, nameText, tagText, storyText])

    // interactivity on background rect
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerover', () => container.setScale(1.03))
    bg.on('pointerout',  () => container.setScale(1.0))
    bg.on('pointerdown', () => {
      const seed = Math.floor(Math.random() * 2 ** 32)
      this.scene.start('Table', { worldId, seed })
    })
  }
}
