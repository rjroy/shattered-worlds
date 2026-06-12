/**
 * CardView owns the Phaser objects for one card face, its selection highlight,
 * the world-card cost ring, and hover emphasis.
 *
 * The methods create or mutate Phaser game objects but never read or write
 * GameState. The scene passes data in; nothing here holds a reference to
 * GameCore. The exported functions at the bottom are compatibility wrappers
 * for older call sites and tests.
 */
import Phaser from 'phaser'
import type { Card, CardEffect, WorldCard } from '../../core/index'
import type { FrameStyle, VisualTheme } from './themes/theme'
import { describeEffect } from '../../core/view/describe'
import type { HighlightKind } from '../interaction/highlight'
import {
  TEXT,
  textStyle,
  selectCardFrontKey,
  highlightDescriptor,
  costRingArc,
  emphasisDescriptor,
} from './presentation'
import { CARD_FACE, TABLE_LAYOUT } from './layout'

// ---------------------------------------------------------------------------
// Card dimensions
// ---------------------------------------------------------------------------

// Cards are sized to carry their full rules text on the face: the player face
// shows the whole describeEffect block (Modal/Sequence included), the Hazard
// face shows full onDiscarded/onCleared sentences. Six fit the 900px table.
const CARD_W = CARD_FACE.width
const CARD_H = CARD_FACE.height
const INSET_X = CARD_FACE.inset.x
const INSET_Y = CARD_FACE.inset.y
const INSET_W = CARD_FACE.inset.width
const INSET_H = CARD_FACE.inset.height

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

function drawGlow(glow: Phaser.GameObjects.Graphics, color: number, alpha: number): void {
  glow.clear()
  const w = CARD_W + EMPHASIS_GLOW_PAD * 2
  const h = CARD_H + EMPHASIS_GLOW_PAD * 2
  glow.lineStyle(EMPHASIS_GLOW_LINE, color, alpha)
  glow.strokeRoundedRect(-w / 2, -h / 2, w, h, EMPHASIS_GLOW_RADIUS)
}

// ---------------------------------------------------------------------------
// Card object factory
// ---------------------------------------------------------------------------

interface CardTextOpts {
  fontSize: string
  font?: string
  color: string
  originY: number      // 0 = top-anchored, 1 = bottom-anchored
  bold?: boolean
  wrapWidth?: number   // when set, the text wraps at this width and centers
  lineSpacing?: number
  background?: number
  backgroundAlpha?: number
}

/** Add a horizontally-centered text line to a card container; returns it. */
function addCardText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  str: string,
  opts: CardTextOpts,
): Phaser.GameObjects.Text[] {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontSize: opts.fontSize,
    color: opts.color,
  }
  if (opts.font !== undefined) style.fontFamily = opts.font
  if (opts.bold === true) style.fontStyle = 'bold'
  if (opts.lineSpacing !== undefined) style.lineSpacing = opts.lineSpacing
  if (opts.wrapWidth !== undefined) {
    style.wordWrap = { width: opts.wrapWidth }
    style.align = 'center'
  }
  const text = scene.add.text(x, y, '', textStyle(style))
  text.setOrigin(0.5, opts.originY)
  const wrapped = text.getWrappedText(str)
  container.add(text)
  let currY = y
  return wrapped.map((line, i) => {
    const lineText = i == 0 ? text : scene.add.text(x, currY, '', textStyle(style))
    lineText.setText(line)
    lineText.setOrigin(0.5, opts.originY)
    currY += lineText.height + (opts.lineSpacing ?? 0)  
    if (line.includes('Progress')) {
      const textCostInt = Phaser.Display.Color.HexStringToColor(TEXT.textCost).color32
      lineText.preFX?.addGlow(textCostInt, 0.8, 0.8)
    }
    if (opts.background !== undefined) {
      const bg = scene.add.rectangle(
        lineText.x, lineText.y, lineText.width + 6, lineText.height + 2,
        opts.background, opts.backgroundAlpha ?? 0.5
      )
        .setOrigin(0.5, opts.originY)
        .setRounded(4)
      container.add(bg)
      container.add(lineText)
      lineText.setAbove(bg)
    } else {
      container.add(lineText)
    }
    return lineText
  })
}

