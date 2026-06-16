import { describe, expect, it } from "bun:test";

import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { UnlocksProfile } from "../../game/runtime/unlocksProfile";
import { DEFAULT_RUN_MODIFIERS } from "./types";
import {
  activeWeight,
  buildRunModifiers,
  canActivate,
  computeSpendableBalance,
  computeUnlockSpend,
  DESTINY_BUDGET,
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
      buildRunModifiers(["extra-hp", "extra-energy", "extra-light", "extra-brace"], UNLOCK_CATALOG),
    ).toMatchObject({
      extraStartHp: 3,
      extraStartEnergy: 1,
      extraStartLight: 2,
      extraStartBrace: 2,
    });
  });

  it("builds floors, hand-size, and keyword modifiers from active ids only", () => {
    expect(
      buildRunModifiers(
        ["extra-hp", "min-energy", "hand-size-per-act", "keyword-bonus"],
        UNLOCK_CATALOG,
      ),
    ).toEqual({
      ...DEFAULT_RUN_MODIFIERS,
      extraStartHp: 3,
      handSizeBonusPerAct: 1,
      minEnergyPerTurn: 2,
      keywordDamageBonus: 1,
    });
  });
});

describe("Destiny budget helpers", () => {
  it("sums active weight and ignores unknown ids", () => {
    expect(activeWeight(["extra-hp", "keyword-bonus", "unknown"], UNLOCK_CATALOG)).toBe(3);
  });

  it("allows activation that fits, blocks over-budget and already-active ids", () => {
    const extraHp = UNLOCK_CATALOG.find((def) => def.id === "extra-hp")!;
    const starter = UNLOCK_CATALOG.find((def) => def.id === "starter-footballer")!;

    expect(canActivate(extraHp, ["keyword-bonus"], UNLOCK_CATALOG)).toBe(true);
    expect(canActivate(starter, ["keyword-bonus", "min-energy"], UNLOCK_CATALOG)).toBe(false);
    expect(canActivate(extraHp, ["extra-hp"], UNLOCK_CATALOG)).toBe(false);
    expect(DESTINY_BUDGET).toBe(5);
  });
});
