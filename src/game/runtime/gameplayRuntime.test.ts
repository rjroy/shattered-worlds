import { describe, expect, it } from 'bun:test'

import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplayRuntime } from './gameplayRuntime'
import type { RunStreamItem, SubscriberFailure } from './gameplayEventStream'
import { RUN_STATS_STORAGE_KEY, type RunStatsStorage } from './runStats'

function createMemoryStorage(): RunStatsStorage & { dump(): Record<string, string> } {
  const entries = new Map<string, string>()

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    dump: () => Object.fromEntries(entries),
  }
}

describe('gameplayRuntime composition root', () => {
  it('lets a runtime-wide subscriber observe every session from start to close', () => {
    const runtime = createGameplayRuntime()
    const observed: RunStreamItem[] = []
    runtime.subscribe((item) => observed.push(item))

    const first = runtime.startSession(catalog, worldData, 42, { makeSessionId: () => 'run-1' })
    first.dispatch({ type: 'EndTurn' })
    first.abandon()

    const second = runtime.startSession(catalog, worldData, 17, { makeSessionId: () => 'run-2' })
    for (let turn = 0; turn < 4; turn += 1) {
      second.dispatch({ type: 'EndTurn' })
    }

    expect(second.state.status).toBe('lost')
    expect(observed.map((item) => `${item.sessionId}:${item.kind}`)).toEqual([
      'run-1:RunStarted',
      'run-1:GameplayBatch',
      'run-1:RunEnded',
      'run-2:RunStarted',
      'run-2:GameplayBatch',
      'run-2:GameplayBatch',
      'run-2:GameplayBatch',
      'run-2:GameplayBatch',
      'run-2:RunEnded',
    ])
  })

  it('feeds the built-in run stats collector and persists to the provided storage', () => {
    const storage = createMemoryStorage()
    const runtime = createGameplayRuntime({ storage })

    const session = runtime.startSession(catalog, worldData, 17, { makeSessionId: () => 'stats-run' })
    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    const lifetime = runtime.runStats.lifetime()

    expect(lifetime.runs).toBe(1)
    expect(lifetime.losses).toBe(1)
    expect(lifetime.lastRun?.sessionId).toBe('stats-run')
    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeDefined()

    const persisted: unknown = JSON.parse(storage.dump()[RUN_STATS_STORAGE_KEY]!)
    expect(persisted).toEqual(lifetime)
  })

  it('stamps every session from the runtime clock so run stats can track durations', () => {
    // Clock reads per session: RunStarted, one batch, RunEnded → +3 per run.
    let now = 0
    const runtime = createGameplayRuntime({ clock: () => (now += 1_000) })

    const first = runtime.startSession(catalog, worldData, 42, { makeSessionId: () => 'timed-1' })
    first.dispatch({ type: 'EndTurn' })
    first.abandon()

    const second = runtime.startSession(catalog, worldData, 42, { makeSessionId: () => 'timed-2' })
    second.dispatch({ type: 'EndTurn' })
    second.abandon()

    const lifetime = runtime.runStats.lifetime()

    // First run: started 1000, ended 3000. Second run: started 4000, ended 6000.
    expect(lifetime.durationMs).toBe(4_000)
    expect(lifetime.lastRun?.startedAt).toBe(4_000)
    expect(lifetime.lastRun?.endedAt).toBe(6_000)
  })

  it('counts abandoned sessions so exits mid-run still close the stream', () => {
    const runtime = createGameplayRuntime()

    const session = runtime.startSession(catalog, worldData, 42)
    session.dispatch({ type: 'EndTurn' })
    session.abandon()

    expect(runtime.runStats.lifetime().abandoned).toBe(1)
  })

  it('abandonAll closes only still-open sessions, exactly once', () => {
    const runtime = createGameplayRuntime()
    const observed: RunStreamItem[] = []
    runtime.subscribe((item) => observed.push(item))

    // One session finishes (lost), one stays open at page exit.
    const finished = runtime.startSession(catalog, worldData, 17, { makeSessionId: () => 'finished' })
    for (let turn = 0; turn < 4; turn += 1) {
      finished.dispatch({ type: 'EndTurn' })
    }

    const open = runtime.startSession(catalog, worldData, 42, { makeSessionId: () => 'open' })
    open.dispatch({ type: 'EndTurn' })

    runtime.abandonAll()
    runtime.abandonAll()

    const runEnded = observed.filter((item) => item.kind === 'RunEnded')
    expect(runEnded.map((item) => `${item.sessionId}:${'outcome' in item ? item.outcome : ''}`)).toEqual([
      'finished:lost',
      'open:abandoned',
    ])

    const lifetime = runtime.runStats.lifetime()
    expect(lifetime.runs).toBe(2)
    expect(lifetime.losses).toBe(1)
    expect(lifetime.abandoned).toBe(1)
  })

  it('routes subscriber failures to the configured handler without breaking dispatch', () => {
    const failures: SubscriberFailure[] = []
    const runtime = createGameplayRuntime({ onSubscriberFailure: (failure) => failures.push(failure) })
    runtime.subscribe(() => {
      throw new Error('runtime subscriber failed')
    })

    const session = runtime.startSession(catalog, worldData, 42, { makeSessionId: () => 'failing-run' })

    expect(() => session.dispatch({ type: 'EndTurn' })).not.toThrow()
    expect(failures.length).toBeGreaterThanOrEqual(2)
    expect(failures.every((failure) => failure.item.sessionId === 'failing-run')).toBe(true)
  })

  it('keeps deterministic gameplay identical with and without runtime observation', () => {
    const observedRuntime = createGameplayRuntime({ storage: createMemoryStorage() })
    observedRuntime.subscribe(() => {})

    const observed = observedRuntime.startSession(catalog, worldData, 42)
    const bare = createGameplayRuntime().startSession(catalog, worldData, 42)

    for (let turn = 0; turn < 3; turn += 1) {
      const observedResult = observed.dispatch({ type: 'EndTurn' })
      const bareResult = bare.dispatch({ type: 'EndTurn' })

      expect(observedResult).toEqual(bareResult)
    }

    expect(observed.state).toEqual(bare.state)
  })
})
