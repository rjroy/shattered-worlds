import type { FeatsProfile } from '../../game/runtime/featsProfile'
import type { FeatDefinition } from './types'

export const FEAT_CATALOG: readonly FeatDefinition[] = [
  {
    id: 'first-survivor',
    name: 'First Survivor',
    description: 'Win your first run.',
    conditions: [{ statId: 'outcome', operator: 'is', value: 'won' }],
    reward: { items: [{ type: 'memoryFragments', amount: 10 }] },
  },
  {
    id: 'swift-clear',
    name: 'Swift Clear',
    description: 'Win a run in fewer than 10 turns.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'turns', operator: 'lt', value: 10 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 20 }] },
  },
  {
    id: 'iron-will',
    name: 'Iron Will',
    description: 'Win a run with 20 or more HP remaining.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'finalHp', operator: 'gte', value: 20 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 15 }] },
  },
  {
    id: 'last-breath',
    name: 'Last Breath',
    description: 'Win a run with 3 or fewer HP remaining.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'finalHp', operator: 'lte', value: 3 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 25 }] },
  },
  {
    id: 'no-healing',
    name: 'Pacifist',
    description: 'Win a run without receiving any healing.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'healingReceived', operator: 'eq', value: 0 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 25 }] },
  },
  {
    id: 'century-push',
    name: 'Century',
    description: 'Deal 100 or more progress in a single run.',
    conditions: [{ statId: 'progressDealt', operator: 'gte', value: 100 }],
    reward: { items: [{ type: 'memoryFragments', amount: 15 }] },
  },
  {
    id: 'energy-hoard',
    name: 'Energy Hoard',
    description: 'Win a run with 10 or more energy remaining.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'energy', operator: 'gte', value: 10 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 20 }] },
  },
  {
    id: 'light-keeper',
    name: 'Light Keeper',
    description: 'Win the Fog Beach Party with 10 or more light.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'worldId', operator: 'is', value: 'fog-beach-party' },
      { statId: 'light', operator: 'gte', value: 10 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 25 }] },
  },
  {
    id: 'brace-master',
    name: 'Brace Master',
    description: 'Win the Bird Building with 10 or more brace.',
    conditions: [
      { statId: 'outcome', operator: 'is', value: 'won' },
      { statId: 'worldId', operator: 'is', value: 'bird-building' },
      { statId: 'brace', operator: 'gte', value: 10 },
    ],
    reward: { items: [{ type: 'memoryFragments', amount: 25 }] },
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 10 runs across any world.',
    conditions: [{ statId: 'lifetime.runs', operator: 'gte', value: 10 }],
    reward: { items: [{ type: 'memoryFragments', amount: 30 }] },
  },
  {
    id: 'conqueror',
    name: 'Conqueror',
    description: 'Win 5 runs across any world.',
    conditions: [{ statId: 'lifetime.wins', operator: 'gte', value: 5 }],
    reward: { items: [{ type: 'memoryFragments', amount: 40 }] },
  },
]

export function computeFragmentBalance(
  profile: FeatsProfile,
  catalog: readonly FeatDefinition[],
): number {
  let total = 0

  for (const record of profile.earned) {
    const def = catalog.find((d) => d.id === record.featId)
    if (def === undefined) continue

    for (const item of def.reward.items) {
      if (item.type === 'memoryFragments') {
        total += item.amount
      }
    }
  }

  return total
}
