/**
 * Phaser 3 factory and update functions for the table view.
 *
 * All functions are stateless — they create or mutate Phaser game objects but
 * never read or write GameState directly. The scene passes data in; nothing
 * here has a reference to GameCore.
 */
import Phaser from 'phaser'
import type { Card, GameState, WorldCard } from '../core/index'
import type { FrameStyle, VisualTheme } from './theme'
import { describeEffect, describePenalty, describeReward } from './describe'

// ---------------------------------------------------------------------------
// Card dimensions and palette
// ---------------------------------------------------------------------------

// Cards are sized to carry their full rules text on the face: the player face
// shows the whole describeEffect block (Modal/Sequence included), the Hazard
// face shows full penalty/reward sentences. Six fit the 900px table.
const CARD_W = 150
const CARD_H = 196

// Text colors are theme-independent — all pass WCAG AA against the frame
// backgrounds used by every current theme.
const TEXT = {
  textLight: '#e8eaf0',
  textMuted: '#9aa3b2',
  textCost: '#ffcc44',
  textKeyword: '#88ccff',
  textPenalty: '#ff8888',
  textReward: '#88ee88',
  dimAlpha: 0.35,
}

// ---------------------------------------------------------------------------
// Card object factories
// ---------------------------------------------------------------------------

/** Create a Phaser Container representing a single card (player or world). */
export function createCardObject(
  scene: Phaser.Scene,
  card: Card,
  x: number,
  y: number,
  theme: VisualTheme,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)

  const bg = scene.add.rectangle(
    0,
    0,
    CARD_W,
    CARD_H,
    card.kind === 'player' ? theme.frameStyle.playerBg : theme.frameStyle.worldBg,
  )
  bg.setStrokeStyle(2, theme.frameStyle.borderColor)
  container.add(bg)

  if (card.kind === 'player') {
    // Card name at top
    const nameText = scene.add.text(0, -CARD_H / 2 + 8, card.name, {
      fontSize: '13px',
      color: TEXT.textLight,
      fontStyle: 'bold',
      wordWrap: { width: CARD_W - 12 },
      align: 'center',
    })
    nameText.setOrigin(0.5, 0)
    container.add(nameText)

    // Full effect description — the whole face is self-explanatory. Modal and
    // Sequence cards render every branch / step, so nothing reads as "Choose…".
    const effectLines = describeEffect(card.effect).join('\n')
    const effectText = scene.add.text(0, -CARD_H / 2 + 38, effectLines, {
      fontSize: '11px',
      lineSpacing: 2,
      color: TEXT.textLight,
      wordWrap: { width: CARD_W - 16 },
      align: 'center',
    })
    effectText.setOrigin(0.5, 0)
    container.add(effectText)
  } else {
    // World / Hazard card
    const worldCard = card as WorldCard

    // Name at top
    const nameText = scene.add.text(0, -CARD_H / 2 + 8, worldCard.name, {
      fontSize: '13px',
      color: TEXT.textLight,
      fontStyle: 'bold',
      wordWrap: { width: CARD_W - 12 },
      align: 'center',
    })
    nameText.setOrigin(0.5, 0)
    container.add(nameText)

    // Cost label + value (cost is the Progress needed to clear the Hazard)
    const costText = scene.add.text(0, -CARD_H / 2 + 40, String(worldCard.cost), {
      fontSize: '30px',
      color: TEXT.textCost,
      fontStyle: 'bold',
    })
    costText.setOrigin(0.5, 0)
    container.add(costText)
    const costLabel = scene.add.text(0, -CARD_H / 2 + 74, 'to clear', {
      fontSize: '8px',
      color: TEXT.textMuted,
    })
    costLabel.setOrigin(0.5, 0)
    container.add(costLabel)

    // Keywords
    if (worldCard.keywords.length > 0) {
      const kwText = scene.add.text(0, -CARD_H / 2 + 88, worldCard.keywords.join(' · '), {
        fontSize: '9px',
        color: TEXT.textKeyword,
      })
      kwText.setOrigin(0.5, 0)
      container.add(kwText)
    }

    // Penalty (on discard) then reward (on clear), as full sentences
    const penalty = describePenalty(worldCard.penalty)
    if (penalty !== '') {
      const penText = scene.add.text(0, CARD_H / 2 - 52, penalty, {
        fontSize: '9px',
        color: TEXT.textPenalty,
        wordWrap: { width: CARD_W - 16 },
        align: 'center',
      })
      penText.setOrigin(0.5, 1)
      container.add(penText)
    }

    const reward = describeReward(worldCard.reward)
    if (reward !== '') {
      const rewText = scene.add.text(0, CARD_H / 2 - 26, reward, {
        fontSize: '9px',
        color: TEXT.textReward,
        wordWrap: { width: CARD_W - 16 },
        align: 'center',
      })
      rewText.setOrigin(0.5, 1)
      container.add(rewText)
    }

    // Discard indicator
    if (worldCard.discardable) {
      const discText = scene.add.text(0, CARD_H / 2 - 10, 'click to discard', {
        fontSize: '8px',
        color: '#ffaa44',
        fontStyle: 'bold',
      })
      discText.setOrigin(0.5, 1)
      container.add(discText)
    }
  }

  // Store card id on the container for hit testing
  ;(container as Phaser.GameObjects.Container & { cardId: string }).cardId = card.id

  return container
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

