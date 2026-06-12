import type {
  Clock,
  GameplayBatch,
  RunEnded,
  RunOutcome,
  RunStarted,
  RunStreamSubscriber,
  SessionId,
  SetupModifier,
} from './gameplayEventStream'
import { clonePlain } from './clone'
import {
  appendRun,
  loadHistory,
  persistHistory,
  RUN_HISTORY_STORAGE_KEY,
  type RunHistoryPayload,
} from './runHistory'

/** localStorage-compatible seam so persistence stays injectable and testable. */
export interface RunStatsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface RunRecord {
  readonly sessionId: SessionId
  readonly worldId: string
  readonly seed: number
  /** Setup that produced this result, copied from RunStarted (e.g. future meta-progression modifiers). */
  readonly appliedModifiers: readonly SetupModifier[]
  readonly outcome: RunOutcome
  readonly finalActIndex: number
  /** Epoch ms, copied from the RunStarted / RunEnded stream timestamps. */
  readonly startedAt: number
  readonly endedAt: number
  readonly activeDurationMs: number
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
  readonly fewestTurnsWin?: number
  readonly mostProgressInRun?: number
}

export interface LifetimeStats {
  readonly version: 2
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
  /**
   * Total active play time across completed runs, in milliseconds. V1 used
   * clamped wall-clock time; migrated values retain that historical noise.
   */
  readonly durationMs: number
  readonly byWorld: Readonly<Record<string, WorldStats>>
  readonly lastRun?: RunRecord
}

/** Read-only view for consumers that display stats but never feed them. */
export interface RunStatsReader {
  lifetime(): LifetimeStats
  lastRunRecords(): RunRecordRecords
}

export interface RunStatsCollector extends RunStatsReader {
  readonly subscriber: RunStreamSubscriber
  history(): readonly RunRecord[]
  replaceAll(lifetime: LifetimeStats, history: RunHistoryPayload): void
}

export interface RunStatsCollectorOptions {
  readonly storage?: RunStatsStorage | undefined
  readonly lifetimeKey?: string | undefined
  readonly historyKey?: string | undefined
  readonly clock?: Clock | undefined
  /** Returns true when play time should accrue. Defaults to always visible. */
  readonly visibility?: (() => boolean) | undefined
  readonly subscribeVisibility?: ((onChange: () => void) => () => void) | undefined
}

export type RunRecordRecords = Readonly<{
  fewestTurnsWin?: boolean
  mostProgressInRun?: boolean
}>

export const RUN_STATS_LEGACY_V1_KEY = 'shattered-worlds/run-stats/v1'
export const RUN_STATS_STORAGE_KEY = 'shattered-worlds/run-stats/v2'

export type RunRecordV1 = Omit<RunRecord, 'activeDurationMs'>

export interface WorldStatsV1 {
  readonly runs: number
  readonly wins: number
  readonly losses: number
  readonly abandoned: number
}

export interface LifetimeStatsV1 {
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
  readonly durationMs: number
  readonly byWorld: Readonly<Record<string, WorldStatsV1>>
  readonly lastRun?: RunRecordV1
}

type RunAccumulator = {
  worldId: string
  seed: number
  appliedModifiers: readonly SetupModifier[]
  startedAt: number
  activeMs: number
  visibleSince: number | null
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
  'durationMs',
] as const

const RUN_RECORD_NUMBER_KEYS = [
  'seed',
  'finalActIndex',
  'startedAt',
  'endedAt',
  'activeDurationMs',
  'turns',
  'cardsPlayed',
  'progressDealt',
  'damageTaken',
  'hazardsResolved',
  'hazardsDiscarded',
  'cardsDiscarded',
] as const

const RUN_RECORD_V1_NUMBER_KEYS = RUN_RECORD_NUMBER_KEYS.filter((key) => key !== 'activeDurationMs')

function emptyLifetime(): LifetimeStats {
  return {
    version: 2,
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
    durationMs: 0,
    byWorld: {},
  }
}

function isWorldStats(value: unknown): value is WorldStats {
  if (typeof value !== 'object' || value === null) return false

  const world = value as Record<string, unknown>
  return (
    (['runs', 'wins', 'losses', 'abandoned'] as const).every(
      (key) => typeof world[key] === 'number' && Number.isFinite(world[key]),
    ) &&
    (world.fewestTurnsWin === undefined ||
      (typeof world.fewestTurnsWin === 'number' && Number.isFinite(world.fewestTurnsWin))) &&
    (world.mostProgressInRun === undefined ||
      (typeof world.mostProgressInRun === 'number' && Number.isFinite(world.mostProgressInRun)))
  )
}

