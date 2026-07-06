import { hasRequiredFeat } from "../../data/unlocks/catalog";
import type { UnlockDefinition } from "../../data/unlocks/types";
import type { FeatsProfile } from "../runtime/featsProfile";

export type UnlockCardState = "owned" | "affordable" | "unaffordable" | "feat-locked";

export function unlockCardState(
  def: UnlockDefinition,
  purchased: readonly string[],
  balance: number,
  featsProfile: FeatsProfile,
): UnlockCardState {
  if (purchased.includes(def.id)) return "owned";
  if (!hasRequiredFeat(def, featsProfile)) return "feat-locked";
  return def.cost <= balance ? "affordable" : "unaffordable";
}
