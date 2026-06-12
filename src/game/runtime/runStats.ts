import type {
  GameplayBatch,
  RunEnded,
  RunOutcome,
  RunStarted,
  RunStreamSubscriber,
  SessionId,
} from './gameplayEventStream'

/** localStorage-compatible seam so persistence stays injectable and testable. */
export interface RunStatsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface RunRecord {
  readonly sessionId: SessionId
  readonly worldId: string
  readonly seed: number
  readonly outcome: RunOutcome
  readonly finalActIndex: number
  readonly turns: number
  readonly cardsPlayed: number
  readonly progressDealt: number
  readonly damageTaken: number
  readonly hazardsResolved: number
  readonly hazardsDiscarded: number
  readonly cardsDiscarded: number
}

export interface WorldStats {
  readonly runs: number
  readonly wins: number
  readonly losses: number
  readonly abandoned: number
}

export interface LifetimeStats {
  readonly version: 1
  readonly runs: number
  readonly wins: number
  readonly losses: number
  readonly abandoned: number
  readonly turns: number
  readonly cardsPlayed: number
  readonly progressDealt: number
  readonly damageTaken: number
  readonly hazardsResolved: number
  readonly hazardsDiscarded: number
  readonly cardsDiscarded: number
  readonly byWorld: Readonly<Record<string, WorldStats>>
  readonly lastRun?: RunRecord
}

/** Read-only view for consumers that display stats but never feed them. */
export interface RunStatsReader {
  lifetime(): LifetimeStats
}

export interface RunStatsCollector extends RunStatsReader {
  readonly subscriber: RunStreamSubscriber
}

export const RUN_STATS_STORAGE_KEY = 'shattered-worlds/run-stats/v1'

type RunAccumulator = {
  worldId: string
  seed: number
  turns: number
  cardsPlayed: number
  progressDealt: number
  damageTaken: number
  hazardsResolved: number
  hazardsDiscarded: number
  cardsDiscarded: number
}

const LIFETIME_COUNTER_KEYS = [
  'runs',
  'wins',
  'losses',
  'abandoned',
  'turns',
  'cardsPlayed',
  'progressDealt',
  'damageTaken',
  'hazardsResolved',
  'hazardsDiscarded',
  'cardsDiscarded',
] as const

function emptyLifetime(): LifetimeStats {
  return {
    version: 1,
    runs: 0,
    wins: 0,
    losses: 0,
    abandoned: 0,
    turns: 0,
    cardsPlayed: 0,
    progressDealt: 0,
    damageTaken: 0,
    hazardsResolved: 0,
    hazardsDiscarded: 0,
    cardsDiscarded: 0,
    byWorld: {},
  }
}

function isWorldStats(value: unknown): value is WorldStats {
  if (typeof value !== 'object' || value === null) return false

  const world = value as Record<string, unknown>
  return (['runs', 'wins', 'losses', 'abandoned'] as const).every(
    (key) => typeof world[key] === 'number' && Number.isFinite(world[key]),
  )
}

// A payload claiming version 1 can still be malformed (partial write, manual
// edit, older dev build under the same key); folding garbage counters would
// poison every future run, so reject anything that doesn't fully check out.
function isLifetimeStats(value: unknown): value is LifetimeStats {
  if (typeof value !== 'object' || value === null) return false

  const stats = value as Record<string, unknown>
  return (
    stats.version === 1 &&
    LIFETIME_COUNTER_KEYS.every((key) => typeof stats[key] === 'number' && Number.isFinite(stats[key])) &&
    typeof stats.byWorld === 'object' &&
    stats.byWorld !== null &&
    Object.values(stats.byWorld).every(isWorldStats)
  )
}

function loadLifetime(storage: RunStatsStorage | undefined, key: string): LifetimeStats {
  if (storage === undefined) return emptyLifetime()

  try {
    const raw = storage.getItem(key)
    if (raw === null) return emptyLifetime()

    const parsed: unknown = JSON.parse(raw)
    if (!isLifetimeStats(parsed)) {
      console.warn('[runStats] discarding stored stats with unknown shape or version', { key })
      return emptyLifetime()
    }

    return parsed
  } catch (error) {
    console.warn('[runStats] failed to load stored stats; starting fresh', { key, error })
    return emptyLifetime()
  }
}

function persistLifetime(storage: RunStatsStorage | undefined, key: string, stats: LifetimeStats): void {
  if (storage === undefined) return

  try {
    storage.setItem(key, JSON.stringify(stats))
  } catch (error) {
    console.warn('[runStats] failed to persist stats; keeping in-memory copy', { key, error })
  }
}

