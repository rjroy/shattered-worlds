import type { Action, GameEvent, GameState } from '../../core/index'
import { clonePlain } from './clone'

export type SessionId = string

/**
 * Epoch-millisecond clock seam. Stream items are stamped at the runtime layer
 * (never inside the deterministic core); inject a fake clock in tests so
 * timestamps stay deterministic.
 */
export type Clock = () => number

export type RunTerminalOutcome = Extract<GameState['status'], 'won' | 'lost'>

// 'abandoned' closes a session that ends without reaching a gameplay-terminal
// state (the player exits the world, the scene shuts down mid-run).
export type RunOutcome = RunTerminalOutcome | 'abandoned'

export type SetupModifier = Readonly<{
  kind: string
  readonly [key: string]: unknown
}>

export interface RunStarted {
  readonly kind: 'RunStarted'
  readonly sessionId: SessionId
  readonly worldId: GameState['worldId']
  readonly seed: number
  readonly appliedModifiers: readonly SetupModifier[]
  /** Epoch ms from the session's {@link Clock}. */
  readonly timestamp: number
}

export interface GameplayDispatchResolution {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}

export interface GameplayBatch {
  readonly kind: 'GameplayBatch'
  readonly sessionId: SessionId
  readonly timestamp: number
  readonly action: Action
  readonly events: readonly GameEvent[]
  readonly state: GameState
}

export interface RunEnded {
  readonly kind: 'RunEnded'
  readonly sessionId: SessionId
  readonly outcome: RunOutcome
  readonly finalActIndex: GameState['actIndex']
  readonly timestamp: number
}

export type RunStreamItem = RunStarted | GameplayBatch | RunEnded
export type RunStreamSubscriber = (item: RunStreamItem) => unknown

export interface SubscriberFailure {
  readonly error: unknown
  readonly item: RunStreamItem
}

export type SubscriberFailureHandler = (failure: SubscriberFailure) => void

export interface GameplayEventStream {
  emit(item: RunStreamItem): void
  subscribe(subscriber: RunStreamSubscriber): () => void
}

// Walks enumerable string-keyed properties only, which covers GameState today
// because core state is plain data (no Map/Set). If core ever holds collection
// types, structuredClone preserves them but Object.freeze does not make their
// contents immutable — revisit this guarantee then.
function deepFreeze(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return

  seen.add(value)
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key], seen)
  }
  Object.freeze(value)
}

/**
 * Clones and deep-freezes once at construction. Every subscriber receives the
 * same immutable item: a mutation attempt throws (strict mode) and surfaces as
 * a subscriber failure instead of silently corrupting other consumers.
 */
function snapshot<T>(value: T): T {
  const clone = clonePlain(value)
  deepFreeze(clone, new WeakSet())
  return clone
}

export function createRunStarted(input: Omit<RunStarted, 'kind'>): RunStarted {
  return snapshot({
    kind: 'RunStarted',
    ...input,
  })
}

export function createGameplayBatch(
  sessionId: SessionId,
  action: Action,
  resolution: GameplayDispatchResolution,
  timestamp: number,
): GameplayBatch {
  return snapshot({
    kind: 'GameplayBatch',
    sessionId,
    timestamp,
    action,
    events: resolution.events,
    state: resolution.state,
  })
}

export function createRunEnded(input: Omit<RunEnded, 'kind'>): RunEnded {
  return snapshot({
    kind: 'RunEnded',
    ...input,
  })
}

/**
 * Multi-subscriber fan-out for run stream items. Delivery never throws back
 * into gameplay: every subscriber failure is reported through the handler
 * (console.error by default), and one failing subscriber cannot starve the
 * rest of the snapshot.
 */
export function createGameplayEventStream(
  onSubscriberFailure?: SubscriberFailureHandler,
): GameplayEventStream {
  const subscribers: { readonly notify: RunStreamSubscriber }[] = []

  function reportFailure(item: RunStreamItem, error: unknown): void {
    const failure: SubscriberFailure = { error, item }

    if (onSubscriberFailure === undefined) {
      console.error(`[gameplayEventStream] subscriber failed while handling ${item.kind}`, failure)
      return
    }

    try {
      onSubscriberFailure(failure)
    } catch (handlerError) {
      console.error('[gameplayEventStream] subscriber failure handler threw', {
        failure,
        handlerError,
      })
    }
  }

  return {
    emit(item) {
      for (const subscriber of [...subscribers]) {
        try {
          subscriber.notify(item)
        } catch (error) {
          reportFailure(item, error)
        }
      }
    },

    subscribe(subscriber) {
      const entry = { notify: subscriber }
      subscribers.push(entry)
      let active = true

      return () => {
        if (!active) return

        active = false
        const index = subscribers.indexOf(entry)
        if (index >= 0) {
          subscribers.splice(index, 1)
        }
      }
    },
  }
}
