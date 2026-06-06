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
import { describeEffect } from './describe'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Select the texture key for a card's front face.
 * World card: keyed by the active world's theme.
 * Player card: keyed by the card's sourceWorldId (seam for future per-world
 * player art). No theme currently defines a player-card front, so this always
 * returns 'cardfront'. The resolveTheme call is the seam — wired but unused
 * today so future per-world player art slots in without API changes.
 */
export function selectCardFrontKey(
  card: Card,
  activeTheme: VisualTheme,
  resolveTheme: (worldId: string) => VisualTheme,
): string {
  if (card.kind === 'world') {
    return activeTheme.worldCardfrontKey ?? 'cardfront'
  }
  // Player card: resolve theme by sourceWorldId. worldCardfrontKey is the
  // world CARD front, not the player card front. Player cards use 'cardfront'
  // (generic) until per-player-world art ships.
  void resolveTheme(card.sourceWorldId) // seam: use result when per-player-world art is defined
  return 'cardfront'
}

// ---------------------------------------------------------------------------
// Card dimensions and palette
// ---------------------------------------------------------------------------

// Cards are sized to carry their full rules text on the face: the player face
// shows the whole describeEffect block (Modal/Sequence included), the Hazard
// face shows full onDiscarded/onCleared sentences. Six fit the 900px table.
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
  textHeld: '#ffaa66',
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
  resolveTheme: (worldId: string) => VisualTheme,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)

  // Card frame image: world cards use the theme-specific front if available
  const cardfrontKey = selectCardFrontKey(card, theme, resolveTheme)
  const cardImg = scene.add.image(0, 0, cardfrontKey)
  cardImg.setDisplaySize(CARD_W, CARD_H)
  container.add(cardImg)

  // Transparent overlay rectangle used only for selection highlight strokes.
  // list[1] — applyCardHighlight depends on this position.
  const bg = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0)
  bg.setStrokeStyle(0)
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

    // Progress ring backing the cost digit. Added BEFORE the cost text so it
    // renders underneath it (the digit must stay readable on top), and AFTER
    // the cardfront image (list[0]) and highlight rectangle (list[1]) so the
    // applyCardHighlight list[1] contract holds. Persistent: stays in
    // container.list for its whole life so the reconcile's killTweensOf(list)
    // (and S5's tween) can find it. Centered on the cost digit's center.
    const costCenterY = -CARD_H / 2 + 40 + 30 / 2 // text top y + half the 30px font height
    const costRing = scene.add.graphics()
    costRing.setPosition(0, costCenterY)
    container.add(costRing)
    ;(container as Phaser.GameObjects.Container & { costRing: Phaser.GameObjects.Graphics }).costRing =
      costRing

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

    // onEndOfTurn (fires each turn while held), onDiscarded, onCleared — as full sentences
    if (worldCard.onEndOfTurn.kind !== 'None') {
      const heldLines = describeEffect(worldCard.onEndOfTurn).map((l) => `Each turn: ${l}`).join('\n')
      const heldText = scene.add.text(0, CARD_H / 2 - 78, heldLines, {
        fontSize: '9px',
        color: TEXT.textHeld,
        wordWrap: { width: CARD_W - 16 },
        align: 'center',
      })
      heldText.setOrigin(0.5, 1)
      container.add(heldText)
    }

    if (worldCard.onDiscarded.kind !== 'None') {
      const penaltyText = describeEffect(worldCard.onDiscarded)
        .map((l) => `If discarded: ${l}`)
        .join('\n')
      const penText = scene.add.text(0, CARD_H / 2 - 52, penaltyText, {
        fontSize: '9px',
        color: TEXT.textPenalty,
        wordWrap: { width: CARD_W - 16 },
        align: 'center',
      })
      penText.setOrigin(0.5, 1)
      container.add(penText)
    }

    if (worldCard.onCleared.kind !== 'None') {
      const rewardText = describeEffect(worldCard.onCleared)
        .map((l) => `Clear it: ${l}`)
        .join('\n')
      if (rewardText !== '') {
        const rewText = scene.add.text(0, CARD_H / 2 - 26, rewardText, {
          fontSize: '9px',
          color: TEXT.textReward,
          wordWrap: { width: CARD_W - 16 },
          align: 'center',
        })
        rewText.setOrigin(0.5, 1)
        container.add(rewText)
      }
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
  const style = { fontSize: '14px', color: TEXT.textLight, backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 4, y: 2 } }
  const mutedStyle = { fontSize: '12px', color: TEXT.textMuted, backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 4, y: 2 }  }

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
  container.setDepth(1000)
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
  container.setDepth(1000)
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: { x: 6, y: 4 },
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: { x: 6, y: 4 },
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: { x: 6, y: 4 },
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
  kind: 'selected' | 'target' | 'discard' | 'committed' | 'none',
  frameStyle: FrameStyle,
): void {
  // The highlight rectangle is list[1] (list[0] is the cardfront image)
  const bg = container.list[1] as Phaser.GameObjects.Rectangle | undefined
  if (bg === undefined) return
  // The overlay rect is fill-transparent by default; only 'committed' tints it.
  // Clear any prior committed fill so a reused container never keeps a stale
  // tint when it transitions to another state (reconcile re-applies each cycle).
  bg.setFillStyle(0x000000, 0)
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
    case 'committed':
      // Muted, steady "already locked here" mark for an earlier-step pick that
      // is no longer a live legal target. Uses the dark committedTarget colour
      // (distinct from the bright targetBorder) and adds a faint matching fill
      // so the card stays read as marked-but-settled — no lift, no glow (those
      // belong to the active hover emphasis applied separately in S9).
      bg.setStrokeStyle(2, frameStyle.committedTarget)
      bg.setFillStyle(frameStyle.committedTarget, 0.18)
      break
    case 'none':
      bg.setStrokeStyle(0)
      break
  }
}

