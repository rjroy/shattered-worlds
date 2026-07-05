import { describe, expect, it } from "bun:test";

import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { UnlocksProfile } from "../../game/runtime/unlocksProfile";
import { FORTUNE_BOON_POOLS } from "../worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "./types";
import {
  activeWeight,
  buildRunModifiers,
  canActivate,
  computeSpendableBalance,
  computeUnlockSpend,
  DESTINY_BUDGET,
  isWorldUnlocked,
  UNLOCK_CATALOG,
} from "./catalog";

const feats50: FeatsProfile = {
  version: 1,
  earned: [
    { featId: "first-survivor", earnedAt: 1, sessionId: "a" },
    { featId: "swift-clear", earnedAt: 2, sessionId: "b" },
    { featId: "energy-hoard", earnedAt: 3, sessionId: "c" },
  ],
};

function unlocks(purchased: readonly string[], activated: readonly string[] = []): UnlocksProfile {
  return { version: 1, purchased, activated };
}

describe("UNLOCK_CATALOG", () => {
  it("has no duplicate ids", () => {
    const ids = UNLOCK_CATALOG.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines Fortune as an implemented legal destiny unlock", () => {
    const fortune = UNLOCK_CATALOG.find((def) => def.id === "act-reward");

    expect(fortune).toMatchObject({
      id: "act-reward",
      name: "Fortune",
      cost: 60,
      destinyWeight: 3,
      effect: { type: "actReward", boonPoolId: "pool-fortune", offeredCount: 3, chooseCount: 1 },
    });
    expect(fortune?.destinyWeight).toBeLessThanOrEqual(DESTINY_BUDGET);
    expect(fortune?.description).not.toContain(["Not", "Implemented"].join(""));
  });

  it("defines Fog Beach Party as a world access unlock", () => {
    expect(UNLOCK_CATALOG.find((def) => def.id === "world-fog-beach-party")).toMatchObject({
      id: "world-fog-beach-party",
      name: "Fog Beach Party",
      cost: 5,
      destinyWeight: 0,
      effect: { type: "worldUnlock", worldId: "fog-beach-party" },
    });
  });

  it("defines Whiteout Parking Garage as a world access unlock", () => {
    expect(UNLOCK_CATALOG.find((def) => def.id === "world-whiteout-parking-garage")).toMatchObject({
      id: "world-whiteout-parking-garage",
      name: "Whiteout Parking Garage",
      cost: 5,
      destinyWeight: 0,
      effect: { type: "worldUnlock", worldId: "whiteout-parking-garage" },
    });
  });

  it("defines Answers as a world access unlock", () => {
    expect(UNLOCK_CATALOG.find((def) => def.id === "world-answers")).toMatchObject({
      id: "world-answers",
      name: "Answers",
      cost: 25,
      destinyWeight: 0,
      effect: { type: "worldUnlock", worldId: "answers" },
    });
  });
});

describe("computeUnlockSpend", () => {
  it("returns zero for an empty profile", () => {
    expect(computeUnlockSpend(unlocks([]), UNLOCK_CATALOG)).toBe(0);
  });

  it("sums known purchased unlock costs and ignores unknown ids", () => {
    expect(
      computeUnlockSpend(unlocks(["extra-hp", "extra-energy", "unknown"]), UNLOCK_CATALOG),
    ).toBe(35);
  });
});

describe("computeSpendableBalance", () => {
  it("derives fragments earned minus unlock spend", () => {
    expect(computeSpendableBalance(feats50, unlocks(["extra-hp"]))).toBe(25);
  });
});

