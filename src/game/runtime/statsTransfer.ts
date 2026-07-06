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
import { isUnlocksProfile, type UnlocksProfile, type UnlocksStore } from './unlocksProfile'
import { isUserSettings, type UserSettings, type UserSettingsStore } from './userSettings'
import {
  isGriefSupportProfile,
  type GriefSupportProfile,
  type GriefSupportStore,
} from './griefSupportProfile'

export interface StatsExportPayload {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt: number
  readonly lifetime: LifetimeStats
  readonly history: RunHistoryPayload
  readonly witnessProfile?: WitnessProfile
  readonly featsProfile?: FeatsProfile
  readonly unlocksProfile?: UnlocksProfile
  readonly userSettings?: UserSettings
  readonly griefSupportProfile?: GriefSupportProfile
}

interface StatsImportPayloadV1 {
  readonly kind: 'shattered-worlds-stats'
  readonly exportedAt?: unknown
  readonly lifetime: LifetimeStats | LifetimeStatsV1
  readonly history?: RunHistoryPayload
  readonly witnessProfile?: WitnessProfile
  readonly featsProfile?: FeatsProfile
  readonly unlocksProfile?: UnlocksProfile
  readonly userSettings?: UserSettings
  readonly griefSupportProfile?: GriefSupportProfile
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
  readonly unlocks?: UnlocksStore | undefined
  readonly userSettings?: UserSettingsStore | undefined
  readonly griefSupport?: GriefSupportStore | undefined
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
      const unlocksProfile = options.unlocks?.getProfile()
      const userSettings = options.userSettings?.get()
      const griefSupportProfile = options.griefSupport?.get()

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
        ...(unlocksProfile !== undefined && unlocksProfile.purchased.length > 0
          ? { unlocksProfile }
          : {}),
        ...(userSettings !== undefined ? { userSettings } : {}),
        ...(griefSupportProfile !== undefined ? { griefSupportProfile } : {}),
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

      const unlocksProfileRaw = parsed.unlocksProfile
      if (unlocksProfileRaw !== undefined && !isUnlocksProfile(unlocksProfileRaw)) {
        return { ok: false, reason: 'The selected file has invalid unlocks profile data.' }
      }

      const userSettingsRaw = parsed.userSettings
      if (userSettingsRaw !== undefined && !isUserSettings(userSettingsRaw)) {
        return { ok: false, reason: 'The selected file has invalid settings data.' }
      }

      const griefSupportProfileRaw = parsed.griefSupportProfile
      if (griefSupportProfileRaw !== undefined && !isGriefSupportProfile(griefSupportProfileRaw)) {
        return { ok: false, reason: 'The selected file has invalid grief-support profile data.' }
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
          ...(unlocksProfileRaw !== undefined
            ? { unlocksProfile: unlocksProfileRaw as UnlocksProfile }
            : {}),
          ...(userSettingsRaw !== undefined ? { userSettings: userSettingsRaw as UserSettings } : {}),
          ...(griefSupportProfileRaw !== undefined
            ? { griefSupportProfile: griefSupportProfileRaw as GriefSupportProfile }
            : {}),
        },
      }
    },

    applyImport(inspected) {
      const lifetime = isLifetimeStatsV1(inspected.payload.lifetime)
        ? migrateLifetimeV1toV2(inspected.payload.lifetime)
        : { ...inspected.payload.lifetime, byStarter: inspected.payload.lifetime.byStarter ?? {} }
      const history = inspected.payload.history ?? emptyHistory()

      options.runStats.replaceAll(lifetime, history)

      if (inspected.payload.witnessProfile !== undefined && options.witness !== undefined) {
        options.witness.setProfile(inspected.payload.witnessProfile)
      }

      if (inspected.payload.featsProfile !== undefined && options.feats !== undefined) {
        options.feats.setProfile(inspected.payload.featsProfile)
      }

      if (inspected.payload.unlocksProfile !== undefined && options.unlocks !== undefined) {
        options.unlocks.setProfile(inspected.payload.unlocksProfile)
      }

      if (inspected.payload.userSettings !== undefined && options.userSettings !== undefined) {
        options.userSettings.set(inspected.payload.userSettings)
      }

      if (
        inspected.payload.griefSupportProfile !== undefined &&
        options.griefSupport !== undefined
      ) {
        options.griefSupport.set(inspected.payload.griefSupportProfile)
      }
    },
  }
}
