import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { UnlocksProfile } from "../../game/runtime/unlocksProfile";
import { computeFragmentBalance, FEAT_CATALOG } from "../feats/catalog";
import { FORTUNE_BOON_POOLS } from "../worldManifest";
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
    description: "A muscle memory from a different life. More Barricades, No Panic, Less Sprint.",
    cost: 50,
    destinyWeight: 3,
    effect: { type: "starterDeckOverride", starterDeckId: "contractor" },
  },
  {
    id: "starter-footballer",
    name: "Athlete's Instinct",
    description: "A muscle memory from a different life. More Sprint, No Barricades.",
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
    effect: {
      type: "actReward",
      boonPoolId: "fortune-v1",
      boonPoolName: "Instant Fortune",
      offeredCount: 3,
      chooseCount: 1,
    },
  },
  {
    id: "world-fog-beach-party",
    name: "Fog Beach Party",
    description: "Opens Fog Beach Party in World Select.",
    cost: 5,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "fog-beach-party" },
  },
  {
    id: "bird-building",
    name: "Last Day at the Office",
    description: "Opens Last Day at the Office in World Select.",
    cost: 5,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "bird-building" },
  },
  {
    id: "world-whiteout-parking-garage",
    name: "Whiteout Parking Garage",
    description: "Opens Whiteout Parking Garage in World Select.",
    cost: 5,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "whiteout-parking-garage" },
  },
  {
    id: "world-the-tidal-archive",
    name: "The Tidal Archive",
    description: "Opens The Tidal Archive in World Select.",
    cost: 10,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "the-tidal-archive" },
  },
  {
    id: "world-the-ember-orchard",
    name: "The Ember Orchard",
    description: "Opens The Ember Orchard in World Select.",
    cost: 10,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "the-ember-orchard" },
  },
  {
    id: "world-city-of-sleeping-giants",
    name: "City of Sleeping Giants",
    description: "Opens City of Sleeping Giants in World Select.",
    cost: 10,
    destinyWeight: 0,
    effect: { type: "worldUnlock", worldId: "city-of-sleeping-giants" },
  },
  {
    id: "first-sprint-free",
    name: "Burst of Speed",
    description: "The first Sprint you play each turn costs 0 energy, but isn't as effective.",
    cost: 30,
    destinyWeight: 1,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "first-sprint-free",
        displayName: "Burst of Speed",
        target: { kind: "template", templateId: "Sprint" },
        condition: { kind: "templatePlayOrdinalThisTurn", ordinal: 1 },
        patches: [
          { kind: "setEnergyCost", energyCost: 0 },
          {
            kind: "replaceEffect",
            effect: { kind: "Draw", player: 2, world: 1 },
          },
        ],
      },
    },
  },
  {
    id: "panic-response",
    name: "Panic Response",
    description:
      "Panic also deals 2 progress to every world card in hand after its current effect and now exhaust.",
    cost: 35,
    destinyWeight: 2,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "panic-response",
        displayName: "Panic Response",
        target: { kind: "template", templateId: "Panic" },
        condition: { kind: "always" },
        patches: [
          { kind: "appendEffect", effect: { kind: "DealProgressAll", base: 2 } },
          { kind: "setExhaust", exhaust: true },
        ],
      },
    },
  },
  {
    id: "strong-barricades",
    name: "Strong Barricades",
    description:
      "Barricades apply progress to every world card and can return more cards, but have increased cost.",
    cost: 30,
    destinyWeight: 2,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "strong-barricades",
        displayName: "Strong Barricade",
        target: { kind: "template", templateId: "Barricade" },
        condition: { kind: "always" },
        patches: [
          {
            kind: "replaceEffect",
            effect: {
              kind: "Sequence",
              steps: [
                { kind: "ReturnWorldCards", min: 0, max: 6 },
                { kind: "DealProgressAll", base: 2, bonus: { tag: "Obstructed", amount: 1 } },
              ],
            },
          },
          { kind: "addEnergyCost", amount: 1 },
        ],
      },
    },
  },
  {
    id: "second-explore-push",
    name: "Determined Explorer",
    description:
      "The second Explore you play each turn deals 1 progress to every world card in hand.",
    cost: 30,
    destinyWeight: 1,
    effect: {
      type: "playerCardModifier",
      modifier: {
        id: "second-explore-push",
        displayName: "Determined Exploration",
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