export interface HUDRefs {
  hpText: Phaser.GameObjects.Text
  actText: Phaser.GameObjects.Text
  drawText: Phaser.GameObjects.Text
  worldText: Phaser.GameObjects.Text
}

/** Create HUD text objects at the top of the screen. */
export function createHUD(scene: Phaser.Scene): HUDRefs {
  const style = { fontSize: '14px', color: TEXT.textLight }
  const mutedStyle = { fontSize: '12px', color: TEXT.textMuted }

  const hpText = scene.add.text(12, 10, 'HP: —', { ...style, color: '#ff8888' })
  const actText = scene.add.text(120, 10, 'Act 1', style)
  const drawText = scene.add.text(220, 10, 'Draw: — | Discard: —', mutedStyle)
  const worldText = scene.add.text(440, 10, 'World: —', mutedStyle)

  return { hpText, actText, drawText, worldText }
}

/** Update HUD text to match the current GameState. */
export function updateHUD(refs: HUDRefs, state: GameState): void {
  refs.hpText.setText(`HP: ${state.hp}/20`)
  refs.actText.setText(`Act ${state.actIndex + 1}`)
  refs.drawText.setText(`Draw: ${state.playerDraw.length} | Discard: ${state.playerDiscard.length}`)
  const worldPile = state.worldDraw.length
  refs.worldText.setText(`World: ${worldPile}`)
}

// ---------------------------------------------------------------------------
// Win / loss screens
// ---------------------------------------------------------------------------

/** Create a full-screen win overlay (hidden by default). */
export function createWinScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const container = scene.add.container(450, 300)
  container.setVisible(false)

  const bg = scene.add.rectangle(0, 0, 900, 600, 0x000000, 0.8)
  container.add(bg)

  const text = scene.add.text(0, -30, 'YOU WIN', {
    fontSize: '72px',
    color: '#88ee88',
    fontStyle: 'bold',
  })
  text.setOrigin(0.5, 0.5)
  container.add(text)

  const sub = scene.add.text(0, 50, 'The world survived.', {
    fontSize: '20px',
    color: '#9aa3b2',
  })
  sub.setOrigin(0.5, 0.5)
  container.add(sub)

  return container
}

/** Create a full-screen loss overlay (hidden by default). */
export function createLossScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const container = scene.add.container(450, 300)
  container.setVisible(false)

  const bg = scene.add.rectangle(0, 0, 900, 600, 0x000000, 0.8)
  container.add(bg)

  const text = scene.add.text(0, -30, 'YOU LOSE', {
    fontSize: '72px',
    color: '#ff8888',
    fontStyle: 'bold',
  })
  text.setOrigin(0.5, 0.5)
  container.add(text)

  const sub = scene.add.text(0, 50, 'The world was lost.', {
    fontSize: '20px',
    color: '#9aa3b2',
  })
  sub.setOrigin(0.5, 0.5)
  container.add(sub)

  return container
}

// ---------------------------------------------------------------------------
// Interactive buttons
// ---------------------------------------------------------------------------

/** Create the End Turn button. */
export function createEndTurnButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Text {
  const btn = scene.add.text(x, y, '[ End Turn ]', {
    fontSize: '16px',
    color: '#88aaff',
    fontStyle: 'bold',
  })
  btn.setOrigin(0.5, 0.5)
  btn.setInteractive({ useHandCursor: true })
  return btn
}

/** Create a Cancel button (shown during active selections). */
export function createCancelButton(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const btn = scene.add.text(820, 560, '[ Cancel ]', {
    fontSize: '13px',
    color: '#ff8888',
  })
  btn.setOrigin(1, 1)
  btn.setInteractive({ useHandCursor: true })
  btn.setVisible(false)
  return btn
}

/** Create a Confirm button (shown during multi-select phases). */
export function createConfirmButton(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const btn = scene.add.text(820, 540, '[ Confirm ]', {
    fontSize: '13px',
    color: '#88ee88',
    fontStyle: 'bold',
  })
  btn.setOrigin(1, 1)
  btn.setInteractive({ useHandCursor: true })
  btn.setVisible(false)
  return btn
}

// ---------------------------------------------------------------------------
// Highlight helpers — called by TableScene after drawAll
// ---------------------------------------------------------------------------

/** Apply a coloured stroke to a card container to communicate its state. */
export function applyCardHighlight(
  container: Phaser.GameObjects.Container,
  kind: 'selected' | 'target' | 'discard' | 'none',
  frameStyle: FrameStyle,
): void {
  // The background rectangle is always the first child
  const bg = container.list[0] as Phaser.GameObjects.Rectangle | undefined
  if (bg === undefined) return
  switch (kind) {
    case 'selected':
      bg.setStrokeStyle(3, frameStyle.selectedBorder)
      break
    case 'target':
      bg.setStrokeStyle(3, frameStyle.targetBorder)
      break
    case 'discard':
      bg.setStrokeStyle(3, frameStyle.discardBorder)
      break
    case 'none':
      bg.setStrokeStyle(2, frameStyle.borderColor)
      break
  }
}

/** Dim a card that is not currently playable. */
export function dimCard(container: Phaser.GameObjects.Container, dim: boolean): void {
  container.setAlpha(dim ? TEXT.dimAlpha : 1.0)
}

