import { describe, expect, it } from 'bun:test'

import type { RunRecord, RunStatsStorage } from './runStats'
import { appendRun, loadHistory, persistHistory, RUN_HISTORY_LIMIT, RUN_HISTORY_STORAGE_KEY } from './runHistory'

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

function runRecord(sessionId: string): RunRecord {
  const index = Number(sessionId.replace(/\D/g, '')) || 0

  return {
    sessionId,
    worldId: 'world',
    seed: index,
    appliedModifiers: [],
    outcome: 'lost',
    finalActIndex: 0,
    startedAt: index,
    endedAt: index + 1,
    activeDurationMs: 1,
    turns: 1,
    cardsPlayed: 0,
    progressDealt: 0,
    damageTaken: 0,
    hazardsResolved: 0,
    hazardsDiscarded: 0,
    cardsDiscarded: 0,
  }
}

describe('runHistory persistence', () => {
  it('prepends new records and evicts beyond the cap', () => {
    let history = loadHistory(undefined)

    for (let index = 0; index < RUN_HISTORY_LIMIT + 1; index += 1) {
      history = appendRun(history, runRecord(`run-${index}`))
    }

    expect(history.records).toHaveLength(RUN_HISTORY_LIMIT)
    expect(history.records[0]?.sessionId).toBe('run-100')
    expect(history.records.at(-1)?.sessionId).toBe('run-1')
  })

  it('persists and reloads most-recent-first order', () => {
    const storage = createMemoryStorage()
    const history = appendRun(appendRun(loadHistory(undefined), runRecord('run-1')), runRecord('run-2'))

    persistHistory(storage, RUN_HISTORY_STORAGE_KEY, history)

    expect(loadHistory(storage).records.map((run) => run.sessionId)).toEqual(['run-2', 'run-1'])
  })

  it('rejects malformed stored history and starts empty', () => {
    const storage = createMemoryStorage({
      [RUN_HISTORY_STORAGE_KEY]: JSON.stringify({ version: 1, records: [{ sessionId: 'too-small' }] }),
    })

    expect(loadHistory(storage).records).toEqual([])
  })
})