/**
 * Add a bottom-anchored world-card effect block (onEndOfTurn / onDiscarded /
 * onCleared, onPartialClear), each line carrying `prefix`.
 * Skips effects with no content.
 */
function addEffectBlock(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  effect: CardEffect,
  prefix: string,
  y: number,
  color: string,
): Phaser.GameObjects.Text[] {
  if (effect.kind === 'None') return []
  const effectLines = describeEffect(effect)
  if (effectLines.length === 0) return []
  // apply prefix to the first line only.
  const lines = [prefix + effectLines[0], ...effectLines.slice(1)].join('\n')
  return addCardText(scene, container, 0, y, lines, {
    fontSize: '10px',
    color,
    originY: 0,
    wrapWidth: CARD_W - 18,
    background: 0x000000,
    backgroundAlpha: 0.8,
  })
}

/** Create a Phaser Container representing a single card (player or world). */
export class CardView extends Phaser.GameObjects.Container {
  readonly cardId: string

  private highlightRect: Phaser.GameObjects.Rectangle
  private costRing?: CostRing
  private targetGlow?: Phaser.GameObjects.Graphics
  private emphasized = false

  constructor(
    scene: Phaser.Scene,
    card: Card,
    x: number,
    y: number,
    theme: VisualTheme,
    resolveTheme: (worldId: string) => VisualTheme,
  ) {
    super(scene, x, y)
    scene.add.existing(this)
    this.cardId = card.id
    this.setDepth(TABLE_LAYOUT.cardDepth)

    // Card frame image: world cards use the theme-specific front if available.
    const cardfrontKey = selectCardFrontKey(card, theme, resolveTheme)
    const cardImg = scene.add.image(0, 0, cardfrontKey)
    cardImg.setDisplaySize(CARD_W, CARD_H)
    this.add(cardImg)

    // Transparent overlay rectangle used only for selection highlight strokes.
    const bg = scene.add.rectangle(1, 1, CARD_W - 2, CARD_H - 2, 0x000000, 0)
    bg.setStrokeStyle(0)
    bg.setRounded(10)
    bg.setAlpha(0.4)
    this.highlightRect = bg
    this.add(bg)

    // Card inset image: if the template defines an insetKey, render the
    // corresponding image on top of the cardfront. This is used for player
    // cards' unique artwork, and world cards don't have insets at all.
    if ('insetKey' in card && card.insetKey && card.insetKey !== '') {
      const insetImg = scene.add.image(INSET_X, INSET_Y, card.insetKey)
        .setOrigin(0.5, 1)
      const ratio = Math.max(INSET_W / insetImg.width, INSET_H / insetImg.height)
      insetImg.setDisplaySize(insetImg.width * ratio, insetImg.height * ratio)
      this.add(insetImg)
      const frame = scene.add.nineslice(INSET_X, INSET_Y, 'inset-frame', undefined,
        insetImg.width * ratio + 8, insetImg.height * ratio + 8,
        4, 4, 4, 4,
      ).setOrigin(0.5, 1)
      this.add(frame)
    }

    // Name at top — identical for player and world cards.
    addCardText(scene, this, 0, -CARD_H / 2 + 8, card.name, {
      fontSize: '13px',
      color: TEXT.textLight,
      bold: true,
      wrapWidth: CARD_W - 12,
      originY: 0,
    })

    if (card.kind === 'player') {
      // Keywords — same 9px line the world face uses, at the same offset, so a
      // Spore card is identifiable in hand (REQ-MALL-21).
      const hasKeywords = card.keywords.length > 0
      if (hasKeywords) {
        addCardText(scene, this, 0, -CARD_H / 2 + 23, card.keywords.join(' · '), {
          fontSize: '9px',
          color: TEXT.textKeyword,
          originY: 0,
        })
      }

      // Full effect description — the whole face is self-explanatory. Modal and
      // Sequence cards render every branch / step, so nothing reads as "Choose...".
      // A keyword line pushes the block down to the world face's effect offset
      // so the two never collide; keywordless cards keep the original layout.
      addCardText(scene, this, 0, -CARD_H / 2 + (hasKeywords ? 36 : 28), describeEffect(card.effect).join('\n'), {
        fontSize: '11px',
        color: TEXT.textLight,
        originY: 0,
        wrapWidth: CARD_W - 16,
        lineSpacing: 2,
        background: 0x000000,
      })

      // Energy cost badge: only for cards with energyCost > 0.
      if (card.energyCost > 0) {
        const badgeBg = scene.add.image(CARD_W / 2 - 16, -CARD_H / 2 + 16, 'energy-icon')
        badgeBg.setDisplaySize(28, 28)
        this.add(badgeBg)

        addCardText(scene, this, CARD_W / 2 - 16, -CARD_H / 2 + 16, String(card.energyCost), {
          fontSize: '16px',
          color: TEXT.textEnergy,
          bold: true,
          originY: 0.5,
        })
      }

      // Exhaust badge: the flag lives on the card (not the effect), so it cannot
      // come through describeEffect.
      if (card.exhaust === true) {
        addCardText(scene, this, 0, CARD_H / 2 - 8, 'Exhaust', {
          fontSize: '9px',
          color: TEXT.textKeyword,
          bold: true,
          originY: 1,
          background: 0x000000,
        })
      }
    } else {
      const worldCard = card as WorldCard

      // Progress ring backing the cost digit.
      const costRing = scene.add.graphics() as CostRing
      costRing.setPosition(CARD_W / 2 - 21, CARD_H / 2 - 21)
      this.costRing = costRing
      this.add(costRing)

      // Cost label + value (cost is the Progress needed to clear the Hazard).
      addCardText(scene, this, CARD_W / 2 - 21, CARD_H / 2 - 21, String(worldCard.cost), {
        fontSize: '30px',
        color: TEXT.textCost,
        bold: true,
        originY: 0.5,
      })
      addCardText(scene, this, CARD_W / 2 - 21, CARD_H / 2 - 3, 'to clear', {
        fontSize: '8px',
        color: TEXT.textMuted,
        originY: 1,
      })

      // Keywords.
      if (worldCard.keywords.length > 0) {
        addCardText(scene, this, 0, -CARD_H / 2 + 23, worldCard.keywords.join(' · '), {
          fontSize: '9px',
          color: TEXT.textKeyword,
          originY: 0,
        })
      }

      // onEndOfTurn, onDiscarded, onCleared — full sentences.
      const effectLineSpacing = 4
      let currY = -CARD_H / 2 + 36
      const onEnd = addEffectBlock(scene, this, worldCard.onEndOfTurn, 'Each turn: ', currY, TEXT.textHeld)
      currY = onEnd.reduce((highest, text) => Math.max(highest, text.y + text.height + effectLineSpacing), currY)
      const onDiscarded = addEffectBlock(scene, this, worldCard.onDiscarded, 'If discarded: ', currY, TEXT.textPenalty)
      currY = onDiscarded.reduce((highest, text) => Math.max(highest, text.y + text.height + effectLineSpacing), currY)
      const onCleared = addEffectBlock(scene, this, worldCard.onCleared, 'Clear it: ', currY, TEXT.textReward)
      currY = onCleared.reduce((highest, text) => Math.max(highest, text.y + text.height + effectLineSpacing), currY)
      addEffectBlock(scene, this, worldCard.onPartialClear, 'Partial clear: ', currY, TEXT.textPenalty)

      // Discard indicator.
      if (worldCard.discardable) {
        addCardText(scene, this, 0, CARD_H / 2 - 22, 'click to discard', {
          fontSize: '9px',
          color: TEXT.textDiscard,
          bold: true,
          originY: 0,
          background: 0x000000,
        })
      }
    }
  }

