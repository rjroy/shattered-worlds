export type CardId = string // "card-01" … "card-10"

export interface Card {
  id: CardId
  value: 1 | 2 | 3
}

export type Action =
  | { type: 'PlayCard'; cardId: CardId }
  | { type: 'EndTurn' }

export type GameEvent =
  | { type: 'CardPlayed'; cardId: CardId; value: number; runningTotal: number }
  | { type: 'TurnEnded'; total: number }
  | { type: 'CardsDiscarded'; cardIds: CardId[] }
  | { type: 'DeckShuffled' }
  | { type: 'CardsDrawn'; cardIds: CardId[] }

// RngState is defined here (not in rng.ts) so GameState typechecks now.
// Step 3's rng.ts will import it.
export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

export interface GameState {
  drawPile: readonly Card[] // top = index 0
  hand: readonly Card[]
  played: readonly Card[] // in play order
  discard: readonly Card[]
  runningTotal: number
  history: readonly number[]
  rng: RngState
}
