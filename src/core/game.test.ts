import { describe, expect, it } from 'bun:test'
import { createGame } from './game'
import type { GameState, CardId } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all card ids across every zone. */
function allCardIds(state: GameState): CardId[] {
  return [
    ...state.drawPile.map((c) => c.id),
    ...state.hand.map((c) => c.id),
    ...state.played.map((c) => c.id),
    ...state.discard.map((c) => c.id),
  ]
}

function assertConservation(state: GameState): void {
  const ids = allCardIds(state)
  expect(ids.length).toBe(10)
  expect(new Set(ids).size).toBe(10)
}

// ---------------------------------------------------------------------------
// New game state
// ---------------------------------------------------------------------------

describe('createGame – initial state', () => {
  it('starts with 5 cards in hand', () => {
    const game = createGame(1)
    expect(game.state.hand.length).toBe(5)
  })

  it('starts with 5 cards in drawPile', () => {
    const game = createGame(1)
    expect(game.state.drawPile.length).toBe(5)
  })

  it('starts with empty discard', () => {
    const game = createGame(1)
    expect(game.state.discard.length).toBe(0)
  })

  it('starts with runningTotal 0', () => {
    const game = createGame(1)
    expect(game.state.runningTotal).toBe(0)
  })

  it('starts with empty history', () => {
    const game = createGame(1)
    expect(game.state.history.length).toBe(0)
  })

  it('starts with empty played zone', () => {
    const game = createGame(1)
    expect(game.state.played.length).toBe(0)
  })

  it('satisfies conservation invariant at start', () => {
    assertConservation(createGame(1).state)
    assertConservation(createGame(99).state)
    assertConservation(createGame(12345).state)
  })
})

// ---------------------------------------------------------------------------
// Replay equivalence
// ---------------------------------------------------------------------------

describe('replay equivalence', () => {
  it('same seed + same action sequence produces identical final state', () => {
    const actions = [
      { type: 'EndTurn' as const },
      { type: 'EndTurn' as const },
    ]

    const g1 = createGame(77)
    const g2 = createGame(77)

    const events1: string[][] = []
    const events2: string[][] = []

    for (const action of actions) {
      const r1 = g1.dispatch(action)
      const r2 = g2.dispatch(action)
      events1.push(r1.events.map((e) => e.type))
      events2.push(r2.events.map((e) => e.type))
    }

    expect(g1.state).toEqual(g2.state)
    expect(events1).toEqual(events2)
  })

  it('same seed + PlayCard + EndTurn sequence is deterministic', () => {
    function runSequence(seed: number): { state: GameState; eventTypes: string[] } {
      const g = createGame(seed)
      const allEventTypes: string[] = []

      // Play first card from hand
      const firstCard = g.state.hand[0]
      if (firstCard !== undefined) {
        const r1 = g.dispatch({ type: 'PlayCard', cardId: firstCard.id })
        allEventTypes.push(...r1.events.map((e) => e.type))
      }

      const r2 = g.dispatch({ type: 'EndTurn' })
      allEventTypes.push(...r2.events.map((e) => e.type))

      return { state: g.state, eventTypes: allEventTypes }
    }

    const run1 = runSequence(999)
    const run2 = runSequence(999)

    expect(run1.state).toEqual(run2.state)
    expect(run1.eventTypes).toEqual(run2.eventTypes)
  })
})

// ---------------------------------------------------------------------------
// Different seeds
// ---------------------------------------------------------------------------

describe('different seeds', () => {
  it('seed A and seed B produce different initial hand compositions', () => {
    const seedPairs = [
      [1, 2],
      [100, 200],
      [42, 43],
    ]

    for (const [a, b] of seedPairs) {
      if (a === undefined || b === undefined) continue
      const gA = createGame(a)
      const gB = createGame(b)
      const handA = gA.state.hand.map((c) => c.id).sort()
      const handB = gB.state.hand.map((c) => c.id).sort()
      // Not guaranteed for every pair, but for these specific seeds the
      // hands should differ.
      expect(handA).not.toEqual(handB)
    }
  })
})

