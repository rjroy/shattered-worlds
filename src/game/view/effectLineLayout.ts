/**
 * Pure layout decisions for the token-row effect renderer.
 *
 * This module decides HOW a compiled effect line should look — which texture
 * key an icon resolves to, what indent a role earns, which colour a value
 * token gets, how a row centers and when it must shrink — and returns plain
 * data. It never constructs or mutates a Phaser game object, so its tests run
 * headless with no canvas and no preload (the same property `presentation.ts`
 * keeps; `effectLineView.ts` is the partner layer that pushes these decisions
 * onto real Phaser objects).
 *
 * It consumes the token IR from `src/core/view/effectGlyphs.ts` as types only.
 */
import type {
  EffectLine,
  IconId,
  ValueEmphasis,
} from "../../core/view/effectGlyphs";
import { EFFECT_ROW } from "./layout";
import { TEXT } from "./presentation";

// ---------------------------------------------------------------------------
// IconId → texture key
// ---------------------------------------------------------------------------

/**
 * The exhaustive icon-to-texture map. `Record<IconId, string>` is the seam
 * that makes icon art swappable: adding an `IconId` in core without an entry
 * here is a compile error, never a Phaser missing-texture error at runtime.
 * Real art replaces the generated placeholders behind these same keys with
 * zero core changes.
 */
export const EFFECT_ICON_TEXTURES: Record<IconId, string> = {
  progress: "effect-icon-progress",
  progressAll: "effect-icon-progress-all",
  draw: "effect-icon-draw",
  worldDraw: "effect-icon-world-draw",
  hp: "effect-icon-hp",
  energy: "energy-icon",
  discard: "effect-icon-discard",
  destroy: "effect-icon-destroy",
  exile: "effect-icon-exile",
  return: "effect-icon-return",
  addCard: "effect-icon-add-card",
  threat: "effect-icon-threat",
  brace: "power-brace",
  skipDraw: "effect-icon-skip-draw",
  survive: "effect-icon-survive",
  vanish: "effect-icon-vanish",
  eachTurn: "effect-icon-each-turn",
  onDiscard: "effect-icon-on-discard",
  onClear: "effect-icon-on-clear",
  onPartialClear: "effect-icon-on-partial-clear",
};

/** How a placeholder icon texture is drawn: a coloured disc + one letter. */
export interface IconPlaceholderSpec {
  /** Single character painted on the disc (a mnemonic, not the final art). */
  letter: string;
  /** Disc fill, CSS hex. Hues are distinct per icon so cards stay readable. */
  color: string;
}

/**
 * Placeholder drawing specs, exhaustive like the texture map. The trigger
 * icons reuse their block's row tint (eachTurn → textHeld orange, onDiscard →
 * penalty pink, onClear → reward green) so the placeholder already reads as
 * part of its block.
 */
export const EFFECT_ICON_PLACEHOLDERS: Record<IconId, IconPlaceholderSpec> = {
  progress: { letter: "P", color: "#f4c542" },
  progressAll: { letter: "A", color: "#f0822e" },
  draw: { letter: "D", color: "#7fb4f0" },
  worldDraw: { letter: "W", color: "#b48ff0" },
  hp: { letter: "H", color: "#e0566a" },
  energy: { letter: "E", color: "#ffe97a" },
  discard: { letter: "C", color: "#c9a36a" },
  destroy: { letter: "X", color: "#b03a2e" },
  exile: { letter: "L", color: "#8a4fbf" },
  return: { letter: "R", color: "#4fbf8a" },
  addCard: { letter: "+", color: "#5ad0d0" },
  threat: { letter: "T", color: "#d05a9c" },
  brace: { letter: "B", color: "#8fa3b8" },
  skipDraw: { letter: "K", color: "#7a7f8a" },
  survive: { letter: "S", color: "#8fc97f" },
  vanish: { letter: "V", color: "#d8d8e0" },
  eachTurn: { letter: "U", color: "#ffaa66" },
  onDiscard: { letter: "O", color: "#ff8888" },
  onClear: { letter: "Y", color: "#88ee88" },
  onPartialClear: { letter: "%", color: "#d97b5e" },
};

