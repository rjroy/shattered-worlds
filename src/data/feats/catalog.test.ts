import { describe, expect, it } from "bun:test";

import allCardsJson from "../allCards.json";
import { FEAT_CATALOG, computeFragmentBalance } from "./catalog";
import type { FeatDefinition } from "./types";
import type { FeatsProfile } from "../../game/runtime/featsProfile";
import { STARTER_DECK_IDS } from "../worldManifest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(featIds: string[]): FeatsProfile {
  return {
    version: 1,
    earned: featIds.map((featId, i) => ({
      featId,
      earnedAt: 1_000 * (i + 1),
      sessionId: `run-${i + 1}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FEAT_CATALOG", () => {
  it("validation #16: all feat IDs are unique", () => {
    expect(new Set(FEAT_CATALOG.map((d) => d.id)).size).toBe(FEAT_CATALOG.length);
  });

  it("witness resolved-count feat conditions reference real card templates", () => {
    for (const feat of FEAT_CATALOG) {
      for (const condition of feat.conditions) {
        if (!condition.statId.startsWith("witness.") || !condition.statId.endsWith(".resolvedCount")) {
          continue;
        }

        const templateId = condition.statId.slice("witness.".length, -".resolvedCount".length);
        expect(Object.hasOwn(allCardsJson.cardTemplates, templateId)).toBe(true);
      }
    }
  });

  it("starter dot-path feat conditions reference real starter deck ids", () => {
    for (const feat of FEAT_CATALOG) {
      for (const condition of feat.conditions) {
        if (typeof condition.statId !== "string" || !condition.statId.startsWith("starter.")) {
          continue;
        }

        const rest = condition.statId.slice("starter.".length);
        const starterId = rest.slice(0, rest.indexOf("."));
        expect(STARTER_DECK_IDS).toContain(starterId);
      }
    }
  });
});

describe("computeFragmentBalance", () => {
  it("validation #15: sums memoryFragments for earned feats", () => {
    // first-survivor = 5, swift-clear = 10 → total 15
    const profile = makeProfile(["first-survivor", "swift-clear"]);
    expect(computeFragmentBalance(profile, FEAT_CATALOG)).toBe(15);
  });

  it("validation #15: unknown featId contributes 0", () => {
    const profile = makeProfile(["unknown-feat-id"]);
    expect(computeFragmentBalance(profile, FEAT_CATALOG)).toBe(0);
  });

  it("skips unknown reward type without throwing", () => {
    const testDef: FeatDefinition = {
      id: "test-unlock",
      name: "Test Unlock",
      description: "Unlock something.",
      conditions: [{ statId: "outcome", operator: "is", value: "won" }],
      reward: { items: [{ type: "unlock", id: "x" }] },
    };
    const catalog = [...FEAT_CATALOG, testDef];
    const profile = makeProfile(["test-unlock"]);
    expect(() => computeFragmentBalance(profile, catalog)).not.toThrow();
    expect(computeFragmentBalance(profile, catalog)).toBe(0);
  });
});
