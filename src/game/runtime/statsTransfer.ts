import type { RunStatsCollector } from './runStats'
import {
  isLifetimeStatsV1,
  isLifetimeStatsV2,
  migrateLifetimeV1toV2,
  type LifetimeStats,
  type LifetimeStatsV1,
} from './runStats'
import { emptyHistory, isRunHistoryPayload, type RunHistoryPayload } from './runHistory'

export interface StatsExportPayload {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt: number
  readonly lifetime: LifetimeStats
  readonly history: RunHistoryPayload
}

interface StatsImportPayloadV1 {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt?: unknown
  readonly lifetime: LifetimeStats | LifetimeStatsV1
  readonly history?: RunHistoryPayload
}

export type InspectedStatsImport =
  | Readonly<{ ok: true; needsMigration: boolean; payload: StatsImportPayloadV1 }>
  | Readonly<{ ok: false; reason: string }>

export interface StatsTransfer {
  exportJson(): string
  inspectImport(json: string): InspectedStatsImport
  applyImport(inspected: Extract<InspectedStatsImport, { ok: true }>): void
}

function isStatsImportEnvelope(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>).kind === 'shattered-worlds-stats'
}

export function createStatsTransfer(collector: RunStatsCollector, clock: () => number = Date.now): StatsTransfer {
  return {
    exportJson() {
      const payload: StatsExportPayload = {
        kind: 'shattered-worlds-stats',
        exportedAt: clock(),
        lifetime: collector.lifetime(),
        history: { version: 1, records: collector.history() },
      }

      return JSON.stringify(payload, null, 2)
    },

    inspectImport(json) {
      let parsed: unknown
      try {
        parsed = JSON.parse(json) as unknown
      } catch {
        return { ok: false, reason: 'The selected file is not valid JSON.' }
      }

      if (!isStatsImportEnvelope(parsed)) {
        return { ok: false, reason: 'The selected file is not a Shattered Worlds stats export.' }
      }

      const lifetime = parsed.lifetime
      const lifetimeIsV2 = isLifetimeStatsV2(lifetime)
      const lifetimeIsV1 = isLifetimeStatsV1(lifetime)
      if (!lifetimeIsV2 && !lifetimeIsV1) {
        return { ok: false, reason: 'The selected file has invalid lifetime stats.' }
      }

      const history = parsed.history
      if (history !== undefined && !isRunHistoryPayload(history)) {
        return { ok: false, reason: 'The selected file has invalid run history.' }
      }

      return {
        ok: true,
        needsMigration: lifetimeIsV1,
        payload: {
          kind: 'shattered-worlds-stats',
          exportedAt: parsed.exportedAt,
          lifetime,
          ...(history === undefined ? {} : { history }),
        },
      }
    },

    applyImport(inspected) {
      const lifetime = isLifetimeStatsV1(inspected.payload.lifetime)
        ? migrateLifetimeV1toV2(inspected.payload.lifetime)
        : inspected.payload.lifetime
      const history = inspected.payload.history ?? emptyHistory()

      collector.replaceAll(lifetime, history)
    },
  }
}
