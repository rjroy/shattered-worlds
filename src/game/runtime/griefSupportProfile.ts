import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tracks whether the player has already dismissed the grief-support
 * interstitial (see GriefSupportScene). Shared trilogy-level scaffolding: the
 * flag is not per-world because the notice is a single one-time acknowledgment
 * that covers questions/answers/the-beginning together, not a per-world gate.
 */
export type GriefSupportProfile = {
  readonly version: 1
  readonly hasSeenGriefSupportNotice: boolean
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const GRIEF_SUPPORT_STORAGE_KEY = 'shattered-worlds/grief-notice/v1'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultGriefSupportProfile(): GriefSupportProfile {
  return {
    version: 1,
    hasSeenGriefSupportNotice: false,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the KNOWN keys only. Unknown future keys are tolerated: a newer
 * version of the app may have written extra fields, and an older build must
 * still load the key it understands rather than discarding the whole object.
 */
export function isGriefSupportProfile(value: unknown): value is GriefSupportProfile {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return p.version === 1 && typeof p.hasSeenGriefSupportNotice === 'boolean'
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export function loadGriefSupportProfile(
  storage: RunStatsStorage | undefined,
  key = GRIEF_SUPPORT_STORAGE_KEY,
): GriefSupportProfile {
  if (storage === undefined) return defaultGriefSupportProfile()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return defaultGriefSupportProfile()

    const parsed: unknown = JSON.parse(raw)
    if (isGriefSupportProfile(parsed)) {
      return { version: 1, hasSeenGriefSupportNotice: parsed.hasSeenGriefSupportNotice }
    }

    console.warn('[griefSupportProfile] discarding stored profile with unknown shape', { key })
    return defaultGriefSupportProfile()
  } catch (error) {
    console.warn('[griefSupportProfile] failed to load profile; using defaults', { key, error })
    return defaultGriefSupportProfile()
  }
}

export function saveGriefSupportProfile(
  storage: RunStatsStorage | undefined,
  profile: GriefSupportProfile,
  key = GRIEF_SUPPORT_STORAGE_KEY,
): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(profile))
  } catch (error) {
    console.warn('[griefSupportProfile] failed to persist profile; keeping in-memory copy', {
      key,
      error,
    })
  }
}

// ---------------------------------------------------------------------------
// GriefSupportStore interface
// ---------------------------------------------------------------------------

export interface GriefSupportStore {
  get(): GriefSupportProfile
  set(profile: GriefSupportProfile): void
  /** Convenience for single-field changes; persists immediately. */
  update(patch: Partial<Omit<GriefSupportProfile, 'version'>>): void
}

// ---------------------------------------------------------------------------
// createGriefSupportStore
// ---------------------------------------------------------------------------

export function createGriefSupportStore(
  storage: RunStatsStorage | undefined,
): GriefSupportStore {
  let profile = loadGriefSupportProfile(storage)

  return {
    get: () => profile,

    set(newProfile) {
      profile = newProfile
      saveGriefSupportProfile(storage, profile)
    },

    update(patch) {
      profile = { ...profile, ...patch }
      saveGriefSupportProfile(storage, profile)
    },
  }
}
