import Phaser from 'phaser'
import worldSelectBgUrl from '../assets/world-select.webp'
import { assetManifest } from '../data/assetManifest'
import { worldManifest } from '../../data/worldManifest'
import { worldDisplayManifest, type WorldDisplayData } from '../../data/worldDisplayManifest'
import type { RunStatsReader } from '../runtime/runStats'
import { selectTheme } from '../view/themes/themeManifest'
import { textStyle, TEXT } from '../view/presentation'
import { CANVAS_W, CANVAS_H, WORLD_SELECT_LAYOUT } from '../view/layout'
import { worldBadgeLabel } from '../view/worldBadge'

const CARD_W = WORLD_SELECT_LAYOUT.cardWidth
const CARD_H = WORLD_SELECT_LAYOUT.cardHeight
const CARD_GAP = WORLD_SELECT_LAYOUT.cardGap
const CARD_Y = WORLD_SELECT_LAYOUT.cardY // card center y — over the stone-path area of the title image
const SUBTITLE_Y = WORLD_SELECT_LAYOUT.subtitleY
const VISIBLE_WORLD_COUNT = WORLD_SELECT_LAYOUT.visibleWorldCount
const ARROW_Y = CARD_Y
const ARROW_W = WORLD_SELECT_LAYOUT.arrowWidth
const ARROW_H = WORLD_SELECT_LAYOUT.arrowHeight
const ARROW_GAP = WORLD_SELECT_LAYOUT.arrowGap

// Common return type for the world card background, which may be either an image or a simple colored rectangle
type WorldCardBackground = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
type WorldCardView = {
  container: Phaser.GameObjects.Container
  background: WorldCardBackground
}
type WorldSelectArrow = {
  container: Phaser.GameObjects.Container
  hitArea: Phaser.GameObjects.Rectangle
}

export class WorldSelectScene extends Phaser.Scene {
  cards: WorldCardView[] = []
  private worldIds: string[] = []
  private visibleStartIndex = 0
  private leftArrow?: WorldSelectArrow
  private rightArrow?: WorldSelectArrow
  private readonly runStats: RunStatsReader | undefined

  constructor(runStats?: RunStatsReader) {
    super({ key: 'WorldSelect' })
    this.runStats = runStats
  }

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

