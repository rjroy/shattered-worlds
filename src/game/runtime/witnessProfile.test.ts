import { describe, expect, it } from 'bun:test'

import type { GameState, WorldCard } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplaySession } from './gameplaySession'
import { createRunEnded, createRunStarted, createGameplayBatch } from './gameplayEventStream'
import {
  createWitnessCollector,
  isWitnessProfile,
  loadWitnessProfile,
  WITNESS_PROFILE_STORAGE_KEY,
  type WitnessProfile,
} from './witnessProfile'
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

/** Real GameState from fixture — used as a stub where state contents don't matter. */
const stubState = createGameplaySession(catalog, worldData, 42).state

/**
 * Builds a minimal GameState stub with the given WorldCards in hand.
 * Copies stubState and replaces hand to avoid re-creating the session.
 */
function stateWithWorldCardsInHand(worldCards: readonly WorldCard[]): GameState {
  return {
    ...stubState,
    hand: [...worldCards],
  }
}

/** A minimal WorldCard for use in test states. */
function makeWorldCard(name: string): WorldCard {
  return {
    kind: 'world',
    id: `wc-${name}`,
    name,
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: false,
    canExile: false,
    onDiscarded: { kind: 'None' },
    onCleared: { kind: 'None' },
    onEndOfTurn: { kind: 'None' },
    onPartialClear: { kind: 'None' },
  }
}

// ---------------------------------------------------------------------------
// Test AI #7: Zombie drawn into hand twice + lost with Zombie in hand
// → encounterCount === 2, diedTo === true after reload
// ---------------------------------------------------------------------------

