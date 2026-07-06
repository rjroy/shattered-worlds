import { describe, expect, it } from "bun:test";

import { isWorldUnlocked, UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import type { FeatsStore } from "./featsProfile";
import type { RunStatsStorage } from "./runStats";
import {
  createUnlocksStore,
  loadUnlocksProfile,
  UNLOCKS_PROFILE_STORAGE_KEY,
} from "./unlocksProfile";

function memoryStorage(
  seed: Record<string, string> = {},
): RunStatsStorage & { dump(): Record<string, string> } {
  const entries = new Map(Object.entries(seed));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
    dump: () => Object.fromEntries(entries),
  };
}

function featsStore(fragmentIds: readonly string[]): FeatsStore {
  return {
    getProfile: () => ({
      version: 1,
      earned: fragmentIds.map((featId, index) => ({
        featId,
        earnedAt: index + 1,
        sessionId: `s-${index}`,
      })),
    }),
    setProfile() {},
    appendFeat() {},
  };
}

const richFeats = featsStore([
  "first-survivor",
  "swift-clear",
  "iron-will",
  "century-push",
  "energy-hoard",
  "light-keeper",
  "brace-master",
  "veteran",
  "conqueror",
]);

describe("loadUnlocksProfile", () => {
  it("returns empty without storage or when the key is missing", () => {
    expect(loadUnlocksProfile(undefined)).toEqual({ version: 1, purchased: [], activated: [] });
    expect(loadUnlocksProfile(memoryStorage())).toEqual({
      version: 1,
      purchased: [],
      activated: [],
    });
  });

  it("discards malformed JSON", () => {
    const storage = memoryStorage({ [UNLOCKS_PROFILE_STORAGE_KEY]: "{nope" });
    expect(loadUnlocksProfile(storage)).toEqual({ version: 1, purchased: [], activated: [] });
  });

  it("drops activated ids that are not purchased", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["extra-hp"],
        activated: ["extra-hp", "extra-energy"],
      }),
    });

    expect(loadUnlocksProfile(storage)).toEqual({
      version: 1,
      purchased: ["extra-hp"],
      activated: ["extra-hp"],
    });
  });
});

describe("createUnlocksStore", () => {
  it("purchases, persists, and auto-activates when the unlock fits", () => {
    const storage = memoryStorage();
    const store = createUnlocksStore(storage, richFeats);

    expect(store.purchase("extra-hp")).toBe("ok");
    expect(store.getProfile()).toEqual({
      version: 1,
      purchased: ["extra-hp"],
      activated: ["extra-hp"],
    });
    expect(JSON.parse(storage.dump()[UNLOCKS_PROFILE_STORAGE_KEY]!)).toEqual(store.getProfile());
  });

  it("rejects duplicates and insufficient fragment purchases", () => {
    const store = createUnlocksStore(memoryStorage(), featsStore(["first-survivor"]));

    expect(store.purchase("extra-hp")).toBe("insufficient-fragments");

    const richStore = createUnlocksStore(memoryStorage(), richFeats);
    expect(richStore.purchase("extra-hp")).toBe("ok");
    expect(richStore.purchase("extra-hp")).toBe("already-owned");
  });

  it("rejects purchasing a feat-gated starter deck until the required feat is earned", () => {
    const store = createUnlocksStore(memoryStorage(), richFeats);

    expect(store.purchase("starter-harvester")).toBe("feat-locked");
    expect(store.getProfile().purchased).toEqual([]);

    const clearedStore = createUnlocksStore(
      memoryStorage(),
      featsStore([...richFeats.getProfile().earned.map((r) => r.featId), "first-the-ember-orcharc"]),
    );
    expect(clearedStore.purchase("starter-harvester")).toBe("ok");
  });

  it("auto-activates purchases while their current weights fit the active budget", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["starter-footballer"],
        activated: ["starter-footballer"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.purchase("min-energy")).toBe("ok");
    expect(store.purchase("min-light")).toBe("ok");
    expect(store.getProfile()).toEqual({
      version: 1,
      purchased: ["starter-footballer", "min-energy", "min-light"],
      activated: ["starter-footballer", "min-energy", "min-light"],
    });
  });

  it("purchases and persists world unlocks without activating them", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["extra-hp"],
        activated: ["extra-hp"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.purchase("world-fog-beach-party")).toBe("ok");
    expect(store.getProfile()).toEqual({
      version: 1,
      purchased: ["extra-hp", "world-fog-beach-party"],
      activated: ["extra-hp"],
    });
    expect(JSON.parse(storage.dump()[UNLOCKS_PROFILE_STORAGE_KEY]!)).toEqual(store.getProfile());
  });

  it("bases world access on purchased ids instead of activated ids", () => {
    const storage = memoryStorage();
    const store = createUnlocksStore(storage, richFeats);

    expect(store.purchase("world-fog-beach-party")).toBe("ok");
    expect(store.getProfile().activated).toEqual([]);
    expect(isWorldUnlocked("fog-beach-party", store.getProfile(), UNLOCK_CATALOG)).toBe(true);
  });

  it("rejects unowned world unlock activation without mutating the profile", () => {
    const store = createUnlocksStore(memoryStorage(), richFeats);
    const before = store.getProfile();

    expect(store.setActive("world-fog-beach-party", true)).toBe("not-owned");
    expect(store.getProfile()).toEqual(before);
  });

  it("accepts owned world unlock activation as a no-op", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["world-fog-beach-party"],
        activated: [],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.setActive("world-fog-beach-party", true)).toBe("ok");
    expect(store.getProfile()).toEqual({
      version: 1,
      purchased: ["world-fog-beach-party"],
      activated: [],
    });
    expect(JSON.parse(storage.dump()[UNLOCKS_PROFILE_STORAGE_KEY]!)).toEqual(store.getProfile());
  });

  it("sets active ids, blocks over-budget activation, and no-ops already-active ids", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: [
          "extra-hp",
          "extra-brace",
          "starter-footballer",
          "min-energy",
          "act-reward",
        ],
        activated: ["starter-footballer", "extra-hp", "min-energy"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.setActive("missing", true)).toBe("not-owned");
    expect(store.setActive("act-reward", true)).toBe("over-budget");
    expect(store.getProfile().activated).toEqual([
      "starter-footballer",
      "extra-hp",
      "min-energy",
    ]);

    expect(store.setActive("extra-hp", true)).toBe("ok");
    expect(store.setActive("extra-hp", true)).toBe("ok");
    expect(store.getProfile().activated).toEqual([
      "starter-footballer",
      "extra-hp",
      "min-energy",
    ]);
  });

  it("deactivates idempotently and persists", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["extra-hp"],
        activated: ["extra-hp"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.setActive("extra-hp", false)).toBe("ok");
    expect(store.setActive("extra-hp", false)).toBe("ok");
    expect(store.getProfile().activated).toEqual([]);
    expect(JSON.parse(storage.dump()[UNLOCKS_PROFILE_STORAGE_KEY]!)).toEqual(store.getProfile());
  });
});
