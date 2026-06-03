export type { CardId, Card, Action, GameEvent, RngState, GameState } from './types'
export { IllegalActionError } from './errors'

import type { Action, GameEvent, GameState } from './types'

export interface GameCore {
  readonly state: GameState
  dispatch(action: Action): { state: GameState; events: GameEvent[] }
}
