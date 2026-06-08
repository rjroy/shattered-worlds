export type CardId = string

// Known template names (for documentation only — the type is open for JSON-loaded catalogs):
// 'Sprint' | 'Explore' | 'Barricade' | 'Med Kit' | 'Panic' | 'Adrenaline' | 'Listen' |
// 'Baseball Bat' | 'Regroup' | 'Summon Door' | 'Strange Sounds' | 'Rubble' | 'Screams' |
// 'Zombie' | 'Find Baseball Bat' | 'The Walker' | 'Door'
export type CardTemplateId = string

export type Keyword = 'Hidden' | 'Creature' | 'Slow'

export type Dest = 'playerDiscard' | 'playerDrawTop' | 'worldDrawTop'

export type CardEffect =
  | { kind: 'DealProgress'; base: number; bonus?: { tag: Keyword; amount: number } }
  | { kind: 'Draw'; player?: number; world?: number }
  | { kind: 'Heal'; amount: number }
  | { kind: 'ReturnWorldCards'; min: number; max: number }
  | { kind: 'DestroyCardInHand'; min: number; max: number; maxCost?: number }
  | { kind: 'DiscardThenDraw'; player: number }
  | { kind: 'AddCard'; template: CardTemplateId; dest: Dest }
  | { kind: 'AddWorldCardToTop'; template: CardTemplateId }
  | { kind: 'Modal'; branches: readonly CardEffect[] }
  | { kind: 'Sequence'; steps: readonly CardEffect[] }
  | { kind: 'Damage'; amount: number }
  | { kind: 'SkipDrawNextTurn' }
  | { kind: 'GainCard'; template: CardTemplateId }
  | { kind: 'AddPlayerCardToTop'; template: CardTemplateId }
  | { kind: 'SurviveWorld' }
  // Queues a forced destruction of a random player card from the *next* hand.
  // Resolves at turn start after the hand refills (see resolveForceDestroy).
  | { kind: 'ForceDestroy' }
  // Removes the world card whose hook is firing (its selfId) from hand. Used by
  // onEndOfTurn to let a card degrade into another (Corpse → Zombie).
  | { kind: 'DestroySelf' }
  | { kind: 'None' }

export interface PlayerCard {
  kind: 'player'
  id: CardId
  name: string
  insetKey: string | undefined
  sourceWorldId: string
  effect: CardEffect
  energyCost: number
  // When true, the card is destroyed (sent to no zone) on play instead of
  // recycling to playerDiscard.
  exhaust?: boolean
}

export interface WorldCard {
  kind: 'world'
  id: CardId
  name: string
  insetKey: string | undefined
  cost: number
  keywords: readonly Keyword[]
  discardable: boolean
  onDiscarded: CardEffect
  onCleared: CardEffect
  onEndOfTurn: CardEffect
}

export type Card = PlayerCard | WorldCard

export type Action =
  | {
      type: 'PlayCard'
      cardId: CardId
      targetId?: CardId
      choice?: number
      returnIds?: readonly CardId[]
      destroyId?: CardId
      discardId?: CardId
    }
  | { type: 'DiscardHazard'; cardId: CardId }
  | { type: 'EndTurn' }

export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

export interface GameState {
  playerDraw: readonly Card[]
  hand: readonly Card[]
  playerDiscard: readonly Card[]
  worldDraw: readonly WorldCard[]
  acts: readonly (readonly WorldCard[])[]
  actIndex: number
  totalActs: number
  progress: Readonly<Record<CardId, number>>
  hp: number
  energy: number
  skipDrawNext: boolean
  // Count of random player cards to destroy from the next refilled hand.
  // Queued by the ForceDestroy effect; drained at turn start.
  pendingForceDestroy: number
  status: 'playing' | 'won' | 'lost'
  worldId: string
  rng: RngState
  nextId: number
}

export type TargetSpec =
  | { kind: 'none' }
  | { kind: 'hazard'; tag?: Keyword }
  | { kind: 'modal'; branches: readonly TargetSpec[] }
  | { kind: 'returnWorld'; min: number; max: number }
  | { kind: 'destroyHand'; min: number; max: number; maxCost?: number }
  | { kind: 'discardPlayer' }
  | { kind: 'compound'; steps: readonly TargetSpec[] }

export interface AvailableActions {
  playable: readonly { cardId: CardId; spec: TargetSpec }[]
  discardable: readonly CardId[]
  canEndTurn: boolean
  legalTargets(cardId: CardId, step: number): readonly CardId[]
}

export type GameEvent =
  | { type: 'CardPlayed'; cardId: CardId }
  | { type: 'ProgressDealt'; hazardId: CardId; amount: number; hazardTurnTotal: number }
  | { type: 'HazardResolved'; hazardId: CardId }
  | { type: 'HazardDiscarded'; cardId: CardId }
  | { type: 'DamageDealt'; amount: number }
  | { type: 'DrawSkipped' }
  | { type: 'CardGained'; id: CardId; dest: Dest }
  | { type: 'CardDestroyed'; id: CardId }
  | { type: 'WorldCardsReturned'; ids: readonly CardId[] }
  | { type: 'HpChanged'; hp: number }
  | { type: 'EnergyChanged'; energy: number }
  | { type: 'CardsDiscarded'; cardIds: readonly CardId[] }
  | { type: 'DeckShuffled' }
  | { type: 'ActAdvanced'; act: number }
  | { type: 'CardsDrawn'; ids: readonly CardId[] }
  | { type: 'TurnEnded' }
  | { type: 'WorldWon' }
  | { type: 'WorldLost' }
