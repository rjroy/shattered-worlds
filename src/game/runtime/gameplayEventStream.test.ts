import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createGame } from '../../core/index'
import type { Action, GameEvent, GameState, WorldCard } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import {
  createGameplayEventStream,
  createGameplayBatch,
  createRunEnded,
  createRunStarted,
  type GameplayBatch,
  type RunStarted,
  type RunStreamItem,
  type SubscriberFailure,
} from './gameplayEventStream'

describe('gameplayEventStream contract', () => {
  const createObservedBatch = () =>
    createGameplayBatch('session-observed', { type: 'EndTurn' }, {
      state: createGame(catalog, worldData, 11).state,
      events: [{ type: 'TurnEnded' }],
    }, 1_100)

  it('defines a run-start envelope with session identity, setup modifiers, and a timestamp', () => {
    const item = createRunStarted({
      sessionId: 'session-1',
      worldId: 'zombie-big-box',
      seed: 42,
      appliedModifiers: [{ kind: 'bonus-card', templateId: 'Listen' }, { kind: 'hard-mode' }],
      timestamp: 1_000,
    }) satisfies RunStarted

    expect(item).toEqual({
      kind: 'RunStarted',
      sessionId: 'session-1',
      worldId: 'zombie-big-box',
      seed: 42,
      appliedModifiers: [{ kind: 'bonus-card', templateId: 'Listen' }, { kind: 'hard-mode' }],
      timestamp: 1_000,
    })
  })

  it('wraps one accepted dispatch as one grouped gameplay batch', () => {
    const state = createGame(catalog, worldData, 42).state
    const hazardId = (state.hand.find((card): card is WorldCard => card.kind === 'world') ?? state.acts[0]?.[0])?.id

    expect(hazardId).toBeDefined()
    if (hazardId === undefined) throw new Error('expected fixture to include a hazard id')

    const action: Action = { type: 'PlayCard', cardId: 'play-1', targetId: hazardId }
    const events: readonly GameEvent[] = [
      { type: 'CardPlayed', cardId: 'play-1' },
      { type: 'ProgressDealt', hazardId, amount: 2, hazardTurnTotal: 2 },
      { type: 'HazardDiscarded', cardId: hazardId },
      { type: 'CardDestroyed', id: 'spent-1' },
      { type: 'ActAdvanced', act: 1 },
    ]

    const batch = createGameplayBatch('session-1', action, { state, events }, 1_100) satisfies GameplayBatch

    expect(batch.kind).toBe('GameplayBatch')
    expect(batch.sessionId).toBe('session-1')
    expect(batch.timestamp).toBe(1_100)
    expect(batch.action).toEqual(action)
    expect(batch.events).toEqual(events)
    expect(batch.events.map((event) => event.type)).toEqual([
      'CardPlayed',
      'ProgressDealt',
      'HazardDiscarded',
      'CardDestroyed',
      'ActAdvanced',
    ])
    expect(batch.action).not.toBe(action)
    expect(batch.events).not.toBe(events)
    expect(batch.state).not.toBe(state)
  })

  it('snapshots gameplay batches instead of retaining caller-owned references', () => {
    const state = createGame(catalog, worldData, 13).state
    const action: Action = { type: 'PlayCard', cardId: 'play-1', returnIds: ['hazard-1'] }
    const events: readonly GameEvent[] = [{ type: 'WorldCardsReturned', ids: ['hazard-1'] }]
    const batch = createGameplayBatch('session-13', action, { state, events }, 1_100)
    const mutableAction = action as unknown as { cardId: string; returnIds: string[] }
    const mutableEvents = events as unknown as Array<{ ids: string[] }>
    const mutableState = state as unknown as { nextId: number; rng: { a: number } }

    mutableAction.cardId = 'mutated-card'
    mutableAction.returnIds.push('hazard-2')
    mutableEvents[0]?.ids.push('hazard-2')
    mutableState.nextId = 999
    mutableState.rng.a = 777

    expect(batch.action).toEqual({ type: 'PlayCard', cardId: 'play-1', returnIds: ['hazard-1'] })
    expect(batch.events).toEqual([{ type: 'WorldCardsReturned', ids: ['hazard-1'] }])
    expect(batch.state.nextId).not.toBe(999)
    expect(batch.state.rng.a).not.toBe(777)
  })

  it('snapshots run-start appliedModifiers so caller mutation does not affect the emitted envelope', () => {
    const modifiers = [{ kind: 'hard-mode', level: 1 }]
    const item = createRunStarted({
      sessionId: 'session-clone',
      worldId: 'zombie-big-box',
      seed: 5,
      appliedModifiers: modifiers,
      timestamp: 1_000,
    })

    modifiers.push({ kind: 'bonus-card', level: 2 })
    modifiers[0]!.level = 999

    expect(item.appliedModifiers).toHaveLength(1)
    expect(item.appliedModifiers[0]).toEqual({ kind: 'hard-mode', level: 1 })
  })

  it('defines a terminal run envelope with outcome, final act index, and a timestamp', () => {
    const item = createRunEnded({
      sessionId: 'session-1',
      outcome: 'won',
      finalActIndex: 2,
      timestamp: 1_200,
    })

    expect(item).toEqual({
      kind: 'RunEnded',
      sessionId: 'session-1',
      outcome: 'won',
      finalActIndex: 2,
      timestamp: 1_200,
    })
  })

  it('supports an abandoned outcome distinct from won and lost', () => {
    const item = createRunEnded({
      sessionId: 'session-quit',
      outcome: 'abandoned',
      finalActIndex: 1,
      timestamp: 1_200,
    })

    expect(item.outcome).toBe('abandoned')
    expect(item.outcome).not.toBe('won')
    expect(item.outcome).not.toBe('lost')
  })

  it('deep-freezes constructed stream items', () => {
    const batch = createObservedBatch()

    expect(Object.isFrozen(batch)).toBe(true)
    expect(Object.isFrozen(batch.action)).toBe(true)
    expect(Object.isFrozen(batch.events)).toBe(true)
    expect(Object.isFrozen(batch.events[0])).toBe(true)
    expect(Object.isFrozen(batch.state)).toBe(true)
    expect(Object.isFrozen(batch.state.hand)).toBe(true)
  })

  it('discriminates the stream without flattening gameplay events to top-level items', () => {
    const state = createGame(catalog, worldData, 7).state

    const stream: RunStreamItem[] = [
      createRunStarted({
        sessionId: 'session-7',
        worldId: state.worldId,
        seed: 7,
        appliedModifiers: [],
        timestamp: 1_000,
      }),
      createGameplayBatch('session-7', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }, 1_100),
      createRunEnded({ sessionId: 'session-7', outcome: 'lost', finalActIndex: state.actIndex, timestamp: 1_200 }),
    ]

    expect(stream.map((item) => item.kind)).toEqual(['RunStarted', 'GameplayBatch', 'RunEnded'])
    const batch = stream[1]

    expect(batch?.kind).toBe('GameplayBatch')
    expect(batch && 'events' in batch ? batch.events : []).toEqual([{ type: 'TurnEnded' }])
  })

  it('exposes semantic payloads for gameplay tracking without renderer-only envelopes', () => {
    const state = createGame(catalog, worldData, 7).state
    const stream: RunStreamItem[] = [
      createRunStarted({
        sessionId: 'session-7',
        worldId: state.worldId,
        seed: 7,
        appliedModifiers: [{ kind: 'hard-mode' }],
        timestamp: 1_000,
      }),
      createGameplayBatch('session-7', { type: 'PlayCard', cardId: 'play-1', targetId: 'hazard-1' }, {
        state,
        events: [
          { type: 'CardPlayed', cardId: 'play-1' },
          { type: 'ProgressDealt', hazardId: 'hazard-1', amount: 2, hazardTurnTotal: 3 },
          { type: 'HazardDiscarded', cardId: 'hazard-2' },
          { type: 'CardDestroyed', id: 'spent-1' },
          { type: 'ActAdvanced', act: 1 },
        ],
      }, 1_100),
      createRunEnded({
        sessionId: 'session-7',
        outcome: 'won',
        finalActIndex: 1,
        timestamp: 1_200,
      }),
    ]

    expect(Object.keys(stream[0] ?? {})).toEqual(['kind', 'sessionId', 'worldId', 'seed', 'appliedModifiers', 'timestamp'])
    expect(stream[1]).toEqual({
      kind: 'GameplayBatch',
      sessionId: 'session-7',
      timestamp: 1_100,
      action: { type: 'PlayCard', cardId: 'play-1', targetId: 'hazard-1' },
      events: [
        { type: 'CardPlayed', cardId: 'play-1' },
        { type: 'ProgressDealt', hazardId: 'hazard-1', amount: 2, hazardTurnTotal: 3 },
        { type: 'HazardDiscarded', cardId: 'hazard-2' },
        { type: 'CardDestroyed', id: 'spent-1' },
        { type: 'ActAdvanced', act: 1 },
      ],
      state,
    })
    expect(Object.keys(stream[2] ?? {})).toEqual(['kind', 'sessionId', 'outcome', 'finalActIndex', 'timestamp'])
    expect(() => structuredClone(stream)).not.toThrow()
  })

  it('stays renderer-free and imports no Phaser runtime', () => {
    const runtimeModules = [
      'gameplayEventStream.ts',
      'gameplaySession.ts',
      'gameplayRuntime.ts',
      'runStats.ts',
    ]

    for (const module of runtimeModules) {
      const source = readFileSync(join(import.meta.dir, module), 'utf8')

      expect(source).not.toMatch(/from\s+['"]phaser['"]/i)
      expect(source).not.toMatch(/import\s*\(\s*['"]phaser['"]\s*\)/i)
    }
  })

  it('uses the public core surface for GameEvent and GameState types', () => {
    const item = createGameplayBatch('session-2', { type: 'EndTurn' }, {
      state: createGame(catalog, worldData, 2).state,
      events: [{ type: 'TurnEnded' }],
    }, 1_100)

    const state: GameState = item.state

    expect(state.worldId).toBe(worldData.worldId)
  })

  it('supports no-subscriber emission as an optional no-op', () => {
    const stream = createGameplayEventStream()

    expect(stream.emit(createObservedBatch())).toBeUndefined()
  })

  it('fans out to multiple listeners in subscription order', () => {
    const stream = createGameplayEventStream()
    const calls: string[] = []
    const batch = createObservedBatch()

    stream.subscribe((item) => {
      calls.push(`first:${item.kind}`)
      return 'ignored'
    })
    stream.subscribe((item) => {
      calls.push(`second:${item.kind}`)
    })

    expect(stream.emit(batch)).toBeUndefined()
    expect(calls).toEqual(['first:GameplayBatch', 'second:GameplayBatch'])
  })

  it('surfaces subscriber mutation attempts as failures and keeps later listeners intact', () => {
    const failures: SubscriberFailure[] = []
    const stream = createGameplayEventStream((failure) => failures.push(failure))
    const batch = createGameplayBatch('session-isolated', {
      type: 'PlayCard',
      cardId: 'play-1',
      returnIds: ['hazard-1'],
    }, {
      state: createGame(catalog, worldData, 17).state,
      events: [{ type: 'WorldCardsReturned', ids: ['hazard-1'] }],
    }, 1_100)
    const authoritativeHandSize = batch.state.hand.length
    const authoritativeNextId = batch.state.nextId
    let laterObservedBatch: GameplayBatch | undefined

    stream.subscribe((item) => {
      if (item.kind !== 'GameplayBatch') return

      const mutable = item as unknown as { action: { cardId: string } }
      mutable.action.cardId = 'mutated-card'
    })
    stream.subscribe((item) => {
      if (item.kind === 'GameplayBatch') {
        laterObservedBatch = item
      }
    })

    stream.emit(batch)

    expect(failures).toHaveLength(1)
    expect(failures[0]?.error).toBeInstanceOf(TypeError)
    expect(laterObservedBatch).toBe(batch)
    expect(batch.action).toEqual({ type: 'PlayCard', cardId: 'play-1', returnIds: ['hazard-1'] })
    expect(batch.events).toEqual([{ type: 'WorldCardsReturned', ids: ['hazard-1'] }])
    expect(batch.state.hand).toHaveLength(authoritativeHandSize)
    expect(batch.state.nextId).toBe(authoritativeNextId)
  })

  it('delivers against a snapshot so mid-emission changes affect only later items', () => {
    const stream = createGameplayEventStream()
    const firstItem = createObservedBatch()
    const secondItem = createRunEnded({
      sessionId: 'session-observed',
      outcome: 'lost',
      finalActIndex: firstItem.state.actIndex,
      timestamp: 1_200,
    })
    const calls: string[] = []
    let addedLateSubscriber = false
    let unsubscribeSecond = () => {}

    stream.subscribe(() => {
      calls.push('first')

      if (!addedLateSubscriber) {
        addedLateSubscriber = true
        unsubscribeSecond()
        stream.subscribe(() => {
          calls.push('third')
        })
      }
    })
    unsubscribeSecond = stream.subscribe(() => {
      calls.push('second')
    })

    stream.emit(firstItem)
    expect(calls).toEqual(['first', 'second'])

    calls.length = 0
    stream.emit(secondItem)
    expect(calls).toEqual(['first', 'third'])
  })

  it('reports every subscriber failure without throwing back into the emitter', () => {
    const failures: SubscriberFailure[] = []
    const stream = createGameplayEventStream((failure) => failures.push(failure))
    const calls: string[] = []
    const firstError = new Error('first listener failed')
    const secondError = new Error('second listener failed')
    const batch = createObservedBatch()

    stream.subscribe(() => {
      calls.push('first')
      throw firstError
    })
    stream.subscribe(() => {
      calls.push('second')
      throw secondError
    })
    stream.subscribe(() => {
      calls.push('third')
    })

    expect(() => stream.emit(batch)).not.toThrow()
    expect(calls).toEqual(['first', 'second', 'third'])
    expect(failures.map((failure) => failure.error)).toEqual([firstError, secondError])
    expect(failures.every((failure) => failure.item === batch)).toBe(true)
  })

  it('keeps delivering when the failure handler itself throws', () => {
    const stream = createGameplayEventStream(() => {
      throw new Error('handler failed')
    })
    const calls: string[] = []

    stream.subscribe(() => {
      throw new Error('subscriber failed')
    })
    stream.subscribe(() => {
      calls.push('second')
    })

    expect(() => stream.emit(createObservedBatch())).not.toThrow()
    expect(calls).toEqual(['second'])
  })
})