function isWorldStatsV1(value: unknown): value is WorldStatsV1 {
  if (typeof value !== 'object' || value === null) return false

  const world = value as Record<string, unknown>
  return (['runs', 'wins', 'losses', 'abandoned'] as const).every(
    (key) => typeof world[key] === 'number' && Number.isFinite(world[key]),
  )
}

function isSetupModifier(value: unknown): value is SetupModifier {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).kind === 'string'
  )
}

export function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false

  const run = value as Record<string, unknown>
  return (
    typeof run.sessionId === 'string' &&
    typeof run.worldId === 'string' &&
    Array.isArray(run.appliedModifiers) &&
    run.appliedModifiers.every(isSetupModifier) &&
    (run.outcome === 'won' || run.outcome === 'lost' || run.outcome === 'abandoned') &&
    RUN_RECORD_NUMBER_KEYS.every((key) => typeof run[key] === 'number' && Number.isFinite(run[key]))
  )
}

function isRunRecordV1(value: unknown): value is RunRecordV1 {
  if (typeof value !== 'object' || value === null) return false

  const run = value as Record<string, unknown>
  return (
    typeof run.sessionId === 'string' &&
    typeof run.worldId === 'string' &&
    Array.isArray(run.appliedModifiers) &&
    run.appliedModifiers.every(isSetupModifier) &&
    (run.outcome === 'won' || run.outcome === 'lost' || run.outcome === 'abandoned') &&
    RUN_RECORD_V1_NUMBER_KEYS.every((key) => typeof run[key] === 'number' && Number.isFinite(run[key]))
  )
}

// A payload claiming version 1 can still be malformed (partial write, manual
// edit, older dev build under the same key); folding garbage counters would
// poison every future run, so reject anything that doesn't fully check out.
export function isLifetimeStatsV2(value: unknown): value is LifetimeStats {
  if (typeof value !== 'object' || value === null) return false

  const stats = value as Record<string, unknown>
  return (
    stats.version === 2 &&
    LIFETIME_COUNTER_KEYS.every((key) => typeof stats[key] === 'number' && Number.isFinite(stats[key])) &&
    typeof stats.byWorld === 'object' &&
    stats.byWorld !== null &&
    Object.values(stats.byWorld).every(isWorldStats) &&
    (stats.lastRun === undefined || isRunRecord(stats.lastRun))
  )
}

export function isLifetimeStatsV1(value: unknown): value is LifetimeStatsV1 {
  if (typeof value !== 'object' || value === null) return false

  const stats = value as Record<string, unknown>
  return (
    stats.version === 1 &&
    LIFETIME_COUNTER_KEYS.every((key) => typeof stats[key] === 'number' && Number.isFinite(stats[key])) &&
    typeof stats.byWorld === 'object' &&
    stats.byWorld !== null &&
    Object.values(stats.byWorld).every(isWorldStatsV1) &&
    (stats.lastRun === undefined || isRunRecordV1(stats.lastRun))
  )
}

function migrateRunRecordV1toV2(run: RunRecordV1): RunRecord {
  return {
    ...run,
    activeDurationMs: Math.max(0, run.endedAt - run.startedAt),
  }
}

export function migrateLifetimeV1toV2(stats: LifetimeStatsV1): LifetimeStats {
  const { lastRun, ...statsWithoutLastRun } = stats

  return {
    ...statsWithoutLastRun,
    version: 2,
    byWorld: Object.fromEntries(
      Object.entries(stats.byWorld).map(([worldId, world]) => [
        worldId,
        {
          runs: world.runs,
          wins: world.wins,
          losses: world.losses,
          abandoned: world.abandoned,
        },
      ]),
    ),
    ...(lastRun === undefined ? {} : { lastRun: migrateRunRecordV1toV2(lastRun) }),
  }
}

type LoadedLifetime = Readonly<{ lifetime: LifetimeStats; removeLegacyAfterPersist: boolean }>

function parseStoredLifetime(raw: string, key: string): unknown | undefined {
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    console.warn('[runStats] failed to parse stored stats; starting fresh', { key, error })
    return undefined
  }
}