  /** Apply a coloured stroke to communicate this card's selection state. */
  applyHighlight(kind: HighlightKind, frameStyle: FrameStyle): void {
    const { strokeWidth, strokeColor, fillColor, fillAlpha } = highlightDescriptor(kind, frameStyle)
    this.highlightRect.setFillStyle(fillColor, fillAlpha)
    this.highlightRect.setStrokeStyle(strokeWidth, strokeColor)
  }

  /** Dim a card that is not currently playable. */
  setDimmed(dim: boolean): void {
    this.setAlpha(dim ? TEXT.dimAlpha : 1.0)
  }

  /** Animate a world card's progress ring toward `fraction` of a full circle. */
  updateCostRing(fraction: number, ringAccent: number): void {
    if (this.costRing === undefined) return
    updateRingObject(this.scene, this.costRing, fraction, ringAccent)
  }

  /** Make this hovered legal target the loudest card on the board. */
  emphasize(glowColor: number, intensity: number): void {
    if (this.emphasized) return

    const { scale, glowAlpha } = emphasisDescriptor(intensity)
    this.setScale(scale)
    const glow = this.obtainGlow()
    glow.setVisible(true)
    drawGlow(glow, glowColor, glowAlpha)
    this.emphasized = true
    this.setDepth(TABLE_LAYOUT.cardHoverDepth)
  }