function tally(accumulator: RunAccumulator, batch: GameplayBatch): void {
  for (const event of batch.events) {
    switch (event.type) {
      case 'TurnEnded':
        accumulator.turns += 1
        break
      case 'CardPlayed':
        accumulator.cardsPlayed += 1
        break
      case 'ProgressDealt':
        accumulator.progressDealt += event.amount
        break
      case 'DamageDealt':
        accumulator.damageTaken += event.amount
        break
      case 'HazardResolved':
        accumulator.hazardsResolved += 1
        break
      case 'HazardDiscarded':
        accumulator.hazardsDiscarded += 1
        break
      case 'CardsDiscarded':
        accumulator.cardsDiscarded += event.cardIds.length
        break
      default:
        break
    }
  }
}

function finalizeRun(accumulator: RunAccumulator, ended: RunEnded): RunRecord {
  return {
    sessionId: ended.sessionId,
    worldId: accumulator.worldId,
    seed: accumulator.seed,
    outcome: ended.outcome,
    finalActIndex: ended.finalActIndex,
    turns: accumulator.turns,
    cardsPlayed: accumulator.cardsPlayed,
    progressDealt: accumulator.progressDealt,
    damageTaken: accumulator.damageTaken,
    hazardsResolved: accumulator.hazardsResolved,
    hazardsDiscarded: accumulator.hazardsDiscarded,
    cardsDiscarded: accumulator.cardsDiscarded,
  }
}

function foldIntoLifetime(lifetime: LifetimeStats, run: RunRecord): LifetimeStats {
  const world = lifetime.byWorld[run.worldId] ?? { runs: 0, wins: 0, losses: 0, abandoned: 0 }

  return {
    version: 1,
    runs: lifetime.runs + 1,
    wins: lifetime.wins + (run.outcome === 'won' ? 1 : 0),
    losses: lifetime.losses + (run.outcome === 'lost' ? 1 : 0),
    abandoned: lifetime.abandoned + (run.outcome === 'abandoned' ? 1 : 0),
    turns: lifetime.turns + run.turns,
    cardsPlayed: lifetime.cardsPlayed + run.cardsPlayed,
    progressDealt: lifetime.progressDealt + run.progressDealt,
    damageTaken: lifetime.damageTaken + run.damageTaken,
    hazardsResolved: lifetime.hazardsResolved + run.hazardsResolved,
    hazardsDiscarded: lifetime.hazardsDiscarded + run.hazardsDiscarded,
    cardsDiscarded: lifetime.cardsDiscarded + run.cardsDiscarded,
    byWorld: {
      ...lifetime.byWorld,
      [run.worldId]: {
        runs: world.runs + 1,
        wins: world.wins + (run.outcome === 'won' ? 1 : 0),
        losses: world.losses + (run.outcome === 'lost' ? 1 : 0),
        abandoned: world.abandoned + (run.outcome === 'abandoned' ? 1 : 0),
      },
    },
    lastRun: run,
  }
}

/**
 * Derives per-run and lifetime counters purely from the gameplay event stream.
 * Runs observed only partially (the collector attached mid-run) are ignored
 * rather than recorded with understated counts.
 */
export function createRunStatsCollector(
  storage?: RunStatsStorage,
  storageKey: string = RUN_STATS_STORAGE_KEY,
): RunStatsCollector {
  let lifetime = loadLifetime(storage, storageKey)
  const activeRuns = new Map<SessionId, RunAccumulator>()

  function onRunStarted(item: RunStarted): void {
    activeRuns.set(item.sessionId, {
      worldId: item.worldId,
      seed: item.seed,
      turns: 0,
      cardsPlayed: 0,
      progressDealt: 0,
      damageTaken: 0,
      hazardsResolved: 0,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    })
  }

  function onRunEnded(item: RunEnded): void {
    const accumulator = activeRuns.get(item.sessionId)
    if (accumulator === undefined) return

    activeRuns.delete(item.sessionId)
    lifetime = foldIntoLifetime(lifetime, finalizeRun(accumulator, item))
    persistLifetime(storage, storageKey, lifetime)
  }

  return {
    subscriber(item) {
      switch (item.kind) {
        case 'RunStarted':
          onRunStarted(item)
          break
        case 'GameplayBatch': {
          const accumulator = activeRuns.get(item.sessionId)
          if (accumulator !== undefined) tally(accumulator, item)
          break
        }
        case 'RunEnded':
          onRunEnded(item)
          break
      }
    },

    lifetime() {
      return structuredClone(lifetime)
    },
  }
}
