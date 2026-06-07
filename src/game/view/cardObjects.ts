/**
 * Phaser factory and mutators for card containers — the card face, its
 * selection highlight, the world-card cost ring, and the hover emphasis.
 *
 * All functions are stateless: they create or mutate Phaser game objects but
 * never read or write GameState. The scene passes data in; nothing here holds a
 * reference to GameCore.
 */
import Phaser from 'phaser'
import type { Card, CardEffect, WorldCard } from '../../core/index'
import type { FrameStyle, VisualTheme } from './themes/theme'
import { describeEffect } from '../interaction/describe'
import type { HighlightKind } from '../interaction/highlight'
import {
  TEXT,
  textStyle,
  selectCardFrontKey,
  highlightDescriptor,
  costRingArc,
  emphasisDescriptor,
} from './presentation'

// ---------------------------------------------------------------------------
// Card dimensions
// ---------------------------------------------------------------------------

// Cards are sized to carry their full rules text on the face: the player face
// shows the whole describeEffect block (Modal/Sequence included), the Hazard
// face shows full onDiscarded/onCleared sentences. Six fit the 900px table.
const CARD_W = 150
const CARD_H = 196
const INSET_X = 0
const INSET_Y = 50
const INSET_W = 100
const INSET_H = 70

// ---------------------------------------------------------------------------
// Card object factory
// ---------------------------------------------------------------------------

interface CardTextOpts {
  fontSize: string
  color: string
  originY: number      // 0 = top-anchored, 1 = bottom-anchored
  bold?: boolean
  wrapWidth?: number   // when set, the text wraps at this width and centers
  lineSpacing?: number
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
    currY += text.height + (opts.lineSpacing ?? 0)  
    if (line.includes('Progress')) {
      lineText.preFX?.addGlow(TEXT.textCostInt, 0.8, 2)
    }
    container.add(lineText)
    return lineText
  })
}

/**
 * Add a bottom-anchored world-card effect block (onEndOfTurn / onDiscarded /
 * onCleared), each line carrying `prefix`. Skips effects with no content.
 */
