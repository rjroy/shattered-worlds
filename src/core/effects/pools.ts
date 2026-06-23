/**
 * Shared named-pool resolver (D1, rarity-system plan Step 6).
 *
 * A "pool" is a named list of candidate player-card template IDs. Boon sets
 * (`FORTUNE_BOON_POOLS`, authored alongside their card source in `src/data`) and loot
 * pools (`LOOT_POOLS`, authored here since they need no card-source pairing)
 * are the same shape — a pool carries no rarity data itself; the weighted-draw
 * kernel reads each template's rarity from the catalog at draw time.
 *
 * `OfferBoonHandler` and `GainRandomCardHandler` both resolve a `setId`
 * through `resolvePool` rather than reading either table directly, so the two
 * registries never drift apart. This resolver intentionally stays thin: it is
 * a single lookup, not a pool-management layer.
 */
import type { CardTemplateId } from "../model/types";
import { FORTUNE_BOON_POOLS } from "../../data/worldManifest";

/**
 * Resolves a `setId` to its candidate template IDs, checking boon sets first
 * and then loot pools. Returns `undefined` when no pool of either kind
 * matches — callers (OfferBoon, GainRandomCard) fail closed on `undefined`.
 */
export function resolvePool(setId: string): readonly CardTemplateId[] | undefined {
  return FORTUNE_BOON_POOLS[setId];
}
