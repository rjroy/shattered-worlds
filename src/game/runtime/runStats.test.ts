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
    // Clock reads: RunStarted 10100, two batches 10200/10300, RunEnded 10400.
    let now = 10_000
    const session = createGameplaySession(catalog, createGuaranteedWinWorldData(), 42, {
      makeSessionId: () => 'stats-win',
      appliedModifiers: [{ kind: 'hard-mode' }, { kind: 'bonus-card', templateId: 'Listen' }],
      clock: () => (now += 100),
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
    expect(lifetime.durationMs).toBe(300)
    expect(lifetime.lastRun).toEqual({
      sessionId: 'stats-win',
      worldId: 'run-stats-win-world',
      seed: 42,
      appliedModifiers: [{ kind: 'hard-mode' }, { kind: 'bonus-card', templateId: 'Listen' }],
      outcome: 'won',
      finalActIndex: 0,
      startedAt: 10_100,
      endedAt: 10_400,
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
        durationMs: 0,
        byWorld: {},
      }),
    })

    expect(createRunStatsCollector(storage).lifetime().runs).toBe(0)
  })

  it('rejects stored stats whose lastRun is missing run-record fields', () => {
    // Valid counters but a lastRun from an older shape (no timestamps): trusting
    // it would hand consumers a RunRecord whose declared fields are undefined.
    const validCounters = {
      version: 1,
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
      turns: 3,
      cardsPlayed: 5,
      progressDealt: 9,
      damageTaken: 2,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 4,
      durationMs: 1_000,
      byWorld: {},
    }
    const storage = createMemoryStorage({
      [RUN_STATS_STORAGE_KEY]: JSON.stringify({
        ...validCounters,
        lastRun: { sessionId: 'old-run', worldId: 'w', seed: 1, outcome: 'won', finalActIndex: 0 },
      }),
    })

    expect(createRunStatsCollector(storage).lifetime().runs).toBe(0)
  })

  it('rejects stored stats whose lastRun has malformed appliedModifiers', () => {
    const validLastRun = {
      sessionId: 'run',
      worldId: 'w',
      seed: 1,
      appliedModifiers: [{ kind: 'hard-mode' }],
      outcome: 'won',
      finalActIndex: 0,
      startedAt: 1_000,
      endedAt: 2_000,
      turns: 1,
      cardsPlayed: 2,
      progressDealt: 3,
      damageTaken: 0,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    }
    const validPayload = {
      version: 1,
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
      turns: 1,
      cardsPlayed: 2,
      progressDealt: 3,
      damageTaken: 0,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
      durationMs: 1_000,
      byWorld: {},
      lastRun: validLastRun,
    }

    // Control: the fully valid payload loads.
    const valid = createRunStatsCollector(
      createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: JSON.stringify(validPayload) }),
    )
    expect(valid.lifetime().runs).toBe(1)

    // Same payload with modifiers that aren't kind-tagged objects is discarded.
    const malformed = createRunStatsCollector(
      createMemoryStorage({
        [RUN_STATS_STORAGE_KEY]: JSON.stringify({
          ...validPayload,
          lastRun: { ...validLastRun, appliedModifiers: ['hard-mode'] },
        }),
      }),
    )
    expect(malformed.lifetime().runs).toBe(0)
  })

  it('clamps a negative run duration to zero when the clock jumps backwards', () => {
    const collector = createRunStatsCollector()

    collector.subscriber(
      createRunStarted({ sessionId: 'skewed', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 5_000 }),
    )
    collector.subscriber(createRunEnded({ sessionId: 'skewed', outcome: 'lost', finalActIndex: 0, timestamp: 4_000 }))

    const lifetime = collector.lifetime()

    expect(lifetime.durationMs).toBe(0)
    // The raw timestamps stay truthful; only the folded duration is clamped.
    expect(lifetime.lastRun?.startedAt).toBe(5_000)
    expect(lifetime.lastRun?.endedAt).toBe(4_000)
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
      }, 1_100),
    )
    collector.subscriber(
      createRunEnded({ sessionId: 'unseen-session', outcome: 'lost', finalActIndex: 0, timestamp: 1_200 }),
    )

    expect(collector.lifetime().runs).toBe(0)
  })

  it('tracks concurrent sessions independently by session id', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    collector.subscriber(
      createRunStarted({ sessionId: 'a', worldId: 'world-a', seed: 1, appliedModifiers: [], timestamp: 1_000 }),
    )
    collector.subscriber(
      createRunStarted({
        sessionId: 'b',
        worldId: 'world-b',
        seed: 2,
        appliedModifiers: [{ kind: 'hard-mode' }],
        timestamp: 2_000,
      }),
    )
    collector.subscriber(
      createGameplayBatch('a', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }, 1_100),
    )
    collector.subscriber(createRunEnded({ sessionId: 'a', outcome: 'won', finalActIndex: 0, timestamp: 1_500 }))
    collector.subscriber(createRunEnded({ sessionId: 'b', outcome: 'lost', finalActIndex: 1, timestamp: 2_700 }))

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(2)
    expect(lifetime.byWorld).toEqual({
      'world-a': { runs: 1, wins: 1, losses: 0, abandoned: 0 },
      'world-b': { runs: 1, wins: 0, losses: 1, abandoned: 0 },
    })
    expect(lifetime.lastRun?.sessionId).toBe('b')
    expect(lifetime.lastRun?.turns).toBe(0)
    // Durations are computed per session, not from interleaved stream order.
    expect(lifetime.durationMs).toBe(500 + 700)
    expect(lifetime.lastRun?.startedAt).toBe(2_000)
    expect(lifetime.lastRun?.endedAt).toBe(2_700)
    // Setup is captured per session: b's modifiers, not a's empty list.
    expect(lifetime.lastRun?.appliedModifiers).toEqual([{ kind: 'hard-mode' }])
  })

  it('returns lifetime copies that cannot mutate collector state', () => {
    const collector = createRunStatsCollector()
    const copy = collector.lifetime() as { runs: number }

    copy.runs = 999

    expect(collector.lifetime().runs).toBe(0)
  })
})
