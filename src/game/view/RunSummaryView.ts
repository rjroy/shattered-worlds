import Phaser from 'phaser'

import type { RunOutcome } from '../runtime/gameplayEventStream'
import type { RunRecordRecords } from '../runtime/runStats'
import { CANVAS_W, CANVAS_H } from './layout'
import { textStyle, TEXT } from './presentation'
import { formatDuration } from './format'

export interface RunSummaryData {
  readonly outcome: RunOutcome
  readonly worldName: string
  readonly runNumber: number
  readonly worldWins: number
  readonly activeDurationMs: number
  readonly turns: number
  readonly cardsPlayed: number
  readonly progressDealt: number
  readonly damageTaken: number
  readonly hazardsResolved: number
  readonly hazardsDiscarded: number
  readonly cardsDiscarded: number
  readonly records: RunRecordRecords
}

function titleForOutcome(outcome: RunOutcome): string {
  switch (outcome) {
    case 'won':
      return 'RUN WON'
    case 'lost':
      return 'RUN LOST'
    case 'abandoned':
      return 'RUN ABANDONED'
  }
}

function colorForOutcome(outcome: RunOutcome): string {
  switch (outcome) {
    case 'won':
      return TEXT.textReward
    case 'lost':
      return TEXT.textPenalty
    case 'abandoned':
      return TEXT.textHeld
  }
}

export class RunSummaryView extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle
  private onDismiss: (() => void) | null = null

  constructor(scene: Phaser.Scene) {
    super(scene, CANVAS_W / 2, CANVAS_H / 2)
    scene.add.existing(this)
    this.setDepth(1000)
    this.setVisible(false)

    this.bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050409, 0.88)
    this.bg.setInteractive()
    this.add(this.bg)
  }

  show(data: RunSummaryData, onDismiss: () => void): void {
    for (const child of [...this.list]) {
      if (child !== this.bg) this.remove(child, true)
    }
    this.onDismiss = onDismiss
    this.setVisible(true)

    const panel = this.scene.add.rectangle(0, 0, 620, 430, 0x12101a, 0.96)
    panel.setStrokeStyle(2, 0xd6b15c, 0.95)
    panel.setRounded(8)
    this.add(panel)

    const frame = this.scene.add.graphics()
    frame.lineStyle(1, 0xd6b15c, 0.45)
    frame.strokeRect(-286, -186, 572, 372)
    frame.strokeCircle(-260, -160, 18)
    frame.strokeCircle(260, -160, 18)
    frame.strokeCircle(-260, 160, 18)
    frame.strokeCircle(260, 160, 18)
    this.add(frame)

    const title = this.scene.add.text(0, -178, titleForOutcome(data.outcome), textStyle({
      fontSize: '34px',
      color: colorForOutcome(data.outcome),
      fontStyle: 'bold',
    })).setOrigin(0.5, 0.5)
    this.add(title)

    const contextParts = [`${data.worldName}`, `Run ${data.runNumber}`]
    if (data.worldWins > 0) contextParts.push(`${data.worldWins} wins on this world`)
    const context = this.scene.add.text(0, -139, contextParts.join('  |  '), textStyle({
      fontSize: '15px',
      color: TEXT.textMuted,
    })).setOrigin(0.5, 0.5)
    this.add(context)

    const rows = [
      ['Active time', formatDuration(data.activeDurationMs)],
      ['Turns', data.turns.toString()],
      ['Cards played', data.cardsPlayed.toString()],
      ['Progress dealt', data.progressDealt.toString()],
      ['Damage taken', data.damageTaken.toString()],
      ['Hazards resolved', data.hazardsResolved.toString()],
      ['Hazards discarded', data.hazardsDiscarded.toString()],
      ['Cards discarded', data.cardsDiscarded.toString()],
    ] as const

    rows.forEach(([label, value], index) => {
      const y = -92 + index * 28
      const labelText = this.scene.add.text(-220, y, label, textStyle({
        fontSize: '15px',
        color: TEXT.textMuted,
      })).setOrigin(0, 0.5)
      const valueText = this.scene.add.text(220, y, value, textStyle({
        fontSize: '15px',
        color: TEXT.textLight,
        fontStyle: 'bold',
      })).setOrigin(1, 0.5)
      this.add([labelText, valueText])
    })

    const recordLabels = [
      ...(data.records.fewestTurnsWin ? ['New fewest-turn win'] : []),
      ...(data.records.mostProgressInRun ? ['New progress record'] : []),
    ]
    if (recordLabels.length > 0) {
      const recordText = this.scene.add.text(0, 142, recordLabels.join('  |  '), textStyle({
        fontSize: '16px',
        color: TEXT.textReward,
        fontStyle: 'bold',
      })).setOrigin(0.5, 0.5)
      this.add(recordText)
    }

    const continueText = this.scene.add.text(0, 184, 'Tap to continue', textStyle({
      fontSize: '16px',
      color: '#d6b15c',
      fontStyle: 'bold',
    })).setOrigin(0.5, 0.5)
    this.add(continueText)

    this.bg.removeAllListeners('pointerdown')
    this.scene.time.delayedCall(500, () => {
      if (!this.visible) return
      this.bg.once('pointerdown', () => this.dismiss())
    })
  }

  dismiss(): void {
    const callback = this.onDismiss
    this.onDismiss = null
    this.setVisible(false)
    callback?.()
  }
}
