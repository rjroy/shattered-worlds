import type { Action, GameState } from './types'

export class IllegalActionError extends Error {
  constructor(
    readonly action: Action,
    readonly state: GameState,
    message?: string,
  ) {
    super(message ?? `Illegal action: ${action.type}`)
    this.name = 'IllegalActionError'
  }
}
