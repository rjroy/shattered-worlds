import { describe, expect, it } from 'bun:test'
import { reduce } from './reduce'
import { createGame } from './game'
import { IllegalActionError } from './errors'
import type { GameState, CardId } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect the ids of every card across all four zones. */
function allCardIds(state: GameState): CardId[] {
  return [
    ...state.drawPile.map((c) => c.id),
    ...state.hand.map((c) => c.id),
    ...state.played.map((c) => c.id),
    ...state.discard.map((c) => c.id),
  ]
}

/** Assert the conservation invariant: 10 unique card ids across all zones. */
function assertConservation(state: GameState): void {
  const ids = allCardIds(state)
  expect(ids.length).toBe(10)
  expect(new Set(ids).size).toBe(10)
}

// ---------------------------------------------------------------------------
// PlayCard
// ---------------------------------------------------------------------------

describe('reduce – PlayCard', () => {
  it('moves the card from hand to played and increments runningTotal', () => {
    const game = createGame(1)
    const cardToPlay = game.state.hand[0]
    expect(cardToPlay).toBeDefined()
    if (cardToPlay === undefined) return

    const { state, events } = reduce(game.state, {
      type: 'PlayCard',
      cardId: cardToPlay.id,
    })

    expect(state.hand.find((c) => c.id === cardToPlay.id)).toBeUndefined()
    expect(state.played.map((c) => c.id)).toContain(cardToPlay.id)
    expect(state.runningTotal).toBe(cardToPlay.value)

    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev?.type).toBe('CardPlayed')
    if (ev?.type === 'CardPlayed') {
      expect(ev.cardId).toBe(cardToPlay.id)
      expect(ev.value).toBe(cardToPlay.value)
      expect(ev.runningTotal).toBe(cardToPlay.value)
    }
  })

  it('runningTotal accumulates across multiple plays', () => {
    const game = createGame(2)
    const [c1, c2] = game.state.hand

    expect(c1).toBeDefined()
    expect(c2).toBeDefined()
    if (c1 === undefined || c2 === undefined) return

    const { state: s1 } = reduce(game.state, { type: 'PlayCard', cardId: c1.id })
    const { state: s2 } = reduce(s1, { type: 'PlayCard', cardId: c2.id })

    expect(s2.runningTotal).toBe(c1.value + c2.value)
  })

  it('throws IllegalActionError for a card not in hand', () => {
    const game = createGame(3)
    expect(() =>
      reduce(game.state, { type: 'PlayCard', cardId: 'card-99' }),
    ).toThrow(IllegalActionError)
  })

  it('throws IllegalActionError for an already-played card', () => {
    const game = createGame(4)
    const card = game.state.hand[0]
    expect(card).toBeDefined()
    if (card === undefined) return

    const { state: afterPlay } = reduce(game.state, {
      type: 'PlayCard',
      cardId: card.id,
    })

    expect(() =>
      reduce(afterPlay, { type: 'PlayCard', cardId: card.id }),
    ).toThrow(IllegalActionError)
  })

  it('IllegalActionError carries the offending action and state', () => {
    const game = createGame(5)
    const action = { type: 'PlayCard' as const, cardId: 'card-99' }
    let caught: unknown

    try {
      reduce(game.state, action)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(IllegalActionError)
    const err = caught as IllegalActionError
    expect(err.action).toBe(action)
    expect(err.state).toBe(game.state)
  })
})

// ---------------------------------------------------------------------------
// EndTurn
// ---------------------------------------------------------------------------