// ---------------------------------------------------------------------------
// Dispatch synchrony
// ---------------------------------------------------------------------------

describe('dispatch synchrony', () => {
  it('dispatch() return value is not a Promise', () => {
    const game = createGame(1)
    const result = game.dispatch({ type: 'EndTurn' })
    expect(result).not.toBeInstanceOf(Promise)
    expect('then' in result).toBe(false)
  })

  it('state is updated synchronously after dispatch', () => {
    const game = createGame(1)
    const before = game.state.history.length
    game.dispatch({ type: 'EndTurn' })
    expect(game.state.history.length).toBe(before + 1)
  })
})

// ---------------------------------------------------------------------------
// Reshuffle
// ---------------------------------------------------------------------------

describe('reshuffle', () => {
  it('emits DeckShuffled when draw pile is exhausted during EndTurn', () => {
    // After each EndTurn, 5 cards move from drawPile to discard. After turn 2
    // the draw pile is empty and discard holds 10 cards. Turn 3 EndTurn must
    // reshuffle.
    const game = createGame(55)

    // Turn 1 — 5 cards draw from the remaining 5 in drawPile → drawPile now 0
    game.dispatch({ type: 'EndTurn' })
    // Turn 2 — drawPile is 0 so reshuffle must happen
    const { events } = game.dispatch({ type: 'EndTurn' })

    const types = events.map((e) => e.type)
    expect(types).toContain('DeckShuffled')
  })

  it('conservation holds across a reshuffle', () => {
    const game = createGame(55)
    game.dispatch({ type: 'EndTurn' })
    game.dispatch({ type: 'EndTurn' })
    assertConservation(game.state)
  })
})

// ---------------------------------------------------------------------------
// Event order on EndTurn
// ---------------------------------------------------------------------------

describe('EndTurn event order', () => {
  it('always starts with TurnEnded then CardsDiscarded', () => {
    const game = createGame(7)
    const { events } = game.dispatch({ type: 'EndTurn' })
    expect(events[0]?.type).toBe('TurnEnded')
    expect(events[1]?.type).toBe('CardsDiscarded')
  })

  it('always ends with CardsDrawn', () => {
    const game = createGame(8)
    const { events } = game.dispatch({ type: 'EndTurn' })
    expect(events[events.length - 1]?.type).toBe('CardsDrawn')
  })

  it('DeckShuffled appears between CardsDiscarded and CardsDrawn when reshuffle happens', () => {
    const game = createGame(55)
    game.dispatch({ type: 'EndTurn' }) // drain drawPile to 0
    const { events } = game.dispatch({ type: 'EndTurn' }) // triggers reshuffle

    const types = events.map((e) => e.type)
    const shuffleIdx = types.indexOf('DeckShuffled')
    const drawnIdx = types.lastIndexOf('CardsDrawn')
    const discardIdx = types.indexOf('CardsDiscarded')

    expect(shuffleIdx).toBeGreaterThan(discardIdx)
    expect(shuffleIdx).toBeLessThan(drawnIdx)
  })

  it('no DeckShuffled event when draw pile has enough cards', () => {
    const game = createGame(1)
    // First EndTurn: drawPile starts at 5, so after drawing 5 it may or may not shuffle
    // but on the very first turn it definitely should NOT shuffle
    const { events } = game.dispatch({ type: 'EndTurn' })
    const types = events.map((e) => e.type)
    expect(types).not.toContain('DeckShuffled')
  })
})

// ---------------------------------------------------------------------------
// Multi-turn conservation (integration)
// ---------------------------------------------------------------------------

describe('multi-turn conservation', () => {
  it('holds across 6 turns with various play patterns', () => {
    const game = createGame(31416)

    for (let turn = 0; turn < 6; turn++) {
      // Play half the hand each turn (rounded down)
      const half = Math.floor(game.state.hand.length / 2)
      for (let i = 0; i < half; i++) {
        const card = game.state.hand[0]
        if (card === undefined) break
        game.dispatch({ type: 'PlayCard', cardId: card.id })
      }
      game.dispatch({ type: 'EndTurn' })
      assertConservation(game.state)
    }
  })
})
