import type Phaser from 'phaser'
import type { Card } from '../core/types'

// ── Layout constants ──────────────────────────────────────────────────────────

export const CARD_W = 70
export const CARD_H = 90

// Hand row — left-aligned, near the bottom
const HAND_BASE_X = 50
const HAND_Y_TOP = 470

// Played area — left-centre column
export const PLAYED_AREA_X = 50
export const PLAYED_AREA_Y = 120

// Info panel — right column
export const PANEL_X = 720

// Running-total display — top centre
export const TOTAL_X = 320
export const TOTAL_Y = 30

// End Turn button
export const END_BTN_X = PANEL_X
export const END_BTN_Y = 500
export const END_BTN_W = 150
export const END_BTN_H = 40

// ── Layout helpers ────────────────────────────────────────────────────────────

/** Human-readable label shown on a card face. */
export function cardLabel(card: Card): string {
  return `[${card.value}]\n${card.id}`
}

/** X position (left edge) of card at the given hand index. */
export function handCardX(index: number): number {
  return HAND_BASE_X + index * (CARD_W + 12)
}

/** Y position (top edge) for all hand cards. */
export function handCardY(): number {
  return HAND_Y_TOP
}

// ── Card factory ──────────────────────────────────────────────────────────────

const CARD_FILL_NORMAL = 0x2a3a5c
const CARD_FILL_HOVER = 0x3a5080
const CARD_STROKE = 0x5577bb

/**
 * Add a clickable card to the scene at the given position.
 * Returns the background Rectangle so the caller can attach extra listeners.
 */
export function addCardObject(
  scene: Phaser.Scene,
  x: number,
  y: number,
  card: Card,
  onClick: () => void,
): Phaser.GameObjects.Rectangle {
  const cx = x + CARD_W / 2
  const cy = y + CARD_H / 2

  const rect = scene.add
    .rectangle(cx, cy, CARD_W, CARD_H, CARD_FILL_NORMAL)
    .setStrokeStyle(2, CARD_STROKE)
    .setInteractive({ cursor: 'pointer' })

  scene.add.text(x + 6, y + 10, cardLabel(card), {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ddeeff',
    wordWrap: { width: CARD_W - 8 },
  })

  rect.on('pointerover', () => rect.setFillStyle(CARD_FILL_HOVER))
  rect.on('pointerout', () => rect.setFillStyle(CARD_FILL_NORMAL))
  rect.on('pointerdown', onClick)

  return rect
}
