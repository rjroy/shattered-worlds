import { describe, expect, it } from 'bun:test'

import type { AssembledWorld, WorldData } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplayRuntime } from './gameplayRuntime'
import type { RunStreamItem, SubscriberFailure } from './gameplayEventStream'
import { RUN_STATS_STORAGE_KEY, type RunStatsStorage } from './runStats'

function createGuaranteedWinWorldData(): WorldData {
  return {
    worldId: 'runtime-win-world',
    starterDeck: [{ templateId: 'Explore', count: 4 }],
    deckComposition: {
      acts: [
        {
          cards: [{ templateId: 'Door', count: 2 }],
        },
      ],
    },
  }
}

function createMemoryStorage(): RunStatsStorage & { dump(): Record<string, string> } {
  const entries = new Map<string, string>()

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    removeItem: (key) => {
      entries.delete(key)
    },
    dump: () => Object.fromEntries(entries),
  }
}

const testWorld: AssembledWorld = { catalog, worldData }

function startTestSession(
  runtime: ReturnType<typeof createGameplayRuntime>,
  seed: number,
  options: Parameters<ReturnType<typeof createGameplayRuntime>['startSession']>[2] = {},
) {
  return runtime.startSession(worldData.worldId, seed, { world: testWorld, ...options })
}

describe('gameplayRuntime composition root', () => {
  it('lets a runtime-wide subscriber observe every session from start to close', () => {
    const runtime = createGameplayRuntime()
    const observed: RunStreamItem[] = []
    runtime.subscribe((item) => observed.push(item))

    const first = startTestSession(runtime, 42, { makeSessionId: () => 'run-1' })
    first.dispatch({ type: 'EndTurn' })
    first.abandon()

    const second = startTestSession(runtime, 17, { makeSessionId: () => 'run-2' })
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

    const session = startTestSession(runtime, 17, { makeSessionId: () => 'stats-run' })
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

    const first = startTestSession(runtime, 42, { makeSessionId: () => 'timed-1' })
    first.dispatch({ type: 'EndTurn' })
    first.abandon()

    const second = startTestSession(runtime, 42, { makeSessionId: () => 'timed-2' })
    second.dispatch({ type: 'EndTurn' })
    second.abandon()

    const lifetime = runtime.runStats.lifetime()

    // First run: started 1000, ended 3000. Second run: started 4000, ended 6000.
    expect(lifetime.durationMs).toBe(0)
    expect(lifetime.lastRun?.startedAt).toBe(4_000)
    expect(lifetime.lastRun?.endedAt).toBe(6_000)
  })

  it('counts abandoned sessions so exits mid-run still close the stream', () => {
    const runtime = createGameplayRuntime()

    const session = startTestSession(runtime, 42)
    session.dispatch({ type: 'EndTurn' })
    session.abandon()

    expect(runtime.runStats.lifetime().abandoned).toBe(1)
  })

  it('abandonAll closes only still-open sessions, exactly once', () => {
    const runtime = createGameplayRuntime()
    const observed: RunStreamItem[] = []
    runtime.subscribe((item) => observed.push(item))

    // One session finishes (lost), one stays open at page exit.
    const finished = startTestSession(runtime, 17, { makeSessionId: () => 'finished' })
    for (let turn = 0; turn < 4; turn += 1) {
      finished.dispatch({ type: 'EndTurn' })
    }

    const open = startTestSession(runtime, 42, { makeSessionId: () => 'open' })
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

    const session = startTestSession(runtime, 42, { makeSessionId: () => 'failing-run' })

    expect(() => session.dispatch({ type: 'EndTurn' })).not.toThrow()
    expect(failures.length).toBeGreaterThanOrEqual(2)
    expect(failures.every((failure) => failure.item.sessionId === 'failing-run')).toBe(true)
  })

  it('keeps deterministic gameplay identical with and without runtime observation', () => {
    const observedRuntime = createGameplayRuntime({ storage: createMemoryStorage() })
    observedRuntime.subscribe(() => {})

    const observed = startTestSession(observedRuntime, 42)
    const bare = startTestSession(createGameplayRuntime(), 42)

    for (let turn = 0; turn < 3; turn += 1) {
      const observedResult = observed.dispatch({ type: 'EndTurn' })
      const bareResult = bare.dispatch({ type: 'EndTurn' })

      expect(observedResult).toEqual(bareResult)
    }

    expect(observed.state).toEqual(bare.state)
  })

  it('wires featEvaluator so first-survivor is earned after a won run (REQ-FEAT-12, REQ-FEAT-13)', () => {
    const winWorldData = createGuaranteedWinWorldData()
    const runtime = createGameplayRuntime()
    const session = runtime.startSession(winWorldData.worldId, 42, {
      world: { catalog, worldData: winWorldData },
    })

    const doorId = session.state.hand.find((card) => card.kind === 'world' && card.name === 'Door')?.id
    if (doorId === undefined) throw new Error('expected Door in opening hand')

    for (let plays = 0; plays < 2; plays += 1) {
      const exploreId = session.state.hand.find((card) => card.kind === 'player' && card.name === 'Explore')?.id
      if (exploreId === undefined) throw new Error('expected Explore in hand')
      session.dispatch({ type: 'PlayCard', cardId: exploreId, targetId: doorId })
    }

    expect(session.state.status).toBe('won')
    expect(runtime.featEvaluator.lastRunEarned().find((d) => d.id === 'first-survivor')).toBeDefined()
  })

  it('applies only activated unlocks to run modifiers and RunStarted metadata', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'shattered-worlds/unlocks/v1',
      JSON.stringify({
        version: 1,
        purchased: ['extra-hp', 'extra-energy'],
        activated: ['extra-hp'],
      }),
    )
    const runtime = createGameplayRuntime({ storage })
    const observed: RunStreamItem[] = []
    runtime.subscribe((item) => observed.push(item))

    const session = startTestSession(runtime, 42)

    expect(session.state.runModifiers.extraStartHp).toBe(3)
    expect(session.state.runModifiers.extraStartEnergy).toBe(0)
    expect(observed[0]).toMatchObject({
      kind: 'RunStarted',
      appliedModifiers: [{ kind: 'unlock', id: 'extra-hp' }],
    })
  })
})
