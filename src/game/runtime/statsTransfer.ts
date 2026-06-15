import type { RunStatsCollector } from './runStats'
import {
  isLifetimeStatsV1,
  isLifetimeStatsV2,
  migrateLifetimeV1toV2,
  type LifetimeStats,
  type LifetimeStatsV1,
} from './runStats'
import { emptyHistory, isRunHistoryPayload, type RunHistoryPayload } from './runHistory'
import { isWitnessProfile, type WitnessProfile, type WitnessStore } from './witnessProfile'
import { isFeatsProfile, type FeatsProfile, type FeatsStore } from './featsProfile'

export interface StatsExportPayload {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt: number
  readonly lifetime: LifetimeStats
  readonly history: RunHistoryPayload
  readonly witnessProfile?: WitnessProfile
  readonly featsProfile?: FeatsProfile
}

interface StatsImportPayloadV1 {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt?: unknown
  readonly lifetime: LifetimeStats | LifetimeStatsV1
  readonly history?: RunHistoryPayload
  readonly witnessProfile?: WitnessProfile
  readonly featsProfile?: FeatsProfile
}

export type InspectedStatsImport =
  | Readonly<{ ok: true; needsMigration: boolean; payload: StatsImportPayloadV1 }>
  | Readonly<{ ok: false; reason: string }>

export interface StatsTransfer {
  exportJson(): string
  inspectImport(json: string): InspectedStatsImport
  applyImport(inspected: Extract<InspectedStatsImport, { ok: true }>): void
}

export interface StatsTransferOptions {
  readonly runStats: RunStatsCollector
  readonly witness?: WitnessStore | undefined
  readonly feats?: FeatsStore | undefined
  readonly clock?: (() => number) | undefined
}

function isStatsImportEnvelope(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>).kind === 'shattered-worlds-stats'
}

export function createStatsTransfer(options: StatsTransferOptions): StatsTransfer {
  return {
    exportJson() {
      const witnessProfile = options.witness?.getProfile()
      const featsProfile = options.feats?.getProfile()

      const payload: StatsExportPayload = {
        kind: 'shattered-worlds-stats',
        exportedAt: (options.clock ?? Date.now)(),
        lifetime: options.runStats.lifetime(),
        history: { version: 1, records: options.runStats.history() },
        ...(witnessProfile !== undefined && Object.keys(witnessProfile.threats).length > 0
          ? { witnessProfile }
          : {}),
        ...(featsProfile !== undefined && featsProfile.earned.length > 0
          ? { featsProfile }
          : {}),
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

      const witnessProfileRaw = parsed.witnessProfile
      if (witnessProfileRaw !== undefined && !isWitnessProfile(witnessProfileRaw)) {
        return { ok: false, reason: 'The selected file has invalid witness profile data.' }
      }

      const featsProfileRaw = parsed.featsProfile
      if (featsProfileRaw !== undefined && !isFeatsProfile(featsProfileRaw)) {
        return { ok: false, reason: 'The selected file has invalid feats profile data.' }
      }

      return {
        ok: true,
        needsMigration: lifetimeIsV1,
        payload: {
          kind: 'shattered-worlds-stats',
          exportedAt: parsed.exportedAt,
          lifetime,
          ...(history === undefined ? {} : { history }),
          ...(witnessProfileRaw !== undefined ? { witnessProfile: witnessProfileRaw as WitnessProfile } : {}),
          ...(featsProfileRaw !== undefined ? { featsProfile: featsProfileRaw as FeatsProfile } : {}),
        },
      }
    },

    applyImport(inspected) {
      const lifetime = isLifetimeStatsV1(inspected.payload.lifetime)
        ? migrateLifetimeV1toV2(inspected.payload.lifetime)
        : inspected.payload.lifetime
      const history = inspected.payload.history ?? emptyHistory()

      options.runStats.replaceAll(lifetime, history)

      if (inspected.payload.witnessProfile !== undefined && options.witness !== undefined) {
        options.witness.setProfile(inspected.payload.witnessProfile)
      }

      if (inspected.payload.featsProfile !== undefined && options.feats !== undefined) {
        options.feats.setProfile(inspected.payload.featsProfile)
      }
    },
  }
}
