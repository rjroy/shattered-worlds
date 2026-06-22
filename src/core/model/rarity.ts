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
  common: 50,
  uncommon: 30,
  rare: 13,
  legendary: 7,
  // NOTE: Signature is a special weight that is intended for 1 world card per set.
  //       EX: Zombie
  signature: 100,
};
