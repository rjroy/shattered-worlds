/**
 * Rarity tiers — pure data. No color, glyph, label, or other presentation
 * fields belong here; that lives in the renderer (`src/game`).
 */
export type RarityTier = "common" | "uncommon" | "rare" | "legendary" | "signature";

/**
 * The single canonical tier order, most to least common. Any cumulative-weight
 * walk over tiers must use this order so draws are reproducible regardless of
 * pool insertion order.
 */
export const RARITY_ORDER: readonly RarityTier[] = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "signature",
];

/**
 * Global per-tier weights. Alpha starting values, not a tuned economy — these
 * may be retuned without structural change. Weights are global; no pool,
 * world, surface, or effect may override them.
 */
export const RARITY_WEIGHTS: Record<RarityTier, number> = {
  common: 80, // 53% (no sig) with rarity 38%
  uncommon: 40, // 27% (no sig) with rarity 24%
  rare: 20, // 13% (no sig) with rarity 24%
  legendary: 10, // 7% (no sig) with rarity 14%
  // NOTE: Signature is a special weight that is intended to always be present.
  signature: 160,
};

export function compareRarity(lhs: RarityTier, rhs: RarityTier): number {
  const lhsIndex = RARITY_ORDER.findIndex((tier) => tier === lhs);
  const rhsIndex = RARITY_ORDER.findIndex((tier) => tier === rhs);
  return lhsIndex - rhsIndex;
}