  /** Restore base transform: scale 1, glow hidden/cleared, emphasis off. */
  clearEmphasis(): void {
    this.setScale(1)
    if (this.targetGlow !== undefined) {
      this.targetGlow.clear()
      this.targetGlow.setVisible(false)
    }
    this.emphasized = false
    this.setDepth(TABLE_LAYOUT.cardDepth)
  }

  /** Re-assert this card's base position. */
  setCardPosition(x: number, y: number): void {
    this.setPosition(x, y)
  }

  private obtainGlow(): Phaser.GameObjects.Graphics {
    if (this.targetGlow !== undefined) return this.targetGlow
    const glow = this.scene.add.graphics()
    this.add(glow)
    this.targetGlow = glow
    return glow
  }
}

/** Create a Phaser Container representing a single card (player or world). */
export function createCardObject(
  scene: Phaser.Scene,
  card: Card,
  x: number,
  y: number,
  theme: VisualTheme,
  resolveTheme: (worldId: string) => VisualTheme,
): Phaser.GameObjects.Container {
  return new CardView(scene, card, x, y, theme, resolveTheme)
}

// ---------------------------------------------------------------------------
// Highlight — called by TableScene after drawAll
// ---------------------------------------------------------------------------

/**
 * Apply a coloured stroke to a card container to communicate its state. The
 * "decide what it looks like" half lives in `highlightDescriptor`; this wrapper
 * only pushes that descriptor onto the list[1] overlay rectangle.
 */
export function applyCardHighlight(
  container: Phaser.GameObjects.Container,
  kind: HighlightKind,
  frameStyle: FrameStyle,
): void {
  if (container instanceof CardView) {
    container.applyHighlight(kind, frameStyle)
    return
  }

  // The highlight rectangle is list[1] (list[0] is the cardfront image)
  const bg = container.list[1] as Phaser.GameObjects.Rectangle | undefined
  if (bg === undefined) return
  const { strokeWidth, strokeColor, fillColor, fillAlpha } = highlightDescriptor(kind, frameStyle)
  bg.setFillStyle(fillColor, fillAlpha)
  bg.setStrokeStyle(strokeWidth, strokeColor)
}

// ---------------------------------------------------------------------------
// Cost ring (S5) — world-card progress arc
// ---------------------------------------------------------------------------

// Ring geometry — shared by the snap path and the tween onUpdate so a tweened
// frame is drawn byte-for-byte the same as a snapped one.
const RING_RADIUS = 18
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
  ring.fillStyle(ringAccent, 0.08)
  ring.fillCircle(0, 0, RING_RADIUS - RING_LINE_WIDTH / 2)

  // Angle math (clamp + clockwise sweep from the top) lives in costRingArc.
  const { clamped, start, end } = costRingArc(fraction)
  if (clamped <= 0) return

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
  if (container instanceof CardView) {
    container.updateCostRing(fraction, ringAccent)
    return
  }

  const ring = (container as Phaser.GameObjects.Container & { costRing?: CostRing }).costRing
  if (ring === undefined) return
  updateRingObject(scene, ring, fraction, ringAccent)
}

function updateRingObject(
  scene: Phaser.Scene,
  ring: CostRing,
  fraction: number,
  ringAccent: number,
): void {
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


