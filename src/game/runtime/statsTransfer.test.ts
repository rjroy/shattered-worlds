import { describe, expect, it } from 'bun:test'

import { catalog, worldData } from '../../core/tests/testFixture'

import { createRunEnded, createRunStarted } from './gameplayEventStream'
import { createGameplaySession } from './gameplaySession'
import { createRunStatsCollector, RUN_STATS_LEGACY_V1_KEY, RUN_STATS_STORAGE_KEY, type RunStatsStorage } from './runStats'
import { RUN_HISTORY_STORAGE_KEY } from './runHistory'
import { createStatsTransfer } from './statsTransfer'
import { createWitnessCollector } from './witnessProfile'
import { createFeatsStore } from './featsProfile'

const stubState = createGameplaySession(catalog, worldData, 42).state

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
    createRunStarted({ sessionId, worldId: 'transfer-world', seed: 1, appliedModifiers: [], timestamp: 1_000, initialEvents: [], initialState: stubState }),
  )
  collector.subscriber(createRunEnded({ sessionId, outcome: 'lost', finalActIndex: 0, timestamp: 2_000, finalState: stubState }))
}

const validLifetime = {
  version: 2 as const,
  runs: 0,
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
}

describe('statsTransfer', () => {
  it('round-trips exported lifetime and history into a fresh collector', () => {
    const source = createRunStatsCollector()
    recordLostRun(source, 'exported-run')

    const json = createStatsTransfer({ runStats: source, clock: () => 12_345 }).exportJson()
    const targetStorage = createMemoryStorage()
    const target = createRunStatsCollector({ storage: targetStorage })
    const transfer = createStatsTransfer({ runStats: target })
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
    const transfer = createStatsTransfer({ runStats: collector })

    const inspected = transfer.inspectImport(JSON.stringify({ kind: 'shattered-worlds-stats', lifetime: { version: 99 } }))

    expect(inspected.ok).toBe(false)
    expect(collector.lifetime()).toEqual(beforeLifetime)
    expect(collector.history()).toEqual(beforeHistory)
    expect(storage.dump()).toEqual(beforeStorage)
  })

  it('inspects v1 lifetime imports as needing migration and applies migration only on confirm', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    const transfer = createStatsTransfer({ runStats: collector })
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

  it('exportJson includes witness and feats profiles when non-empty', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    const witnessStore = createWitnessCollector(storage)
    const featsStore = createFeatsStore(storage)

    // Populate witness via subscriber: RunStarted with a HazardAdded initial event
    witnessStore.subscriber(
      createRunStarted({
        sessionId: 'x',
        worldId: 'w',
        seed: 1,
        appliedModifiers: [],
        timestamp: 0,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        initialState: stubState,
      }),
    )

    // Populate feats
    featsStore.appendFeat({ featId: 'survived-act1', earnedAt: 1000, sessionId: 'x' })

    const transfer = createStatsTransfer({ runStats: collector, witness: witnessStore, feats: featsStore, clock: () => 12_345 })
    const json = transfer.exportJson()
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect(parsed.witnessProfile).toBeDefined()
    expect((parsed.witnessProfile as { threats: Record<string, { encounterCount: number }> }).threats['Zombie']!.encounterCount).toBe(1)
    expect(parsed.featsProfile).toBeDefined()
    expect((parsed.featsProfile as { earned: unknown[] }).earned).toHaveLength(1)
  })

  it('importing an old-format payload (no profile fields) leaves local witness state unchanged', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    const witnessStore = createWitnessCollector(storage)
    const featsStore = createFeatsStore(storage)

    // Pre-populate local witness state
    witnessStore.subscriber(
      createRunStarted({
        sessionId: 'local',
        worldId: 'w',
        seed: 1,
        appliedModifiers: [],
        timestamp: 0,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Ghost' }],
        initialState: stubState,
      }),
    )
    const profileBefore = witnessStore.getProfile()
    expect(profileBefore.threats['Ghost']).toBeDefined()

    const transfer = createStatsTransfer({ runStats: collector, witness: witnessStore, feats: featsStore })

    // Import a payload with no witnessProfile or featsProfile
    const oldFormatPayload = JSON.stringify({
      kind: 'shattered-worlds-stats',
      lifetime: validLifetime,
    })
    const inspected = transfer.inspectImport(oldFormatPayload)
    expect(inspected.ok).toBe(true)
    if (!inspected.ok) throw new Error(inspected.reason)

    transfer.applyImport(inspected)

    // Witness profile must be unchanged
    expect(witnessStore.getProfile()).toEqual(profileBefore)
  })

  it('a full payload with both profiles replaces both on applyImport', () => {
    const storage = createMemoryStorage()
    const collector = createRunStatsCollector({ storage })
    const witnessStore = createWitnessCollector(storage)
    const featsStore = createFeatsStore(storage)

    const transfer = createStatsTransfer({ runStats: collector, witness: witnessStore, feats: featsStore })

    const importedWitness = { version: 1 as const, threats: { Dragon: { encounterCount: 5, diedTo: true } } }
    const importedFeats = { version: 1 as const, earned: [{ featId: 'slew-the-dragon', earnedAt: 9000, sessionId: 'epic' }] }

    const fullPayload = JSON.stringify({
      kind: 'shattered-worlds-stats',
      lifetime: validLifetime,
      witnessProfile: importedWitness,
      featsProfile: importedFeats,
    })

    const inspected = transfer.inspectImport(fullPayload)
    expect(inspected.ok).toBe(true)
    if (!inspected.ok) throw new Error(inspected.reason)

    transfer.applyImport(inspected)

    expect(witnessStore.getProfile()).toEqual(importedWitness)
    expect(featsStore.getProfile()).toEqual(importedFeats)
  })

  it('rejects import with malformed witnessProfile and leaves stored witness profile unchanged', () => {
    const storage = createMemoryStorage()
    const witnessStore = createWitnessCollector(storage)
    const featsStore = createFeatsStore(storage)
    const collector = createRunStatsCollector({ storage })
    const transfer = createStatsTransfer({ runStats: collector, witness: witnessStore, feats: featsStore })

    const profileBefore = witnessStore.getProfile()

    const malformedPayload = JSON.stringify({
      kind: 'shattered-worlds-stats',
      lifetime: validLifetime,
      witnessProfile: { version: 1, threats: 'not-an-object' },
    })

    const result = transfer.inspectImport(malformedPayload)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected rejection')
    expect(result.reason).toContain('witness profile')

    // witnessStore should be untouched
    expect(witnessStore.getProfile()).toEqual(profileBefore)
  })
})