// Ring geometry — shared by the snap path and the tween onUpdate so a tweened
// frame is drawn byte-for-byte the same as a snapped one.
const RING_RADIUS = 22
const RING_LINE_WIDTH = 3

// Fill/drain share one duration and easing so banking and the end-of-turn
// reset read as a single clock moving in opposite directions (FEEDBACK-8).
const RING_TWEEN_DURATION = 300
const RING_TWEEN_EASE = 'Sine.easeInOut'

// Below this delta, target and displayed fraction are treated as equal: the
// call is a no-op (no tween restart, no jitter) so calling updateCostRing every
// reconcile cycle with the same target is idempotent.
const RING_FRACTION_EPSILON = 0.001

// The ring Graphics also carries the fraction it is currently DISPLAYING (the
// tweened value, not the target). Stored on the object so it survives across
// reconcile cycles and a fresh tween can interpolate from wherever the last one
// left off (banking up, then draining back to 0, are the same clock).
type CostRing = Phaser.GameObjects.Graphics & { displayedFraction?: number }

/** Draw the ring arc for an exact fraction. Pure given (ring, fraction). */
function drawCostRing(ring: Phaser.GameObjects.Graphics, fraction: number, ringAccent: number): void {
  ring.clear()

  // Faint full-circle track so the ring reads even at low progress.
  ring.lineStyle(RING_LINE_WIDTH, ringAccent, 0.18)
  ring.strokeCircle(0, 0, RING_RADIUS)

  const clamped = Math.min(1, Math.max(0, fraction))
  if (clamped <= 0) return

  // Arc from the top (−π/2), sweeping clockwise by clamped * 2π.
  const start = -Math.PI / 2
  const end = start + clamped * Math.PI * 2
  ring.lineStyle(RING_LINE_WIDTH, ringAccent, 1)
  ring.beginPath()
  ring.arc(0, 0, RING_RADIUS, start, end, false)
  ring.strokePath()
}

