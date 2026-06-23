import featsCatalogJson from "./catalog.json";
import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { FeatDefinition } from "./types";

export const FEAT_CATALOG: readonly FeatDefinition[] =
  featsCatalogJson as unknown as FeatDefinition[];

export function computeFragmentBalance(
  profile: FeatsProfile,
  catalog: readonly FeatDefinition[],
): number {
  let total = 0;

  for (const record of profile.earned) {
    const def = catalog.find((d) => d.id === record.featId);
    if (def === undefined) continue;

    for (const item of def.reward.items) {
      if (item.type === "memoryFragments") {
        total += item.amount;
      }
    }
  }

  return total;
}
