import { describe, expect, it } from 'bun:test'

import { createGame } from '../../core/index'
import type { Action, WorldData } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'

import { createGameplaySession, type GameplaySessionSubscriberError } from './gameplaySession'
import type { GameplayBatch, RunStreamItem } from './gameplayEventStream'

function requireHandCardId(
  session: Pick<ReturnType<typeof createGame>, 'state'>,
  kind: 'player' | 'world',
  name: string,
): string {
  const cardId = session.state.hand.find((card) => card.kind === kind && card.name === name)?.id
  if (cardId === undefined) {
    throw new Error(`expected ${kind} card ${name} in hand`)
  }

  return cardId
}

function createGuaranteedWinWorldData(): WorldData {
  return {
    worldId: 'req-events-win-world',
    starterDeck: [{ templateId: 'Explore', count: 4 }],
    deckComposition: {
      acts: [
        {
          cards: [{ templateId: 'Door', count: 2 }],
        },
      ],
    },
  }
}

// Two-act world: act 0 has two Screams (onEndOfTurn: DestroySelf), act 1 has one Door.
// Initial draw fills the hand with both Screams from act 0 (worldDraw exhausted, but no
// act boundary yet because draw stopped at 2). The first EndTurn fires DestroySelf on
// both Screams, then the draw phase tries to refill with worldDraw empty and act 1
// queued, triggering ActAdvanced(1) before drawing Door.
function createTwoActWorldData(): WorldData {
  return {
    worldId: 'req-events-two-act',
    starterDeck: [{ templateId: 'Explore', count: 4 }],
    deckComposition: {
      acts: [
        { cards: [{ templateId: 'Screams', count: 2 }] },
        { cards: [{ templateId: 'Door', count: 1 }] },
      ],
    },
  }
}

function expectOwnKeys(value: object, expected: readonly string[]): void {
  expect(Object.keys(value).sort()).toEqual([...expected].sort())
}

