import { describe, expect, it } from "bun:test";

import { UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import type { FeatsProfile } from "../runtime/featsProfile";
import { unlockCardState } from "./unlockShop";

const extraHp = UNLOCK_CATALOG.find((def) => def.id === "extra-hp")!;
const starterHarvester = UNLOCK_CATALOG.find((def) => def.id === "starter-harvester")!;

const noFeats: FeatsProfile = { version: 1, earned: [] };
const withEmberOrchardClear: FeatsProfile = {
  version: 1,
  earned: [{ featId: "first-the-ember-orcharc", earnedAt: 1, sessionId: "s" }],
};

describe("unlockCardState", () => {
  it("returns owned when purchased, even if the card is unaffordable", () => {
    expect(unlockCardState(extraHp, ["extra-hp"], 0, noFeats)).toBe("owned");
  });

  it("returns affordable when cost is below or equal to balance", () => {
    expect(unlockCardState(extraHp, [], 15, noFeats)).toBe("affordable");
    expect(unlockCardState(extraHp, [], 16, noFeats)).toBe("affordable");
  });

  it("returns unaffordable when cost exceeds balance", () => {
    expect(unlockCardState(extraHp, [], 14, noFeats)).toBe("unaffordable");
  });

  it("returns feat-locked when the required feat has not been earned, even if affordable", () => {
    expect(unlockCardState(starterHarvester, [], 999, noFeats)).toBe("feat-locked");
  });

  it("returns affordable once the required feat has been earned", () => {
    expect(unlockCardState(starterHarvester, [], 999, withEmberOrchardClear)).toBe("affordable");
  });

  it("returns owned once purchased, regardless of feat requirement", () => {
    expect(unlockCardState(starterHarvester, ["starter-harvester"], 0, noFeats)).toBe("owned");
  });
});
