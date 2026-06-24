import { describe, expect, it } from "bun:test";
import { assembleCatalog } from "../model/catalog";
import { CatalogError } from "../model/errors";
import type { RawCardSource } from "../model/catalog";
import { CARD_CATALOG } from "../../data/worldManifest";

// ---------------------------------------------------------------------------
// 1. Merge completeness — unified catalog has all templates
// ---------------------------------------------------------------------------

describe("unified catalog completeness", () => {
  it("global catalog has the expected template count", () => {
    expect(Object.keys(CARD_CATALOG)).toHaveLength(132);
  });

  it("catalog contains all core starter and zombie-big-box template ids", () => {
    const expectedIds = [
      "Sprint",
      "Explore",
      "Barricade",
      "Med Kit",
      "Panic",
      "Adrenaline",
      "Baseball Bat",
      "Shotgun",
      "Regroup",
      "Summon Door",
      "Strange Sounds",
      "Rubble",
      "Screams",
      "Zombie",
      "Find Baseball Bat",
      "Find Shotgun",
      "Shelf Sweep",
      "Echoing Aisles",
      "Corpse",
      "The Walker",
      "Door",
    ];
    for (const id of expectedIds) {
      expect(CARD_CATALOG).toHaveProperty(id);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Collision detection
// ---------------------------------------------------------------------------

describe("assembleCatalog collision detection", () => {
  it("throws CatalogError when two sources share a templateId", () => {
    const sourceA: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        Sprint: {
          kind: "player",
          name: "Sprint",
          effect: { kind: "Heal", amount: 1 },
        },
      },
    };
    const sourceB: RawCardSource = {
      worldId: "world-b",
      cardTemplates: {
        Sprint: {
          kind: "player",
          name: "Sprint",
          effect: { kind: "Heal", amount: 2 },
        },
      },
    };
    expect(() => assembleCatalog([sourceA, sourceB])).toThrow(CatalogError);
  });

  it("CatalogError is instanceof CatalogError", () => {
    const sourceA: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        Clash: {
          kind: "player",
          name: "Clash",
          effect: { kind: "Heal", amount: 1 },
        },
      },
    };
    const sourceB: RawCardSource = {
      worldId: "world-b",
      cardTemplates: {
        Clash: {
          kind: "player",
          name: "Clash",
          effect: { kind: "Heal", amount: 1 },
        },
      },
    };
    let caught: unknown;
    try {
      assembleCatalog([sourceA, sourceB]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CatalogError);
  });

  it("single source with no duplicates does not throw", () => {
    const source: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        CardA: { kind: "player", name: "Card A", effect: { kind: "Heal", amount: 1 } },
        CardB: { kind: "player", name: "Card B", effect: { kind: "Heal", amount: 2 } },
      },
    };
    expect(() => assembleCatalog([source])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Rarity validation
// ---------------------------------------------------------------------------

describe("assembleCatalog rarity validation", () => {
  it("throws CatalogError when a template authors an invalid rarity value", () => {
    const source: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        Sprint: {
          kind: "player",
          name: "Sprint",
          effect: { kind: "Heal", amount: 1 },
          // JSON-authored data isn't compile-time type-checked, so this cast
          // simulates a bad value reaching assembleCatalog at runtime.
          rarity: "mythic" as never,
        },
      },
    };
    expect(() => assembleCatalog([source])).toThrow(CatalogError);
  });

  it("does not throw when rarity is omitted", () => {
    const source: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        Sprint: { kind: "player", name: "Sprint", effect: { kind: "Heal", amount: 1 } },
      },
    };
    expect(() => assembleCatalog([source])).not.toThrow();
  });

  it("does not throw when rarity is a valid tier", () => {
    const source: RawCardSource = {
      worldId: "world-a",
      cardTemplates: {
        Sprint: {
          kind: "player",
          name: "Sprint",
          effect: { kind: "Heal", amount: 1 },
          rarity: "uncommon",
        },
      },
    };
    expect(() => assembleCatalog([source])).not.toThrow();
  });
});
