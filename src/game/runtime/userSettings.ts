import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfirmationMode = 'always' | 'risk-only' | 'off'

export type UserSettings = {
  readonly version: 2
  readonly confirmationMode: ConfirmationMode
  readonly detailedHoverPreviews: boolean
  readonly musicVolume: number
  readonly fxVolume: number
  readonly masterMute: boolean
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const USER_SETTINGS_STORAGE_KEY = 'shattered-worlds/settings/v1'
// Note: the key name still says v1 even though payload version is now 2.
// The storage key must stay stable so existing saved preferences are found on read;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultUserSettings(): UserSettings {
  return {
    version: 2,
    confirmationMode: 'always',
    detailedHoverPreviews: true,
    musicVolume: 1.0,
    fxVolume: 0.5,
    masterMute: false,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CONFIRMATION_MODES: readonly ConfirmationMode[] = ['always', 'risk-only', 'off']

function isConfirmationMode(value: unknown): value is ConfirmationMode {
  return typeof value === 'string' && CONFIRMATION_MODES.includes(value as ConfirmationMode)
}

/**
 * Validates the KNOWN keys only. Unknown future keys are tolerated: a newer
 * version of the app may have written extra settings, and an older build must
 * still load the keys it understands rather than discarding the whole object.
 * So this accepts objects carrying extra keys, but rejects objects whose known
 * keys are missing or the wrong type.
 */
export function isUserSettings(value: unknown): value is UserSettings {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    s.version === 2 &&
    isConfirmationMode(s.confirmationMode) &&
    typeof s.detailedHoverPreviews === 'boolean' &&
    typeof s.musicVolume === 'number' &&
    typeof s.fxVolume === 'number' &&
    typeof s.masterMute === 'boolean'
  )
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export function loadUserSettings(
  storage: RunStatsStorage | undefined,
  key = USER_SETTINGS_STORAGE_KEY,
): UserSettings {
  if (storage === undefined) return defaultUserSettings()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return defaultUserSettings()

    const parsed: unknown = JSON.parse(raw)

    // Try v2 validation first, then fall back to v1 migration.
    if (isUserSettings(parsed)) {
      // v2 — re-project known fields, clamping volume ranges.
      return clampV2(parsed)
    }

    // Check if this is a v1 payload we can migrate.
    const migrated = migrateFromV1(parsed)
    if (migrated) return clampV2(migrated)

    // Unrecognised shape — fall back to defaults.
    console.warn('[userSettings] discarding stored settings with unknown shape', { key })
    return defaultUserSettings()
  } catch (error) {
    console.warn('[userSettings] failed to load settings; using defaults', { key, error })
    return defaultUserSettings()
  }
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

/** Re-project a v1 object into a v2 shape, filling in new-field defaults. */
function migrateFromV1(value: unknown): UserSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const s = value as Record<string, unknown>
  if (
    s.version !== 1 ||
    !isConfirmationMode(s.confirmationMode) ||
    typeof s.detailedHoverPreviews !== 'boolean'
  ) {
    return undefined
  }
  return {
    version: 2,
    confirmationMode: s.confirmationMode,
    detailedHoverPreviews: s.detailedHoverPreviews,
    musicVolume: 1.0,
    fxVolume: 0.5,
    masterMute: false,
  }
}

/**
 * Clamp volume fields to [0, 1] and coerce non-finite numbers to defaults.
 * Keeps the "tolerant of unknown future keys" behavior — only known keys are
 * projected into the typed result.
 */
function clampV2(s: Record<string, unknown>): UserSettings {
  const mv = Number.isFinite(s.musicVolume) ? Math.max(0, Math.min(1, Number(s.musicVolume))) : 1.0
  const fv = Number.isFinite(s.fxVolume) ? Math.max(0, Math.min(1, Number(s.fxVolume))) : 0.5
  return {
    version: 2,
    confirmationMode: s.confirmationMode as ConfirmationMode,
    detailedHoverPreviews: s.detailedHoverPreviews as boolean,
    musicVolume: mv,
    fxVolume: fv,
    masterMute: Boolean(s.masterMute),
  }
}

export function saveUserSettings(
  storage: RunStatsStorage | undefined,
  settings: UserSettings,
  key = USER_SETTINGS_STORAGE_KEY,
): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(settings))
  } catch (error) {
    console.warn('[userSettings] failed to persist settings; keeping in-memory copy', {
      key,
      error,
    })
  }
}

// ---------------------------------------------------------------------------
// UserSettingsStore interface
// ---------------------------------------------------------------------------

export interface UserSettingsStore {
  get(): UserSettings
  set(settings: UserSettings): void
  /** Convenience for single-field changes; persists immediately. */
  update(patch: Partial<Omit<UserSettings, 'version'>>): void
}

// ---------------------------------------------------------------------------
// createUserSettingsStore
// ---------------------------------------------------------------------------

export function createUserSettingsStore(
  storage: RunStatsStorage | undefined,
): UserSettingsStore {
  let settings = loadUserSettings(storage)

  return {
    get: () => settings,

    set(newSettings) {
      settings = newSettings
      saveUserSettings(storage, settings)
    },

    update(patch) {
      settings = { ...settings, ...patch }
      saveUserSettings(storage, settings)
    },
  }
}