function loadLifetime(storage: RunStatsStorage | undefined, key: string): LoadedLifetime {
  if (storage === undefined) return { lifetime: emptyLifetime(), removeLegacyAfterPersist: false }

  try {
    const raw = storage.getItem(key)
    if (raw !== null) {
      const parsed = parseStoredLifetime(raw, key)
      if (isLifetimeStatsV2(parsed)) return { lifetime: parsed, removeLegacyAfterPersist: false }

      console.warn('[runStats] discarding stored stats with unknown shape or version', { key })
      return { lifetime: emptyLifetime(), removeLegacyAfterPersist: false }
    }

    const legacyRaw = storage.getItem(RUN_STATS_LEGACY_V1_KEY)
    if (legacyRaw === null) return { lifetime: emptyLifetime(), removeLegacyAfterPersist: false }

    const legacyParsed = parseStoredLifetime(legacyRaw, RUN_STATS_LEGACY_V1_KEY)
    if (!isLifetimeStatsV1(legacyParsed)) {
      console.warn('[runStats] discarding stored stats with unknown shape or version', { key: RUN_STATS_LEGACY_V1_KEY })
      return { lifetime: emptyLifetime(), removeLegacyAfterPersist: false }
    }

    return { lifetime: migrateLifetimeV1toV2(legacyParsed), removeLegacyAfterPersist: true }
  } catch (error) {
    console.warn('[runStats] failed to load stored stats; starting fresh', { key, error })
    return { lifetime: emptyLifetime(), removeLegacyAfterPersist: false }
  }
}

