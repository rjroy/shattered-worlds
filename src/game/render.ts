/**
 * Phaser 3 factory and update functions for the table view.
 *
 * All functions are stateless — they create or mutate Phaser game objects but
 * never read or write GameState directly. The scene passes data in; nothing
 * here has a reference to GameCore.
 */
import Phaser from 'phaser'
import type { Card, GameState, WorldCard } from '../core/index'

// ---------------------------------------------------------------------------
// Card dimensions and palette
// ---------------------------------------------------------------------------

const CARD_W = 120
const CARD_H = 160

const COLORS = {
  playerBg: 0x1a2a4a,
  worldBg: 0x3a1a1a,
  border: 0x445566,
  selectedBorder: 0xffee44,
  targetBorder: 0x44ee44,
  discardBorder: 0xff8800,
  dimAlpha: 0.35,
  textLight: '#e8eaf0',
  textMuted: '#9aa3b2',
  textCost: '#ffcc44',
  textKeyword: '#88ccff',
  textPenalty: '#ff8888',
  textReward: '#88ee88',
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
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)

  const bg = scene.add.rectangle(
    0,
    0,
    CARD_W,
    CARD_H,
    card.kind === 'player' ? COLORS.playerBg : COLORS.worldBg,
  )
  bg.setStrokeStyle(2, COLORS.border)
  container.add(bg)

  if (card.kind === 'player') {
    // Card name at top
    const nameText = scene.add.text(0, -CARD_H / 2 + 10, card.name, {
      fontSize: '11px',
      color: COLORS.textLight,
      fontStyle: 'bold',
      wordWrap: { width: CARD_W - 8 },
      align: 'center',
    })
    nameText.setOrigin(0.5, 0)
    container.add(nameText)

    // Effect summary at bottom
    const effectSummary = summariseEffect(card.effect)
    const effectText = scene.add.text(0, CARD_H / 2 - 30, effectSummary, {
      fontSize: '9px',
      color: COLORS.textMuted,
      wordWrap: { width: CARD_W - 8 },
      align: 'center',
    })
    effectText.setOrigin(0.5, 1)
    container.add(effectText)

    // Type label
    const typeText = scene.add.text(0, 0, 'PLAYER', {
      fontSize: '8px',
      color: '#667799',
      fontStyle: 'bold',
    })
    typeText.setOrigin(0.5, 0.5)
    container.add(typeText)
  } else {
    // World / Hazard card
    const worldCard = card as WorldCard

    // Name at top
    const nameText = scene.add.text(0, -CARD_H / 2 + 10, worldCard.name, {
      fontSize: '11px',
      color: COLORS.textLight,
      fontStyle: 'bold',
      wordWrap: { width: CARD_W - 8 },
      align: 'center',
    })
    nameText.setOrigin(0.5, 0)
    container.add(nameText)

    // Cost in large font center
    const costText = scene.add.text(0, -10, String(worldCard.cost), {
      fontSize: '32px',
      color: COLORS.textCost,
      fontStyle: 'bold',
    })
    costText.setOrigin(0.5, 0.5)
    container.add(costText)

    // Keywords below cost
    if (worldCard.keywords.length > 0) {
      const kwText = scene.add.text(0, 24, worldCard.keywords.join(' · '), {
        fontSize: '8px',
        color: COLORS.textKeyword,
      })
      kwText.setOrigin(0.5, 0)
      container.add(kwText)
    }

    // Penalty at bottom-left
    const penText = scene.add.text(-CARD_W / 2 + 4, CARD_H / 2 - 14, penaltyLabel(worldCard.penalty), {
      fontSize: '8px',
      color: COLORS.textPenalty,
    })
    penText.setOrigin(0, 1)
    container.add(penText)

    // Reward at bottom-right
    const rewText = scene.add.text(CARD_W / 2 - 4, CARD_H / 2 - 14, rewardLabel(worldCard.reward), {
      fontSize: '8px',
      color: COLORS.textReward,
    })
    rewText.setOrigin(1, 1)
    container.add(rewText)

    // Discard indicator
    if (worldCard.discardable) {
      const discText = scene.add.text(0, CARD_H / 2 - 28, 'DISCARD', {
        fontSize: '7px',
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
  const style = { fontSize: '14px', color: COLORS.textLight }
  const mutedStyle = { fontSize: '12px', color: COLORS.textMuted }

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
): void {
  // The background rectangle is always the first child
  const bg = container.list[0] as Phaser.GameObjects.Rectangle | undefined
  if (bg === undefined) return
  switch (kind) {
    case 'selected':
      bg.setStrokeStyle(3, COLORS.selectedBorder)
      break
    case 'target':
      bg.setStrokeStyle(3, COLORS.targetBorder)
      break
    case 'discard':
      bg.setStrokeStyle(3, COLORS.discardBorder)
      break
    case 'none':
      bg.setStrokeStyle(2, COLORS.border)
      break
  }
}

/** Dim a card that is not currently playable. */
export function dimCard(container: Phaser.GameObjects.Container, dim: boolean): void {
  container.setAlpha(dim ? COLORS.dimAlpha : 1.0)
}

// ---------------------------------------------------------------------------
// Internal label helpers
// ---------------------------------------------------------------------------

function summariseEffect(effect: import('../core/index').Effect): string {
  switch (effect.kind) {
    case 'DealProgress': {
      const bonus = effect.bonus ? ` (+${effect.bonus.amount} vs ${effect.bonus.tag})` : ''
      return `Progress ${effect.base}${bonus}`
    }
    case 'Draw':
      return [
        effect.player !== undefined ? `Draw ${effect.player}` : '',
        effect.world !== undefined ? `World +${effect.world}` : '',
      ]
        .filter(Boolean)
        .join(' / ')
    case 'Heal':
      return `Heal ${effect.amount}`
    case 'ReturnWorldCards':
      return `Return ${effect.min}–${effect.max} world`
    case 'DestroyCardInHand':
      return 'Destroy 0–1 hand'
    case 'DiscardThenDraw':
      return `Discard ${effect.player}, draw`
    case 'AddCard':
      return `Add ${effect.template}`
    case 'AddWorldCardToTop':
      return `World top: ${effect.template}`
    case 'Modal':
      return 'Choose…'
    case 'Sequence':
      return 'Multi-step'
  }
}

function penaltyLabel(penalty: import('../core/index').Penalty): string {
  switch (penalty.kind) {
    case 'Damage':
      return `-${penalty.amount}hp`
    case 'SkipDrawNextTurn':
      return 'Skip draw'
    case 'GainCard':
      return `+${penalty.template}`
    case 'AddWorldCardToTop':
      return `+W:${penalty.template}`
    case 'None':
      return ''
  }
}

function rewardLabel(reward: import('../core/index').Reward): string {
  switch (reward.kind) {
    case 'GainCard':
      return `+${reward.template}`
    case 'AddPlayerCardToTop':
      return `+P:${reward.template}`
    case 'AddWorldCardToTop':
      return `+W:${reward.template}`
    case 'SurviveWorld':
      return 'Survive'
    case 'None':
      return ''
  }
}
