import { describe, expect, it } from "bun:test";
import { selectTheme } from "../view/themes/themeManifest";
import { assetManifest } from "../data/assetManifest";
import { CARD_CATALOG, FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { THE_EMBER_ORCHARD_THEME } from "../../data/worlds/the-ember-orchard/theme";

const WORLD_ID = "the-ember-orchard";

// ---------------------------------------------------------------------------
// C4 — theme/palette assertion (REQ-EMBER-49, palette portion only).
//
// The "card renders with its inset" half of REQ-EMBER-49 requires the inset art
// to exist on disk and a live Phaser texture; it is deferred to the manual smoke
// run once Slice B art lands. Here we lock in only the palette/backdrop keys,
// which are pure data and assertable headless.
// ---------------------------------------------------------------------------

describe("The Ember Orchard — theme palette (REQ-EMBER-49)", () => {
  it("selectTheme returns the Ember palette and backdrop/overlay/cardfront keys", () => {
    const theme = selectTheme(WORLD_ID);
    expect(theme.worldId).toBe(WORLD_ID);
    // Ember keynote: warm orange invaded by impossible violet-magenta (REQ-EMBER-36).
    expect(theme.intrusionHue).toBe("#ce3406");
    expect(theme.intrusionHue).toBe(THE_EMBER_ORCHARD_THEME.intrusionHue);
    expect(theme.doorGlowTint).toBe(0xce3406);
    expect(theme.backdrop.realityKey).toBe("the-ember-orchard-bg");
    expect(theme.backdrop.intrusionKey).toBe("the-ember-orchard-overlay");
    expect(theme.worldCardfrontKey).toBe("the-ember-orchard-cardfront");
  });

  it("the three base Ember asset keys resolve in the manifest (wired now, not regenerated)", () => {
    // REQ-EMBER-2: base assets are already on disk and must be wired.
    for (const key of [
      "the-ember-orchard-bg",
      "the-ember-orchard-overlay",
      "the-ember-orchard-cardfront",
    ]) {
      expect(key in assetManifest).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// C3 — boon-source inset coverage (REQ-EMBER-48).
//
// Truth settled by reading worldAssetBindings.test.ts + referencedAssetKeys
// (src/data/worlds/types.ts): that test iterates ONLY bundle.source.cardTemplates
// — i.e. the-ember-orchard/cards.json (11 cards). The five Hatchery-tool reward
// cards live in a SEPARATE source (boons/ember.json) that is NOT part of the
// bundle, so their inset keys are NOT covered by the existing test.
//
// This test closes that gap: it asserts the five pool-ember-cellar inset keys are
// validated/bound, so they cannot ship silently broken.
// ---------------------------------------------------------------------------

describe("The Ember Orchard — boon-source inset bindings (REQ-EMBER-48)", () => {
  it("every pool-ember-cellar card inset key is bound in assetManifest", () => {
    // Boon cards live in the unified catalog now; look up inset keys via templateIds
    const emberTemplateIds = FORTUNE_BOON_POOLS["pool-ember-cellar"] ?? [];
    const boonInsetKeys = emberTemplateIds
      .map((tid) => CARD_CATALOG[tid]?.insetKey)
      .filter((key): key is string => typeof key === "string");

    // Sanity: the boon source actually carries inset keys to validate.
    expect(boonInsetKeys.length).toBeGreaterThan(0);

    const missing = boonInsetKeys.filter((key) => !(key in assetManifest));
    expect(missing).toEqual([]);
  });
});
