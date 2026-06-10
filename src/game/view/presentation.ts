/**
 * Pure presentation decisions for the table view.
 *
 * This module decides HOW something should look — which texture key, which
 * colour, what arc angle, how much to lift a card — and returns plain data. It
 * never constructs or mutates a Phaser game object, and it imports Phaser as a
 * TYPE only (`import type`), so importing this module does not boot the engine
 * or touch a DOM. That is the whole point: its tests run with no canvas, no
 * `window`, no preload.
 *
 * `render.ts` is the partner layer. It imports these decisions and pushes them
 * onto real Phaser objects (the "apply" wrappers and the object factories). If
 * you ever need a Phaser VALUE here, it belongs in `render.ts`, not this file —
 * one value import re-introduces the DOM tax for every test in the path.
 */
import type Phaser from 'phaser'
import type { Card } from '../../core/index'
import type { FrameStyle, VisualTheme } from './themes/theme'
import type { HighlightKind } from '../interaction/highlight'
export { CANVAS_W, CANVAS_H } from './layout'

// ---------------------------------------------------------------------------
// Text palette
// ---------------------------------------------------------------------------

// Text colors are theme-independent — all pass WCAG AA against the frame
// backgrounds used by every current theme.
export const TEXT = {
  textLight: '#e8eaf0',
  textMuted: '#b6c0d1',
  textCost: '#ffcc44',
  textKeyword: '#88ccff',
  textDisabled: '#555577',
  textPenalty: '#ff8888',
  textReward: '#88ee88',
  textHeld: '#ffaa66',
  textDiscard: '#ffaa44',
  textEnergy: '#ffeebb',
  bgEnergy: 0x002244,
  textHp: '#ff8888',
  dimAlpha: 0.35,
  textWorldTitle: '#d4c8e0',
  textWorldTag: '#c178bc',
  textWorldStory: '#b69fc7',
  background: '#2f2931',
}

export function getRealityPalette(
  theme: VisualTheme,
  index: keyof VisualTheme['realityPalette']
): string {
  
  const themeColor = theme.realityPalette[index] 
  if (themeColor === undefined) {
    switch (index) {
      case 'title':
        return TEXT.textLight
      case 'disabled':
        return TEXT.textDisabled
      case 'confirm':
        return TEXT.textReward
      case 'cancel':
        return TEXT.textPenalty
      case 'text':
      default:
        return TEXT.textMuted
    }
  }
  return themeColor
}


// ---------------------------------------------------------------------------
// Card texture selection
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
  const theme = resolveTheme(card.sourceWorldId) // seam: use result when per-player-world art is defined
  return theme.worldCardfrontKey ?? 'cardfront'
}

// ---------------------------------------------------------------------------
// Text style
// ---------------------------------------------------------------------------

/**
 * Device pixel ratio used to rasterize text. Phaser renders each Text object to
 * an internal canvas at this resolution; at the default of 1 the glyphs are
 * rasterized at one device-pixel per game-pixel, then bilinearly upscaled by
 * Scale.FIT (and again by a HiDPI display). The averaging that smear produces
 * reads as both haze (partial transparency) and blur, worst on the small fonts.
 * Guarded so the module stays usable in non-DOM test environments.
 */
function textResolution(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
}

/**
 * Build a Phaser text style with the device-appropriate render resolution.
 * Every text object in the renderer goes through here so DPI is set in one
 * place rather than on each scene.add.text call site. The resolution is forced
 * last so it always reflects the current device, never a caller override.
 */
export function textStyle(
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return { ...style, resolution: textResolution() }
}

// ---------------------------------------------------------------------------
// Card highlight styling
// ---------------------------------------------------------------------------

/**
 * Stroke + fill descriptor for a card's selection-highlight overlay rectangle.
 * `render.ts`'s `applyCardHighlight` pushes these four values onto the list[1]
 * rectangle; nothing else interprets them.
 */
export interface HighlightStyle {
  strokeWidth: number
  strokeColor: number
  fillColor: number
  fillAlpha: number
}

