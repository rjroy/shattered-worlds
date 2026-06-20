import { describe, expect, it } from 'bun:test'

import {
  createUserSettingsStore,
  isUserSettings,
  loadUserSettings,
  USER_SETTINGS_STORAGE_KEY,
  type UserSettings,
} from './userSettings'
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

const DEFAULTS: UserSettings = {
  version: 1,
  confirmationMode: 'always',
  detailedHoverPreviews: true,
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('userSettings', () => {
  it('default values are exactly always + detailedHoverPreviews true', () => {
    const store = createUserSettingsStore(makeStorage())
    expect(store.get()).toEqual(DEFAULTS)
  })

  // ---------------------------------------------------------------------------
  // Missing storage
  // ---------------------------------------------------------------------------

  it('returns defaults when no storage is provided', () => {
    expect(loadUserSettings(undefined)).toEqual(DEFAULTS)
  })

  it('with undefined storage, set() and update() are no-ops that do not throw', () => {
    const store = createUserSettingsStore(undefined)
    expect(store.get()).toEqual(DEFAULTS)

    expect(() => store.set({ version: 1, confirmationMode: 'off', detailedHoverPreviews: false })).not.toThrow()
    // In-memory copy still updates even though nothing persisted.
    expect(store.get()).toEqual({ version: 1, confirmationMode: 'off', detailedHoverPreviews: false })

    expect(() => store.update({ confirmationMode: 'risk-only' })).not.toThrow()
    expect(store.get().confirmationMode).toBe('risk-only')
  })

  // ---------------------------------------------------------------------------
  // Throwing storage
  // ---------------------------------------------------------------------------

  it('returns defaults when getItem throws, and swallows setItem throws while keeping the in-memory copy', () => {
    const store = createUserSettingsStore(makeThrowingStorage())
    // load swallowed the getItem throw and fell back to defaults
    expect(store.get()).toEqual(DEFAULTS)

    // save swallows the setItem throw; in-memory copy is still retained
    const next: UserSettings = { version: 1, confirmationMode: 'off', detailedHoverPreviews: false }
    expect(() => store.set(next)).not.toThrow()
    expect(store.get()).toEqual(next)
  })

  // ---------------------------------------------------------------------------
  // Malformed JSON
  // ---------------------------------------------------------------------------

  it('returns defaults when stored value is corrupt JSON', () => {
    const storage = makeStorage()
    storage.setItem(USER_SETTINGS_STORAGE_KEY, '{not json')

    const store = createUserSettingsStore(storage)
    expect(store.get()).toEqual(DEFAULTS)
  })

  // ---------------------------------------------------------------------------
  // Invalid shape
  // ---------------------------------------------------------------------------

  it('returns defaults when confirmationMode is an unknown literal', () => {
    const storage = makeStorage()
    storage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, confirmationMode: 'bogus', detailedHoverPreviews: true }),
    )

    expect(loadUserSettings(storage)).toEqual(DEFAULTS)
  })

  it('returns defaults when a known field is missing', () => {
    const storage = makeStorage()
    storage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, confirmationMode: 'off' }))

    expect(loadUserSettings(storage)).toEqual(DEFAULTS)
  })

  it('returns defaults when detailedHoverPreviews is the wrong type', () => {
    const storage = makeStorage()
    storage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, confirmationMode: 'off', detailedHoverPreviews: 'yes' }),
    )

    expect(loadUserSettings(storage)).toEqual(DEFAULTS)
  })

  it('returns defaults when version is wrong', () => {
    const storage = makeStorage()
    storage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 99, confirmationMode: 'off', detailedHoverPreviews: false }),
    )

    expect(loadUserSettings(storage)).toEqual(DEFAULTS)
  })

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  it('set() writes through to storage and a fresh store reads it back', () => {
    const storage = makeStorage()
    const store = createUserSettingsStore(storage)

    const next: UserSettings = { version: 1, confirmationMode: 'risk-only', detailedHoverPreviews: false }
    store.set(next)

    expect(storage.getItem(USER_SETTINGS_STORAGE_KEY)).not.toBeNull()

    const reloaded = createUserSettingsStore(storage)
    expect(reloaded.get()).toEqual(next)
  })

  it('update() persists a single-field change and a fresh store reads it back', () => {
    const storage = makeStorage()
    const store = createUserSettingsStore(storage)

    store.update({ confirmationMode: 'off' })

    expect(store.get()).toEqual({ version: 1, confirmationMode: 'off', detailedHoverPreviews: true })

    const reloaded = createUserSettingsStore(storage)
    expect(reloaded.get()).toEqual({ version: 1, confirmationMode: 'off', detailedHoverPreviews: true })
  })

  // ---------------------------------------------------------------------------
  // Unknown future key tolerance
  // ---------------------------------------------------------------------------

  it('loads a stored object that carries an extra unknown key, honoring the known fields', () => {
    const storage = makeStorage()
    storage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        confirmationMode: 'off',
        detailedHoverPreviews: false,
        futureAudioVolume: 0.5,
      }),
    )

    const loaded = loadUserSettings(storage)
    // Known fields honored, not discarded to defaults...
    expect(loaded).toEqual({ version: 1, confirmationMode: 'off', detailedHoverPreviews: false })
    // ...and the unknown key is not carried into the typed object.
    expect('futureAudioVolume' in loaded).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // isUserSettings guard
  // ---------------------------------------------------------------------------

  it('accepts a well-formed settings object', () => {
    expect(isUserSettings({ version: 1, confirmationMode: 'always', detailedHoverPreviews: true })).toBe(true)
  })

  it('accepts a settings object with extra unknown keys', () => {
    expect(
      isUserSettings({ version: 1, confirmationMode: 'off', detailedHoverPreviews: false, extra: 1 }),
    ).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(isUserSettings(null)).toBe(false)
    expect(isUserSettings('always')).toBe(false)
    expect(isUserSettings(42)).toBe(false)
  })
})
