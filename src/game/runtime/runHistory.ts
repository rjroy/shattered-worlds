import type { RunRecord, RunStatsStorage } from './runStats'
import { isRunRecord } from './runStats'

export const RUN_HISTORY_STORAGE_KEY = 'shattered-worlds/run-history/v1'
export const RUN_HISTORY_LIMIT = 100

export interface RunHistoryPayload {
  readonly version: 1
  readonly records: readonly RunRecord[]
}

export function emptyHistory(): RunHistoryPayload {
  return { version: 1, records: [] }
}

export function isRunHistoryPayload(value: unknown): value is RunHistoryPayload {
  if (typeof value !== 'object' || value === null) return false

  const history = value as Record<string, unknown>
  return history.version === 1 && Array.isArray(history.records) && history.records.every(isRunRecord)
}

export function loadHistory(storage: RunStatsStorage | undefined, key: string = RUN_HISTORY_STORAGE_KEY): RunHistoryPayload {
  if (storage === undefined) return emptyHistory()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return emptyHistory()

    const parsed: unknown = JSON.parse(raw)
    if (!isRunHistoryPayload(parsed)) {
      console.warn('[runHistory] discarding stored run history with unknown shape or version', { key })
      return emptyHistory()
    }

    return parsed
  } catch (error) {
    console.warn('[runHistory] failed to load stored run history; starting empty', { key, error })
    return emptyHistory()
  }
}

export function appendRun(history: RunHistoryPayload, run: RunRecord): RunHistoryPayload {
  return {
    version: 1,
    records: [run, ...history.records].slice(0, RUN_HISTORY_LIMIT),
  }
}

export function persistHistory(
  storage: RunStatsStorage | undefined,
  key: string = RUN_HISTORY_STORAGE_KEY,
  history: RunHistoryPayload,
): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(history))
  } catch (error) {
    console.warn('[runHistory] failed to persist run history; keeping in-memory copy', { key, error })
  }
}
