import type { Action, GameEvent, GameState } from '../../core/index'

export type SessionId = string

export type RunTerminalOutcome = Extract<GameState['status'], 'won' | 'lost'>

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
}

export interface GameplayDispatchResolution {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}

export interface GameplayBatch {
  readonly kind: 'GameplayBatch'
  readonly sessionId: SessionId
  readonly action: Action
  readonly events: readonly GameEvent[]
  readonly state: GameState
}

export interface RunEnded {
  readonly kind: 'RunEnded'
  readonly sessionId: SessionId
  readonly outcome: RunTerminalOutcome
  readonly finalActIndex: GameState['actIndex']
}

export type RunStreamItem = RunStarted | GameplayBatch | RunEnded
export type RunStreamSubscriber = (item: RunStreamItem) => unknown

export interface GameplayEventStream {
  emit(item: RunStreamItem): void
  subscribe(subscriber: RunStreamSubscriber): () => void
}

function cloneSnapshot<T>(value: T): T {
  return structuredClone(value)
}

export function createRunStarted(input: Omit<RunStarted, 'kind'>): RunStarted {
  return cloneSnapshot({
    kind: 'RunStarted',
    ...input,
  })
}

export function createGameplayBatch(
  sessionId: SessionId,
  action: Action,
  resolution: GameplayDispatchResolution,
): GameplayBatch {
  return {
    kind: 'GameplayBatch',
    sessionId,
    action: cloneSnapshot(action),
    events: cloneSnapshot(resolution.events),
    state: cloneSnapshot(resolution.state),
  }
}

export function createRunEnded(input: Omit<RunEnded, 'kind'>): RunEnded {
  return cloneSnapshot({
    kind: 'RunEnded',
    ...input,
  })
}

export function createGameplayEventStream(): GameplayEventStream {
  const subscribers: { readonly notify: RunStreamSubscriber }[] = []

  return {
    emit(item) {
      const snapshot = [...subscribers]
      let firstError: unknown = undefined

      for (const subscriber of snapshot) {
        try {
          subscriber.notify(cloneSnapshot(item))
        } catch (error) {
          firstError ??= error
        }
      }

      if (firstError !== undefined) {
        throw firstError
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
