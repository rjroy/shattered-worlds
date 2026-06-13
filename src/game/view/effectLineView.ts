/**
 * Token-row effect renderer: lays out compiled `EffectLine[]` (the token IR
 * from `src/core/view/effectGlyphs.ts`) as icon images and short text runs on
 * a card face.
 *
 * The "decide what it looks like" half lives in `effectLineLayout.ts` (pure,
 * headless-tested); this file is the apply layer that constructs the Phaser
 * objects. CardView is the intended caller (Phase 3 of the token-IR design):
 *
 * - Player effect block:
 *     `addEffectLines(scene, compileEffect(card.effect), { maxWidth, baseColor, warnLabel: card.name })`
 * - World trigger block (Each turn / If discarded / Clear it / Partial clear):
 *     pass the trigger via `opts.leadIcon` — the renderer prepends it to the
 *     first line and hangs every following line indented under it (design §4).
 *
 * Vertical stacking contract: the returned container's (0, 0) is the TOP
 * CENTRE of the block; the caller positions it and advances its cursor by
 * `height + spacing`, replacing the old measure-the-Text-objects dance.
 */
import Phaser from 'phaser'
import type { EffectLine, IconId } from '../../core/view/effectGlyphs'
import { textStyle } from './presentation'
import { EFFECT_ROW } from './layout'
import {
  EFFECT_ICON_PLACEHOLDERS,
  EFFECT_ICON_TEXTURES,
  EFFECT_VALUE_GLOW,
  availableWidthFor,
  effectLineStyles,
  fitRowScale,
  layoutRowTokens,
  lineHeightOf,
  lineWarningText,
  normalizeTokenText,
  riderFontSize,
  stackLines,
  valueTokenStyle,
  withLeadIcon,
} from './effectLineLayout'

// ---------------------------------------------------------------------------
// Placeholder icon textures
// ---------------------------------------------------------------------------

/**
 * Register a generated placeholder texture (coloured disc + letter) for every
 * `IconId`, under exactly the keys in `EFFECT_ICON_TEXTURES`. Idempotent: keys
 * already present (eventually: real art loaded by the asset manifest behind
 * the same keys) are left untouched, and the texture manager is game-wide so
 * one registration outlives the scene.
 *
 * Called from TableScene.create() so the textures exist before any card
 * renders, and again lazily by `addEffectLines` as a safety net. Running at
 * create() time is a placement choice (it sits beside the scene's other
 * setup), not an engine constraint — the renderer and TextureManager boot
 * before preload() runs, so generation would work there too.
 */
export function ensureEffectIconTextures(scene: Phaser.Scene): void {
  const size = EFFECT_ROW.iconTextureSize
  for (const iconId of Object.keys(EFFECT_ICON_TEXTURES) as IconId[]) {
    const key = EFFECT_ICON_TEXTURES[iconId]
    if (scene.textures.exists(key)) continue
    const texture = scene.textures.createCanvas(key, size, size)
    // Defensive, unreachable guard: createCanvas returns null only on a key
    // collision, and the exists() check above just ruled that out (Phaser is
    // single-threaded, so the key cannot appear between the two calls).
    if (texture === null) continue
    drawPlaceholderIcon(texture.getContext(), iconId, size)
    texture.refresh()
  }
}

