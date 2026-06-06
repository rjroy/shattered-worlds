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

export class UnknownTemplateError extends Error {
  constructor(
    readonly templateId: string,
    readonly state: GameState,
    message?: string,
  ) {
    super(message ?? `Unknown card template: ${templateId}`)
    this.name = 'UnknownTemplateError'
  }
}

export class CatalogError extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'CatalogError'
  }
}
