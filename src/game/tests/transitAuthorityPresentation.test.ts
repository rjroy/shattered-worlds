import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CARD_CATALOG } from "../../data/worldManifest";
import { TRANSIT_AUTHORITY_THEME } from "../../data/worlds/transit-authority/theme";
import { assetManifest } from "../data/assetManifest";
import { selectTheme } from "../view/themes/themeManifest";

const BASE_KEYS = [
  "transit-authority-bg",
  "transit-authority-overlay",
  "transit-authority-cardfront",
] as const;
const INSET_KEYS = [
  "transit-inset-service-change",
  "transit-inset-platform-reassignment",
  "transit-inset-ticket-invalidated",
  "transit-inset-train-arrives-from-nowhere",
  "transit-inset-do-not-board-unknown-trains",
  "transit-inset-all-departures-suspended",
  "transit-inset-reissue-credentials",
  "transit-inset-entity-detected",
  "transit-inset-temporary-credentials",
  "transit-inset-express-transfer",
  "transit-inset-check-the-board",
  "transit-inset-board-anyway",
  "transit-inset-right-of-way",
] as const;

describe("Transit Authority presentation", () => {
  it("selects its palette, backdrop, overlay, and cardfront", () => {
    const theme = selectTheme("transit-authority");
    expect(theme).toEqual(TRANSIT_AUTHORITY_THEME);
    expect(theme.backdrop.realityKey).toBe("transit-authority-bg");
    expect(theme.backdrop.intrusionKey).toBe("transit-authority-overlay");
    expect(theme.worldCardfrontKey).toBe("transit-authority-cardfront");
  });

  it("resolves all base and inset keys through the asset manifest", () => {
    expect([...BASE_KEYS, ...INSET_KEYS].filter((key) => !(key in assetManifest))).toEqual([]);
    const catalogKeys = Object.values(CARD_CATALOG)
      .map((template) => template.insetKey)
      .filter((key): key is string => key?.startsWith("transit-inset-") === true)
      .sort();
    expect(catalogKeys).toEqual([...INSET_KEYS].sort());
  });

  it("documents prompts, filenames, finishing, and 100x100 validation", () => {
    const path = resolve("src/game/assets/themes/transit-authority/insets/README.md");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    for (const term of [
      "reroute",
      "Prompt template",
      "asset key",
      "Finishing pass",
      "100x100 contact sheet",
      "sodium-amber",
    ]) {
      expect(text).toContain(term);
    }
    for (const key of INSET_KEYS) expect(text).toContain(key);
  });
});
