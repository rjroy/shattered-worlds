import { createGame } from '../../core/index'
import type { Action, CardCatalog, GameCore, WorldData } from '../../core/index'

import {
  createGameplayBatch,
  createGameplayEventStream,
  createRunEnded,
  createRunStarted,
  type Clock,
  type GameplayEventStream,
  type RunOutcome,
  type RunStreamSubscriber,
  type RunTerminalOutcome,
  type SessionId,
  type SetupModifier,
  type SubscriberFailureHandler,
} from './gameplayEventStream'

export interface GameplaySession extends GameCore {
  readonly sessionId: SessionId
  /** Session-scoped observation: delivers only this session's stream items. */
  subscribe(subscriber: RunStreamSubscriber): () => void
  /**
   * Closes the run with outcome 'abandoned' if no terminal outcome was
   * reached. No-op once the run has ended; call on scene shutdown so every
   * session closes its stream exactly once.
   */
  abandon(): void
}

export interface GameplaySessionOptions {
  readonly appliedModifiers?: readonly SetupModifier[]
  /** Stamps every stream item this session emits. Defaults to Date.now. */
  readonly clock?: Clock | undefined
  readonly makeSessionId?: () => SessionId
  /**
   * Failure handling for the session's privately created stream. Ignored when
   * `stream` is provided: a shared stream keeps the handler it was created
   * with at the composition root.
   */
  readonly onSubscriberFailure?: SubscriberFailureHandler
  /** Shared long-lived stream to emit into (see createGameplayRuntime). */
  readonly stream?: GameplayEventStream
  readonly subscribers?: readonly RunStreamSubscriber[]
}

function defaultMakeSessionId(): SessionId {
  return crypto.randomUUID()
}

function isTerminalOutcome(status: GameCore['state']['status']): status is RunTerminalOutcome {
  return status === 'won' || status === 'lost'
}

function onlySession(sessionId: SessionId, subscriber: RunStreamSubscriber): RunStreamSubscriber {
  return (item) => {
    if (item.sessionId === sessionId) {
      return subscriber(item)
    }
  }
}

export function createGameplaySession(
  catalog: CardCatalog,
  world: WorldData,
  seed: number,
  options: GameplaySessionOptions = {},
): GameplaySession {
  const stream = options.stream ?? createGameplayEventStream(options.onSubscriberFailure)
  const sessionId = (options.makeSessionId ?? defaultMakeSessionId)()
  const clock = options.clock ?? (() => Date.now())
  const core = createGame(catalog, world, seed)

  // Session-scoped subscriptions are released when the run closes: after
  // RunEnded this session emits nothing more, and a shared stream must not
  // accumulate dead filters across runs.
  const sessionUnsubscribes: (() => void)[] = []
  let runEnded = false

  function subscribeForSession(subscriber: RunStreamSubscriber): () => void {
    const releaseFromStream = stream.subscribe(onlySession(sessionId, subscriber))
    const unsubscribe = () => {
      releaseFromStream()

      const index = sessionUnsubscribes.indexOf(unsubscribe)
      if (index >= 0) {
        sessionUnsubscribes.splice(index, 1)
      }
    }

    sessionUnsubscribes.push(unsubscribe)
    return unsubscribe
  }

  function closeRun(outcome: RunOutcome, finalActIndex: number): void {
    runEnded = true
    stream.emit(createRunEnded({ sessionId, outcome, finalActIndex, timestamp: clock() }))

    // Each unsubscribe removes itself from the list; iterate over a copy.
    for (const unsubscribe of [...sessionUnsubscribes]) {
      unsubscribe()
    }
  }

  for (const subscriber of options.subscribers ?? []) {
    subscribeForSession(subscriber)
  }

  stream.emit(
    createRunStarted({
      sessionId,
      worldId: core.state.worldId,
      seed,
      appliedModifiers: options.appliedModifiers ?? [],
      timestamp: clock(),
    }),
  )

  return {
    sessionId,

    get state() {
      return core.state
    },

    dispatch(action: Action) {
      // After abandon the core may still be 'playing'; refusing here keeps the
      // close-exactly-once invariant (no batches after RunEnded, no second
      // outcome). Post-win/loss dispatch already throws inside the core.
      if (runEnded) {
        throw new Error(`[gameplaySession] dispatch after run closed (session ${sessionId})`)
      }

      const resolution = core.dispatch(action)

      stream.emit(createGameplayBatch(sessionId, action, resolution, clock()))

      if (!runEnded && isTerminalOutcome(resolution.state.status)) {
        closeRun(resolution.state.status, resolution.state.actIndex)
      }

      return resolution
    },

    abandon() {
      if (runEnded) return
      closeRun('abandoned', core.state.actIndex)
    },

    availableActions() {
      return core.availableActions()
    },

    intensity() {
      return core.intensity()
    },

    subscribe(subscriber) {
      if (runEnded) return () => {}
      return subscribeForSession(subscriber)
    },
  }
}
