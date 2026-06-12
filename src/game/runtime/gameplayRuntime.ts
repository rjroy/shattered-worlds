import type { CardCatalog, WorldData } from '../../core/index'

import {
  createGameplayEventStream,
  type Clock,
  type GameplayEventStream,
  type RunStreamSubscriber,
  type SubscriberFailureHandler,
} from './gameplayEventStream'
import { createGameplaySession, type GameplaySession, type GameplaySessionOptions } from './gameplaySession'
import { createRunStatsCollector, type RunStatsReader, type RunStatsStorage } from './runStats'
import { createStatsTransfer, type StatsTransfer } from './statsTransfer'

// The runtime owns the stream, failure handling, and the clock — sessions it
// starts must not override them, or cross-run consumers would see
// inconsistently sourced items.
type RuntimeSessionOptions = Omit<GameplaySessionOptions, 'stream' | 'onSubscriberFailure' | 'clock'>

/**
 * Composition root for gameplay observation. Owns the one long-lived stream
 * that every session emits into, so cross-run consumers (run stats, future
 * meta progression and save policy) subscribe once at boot and see every
 * session's full RunStarted → RunEnded history.
 */
export interface GameplayRuntime {
  readonly stream: GameplayEventStream
  readonly runStats: RunStatsReader
  readonly statsTransfer: StatsTransfer
  /** Runtime-wide observation: receives items from every session, correlated by sessionId. */
  subscribe(subscriber: RunStreamSubscriber): () => void
  startSession(
    catalog: CardCatalog,
    world: WorldData,
    seed: number,
    options?: RuntimeSessionOptions,
  ): GameplaySession
  /**
   * Closes every still-open session as 'abandoned'. Wire to page unload
   * (pagehide) so app-level exits close run streams the scene shutdown hook
   * never sees. No-op for sessions that already ended.
   */
  abandonAll(): void
}

export interface GameplayRuntimeOptions {
  /** Omit for in-memory-only stats (tests, headless). */
  readonly storage?: RunStatsStorage | undefined
  readonly onSubscriberFailure?: SubscriberFailureHandler | undefined
  /** Stamps all sessions' stream items. Defaults to Date.now; inject in tests. */
  readonly clock?: Clock | undefined
  readonly visibility?: (() => boolean) | undefined
  readonly subscribeVisibility?: ((onChange: () => void) => () => void) | undefined
}

export function createGameplayRuntime(options: GameplayRuntimeOptions = {}): GameplayRuntime {
  const stream = createGameplayEventStream(options.onSubscriberFailure)
  const runStats = createRunStatsCollector({
    storage: options.storage,
    clock: options.clock,
    visibility: options.visibility,
    subscribeVisibility: options.subscribeVisibility,
  })
  const statsTransfer =
    options.clock === undefined ? createStatsTransfer(runStats) : createStatsTransfer(runStats, options.clock)
  const openSessions = new Map<GameplaySession['sessionId'], GameplaySession>()

  stream.subscribe(runStats.subscriber)
  stream.subscribe((item) => {
    if (item.kind === 'RunEnded') {
      openSessions.delete(item.sessionId)
    }
  })

  return {
    stream,
    runStats,
    statsTransfer,

    subscribe(subscriber) {
      return stream.subscribe(subscriber)
    },

    startSession(catalog, world, seed, sessionOptions = {}) {
      const session = createGameplaySession(catalog, world, seed, {
        ...sessionOptions,
        stream,
        clock: options.clock,
      })
      openSessions.set(session.sessionId, session)
      return session
    },

    abandonAll() {
      // abandon() emits RunEnded, which prunes the map mid-loop; copy first.
      for (const session of [...openSessions.values()]) {
        session.abandon()
      }
    },
  }
}