describe("buildRunModifiers", () => {
  it("returns default modifiers for an empty active set", () => {
    expect(buildRunModifiers([], UNLOCK_CATALOG)).toEqual(DEFAULT_RUN_MODIFIERS);
  });

  it("accumulates all starting stat unlocks", () => {
    expect(
      buildRunModifiers(
        ["extra-hp", "extra-energy", "extra-light", "extra-heat", "extra-brace"],
        UNLOCK_CATALOG,
      ),
    ).toMatchObject({
      extraStartHp: 3,
      extraStartEnergy: 1,
      extraStartLight: 2,
      extraStartHeat: 2,
      extraStartBrace: 2,
    });
  });

  it("builds floors, hand-size, and keyword modifiers from active ids only", () => {
    // Weight: extra-hp(1) + min-energy(2) + hand-size-per-act(2) + keyword-bonus(2)
    // = 7 -> floor(7 / 2) = 3 charges at WEIGHT_PER_CHARGE = 2 (not this
    // test's focus, but buildRunModifiers derives it from every activated id
    // regardless of effect type, so it isn't 0 here).
    expect(
      buildRunModifiers(
        ["extra-hp", "min-energy", "hand-size-per-act", "keyword-bonus"],
        UNLOCK_CATALOG,
      ),
    ).toEqual({
      ...DEFAULT_RUN_MODIFIERS,
      extraStartHp: 3,
      extraStartKeywordGuard: 3,
      handSizeBonusPerAct: 1,
      minEnergyPerTurn: 2,
      rarityBonus: 0,
      keywordDamageBonus: 1,
    });
  });

  it("builds the Fortune act boon modifier only when active", () => {
    expect(buildRunModifiers([], UNLOCK_CATALOG).actBoon).toBeNull();

    const mods = buildRunModifiers(["act-reward"], UNLOCK_CATALOG);

    expect(mods.actBoon).toEqual({
      poolId: "pool-fortune",
      poolName: "Instant Fortune",
      poolTemplateIds: FORTUNE_BOON_POOLS["pool-fortune"] ?? [],
      offeredCount: 3,
      chooseCount: 1,
    });
    expect(mods.actBoon?.poolTemplateIds).toHaveLength(7);
  });

  it("appends active card-modifier unlock effects to run modifiers", () => {
    const mods = buildRunModifiers(
      ["first-sprint-free", "panic-response", "second-explore-push"],
      UNLOCK_CATALOG,
    );

    expect(mods.playerCardModifiers.map((modifier) => modifier.id)).toEqual([
      "first-sprint-free",
      "panic-response",
      "second-explore-push",
    ]);
    expect(mods.playerCardModifiers[0]).toMatchObject({
      target: { kind: "template", templateId: "Sprint" },
      condition: { kind: "templatePlayOrdinalThisTurn", ordinal: 1 },
      patches: [
        { kind: "setEnergyCost", energyCost: 0 },
        {
          kind: "replaceEffect",
          effect: { kind: "Draw", player: 2, world: 1 },
        },
      ],
    });
    expect(mods.playerCardModifiers[1]).toMatchObject({
      target: { kind: "template", templateId: "Panic" },
      condition: { kind: "always" },
      patches: [
        {
          kind: "replaceEffect",
          effect: {
            kind: "Sequence",
            steps: [
              {
                kind: "Modal",
                branches: [
                  { kind: "DealProgressAll", base: 2 },
                  { kind: "ReturnWorldCards", min: 1, max: 12 },
                ],
              },
              { kind: "Draw", world: 1 },
            ],
          },
        },
        { kind: "setExhaust", exhaust: true },
      ],
    });
    expect(mods.playerCardModifiers[2]).toMatchObject({
      target: { kind: "template", templateId: "Explore" },
      condition: { kind: "templatePlayOrdinalThisTurn", ordinal: 2 },
      patches: [{ kind: "appendEffect", effect: { kind: "DealProgressAll", base: 1 } }],
    });
  });

  it("does not apply purchased card-modifier unlocks unless their ids are active", () => {
    const profile = unlocks(["first-sprint-free"], []);

    expect(computeUnlockSpend(profile, UNLOCK_CATALOG)).toBe(30);
    expect(buildRunModifiers(profile.activated, UNLOCK_CATALOG).playerCardModifiers).toEqual([]);
  });

  it("does not apply world unlocks as run modifiers", () => {
    expect(buildRunModifiers(["world-fog-beach-party"], UNLOCK_CATALOG)).toEqual(
      DEFAULT_RUN_MODIFIERS,
    );
  });

  // World 15 (the-beginning) Slice 1 — extraStartKeywordGuard is a separate
  // aggregation over summed destinyWeight across ALL activated ids (see the
  // comment above the totalWeight reduce in buildRunModifiers), not a
  // per-effect-type switch case. WEIGHT_PER_CHARGE/MAX_GUARD are still
  // unauthored placeholders (see the comment at their declaration site) —
  // these tests confirm the arithmetic, not a tuned value.
  describe("extraStartKeywordGuard", () => {
    it("is 0 for a fresh profile with nothing activated", () => {
      expect(buildRunModifiers([], UNLOCK_CATALOG).extraStartKeywordGuard).toBe(0);
    });

    it("derives a non-zero charge count from summed destinyWeight (WEIGHT_PER_CHARGE = 2)", () => {
      // extra-hp (weight 1) + extra-energy (weight 1) = 2 -> floor(2 / 2) = 1.
      expect(
        buildRunModifiers(["extra-hp", "extra-energy"], UNLOCK_CATALOG).extraStartKeywordGuard,
      ).toBe(1);
    });

    it("clamps at MAX_GUARD even when summed weight would derive more charges", () => {
      // extra-hp + extra-energy + extra-light + extra-heat + extra-brace (1 each)
      // + hand-size-per-act + keyword-bonus + rarity-bonus (2 each) = 5 + 6 = 11
      // -> floor(11 / 2) = 5, clamped down to MAX_GUARD = 3.
      expect(
        buildRunModifiers(
          [
            "extra-hp",
            "extra-energy",
            "extra-light",
            "extra-heat",
            "extra-brace",
            "hand-size-per-act",
            "keyword-bonus",
            "rarity-bonus",
          ],
          UNLOCK_CATALOG,
        ).extraStartKeywordGuard,
      ).toBe(3);
    });
  });
});