/**
 * Animate a world card's progress ring toward `fraction` of a full circle.
 *
 * The arc sweeps `fraction * 2π` clockwise from the top (12 o'clock), so the
 * fill grows by ANGLE, not by element count — the geometry is identical at cost
 * 1 and cost 10 (the boss). No-op for any container without a `costRing`
 * (player cards), which never get one.
 *
 * Banking progress (target rises) and the end-of-turn reset (target 0) are the
 * SAME tween in opposite directions, because the ring persists across reconcile
 * cycles (S3). The ring's currently displayed fraction is stored on the ring
 * object; each call interpolates from there to the new target.
 *
 * First render for a ring (no prior displayed value) snaps with no animation.
 * A target equal (within epsilon) to the displayed fraction is a no-op, so
 * calling this every cycle with an unchanged target never restarts the tween.
 *
 * Killability (ties to the S3 destruction pass): the tween targets the RING
 * GRAPHICS OBJECT itself, which is a child in `container.list`. The reconcile's
 * `killTweensOf(container.list)` (and `killTweensOf(container)`) therefore finds
 * and kills any in-flight ring tween BEFORE `container.destroy()`. Nothing here
 * tweens a detached proxy object that the destruction pass couldn't reach, so
 * onUpdate can never fire on a destroyed Graphics. No Tween reference is
 * retained across cycles (no `updateTo` on a recycled tween): each change does
 * `killTweensOf(ring)` then `scene.tweens.add`.
 */
export function updateCostRing(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  fraction: number,
  ringAccent: number,
): void {
  const ring = (container as Phaser.GameObjects.Container & { costRing?: CostRing }).costRing
  if (ring === undefined) return

  const target = Math.min(1, Math.max(0, fraction))
  const displayed = ring.displayedFraction

  // First render for this ring: snap, record, no animation.
  if (displayed === undefined) {
    ring.displayedFraction = target
    drawCostRing(ring, target, ringAccent)
    return
  }

  // Idempotent: unchanged target must not restart the tween or jitter.
  if (Math.abs(target - displayed) < RING_FRACTION_EPSILON) return

  // Kill any in-flight ring tween before starting a new one. Targeting the ring
  // object (not a retained Tween, not a free proxy) keeps the S3 destruction
  // pass able to cancel this tween, and lets the new tween start from wherever
  // the last one left off.
  scene.tweens.killTweensOf(ring)
  scene.tweens.add({
    targets: ring,
    displayedFraction: target,
    duration: RING_TWEEN_DURATION,
    ease: RING_TWEEN_EASE,
    onUpdate: () => {
      drawCostRing(ring, ring.displayedFraction ?? target, ringAccent)
    },
    onComplete: () => {
      // Settle exactly on target so float drift never leaves a partial arc.
      ring.displayedFraction = target
      drawCostRing(ring, target, ringAccent)
    },
  })
}

/** Dim a card that is not currently playable. */
export function dimCard(container: Phaser.GameObjects.Container, dim: boolean): void {
  container.setAlpha(dim ? TEXT.dimAlpha : 1.0)
}

// ---------------------------------------------------------------------------
// Hover-target emphasis (S9) — the loudest read on the board
// ---------------------------------------------------------------------------

// Emphasis geometry. The glow is a rounded rectangle stroked OUTSIDE the card
// edge so it reads as a halo, not a border (the 3px target border lives on the
// list[1] rectangle and stays untouched). Lift + glow together make the hovered
// legal target unmistakable beyond a colour change.
const EMPHASIS_GLOW_PAD = 7 // px the glow ring extends past the card edge
const EMPHASIS_GLOW_LINE = 6 // glow stroke width
const EMPHASIS_GLOW_RADIUS = 10 // rounded-corner radius

// Magnitude scales with intensity() ∈ [0,1]. At intensity 0 the emphasis is
// already clearly visible (base); at 1 it is at its loudest. These bound the
// scale-up and glow alpha so even a calm board shows an obvious hover read.
const EMPHASIS_SCALE_BASE = 1.06
const EMPHASIS_SCALE_RANGE = 0.06 // → up to 1.12 at full intensity
const EMPHASIS_GLOW_ALPHA_BASE = 0.45
const EMPHASIS_GLOW_ALPHA_RANGE = 0.45 // → up to 0.9 at full intensity

// The glow Graphics is stored on the container under this key (mirrors costRing)
// so it persists across reconcile cycles and stays inside container.list for the
// whole life of the container. The emphasis is static today (no tween is created),
// but keeping the glow in container.list means the destruction pass's
// killTweensOf(container.list) would reach any FUTURE tween added to it.
type EmphasisContainer = Phaser.GameObjects.Container & {
  targetGlow?: Phaser.GameObjects.Graphics
  emphasized?: boolean
}