function drawPlaceholderIcon(
  ctx: CanvasRenderingContext2D,
  iconId: IconId,
  size: number,
): void {
  const { letter, color } = EFFECT_ICON_PLACEHOLDERS[iconId]
  const half = size / 2
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(half, half, half - 1, 0, Math.PI * 2)
  ctx.fill()
  // Dark letter on the coloured disc — readable on every hue in the palette.
  ctx.fillStyle = '#10131a'
  ctx.font = `bold ${Math.round(size * 0.6)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, half, half + 1)
}

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------

export interface EffectLinesOptions {
  /** Available block width; an over-wide row scales down to fit and warns. */
  maxWidth: number
  /** Colour for text tokens and unemphasised values, e.g. TEXT.textLight. */
  baseColor: string
  /** Token text px for main/branch lines (riders render smaller). Default EFFECT_ROW.fontSize. */
  fontSize?: number
  /** World-block trigger icon: leads the first line, later lines hang indented under it. */
  leadIcon?: IconId
  /** Per-row backing rectangle (the effect block's black backing on busy art). */
  background?: { color: number; alpha?: number }
  /** Name used in the overflow warning — pass the card name. */
  warnLabel?: string
}

export interface EffectLinesResult {
  container: Phaser.GameObjects.Container
  /** Total block height, always a whole pixel; the caller advances its stacking cursor by this. */
  height: number
}

/**
 * Build the icon+text rows for compiled effect lines. Each line becomes one
 * horizontally-centred row (an `Image` per icon token sized to the line
 * height, a `Text` per text/value token through the shared `textStyle()`
 * HiDPI factory), indented per role. All positions land on whole pixels —
 * fractional x smears small glyphs (see issue-blurry-transparent-text) — and
 * the returned `height` is rounded up to a whole pixel too, so the caller's
 * `currY += height + spacing` never propagates a fractional y to the blocks
 * stacked below.
 *
 * Empty input (a `None` effect compiles to no lines) returns an empty
 * container with height 0; callers can stack it unconditionally.
 *
 * Tween killability: the reconcile destruction pass kills tweens on the card
 * container and its direct children only — the rows and tokens inside this
 * container sit deeper, so callers (and future code) must never tween them
 * directly, or must kill tweens recursively if they do. No tweens exist on
 * them today.
 */
export function addEffectLines(
  scene: Phaser.Scene,
  lines: readonly EffectLine[],
  opts: EffectLinesOptions,
): EffectLinesResult {
  ensureEffectIconTextures(scene)

  const effectiveLines =
    opts.leadIcon === undefined ? [...lines] : withLeadIcon(lines, opts.leadIcon)
  const container = scene.add.container(0, 0)
  if (effectiveLines.length === 0) return { container, height: 0 }

  const baseFontSize = opts.fontSize ?? EFFECT_ROW.fontSize
  const styles = effectLineStyles(effectiveLines, {
    baseFontSize,
    riderFontSize: riderFontSize(baseFontSize),
    branchIndent: EFFECT_ROW.branchIndent,
    hangIndent: opts.leadIcon === undefined ? 0 : EFFECT_ROW.hangIndent,
  })

  // Build every row first; the measured line heights then drive the pure
  // vertical stack (per-row centres + total block height) in one computation.
  const builtRows = effectiveLines.map((line, index) => {
    // The ?? arm is unreachable: styles is index-aligned with lines.
    const style = styles[index] ?? { fontSize: baseFontSize, indent: 0 }
    return { line, style, ...buildRow(scene, line, style.fontSize, opts) }
  })
  const stack = stackLines(
    builtRows.map((built) => built.lineHeight),
    EFFECT_ROW.lineSpacing,
  )

  builtRows.forEach(({ line, style, row, rowWidth }, index) => {
    // The row's children centre on its origin, so place that origin at the
    // line's vertical centre — an overflow scale then shrinks the row toward
    // its own centre instead of dragging it upward.
    const centerY = stack.centers[index] ?? 0 // unreachable ??: centers is index-aligned with rows
    row.setPosition(Math.round(style.indent), Math.round(centerY))

    const available = availableWidthFor(style, opts.maxWidth)
    const scale = fitRowScale(rowWidth, available)
    if (scale < 1) {
      row.setScale(scale)
      console.warn(
        `[effectLineView] effect line wider than ${available}px on ${opts.warnLabel ?? 'card'}: ` +
          `"${lineWarningText(line)}" (${Math.ceil(rowWidth)}px) — scaled to fit`,
      )
    }

    container.add(row)
  })

  // Whole-pixel contract: ceil so the caller's stacking cursor stays integral.
  return { container, height: Math.ceil(stack.height) }
}

interface RowBuild {
  row: Phaser.GameObjects.Container
  rowWidth: number
  lineHeight: number
}

/** A token object slot: texts are built first (they set the line height). */
type TokenSlot = { kind: 'text'; text: Phaser.GameObjects.Text } | { kind: 'icon'; icon: IconId }

/**
 * Build one row container with its children centred on (0, 0). Two passes:
 * text tokens first, because the measured text height IS the line height
 * that icon tokens are then sized to. Icon-only lines (e.g. DestroySelf's
 * lone [vanish]) have no text to measure and fall back to a font-size-derived
 * height.
 */
function buildRow(
  scene: Phaser.Scene,
  line: EffectLine,
  fontSize: number,
  opts: EffectLinesOptions,
): RowBuild {
  const slots: TokenSlot[] = []
  let textHeight = 0
  for (const token of line.tokens) {
    if (token.kind === 'icon') {
      slots.push({ kind: 'icon', icon: token.icon })
      continue
    }
    const style =
      token.kind === 'value'
        ? valueTokenStyle(token.emphasis, opts.baseColor)
        : { color: opts.baseColor, glowColor: undefined }
    const text = scene.add.text(
      0,
      0,
      normalizeTokenText(token.text),
      textStyle({ fontSize: `${fontSize}px`, color: style.color }),
    )
    text.setOrigin(0.5, 0.5)
    if (style.glowColor !== undefined) {
      // The 'progress' emphasis glow — same treatment CardView applied per
      // line via string-sniffing, now driven by the emphasis field.
      text.preFX?.addGlow(style.glowColor, EFFECT_VALUE_GLOW.outer, EFFECT_VALUE_GLOW.inner)
    }
    textHeight = Math.max(textHeight, text.height)
    slots.push({ kind: 'text', text })
  }

  const lineHeight = lineHeightOf(textHeight, fontSize)

  // Second pass: icons sized to the line height, in original token order.
  const objects = slots.map((slot) =>
    slot.kind === 'text'
      ? slot.text
      : scene.add
          .image(0, 0, EFFECT_ICON_TEXTURES[slot.icon])
          .setDisplaySize(lineHeight, lineHeight),
  )

  const { rowWidth, centers } = layoutRowTokens(
    objects.map((obj) => obj.displayWidth),
    EFFECT_ROW.tokenGap,
  )

  const row = scene.add.container(0, 0)
  if (opts.background !== undefined && rowWidth > 0) {
    const bg = scene.add.rectangle(
      0,
      0,
      rowWidth + 6,
      lineHeight + 2,
      opts.background.color,
      opts.background.alpha ?? 0.5,
    )
    bg.setRounded(4)
    row.add(bg)
  }
  objects.forEach((obj, index) => {
    const center = centers[index]
    if (center === undefined) return // unreachable: centers is index-aligned with objects
    obj.setPosition(Math.round(-rowWidth / 2 + center), 0)
    row.add(obj)
  })

  return { row, rowWidth, lineHeight }
}