describe("isWorldUnlocked", () => {
  it("returns true for ungated worlds", () => {
    expect(isWorldUnlocked("zombie-big-box", unlocks([]), UNLOCK_CATALOG)).toBe(true);
  });

  it("returns false for gated worlds that have not been purchased", () => {
    expect(isWorldUnlocked("fog-beach-party", unlocks([]), UNLOCK_CATALOG)).toBe(false);
  });

  it("returns true for gated worlds whose unlock has been purchased", () => {
    expect(
      isWorldUnlocked("fog-beach-party", unlocks(["world-fog-beach-party"]), UNLOCK_CATALOG),
    ).toBe(true);
  });

  it("ignores unknown purchased ids when checking gated worlds", () => {
    expect(isWorldUnlocked("whiteout-parking-garage", unlocks(["unknown"]), UNLOCK_CATALOG)).toBe(
      false,
    );
  });

  it("returns false for answers until world-answers has been purchased", () => {
    expect(isWorldUnlocked("answers", unlocks([]), UNLOCK_CATALOG)).toBe(false);
  });

  it("returns true for answers once world-answers has been purchased", () => {
    expect(isWorldUnlocked("answers", unlocks(["world-answers"]), UNLOCK_CATALOG)).toBe(true);
  });
});

describe("Destiny budget helpers", () => {
  it("sums active weight and ignores unknown ids", () => {
    expect(
      activeWeight(
        { activated: ["extra-hp", "keyword-bonus", "unknown"] } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(3);
  });

  it("counts world unlocks as zero active weight", () => {
    expect(
      activeWeight(
        {
          activated: ["world-fog-beach-party", "world-whiteout-parking-garage"],
        } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(0);
  });

  it("allows activation that fits, blocks over-budget and already-active ids", () => {
    const extraHp = UNLOCK_CATALOG.find((def) => def.id === "extra-hp")!;
    const starter = UNLOCK_CATALOG.find((def) => def.id === "starter-footballer")!;
    const actReward = UNLOCK_CATALOG.find((def) => def.id === "act-reward")!;

    expect(
      canActivate(
        extraHp,
        { activated: ["keyword-bonus"] } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(true);
    expect(
      canActivate(
        actReward,
        { activated: ["keyword-bonus", "min-energy"] } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(false);
    expect(
      canActivate(
        starter,
        { activated: ["keyword-bonus", "min-energy"] } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(true);
    expect(
      canActivate(
        extraHp,
        { activated: ["extra-hp"] } as unknown as UnlocksProfile,
        UNLOCK_CATALOG,
      ),
    ).toBe(false);
    expect(DESTINY_BUDGET).toBe(5);
  });
});
