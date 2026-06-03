import Phaser from 'phaser'
import { createGame } from '../core/game'
import type { GameCore } from '../core/contract'
import type { Card } from '../core/types'
import {
  PLAYED_AREA_X,
  PLAYED_AREA_Y,
  PANEL_X,
  TOTAL_X,
  TOTAL_Y,
  END_BTN_X,
  END_BTN_Y,
  END_BTN_W,
  END_BTN_H,
  handCardX,
  handCardY,
  addCardObject,
} from './render'

const SEED = 12345

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '13px',
  color: '#e0e4f0',
}

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#8899bb',
}

export class TableScene extends Phaser.Scene {
  private core!: GameCore

  constructor() {
    super({ key: 'TableScene' })
  }

  create(): void {
    this.core = createGame(SEED)
    this.redraw()
  }

  // ── Redraw ─────────────────────────────────────────────────────────────────

  /** Destroy all existing game objects and rebuild from current state. */
  private redraw(): void {
    this.children.removeAll(true)
    const { state } = this.core

    this.drawLabels()
    this.drawRunningTotal(state.runningTotal)
    this.drawPileCounts(state.drawPile.length, state.discard.length)
    this.drawPlayedPile(state.played)
    this.drawHand(state.hand)
    this.drawHistory(state.history)
    this.drawEndTurnButton()
  }

  // ── Section helpers ────────────────────────────────────────────────────────

  private drawLabels(): void {
    this.add.text(PLAYED_AREA_X, PLAYED_AREA_Y - 20, 'PLAYED', LABEL_STYLE)
    this.add.text(TOTAL_X - 30, TOTAL_Y - 18, 'RUNNING TOTAL', LABEL_STYLE)
    this.add.text(PANEL_X, 60, 'HISTORY', LABEL_STYLE)
    this.add.text(PANEL_X, 340, 'DRAW PILE', LABEL_STYLE)
    this.add.text(PANEL_X, 390, 'DISCARD PILE', LABEL_STYLE)
    this.add.text(50, handCardY() - 22, 'HAND', LABEL_STYLE)
  }

  private drawRunningTotal(total: number): void {
    this.add.text(TOTAL_X, TOTAL_Y, String(total), {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#f0d080',
    })
  }

  private drawPileCounts(drawCount: number, discardCount: number): void {
    this.add.text(PANEL_X, 360, String(drawCount), TEXT_STYLE)
    this.add.text(PANEL_X, 410, String(discardCount), TEXT_STYLE)
  }

  private drawPlayedPile(played: readonly Card[]): void {
    if (played.length === 0) {
      this.add.text(PLAYED_AREA_X, PLAYED_AREA_Y, '(none)', LABEL_STYLE)
      return
    }
    played.forEach((card, i) => {
      this.add.text(PLAYED_AREA_X, PLAYED_AREA_Y + i * 28, `[${card.value}] ${card.id}`, TEXT_STYLE)
    })
  }

  private drawHand(hand: readonly Card[]): void {
    hand.forEach((card, index) => {
      addCardObject(this, handCardX(index), handCardY(), card, () => {
        this.core.dispatch({ type: 'PlayCard', cardId: card.id })
        this.redraw()
      })
    })
  }

  private drawHistory(history: readonly number[]): void {
    const lines =
      history.length === 0
        ? ['(no turns yet)']
        : history.map((v, i) => `Turn ${i + 1}: ${v}`)

    this.add.text(PANEL_X, 80, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#aabbcc',
      lineSpacing: 4,
    })
  }

  private drawEndTurnButton(): void {
    const cx = END_BTN_X + END_BTN_W / 2
    const cy = END_BTN_Y + END_BTN_H / 2

    const btn = this.add
      .rectangle(cx, cy, END_BTN_W, END_BTN_H, 0x1e5c2e)
      .setStrokeStyle(2, 0x44cc66)
      .setInteractive({ cursor: 'pointer' })

    this.add.text(cx, cy, 'End Turn', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#88ffaa',
    }).setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0x2a7a3e))
    btn.on('pointerout', () => btn.setFillStyle(0x1e5c2e))
    btn.on('pointerdown', () => {
      this.core.dispatch({ type: 'EndTurn' })
      this.redraw()
    })
  }
}
