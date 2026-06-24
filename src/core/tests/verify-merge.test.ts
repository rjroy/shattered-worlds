import { describe, expect, it } from "bun:test";
import { assembleCatalog } from "../model/catalog";
import type { RawCardSource } from "../model/catalog";
import allCardsJson from "../../data/allCards.json";
import { CARD_CATALOG } from "../../data/worldManifest";

describe("unified catalog verification", () => {
  it("assembles without errors and has 131 templates", () => {
    const unified = allCardsJson as unknown as RawCardSource;
    expect(unified.cardTemplates).toBeDefined();
    const catalog = assembleCatalog([unified]);
    expect(Object.keys(catalog)).toHaveLength(131);
  });

  it("CARD_CATALOG matches the assembled unified file", () => {
    // CARD_CATALOG is loaded from allCards.json at import time. Verify it matches.
    const unified = allCardsJson as unknown as RawCardSource;
    const catalog = assembleCatalog([unified]);
    for (const [id, tpl] of Object.entries(catalog)) {
      expect(JSON.stringify(CARD_CATALOG[id])).toEqual(JSON.stringify(tpl));
    }
  });

  it("cross-references resolve within unified catalog", () => {
    const unified = allCardsJson as unknown as RawCardSource;
    const catalog = assembleCatalog([unified]);
    expect(catalog["Shadow Overhead"]?.kind).toBe("world");
    expect("Find Footing" in catalog).toBe(true);
  });

  it("has expected player/world counts", () => {
    const unified = allCardsJson as unknown as RawCardSource;
    const catalog = assembleCatalog([unified]);
    let playerCt = 0,
      worldCt = 0;
    for (const v of Object.values(catalog)) {
      if (v.kind === "player") playerCt++;
      else worldCt++;
    }
    expect(playerCt).toBe(67);
    expect(worldCt).toBe(64);
  });
});
