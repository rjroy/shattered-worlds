import { describe, expect, it } from "bun:test";
import { selectTheme } from "../view/themes/themeManifest";
import { assetManifest } from "../data/assetManifest";
import { CARD_CATALOG, FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { CITY_OF_SLEEPING_GIANTS_THEME } from "../../data/worlds/city-of-sleeping-giants/theme";

const WORLD_ID = "city-of-sleeping-giants";

// ---------------------------------------------------------------------------
// C4 — theme/palette assertion (REQ-GIANTS-48, palette portion only).
//
// The "card renders with its inset" half of REQ-GIANTS-48 requires the inset art
// to exist on disk and a live Phaser texture; it is deferred to the manual smoke
// run once Slice B art lands. Here we lock in only the palette/backdrop keys,
// which are pure data and assertable headless.
// ---------------------------------------------------------------------------

describe("City of Sleeping Giants — theme palette (REQ-GIANTS-48)", () => {
  it("selectTheme returns the City palette and backdrop/overlay/cardfront keys", () => {
    const theme = selectTheme(WORLD_ID);
    expect(theme.worldId).toBe(WORLD_ID);
    // City keynote: deep civic violet intrusion (REQ-GIANTS-35..39).
    expect(theme.intrusionHue).toBe(CITY_OF_SLEEPING_GIANTS_THEME.intrusionHue);
    expect(theme.backdrop.realityKey).toBe("city-of-sleeping-giants-bg");
    expect(theme.backdrop.intrusionKey).toBe("city-of-sleeping-giants-overlay");
    expect(theme.worldCardfrontKey).toBe("city-of-sleeping-giants-cardfront");
  });

  it("the three base City asset keys resolve in the manifest (wired now, not regenerated)", () => {
    // REQ-GIANTS-2: base assets are already on disk and must be wired.
    for (const key of [
      "city-of-sleeping-giants-bg",
      "city-of-sleeping-giants-overlay",
      "city-of-sleeping-giants-cardfront",
    ]) {
      expect(key in assetManifest).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// C3 — boon-source inset coverage (REQ-GIANTS-47).
//
// worldAssetBindings.test.ts iterates ONLY bundle.source.cardTemplates — i.e.
// city-of-sleeping-giants/cards.json. The four Surveyor's-Kit reward cards live
// in a SEPARATE source (boons/giants.json) that is NOT part of the bundle, so
// their giants-inset-* keys are NOT covered by the existing test.
//
// This test closes that gap: it asserts the four pool-survey-results inset keys are
// validated/bound, so they cannot ship silently broken.
// ---------------------------------------------------------------------------

describe("City of Sleeping Giants — boon-source inset bindings (REQ-GIANTS-47)", () => {
  it("every pool-survey-results card inset key is bound in assetManifest", () => {
    // Boon cards live in the unified catalog now; look up inset keys via templateIds
    const giantsTemplateIds = FORTUNE_BOON_POOLS["pool-survey-results"] ?? [];
    const boonInsetKeys = giantsTemplateIds
      .map((tid) => CARD_CATALOG[tid]?.insetKey)
      .filter((key): key is string => typeof key === "string");

    // Sanity: the boon source actually carries inset keys to validate.
    expect(boonInsetKeys.length).toBeGreaterThan(0);

    const missing = boonInsetKeys.filter((key) => !(key in assetManifest));
    expect(missing).toEqual([]);
  });
});
