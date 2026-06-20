import { describe, expect, it } from "bun:test";
import { weightedDraw } from "../engine/weightedDraw";
import { createRng, nextFloat } from "../engine/rng";
import type { CardCatalog } from "../model/catalog";
import type { PlayerCardTemplate } from "../model/cards";
import type { RarityTier } from "../model/rarity";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTemplate(rarity: RarityTier): PlayerCardTemplate {
  return {
    kind: "player",
    name: rarity,
    effect: { kind: "Heal", amount: 1 },
    rarity,
  };
}

/** Build a catalog with `count` templates of a single rarity, ids prefixed. */
function makeTier(catalog: CardCatalog, prefix: string, rarity: RarityTier, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `${prefix}${i}`;
    catalog[id] = makeTemplate(rarity);
    ids.push(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// 1. Present-tier renormalization
// ---------------------------------------------------------------------------

describe("weightedDraw present-tier renormalization", () => {
  it("renormalizes weights over only the tiers represented among candidates", () => {
    // Only uncommon (25) and rare (12) are present. Renormalized:
    // uncommon = 25/37 ≈ 0.6757, rare = 12/37 ≈ 0.3243.
    const catalog: CardCatalog = {};
    const uncommonIds = makeTier(catalog, "unc", "uncommon", 1);
    const rareIds = makeTier(catalog, "rare", "rare", 1);
    const candidates = [...uncommonIds, ...rareIds];

    // tierRoll < 25/37 picks uncommon; we don't know the literal nextFloat
    // value in advance, so instead verify by sampling: every result must be
    // one of the two ids, and over many seeds the empirical uncommon share
    // approximates 25/37 within a tolerance band.
    let uncommonCount = 0;
    const samples = 4000;
    for (let seed = 0; seed < samples; seed++) {
      const rng = createRng(seed * 7919 + 1);
      const result = weightedDraw(catalog, rng, candidates, 1);
      expect(result.templateIds).toHaveLength(1);
      if (result.templateIds[0] === uncommonIds[0]) uncommonCount++;
    }
    const empirical = uncommonCount / samples;
    const expected = 25 / 37;
    expect(empirical).toBeGreaterThan(expected - 0.04);
    expect(empirical).toBeLessThan(expected + 0.04);
  });
});

// ---------------------------------------------------------------------------
// 2. Statistical check: one legendary among many commons
// ---------------------------------------------------------------------------

describe("weightedDraw statistical tier weighting", () => {
  it("draws a single Legendary among many Commons at ~ renormalized weight, not 1/population", () => {
    const catalog: CardCatalog = {};
    const commonIds = makeTier(catalog, "common", "common", 50);
    const legendaryIds = makeTier(catalog, "legendary", "legendary", 1);
    const candidates = [...commonIds, ...legendaryIds];

    // Renormalized: common = 60/63 ≈ 0.9524, legendary = 3/63 ≈ 0.0476.
    // 1/population would be 1/51 ≈ 0.0196 — far lower, so this distinguishes
    // tier-weighted draw from naive uniform draw.
    const expectedLegendaryShare = 3 / 63;
    const naiveUniformShare = 1 / candidates.length;
    expect(expectedLegendaryShare).toBeGreaterThan(naiveUniformShare * 2);

    let legendaryCount = 0;
    const samples = 6000;
    for (let seed = 0; seed < samples; seed++) {
      const rng = createRng(seed * 104729 + 13);
      const result = weightedDraw(catalog, rng, candidates, 1);
      if (result.templateIds[0] === legendaryIds[0]) legendaryCount++;
    }
    const empirical = legendaryCount / samples;
    expect(empirical).toBeGreaterThan(expectedLegendaryShare - 0.02);
    expect(empirical).toBeLessThan(expectedLegendaryShare + 0.02);
  });
});

// ---------------------------------------------------------------------------
// 3. Without-replacement: a fully-drawn tier drops out
// ---------------------------------------------------------------------------

describe("weightedDraw without-replacement tier depletion", () => {
  it("drops a tier from consideration once all its candidates are drawn", () => {
    const catalog: CardCatalog = {};
    // Single legendary candidate; once it's picked, "legendary" must not be
    // selectable again even though RARITY_WEIGHTS still has a nonzero entry
    // for it.
    const legendaryIds = makeTier(catalog, "legendary", "legendary", 1);
    const commonIds = makeTier(catalog, "common", "common", 3);
    const candidates = [...legendaryIds, ...commonIds];

    const rng = createRng(999);
    const result = weightedDraw(catalog, rng, candidates, 4);

    expect(result.templateIds).toHaveLength(4);
    // All candidates must appear exactly once (distinct, without replacement).
    expect(new Set(result.templateIds).size).toBe(4);
    expect(result.templateIds.sort()).toEqual([...candidates].sort());
  });
});

// ---------------------------------------------------------------------------
// 4. Fewer candidates than count
// ---------------------------------------------------------------------------

describe("weightedDraw fewer candidates than count", () => {
  it("returns all candidates, distinct, without crashing", () => {
    const catalog: CardCatalog = {};
    const ids = makeTier(catalog, "common", "common", 2);

    const rng = createRng(42);
    const result = weightedDraw(catalog, rng, ids, 10);

    expect(result.templateIds).toHaveLength(2);
    expect(new Set(result.templateIds).size).toBe(2);
    expect(result.templateIds.sort()).toEqual([...ids].sort());
  });

  it("handles an empty candidate pool without crashing", () => {
    const catalog: CardCatalog = {};
    const rng = createRng(1);
    const result = weightedDraw(catalog, rng, [], 5);
    expect(result.templateIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism
// ---------------------------------------------------------------------------

describe("weightedDraw determinism", () => {
  it("same seed produces identical ordered output across two independent calls", () => {
    const catalog: CardCatalog = {};
    const commonIds = makeTier(catalog, "common", "common", 10);
    const uncommonIds = makeTier(catalog, "uncommon", "uncommon", 5);
    const rareIds = makeTier(catalog, "rare", "rare", 3);
    const legendaryIds = makeTier(catalog, "legendary", "legendary", 1);
    const candidates = [...commonIds, ...uncommonIds, ...rareIds, ...legendaryIds];

    const seed = 31337;
    const resultA = weightedDraw(catalog, createRng(seed), candidates, 5);
    const resultB = weightedDraw(catalog, createRng(seed), candidates, 5);

    expect(resultA.templateIds).toEqual(resultB.templateIds);
    expect(resultA.rng).toEqual(resultB.rng);
  });
});

// ---------------------------------------------------------------------------
// 6. RNG advancement is fixed-count
// ---------------------------------------------------------------------------

describe("weightedDraw RNG advancement", () => {
  it("advances by exactly 2 nextFloat calls for a single-candidate draw", () => {
    const catalog: CardCatalog = {};
    const ids = makeTier(catalog, "only", "legendary", 1);

    const seed = 2024;
    const rng = createRng(seed);
    const result = weightedDraw(catalog, rng, ids, 1);

    // Manually advance the rng by exactly 2 nextFloat calls and compare.
    const [, afterOne] = nextFloat(createRng(seed));
    const [, afterTwo] = nextFloat(afterOne);

    expect(result.rng).toEqual(afterTwo);
  });

  it("advances by exactly 1 nextFloat call for an empty-pool draw", () => {
    const seed = 4096;
    const rng = createRng(seed);
    const catalog: CardCatalog = {};
    const result = weightedDraw(catalog, rng, [], 3);

    const [, afterOne] = nextFloat(createRng(seed));

    expect(result.rng).toEqual(afterOne);
  });

  it("advances by exactly 2 * resolvable-slot-count calls for a multi-slot draw", () => {
    const catalog: CardCatalog = {};
    const ids = makeTier(catalog, "common", "common", 4);

    const seed = 555;
    const rng = createRng(seed);
    const result = weightedDraw(catalog, rng, ids, 3);

    let expectedRng = createRng(seed);
    for (let i = 0; i < 3 * 2; i++) {
      const [, next] = nextFloat(expectedRng);
      expectedRng = next;
    }

    expect(result.rng).toEqual(expectedRng);
  });
});
