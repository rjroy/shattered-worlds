import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CARD_CATALOG } from "../../data/worldManifest";
import { NEW_DERELICT_THEME } from "../../data/worlds/new-derelict/theme";
import { assetManifest } from "../data/assetManifest";
import { selectTheme } from "../view/themes/themeManifest";

const BASE_KEYS = ["new-derelict-bg", "new-derelict-overlay", "new-derelict-cardfront"] as const;
const INSET_KEYS = [
  "derelict-inset-bulkhead-7-c-seals",
  "derelict-inset-unfinished-captains-address",
  "derelict-inset-gravity-priority-shift",
  "derelict-inset-administrative-misfile",
  "derelict-inset-corridor-becomes-lifeboat",
  "derelict-inset-systems-panel",
  "derelict-inset-the-order-arrives",
  "derelict-inset-emergency-route",
  "derelict-inset-override-badge",
  "derelict-inset-manual-release",
  "derelict-inset-follow-the-checklist",
] as const;

describe("New Derelict presentation", () => {
  it("selects its palette, backdrop, overlay, and cardfront", () => {
    const theme = selectTheme("new-derelict");
    expect(theme).toEqual(NEW_DERELICT_THEME);
    expect(theme.backdrop.realityKey).toBe("new-derelict-bg");
    expect(theme.backdrop.intrusionKey).toBe("new-derelict-overlay");
    expect(theme.worldCardfrontKey).toBe("new-derelict-cardfront");
  });

  it("resolves all base and inset keys through the asset manifest", () => {
    expect([...BASE_KEYS, ...INSET_KEYS].filter((key) => !(key in assetManifest))).toEqual([]);
    const catalogKeys = Object.values(CARD_CATALOG)
      .map((template) => template.insetKey)
      .filter((key): key is string => key?.startsWith("derelict-inset-") === true)
      .sort();
    expect(catalogKeys).toEqual([...INSET_KEYS].sort());
  });

  it("documents prompts, filenames, finishing, and 100x100 validation", () => {
    const path = resolve("src/game/assets/themes/new-derelict/insets/README.md");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    for (const term of [
      "isolate",
      "Prompt template",
      "asset key",
      "Finishing pass",
      "100x100 contact sheet",
      "violet-white",
    ]) {
      expect(text).toContain(term);
    }
    for (const key of INSET_KEYS) expect(text).toContain(key);
  });
});
