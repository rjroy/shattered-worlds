import { describe, expect, it } from 'bun:test'

import { createRunEnded, createRunStarted } from './gameplayEventStream'
import { createRunStatsCollector, RUN_STATS_LEGACY_V1_KEY, RUN_STATS_STORAGE_KEY, type RunStatsStorage } from './runStats'
import { RUN_HISTORY_STORAGE_KEY } from './runHistory'
import { createStatsTransfer } from './statsTransfer'

function createMemoryStorage(initial?: Record<string, string>): RunStatsStorage & { dump(): Record<string, string> } {
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

function recordLostRun(collector: ReturnType<typeof createRunStatsCollector>, sessionId: string): void {
  collector.subscriber(
    createRunStarted({ sessionId, worldId: 'transfer-world', seed: 1, appliedModifiers: [], timestamp: 1_000 }),
  )
  collector.subscriber(createRunEnded({ sessionId, outcome: 'lost', finalActIndex: 0, timestamp: 2_000 }))
}

describe('statsTransfer', () => {
  it('round-trips exported lifetime and history into a fresh collector', () => {
    const source = createRunStatsCollector()
    recordLostRun(source, 'exported-run')

    const json = createStatsTransfer(source, () => 12_345).exportJson()
    const targetStorage = createMemoryStorage()
    const target = createRunStatsCollector({ storage: targetStorage })
    const transfer = createStatsTransfer(target)
    const inspected = transfer.inspectImport(json)

    expect(inspected).toMatchObject({ ok: true, needsMigration: false })
    if (!inspected.ok) throw new Error(inspected.reason)

    transfer.applyImport(inspected)

    expect(target.lifetime()).toEqual(source.lifetime())
    expect(target.history()).toEqual(source.history())
    expect(JSON.parse(targetStorage.dump()[RUN_STATS_STORAGE_KEY]!)).toEqual(source.lifetime())
    expect(JSON.parse(targetStorage.dump()[RUN_HISTORY_STORAGE_KEY]!)).toEqual({ version: 1, records: source.history() })
  })

  it('rejects invalid imports without mutating in-memory or stored stats', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    recordLostRun(collector, 'kept-run')
    const beforeLifetime = collector.lifetime()
    const beforeHistory = collector.history()
    const beforeStorage = storage.dump()
    const transfer = createStatsTransfer(collector)

    const inspected = transfer.inspectImport(JSON.stringify({ kind: 'shattered-worlds-stats', lifetime: { version: 99 } }))

    expect(inspected.ok).toBe(false)
    expect(collector.lifetime()).toEqual(beforeLifetime)
    expect(collector.history()).toEqual(beforeHistory)
    expect(storage.dump()).toEqual(beforeStorage)
  })

  it('inspects v1 lifetime imports as needing migration and applies migration only on confirm', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    const transfer = createStatsTransfer(collector)
    const legacyLifetime = {
      version: 1,
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
      turns: 2,
      cardsPlayed: 3,
      progressDealt: 4,
      damageTaken: 0,
      hazardsResolved: 1,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
      durationMs: 1_000,
      byWorld: { old: { runs: 1, wins: 1, losses: 0, abandoned: 0 } },
      lastRun: {
        sessionId: 'legacy',
        worldId: 'old',
        seed: 7,
        appliedModifiers: [],
        outcome: 'won',
        finalActIndex: 0,
        startedAt: 5_000,
        endedAt: 6_000,
        turns: 2,
        cardsPlayed: 3,
        progressDealt: 4,
        damageTaken: 0,
        hazardsResolved: 1,
        hazardsDiscarded: 0,
        cardsDiscarded: 0,
      },
    }

    const inspected = transfer.inspectImport(
      JSON.stringify({ kind: 'shattered-worlds-stats', lifetime: legacyLifetime }),
    )

    expect(inspected).toMatchObject({ ok: true, needsMigration: true })
    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeUndefined()
    expect(storage.dump()[RUN_STATS_LEGACY_V1_KEY]).toBeUndefined()
    if (!inspected.ok) throw new Error(inspected.reason)

    transfer.applyImport(inspected)

    expect(collector.lifetime()).toMatchObject({
      version: 2,
      runs: 1,
      lastRun: { sessionId: 'legacy', activeDurationMs: 1_000 },
    })
    expect(collector.history()).toEqual([])
    expect(storage.dump()[RUN_STATS_STORAGE_KEY]).toBeDefined()
  })
})