/**
 * Decide how a card's highlight overlay should look for a given selection state.
 *
 * Every non-committed kind returns a fully transparent fill (0x000000, alpha 0)
 * so a reused container never keeps a stale committed tint when it transitions
 * to another state. Only 'committed' carries a faint fill — the muted, steady
 * "already locked here" mark for an earlier-step pick that is no longer a live
 * legal target. It uses the dark `committedTarget` colour (distinct from the
 * bright `targetBorder`) so the card reads as marked-but-settled.
 */
export function highlightDescriptor(
  kind: HighlightKind,
  frameStyle: FrameStyle,
): HighlightStyle {
  const transparentFill = { fillColor: 0x000000, fillAlpha: 0 }
  switch (kind) {
    case 'selected':
      return { strokeWidth: 3, strokeColor: frameStyle.selectedBorder, ...transparentFill }
    case 'target':
      return { strokeWidth: 3, strokeColor: frameStyle.targetBorder, ...transparentFill }
    case 'discard':
      return { strokeWidth: 3, strokeColor: frameStyle.discardBorder, ...transparentFill }
    case 'committed':
      return {
        strokeWidth: 2,
        strokeColor: frameStyle.committedTarget,
        fillColor: frameStyle.committedTarget,
        fillAlpha: 0.18,
      }
    case 'none':
      // Width 0 means no stroke is drawn, so the stroke colour is irrelevant.
      return { strokeWidth: 0, strokeColor: 0, ...transparentFill }
  }
}

// ---------------------------------------------------------------------------
// Cost ring geometry
// ---------------------------------------------------------------------------

/**
 * The progress arc for a world card's cost ring: the clamped fraction plus the
 * start/end angles for a clockwise sweep. `render.ts`'s `drawCostRing` feeds
 * these straight into `ring.arc(...)`; only the angle math lives here, the
 * stroke/tween stay with the engine.
 */
export interface CostRingArc {
  clamped: number
  start: number
  end: number
}

/**
 * Compute the cost-ring arc for a fill `fraction`. The arc sweeps
 * `clamped * 2π` clockwise from the top of the circle (−π/2, 12 o'clock), so
 * the fill grows by ANGLE — the geometry is identical at cost 1 and cost 10.
 * A fraction of 0 (or less) yields `start === end`, i.e. no visible sweep; the
 * caller skips stroking the arc in that case.
 */
export function costRingArc(fraction: number): CostRingArc {
  const clamped = clampUnit(fraction)
  const start = -Math.PI / 2
  const end = start + clamped * Math.PI * 2
  return { clamped, start, end }
}

// ---------------------------------------------------------------------------
// Hover-target emphasis magnitude
// ---------------------------------------------------------------------------

// Magnitude scales with intensity ∈ [0,1]. At intensity 0 the emphasis is
// already clearly visible (base); at 1 it is at its loudest. These bound the
// scale-up and glow alpha so even a calm board shows an obvious hover read.
const EMPHASIS_SCALE_BASE = 1.06
const EMPHASIS_SCALE_RANGE = 0.20 // → up to 1.26 at full intensity
const EMPHASIS_GLOW_ALPHA_BASE = 0.45
const EMPHASIS_GLOW_ALPHA_RANGE = 0.45 // → up to 0.9 at full intensity

/**
 * How loud a hovered legal target should be: the container scale (lift) and the
 * glow halo alpha, both scaled by `intensity` ∈ [0,1]. `render.ts`'s
 * `emphasizeCard` applies the scale to the container and the alpha to the glow
 * stroke; the glow's fixed rectangle geometry stays with the draw call.
 */
export interface EmphasisStyle {
  scale: number
  glowAlpha: number
}

/** Compute the lift + glow magnitude for a given hover intensity. */
export function emphasisDescriptor(intensity: number): EmphasisStyle {
  const t = clampUnit(intensity)
  return {
    scale: EMPHASIS_SCALE_BASE + EMPHASIS_SCALE_RANGE * t,
    glowAlpha: EMPHASIS_GLOW_ALPHA_BASE + EMPHASIS_GLOW_ALPHA_RANGE * t,
  }
}

// ---------------------------------------------------------------------------
// Scalar helpers
// ---------------------------------------------------------------------------

/** Clamp a number to the unit interval [0, 1]. */
export function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n))
}
