import { describe, expect, it } from 'bun:test'

import type { GameEvent, WorldData } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplayBatch, createRunEnded, createRunStarted } from './gameplayEventStream'
import { createGameplaySession } from './gameplaySession'
import { createRunStatsCollector, RUN_STATS_STORAGE_KEY, type RunStatsStorage } from './runStats'

function createMemoryStorage(initial?: Record<string, string>): RunStatsStorage & {
  dump(): Record<string, string>
} {
  const entries = new Map(Object.entries(initial ?? {}))

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    dump: () => Object.fromEntries(entries),
  }
}

function createGuaranteedWinWorldData(): WorldData {
  return {
    worldId: 'run-stats-win-world',
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

function sumProgress(events: readonly GameEvent[]): number {
  return events.reduce((total, event) => total + (event.type === 'ProgressDealt' ? event.amount : 0), 0)
}

describe('runStats collector', () => {
  it('derives a won run record purely from the event stream', () => {
    const collector = createRunStatsCollector()
    const session = createGameplaySession(catalog, createGuaranteedWinWorldData(), 42, {
      makeSessionId: () => 'stats-win',
      subscribers: [collector.subscriber],
    })
    const doorId = session.state.hand.find((card) => card.kind === 'world' && card.name === 'Door')?.id
    if (doorId === undefined) throw new Error('expected Door in opening hand')

    let expectedProgress = 0
    for (let plays = 0; plays < 2; plays += 1) {
      const exploreId = session.state.hand.find((card) => card.kind === 'player' && card.name === 'Explore')?.id
      if (exploreId === undefined) throw new Error('expected Explore in hand')

      const resolution = session.dispatch({ type: 'PlayCard', cardId: exploreId, targetId: doorId })
      expectedProgress += sumProgress(resolution.events)
    }

    expect(session.state.status).toBe('won')

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(1)
    expect(lifetime.wins).toBe(1)
    expect(lifetime.losses).toBe(0)
    expect(lifetime.abandoned).toBe(0)
    expect(lifetime.byWorld['run-stats-win-world']).toEqual({ runs: 1, wins: 1, losses: 0, abandoned: 0 })
    expect(lifetime.lastRun).toEqual({
      sessionId: 'stats-win',
      worldId: 'run-stats-win-world',
      seed: 42,
      outcome: 'won',
      finalActIndex: 0,
      turns: 0,
      cardsPlayed: 2,
      progressDealt: expectedProgress,
      damageTaken: 0,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    })
  })

  it('counts turns and records a loss for a run that times out', () => {
    const collector = createRunStatsCollector()
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'stats-loss',
      subscribers: [collector.subscriber],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    expect(session.state.status).toBe('lost')

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(1)
    expect(lifetime.losses).toBe(1)
    expect(lifetime.lastRun?.outcome).toBe('lost')
    expect(lifetime.lastRun?.turns).toBe(4)
    expect(lifetime.lastRun?.damageTaken).toBeGreaterThan(0)
  })

  it('records abandoned runs distinctly', () => {
    const collector = createRunStatsCollector()
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'stats-abandoned',
      subscribers: [collector.subscriber],
    })

    session.dispatch({ type: 'EndTurn' })
    session.abandon()

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(1)
    expect(lifetime.abandoned).toBe(1)
    expect(lifetime.wins).toBe(0)
    expect(lifetime.losses).toBe(0)
    expect(lifetime.lastRun?.outcome).toBe('abandoned')
    expect(lifetime.lastRun?.turns).toBe(1)
  })

  it('persists lifetime stats and reloads them in a fresh collector', () => {
    const storage = createMemoryStorage()
    const firstCollector = createRunStatsCollector(storage)
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'stats-persisted',
      subscribers: [firstCollector.subscriber],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    const secondCollector = createRunStatsCollector(storage)

    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeDefined()
    expect(secondCollector.lifetime()).toEqual(firstCollector.lifetime())
    expect(secondCollector.lifetime().runs).toBe(1)
  })

  it('starts fresh when stored stats are corrupt or have an unknown version', () => {
    const corrupt = createRunStatsCollector(createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: 'not json{' }))
    const wrongVersion = createRunStatsCollector(
      createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: JSON.stringify({ version: 99, runs: 50 }) }),
    )

    expect(corrupt.lifetime().runs).toBe(0)
    expect(wrongVersion.lifetime().runs).toBe(0)
  })

  it('rejects a version-1 payload with a malformed shape and keeps recording new runs', () => {
    // A bare { version: 1 } would crash foldIntoLifetime on undefined byWorld
    // if it were trusted; the collector must discard it and stay functional.
    const storage = createMemoryStorage({
      [RUN_STATS_STORAGE_KEY]: JSON.stringify({ version: 1 }),
    })
    const collector = createRunStatsCollector(storage)

    expect(collector.lifetime().runs).toBe(0)

    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'stats-recovered',
      subscribers: [collector.subscriber],
    })
    session.dispatch({ type: 'EndTurn' })
    session.abandon()

    expect(collector.lifetime().runs).toBe(1)
    // The bad payload was overwritten by a valid one.
    expect(createRunStatsCollector(storage).lifetime().runs).toBe(1)
  })

  it('rejects stored stats with non-numeric counters', () => {
    const storage = createMemoryStorage({
      [RUN_STATS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        runs: 'twelve',
        wins: 0,
        losses: 0,
        abandoned: 0,
        turns: 0,
        cardsPlayed: 0,
        progressDealt: 0,
        damageTaken: 0,
        hazardsResolved: 0,
        hazardsDiscarded: 0,
        cardsDiscarded: 0,
        byWorld: {},
      }),
    })

    expect(createRunStatsCollector(storage).lifetime().runs).toBe(0)
  })

  it('keeps in-memory stats when storage writes fail', () => {
    const storage: RunStatsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    const collector = createRunStatsCollector(storage)
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'stats-write-fail',
      subscribers: [collector.subscriber],
    })

    session.dispatch({ type: 'EndTurn' })
    expect(() => session.abandon()).not.toThrow()
    expect(collector.lifetime().runs).toBe(1)
  })

  it('ignores partially observed runs instead of recording understated counts', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    // A batch and run-end for a session whose RunStarted was never observed.
    collector.subscriber(
      createGameplayBatch('unseen-session', { type: 'EndTurn' }, {
        state,
        events: [{ type: 'TurnEnded' }],
      }),
    )
    collector.subscriber(createRunEnded({ sessionId: 'unseen-session', outcome: 'lost', finalActIndex: 0 }))

    expect(collector.lifetime().runs).toBe(0)
  })

  it('tracks concurrent sessions independently by session id', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    collector.subscriber(createRunStarted({ sessionId: 'a', worldId: 'world-a', seed: 1, appliedModifiers: [] }))
    collector.subscriber(createRunStarted({ sessionId: 'b', worldId: 'world-b', seed: 2, appliedModifiers: [] }))
    collector.subscriber(
      createGameplayBatch('a', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }),
    )
    collector.subscriber(createRunEnded({ sessionId: 'a', outcome: 'won', finalActIndex: 0 }))
    collector.subscriber(createRunEnded({ sessionId: 'b', outcome: 'lost', finalActIndex: 1 }))

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(2)
    expect(lifetime.byWorld).toEqual({
      'world-a': { runs: 1, wins: 1, losses: 0, abandoned: 0 },
      'world-b': { runs: 1, wins: 0, losses: 1, abandoned: 0 },
    })
    expect(lifetime.lastRun?.sessionId).toBe('b')
    expect(lifetime.lastRun?.turns).toBe(0)
  })

  it('returns lifetime copies that cannot mutate collector state', () => {
    const collector = createRunStatsCollector()
    const copy = collector.lifetime() as { runs: number }

    copy.runs = 999

    expect(collector.lifetime().runs).toBe(0)
  })
})
