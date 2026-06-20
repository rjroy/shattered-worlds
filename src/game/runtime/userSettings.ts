import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfirmationMode = 'always' | 'risk-only' | 'off'

export type UserSettings = {
  readonly version: 1
  readonly confirmationMode: ConfirmationMode
  readonly detailedHoverPreviews: boolean
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const USER_SETTINGS_STORAGE_KEY = 'shattered-worlds/settings/v1'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultUserSettings(): UserSettings {
  return { version: 1, confirmationMode: 'always', detailedHoverPreviews: true }
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
    s.version === 1 &&
    isConfirmationMode(s.confirmationMode) &&
    typeof s.detailedHoverPreviews === 'boolean'
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
    if (!isUserSettings(parsed)) {
      console.warn('[userSettings] discarding stored settings with unknown shape', { key })
      return defaultUserSettings()
    }

    // Whole-object fallback (not per-field): once the known keys all validate,
    // re-project only the known fields into the typed result. Unknown future
    // keys are tolerated on read (they don't fail validation) but never carried
    // into the typed object — they stay opaque until a future build adds them.
    // If any known field were malformed, isUserSettings already rejected above
    // and we returned defaults. This keeps the result a complete, valid
    // UserSettings without leaking unvalidated data into the type.
    return {
      version: 1,
      confirmationMode: parsed.confirmationMode,
      detailedHoverPreviews: parsed.detailedHoverPreviews,
    }
  } catch (error) {
    console.warn('[userSettings] failed to load settings; using defaults', { key, error })
    return defaultUserSettings()
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
