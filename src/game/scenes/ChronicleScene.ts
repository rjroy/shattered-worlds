import Phaser from 'phaser'

import { worldManifest } from '../../data/worldManifest'
import { worldDisplayManifest } from '../../data/worldDisplayManifest'
import type { RunStatsReader } from '../runtime/runStats'
import type { StatsTransfer, InspectedStatsImport } from '../runtime/statsTransfer'
import { CANVAS_W, CANVAS_H } from '../view/layout'
import { TEXT, textStyle } from '../view/presentation'
import { formatDuration } from '../view/format'

type Button = {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
}

export class ChronicleScene extends Phaser.Scene {
  private readonly runStats: RunStatsReader | undefined
  private readonly statsTransfer: StatsTransfer | undefined
  private content?: Phaser.GameObjects.Container
  private messageText?: Phaser.GameObjects.Text
  private confirmOverlay?: Phaser.GameObjects.Container
  private fileInput?: HTMLInputElement

  constructor(runStats?: RunStatsReader, statsTransfer?: StatsTransfer) {
    super({ key: 'Chronicle' })
    this.runStats = runStats
    this.statsTransfer = statsTransfer
  }

  create(): void {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0a12, 1)
    this.add.text(42, 24, 'Chronicle', textStyle({
      fontSize: '32px',
      color: '#d6b15c',
      fontStyle: 'bold',
    }))

    this.createButton(74, 560, 'Back', () => this.scene.start('WorldSelect'))
    this.createButton(740, 42, 'Export', () => this.exportStats())
    this.createButton(842, 42, 'Import', () => this.chooseImportFile())