function persistLifetime(
  storage: RunStatsStorage | undefined,
  key: string,
  stats: LifetimeStats,
  options: { removeLegacyAfterPersist: boolean },
): boolean {
  if (storage === undefined) return true

  try {
    storage.setItem(key, JSON.stringify(stats))
    if (options.removeLegacyAfterPersist) storage.removeItem(RUN_STATS_LEGACY_V1_KEY)
    return true
  } catch (error) {
    console.warn('[runStats] failed to persist stats; keeping in-memory copy', { key, error })
    return false
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

function closeActiveSegment(accumulator: RunAccumulator, timestamp: number): void {
  if (accumulator.visibleSince === null) return

  accumulator.activeMs += Math.max(0, timestamp - accumulator.visibleSince)
  accumulator.visibleSince = null
}

function finalizeRun(accumulator: RunAccumulator, ended: RunEnded): RunRecord {
  closeActiveSegment(accumulator, ended.timestamp)

  return {
    sessionId: ended.sessionId,
    worldId: accumulator.worldId,
    seed: accumulator.seed,
    appliedModifiers: accumulator.appliedModifiers,
    outcome: ended.outcome,
    finalActIndex: ended.finalActIndex,
    startedAt: accumulator.startedAt,
    endedAt: ended.timestamp,
    activeDurationMs: accumulator.activeMs,
    turns: accumulator.turns,
    cardsPlayed: accumulator.cardsPlayed,
    progressDealt: accumulator.progressDealt,
    damageTaken: accumulator.damageTaken,
    hazardsResolved: accumulator.hazardsResolved,
    hazardsDiscarded: accumulator.hazardsDiscarded,
    cardsDiscarded: accumulator.cardsDiscarded,
  }
}

function foldIntoLifetime(lifetime: LifetimeStats, run: RunRecord): { lifetime: LifetimeStats; newRecords: RunRecordRecords } {
  const world = lifetime.byWorld[run.worldId] ?? { runs: 0, wins: 0, losses: 0, abandoned: 0 }
  const completed = run.outcome === 'won' || run.outcome === 'lost'
  const fewestTurnsWin =
    run.outcome === 'won' && (world.fewestTurnsWin === undefined || run.turns < world.fewestTurnsWin)
  const mostProgressInRun =
    completed && (world.mostProgressInRun === undefined || run.progressDealt > world.mostProgressInRun)
  const newRecords: RunRecordRecords = {
    ...(fewestTurnsWin ? { fewestTurnsWin: true } : {}),
    ...(mostProgressInRun ? { mostProgressInRun: true } : {}),
  }

  return {
    lifetime: {
    version: 2,
    runs: lifetime.runs + 1,
    wins: lifetime.wins + (run.outcome === 'won' ? 1 : 0),
    losses: lifetime.losses + (run.outcome === 'lost' ? 1 : 0),
    abandoned: lifetime.abandoned + (run.outcome === 'abandoned' ? 1 : 0),
    turns: lifetime.turns + (completed ? run.turns : 0),
    cardsPlayed: lifetime.cardsPlayed + (completed ? run.cardsPlayed : 0),
    progressDealt: lifetime.progressDealt + (completed ? run.progressDealt : 0),
    damageTaken: lifetime.damageTaken + (completed ? run.damageTaken : 0),
    hazardsResolved: lifetime.hazardsResolved + (completed ? run.hazardsResolved : 0),
    hazardsDiscarded: lifetime.hazardsDiscarded + (completed ? run.hazardsDiscarded : 0),
    cardsDiscarded: lifetime.cardsDiscarded + (completed ? run.cardsDiscarded : 0),
    durationMs: lifetime.durationMs + (completed ? run.activeDurationMs : 0),
    byWorld: {
      ...lifetime.byWorld,
      [run.worldId]: {
        runs: world.runs + 1,
        wins: world.wins + (run.outcome === 'won' ? 1 : 0),
        losses: world.losses + (run.outcome === 'lost' ? 1 : 0),
        abandoned: world.abandoned + (run.outcome === 'abandoned' ? 1 : 0),
        ...(fewestTurnsWin || world.fewestTurnsWin !== undefined
          ? { fewestTurnsWin: fewestTurnsWin ? run.turns : world.fewestTurnsWin }
          : {}),
        ...(mostProgressInRun || world.mostProgressInRun !== undefined
          ? { mostProgressInRun: mostProgressInRun ? run.progressDealt : world.mostProgressInRun }
          : {}),
      },
    },
    lastRun: run,
    },
    newRecords,
  }
}

/**
 * Derives per-run and lifetime counters purely from the gameplay event stream.
 * Runs observed only partially (the collector attached mid-run) are ignored
 * rather than recorded with understated counts.
 */
export function createRunStatsCollector(options: RunStatsCollectorOptions = {}): RunStatsCollector {
  const storageKey = options.lifetimeKey ?? RUN_STATS_STORAGE_KEY
  const historyKey = options.historyKey ?? RUN_HISTORY_STORAGE_KEY
  const clock = options.clock ?? Date.now
  const isVisible = options.visibility ?? (() => true)
  const loaded = loadLifetime(options.storage, storageKey)
  let lifetime = loaded.lifetime
  let history: RunHistoryPayload = loadHistory(options.storage, historyKey)
  let removeLegacyAfterPersist = loaded.removeLegacyAfterPersist
  let lastRunRecords: RunRecordRecords = {}
  const activeRuns = new Map<SessionId, RunAccumulator>()

  options.subscribeVisibility?.(() => {
    const timestamp = clock()

    if (isVisible()) {
      for (const accumulator of activeRuns.values()) {
        if (accumulator.visibleSince === null) accumulator.visibleSince = timestamp
      }
      return
    }

    for (const accumulator of activeRuns.values()) {
      closeActiveSegment(accumulator, timestamp)
    }
  })

  function onRunStarted(item: RunStarted): void {
    activeRuns.set(item.sessionId, {
      worldId: item.worldId,
      seed: item.seed,
      appliedModifiers: item.appliedModifiers,
      startedAt: item.timestamp,
      activeMs: 0,
      visibleSince: isVisible() ? item.timestamp : null,
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
    const run = finalizeRun(accumulator, item)
    const folded = foldIntoLifetime(lifetime, run)
    lifetime = folded.lifetime
    lastRunRecords = folded.newRecords
    if (persistLifetime(options.storage, storageKey, lifetime, { removeLegacyAfterPersist })) {
      removeLegacyAfterPersist = false
    }
    history = appendRun(history, run)
    persistHistory(options.storage, historyKey, history)
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
      return clonePlain(lifetime)
    },

    lastRunRecords() {
      return clonePlain(lastRunRecords)
    },

    history() {
      return clonePlain(history.records)
    },

    replaceAll(nextLifetime, nextHistory) {
      lifetime = clonePlain(nextLifetime)
      history = clonePlain(nextHistory)
      lastRunRecords = {}
      removeLegacyAfterPersist = false
      persistLifetime(options.storage, storageKey, lifetime, { removeLegacyAfterPersist: false })
      persistHistory(options.storage, historyKey, history)
    },
  }
}