function addEffectBlock(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  effect: CardEffect,
  prefix: string,
  y: number,
  color: string,
): void {
  if (effect.kind === 'None') return
  const lines = describeEffect(effect).map((l) => `${prefix}${l}`).join('\n')
  if (lines === '') return
  addCardText(scene, container, 0, y, lines, {
    fontSize: '9px',
    color,
    originY: 0,
    wrapWidth: CARD_W - 18,
  })
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
  const container = scene.add.container(x, y)

  // Card frame image: world cards use the theme-specific front if available
  const cardfrontKey = selectCardFrontKey(card, theme, resolveTheme)
  const cardImg = scene.add.image(0, 0, cardfrontKey)
  cardImg.setDisplaySize(CARD_W, CARD_H)
  container.add(cardImg)

  // Transparent overlay rectangle used only for selection highlight strokes.
  // list[1] — applyCardHighlight depends on this position.
  const bg = scene.add.rectangle(1, 1, CARD_W - 2, CARD_H - 2, 0x000000, 0)
  bg.setStrokeStyle(0)
  bg.setRounded(10)
  bg.setAlpha(0.4)
  container.add(bg)

  // Card inset image: if the template defines an insetKey, render the corresponding image on top of the cardfront. This is used for player cards' unique artwork, and world cards don't have insets at all.
  if ('insetKey' in card && card.insetKey && card.insetKey !== '') {
    const insetImg = scene.add.image(INSET_X, INSET_Y, card.insetKey)
    insetImg.setDisplaySize(INSET_W, INSET_H)
    container.add(insetImg)
  }

  // Name at top — identical for player and world cards.
  addCardText(scene, container, 0, -CARD_H / 2 + 8, card.name, {
    fontSize: '13px',
    color: TEXT.textLight,
    bold: true,
    wrapWidth: CARD_W - 12,
    originY: 0,
  })

  if (card.kind === 'player') {
    // Full effect description — the whole face is self-explanatory. Modal and
    // Sequence cards render every branch / step, so nothing reads as "Choose…".
    addCardText(scene, container, 0, -CARD_H / 2 + 28, describeEffect(card.effect).join('\n'), {
      fontSize: '11px',
      color: TEXT.textLight,
      originY: 0,
      wrapWidth: CARD_W - 16,
      lineSpacing: 2,
    })
  } else {
    // World / Hazard card
    const worldCard = card as WorldCard

    // Progress ring backing the cost digit. Added BEFORE the cost text so it
    // renders underneath it (the digit must stay readable on top), and AFTER
    // the cardfront image (list[0]) and highlight rectangle (list[1]) so the
    // applyCardHighlight list[1] contract holds. Persistent: stays in
    // container.list for its whole life so the reconcile's killTweensOf(list)
    // (and S5's tween) can find it. Centered on the cost digit's center.
    const costRing = scene.add.graphics()
    costRing.setPosition(CARD_W / 2 - 21, CARD_H / 2 - 21)
    container.add(costRing)
    ;(container as Phaser.GameObjects.Container & { costRing: Phaser.GameObjects.Graphics }).costRing =
      costRing

    // Cost label + value (cost is the Progress needed to clear the Hazard)
    addCardText(scene, container, CARD_W / 2 - 21, CARD_H / 2 - 21, String(worldCard.cost), {
      fontSize: '30px',
      color: TEXT.textCost,
      bold: true,
      originY: 0.5,
    })
    addCardText(scene, container, CARD_W / 2 - 21, CARD_H / 2 - 3, 'to clear', {
      fontSize: '8px',
      color: TEXT.textMuted,
      originY: 1,
    })

    // Keywords
    if (worldCard.keywords.length > 0) {
      addCardText(scene, container, 0, -CARD_H / 2 + 22, worldCard.keywords.join(' · '), {
        fontSize: '9px',
        color: TEXT.textKeyword,
        originY: 0,
      })
    }

    // onEndOfTurn (fires each turn while held), onDiscarded, onCleared — full sentences.
    addEffectBlock(scene, container, worldCard.onEndOfTurn, 'Each turn: ', -CARD_H / 2 + 74, TEXT.textHeld)
    addEffectBlock(scene, container, worldCard.onDiscarded, 'If discarded: ', -CARD_H / 2 + 54, TEXT.textPenalty)
    addEffectBlock(scene, container, worldCard.onCleared, 'Clear it: ', -CARD_H / 2 + 34, TEXT.textReward)

    // Discard indicator
    if (worldCard.discardable) {
      addCardText(scene, container, 0, 8, 'click to discard', {
        fontSize: '8px',
        color: '#ffaa44',
        bold: true,
        originY: 0,
      })
    }
  }

  // Store card id on the container for hit testing
  ;(container as Phaser.GameObjects.Container & { cardId: string }).cardId = card.id

  return container
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

// The scale (lift) and glow alpha magnitudes scale with intensity in
// emphasisDescriptor (presentation.ts). The fixed glow rectangle geometry above
// stays here because it feeds the draw call directly.

// The glow Graphics is stored on the container under this key (mirrors costRing)
// so it persists across reconcile cycles and stays inside container.list for the
// whole life of the container. The emphasis is static today (no tween is created),
// but keeping the glow in container.list means the destruction pass's
// killTweensOf(container.list) would reach any FUTURE tween added to it.
type EmphasisContainer = Phaser.GameObjects.Container & {
  targetGlow?: Phaser.GameObjects.Graphics
  emphasized?: boolean
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

  // The "how loud" decision (lift + glow alpha from intensity) is pure; this
  // function only pushes those magnitudes onto the container and glow.
  const { scale, glowAlpha } = emphasisDescriptor(intensity)

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