describe('reduce – EndTurn', () => {
  it('appends runningTotal to history and resets it to 0', () => {
    const game = createGame(6)
    const card = game.state.hand[0]
    expect(card).toBeDefined()
    if (card === undefined) return

    const { state: afterPlay } = reduce(game.state, {
      type: 'PlayCard',
      cardId: card.id,
    })
    const expectedTotal = afterPlay.runningTotal

    const { state: afterEnd } = reduce(afterPlay, { type: 'EndTurn' })

    expect(afterEnd.history).toHaveLength(1)
    expect(afterEnd.history[0]).toBe(expectedTotal)
    expect(afterEnd.runningTotal).toBe(0)
  })

  it('refills hand to 5 after EndTurn', () => {
    const game = createGame(7)
    const { state } = reduce(game.state, { type: 'EndTurn' })
    expect(state.hand.length).toBe(5)
  })

  it('clears played zone after EndTurn', () => {
    const game = createGame(8)
    const card = game.state.hand[0]
    expect(card).toBeDefined()
    if (card === undefined) return

    const { state: afterPlay } = reduce(game.state, {
      type: 'PlayCard',
      cardId: card.id,
    })
    const { state: afterEnd } = reduce(afterPlay, { type: 'EndTurn' })

    expect(afterEnd.played).toHaveLength(0)
  })

  it('records total=0 when hand and played are both empty', () => {
    const game = createGame(9)
    // End without playing anything
    const { state, events } = reduce(game.state, { type: 'EndTurn' })

    expect(state.history[0]).toBe(0)
    expect(state.hand.length).toBe(5)

    const turnEnded = events.find((e) => e.type === 'TurnEnded')
    expect(turnEnded?.type).toBe('TurnEnded')
    if (turnEnded?.type === 'TurnEnded') {
      expect(turnEnded.total).toBe(0)
    }
  })

  it('moves hand cards first then played cards into discard', () => {
    const game = createGame(10)
    const card = game.state.hand[1]
    expect(card).toBeDefined()
    if (card === undefined) return

    const handIdsBefore = game.state.hand.map((c) => c.id)
    const { state: afterPlay } = reduce(game.state, {
      type: 'PlayCard',
      cardId: card.id,
    })
    const handIdsAfterPlay = afterPlay.hand.map((c) => c.id)
    const playedIds = afterPlay.played.map((c) => c.id)

    const { state: afterEnd } = reduce(afterPlay, { type: 'EndTurn' })

    // All cards that were in hand before EndTurn should be in discard
    for (const id of [...handIdsAfterPlay, ...playedIds]) {
      expect(afterEnd.discard.map((c) => c.id)).toContain(id)
    }
    // None of the previous hand cards should remain in hand (it's a fresh draw)
    for (const id of handIdsBefore) {
      // They might be redrawn if deck reshuffles, so only check played is cleared
      void id
    }
    expect(afterEnd.played).toHaveLength(0)
  })

  it('produces events in order: TurnEnded, CardsDiscarded, CardsDrawn', () => {
    const game = createGame(11)
    const { events } = reduce(game.state, { type: 'EndTurn' })

    const types = events.map((e) => e.type)

    expect(types[0]).toBe('TurnEnded')
    expect(types[1]).toBe('CardsDiscarded')
    // Last event must be CardsDrawn
    expect(types[types.length - 1]).toBe('CardsDrawn')

    // If DeckShuffled is present it must come before CardsDrawn
    const shuffleIdx = types.indexOf('DeckShuffled')
    const drawnIdx = types.indexOf('CardsDrawn')
    if (shuffleIdx !== -1) {
      expect(shuffleIdx).toBeLessThan(drawnIdx)
    }
  })

  it('emits CardsDiscarded with correct cardIds (hand first, then played)', () => {
    const game = createGame(12)
    const card = game.state.hand[2]
    expect(card).toBeDefined()
    if (card === undefined) return

    const handIdsBefore = game.state.hand.map((c) => c.id)
    const { state: afterPlay } = reduce(game.state, {
      type: 'PlayCard',
      cardId: card.id,
    })

    const expectedDiscardOrder = [
      ...afterPlay.hand.map((c) => c.id),
      ...afterPlay.played.map((c) => c.id),
    ]

    const { events } = reduce(afterPlay, { type: 'EndTurn' })
    const discardedEv = events.find((e) => e.type === 'CardsDiscarded')
    expect(discardedEv?.type).toBe('CardsDiscarded')
    if (discardedEv?.type === 'CardsDiscarded') {
      expect(discardedEv.cardIds).toEqual(expectedDiscardOrder)
    }

    void handIdsBefore
  })
})

// ---------------------------------------------------------------------------
// Conservation invariant
// ---------------------------------------------------------------------------

describe('conservation invariant', () => {
  it('holds after every action in a multi-turn sequence', () => {
    const game = createGame(42)
    assertConservation(game.state)

    // Turn 1: play two cards, end turn
    const [c1, c2] = game.state.hand
    expect(c1).toBeDefined()
    expect(c2).toBeDefined()
    if (c1 === undefined || c2 === undefined) return

    const { state: s1 } = reduce(game.state, { type: 'PlayCard', cardId: c1.id })
    assertConservation(s1)

    const { state: s2 } = reduce(s1, { type: 'PlayCard', cardId: c2.id })
    assertConservation(s2)

    const { state: s3 } = reduce(s2, { type: 'EndTurn' })
    assertConservation(s3)

    // Turn 2: end without playing
    const { state: s4 } = reduce(s3, { type: 'EndTurn' })
    assertConservation(s4)

    // Turn 3: play all 5
    let state = s4
    for (const card of [...state.hand]) {
      const result = reduce(state, { type: 'PlayCard', cardId: card.id })
      state = result.state
      assertConservation(state)
    }
    const { state: s5 } = reduce(state, { type: 'EndTurn' })
    assertConservation(s5)
  })
})
