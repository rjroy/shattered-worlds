import { describe, expect, it } from "bun:test";
import { worldManifest } from "../../data/worldManifest";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { WORLD_SELECT_LAYOUT } from "../view/layout";
import { selectTheme } from "../view/themes/themeManifest";
import {
  canPageLeft,
  canPageRight,
  pageLeft,
  pageRight,
  reachableWorldIndices,
} from "../scenes/worldSelectPaging";

// REQ-TIDAL-49: with the seventh world (the-tidal-archive) registered, the
// world-select carousel must render cleanly. The scene paints a sliding window
// of `visibleWorldCount` cards and pages through the rest with arrows, so the
// load-bearing invariant is "every world is reachable by paging, and each has
// the display/theme data the scene reads while rendering a card."
//
// The reachability assertions below drive the SAME paging functions
// (`canPageRight`/`pageRight`/...) that WorldSelectScene runs at runtime, rather
// than a test-local mirror — so a regression in the scene's paging guards would
// fail this test. The scene logic is a pure function of these inputs plus the
// page index, so it can be exercised without booting a Phaser scene.

const VISIBLE = WORLD_SELECT_LAYOUT.visibleWorldCount;

describe("world-select carousel with seven worlds (REQ-TIDAL-49)", () => {
  it("registers the seventh world and includes the Tidal Archive", () => {
    const ids = Object.keys(worldManifest);
    expect(ids.length).toBeGreaterThanOrEqual(7);
    expect(ids).toContain("the-tidal-archive");
  });

  it("every registered world is reachable by paging the carousel (real scene logic)", () => {
    const worldCount = Object.keys(worldManifest).length;
    const seen = reachableWorldIndices(worldCount, VISIBLE);
    // Every world index [0, worldCount) is reached by walking the real
    // pageRight stepper from start 0 — including the 7th world (index 6).
    expect(seen.size).toBe(worldCount);
    for (let i = 0; i < worldCount; i++) {
      expect(seen.has(i)).toBe(true);
    }
  });

  it("paging steppers honor the bounds the scene arrows enforce", () => {
    const worldCount = Object.keys(worldManifest).length;

    // Left arrow is disabled / inert at the start.
    expect(canPageLeft(0)).toBe(false);
    expect(pageLeft(0)).toBe(0);

    // Right arrow advances exactly until the last window is shown, then stops.
    const lastStart = Math.max(0, worldCount - VISIBLE);
    expect(canPageRight(lastStart, worldCount, VISIBLE)).toBe(false);
    expect(pageRight(lastStart, worldCount, VISIBLE)).toBe(lastStart);
    if (worldCount > VISIBLE) {
      expect(canPageRight(0, worldCount, VISIBLE)).toBe(true);
      expect(pageRight(0, worldCount, VISIBLE)).toBe(1);
    }
  });

  it("every world the carousel renders has display data and a resolvable theme", () => {
    for (const worldId of Object.keys(worldManifest)) {
      // The scene throws if display data is missing while building a card.
      expect(worldDisplayManifest[worldId]).toBeDefined();
      // selectTheme must return the real theme (not the STARTER fallback) so the
      // accent color and backdrop tint render with the world's identity.
      expect(selectTheme(worldId).worldId).toBe(worldId);
    }
  });

  it("the Tidal Archive supplies a hex intrusionHue the carousel can tint with", () => {
    const theme = selectTheme("the-tidal-archive");
    expect(theme.intrusionHue).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
