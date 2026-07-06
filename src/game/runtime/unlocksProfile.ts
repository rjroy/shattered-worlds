import {
  canActivate,
  computeSpendableBalance,
  hasRequiredFeat,
  UNLOCK_CATALOG,
} from "../../data/unlocks/catalog";
import type { UnlockDefinition } from "../../data/unlocks/types";
import type { RunStatsStorage } from "./runStats";
import type { FeatsStore } from "./featsProfile";

export type UnlocksProfile = {
  readonly version: 1;
  readonly purchased: readonly string[];
  readonly activated: readonly string[];
};

export const UNLOCKS_PROFILE_STORAGE_KEY = "shattered-worlds/unlocks/v1";

export function emptyUnlocksProfile(): UnlocksProfile {
  return { version: 1, purchased: [], activated: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isUnlocksProfile(value: unknown): value is UnlocksProfile {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return p.version === 1 && isStringArray(p.purchased) && isStringArray(p.activated);
}

function enforceSubset(profile: UnlocksProfile): UnlocksProfile {
  const purchased = new Set(profile.purchased);
  return {
    ...profile,
    activated: profile.activated.filter((id) => purchased.has(id)),
  };
}

function isWorldUnlock(def: UnlockDefinition): boolean {
  return def.effect.type === "worldUnlock";
}

export function loadUnlocksProfile(
  storage: RunStatsStorage | undefined,
  key = UNLOCKS_PROFILE_STORAGE_KEY,
): UnlocksProfile {
  if (storage === undefined) return emptyUnlocksProfile();

  try {
    const raw = storage.getItem(key);
    if (raw === null) return emptyUnlocksProfile();

    const parsed: unknown = JSON.parse(raw);
    if (!isUnlocksProfile(parsed)) {
      console.warn("[unlocksProfile] discarding stored unlocks profile with unknown shape", {
        key,
      });
      return emptyUnlocksProfile();
    }

    return enforceSubset(parsed);
  } catch (error) {
    console.warn("[unlocksProfile] failed to load unlocks profile; starting empty", { key, error });
    return emptyUnlocksProfile();
  }
}

export function saveUnlocksProfile(
  storage: RunStatsStorage | undefined,
  profile: UnlocksProfile,
  key = UNLOCKS_PROFILE_STORAGE_KEY,
): void {
  if (storage === undefined) return;

  try {
    storage.setItem(key, JSON.stringify(profile));
  } catch (error) {
    console.warn("[unlocksProfile] failed to persist unlocks profile; keeping in-memory copy", {
      key,
      error,
    });
  }
}

export interface UnlocksStore {
  getProfile(): UnlocksProfile;
  setProfile(profile: UnlocksProfile): void;
  purchase(id: string): "ok" | "already-owned" | "insufficient-fragments" | "feat-locked";
  setActive(id: string, active: boolean): "ok" | "not-owned" | "over-budget";
}

export function createUnlocksStore(
  storage: RunStatsStorage | undefined,
  featsStore: FeatsStore,
): UnlocksStore {
  let profile = loadUnlocksProfile(storage);

  function setProfile(next: UnlocksProfile): void {
    profile = next;
    saveUnlocksProfile(storage, profile);
  }

  return {
    getProfile: () => profile,

    setProfile(next) {
      setProfile(enforceSubset(next));
    },

    purchase(id) {
      if (profile.purchased.includes(id)) return "already-owned";

      const def = UNLOCK_CATALOG.find((candidate) => candidate.id === id);
      if (def === undefined) return "insufficient-fragments";

      if (!hasRequiredFeat(def, featsStore.getProfile())) return "feat-locked";

      const balance = computeSpendableBalance(featsStore.getProfile(), profile);
      if (def.cost > balance) return "insufficient-fragments";

      const purchased = [...profile.purchased, id];
      const activated =
        !isWorldUnlock(def) && canActivate(def, profile, UNLOCK_CATALOG)
          ? [...profile.activated, id]
          : profile.activated;
      setProfile({ version: 1, purchased, activated });
      return "ok";
    },

    setActive(id, active) {
      if (!profile.purchased.includes(id)) return "not-owned";

      if (active) {
        if (profile.activated.includes(id)) return "ok";

        const def = UNLOCK_CATALOG.find((candidate) => candidate.id === id);
        if (def !== undefined && isWorldUnlock(def)) return "ok";
        if (def === undefined || !canActivate(def, profile, UNLOCK_CATALOG)) {
          return "over-budget";
        }

        setProfile({ ...profile, activated: [...profile.activated, id] });
        return "ok";
      }

      setProfile({
        ...profile,
        activated: profile.activated.filter((activeId) => activeId !== id),
      });
      return "ok";
    },
  };
}