function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Lazily create the glow child, appended AFTER all existing children. */
function obtainGlow(
  scene: Phaser.Scene,
  container: EmphasisContainer,
): Phaser.GameObjects.Graphics {
  if (container.targetGlow !== undefined) return container.targetGlow
  const glow = scene.add.graphics()
  // Appended last: list[0]=cardfront and list[1]=highlight rectangle are never
  // disturbed (applyCardHighlight's list[1] contract holds). Kept in the list
  // for life so a FUTURE tween on it would be reachable by
  // killTweensOf(container.list); no tween is created today.
  container.add(glow)
  container.targetGlow = glow
  return glow
}

function drawGlow(glow: Phaser.GameObjects.Graphics, color: number, alpha: number): void {
  glow.clear()
  const w = CARD_W + EMPHASIS_GLOW_PAD * 2
  const h = CARD_H + EMPHASIS_GLOW_PAD * 2
  glow.lineStyle(EMPHASIS_GLOW_LINE, color, alpha)
  glow.strokeRoundedRect(-w / 2, -h / 2, w, h, EMPHASIS_GLOW_RADIUS)
}

/**
 * Make the hovered legal target the loudest card on the board: lift it (scale
 * up) AND draw a `targetGlow` halo ring around it. Both magnitudes scale with
 * `intensity` ∈ [0,1] (completes FEEDBACK-12: S2 added the colour seam, this is
 * the intensity-scaled-emphasis half).
 *
 * Distinct from the legal-but-unhovered `target` state (a 3px border only, no
 * scale, no halo) and from the dimmed non-target state (alpha 0.35, no scale);
 * an emphasized card is both larger and ringed.
 *
 * The emphasis is static: a one-shot scale lift plus a drawn glow halo. No tween
 * is created, so nothing animates or pulses.
 *
 * Idempotent: re-calling on an already-emphasized container with the same
 * intensity is a no-op (guarded by the `emphasized` flag) so a reused container
 * repainted every cycle never re-applies the scale/glow. The glow Graphics lives
 * as a child in container.list for the container's life, so the S3 destruction
 * pass's killTweensOf(container.list) would reach any FUTURE tween added to it;
 * no Tween reference is created or retained today.
 */
export function emphasizeCard(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  glowColor: number,
  intensity: number,
): void {
  const c = container as EmphasisContainer
  if (c.emphasized === true) return // idempotent: already loud, don't re-apply

  const t = clampUnit(intensity)
  const scale = EMPHASIS_SCALE_BASE + EMPHASIS_SCALE_RANGE * t
  const glowAlpha = EMPHASIS_GLOW_ALPHA_BASE + EMPHASIS_GLOW_ALPHA_RANGE * t

  container.setScale(scale)
  const glow = obtainGlow(scene, c)
  glow.setVisible(true)
  drawGlow(glow, glowColor, glowAlpha)
  c.emphasized = true
}

/**
 * Restore a container's base transform: scale 1, glow hidden/cleared, emphasis
 * flag cleared. Safe to call on a never-emphasized container (no-op-ish). Owned
 * by S9 — called on pointer-out AND by the per-cycle update path when a hovered
 * card is no longer a legal target.
 */
export function clearEmphasis(container: Phaser.GameObjects.Container): void {
  const c = container as EmphasisContainer
  container.setScale(1)
  if (c.targetGlow !== undefined) {
    c.targetGlow.clear()
    c.targetGlow.setVisible(false)
  }
  c.emphasized = false
}

/**
 * Re-assert a card's base position. Called every drawAll() cycle for both reused
 * and freshly-created containers so a card that moved within its row lands at its
 * new slot. Position is mutable per cycle; the card face (createCardObject) is not.
 * No tween — the reconcile sets x/y directly (a later phase may animate movement).
 */
export function positionCard(container: Phaser.GameObjects.Container, x: number, y: number): void {
  container.setPosition(x, y)
}

