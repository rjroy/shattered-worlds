import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assetManifest } from "../data/assetManifest";
import { formatAppliedKeywords } from "../view/CardView";
import { selectTheme } from "../view/themes/themeManifest";
import { CARD_CATALOG } from "../../data/worldManifest";
import { EDEN_PRIME_THEME } from "../../data/worlds/eden-prime/theme";
import { Card } from "../../core";

const WORLD_ID = "eden-prime";
const EDEN_BASE_KEYS = ["eden-prime-bg", "eden-prime-overlay", "eden-prime-cardfront"] as const;
const EDEN_INSET_KEYS = [
  "eden-inset-fruit-offered-too-quickly",
  "eden-inset-first-warning-cry",
  "eden-inset-curious-swarm",
  "eden-inset-the-herd-misunderstands",
  "eden-inset-flowers-face-the-wrong-sun",
  "eden-inset-the-quiet-grove",
  "eden-inset-paradise-runs",
  "eden-inset-take-the-fruit",
  "eden-inset-gentle-approach",
  "eden-inset-stillness-lesson",
  "eden-inset-follow-the-shade",
  "eden-inset-hush-the-valley",
  "eden-inset-tread-softly",
] as const;

describe("Eden Prime - theme palette (REQ-EDEN-48, REQ-EDEN-49)", () => {
  it("selectTheme returns the Eden palette and backdrop/overlay/cardfront keys", () => {
    const theme = selectTheme(WORLD_ID);
    expect(theme.worldId).toBe(WORLD_ID);
    expect(theme.intrusionHue).toBe(EDEN_PRIME_THEME.intrusionHue);
    expect(theme.backdrop.realityKey).toBe("eden-prime-bg");
    expect(theme.backdrop.intrusionKey).toBe("eden-prime-overlay");
    expect(theme.worldCardfrontKey).toBe("eden-prime-cardfront");
  });

  it("the three base Eden asset keys resolve in the manifest", () => {
    const missing = EDEN_BASE_KEYS.filter((key) => !(key in assetManifest));
    expect(missing).toEqual([]);
  });
});

describe("Eden Prime - inset art guidance (REQ-EDEN-3, REQ-EDEN-40, REQ-EDEN-48)", () => {
  const readmePath = resolve("src/game/assets/themes/eden-prime/insets/README.md");

  it("documents style, prompt, filename/key list, finishing pass, and 100x100 validation", () => {
    expect(existsSync(readmePath)).toBe(true);
    const text = readFileSync(readmePath, "utf8");

    for (const term of [
      "startle",
      "Prompt Template",
      "Filename",
      "asset key",
      "Finishing Pass",
      "100x100 contact sheet",
      "violet-white",
      "Tread Softly",
    ]) {
      expect(text).toContain(term);
    }

    for (const key of EDEN_INSET_KEYS) {
      expect(text).toContain(key);
    }
  });

  it("the documented pending Eden inset keys match the current Eden card catalog", () => {
    const catalogKeys = Object.values(CARD_CATALOG)
      .map((template) => template.insetKey)
      .filter((key): key is string => key?.startsWith("eden-inset-") === true)
      .sort();

    expect(catalogKeys).toEqual([...EDEN_INSET_KEYS].sort());
  });
});

describe("Eden Prime - applied Alarm presentation helpers (REQ-EDEN-49)", () => {
  it("formats applied Alarm without treating authored keywords as applied state", () => {
    expect(
      // NOTE: this only tests `appliedKeywords` so this typecast hack isn't dangerous
      formatAppliedKeywords({
        appliedKeywords: [{ name: "Alarm", value: 2 }],
      } as unknown as Card),
    ).toBe("Alarm 2");

    expect(
      // NOTE: this only tests `appliedKeywords` so this typecast hack isn't dangerous
      formatAppliedKeywords({} as unknown as Card),
    ).toBeUndefined();

    expect(
      // NOTE: this only tests `appliedKeywords` so this typecast hack isn't dangerous
      formatAppliedKeywords({
        appliedKeywords: [
          { name: "Alarm", value: 3 },
          { name: "Concealed", value: 1 },
        ],
      } as unknown as Card),
    ).toBe("Alarm 3 · Concealed 1");
  });
});
