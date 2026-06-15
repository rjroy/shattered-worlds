import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatRecord = {
  featId: string
  earnedAt: number // epoch ms
  sessionId: string // RunRecord.sessionId of the earning run
}

export type FeatsProfile = {
  version: 1
  earned: FeatRecord[]
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const FEATS_PROFILE_STORAGE_KEY = 'shattered-worlds/feats/v1'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isFeatRecord(value: unknown): value is FeatRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.featId === 'string' &&
    typeof r.earnedAt === 'number' &&
    Number.isFinite(r.earnedAt) &&
    typeof r.sessionId === 'string'
  )
}

export function isFeatsProfile(value: unknown): value is FeatsProfile {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return p.version === 1 && Array.isArray(p.earned) && p.earned.every(isFeatRecord)
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function emptyFeatsProfile(): FeatsProfile {
  return { version: 1, earned: [] }
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export function loadFeatsProfile(
  storage: RunStatsStorage | undefined,
  key = FEATS_PROFILE_STORAGE_KEY,
): FeatsProfile {
  if (storage === undefined) return emptyFeatsProfile()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return emptyFeatsProfile()

    const parsed: unknown = JSON.parse(raw)
    if (!isFeatsProfile(parsed)) {
      console.warn('[featsProfile] discarding stored feats profile with unknown shape', { key })
      return emptyFeatsProfile()
    }

    return parsed
  } catch (error) {
    console.warn('[featsProfile] failed to load feats profile; starting empty', { key, error })
    return emptyFeatsProfile()
  }
}

export function saveFeatsProfile(
  storage: RunStatsStorage | undefined,
  profile: FeatsProfile,
  key = FEATS_PROFILE_STORAGE_KEY,
): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(profile))
  } catch (error) {
    console.warn('[featsProfile] failed to persist feats profile; keeping in-memory copy', {
      key,
      error,
    })
  }
}

// ---------------------------------------------------------------------------
// FeatsStore interface
// ---------------------------------------------------------------------------

export interface FeatsStore {
  getProfile(): FeatsProfile
  setProfile(profile: FeatsProfile): void
  appendFeat(record: FeatRecord): void
}

// ---------------------------------------------------------------------------
// createFeatsStore
// ---------------------------------------------------------------------------

export function createFeatsStore(storage: RunStatsStorage | undefined): FeatsStore {
  let profile = loadFeatsProfile(storage)

  return {
    getProfile: () => profile,

    setProfile(newProfile) {
      profile = newProfile
      saveFeatsProfile(storage, profile)
    },

    appendFeat(record) {
      // Deduplicate by featId — a feat can only be earned once.
      if (profile.earned.some((e) => e.featId === record.featId)) return
      profile = { ...profile, earned: [...profile.earned, record] }
      saveFeatsProfile(storage, profile)
    },
  }
}
