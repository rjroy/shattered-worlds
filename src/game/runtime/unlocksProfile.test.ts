import { describe, expect, it } from "bun:test";

import type { FeatsStore } from "./featsProfile";
import type { RunStatsStorage } from "./runStats";
import {
  createUnlocksStore,
  loadUnlocksProfile,
  UNLOCKS_PROFILE_STORAGE_KEY,
} from "./unlocksProfile";

function memoryStorage(seed: Record<string, string> = {}): RunStatsStorage & { dump(): Record<string, string> } {
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
      earned: fragmentIds.map((featId, index) => ({ featId, earnedAt: index + 1, sessionId: `s-${index}` })),
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
    expect(loadUnlocksProfile(memoryStorage())).toEqual({ version: 1, purchased: [], activated: [] });
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

  it("leaves a purchase inactive when it would exceed the active budget", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["starter-footballer"],
        activated: ["starter-footballer"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.purchase("act-reward")).toBe("ok");
    expect(store.getProfile()).toEqual({
      version: 1,
      purchased: ["starter-footballer", "act-reward"],
      activated: ["starter-footballer"],
    });
  });

  it("sets active ids, blocks over-budget activation, and no-ops already-active ids", () => {
    const storage = memoryStorage({
      [UNLOCKS_PROFILE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        purchased: ["extra-hp", "starter-footballer", "act-reward"],
        activated: ["starter-footballer"],
      }),
    });
    const store = createUnlocksStore(storage, richFeats);

    expect(store.setActive("missing", true)).toBe("not-owned");
    expect(store.setActive("act-reward", true)).toBe("over-budget");
    expect(store.getProfile().activated).toEqual(["starter-footballer"]);

    expect(store.setActive("extra-hp", true)).toBe("ok");
    expect(store.setActive("extra-hp", true)).toBe("ok");
    expect(store.getProfile().activated).toEqual(["starter-footballer", "extra-hp"]);
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
