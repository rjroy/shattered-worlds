/**
 * Renderer-only tier → visual map (REQ-RARITY-37).
 *
 * `RarityTier` is pure data in `src/core/model/rarity.ts` — no color, glyph,
 * or label belongs there. This module is the single place that decides what
 * a tier LOOKS like. Nothing here is imported by `src/core`; only the
 * `RarityTier` type crosses that boundary, into this file.
 *
 * Colors follow the same numeric-hex convention CardView/presentation.ts use
 * for Phaser stroke/fill calls (0xRRGGBB), not the CSS-string convention
 * `effectLineLayout.ts` uses for canvas-drawn icon placeholders — every
 * consumer here is a Graphics/Rectangle stroke, never a CSS style string.
 */
import type { RarityTier } from "../../core/index";

/** One tier's visual treatment: stroke color, optional glyph, and a label. */
export interface RarityStyle {
  /** Phaser numeric hex (0xRRGGBB) for the card-face rarity stroke. */
  color: number;
  /** Single-character mnemonic, e.g. for a future compact badge. Optional. */
  glyph?: string;
  /** Human-readable tier name for tooltips/labels. */
  label: string;
  glowStrength: number;
}

/**
 * Exhaustive per-tier styling. Bone/grey for Common (the "nothing special"
 * baseline), green for Uncommon, blue for Rare, gold/amber for Legendary —
 * the conventional rarity ramp, distinct from any in-theme frameStyle hue
 * (which varies per world) so a rarity stroke reads the same in every world.
 */
const RARITY_STYLES: Record<RarityTier, RarityStyle> = {
  common: { color: 0x9a958c, glyph: "C", label: "Common", glowStrength: 1 },
  uncommon: { color: 0x4caf50, glyph: "U", label: "Uncommon", glowStrength: 3 },
  rare: { color: 0x4a90d9, glyph: "R", label: "Rare", glowStrength: 5 },
  legendary: { color: 0xe0a526, glyph: "L", label: "Legendary", glowStrength: 7 },
  signature: { color: 0xe04826, glyph: "S", label: "Signature", glowStrength: 3 },
};

/** Common is the fallback treatment for any unknown/missing tier (REQ-RARITY-40). */
const FALLBACK_STYLE: RarityStyle = RARITY_STYLES.common;

/**
 * Resolve a tier's visual style. Never throws and never returns undefined —
 * a tier outside the known set (e.g. forward/backward data drift) silently
 * renders as Common rather than breaking the card face.
 */
export function rarityStyle(tier: RarityTier | undefined): RarityStyle {
  if (tier === undefined) return FALLBACK_STYLE;
  return RARITY_STYLES[tier] ?? FALLBACK_STYLE;
}

export function rarityTierShift(tier: RarityTier | undefined, delta: number): RarityTier {
  const rarityKeys = Object.keys(RARITY_STYLES) as RarityTier[];
  const index = rarityKeys.indexOf(tier ?? "uncommon");
  if (index === -1) return "uncommon";
  const newIndex = Math.min(Math.max(0, index + delta), rarityKeys.length - 1);
  if (!rarityKeys[newIndex]) return "uncommon";
  return rarityKeys[newIndex];
}
