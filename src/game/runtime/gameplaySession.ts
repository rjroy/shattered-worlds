import { createGame } from '../../core/index'
import type { Action, CardCatalog, GameCore, WorldData } from '../../core/index'

import {
  createGameplayBatch,
  createGameplayEventStream,
  createRunEnded,
  createRunStarted,
  type RunStreamItem,
  type RunStreamSubscriber,
  type RunTerminalOutcome,
  type SessionId,
  type SetupModifier,
} from './gameplayEventStream'

export interface GameplaySession extends GameCore {
  readonly sessionId: SessionId
  subscribe(subscriber: RunStreamSubscriber): () => void
}

export interface GameplaySessionSubscriberError {
  readonly error: unknown
  readonly item: RunStreamItem
}

export interface GameplaySessionOptions {
  readonly appliedModifiers?: readonly SetupModifier[]
  readonly makeSessionId?: () => SessionId
  readonly onSubscriberError?: (report: GameplaySessionSubscriberError) => void
  readonly subscribers?: readonly RunStreamSubscriber[]
}

function defaultMakeSessionId(): SessionId {
  return crypto.randomUUID()
}

function isTerminalOutcome(status: GameplaySession['state']['status']): status is RunTerminalOutcome {
  return status === 'won' || status === 'lost'
}

function reportSubscriberError(
  item: RunStreamItem,
  error: unknown,
  onSubscriberError?: (report: GameplaySessionSubscriberError) => void,
): void {
  const report = {
    error,
    item: structuredClone(item),
  } satisfies GameplaySessionSubscriberError

  if (onSubscriberError === undefined) {
    console.error(`[gameplaySession] subscriber failed while emitting ${item.kind}`, report)
    return
  }

  try {
    onSubscriberError(report)
  } catch (reporterError) {
    console.error('[gameplaySession] subscriber error reporter failed', {
      report,
      reporterError,
    })
  }
}

function emitFromSession(
  stream: ReturnType<typeof createGameplayEventStream>,
  item: RunStreamItem,
  onSubscriberError?: (report: GameplaySessionSubscriberError) => void,
): void {
  try {
    stream.emit(item)
  } catch (error) {
    reportSubscriberError(item, error, onSubscriberError)
  }
}

export function createGameplaySession(
  catalog: CardCatalog,
  world: WorldData,
  seed: number,
  options: GameplaySessionOptions = {},
): GameplaySession {
  const stream = createGameplayEventStream()

  for (const subscriber of options.subscribers ?? []) {
    stream.subscribe(subscriber)
  }

  const core = createGame(catalog, world, seed)
  const sessionId = (options.makeSessionId ?? defaultMakeSessionId)()
  let runEnded = false

  emitFromSession(
    stream,
    createRunStarted({
      sessionId,
      worldId: core.state.worldId,
      seed,
      appliedModifiers: options.appliedModifiers ?? [],
    }),
    options.onSubscriberError,
  )

  return {
    sessionId,

    get state() {
      return core.state
    },

    dispatch(action: Action) {
      const resolution = core.dispatch(action)

      emitFromSession(stream, createGameplayBatch(sessionId, action, resolution), options.onSubscriberError)

      if (!runEnded && isTerminalOutcome(resolution.state.status)) {
        runEnded = true

        emitFromSession(
            stream,
            createRunEnded({
              sessionId,
              outcome: resolution.state.status,
              finalActIndex: resolution.state.actIndex,
            }),
            options.onSubscriberError,
        )
      }

      return resolution
    },

    availableActions() {
      return core.availableActions()
    },

    intensity() {
      return core.intensity()
    },

    subscribe(subscriber) {
      return stream.subscribe(subscriber)
    },
  }
}
