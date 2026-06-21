/**
 * Shared named-pool resolver (D1, rarity-system plan Step 6).
 *
 * A "pool" is a named list of candidate player-card template IDs. Boon sets
 * (`BOON_SETS`, authored alongside their card source in `src/data`) and loot
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
import { BOON_SETS } from "../../data/worlds/boons/fortune";

/**
 * Loot pools for `GainRandomCard` (roll mode). Kept as a sibling table rather
 * than merged into `BOON_SETS` — that table is `as const satisfies
 * Record<string, BoonSetDefinition>` with closed literal keys, and a merge
 * would fight that typing for no benefit, since loot-pool templates don't
 * need a paired `RawCardSource` the way boon sets do (loot-pool cards are
 * authored as ordinary player cards in their owning world's card source).
 */
export const LOOT_POOLS = {
  // Generic cache-style reward for fog-beach-party's "Abandoned Cooler"
  // world card (D2, rarity-system plan Step 7). Templates are authored as
  // ordinary fog-beach-party player cards in that world's own cards.json —
  // they need no paired RawCardSource since the world source is already
  // merged into the catalog by worldManifest.ts.
  "fog-cooler-loot-v1": ["Barricade", "Half-Dead Spotlight", "Cooler Snacks", "Loaded Shotgun"],
  "bonfire-loot-v1": ["Flashlight", "Flare Gun", "Bonfire", "Searchlight"],
  "garden-center-loot-v1": ["Pruning Shears", "Machete", "Weed Killer", "Bloom"],
} as const satisfies Record<string, readonly CardTemplateId[]>;

/**
 * Resolves a `setId` to its candidate template IDs, checking boon sets first
 * and then loot pools. Returns `undefined` when no pool of either kind
 * matches — callers (OfferBoon, GainRandomCard) fail closed on `undefined`.
 */
export function resolvePool(setId: string): readonly CardTemplateId[] | undefined {
  const boonSet = BOON_SETS[setId as keyof typeof BOON_SETS];
  if (boonSet !== undefined) return boonSet.templateIds;

  const lootPool = LOOT_POOLS[setId as keyof typeof LOOT_POOLS];
  if (lootPool !== undefined) return lootPool;

  return undefined;
}
