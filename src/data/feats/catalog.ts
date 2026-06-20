import type { FeatsProfile } from "../../game/runtime/featsProfile";
import type { FeatDefinition } from "./types";

export const FEAT_CATALOG: readonly FeatDefinition[] = [
  {
    id: "the-walker",
    name: "I Am The Walker",
    description: "Defeat the Walker in any run.",
    conditions: [{ statId: "witness.The Walker.resolvedCount", operator: "gte", value: 1 }],
    reward: { items: [{ type: "memoryFragments", amount: 25 }] },
  },
  {
    id: "first-survivor",
    name: "First Survivor",
    description: "Win your first run.",
    conditions: [{ statId: "outcome", operator: "is", value: "won" }],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-big-box",
    name: "First Shopping Trip",
    description: "Win your first run of the Big Box.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "zombie-big-box" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-bird-building",
    name: "First Flight",
    description: "Win your first run of Last Day at the Office.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "bird-building" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-highway-volcano",
    name: "First Lava Rush",
    description: "Win your first run of the Highway Eruption.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "highway-volcano" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-overgrown-mall",
    name: "First Mall Rat",
    description: "Win your first run of the Mall Reclaimnation.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "overgrown-mall" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-fog-beach-party",
    name: "First Beach Party",
    description: "Win your first run of the Fog Beach Party.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "fog-beach-party" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "first-whiteout-parking-garage",
    name: "First Thaw",
    description: "Win your first run of the Whiteout Parking Garage.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 5 }] },
  },
  {
    id: "swift-clear",
    name: "Swift Clear",
    description: "Win a run in fewer than 10 turns.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "turns", operator: "lt", value: 10 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 15 }] },
  },
  {
    id: "iron-will",
    name: "Iron Will",
    description: "Win a run with 20 or more HP remaining.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "finalHp", operator: "gte", value: 20 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 15 }] },
  },
  {
    id: "last-breath",
    name: "Last Breath",
    description: "Win a run with 3 or fewer HP remaining.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "finalHp", operator: "lte", value: 3 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 25 }] },
  },
  {
    id: "no-healing",
    name: "Toughed It Out",
    description: "Win a run without receiving any healing.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "healingReceived", operator: "eq", value: 0 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "century-push",
    name: "Century",
    description: "Deal 100 or more progress in a single run.",
    conditions: [{ statId: "progressDealt", operator: "gte", value: 100 }],
    reward: { items: [{ type: "memoryFragments", amount: 30 }] },
  },
  {
    id: "energy-hoard",
    name: "Energy Hoard",
    description: "Win a run with 10 or more energy remaining.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "energy", operator: "gte", value: 15 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "light-keeper",
    name: "Light Keeper",
    description: "Win the Fog Beach Party with 10 or more light.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "fog-beach-party" },
      { statId: "light", operator: "gte", value: 20 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "brace-master",
    name: "Brace Master",
    description: "Win the Bird Building with 10 or more brace.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "bird-building" },
      { statId: "brace", operator: "gte", value: 8 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "heat-keeper",
    name: "Heat Keeper",
    description: "Win the Whiteout Parking Garage with 10 or more heat.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
      { statId: "heat", operator: "gte", value: 10 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "master-thaw",
    name: "Master Thaw",
    description: "Win the Whiteout Parking Garage after thawing 5 or more frozen cards.",
    conditions: [
      { statId: "outcome", operator: "is", value: "won" },
      { statId: "worldId", operator: "is", value: "whiteout-parking-garage" },
      { statId: "cardsThawed", operator: "gte", value: 5 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "zombie-slayer",
    name: "Zombie Slayer",
    description: "Defeat 25 Zombies across all runs.",
    conditions: [{ statId: "witness.Zombie.resolvedCount", operator: "gte", value: 25 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "bird-slayer",
    name: "Talon Stomper",
    description: "Fight back 25 Gripping Talons across all runs.",
    conditions: [{ statId: "witness.Gripping Talons.resolvedCount", operator: "gte", value: 25 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "lava-slayer",
    name: "Lava Racer",
    description: "Speed past 25 Lava Flows across all runs.",
    conditions: [{ statId: "witness.Lava Flow.resolvedCount", operator: "gte", value: 25 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "plant-slayer",
    name: "Human Pesticide",
    description: "Defeat 25 Something in the Atrium across all runs.",
    conditions: [
      { statId: "witness.Something in the Atrium.resolvedCount", operator: "gte", value: 25 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "mist-slayer",
    name: "Personal Lighthouse",
    description: "Defeat 25 Something in the Mist across all runs.",
    conditions: [
      { statId: "witness.Something in the Mist.resolvedCount", operator: "gte", value: 25 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "freeze-slayer",
    name: "Human Torch",
    description: "Resolve 25 encounters with The Garage Freezes Shut hazards across all runs.",
    conditions: [
      { statId: "witness.The Garage Freezes Shut.resolvedCount", operator: "gte", value: 25 },
    ],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Complete 10 runs across any world.",
    conditions: [{ statId: "lifetime.runs", operator: "gte", value: 10 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "seasoned",
    name: "Seasoned",
    description: "Complete 20 runs across any world.",
    conditions: [{ statId: "lifetime.runs", operator: "gte", value: 20 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "conqueror",
    name: "Conqueror",
    description: "Win 5 runs across any world.",
    conditions: [{ statId: "lifetime.wins", operator: "gte", value: 5 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
  {
    id: "destroyer",
    name: "World Hopper",
    description: "Win 10 runs across any world.",
    conditions: [{ statId: "lifetime.wins", operator: "gte", value: 10 }],
    reward: { items: [{ type: "memoryFragments", amount: 20 }] },
  },
];

export function computeFragmentBalance(
  profile: FeatsProfile,
  catalog: readonly FeatDefinition[],
): number {
  let total = 0;

  for (const record of profile.earned) {
    const def = catalog.find((d) => d.id === record.featId);
    if (def === undefined) continue;

    for (const item of def.reward.items) {
      if (item.type === "memoryFragments") {
        total += item.amount;
      }
    }
  }

  return total;
}