    this.messageText = this.add.text(CANVAS_W / 2, 560, '', textStyle({
      fontSize: '13px',
      color: TEXT.textPenalty,
      align: 'center',
      wordWrap: { width: 560 },
    })).setOrigin(0.5, 0.5)

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('WorldSelect'))
    this.renderStats()
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Button {
    const container = this.add.container(x, y)
    const bg = this.add.rectangle(0, 0, 86, 32, 0x15101d, 0.9)
    bg.setStrokeStyle(1, 0xd6b15c, 0.8)
    bg.setRounded(6)
    bg.setInteractive({ useHandCursor: true })
    const text = this.add.text(0, -8, label, textStyle({
      fontSize: '14px',
      color: '#d6b15c',
      fontStyle: 'bold',
    })).setOrigin(0.5, 0)
    container.add([bg, text])
    bg.on('pointerover', () => container.setScale(1.05))
    bg.on('pointerout', () => container.setScale(1))
    bg.on('pointerdown', onClick)
    return { container, bg }
  }

  private renderStats(): void {
    this.content?.destroy(true)
    this.content = this.add.container(0, 0)

    const lifetime = this.runStats?.lifetime()
    if (lifetime === undefined || lifetime.runs === 0) {
      this.addToContent(this.add.text(CANVAS_W / 2, 285, 'Nothing is written yet. Step through a Door.', textStyle({
        fontSize: '24px',
        color: TEXT.textMuted,
        fontStyle: 'italic',
      })).setOrigin(0.5, 0.5))
      return
    }

    this.addPanel(44, 82, 812, 116)
    this.addText(64, 100, 'Lifetime', 18, '#d6b15c', true)
    const totals = [
      `Runs ${lifetime.runs}`,
      `Wins ${lifetime.wins}`,
      `Losses ${lifetime.losses}`,
      `Abandons ${lifetime.abandoned}`,
      `Turns ${lifetime.turns}`,
      `Cards ${lifetime.cardsPlayed}`,
      `Progress ${lifetime.progressDealt}`,
      `Damage ${lifetime.damageTaken}`,
      `Hazards ${lifetime.hazardsResolved}/${lifetime.hazardsDiscarded}`,
      `Time ${formatDuration(lifetime.durationMs)}`,
    ]
    this.addText(64, 132, totals.join('   '), 13, TEXT.textLight)

    this.addPanel(44, 222, 812, 210)
    this.addText(64, 240, 'Worlds', 18, '#d6b15c', true)
    this.addText(64, 272, 'World', 12, TEXT.textMuted, true)
    this.addText(340, 272, 'Attempts', 12, TEXT.textMuted, true)
    this.addText(430, 272, 'Wins', 12, TEXT.textMuted, true)
    this.addText(505, 272, 'Losses', 12, TEXT.textMuted, true)
    this.addText(590, 272, 'Abandons', 12, TEXT.textMuted, true)
    this.addText(690, 272, 'Bests', 12, TEXT.textMuted, true)

    Object.keys(worldManifest).forEach((worldId, index) => {
      const y = 304 + index * 30
      const stats = lifetime.byWorld[worldId]
      const display = worldDisplayManifest[worldId]
      const bests = [
        stats?.fewestTurnsWin === undefined ? '' : `${stats.fewestTurnsWin} turns`,
        stats?.mostProgressInRun === undefined ? '' : `${stats.mostProgressInRun} progress`,
      ].filter(Boolean).join(' / ')

      this.addText(64, y, display?.name ?? worldId, 13, TEXT.textLight)
      this.addText(340, y, (stats?.runs ?? 0).toString(), 13, TEXT.textLight)
      this.addText(430, y, (stats?.wins ?? 0).toString(), 13, TEXT.textLight)
      this.addText(505, y, (stats?.losses ?? 0).toString(), 13, TEXT.textLight)
      this.addText(590, y, (stats?.abandoned ?? 0).toString(), 13, TEXT.textLight)
      this.addText(690, y, bests, 13, TEXT.textReward)
    })

    const lastRun = lifetime.lastRun
    if (lastRun !== undefined) {
      this.addPanel(44, 454, 812, 72)
      const display = worldDisplayManifest[lastRun.worldId]
      this.addText(64, 472, 'Last Run', 18, '#d6b15c', true)
      this.addText(64, 502, [
        display?.name ?? lastRun.worldId,
        lastRun.outcome,
        formatDuration(lastRun.activeDurationMs),
        `${lastRun.turns} turns`,
        `${lastRun.cardsPlayed} cards`,
        `${lastRun.progressDealt} progress`,
        `${lastRun.damageTaken} damage`,
      ].join('   '), 13, TEXT.textLight)
    }
  }

  private addPanel(x: number, y: number, w: number, h: number): void {
    const panel = this.add.rectangle(x, y, w, h, 0x15101d, 0.92).setOrigin(0, 0)
    panel.setStrokeStyle(1, 0x5f4b2a, 0.85)
    panel.setRounded(8)
    this.addToContent(panel)
  }

  private addText(x: number, y: number, value: string, size: number, color: string, bold = false): void {
    this.addToContent(this.add.text(x, y, value, textStyle({
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? 'bold' : '',
      wordWrap: { width: 780 },
    })))
  }

  private addToContent(child: Phaser.GameObjects.GameObject): void {
    this.content?.add(child)
  }

  private exportStats(): void {
    if (this.statsTransfer === undefined) return

    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([this.statsTransfer.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `shattered-worlds-stats-${date}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  private chooseImportFile(): void {
    if (this.statsTransfer === undefined) return

    this.fileInput?.remove()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file === undefined) return
      void file.text().then((text) => this.inspectImport(text))
    })
    document.body.append(input)
    this.fileInput = input
    input.click()
  }

  private inspectImport(text: string): void {
    const inspected = this.statsTransfer?.inspectImport(text)
    if (inspected === undefined) return
    if (!inspected.ok) {
      this.messageText?.setText(inspected.reason)
      return
    }
    this.showImportConfirm(inspected)
  }

  private showImportConfirm(inspected: Extract<InspectedStatsImport, { ok: true }>): void {
    this.confirmOverlay?.destroy(true)
    const overlay = this.add.container(CANVAS_W / 2, CANVAS_H / 2).setDepth(1000)
    const bg = this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050409, 0.82)
    bg.setInteractive()
    const panel = this.add.rectangle(0, 0, 560, 230, 0x15101d, 0.98)
    panel.setStrokeStyle(2, 0xd6b15c, 0.95)
    panel.setRounded(8)
    const text = this.add.text(0, -56, [
      'Overwrite current Chronicle data?',
      inspected.needsMigration ? 'This older file will be upgraded during import.' : '',
    ].filter(Boolean).join('\n'), textStyle({
      fontSize: '18px',
      color: TEXT.textLight,
      align: 'center',
      wordWrap: { width: 480 },
    })).setOrigin(0.5, 0.5)
    overlay.add([bg, panel, text])
    this.confirmOverlay = overlay

    overlay.add([
      this.createOverlayButton(-82, 62, 'Cancel', () => overlay.destroy(true)),
      this.createOverlayButton(82, 62, 'Import', () => {
        this.statsTransfer?.applyImport(inspected)
        overlay.destroy(true)
        this.messageText?.setText('')
        this.renderStats()
      }),
    ])
  }

  private createOverlayButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const bg = this.add.rectangle(0, 0, 90, 34, 0x0d0a12, 0.95)
    bg.setStrokeStyle(1, 0xd6b15c, 0.9)
    bg.setRounded(6)
    bg.setInteractive({ useHandCursor: true })
    const text = this.add.text(0, -8, label, textStyle({
      fontSize: '14px',
      color: '#d6b15c',
      fontStyle: 'bold',
    })).setOrigin(0.5, 0)
    container.add([bg, text])
    bg.on('pointerdown', onClick)
    return container
  }
}
