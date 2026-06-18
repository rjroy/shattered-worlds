import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { UnlocksProfile } from "../../game/runtime/unlocksProfile";
import { computeFragmentBalance, FEAT_CATALOG } from "../feats/catalog";
import { FORTUNE_BOON_POOLS } from "../worlds/boons/fortune";
import { DEFAULT_RUN_MODIFIERS, type RunModifiers, type UnlockDefinition } from "./types";

export const UNLOCK_CATALOG: readonly UnlockDefinition[] = [
  {
    id: "extra-hp",
    name: "Tough Hide",
    description: "The memory of surviving worse than this.",
    cost: 15,
    destinyWeight: 1,
    effect: { type: "startingStat", stat: "hp", amount: 3 },
  },
  {
    id: "extra-energy",
    name: "Charged",
    description: "You remember how it felt to move fast when it mattered.",
    cost: 20,
    destinyWeight: 1,
    effect: { type: "startingStat", stat: "energy", amount: 1 },
  },
  {
    id: "extra-light",
    name: "Fog Lantern",
    description: "You packed an extra flashlight. It felt like superstition.",
    cost: 20,
    destinyWeight: 1,
    effect: { type: "startingStat", stat: "light", amount: 2 },
  },
  {
    id: "extra-heat",
    name: "Thermal Cache",
    description: "A pocket of warmth saved for the worlds that can freeze your hands.",
    cost: 20,
    destinyWeight: 1,
    effect: { type: "startingStat", stat: "heat", amount: 2 },
  },
  {
    id: "extra-brace",
    name: "Braced",
    description: "Shoulders back. Ready for something to grab.",
    cost: 20,
    destinyWeight: 1,
    effect: { type: "startingStat", stat: "brace", amount: 2 },
  },
  {
    id: "hand-size-per-act",
    name: "Adaptable",
    description: "Every situation teaches you something. You start learning faster.",
    cost: 35,
    destinyWeight: 2,
    effect: { type: "handSizeBonus", amountPerAct: 1 },
  },
  {
    id: "keyword-bonus",
    name: "Sharpened Instincts",
    description: "You've learned where the weak points are.",
    cost: 30,
    destinyWeight: 2,
    effect: { type: "keywordDamageBonus", amount: 1 },
  },
  {
    id: "min-light",
    name: "Fog Signal",
    description: "There is always a little light left. You make sure of it.",
    cost: 35,
    destinyWeight: 2,
    effect: { type: "minResourcePerTurn", resource: "light", floor: 1 },
  },
  {
    id: "min-energy",
    name: "Steady Pulse",
    description: "Your hands stop shaking. You always find a little more to give.",
    cost: 40,
    destinyWeight: 2,
    effect: { type: "minResourcePerTurn", resource: "energy", floor: 2 },
  },
  {
    id: "starter-contractor",
    name: "Builder's Instinct",
    description: "A muscle memory from a different life. Different strengths, different gaps.",
    cost: 50,
    destinyWeight: 3,
    effect: { type: "starterDeckOverride", starterDeckId: "contractor" },
  },
  {
    id: "starter-footballer",
    name: "Athlete's Instinct",
    description: "A muscle memory from a different life. Different strengths, different gaps.",
    cost: 50,
    destinyWeight: 3,
    effect: { type: "starterDeckOverride", starterDeckId: "footballer" },
  },
  {
    id: "act-reward",
    name: "Fortune",
    description: "At the start of each new act, choose 1 of 3 temporary boon cards for your hand.",
    cost: 70,
    destinyWeight: 3,
    effect: { type: "actReward", boonPoolId: "fortune-v1", offeredCount: 3, chooseCount: 1 },
  },

  // Experimental card-modifier unlocks for playtesting effective player cards.
  {
    id: "first-sprint-free",
    name: "Playtest: First Sprint Free",
    description: "Experimental. The first Sprint you play each turn costs 0 energy.",
    cost: 30,
    destinyWeight: 1,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "first-sprint-free",
        target: { kind: "template", templateId: "Sprint" },
        condition: { kind: "templatePlayOrdinalThisTurn", ordinal: 1 },
        patches: [{ kind: "setEnergyCost", energyCost: 0 }],
      },
    },
  },
  {
    id: "panic-response",
    name: "Playtest: Panic Response",
    description: "Experimental. Panic also deals 1 progress to every world card in hand.",
    cost: 35,
    destinyWeight: 2,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "panic-response",
        target: { kind: "template", templateId: "Panic" },
        condition: { kind: "always" },
        patches: [{ kind: "appendEffect", effect: { kind: "DealProgressAll", base: 1 } }],
      },
    },
  },
  {
    id: "second-explore-push",
    name: "Playtest: Second Explore Push",
    description: "Experimental. The second Explore you play each turn deals 1 progress to every world card in hand.",
    cost: 30,
    destinyWeight: 1,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "second-explore-push",
        target: { kind: "template", templateId: "Explore" },
        condition: { kind: "templatePlayOrdinalThisTurn", ordinal: 2 },
        patches: [{ kind: "appendEffect", effect: { kind: "DealProgressAll", base: 1 } }],
      },
    },
  },
];

export const DESTINY_BUDGET = 5;

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
      case "actReward":
        {
          const poolTemplateIds =
            FORTUNE_BOON_POOLS[def.effect.boonPoolId as keyof typeof FORTUNE_BOON_POOLS];
          if (poolTemplateIds === undefined) {
            throw new Error(`Unknown act reward boon pool: ${def.effect.boonPoolId}`);
          }
          mods = {
            ...mods,
            actBoon: {
              poolId: def.effect.boonPoolId,
              poolTemplateIds,
              offeredCount: def.effect.offeredCount,
              chooseCount: def.effect.chooseCount,
            },
          };
        }
        break;
    }
  }

  return mods;
}

export function activeWeight(
  activeIds: readonly string[],
  catalog: readonly UnlockDefinition[],
): number {
  return activeIds.reduce((total, id) => {
    const def = catalog.find((candidate) => candidate.id === id);
    return total + (def?.destinyWeight ?? 0);
  }, 0);
}

export function canActivate(
  def: UnlockDefinition,
  activeIds: readonly string[],
  catalog: readonly UnlockDefinition[],
): boolean {
  return (
    !activeIds.includes(def.id) &&
    activeWeight(activeIds, catalog) + def.destinyWeight <= DESTINY_BUDGET
  );
}