    this.worldIds = Object.keys(worldManifest)
    this.visibleStartIndex = 0
    this.createChronicleButton()
    this.createArrows()
    this.renderVisibleWorlds()
  }

  private createChronicleButton(): void {
    const button = this.add.container(CANVAS_W - 88, 34)
    const bg = this.add.rectangle(0, 0, 132, 34, 0x0f0b15, 0.82)
    bg.setStrokeStyle(1, 0xd6b15c, 0.9)
    bg.setRounded(6)
    bg.setInteractive({ useHandCursor: true })
    const label = this.add.text(0, -8, 'Chronicle', textStyle({
      fontSize: '15px',
      color: '#d6b15c',
      fontStyle: 'bold',
    })).setOrigin(0.5, 0)
    button.add([bg, label])
    bg.on('pointerover', () => button.setScale(1.05))
    bg.on('pointerout', () => button.setScale(1))
    bg.on('pointerdown', () => this.scene.start('Chronicle'))
  }

  private renderVisibleWorlds(): void {
    this.cards.forEach(card => {
      const disappearTween = this.tweens.add({
        targets: card.container,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: 300,
        ease: 'Cubic.easeIn',
      })
      disappearTween.on('complete', () => {
        card.container.destroy(true)
        this.tweens.remove(disappearTween)
      })
  })
    this.cards = []

    const visibleWorldIds = this.worldIds.slice(
      this.visibleStartIndex,
      this.visibleStartIndex + VISIBLE_WORLD_COUNT,
    )
    const totalW = visibleWorldIds.length * CARD_W + (visibleWorldIds.length - 1) * CARD_GAP
    const startX = (CANVAS_W - totalW) / 2 + CARD_W / 2

    visibleWorldIds.forEach((worldId, i) => {
      const display = worldDisplayManifest[worldId]
      if (display === undefined) {
        throw new Error(`WorldSelectScene: no display entry for worldId "${worldId}"`)
      }
      const accentColor = Phaser.Display.Color.HexStringToColor(selectTheme(worldId).intrusionHue).color
      const cardX = startX + i * (CARD_W + CARD_GAP)
      const newCard = this.createWorldCard(worldId, cardX, CARD_Y, display, accentColor)
      this.cards.push(newCard)
      const appearTween = this.tweens.add({
        targets: newCard.container,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.8, to: 1 },
        duration: 300,
        ease: 'Cubic.easeOut',
      })
      appearTween.on('complete', () => this.tweens.remove(appearTween))
    })

    this.updateArrowState()
  }

  private createArrows(): void {
    const visibleW = VISIBLE_WORLD_COUNT * CARD_W + (VISIBLE_WORLD_COUNT - 1) * CARD_GAP
    const rowLeft = (CANVAS_W - visibleW) / 2
    const rowRight = rowLeft + visibleW

    this.leftArrow = this.createArrow(rowLeft - ARROW_GAP, ARROW_Y, '<', () => {
      if (this.visibleStartIndex <= 0) return
      this.visibleStartIndex -= 1
      this.renderVisibleWorlds()
    })
    this.rightArrow = this.createArrow(rowRight + ARROW_GAP, ARROW_Y, '>', () => {
      if (this.visibleStartIndex + VISIBLE_WORLD_COUNT >= this.worldIds.length) return
      this.visibleStartIndex += 1
      this.renderVisibleWorlds()
    })
  }

  private createArrow(x: number, y: number, label: string, onClick: () => void): WorldSelectArrow {
    const container = this.add.container(x, y)
    const hitArea = this.add.rectangle(0, 0, ARROW_W, ARROW_H, 0x160f1f, 0.66)
    hitArea.setStrokeStyle(2, 0xc178bc, 0.9)
    const text = this.add.text(0, -3, label,
      textStyle({ fontSize: '46px', color: TEXT.textWorldTitle, fontStyle: 'bold' }),
    ).setOrigin(0.5, 0.5)

    container.add([hitArea, text])
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerover', () => container.setScale(1.08))
    hitArea.on('pointerout', () => container.setScale(1.0))
    hitArea.on('pointerdown', onClick)

    return { container, hitArea }
  }

  private updateArrowState(): void {
    this.setArrowEnabled(this.leftArrow, this.visibleStartIndex > 0)
    this.setArrowEnabled(
      this.rightArrow,
      this.visibleStartIndex + VISIBLE_WORLD_COUNT < this.worldIds.length,
    )
  }

  private setArrowEnabled(arrow: WorldSelectArrow | undefined, enabled: boolean): void {
    if (arrow === undefined) return
    arrow.container.setAlpha(enabled ? 1 : TEXT.dimAlpha)
    arrow.hitArea.setInteractive({ useHandCursor: enabled })
    if (!enabled) {
      arrow.hitArea.disableInteractive()
      arrow.container.setScale(1.0)
    }
  }

  private createWorldCardBackground(worldId: string, display: WorldDisplayData): WorldCardBackground {
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
  ): WorldCardView {
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

    const contents: Phaser.GameObjects.GameObject[] = [bg, border, nameText, tagText, storyText]
    const badge = worldBadgeLabel(this.runStats?.lifetime().byWorld[worldId])
    if (badge !== null) {
      const badgeBg = this.add.rectangle(CARD_W / 2 - 48, CARD_H / 2 - 28, 70, 26, 0x0b0710, 0.88)
      badgeBg.setStrokeStyle(1, accentColor, 0.8)
      badgeBg.setRounded(8)
      const badgeText = this.add.text(CARD_W / 2 - 48, CARD_H / 2 - 36, badge, textStyle({
        fontSize: '13px',
        color: TEXT.textLight,
        fontStyle: 'bold',
      })).setOrigin(0.5, 0)
      contents.push(badgeBg, badgeText)
    }

    container.add(contents)

    bg.on('pointerover', () => container.setScale(WORLD_SELECT_LAYOUT.hoverScale))
    bg.on('pointerout',  () => container.setScale(1.0))
    bg.on('pointerdown', () => {
      bg.disableInteractive()
      this.disableCarouselInteractions()
      const seed = Math.floor(Math.random() * 2 ** 32)
      this.scene.launch('Table', { worldId, seed })
    })
    return { container, background: bg }
  }

  private disableCarouselInteractions(): void {
    this.cards.forEach(card => card.background.disableInteractive())
    this.leftArrow?.hitArea.disableInteractive()
    this.rightArrow?.hitArea.disableInteractive()
  }
}
