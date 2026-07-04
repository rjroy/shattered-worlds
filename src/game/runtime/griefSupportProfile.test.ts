import { describe, expect, it } from 'bun:test'

import {
  createGriefSupportStore,
  isGriefSupportProfile,
  loadGriefSupportProfile,
  GRIEF_SUPPORT_STORAGE_KEY,
  type GriefSupportProfile,
} from './griefSupportProfile'
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

function makeThrowingStorage(): RunStatsStorage {
  return {
    getItem: () => {
      throw new Error('getItem blew up')
    },
    setItem: () => {
      throw new Error('setItem blew up')
    },
    removeItem: () => {
      throw new Error('removeItem blew up')
    },
  }
}

const DEFAULTS: GriefSupportProfile = {
  version: 1,
  hasSeenGriefSupportNotice: false,
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('griefSupportProfile', () => {
  it('default value is hasSeenGriefSupportNotice: false', () => {
    const store = createGriefSupportStore(makeStorage())
    expect(store.get()).toEqual(DEFAULTS)
  })

  it('returns defaults when no storage is provided', () => {
    expect(loadGriefSupportProfile(undefined)).toEqual(DEFAULTS)
  })

  it('with undefined storage, set() and update() are no-ops that do not throw', () => {
    const store = createGriefSupportStore(undefined)
    expect(store.get()).toEqual(DEFAULTS)

    expect(() =>
      store.set({ version: 1, hasSeenGriefSupportNotice: true }),
    ).not.toThrow()
    expect(store.get()).toEqual({ version: 1, hasSeenGriefSupportNotice: true })

    expect(() => store.update({ hasSeenGriefSupportNotice: false })).not.toThrow()
    expect(store.get().hasSeenGriefSupportNotice).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Throwing storage
  // ---------------------------------------------------------------------------

  it('returns defaults when getItem throws, and swallows setItem throws while keeping the in-memory copy', () => {
    const store = createGriefSupportStore(makeThrowingStorage())
    expect(store.get()).toEqual(DEFAULTS)

    const next: GriefSupportProfile = { version: 1, hasSeenGriefSupportNotice: true }
    expect(() => store.set(next)).not.toThrow()
    expect(store.get()).toEqual(next)
  })

  // ---------------------------------------------------------------------------
  // Malformed JSON / invalid shape
  // ---------------------------------------------------------------------------

  it('returns defaults when stored value is corrupt JSON', () => {
    const storage = makeStorage()
    storage.setItem(GRIEF_SUPPORT_STORAGE_KEY, '{not json')

    const store = createGriefSupportStore(storage)
    expect(store.get()).toEqual(DEFAULTS)
  })

  it('returns defaults when hasSeenGriefSupportNotice is the wrong type', () => {
    const storage = makeStorage()
    storage.setItem(
      GRIEF_SUPPORT_STORAGE_KEY,
      JSON.stringify({ version: 1, hasSeenGriefSupportNotice: 'yes' }),
    )

    expect(loadGriefSupportProfile(storage)).toEqual(DEFAULTS)
  })

  it('returns defaults when version is wrong', () => {
    const storage = makeStorage()
    storage.setItem(
      GRIEF_SUPPORT_STORAGE_KEY,
      JSON.stringify({ version: 99, hasSeenGriefSupportNotice: true }),
    )

    expect(loadGriefSupportProfile(storage)).toEqual(DEFAULTS)
  })

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  it('set() writes through to storage and a fresh store reads it back', () => {
    const storage = makeStorage()
    const store = createGriefSupportStore(storage)

    const next: GriefSupportProfile = { version: 1, hasSeenGriefSupportNotice: true }
    store.set(next)

    expect(storage.getItem(GRIEF_SUPPORT_STORAGE_KEY)).not.toBeNull()

    const reloaded = createGriefSupportStore(storage)
    expect(reloaded.get()).toEqual(next)
  })

  it('update() persists a single-field change and a fresh store reads it back', () => {
    const storage = makeStorage()
    const store = createGriefSupportStore(storage)

    store.update({ hasSeenGriefSupportNotice: true })

    expect(store.get()).toEqual({ version: 1, hasSeenGriefSupportNotice: true })

    const reloaded = createGriefSupportStore(storage)
    expect(reloaded.get()).toEqual({ version: 1, hasSeenGriefSupportNotice: true })
  })

  // ---------------------------------------------------------------------------
  // Unknown future key tolerance
  // ---------------------------------------------------------------------------

  it('loads a stored object that carries an extra unknown key, honoring the known field', () => {
    const storage = makeStorage()
    storage.setItem(
      GRIEF_SUPPORT_STORAGE_KEY,
      JSON.stringify({ version: 1, hasSeenGriefSupportNotice: true, futureFlag: 'x' }),
    )

    const loaded = loadGriefSupportProfile(storage)
    expect(loaded).toEqual({ version: 1, hasSeenGriefSupportNotice: true })
    expect('futureFlag' in loaded).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // isGriefSupportProfile guard
  // ---------------------------------------------------------------------------

  it('accepts a well-formed profile object', () => {
    expect(isGriefSupportProfile({ version: 1, hasSeenGriefSupportNotice: false })).toBe(true)
  })

  it('accepts a profile object with extra unknown keys', () => {
    expect(
      isGriefSupportProfile({ version: 1, hasSeenGriefSupportNotice: true, extra: 1 }),
    ).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(isGriefSupportProfile(null)).toBe(false)
    expect(isGriefSupportProfile('always')).toBe(false)
    expect(isGriefSupportProfile(42)).toBe(false)
  })
})
