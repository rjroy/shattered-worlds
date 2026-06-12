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
} from './gameplayEventStream'

type MutableGameplayBatchSnapshot = {
  action: {
    type: string
    cardId?: string
    returnIds?: string[]
  }
  events: Array<Record<string, unknown>>
  state: {
    hand: unknown[]
    rng: { a: number }
    nextId: number
  }
}

describe('gameplayEventStream contract', () => {
  const createObservedBatch = () =>
    createGameplayBatch('session-observed', { type: 'EndTurn' }, {
      state: createGame(catalog, worldData, 11).state,
      events: [{ type: 'TurnEnded' }],
    })

  it('defines a run-start envelope with session identity and setup modifiers', () => {
    const item = createRunStarted({
      sessionId: 'session-1',
      worldId: 'zombie-big-box',
      seed: 42,
      appliedModifiers: [{ kind: 'bonus-card', templateId: 'Listen' }, { kind: 'hard-mode' }],
    }) satisfies RunStarted

    expect(item).toEqual({
      kind: 'RunStarted',
      sessionId: 'session-1',
      worldId: 'zombie-big-box',
      seed: 42,
      appliedModifiers: [{ kind: 'bonus-card', templateId: 'Listen' }, { kind: 'hard-mode' }],
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

    const batch = createGameplayBatch('session-1', action, { state, events }) satisfies GameplayBatch

    expect(batch.kind).toBe('GameplayBatch')
    expect(batch.sessionId).toBe('session-1')
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
    const batch = createGameplayBatch('session-13', action, { state, events })
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
    })

    modifiers.push({ kind: 'bonus-card', level: 2 })
    modifiers[0]!.level = 999

    expect(item.appliedModifiers).toHaveLength(1)
    expect(item.appliedModifiers[0]).toEqual({ kind: 'hard-mode', level: 1 })
  })

  it('defines a terminal run envelope with outcome and final act index', () => {
    const item = createRunEnded({
      sessionId: 'session-1',
      outcome: 'won',
      finalActIndex: 2,
    })

    expect(item).toEqual({
      kind: 'RunEnded',
      sessionId: 'session-1',
      outcome: 'won',
      finalActIndex: 2,
    })
  })

  it('discriminates the stream without flattening gameplay events to top-level items', () => {
    const state = createGame(catalog, worldData, 7).state

    const stream: RunStreamItem[] = [
      createRunStarted({
        sessionId: 'session-7',
        worldId: state.worldId,
        seed: 7,
        appliedModifiers: [],
      }),
      createGameplayBatch('session-7', { type: 'EndTurn' }, { state, events: [{ type: 'TurnEnded' }] }),
      createRunEnded({ sessionId: 'session-7', outcome: 'lost', finalActIndex: state.actIndex }),
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
      }),
      createRunEnded({
        sessionId: 'session-7',
        outcome: 'won',
        finalActIndex: 1,
      }),
    ]

    expect(Object.keys(stream[0] ?? {})).toEqual(['kind', 'sessionId', 'worldId', 'seed', 'appliedModifiers'])
    expect(stream[1]).toEqual({
      kind: 'GameplayBatch',
      sessionId: 'session-7',
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
    expect(Object.keys(stream[2] ?? {})).toEqual(['kind', 'sessionId', 'outcome', 'finalActIndex'])
    expect(() => structuredClone(stream)).not.toThrow()
  })

  it('stays renderer-free and imports no Phaser runtime', () => {
    const source = readFileSync(join(import.meta.dir, 'gameplayEventStream.ts'), 'utf8')
    const sessionSource = readFileSync(join(import.meta.dir, 'gameplaySession.ts'), 'utf8')

    expect(source.includes('phaser')).toBe(false)
    expect(source.includes('Phaser')).toBe(false)
    expect(sessionSource.includes('phaser')).toBe(false)
    expect(sessionSource.includes('Phaser')).toBe(false)
  })

  it('uses the public core surface for GameEvent and GameState types', () => {
    const item = createGameplayBatch('session-2', { type: 'EndTurn' }, {
      state: createGame(catalog, worldData, 2).state,
      events: [{ type: 'TurnEnded' }],
    })

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

  it('isolates subscriber mutations from later listeners and retained gameplay batches', () => {
    const stream = createGameplayEventStream()
    const batch = createGameplayBatch('session-isolated', {
      type: 'PlayCard',
      cardId: 'play-1',
      returnIds: ['hazard-1'],
    }, {
      state: createGame(catalog, worldData, 17).state,
      events: [{ type: 'WorldCardsReturned', ids: ['hazard-1'] }],
    })
    const authoritativeHandSize = batch.state.hand.length
    const authoritativeNextId = batch.state.nextId
    const authoritativeRngA = batch.state.rng.a
    let laterObservedBatch: GameplayBatch | undefined

    stream.subscribe((item) => {
      if (item.kind !== 'GameplayBatch') return

      const mutable = item as unknown as MutableGameplayBatchSnapshot
      mutable.action.cardId = 'mutated-card'
      mutable.action.returnIds?.push('hazard-2')
      mutable.events.push({ type: 'TurnEnded' })
      mutable.events[0]!.ids = ['changed']
      mutable.state.hand.length = 0
      mutable.state.rng.a = 123456
      mutable.state.nextId = 654321
    })
    stream.subscribe((item) => {
      if (item.kind === 'GameplayBatch') {
        laterObservedBatch = item
      }
    })

    stream.emit(batch)

    expect(laterObservedBatch).toEqual(batch)
    expect(laterObservedBatch).not.toBe(batch)
    expect(laterObservedBatch?.action).not.toBe(batch.action)
    expect(laterObservedBatch?.events).not.toBe(batch.events)
    expect(laterObservedBatch?.state).not.toBe(batch.state)
    expect(batch.action).toEqual({ type: 'PlayCard', cardId: 'play-1', returnIds: ['hazard-1'] })
    expect(batch.events).toEqual([{ type: 'WorldCardsReturned', ids: ['hazard-1'] }])
    expect(batch.state.hand).toHaveLength(authoritativeHandSize)
    expect(batch.state.rng.a).toBe(authoritativeRngA)
    expect(batch.state.nextId).toBe(authoritativeNextId)
  })

  it('delivers against a snapshot so mid-emission changes affect only later items', () => {
    const stream = createGameplayEventStream()
    const firstItem = createObservedBatch()
    const secondItem = createRunEnded({
      sessionId: 'session-observed',
      outcome: 'lost',
      finalActIndex: firstItem.state.actIndex,
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

  it('finishes the snapshot when subscribers throw, then rethrows the first error', () => {
    const stream = createGameplayEventStream()
    const calls: string[] = []
    const firstError = new Error('first listener failed')
    const secondError = new Error('second listener failed')

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

    expect(() => stream.emit(createObservedBatch())).toThrow(firstError)
    expect(calls).toEqual(['first', 'second', 'third'])
  })
})
