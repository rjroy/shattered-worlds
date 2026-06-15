import type { GameEvent, WorldCard } from '../../core/index'
import type { RunStreamSubscriber } from './gameplayEventStream'
import type { RunStatsStorage } from './runStats'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WitnessEntry = {
  encounterCount: number
  diedTo: boolean
}

export type WitnessProfile = {
  version: 1
  threats: Record<string, WitnessEntry>
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const WITNESS_PROFILE_STORAGE_KEY = 'shattered-worlds/witness/v1'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isWitnessEntry(value: unknown): value is WitnessEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.encounterCount === 'number' &&
    Number.isFinite(e.encounterCount) &&
    typeof e.diedTo === 'boolean'
  )
}

export function isWitnessProfile(value: unknown): value is WitnessProfile {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    p.version === 1 &&
    typeof p.threats === 'object' &&
    p.threats !== null &&
    Object.values(p.threats as Record<string, unknown>).every(isWitnessEntry)
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function emptyWitnessProfile(): WitnessProfile {
  return { version: 1, threats: {} }
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export function loadWitnessProfile(
  storage: RunStatsStorage | undefined,
  key = WITNESS_PROFILE_STORAGE_KEY,
): WitnessProfile {
  if (storage === undefined) return emptyWitnessProfile()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return emptyWitnessProfile()

    const parsed: unknown = JSON.parse(raw)
    if (!isWitnessProfile(parsed)) {
      console.warn('[witnessProfile] discarding stored witness profile with unknown shape', { key })
      return emptyWitnessProfile()
    }

    return parsed
  } catch (error) {
    console.warn('[witnessProfile] failed to load witness profile; starting empty', { key, error })
    return emptyWitnessProfile()
  }
}

export function saveWitnessProfile(
  storage: RunStatsStorage | undefined,
  profile: WitnessProfile,
  key = WITNESS_PROFILE_STORAGE_KEY,
): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(profile))
  } catch (error) {
    console.warn('[witnessProfile] failed to persist witness profile; keeping in-memory copy', {
      key,
      error,
    })
  }
}

// ---------------------------------------------------------------------------
// WitnessStore interface
// ---------------------------------------------------------------------------

export interface WitnessStore {
  readonly subscriber: RunStreamSubscriber
  getProfile(): WitnessProfile
  setProfile(profile: WitnessProfile): void
}

// ---------------------------------------------------------------------------
// createWitnessCollector
// ---------------------------------------------------------------------------

export function createWitnessCollector(storage: RunStatsStorage | undefined): WitnessStore {
  let profile = loadWitnessProfile(storage)

  // Replaces a single threat entry, preserving the rest of the profile immutably.
  function setThreat(threatId: string, entry: WitnessEntry): void {
    profile = {
      ...profile,
      threats: { ...profile.threats, [threatId]: entry },
    }
  }

  // Increments encounterCount for every HazardAdded event.
  function tallyHazards(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type !== 'HazardAdded') continue
      const existing = profile.threats[event.templateId]
      setThreat(event.templateId, {
        encounterCount: (existing?.encounterCount ?? 0) + 1,
        diedTo: existing?.diedTo ?? false,
      })
    }
  }

  // Marks every world card still in hand as a cause of death. encounterCount
  // should already be set by an earlier HazardAdded, but defaults to 0 so the
  // death is recorded even without a prior encounter entry.
  function markDeaths(handCards: readonly WorldCard[]): void {
    for (const card of handCards) {
      const existing = profile.threats[card.name]
      setThreat(card.name, { encounterCount: existing?.encounterCount ?? 0, diedTo: true })
    }
  }

  const subscriber: RunStreamSubscriber = (item) => {
    if (item.kind === 'RunStarted') {
      // Tally hazards dealt in the opening hand.
      tallyHazards(item.initialEvents)
    } else if (item.kind === 'GameplayBatch') {
      tallyHazards(item.events)
    } else if (item.kind === 'RunEnded') {
      // Only mark diedTo on a lost run, never on abandon or win.
      if (item.outcome === 'lost') {
        const worldCardsInHand = item.finalState.hand.filter((c): c is WorldCard => c.kind === 'world')
        markDeaths(worldCardsInHand)
      }

      saveWitnessProfile(storage, profile)
    }
  }

  return {
    subscriber,
    getProfile: () => profile,
    setProfile: (newProfile) => {
      profile = newProfile
      saveWitnessProfile(storage, profile)
    },
  }
}
