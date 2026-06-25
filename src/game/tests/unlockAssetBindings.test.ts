import { describe, expect, it } from "bun:test";
import { UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import { assetManifest } from "../data/assetManifest";

describe("unlock asset bindings", () => {
  it("binds every catalog unlock icon in assetManifest", () => {
    const missing = UNLOCK_CATALOG.map((def) => `unlock/${def.id}`).filter(
      (key) => !(key in assetManifest),
    );

    expect(missing).toEqual([]);
  });
});
