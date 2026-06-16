import { describe, expect, it } from "bun:test";

import { UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import { unlockCardState } from "./unlockShop";

const extraHp = UNLOCK_CATALOG.find((def) => def.id === "extra-hp")!;

describe("unlockCardState", () => {
  it("returns owned when purchased, even if the card is unaffordable", () => {
    expect(unlockCardState(extraHp, ["extra-hp"], 0)).toBe("owned");
  });

  it("returns affordable when cost is below or equal to balance", () => {
    expect(unlockCardState(extraHp, [], 15)).toBe("affordable");
    expect(unlockCardState(extraHp, [], 16)).toBe("affordable");
  });

  it("returns unaffordable when cost exceeds balance", () => {
    expect(unlockCardState(extraHp, [], 14)).toBe("unaffordable");
  });
});
