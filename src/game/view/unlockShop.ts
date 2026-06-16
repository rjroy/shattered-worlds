import type { UnlockDefinition } from "../../data/unlocks/types";

export type UnlockCardState = "owned" | "affordable" | "unaffordable";

export function unlockCardState(
  def: UnlockDefinition,
  purchased: readonly string[],
  balance: number,
): UnlockCardState {
  if (purchased.includes(def.id)) return "owned";
  return def.cost <= balance ? "affordable" : "unaffordable";
}
