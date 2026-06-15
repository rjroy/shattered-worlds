import { describe, expect, it } from 'bun:test'

import type { GameEvent, WorldData } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplayBatch, createRunEnded, createRunStarted } from './gameplayEventStream'
import { createGameplaySession } from './gameplaySession'
import {
  createRunStatsCollector,
  isRunRecord,
  RUN_STATS_LEGACY_V1_KEY,
  RUN_STATS_STORAGE_KEY,
  type RunStatsStorage,
} from './runStats'
import { RUN_HISTORY_STORAGE_KEY } from './runHistory'

/** A real GameState sourced from the test fixture — used as a stub wherever
 *  createRunStarted/createRunEnded require state but the test doesn't care about it. */
const stubState = createGameplaySession(catalog, worldData, 42).state

function createMemoryStorage(initial?: Record<string, string>): RunStatsStorage & {
  dump(): Record<string, string>
} {
  const entries = new Map(Object.entries(initial ?? {}))

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
    expect(lifetime.byWorld['run-stats-win-world']).toEqual({
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
      fewestTurnsWin: 0,
      mostProgressInRun: expectedProgress,
    })
    expect(lifetime.durationMs).toBe(300)
    expect(lifetime.lastRun).toMatchObject({
      sessionId: 'stats-win',
      worldId: 'run-stats-win-world',
      seed: 42,
      appliedModifiers: [{ kind: 'hard-mode' }, { kind: 'bonus-card', templateId: 'Listen' }],
      outcome: 'won',
      finalActIndex: 0,
      startedAt: 10_100,
      endedAt: 10_400,
      activeDurationMs: 300,
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
    expect(lifetime.turns).toBe(0)
    expect(lifetime.damageTaken).toBe(0)
    expect(lifetime.durationMs).toBe(0)
    expect(lifetime.lastRun?.outcome).toBe('abandoned')
    expect(lifetime.lastRun?.turns).toBe(1)
    expect(collector.history()[0]).toMatchObject({
      sessionId: 'stats-abandoned',
      outcome: 'abandoned',
      turns: 1,
    })
  })

  it('appends finalized runs to history and ignores partially observed run endings', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    collector.subscriber(
      createRunStarted({ sessionId: 'seen', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    collector.subscriber(
      createGameplayBatch('seen', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }, 1_100),
    )
    collector.subscriber(createRunEnded({ sessionId: 'seen', outcome: 'lost', finalActIndex: 0, timestamp: 1_200, finalState: stubState }))
    collector.subscriber(createRunEnded({ sessionId: 'unseen', outcome: 'lost', finalActIndex: 0, timestamp: 1_300, finalState: stubState }))

    expect(collector.history().map((run) => run.sessionId)).toEqual(['seen'])
    expect(collector.history()[0]?.turns).toBe(1)
  })

  it('persists lifetime stats and reloads them in a fresh collector', () => {
    const storage = createMemoryStorage()
    const firstCollector = createRunStatsCollector({ storage })
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'stats-persisted',
      subscribers: [firstCollector.subscriber],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    const secondCollector = createRunStatsCollector({ storage })

    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeDefined()
    expect(secondCollector.lifetime()).toEqual(firstCollector.lifetime())
    expect(secondCollector.history()).toEqual(firstCollector.history())
    expect(secondCollector.lifetime().runs).toBe(1)
  })

  it('loads lifetime and history independently when either stored payload is corrupt', () => {
    const storage = createMemoryStorage()
    const firstCollector = createRunStatsCollector({ storage })
    firstCollector.subscriber(
      createRunStarted({ sessionId: 'stored-run', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    firstCollector.subscriber(createRunEnded({ sessionId: 'stored-run', outcome: 'lost', finalActIndex: 0, timestamp: 2_000, finalState: stubState }))

    storage.setItem(RUN_HISTORY_STORAGE_KEY, 'bad history{')
    const withBadHistory = createRunStatsCollector({ storage })
    expect(withBadHistory.lifetime().runs).toBe(1)
    expect(withBadHistory.history()).toEqual([])

    storage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, records: firstCollector.history() }))
    storage.setItem(RUN_STATS_STORAGE_KEY, 'bad lifetime{')
    const withBadLifetime = createRunStatsCollector({ storage })
    expect(withBadLifetime.lifetime().runs).toBe(0)
    expect(withBadLifetime.history().map((run) => run.sessionId)).toEqual(['stored-run'])
  })

  it('starts fresh when stored stats are corrupt or have an unknown version', () => {
    const corrupt = createRunStatsCollector({ storage: createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: 'not json{' }) })
    const wrongVersion = createRunStatsCollector({
      storage: createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: JSON.stringify({ version: 99, runs: 50 }) }),
    })

    expect(corrupt.lifetime().runs).toBe(0)
    expect(wrongVersion.lifetime().runs).toBe(0)
  })

  it('rejects a version-1 payload with a malformed shape and keeps recording new runs', () => {
    // A bare { version: 1 } would crash foldIntoLifetime on undefined byWorld
    // if it were trusted; the collector must discard it and stay functional.
    const storage = createMemoryStorage({
      [RUN_STATS_STORAGE_KEY]: JSON.stringify({ version: 1 }),
    })
    const collector = createRunStatsCollector({ storage })

    expect(collector.lifetime().runs).toBe(0)

    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'stats-recovered',
      subscribers: [collector.subscriber],
    })
    session.dispatch({ type: 'EndTurn' })
    session.abandon()

    expect(collector.lifetime().runs).toBe(1)
    // The bad payload was overwritten by a valid one.
    expect(createRunStatsCollector({ storage }).lifetime().runs).toBe(1)
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

    expect(createRunStatsCollector({ storage }).lifetime().runs).toBe(0)
  })

  it('rejects stored stats whose lastRun is missing run-record fields', () => {
    // Valid counters but a lastRun from an older shape (no timestamps): trusting
    // it would hand consumers a RunRecord whose declared fields are undefined.
    const validCounters = {
      version: 2,
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

    expect(createRunStatsCollector({ storage }).lifetime().runs).toBe(0)
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
      activeDurationMs: 1_000,
      turns: 1,
      cardsPlayed: 2,
      progressDealt: 3,
      damageTaken: 0,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    }
    const validPayload = {
      version: 2,
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
    const valid = createRunStatsCollector({
      storage: createMemoryStorage({ [RUN_STATS_STORAGE_KEY]: JSON.stringify(validPayload) }),
    })
    expect(valid.lifetime().runs).toBe(1)

    // Same payload with modifiers that aren't kind-tagged objects is discarded.
    const malformed = createRunStatsCollector({
      storage: createMemoryStorage({
        [RUN_STATS_STORAGE_KEY]: JSON.stringify({
          ...validPayload,
          lastRun: { ...validLastRun, appliedModifiers: ['hard-mode'] },
        }),
      }),
    })
    expect(malformed.lifetime().runs).toBe(0)
  })

  it('migrates a valid v1 payload from the legacy key and removes it only after first persist', () => {
    const legacyPayload = {
      version: 1,
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
      turns: 3,
      cardsPlayed: 4,
      progressDealt: 9,
      damageTaken: 2,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 1,
      durationMs: 1_500,
      byWorld: {
        legacy: { runs: 1, wins: 1, losses: 0, abandoned: 0 },
      },
      lastRun: {
        sessionId: 'legacy-run',
        worldId: 'legacy',
        seed: 11,
        appliedModifiers: [],
        outcome: 'won',
        finalActIndex: 0,
        startedAt: 1_000,
        endedAt: 2_500,
        turns: 3,
        cardsPlayed: 4,
        progressDealt: 9,
        damageTaken: 2,
        hazardsResolved: 1,
        hazardsDiscarded: 0,
        cardsDiscarded: 1,
      },
    }
    const storage = createMemoryStorage({ [RUN_STATS_LEGACY_V1_KEY]: JSON.stringify(legacyPayload) })
    const collector = createRunStatsCollector({ storage })

    expect(storage.dump()[RUN_STATS_LEGACY_V1_KEY]).toBeDefined()
    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeUndefined()
    expect(collector.lifetime()).toMatchObject({
      version: 2,
      runs: 1,
      durationMs: 1_500,
      byWorld: { legacy: { runs: 1, wins: 1, losses: 0, abandoned: 0 } },
      lastRun: { sessionId: 'legacy-run', activeDurationMs: 1_500 },
    })

    collector.subscriber(
      createRunStarted({ sessionId: 'after-migration', worldId: 'legacy', seed: 12, appliedModifiers: [], timestamp: 3_000, initialEvents: [], initialState: stubState }),
    )
    collector.subscriber(
      createRunEnded({ sessionId: 'after-migration', outcome: 'lost', finalActIndex: 0, timestamp: 4_000, finalState: stubState }),
    )

    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeDefined()
    expect(storage.dump()[RUN_STATS_LEGACY_V1_KEY]).toBeUndefined()
  })

  it('clamps a negative run duration to zero when the clock jumps backwards', () => {
    const collector = createRunStatsCollector()

    collector.subscriber(
      createRunStarted({ sessionId: 'skewed', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 5_000, initialEvents: [], initialState: stubState }),
    )
    collector.subscriber(createRunEnded({ sessionId: 'skewed', outcome: 'lost', finalActIndex: 0, timestamp: 4_000, finalState: stubState }))

    const lifetime = collector.lifetime()

    expect(lifetime.durationMs).toBe(0)
    // The raw timestamps stay truthful; only the folded duration is clamped.
    expect(lifetime.lastRun?.startedAt).toBe(5_000)
    expect(lifetime.lastRun?.endedAt).toBe(4_000)
  })

  it('excludes hidden spans from active run duration', () => {
    let now = 1_000
    let visible = true
    let onVisibilityChange = () => {}
    const collector = createRunStatsCollector({
      clock: () => now,
      visibility: () => visible,
      subscribeVisibility: (onChange) => {
        onVisibilityChange = onChange
        return () => {}
      },
    })

    collector.subscriber(
      createRunStarted({ sessionId: 'visible-run', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    now = 1_400
    visible = false
    onVisibilityChange()
    now = 2_400
    visible = true
    onVisibilityChange()
    collector.subscriber(createRunEnded({ sessionId: 'visible-run', outcome: 'lost', finalActIndex: 0, timestamp: 3_000, finalState: stubState }))

    expect(collector.lifetime().lastRun?.activeDurationMs).toBe(1_000)
    expect(collector.lifetime().durationMs).toBe(1_000)
  })

  it('does not accrue active duration until a hidden-started run becomes visible', () => {
    let now = 1_000
    let visible = false
    let onVisibilityChange = () => {}
    const collector = createRunStatsCollector({
      clock: () => now,
      visibility: () => visible,
      subscribeVisibility: (onChange) => {
        onVisibilityChange = onChange
        return () => {}
      },
    })

    collector.subscriber(
      createRunStarted({ sessionId: 'hidden-run', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    now = 2_000
    visible = true
    onVisibilityChange()
    collector.subscriber(createRunEnded({ sessionId: 'hidden-run', outcome: 'lost', finalActIndex: 0, timestamp: 2_500, finalState: stubState }))

    expect(collector.lifetime().lastRun?.activeDurationMs).toBe(500)
  })

  it('clamps backwards visibility-clock segments without subtracting active duration', () => {
    let now = 5_000
    let visible = true
    let onVisibilityChange = () => {}
    const collector = createRunStatsCollector({
      clock: () => now,
      visibility: () => visible,
      subscribeVisibility: (onChange) => {
        onVisibilityChange = onChange
        return () => {}
      },
    })

    collector.subscriber(
      createRunStarted({ sessionId: 'skewed-visible', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 5_000, initialEvents: [], initialState: stubState }),
    )
    now = 4_000
    visible = false
    onVisibilityChange()
    collector.subscriber(
      createRunEnded({ sessionId: 'skewed-visible', outcome: 'lost', finalActIndex: 0, timestamp: 4_500, finalState: stubState }),
    )

    expect(collector.lifetime().lastRun?.activeDurationMs).toBe(0)
    expect(collector.lifetime().durationMs).toBe(0)
  })

  it('keeps in-memory stats when storage writes fail', () => {
    const storage: RunStatsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {},
    }
    const collector = createRunStatsCollector({ storage })
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
      createRunEnded({ sessionId: 'unseen-session', outcome: 'lost', finalActIndex: 0, timestamp: 1_200, finalState: stubState }),
    )

    expect(collector.lifetime().runs).toBe(0)
  })

  it('tracks concurrent sessions independently by session id', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    collector.subscriber(
      createRunStarted({ sessionId: 'a', worldId: 'world-a', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: state }),
    )
    collector.subscriber(
      createRunStarted({
        sessionId: 'b',
        worldId: 'world-b',
        seed: 2,
        appliedModifiers: [{ kind: 'hard-mode' }],
        timestamp: 2_000,
        initialEvents: [],
        initialState: state,
      }),
    )
    collector.subscriber(
      createGameplayBatch('a', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }, 1_100),
    )
    collector.subscriber(createRunEnded({ sessionId: 'a', outcome: 'won', finalActIndex: 0, timestamp: 1_500, finalState: state }))
    collector.subscriber(createRunEnded({ sessionId: 'b', outcome: 'lost', finalActIndex: 1, timestamp: 2_700, finalState: state }))

    const lifetime = collector.lifetime()

    expect(lifetime.runs).toBe(2)
    expect(lifetime.byWorld).toEqual({
      'world-a': { runs: 1, wins: 1, losses: 0, abandoned: 0, fewestTurnsWin: 1, mostProgressInRun: 0 },
      'world-b': { runs: 1, wins: 0, losses: 1, abandoned: 0, mostProgressInRun: 0 },
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

  it('tracks per-world bests and reports records only when set or beaten', () => {
    const collector = createRunStatsCollector()
    const state = createGameplaySession(catalog, worldData, 42).state

    function finishRun(sessionId: string, outcome: 'won' | 'lost' | 'abandoned', turns: number, progress: number): void {
      collector.subscriber(
        createRunStarted({ sessionId, worldId: 'record-world', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: state }),
      )
      collector.subscriber(
        createGameplayBatch(sessionId, { type: 'EndTurn' }, {
          state,
          events: [
            ...Array.from({ length: turns }, () => ({ type: 'TurnEnded' as const })),
            { type: 'ProgressDealt', hazardId: 'hazard', amount: progress, hazardTurnTotal: progress },
          ],
        }, 1_100),
      )
      collector.subscriber(createRunEnded({ sessionId, outcome, finalActIndex: 0, timestamp: 2_000, finalState: state }))
    }

    finishRun('first-win', 'won', 5, 10)
    expect(collector.lifetime().byWorld['record-world']).toMatchObject({
      fewestTurnsWin: 5,
      mostProgressInRun: 10,
    })
    expect(collector.lastRunRecords()).toEqual({ fewestTurnsWin: true, mostProgressInRun: true })

    finishRun('tie-win', 'won', 5, 10)
    expect(collector.lifetime().byWorld['record-world']).toMatchObject({
      fewestTurnsWin: 5,
      mostProgressInRun: 10,
    })
    expect(collector.lastRunRecords()).toEqual({})

    finishRun('better-loss-progress', 'lost', 7, 14)
    expect(collector.lifetime().byWorld['record-world']).toMatchObject({
      fewestTurnsWin: 5,
      mostProgressInRun: 14,
    })
    expect(collector.lastRunRecords()).toEqual({ mostProgressInRun: true })

    finishRun('better-win-turns', 'won', 4, 8)
    expect(collector.lifetime().byWorld['record-world']).toMatchObject({
      fewestTurnsWin: 4,
      mostProgressInRun: 14,
    })
    expect(collector.lastRunRecords()).toEqual({ fewestTurnsWin: true })

    finishRun('abandon-best-progress', 'abandoned', 1, 99)
    expect(collector.lifetime().byWorld['record-world']).toMatchObject({
      fewestTurnsWin: 4,
      mostProgressInRun: 14,
    })
    expect(collector.lastRunRecords()).toEqual({})
  })

  it('returns lifetime copies that cannot mutate collector state', () => {
    const collector = createRunStatsCollector()
    const copy = collector.lifetime() as { runs: number }

    copy.runs = 999

    expect(collector.lifetime().runs).toBe(0)
  })

  it('AI #4 — sums HealReceived events into healingReceived', () => {
    const collector = createRunStatsCollector()

    collector.subscriber(
      createRunStarted({ sessionId: 'heal-run', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    collector.subscriber(
      createGameplayBatch('heal-run', { type: 'EndTurn' }, {
        state: stubState,
        events: [
          { type: 'HealReceived', amount: 3 },
          { type: 'HealReceived', amount: 5 },
        ],
      }, 1_100),
    )
    collector.subscriber(
      createRunEnded({ sessionId: 'heal-run', outcome: 'lost', finalActIndex: 0, timestamp: 1_200, finalState: stubState }),
    )

    expect(collector.history()[0]?.healingReceived).toBe(8)
  })

  it('AI #5 — extracts finalHp and finalResources from the terminal state', () => {
    const collector = createRunStatsCollector()
    const terminalState = { ...stubState, hp: 7, energy: 3, light: 0, braceCharges: 0 }

    collector.subscriber(
      createRunStarted({ sessionId: 'hp-run', worldId: 'w', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
    )
    collector.subscriber(
      createRunEnded({ sessionId: 'hp-run', outcome: 'won', finalActIndex: 0, timestamp: 1_200, finalState: terminalState }),
    )

    const run = collector.history()[0]
    expect(run?.finalHp).toBe(7)
    expect(run?.finalResources).toEqual({ energy: 3, light: 0, brace: 0 })
  })

  it('AI #6 — old stored RunRecord without new fields passes isRunRecord', () => {
    // Simulates a record persisted before Phase 4: no finalHp, finalResources, or healingReceived.
    const oldRecord: unknown = {
      sessionId: 'old-run',
      worldId: 'w',
      seed: 1,
      appliedModifiers: [],
      outcome: 'won',
      finalActIndex: 0,
      startedAt: 1_000,
      endedAt: 2_000,
      activeDurationMs: 1_000,
      turns: 3,
      cardsPlayed: 4,
      progressDealt: 9,
      damageTaken: 2,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    }

    expect(isRunRecord(oldRecord)).toBe(true)
    if (isRunRecord(oldRecord)) {
      expect(oldRecord.finalHp).toBeUndefined()
      expect(oldRecord.finalResources).toBeUndefined()
      expect(oldRecord.healingReceived).toBeUndefined()
    }
  })

  it('AI (bonus) — HealReceived in initialEvents counts toward healingReceived', () => {
    const collector = createRunStatsCollector()

    collector.subscriber(
      createRunStarted({
        sessionId: 'opening-heal',
        worldId: 'w',
        seed: 1,
        appliedModifiers: [],
        timestamp: 1_000,
        initialEvents: [{ type: 'HealReceived', amount: 4 }],
        initialState: stubState,
      }),
    )
    collector.subscriber(
      createRunEnded({ sessionId: 'opening-heal', outcome: 'lost', finalActIndex: 0, timestamp: 1_200, finalState: stubState }),
    )

    expect(collector.history()[0]?.healingReceived).toBe(4)
  })
})
