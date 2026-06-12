import { describe, expect, it } from 'bun:test'

import type { WorldData } from '../../core/index'
import { catalog, worldData } from '../../core/tests/testFixture'
import { createGameplaySession } from '../runtime/gameplaySession'
import type { GameplayBatch, RunStreamItem } from '../runtime/gameplayEventStream'

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

describe('gameplaySession integration', () => {
  it('delivers one dispatch batch to multiple subscribers from the same session flow', () => {
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => 'renderer-session',
    })
    const rendererObserved: GameplayBatch[] = []
    const secondObserved: GameplayBatch[] = []

    session.subscribe((item) => {
      if (item.kind === 'GameplayBatch') {
        rendererObserved.push(item)
      }
    })
    session.subscribe((item) => {
      if (item.kind === 'GameplayBatch') {
        secondObserved.push(item)
      }
    })

    const resolution = session.dispatch({ type: 'EndTurn' })

    expect(rendererObserved).toHaveLength(1)
    expect(secondObserved).toHaveLength(1)
    expect(rendererObserved[0]).toEqual(secondObserved[0])
    expect(rendererObserved[0]).toEqual({
      kind: 'GameplayBatch',
      sessionId: 'renderer-session',
      action: { type: 'EndTurn' },
      events: resolution.events,
      state: resolution.state,
    })
    expect(session.state).toEqual(resolution.state)
  })

  it('gives initial subscribers identical full history from run start through terminal outcome', () => {
    const firstHistory: RunStreamItem[] = []
    const secondHistory: RunStreamItem[] = []
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => 'shared-history',
      subscribers: [
        (item) => firstHistory.push(item),
        (item) => secondHistory.push(item),
      ],
    })

    for (let turn = 0; turn < 4; turn += 1) {
      session.dispatch({ type: 'EndTurn' })
    }

    expect(firstHistory).toEqual(secondHistory)
    expect(firstHistory.map((item) => item.kind)).toEqual([
      'RunStarted',
      'GameplayBatch',
      'GameplayBatch',
      'GameplayBatch',
      'GameplayBatch',
      'RunEnded',
    ])
    expect(firstHistory[0]).toEqual({
      kind: 'RunStarted',
      sessionId: 'shared-history',
      worldId: worldData.worldId,
      seed: 17,
      appliedModifiers: [],
    })
    expect(firstHistory.at(-1)).toEqual({
      kind: 'RunEnded',
      sessionId: 'shared-history',
      outcome: 'lost',
      finalActIndex: session.state.actIndex,
    })
    expect(firstHistory.every((item) => item.sessionId === 'shared-history')).toBe(true)
  })

  it('emits one winning RunEnded with the real terminal session identity and act index', () => {
    const items: RunStreamItem[] = []
    const session = createGameplaySession(catalog, createGuaranteedWinWorldData(), 42, {
      makeSessionId: () => 'winning-history',
      subscribers: [(item) => items.push(item)],
    })
    const doorId = session.state.hand.find((card) => card.kind === 'world' && card.name === 'Door')?.id

    expect(doorId).toBeDefined()
    if (doorId === undefined) {
      throw new Error('expected Door in opening hand')
    }

    for (let plays = 0; plays < 2; plays += 1) {
      const exploreId = session.state.hand.find((card) => card.kind === 'player' && card.name === 'Explore')?.id

      expect(exploreId).toBeDefined()
      if (exploreId === undefined) {
        throw new Error('expected Explore in opening hand')
      }

      session.dispatch({ type: 'PlayCard', cardId: exploreId, targetId: doorId })
    }

    expect(session.state.status).toBe('won')
    expect(items.map((item) => item.kind)).toEqual([
      'RunStarted',
      'GameplayBatch',
      'GameplayBatch',
      'RunEnded',
    ])

    const runEndedItems = items.filter((item) => item.kind === 'RunEnded')

    expect(runEndedItems).toEqual([
      {
        kind: 'RunEnded',
        sessionId: 'winning-history',
        outcome: 'won',
        finalActIndex: session.state.actIndex,
      },
    ])
    expect(session.state.actIndex).toBe(0)
  })

  it('keeps TableScene on the observed session seam instead of raw createGame', async () => {
    const source = await Bun.file(new URL('../scenes/TableScene.ts', import.meta.url)).text()

    expect(source).toContain('createGameplaySession')
    expect(source).toContain('private game_!: GameplaySession')
    expect(source).toContain('this.game_ = createGameplaySession(catalog, worldData, this.seed_)')
    expect(source).not.toContain('createGame(')
  })
})
