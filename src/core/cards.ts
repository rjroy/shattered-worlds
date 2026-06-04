import type {
  CardTemplateId,
  Effect,
  GameState,
  Keyword,
  Penalty,
  PlayerCard,
  Reward,
  WorldCard,
} from './types'

// ---------------------------------------------------------------------------
// Static template shapes
// ---------------------------------------------------------------------------

interface PlayerCardTemplate {
  kind: 'player'
  name: string
  effect: Effect
}

interface WorldCardTemplate {
  kind: 'world'
  name: string
  cost: number
  keywords: readonly Keyword[]
  discardable: boolean
  penalty: Penalty
  reward: Reward
}

type CardTemplate = PlayerCardTemplate | WorldCardTemplate

// ---------------------------------------------------------------------------
// Catalog — one entry per CardTemplateId (exhaustiveness enforced below)
// ---------------------------------------------------------------------------

const PLAYER_TEMPLATES: Record<
  | 'Sprint'
  | 'Explore'
  | 'Barricade'
  | 'Med Kit'
  | 'Panic'
  | 'Adrenaline'
  | 'Listen'
  | 'Baseball Bat'
  | 'Regroup'
  | 'Summon Door',
  PlayerCardTemplate
> = {
  Sprint: {
    kind: 'player',
    name: 'Sprint',
    effect: {
      kind: 'Modal',
      branches: [
        { kind: 'Draw', player: 2, world: 1 },
        { kind: 'DealProgress', base: 1, bonus: { tag: 'Slow', amount: 1 } },
      ],
    },
  },
  Explore: {
    kind: 'player',
    name: 'Explore',
    effect: { kind: 'DealProgress', base: 1, bonus: { tag: 'Hidden', amount: 1 } },
  },
  Barricade: {
    kind: 'player',
    name: 'Barricade',
    effect: {
      kind: 'Sequence',
      steps: [
        { kind: 'DealProgress', base: 1 },
        { kind: 'ReturnWorldCards', min: 0, max: 2 },
      ],
    },
  },
  'Med Kit': {
    kind: 'player',
    name: 'Med Kit',
    effect: { kind: 'Heal', amount: 2 },
  },
  Panic: {
    kind: 'player',
    name: 'Panic',
    effect: {
      kind: 'Sequence',
      steps: [
        { kind: 'ReturnWorldCards', min: 1, max: 1 },
        { kind: 'Draw', world: 1 },
      ],
    },
  },
  Adrenaline: {
    kind: 'player',
    name: 'Adrenaline',
    effect: { kind: 'DiscardThenDraw', player: 2 },
  },
  Listen: {
    kind: 'player',
    name: 'Listen',
    effect: { kind: 'DealProgress', base: 1, bonus: { tag: 'Hidden', amount: 2 } },
  },
  'Baseball Bat': {
    kind: 'player',
    name: 'Baseball Bat',
    effect: { kind: 'DealProgress', base: 2, bonus: { tag: 'Creature', amount: 3 } },
  },
  Regroup: {
    kind: 'player',
    name: 'Regroup',
    effect: { kind: 'DestroyCardInHand', min: 0, max: 1 },
  },
  'Summon Door': {
    kind: 'player',
    name: 'Summon Door',
    effect: { kind: 'AddWorldCardToTop', template: 'Door' },
  },
}

const WORLD_TEMPLATES: Record<
  | 'Strange Sounds'
  | 'Rubble'
  | 'Screams'
  | 'Zombie'
  | 'Find Baseball Bat'
  | 'The Walker'
  | 'Door',
  WorldCardTemplate
> = {
  'Strange Sounds': {
    kind: 'world',
    name: 'Strange Sounds',
    cost: 2,
    keywords: [],
    discardable: true,
    penalty: { kind: 'None' },
    reward: { kind: 'GainCard', template: 'Listen' },
  },
  Rubble: {
    kind: 'world',
    name: 'Rubble',
    cost: 1,
    keywords: [],
    discardable: true,
    penalty: { kind: 'SkipDrawNextTurn' },
    reward: { kind: 'None' },
  },
  Screams: {
    kind: 'world',
    name: 'Screams',
    cost: 1,
    keywords: [],
    discardable: true,
    penalty: { kind: 'GainCard', template: 'Panic' },
    reward: { kind: 'GainCard', template: 'Regroup' },
  },
  Zombie: {
    kind: 'world',
    name: 'Zombie',
    cost: 1,
    keywords: ['Slow', 'Creature'],
    discardable: true,
    penalty: { kind: 'Damage', amount: 1 },
    reward: { kind: 'None' },
  },
  'Find Baseball Bat': {
    kind: 'world',
    name: 'Find Baseball Bat',
    cost: 2,
    keywords: ['Hidden'],
    discardable: true,
    penalty: { kind: 'None' },
    reward: { kind: 'GainCard', template: 'Baseball Bat' },
  },
  'The Walker': {
    kind: 'world',
    name: 'The Walker',
    cost: 10,
    keywords: [],
    discardable: true,
    penalty: { kind: 'AddWorldCardToTop', template: 'Door' },
    reward: { kind: 'AddPlayerCardToTop', template: 'Summon Door' },
  },
  Door: {
    kind: 'world',
    name: 'Door',
    cost: 2,
    keywords: [],
    discardable: false,
    penalty: { kind: 'None' },
    reward: { kind: 'SurviveWorld' },
  },
}

// Unified lookup used by mintCard. The type assertion is safe because the two
// partial Records together cover every CardTemplateId exactly once.
export const CATALOG: Record<CardTemplateId, CardTemplate> = {
  ...PLAYER_TEMPLATES,
  ...WORLD_TEMPLATES,
}

// ---------------------------------------------------------------------------
// mintCard — stamps a template with the next sequential id
// ---------------------------------------------------------------------------

/**
 * Produces a single card from a template and advances `state.nextId`.
 * Returns the new card and the updated GameState; neither the card nor the
 * state is mutated in place.
 */
export function mintCard(
  state: GameState,
  templateId: CardTemplateId,
): [card: PlayerCard | WorldCard, next: GameState] {
  const id = String(state.nextId)
  const next: GameState = { ...state, nextId: state.nextId + 1 }
  const template = CATALOG[templateId]

  if (template.kind === 'player') {
    const card: PlayerCard = { kind: 'player', id, name: template.name, effect: template.effect }
    return [card, next]
  }

  const card: WorldCard = {
    kind: 'world',
    id,
    name: template.name,
    cost: template.cost,
    keywords: template.keywords,
    discardable: template.discardable,
    penalty: template.penalty,
    reward: template.reward,
  }
  return [card, next]
}