describe('gameplaySession', () => {
  it('emits one run-start envelope at creation through initial subscribers', () => {
    const items: RunStreamItem[] = []

    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-42',
      appliedModifiers: [{ kind: 'hard-mode' }],
      subscribers: [(item) => items.push(item)],
    })

    expect(session.sessionId).toBe('session-42')
    expect(items).toEqual([
      {
        kind: 'RunStarted',
        sessionId: 'session-42',
        worldId: worldData.worldId,
        seed: 42,
        appliedModifiers: [{ kind: 'hard-mode' }],
      },
    ])

    session.subscribe((item) => items.push(item))
    expect(items).toHaveLength(1)
  })

  it('reports run-start subscriber failures without aborting session creation', () => {
    const items: RunStreamItem[] = []
    const reports: GameplaySessionSubscriberError[] = []
    const failure = new Error('run start subscriber failed')

    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-run-start-error',
      subscribers: [
        () => {
          throw failure
        },
        (item) => items.push(item),
      ],
      onSubscriberError: (report) => reports.push(report),
    })

    expect(session.sessionId).toBe('session-run-start-error')
    expect(items).toEqual([
      {
        kind: 'RunStarted',
        sessionId: 'session-run-start-error',
        worldId: worldData.worldId,
        seed: 42,
        appliedModifiers: [],
      },
    ])
    expect(reports).toHaveLength(1)
    expect(reports[0]?.error).toBe(failure)
    expect(reports[0]?.item).toEqual(items[0])
  })

  it('stays close to GameCore by delegating state, available actions, intensity, and dispatch', () => {
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-core-shape',
    })
    const core = createGame(catalog, worldData, 42)
    const sessionActions = session.availableActions()
    const coreActions = core.availableActions()

    expect(session.state).toEqual(core.state)
    expect({
      playable: sessionActions.playable,
      discardable: sessionActions.discardable,
      canEndTurn: sessionActions.canEndTurn,
    }).toEqual({
      playable: coreActions.playable,
      discardable: coreActions.discardable,
      canEndTurn: coreActions.canEndTurn,
    })
    for (const playable of coreActions.playable) {
      expect(sessionActions.legalTargets(playable.cardId, 0)).toEqual(coreActions.legalTargets(playable.cardId, 0))
    }
    expect(session.intensity()).toBe(core.intensity())

    const action: Action = { type: 'EndTurn' }
    const sessionResult = session.dispatch(action)
    const coreResult = core.dispatch(action)
    const nextSessionActions = session.availableActions()
    const nextCoreActions = core.availableActions()

    expect(sessionResult).toEqual(coreResult)
    expect(session.state).toEqual(core.state)
    expect({
      playable: nextSessionActions.playable,
      discardable: nextSessionActions.discardable,
      canEndTurn: nextSessionActions.canEndTurn,
    }).toEqual({
      playable: nextCoreActions.playable,
      discardable: nextCoreActions.discardable,
      canEndTurn: nextCoreActions.canEndTurn,
    })
    for (const playable of nextCoreActions.playable) {
      expect(nextSessionActions.legalTargets(playable.cardId, 0)).toEqual(nextCoreActions.legalTargets(playable.cardId, 0))
    }
    expect(session.intensity()).toBe(core.intensity())
  })

  it('forwards each accepted dispatch as one gameplay batch with ordered core events', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-batch',
      subscribers: [(item) => items.push(item)],
    })
    const core = createGame(catalog, worldData, 42)

    const sessionResult = session.dispatch({ type: 'EndTurn' })
    const coreResult = core.dispatch({ type: 'EndTurn' })

    expect(sessionResult).toEqual(coreResult)
    expect(items).toHaveLength(2)
    expect(items[0]?.kind).toBe('RunStarted')

    const batch = items[1]

    expect(batch?.kind).toBe('GameplayBatch')
    expect(batch && 'events' in batch ? batch.events : []).toEqual(coreResult.events)
    expect(batch && 'action' in batch ? batch.action : undefined).toEqual({ type: 'EndTurn' })
    expect(batch && 'state' in batch ? batch.state : undefined).toEqual(coreResult.state)
  })

  it('keeps core output identical for the same seed and actions after subscribers are added', () => {
    const reports: GameplaySessionSubscriberError[] = []
    const observedItems: RunStreamItem[] = []
    const baselineSession = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-baseline',
    })
    const observedSession = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-observed',
      subscribers: [
        (item) => {
          if (item.kind !== 'GameplayBatch') return

          const mutable = item as unknown as {
            action: { type: string }
            events: Array<{ type: string }>
            state: { hp: number }
          }
          mutable.action.type = 'Mutated'
          mutable.events.reverse()
          mutable.state.hp = -999
        },
        (item) => {
          observedItems.push(item)
          if (item.kind === 'GameplayBatch') {
            throw new Error(`listener failed on ${item.action.type}`)
          }
        },
      ],
      onSubscriberError: (report) => reports.push(report),
    })
    const core = createGame(catalog, worldData, 42)
    const playExploreOnScreams: Action = {
      type: 'PlayCard',
      cardId: requireHandCardId(core, 'player', 'Explore'),
      targetId: requireHandCardId(core, 'world', 'Screams'),
    }
    const actions: readonly Action[] = [playExploreOnScreams, { type: 'EndTurn' }]

    for (const action of actions) {
      const observedResult = observedSession.dispatch(action)
      const baselineResult = baselineSession.dispatch(action)
      const coreResult = core.dispatch(action)

      expect(observedResult).toEqual(baselineResult)
      expect(observedResult).toEqual(coreResult)
    }

    expect(observedSession.state).toEqual(baselineSession.state)
    expect(observedSession.state).toEqual(core.state)
    expect(observedItems.map((item) => item.kind)).toEqual(['RunStarted', 'GameplayBatch', 'GameplayBatch'])
    expect(reports.map((report) => report.item.kind)).toEqual(['GameplayBatch', 'GameplayBatch'])
  })

  it('emits one run-end envelope exactly once when dispatch reaches a terminal state', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'session-terminal',
      subscribers: [(item) => items.push(item)],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    expect(session.state.status).toBe('lost')
    expect(items.at(-1)).toEqual({
      kind: 'RunEnded',
      sessionId: 'session-terminal',
      outcome: 'lost',
      finalActIndex: session.state.actIndex,
    })
    expect(items.filter((item) => item.kind === 'RunEnded')).toHaveLength(1)
    expect(items.filter((item) => item.kind === 'GameplayBatch')).toHaveLength(4)
  })

  it('reports subscriber failures without changing accepted dispatch or terminal emission', () => {
    const items: RunStreamItem[] = []
    const reports: GameplaySessionSubscriberError[] = []
    const failure = new Error('dispatch subscriber failed')
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'session-dispatch-error',
      subscribers: [
        (item) => {
          if (item.kind !== 'RunStarted') {
            throw failure
          }
        },
        (item) => items.push(item),
      ],
      onSubscriberError: (report) => reports.push(report),
    })
    const core = createGame(catalog, worldData, 17)
    let sessionResult = undefined as ReturnType<typeof session.dispatch> | undefined
    let coreResult = undefined as ReturnType<typeof core.dispatch> | undefined

    for (let turn = 0; turn < 4; turn += 1) {
      sessionResult = session.dispatch({ type: 'EndTurn' })
      coreResult = core.dispatch({ type: 'EndTurn' })
    }

    expect(sessionResult).toEqual(coreResult)
    expect(session.state).toEqual(core.state)
    expect(items.at(0)).toEqual({
      kind: 'RunStarted',
      sessionId: 'session-dispatch-error',
      worldId: worldData.worldId,
      seed: 17,
      appliedModifiers: [],
    })
    expect(items.filter((item) => item.kind === 'GameplayBatch')).toHaveLength(4)
    expect(items.at(-1)).toEqual({
      kind: 'RunEnded',
      sessionId: 'session-dispatch-error',
      outcome: 'lost',
      finalActIndex: session.state.actIndex,
    })
    expect(items.filter((item) => item.kind === 'RunEnded')).toHaveLength(1)
    expect(reports).toHaveLength(5)
    expect(reports.map((report) => report.error)).toEqual([failure, failure, failure, failure, failure])
    expect(reports.map((report) => report.item.kind)).toEqual([
      'GameplayBatch',
      'GameplayBatch',
      'GameplayBatch',
      'GameplayBatch',
      'RunEnded',
    ])
  })

  it('does not emit partial stream items for illegal post-terminal actions', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'session-illegal',
      subscribers: [(item) => items.push(item)],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    const emittedBeforeIllegal = items.slice()

    expect(() => session.dispatch({ type: 'EndTurn' })).toThrow()
    expect(items).toEqual(emittedBeforeIllegal)
  })

  it('supports optional subscribers and keeps emitted batches isolated from listener mutation', () => {
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-optional',
    })

    expect(() => session.dispatch({ type: 'EndTurn' })).not.toThrow()

    const observed: GameplayBatch[] = []
    session.subscribe((item) => {
      if (item.kind !== 'GameplayBatch') return

      const mutable = item as unknown as {
        action: { type: string }
        events: Array<{ type: string }>
        state: { hp: number }
      }
      mutable.action.type = 'Mutated'
      mutable.events.push({ type: 'MutatedEvent' })
      mutable.state.hp = -1
    })
    session.subscribe((item) => {
      if (item.kind === 'GameplayBatch') {
        observed.push(item)
      }
    })

    const resolution = session.dispatch({ type: 'EndTurn' })
    const batch = observed[0]

    expect(batch).toBeDefined()
    expect(batch?.action).toEqual({ type: 'EndTurn' })
    expect(batch?.events).toEqual(resolution.events)
    expect(batch?.state).toEqual(resolution.state)
    expect(session.state.hp).toBe(resolution.state.hp)
  })

  it('emits actual runtime payloads with semantic headless shapes only', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, createGuaranteedWinWorldData(), 42, {
      makeSessionId: () => 'session-headless-shapes',
      subscribers: [(item) => items.push(item)],
    })

    const doorId = requireHandCardId(session, 'world', 'Door')

    session.dispatch({
      type: 'PlayCard',
      cardId: requireHandCardId(session, 'player', 'Explore'),
      targetId: doorId,
    })
    session.dispatch({
      type: 'PlayCard',
      cardId: requireHandCardId(session, 'player', 'Explore'),
      targetId: doorId,
    })

    expect(items.map((item) => item.kind)).toEqual([
      'RunStarted',
      'GameplayBatch',
      'GameplayBatch',
      'RunEnded',
    ])

    const [runStarted, firstBatch, secondBatch, runEnded] = items

    expect(runStarted?.kind).toBe('RunStarted')
    expectOwnKeys(runStarted!, ['kind', 'sessionId', 'worldId', 'seed', 'appliedModifiers'])
    expect(runStarted).toEqual({
      kind: 'RunStarted',
      sessionId: 'session-headless-shapes',
      worldId: 'req-events-win-world',
      seed: 42,
      appliedModifiers: [],
    })

    expect(firstBatch?.kind).toBe('GameplayBatch')
    if (firstBatch?.kind !== 'GameplayBatch') {
      throw new Error('expected first emitted batch')
    }

    expectOwnKeys(firstBatch, ['kind', 'sessionId', 'action', 'events', 'state'])
    expectOwnKeys(firstBatch.action, ['type', 'cardId', 'targetId'])
    expect(firstBatch.events.map((event) => event.type)).toEqual([
      'CardPlayed',
      'ProgressDealt',
      'HazardPartial',
    ])
    expectOwnKeys(firstBatch.events[0]!, ['type', 'cardId'])
    expectOwnKeys(firstBatch.events[1]!, ['type', 'hazardId', 'amount', 'hazardTurnTotal'])
    expectOwnKeys(firstBatch.events[2]!, ['type', 'hazardId'])

    expect(secondBatch?.kind).toBe('GameplayBatch')
    if (secondBatch?.kind !== 'GameplayBatch') {
      throw new Error('expected second emitted batch')
    }

    expectOwnKeys(secondBatch, ['kind', 'sessionId', 'action', 'events', 'state'])
    expectOwnKeys(secondBatch.action, ['type', 'cardId', 'targetId'])
    expect(secondBatch.events.map((event) => event.type)).toEqual([
      'CardPlayed',
      'ProgressDealt',
      'WorldWon',
      'HazardResolved',
    ])
    expectOwnKeys(secondBatch.events[0]!, ['type', 'cardId'])
    expectOwnKeys(secondBatch.events[1]!, ['type', 'hazardId', 'amount', 'hazardTurnTotal'])
    expectOwnKeys(secondBatch.events[2]!, ['type'])
    expectOwnKeys(secondBatch.events[3]!, ['type', 'hazardId'])

    expect(runEnded?.kind).toBe('RunEnded')
    expectOwnKeys(runEnded!, ['kind', 'sessionId', 'outcome', 'finalActIndex'])
    expect(runEnded).toEqual({
      kind: 'RunEnded',
      sessionId: 'session-headless-shapes',
      outcome: 'won',
      finalActIndex: 0,
    })
  })

  it('stays opt-in by matching a full terminal core run with no subscribers', () => {
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'session-headless-optional',
    })
    const core = createGame(catalog, worldData, 17)

    for (let turn = 0; turn < 4; turn += 1) {
      expect(() => session.dispatch({ type: 'EndTurn' })).not.toThrow()
      core.dispatch({ type: 'EndTurn' })
    }

    expect(session.state.status).toBe('lost')
    expect(session.state).toEqual(core.state)
    expect(session.availableActions().canEndTurn).toBe(core.availableActions().canEndTurn)
    expect(session.intensity()).toBe(core.intensity())
  })

  it('silently consumes a throwing onSubscriberError reporter without aborting dispatch', () => {
    // Exercises the double-catch in reportSubscriberError: subscriber throws, reporter
    // also throws, and dispatch still returns a valid result.
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-reporter-throw',
      subscribers: [
        () => {
          throw new Error('subscriber failed')
        },
        (item) => items.push(item),
      ],
      onSubscriberError: () => {
        throw new Error('reporter also failed')
      },
    })

    let result: ReturnType<typeof session.dispatch> | undefined
    expect(() => {
      result = session.dispatch({ type: 'EndTurn' })
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.state).toEqual(session.state)
    expect(items.filter((item) => item.kind === 'GameplayBatch')).toHaveLength(1)
  })

  // REQ-EVENTS-4: discard/destruction tracking — HazardDiscarded
  it('exposes HazardDiscarded events in stream batches when a hazard is discarded', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-hazard-discard',
      subscribers: [(item) => items.push(item)],
    })

    // Screams is discardable and present in the initial hand at seed 42
    const screamsId = session.state.hand.find(
      (card) => card.kind === 'world' && card.name === 'Screams',
    )?.id
    expect(screamsId).toBeDefined()
    if (screamsId === undefined) throw new Error('expected Screams in initial hand at seed 42')

    session.dispatch({ type: 'DiscardHazard', cardId: screamsId })

    const batches = items.filter((item): item is GameplayBatch => item.kind === 'GameplayBatch')
    expect(batches).toHaveLength(1)
    const eventTypes = batches[0]!.events.map((e) => e.type)
    expect(eventTypes).toContain('HazardDiscarded')
    expect(batches[0]!.events[0]).toEqual({ type: 'HazardDiscarded', cardId: screamsId })
  })

  // REQ-EVENTS-4: discard/destruction tracking — CardDestroyed and CardsDiscarded
  it('exposes CardDestroyed and CardsDiscarded events in EndTurn batches when world cards self-destruct', () => {
    const items: RunStreamItem[] = []
    // Seed 42: Screams (onEndOfTurn: DestroySelf) is in the initial hand, so EndTurn
    // fires DestroySelf → CardDestroyed, then discards player hand → CardsDiscarded.
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'session-destroy-tracking',
      subscribers: [(item) => items.push(item)],
    })

    expect(session.state.hand.some((c) => c.kind === 'world' && c.name === 'Screams')).toBe(true)
    session.dispatch({ type: 'EndTurn' })

    const batches = items.filter((item): item is GameplayBatch => item.kind === 'GameplayBatch')
    expect(batches).toHaveLength(1)
    const eventTypes = batches[0]!.events.map((e) => e.type)
    expect(eventTypes).toContain('CardDestroyed')
    expect(eventTypes).toContain('CardsDiscarded')
    // CardDestroyed (from DestroySelf) comes before CardsDiscarded (player hand cleanup)
    expect(eventTypes.indexOf('CardDestroyed')).toBeLessThan(eventTypes.indexOf('CardsDiscarded'))
  })

  // REQ-EVENTS-4, REQ-EVENTS-9: act-boundary tracking — ActAdvanced
  it('exposes ActAdvanced events in stream batches when gameplay crosses an act boundary', () => {
    const twoActWorld = createTwoActWorldData()
    const items: RunStreamItem[] = []
    // Act 0 has 1 Screams card; after initial draw, worldDraw is empty and act 1
    // (Door) is queued. The first EndTurn fires DestroySelf on Screams then draws
    // across the act boundary, producing ActAdvanced(1) in the same batch.
    const session = createGameplaySession(catalog, twoActWorld, 42, {
      makeSessionId: () => 'session-act-boundary',
      subscribers: [(item) => items.push(item)],
    })

    session.dispatch({ type: 'EndTurn' })

    const batches = items.filter((item): item is GameplayBatch => item.kind === 'GameplayBatch')
    const allEventTypes = batches.flatMap((b) => b.events.map((e) => e.type))
    expect(allEventTypes).toContain('ActAdvanced')

    // Subscribers can determine act transitions without touching renderer state
    const actAdvancedBatch = batches.find((b) => b.events.some((e) => e.type === 'ActAdvanced'))
    expect(actAdvancedBatch).toBeDefined()
    const actEvent = actAdvancedBatch!.events.find((e) => e.type === 'ActAdvanced')
    expect(actEvent).toEqual({ type: 'ActAdvanced', act: 1 })
  })
})
