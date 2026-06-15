import { describe, expect, it } from 'bun:test'

import {
  createFeatsStore,
  isFeatsProfile,
  loadFeatsProfile,
  FEATS_PROFILE_STORAGE_KEY,
  type FeatRecord,
  type FeatsProfile,
} from './featsProfile'
import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStorage(): RunStatsStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

function makeFeatRecord(overrides: Partial<FeatRecord> = {}): FeatRecord {
  return {
    featId: 'first-win',
    earnedAt: 1_000_000,
    sessionId: 'run-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test AI #10: Write a FeatRecord, save, reload, assert it appears in earned
// ---------------------------------------------------------------------------

describe('featsProfile', () => {
  it('AI #10: persists a feat record and recovers it after reload', () => {
    const storage = makeStorage()
    const store = createFeatsStore(storage)

    const record = makeFeatRecord({ featId: 'first-win', sessionId: 'run-10', earnedAt: 1_000 })
    store.appendFeat(record)

    // In-memory check
    expect(store.getProfile().earned).toHaveLength(1)
    expect(store.getProfile().earned[0]).toEqual(record)

    // Storage was written
    const raw = storage.getItem(FEATS_PROFILE_STORAGE_KEY)
    expect(raw).not.toBeNull()

    // Reload from same storage into a fresh store
    const reloaded = createFeatsStore(storage)
    expect(reloaded.getProfile().earned).toHaveLength(1)
    expect(reloaded.getProfile().earned[0]).toEqual(record)
  })

  // ---------------------------------------------------------------------------
  // Test AI #11: Same featId twice → exactly one entry
  // ---------------------------------------------------------------------------

  it('AI #11: deduplicates by featId — writing the same feat twice stores it once', () => {
    const storage = makeStorage()
    const store = createFeatsStore(storage)

    const first = makeFeatRecord({ featId: 'first-win', sessionId: 'run-11a', earnedAt: 1_000 })
    const duplicate = makeFeatRecord({ featId: 'first-win', sessionId: 'run-11b', earnedAt: 2_000 })

    store.appendFeat(first)
    store.appendFeat(duplicate)

    // Must contain exactly one entry — the first write wins
    expect(store.getProfile().earned).toHaveLength(1)
    expect(store.getProfile().earned[0]).toEqual(first)

    // Reload and verify the deduplication is durable
    const reloaded = createFeatsStore(storage)
    expect(reloaded.getProfile().earned).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // Corrupt profile at storage key → resets to empty
  // ---------------------------------------------------------------------------

  it('resets to empty profile when stored value is corrupt JSON', () => {
    const storage = makeStorage()
    storage.setItem(FEATS_PROFILE_STORAGE_KEY, 'not valid json!!!')

    const store = createFeatsStore(storage)
    expect(store.getProfile()).toEqual({ version: 1, earned: [] })
  })

  it('resets to empty profile when stored object has unknown shape', () => {
    const storage = makeStorage()
    storage.setItem(FEATS_PROFILE_STORAGE_KEY, JSON.stringify({ version: 99, earned: [] }))

    const store = createFeatsStore(storage)
    expect(store.getProfile()).toEqual({ version: 1, earned: [] })
  })

  // ---------------------------------------------------------------------------
  // setProfile replaces existing profile
  // ---------------------------------------------------------------------------

  it('setProfile replaces the profile and persists it', () => {
    const storage = makeStorage()
    const store = createFeatsStore(storage)

    store.appendFeat(makeFeatRecord({ featId: 'old-feat' }))

    const replacement: FeatsProfile = {
      version: 1,
      earned: [makeFeatRecord({ featId: 'replacement-feat', earnedAt: 5_000, sessionId: 'run-r' })],
    }
    store.setProfile(replacement)

    expect(store.getProfile()).toEqual(replacement)

    // Verify persistence
    const reloaded = loadFeatsProfile(storage)
    expect(reloaded).toEqual(replacement)
  })

  // ---------------------------------------------------------------------------
  // Multiple different feats can be appended
  // ---------------------------------------------------------------------------

  it('appends multiple distinct feats in order', () => {
    const storage = makeStorage()
    const store = createFeatsStore(storage)

    const feat1 = makeFeatRecord({ featId: 'feat-a', earnedAt: 1_000, sessionId: 'run-a' })
    const feat2 = makeFeatRecord({ featId: 'feat-b', earnedAt: 2_000, sessionId: 'run-b' })
    const feat3 = makeFeatRecord({ featId: 'feat-c', earnedAt: 3_000, sessionId: 'run-c' })

    store.appendFeat(feat1)
    store.appendFeat(feat2)
    store.appendFeat(feat3)

    const earned = store.getProfile().earned
    expect(earned).toHaveLength(3)
    expect(earned[0]).toEqual(feat1)
    expect(earned[1]).toEqual(feat2)
    expect(earned[2]).toEqual(feat3)
  })

  // ---------------------------------------------------------------------------
  // loadFeatsProfile with undefined storage returns empty profile
  // ---------------------------------------------------------------------------

  it('returns empty profile when no storage is provided', () => {
    const profile = loadFeatsProfile(undefined)
    expect(profile).toEqual({ version: 1, earned: [] })
  })

  // ---------------------------------------------------------------------------
  // isFeatsProfile guard
  // ---------------------------------------------------------------------------

  it('accepts a well-formed feats profile', () => {
    const profile: FeatsProfile = {
      version: 1,
      earned: [
        { featId: 'first-win', earnedAt: 1_000, sessionId: 'run-1' },
        { featId: 'no-damage', earnedAt: 2_000, sessionId: 'run-2' },
      ],
    }
    expect(isFeatsProfile(profile)).toBe(true)
  })

  it('accepts an empty earned array', () => {
    expect(isFeatsProfile({ version: 1, earned: [] })).toBe(true)
  })

  it('rejects profiles with wrong version', () => {
    expect(isFeatsProfile({ version: 2, earned: [] })).toBe(false)
  })

  it('rejects profiles where earned is not an array', () => {
    expect(isFeatsProfile({ version: 1, earned: {} })).toBe(false)
  })

  it('rejects profiles with non-finite earnedAt', () => {
    expect(
      isFeatsProfile({ version: 1, earned: [{ featId: 'x', earnedAt: NaN, sessionId: 's' }] }),
    ).toBe(false)
  })

  it('rejects profiles with missing featId', () => {
    expect(
      isFeatsProfile({ version: 1, earned: [{ earnedAt: 1_000, sessionId: 's' }] }),
    ).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // createFeatsStore with undefined storage (in-memory only)
  // ---------------------------------------------------------------------------

  it('works without storage — in-memory only, no error thrown', () => {
    const store = createFeatsStore(undefined)

    const record = makeFeatRecord({ featId: 'no-storage-feat' })
    expect(() => store.appendFeat(record)).not.toThrow()
    expect(store.getProfile().earned).toHaveLength(1)
  })
})
