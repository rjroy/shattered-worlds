import { describe, expect, it } from "bun:test";
import * as rarityModule from "../model/rarity";
import { RARITY_ORDER, RARITY_WEIGHTS } from "../model/rarity";

describe("RARITY_ORDER", () => {
  it("has exactly the five tiers, most to least common", () => {
    expect(RARITY_ORDER).toEqual(["common", "uncommon", "rare", "legendary", "signature"]);
  });
});

describe("RARITY_WEIGHTS", () => {
  it("has the alpha starting weight for every tier", () => {
    expect(RARITY_WEIGHTS).toHaveProperty("common");
    expect(RARITY_WEIGHTS).toHaveProperty("uncommon");
    expect(RARITY_WEIGHTS).toHaveProperty("rare");
    expect(RARITY_WEIGHTS).toHaveProperty("legendary");
    expect(RARITY_WEIGHTS).toHaveProperty("signature");
  });
});

describe("module surface", () => {
  it("exports only the tier order and weight table — no presentation data", () => {
    expect(Object.keys(rarityModule).sort()).toEqual(["RARITY_ORDER", "RARITY_WEIGHTS"]);
  });
});