// ---------------------------------------------------------------------------
// Role styling
// ---------------------------------------------------------------------------

/** Font size + horizontal indent for one compiled line. */
export interface EffectLineStyle {
  fontSize: number;
  /** Px the centred row shifts right of the block's centre line. */
  indent: number;
}

export interface EffectLineGeometry {
  /** Token text px for main/branch lines. */
  baseFontSize: number;
  /** Token text px for rider lines (smaller — bonus clauses). */
  riderFontSize: number;
  /** Extra indent for Modal 'branch' lines. */
  branchIndent: number;
  /** Indent for lines hanging under a leading trigger icon; 0 when none. */
  hangIndent: number;
}

/** Rider lines drop two px from the base size, floored so text stays legible. */
export function riderFontSize(baseFontSize: number): number {
  return Math.max(7, baseFontSize - 2);
}

/**
 * Decide per-line font size and indent from the lines' roles.
 *
 * - `main` (or undefined role): base size, no indent.
 * - `branch`: base size, indented under its Modal header.
 * - `rider`: smaller size, at the indent of the line PRECEDING it — a rider
 *   after a branch indents with that branch, keeping bonus clauses visually
 *   bound to their owner (design §2 rider binding). Consecutive riders all
 *   bind to the same owning line.
 * - When a trigger icon leads the first line (world blocks), every following
 *   line hangs indented under it by `hangIndent` (design §4). The hang is a
 *   FLOOR for riders too: a rider bound to the first line hangs under its
 *   text rather than sitting flush with the trigger icon, and a rider bound
 *   to a hung branch keeps the larger hang+branch indent (design §2).
 */
export function effectLineStyles(
  lines: readonly EffectLine[],
  geometry: EffectLineGeometry,
): EffectLineStyle[] {
  const styles: EffectLineStyle[] = [];
  let owningIndent = 0;
  lines.forEach((line, index) => {
    const hang = index > 0 ? geometry.hangIndent : 0;
    if (line.role === "rider") {
      styles.push({
        fontSize: geometry.riderFontSize,
        indent: Math.max(owningIndent, hang),
      });
      return;
    }
    const indent = hang + (line.role === "branch" ? geometry.branchIndent : 0);
    styles.push({ fontSize: geometry.baseFontSize, indent });
    owningIndent = indent;
  });
  return styles;
}

// ---------------------------------------------------------------------------
// Value emphasis
// ---------------------------------------------------------------------------

/**
 * Glow FX strengths for `emphasis: 'progress'` values — the same magnitudes
 * CardView's per-line Progress glow used, now driven by the emphasis field.
 */
export const EFFECT_VALUE_GLOW = { outer: 0.8, inner: 0.8 } as const;

/** Colour (and optional glow) decision for a value token. */
export interface ValueTokenStyle {
  color: string;
  /** When set, the renderer adds a glow FX in this 24-bit colour. */
  glowColor?: number;
}

/**
 * Decide how a value token is weighted: 'progress' keeps the base colour but
 * earns the golden cost-coloured glow; 'reward'/'penalty' tint; no emphasis
 * renders as plain base-coloured text.
 */
export function valueTokenStyle(
  emphasis: ValueEmphasis | undefined,
  baseColor: string,
): ValueTokenStyle {
  switch (emphasis) {
    case "progress":
      return { color: baseColor, glowColor: hexToInt(TEXT.textCost) };
    case "reward":
      return { color: TEXT.textReward };
    case "penalty":
      return { color: TEXT.textPenalty };
    case undefined:
      return { color: baseColor };
  }
}

/** '#ffcc44' → 0xffcc44. Inputs are the module's own palette, always #rrggbb. */
function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

// ---------------------------------------------------------------------------
// Row layout
// ---------------------------------------------------------------------------