describe('createWitnessCollector', () => {
  it('AI #7: tracks encounter count and diedTo for a lost run with hazard in hand', () => {
    const storage = makeStorage()
    const collector = createWitnessCollector(storage)

    // RunStarted: opening hand includes one HazardAdded for Zombie
    collector.subscriber(
      createRunStarted({
        sessionId: 'run-7',
        worldId: 'test-world',
        seed: 1,
        appliedModifiers: [],
        timestamp: 1_000,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        initialState: stubState,
      }),
    )

    // GameplayBatch: a second Zombie drawn during play
    collector.subscriber(
      createGameplayBatch(
        'run-7',
        { type: 'EndTurn' },
        {
          state: stubState,
          events: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        },
        1_100,
      ),
    )

    // RunEnded: lost with Zombie still in hand
    const zombieCard = makeWorldCard('Zombie')
    collector.subscriber(
      createRunEnded({
        sessionId: 'run-7',
        outcome: 'lost',
        finalActIndex: 0,
        timestamp: 1_200,
        finalState: stateWithWorldCardsInHand([zombieCard]),
      }),
    )

    // Verify in-memory profile
    const profile = collector.getProfile()
    expect(profile.threats['Zombie']).toEqual({ encounterCount: 2, diedTo: true })

    // Verify persisted to storage
    const raw = storage.getItem(WITNESS_PROFILE_STORAGE_KEY)
    expect(raw).not.toBeNull()

    // Reload from storage and verify persistence round-trip
    const reloaded = loadWitnessProfile(storage)
    expect(reloaded.threats['Zombie']).toEqual({ encounterCount: 2, diedTo: true })
  })

  // ---------------------------------------------------------------------------
  // Test AI #8: Abandon with hazard in hand → diedTo NOT set
  // ---------------------------------------------------------------------------

  it('AI #8: does not set diedTo when run is abandoned', () => {
    const storage = makeStorage()
    const collector = createWitnessCollector(storage)

    collector.subscriber(
      createRunStarted({
        sessionId: 'run-8',
        worldId: 'test-world',
        seed: 2,
        appliedModifiers: [],
        timestamp: 2_000,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        initialState: stubState,
      }),
    )

    const zombieCard = makeWorldCard('Zombie')
    collector.subscriber(
      createRunEnded({
        sessionId: 'run-8',
        outcome: 'abandoned',
        finalActIndex: 0,
        timestamp: 2_500,
        finalState: stateWithWorldCardsInHand([zombieCard]),
      }),
    )

    const profile = collector.getProfile()
    // encounterCount was incremented by HazardAdded, but diedTo stays false
    expect(profile.threats['Zombie']?.encounterCount).toBe(1)
    expect(profile.threats['Zombie']?.diedTo).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Test AI #9: Invalid JSON at witness key → returns empty profile
  // ---------------------------------------------------------------------------

  it('AI #9: returns empty profile when stored value is invalid JSON', () => {
    const storage = makeStorage()
    storage.setItem(WITNESS_PROFILE_STORAGE_KEY, 'invalid json!!!')

    const profile = loadWitnessProfile(storage)

    // Must return a valid empty profile — garbage is discarded
    expect(profile).toEqual({ version: 1, threats: {} })
  })

  it('returns empty profile when stored object has wrong shape (unknown version)', () => {
    const storage = makeStorage()
    storage.setItem(WITNESS_PROFILE_STORAGE_KEY, JSON.stringify({ version: 99, threats: {} }))

    const profile = loadWitnessProfile(storage)
    expect(profile).toEqual({ version: 1, threats: {} })
  })

  it('returns empty profile when no storage is provided', () => {
    const profile = loadWitnessProfile(undefined)
    expect(profile).toEqual({ version: 1, threats: {} })
  })

  // ---------------------------------------------------------------------------
  // isWitnessProfile guard
  // ---------------------------------------------------------------------------

  it('accepts a well-formed witness profile', () => {
    const profile: WitnessProfile = {
      version: 1,
      threats: {
        Zombie: { encounterCount: 3, diedTo: true },
        Screams: { encounterCount: 1, diedTo: false },
      },
    }
    expect(isWitnessProfile(profile)).toBe(true)
  })

  it('rejects profiles with non-finite encounterCount', () => {
    const profile = { version: 1, threats: { Zombie: { encounterCount: NaN, diedTo: false } } }
    expect(isWitnessProfile(profile)).toBe(false)
  })

  it('rejects profiles with non-boolean diedTo', () => {
    const profile = { version: 1, threats: { Zombie: { encounterCount: 1, diedTo: 'yes' } } }
    expect(isWitnessProfile(profile)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // setProfile round-trip
  // ---------------------------------------------------------------------------

  it('setProfile persists the new profile to storage', () => {
    const storage = makeStorage()
    const collector = createWitnessCollector(storage)

    const newProfile: WitnessProfile = {
      version: 1,
      threats: { Rubble: { encounterCount: 5, diedTo: false } },
    }
    collector.setProfile(newProfile)

    expect(collector.getProfile()).toEqual(newProfile)

    const reloaded = loadWitnessProfile(storage)
    expect(reloaded).toEqual(newProfile)
  })

  // ---------------------------------------------------------------------------
  // Cross-run accumulation: encounterCount grows across multiple runs
  // ---------------------------------------------------------------------------

  it('accumulates encounterCount across multiple runs', () => {
    const storage = makeStorage()
    const collector = createWitnessCollector(storage)

    // First run: one Zombie encounter, abandoned
    collector.subscriber(
      createRunStarted({
        sessionId: 'run-a',
        worldId: 'test-world',
        seed: 10,
        appliedModifiers: [],
        timestamp: 100,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        initialState: stubState,
      }),
    )
    collector.subscriber(
      createRunEnded({
        sessionId: 'run-a',
        outcome: 'abandoned',
        finalActIndex: 0,
        timestamp: 200,
        finalState: stubState,
      }),
    )

    // Second collector loads from same storage; simulates a new session
    const collector2 = createWitnessCollector(storage)
    collector2.subscriber(
      createRunStarted({
        sessionId: 'run-b',
        worldId: 'test-world',
        seed: 11,
        appliedModifiers: [],
        timestamp: 300,
        initialEvents: [{ type: 'HazardAdded', templateId: 'Zombie' }],
        initialState: stubState,
      }),
    )
    const zombieCard = makeWorldCard('Zombie')
    collector2.subscriber(
      createRunEnded({
        sessionId: 'run-b',
        outcome: 'lost',
        finalActIndex: 0,
        timestamp: 400,
        finalState: stateWithWorldCardsInHand([zombieCard]),
      }),
    )

    const profile = collector2.getProfile()
    // Run A: 1 encounter. Run B: 1 encounter. Total: 2.
    expect(profile.threats['Zombie']?.encounterCount).toBe(2)
    expect(profile.threats['Zombie']?.diedTo).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Note: subscriber order (witness saves after runStats) is guaranteed by
  // the stream.subscribe call order in gameplayRuntime.ts — runStats.subscriber
  // is subscribed first, witnessStore.subscriber second. This ordering is
  // structural and enforced at the composition root, not by direct testing.
  // ---------------------------------------------------------------------------
})
