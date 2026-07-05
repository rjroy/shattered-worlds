import unlockCatalogJson from "./catalog.json";
import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { UnlocksProfile } from "../../game/runtime/unlocksProfile";
import { computeFragmentBalance, FEAT_CATALOG } from "../feats/catalog";
import { FORTUNE_BOON_POOLS } from "../worldManifest";
import { DEFAULT_RUN_MODIFIERS, type RunModifiers, type UnlockDefinition } from "./types";

export const UNLOCK_CATALOG: readonly UnlockDefinition[] =
  unlockCatalogJson as unknown as UnlockDefinition[];

export const DESTINY_BUDGET = 5;

// Step 6 (World 15 Slice 1) placeholders for deriving starting keywordGuard
// charges from summed destinyWeight across activated unlocks. Unauthored
// guesses pending a balance pass against the real sum of destinyWeight
// across the full catalog — do not treat as final. Kept low enough
// (relative to DESTINY_BUDGET below) that the mechanism is observable
// with real activation sets rather than always resolving to 0.
const WEIGHT_PER_CHARGE = 2;
const MAX_GUARD = 3;

export function computeUnlockSpend(
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): number {
  let total = 0;

  for (const id of profile.purchased) {
    const def = catalog.find((candidate) => candidate.id === id);
    if (def !== undefined) total += def.cost;
  }

  return total;
}

export function computeSpendableBalance(
  featsProfile: FeatsProfile,
  unlocksProfile: UnlocksProfile,
): number {
  const earned = computeFragmentBalance(featsProfile, FEAT_CATALOG);
  const spent = computeUnlockSpend(unlocksProfile, UNLOCK_CATALOG);
  const balance = earned - spent;

  if (balance < 0) {
    console.warn("[unlocks] computed negative spendable balance; clamping to zero", {
      earned,
      spent,
    });
    return 0;
  }

  return balance;
}

export function buildRunModifiers(
  activeIds: readonly string[],
  catalog: readonly UnlockDefinition[],
): RunModifiers {
  let mods: RunModifiers = { ...DEFAULT_RUN_MODIFIERS };

  for (const id of activeIds) {
    const def = catalog.find((candidate) => candidate.id === id);
    if (def === undefined) continue;

    switch (def.effect.type) {
      case "startingStat":
        switch (def.effect.stat) {
          case "hp":
            mods = { ...mods, extraStartHp: mods.extraStartHp + def.effect.amount };
            break;
          case "energy":
            mods = { ...mods, extraStartEnergy: mods.extraStartEnergy + def.effect.amount };
            break;
          case "light":
            mods = { ...mods, extraStartLight: mods.extraStartLight + def.effect.amount };
            break;
          case "heat":
            mods = { ...mods, extraStartHeat: mods.extraStartHeat + def.effect.amount };
            break;
          case "brace":
            mods = { ...mods, extraStartBrace: mods.extraStartBrace + def.effect.amount };
            break;
        }
        break;
      case "handSizeBonus":
        mods = { ...mods, handSizeBonusPerAct: def.effect.amountPerAct };
        break;
      case "minResourcePerTurn":
        if (def.effect.resource === "energy") {
          mods = { ...mods, minEnergyPerTurn: Math.max(mods.minEnergyPerTurn, def.effect.floor) };
        } else {
          mods = { ...mods, minLightPerTurn: Math.max(mods.minLightPerTurn, def.effect.floor) };
        }
        break;
      case "rarityBonus":
        mods = { ...mods, rarityBonus: mods.rarityBonus + def.effect.amount };
        break;
      case "keywordDamageBonus":
        mods = { ...mods, keywordDamageBonus: mods.keywordDamageBonus + def.effect.amount };
        break;
      case "playerCardModifier":
        mods = {
          ...mods,
          playerCardModifiers: [...mods.playerCardModifiers, def.effect.modifier],
        };
        break;
      case "starterDeckOverride":
        break;
      case "worldUnlock":
        break;
      case "actReward":
        {
          const boonSet =
            FORTUNE_BOON_POOLS[def.effect.boonPoolId as keyof typeof FORTUNE_BOON_POOLS];
          if (boonSet === undefined) {
            throw new Error(`Unknown act reward boon pool: ${def.effect.boonPoolId}`);
          }
          mods = {
            ...mods,
            actBoon: {
              poolId: def.effect.boonPoolId,
              poolName: def.effect.boonPoolName,
              poolTemplateIds: boonSet,
              offeredCount: def.effect.offeredCount,
              chooseCount: def.effect.chooseCount,
            },
          };
        }
        break;
    }
  }

  // Starting keywordGuard is a separate aggregation, not a per-effect-type
  // switch case: it scales with overall meta-progression (every activated
  // unlock's destinyWeight, whatever its own effect type) rather than a
  // hand-picked set of Blessings. See RunModifiers.extraStartKeywordGuard.
  const totalWeight = activeIds.reduce((sum, id) => {
    const def = catalog.find((candidate) => candidate.id === id);
    return sum + (def?.destinyWeight ?? 0);
  }, 0);
  mods = {
    ...mods,
    extraStartKeywordGuard: Math.min(MAX_GUARD, Math.floor(totalWeight / WEIGHT_PER_CHARGE)),
  };

  return mods;
}

export function isWorldUnlocked(
  worldId: string,
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): boolean {
  const gate = catalog.find(
    (candidate) => candidate.effect.type === "worldUnlock" && candidate.effect.worldId === worldId,
  );

  return gate === undefined || profile.purchased.includes(gate.id);
}

export function resolveStarterDeckId(
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): string | undefined {
  for (const id of profile.activated) {
    const def = catalog.find((candidate) => candidate.id === id);
    if (def?.effect.type === "starterDeckOverride") return def.effect.starterDeckId;
  }
  return undefined;
}

export function activeWeight(
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): number {
  return profile.activated.reduce((total, id) => {
    const def = catalog.find((candidate) => candidate.id === id);
    return total + (def?.destinyWeight ?? 0);
  }, 0);
}

export function canActivate(
  def: UnlockDefinition,
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): boolean {
  // Only 1 starter deck is allowed at a time.
  if (
    def?.effect.type === "starterDeckOverride" &&
    resolveStarterDeckId(profile, catalog) !== undefined
  ) {
    return false;
  }
  return (
    !profile.activated.includes(def.id) &&
    activeWeight(profile, catalog) + def.destinyWeight <= DESTINY_BUDGET
  );
}