/** Horizontal placement of a row's tokens, before centring. */
export interface RowLayout {
  /** Total row width including inter-token gaps. */
  rowWidth: number;
  /** Centre x of each token, measured from the row's left edge. */
  centers: number[];
}

/** Lay out token widths left-to-right with a fixed gap between neighbours. */
export function layoutRowTokens(
  widths: readonly number[],
  gap: number,
): RowLayout {
  let cursor = 0;
  const centers: number[] = [];
  for (const width of widths) {
    if (centers.length > 0) cursor += gap;
    centers.push(cursor + width / 2);
    cursor += width;
  }
  return { rowWidth: cursor, centers };
}

/**
 * Scale factor that fits an over-wide row into the available width. 1 when it
 * already fits; rows never clip — a compression bug degrades visibly (cramped)
 * and the renderer warns about it.
 */
export function fitRowScale(rowWidth: number, availableWidth: number): number {
  if (rowWidth <= 0 || rowWidth <= availableWidth) return 1;
  return Math.max(0, availableWidth) / rowWidth;
}

/**
 * Width a row may occupy before it must shrink. An indented row keeps its
 * centre `indent` right of the block's centre line, so it loses `indent` of
 * clearance on BOTH sides of the symmetric `maxWidth`.
 */
export function availableWidthFor(
  style: EffectLineStyle,
  maxWidth: number,
): number {
  return maxWidth - 2 * style.indent;
}

// ---------------------------------------------------------------------------
// Vertical stacking
// ---------------------------------------------------------------------------

/**
 * Height of one rendered line. Text tokens dominate: the measured text height
 * (from the renderer's real Text objects) IS the line height. Icon-only lines
 * (e.g. DestroySelf's lone [vanish]) have no text to measure, so they fall
 * back to a font-size-derived height (`iconOnlyHeightFactor` keeps the disc
 * roughly the size text would have been).
 */
export function lineHeightOf(
  measuredTextHeight: number,
  fontSize: number,
): number {
  if (measuredTextHeight > 0) return measuredTextHeight;
  return Math.round(fontSize * EFFECT_ROW.iconOnlyHeightFactor);
}

/** Vertical placement of a block's stacked rows. */
export interface LineStack {
  /** Centre y of each row, measured down from the block's top. */
  centers: number[];
  /** Total block height: line heights plus spacing between (never after) lines. */
  height: number;
}

/** Stack line heights top-to-bottom with a fixed spacing between neighbours. */
export function stackLines(
  lineHeights: readonly number[],
  lineSpacing: number,
): LineStack {
  let cursor = 0;
  const centers: number[] = [];
  for (const lineHeight of lineHeights) {
    if (centers.length > 0) cursor += lineSpacing;
    centers.push(cursor + lineHeight / 2);
    cursor += lineHeight;
  }
  return { centers, height: cursor };
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Prepend a leading trigger icon token to the first line (world-card blocks).
 * Empty input stays empty — a `None` block never renders a naked trigger icon.
 * Pure: the input lines are not mutated.
 */
export function withLeadIcon(
  lines: readonly EffectLine[],
  iconId: IconId,
): EffectLine[] {
  const [first, ...rest] = lines;
  if (first === undefined) return [];
  return [
    { ...first, tokens: [{ kind: "icon", icon: iconId }, ...first.tokens] },
    ...rest,
  ];
}

/**
 * Normalize glyphs the card font may not carry. Core emits a true minus
 * (U+2212) in damage values; the face's default font stack (Phaser's Courier
 * fallback chain) is not guaranteed to carry that glyph on every platform,
 * and a missing glyph falls back to a different font with different metrics.
 * The renderer flattens it to an ASCII hyphen; core keeps the proper minus
 * for prose consumers.
 */
export function normalizeTokenText(text: string): string {
  return text.replace(/−/g, "-");
}

/** Human-readable line content for the overflow `console.warn`. */
export function lineWarningText(line: EffectLine): string {
  return line.tokens
    .map((token) => (token.kind === "icon" ? `[${token.icon}]` : token.text))
    .join(" ");
}
