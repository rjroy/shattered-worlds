import type { GameEvent, GameState, WorldCard } from '../model/types'
import { shuffle } from './rng'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Total world cards remaining across worldDraw pile and all queued acts. */
function worldCardsRemaining(state: GameState): number {
  return (
    state.worldDraw.length +
    state.acts.reduce((sum, act) => sum + act.length, 0)
  )
}

// ---------------------------------------------------------------------------
// drawPlayer
// ---------------------------------------------------------------------------

/**
 * Pull `n` cards from playerDraw into hand. If playerDraw runs dry mid-draw,
 * shuffle playerDiscard into a new playerDraw (emitting DeckShuffled) and
 * continue. If both piles are empty, draws whatever is available without
 * throwing.
 *
 * Emits: DeckShuffled (0 or more), CardsDrawn (exactly 1, omitted if 0 drawn)
 */
export function drawPlayer(
  state: GameState,
  n: number,
): { state: GameState; events: GameEvent[] } {
  let current = state
  const events: GameEvent[] = []
  const drawnIds: string[] = []
  let remaining = n

  while (remaining > 0) {
    if (current.playerDraw.length === 0) {
      // Nothing in discard either — stop gracefully
      if (current.playerDiscard.length === 0) break

      // Reshuffle discard into a new draw pile
      const [shuffled, nextRng] = shuffle(current.playerDiscard, current.rng)
      current = {
        ...current,
        rng: nextRng,
        playerDraw: shuffled,
        playerDiscard: [],
      }
      events.push({ type: 'DeckShuffled' })
    }

    // noUncheckedIndexedAccess: playerDraw is non-empty here (guarded above).
    const card = current.playerDraw[0]!
    current = {
      ...current,
      playerDraw: current.playerDraw.slice(1),
      hand: [...current.hand, card],
    }
    drawnIds.push(card.id)
    remaining--
  }

  if (drawnIds.length > 0) {
    events.push({ type: 'CardsDrawn', ids: drawnIds })
  }

  return { state: current, events }
}

// ---------------------------------------------------------------------------
// drawWorld
// ---------------------------------------------------------------------------

/**
 * Pull `n` world cards from worldDraw into hand. If worldDraw runs dry
 * mid-draw and acts remain, shuffle the next act into a new worldDraw
 * (emitting ActAdvanced) and continue. Stops gracefully if no cards remain.
 *
 * Emits: ActAdvanced (0 or more), CardsDrawn (exactly 1, omitted if 0 drawn)
 */
export function drawWorld(
  state: GameState,
  n: number,
): { state: GameState; events: GameEvent[] } {
  let current = state
  const events: GameEvent[] = []
  const drawnIds: string[] = []
  let remaining = n

  while (remaining > 0) {
    if (current.worldDraw.length === 0) {
      // No more acts to advance into — stop gracefully
      if (current.acts.length === 0) break

      // Advance to the next act: shuffle acts[0] into a new worldDraw
      const nextAct = current.acts[0]!
      const [shuffled, nextRng] = shuffle(nextAct as WorldCard[], current.rng)
      const newActIndex = current.actIndex + 1
      current = {
        ...current,
        rng: nextRng,
        worldDraw: shuffled,
        acts: current.acts.slice(1),
        actIndex: newActIndex,
      }
      events.push({ type: 'ActAdvanced', act: newActIndex })
    }

    // noUncheckedIndexedAccess: worldDraw is non-empty here (guarded above).
    const card = current.worldDraw[0]!
    current = {
      ...current,
      worldDraw: current.worldDraw.slice(1),
      hand: [...current.hand, card],
    }
    drawnIds.push(card.id)
    remaining--
  }

  if (drawnIds.length > 0) {
    events.push({ type: 'CardsDrawn', ids: drawnIds })
  }

  return { state: current, events }
}

// ---------------------------------------------------------------------------
// refillHand (REQ-WDS-7)
// ---------------------------------------------------------------------------

/**
 * Fill the hand to 6 cards using the draw formula from REQ-WDS-7.
 *
 * Formula (evaluated after player cards have been discarded at EndTurn, so
 * hand contains only world cards):
 *
 *   heldWorld = hand.filter(c => c.kind === 'world').length
 *   room      = 6 - hand.length
 *
 *   worldToDraw = clamp(max(1, 2 - heldWorld), 0, min(room, worldCardsRemaining))
 *   playerToDraw = max(0, 6 - newHand.length)   — after world draw
 *
 * If skipDrawNext is true: player draws are suppressed, DrawSkipped is emitted,
 * and the flag is consumed.
 */
export function refillHand(state: GameState): { state: GameState; events: GameEvent[] } {
  const allEvents: GameEvent[] = []

  const heldWorld = state.hand.filter((c) => c.kind === 'world').length
  const room = 6 - state.hand.length

  if (room === 0) {
    return { state, events: [] }
  }

  // World draw count: minimum 1, minimum (2 - held), capped by room and
  // by total world cards remaining. If no world cards exist at all, this
  // collapses to 0 via the min(…, worldCardsRemaining) clip.
  const totalWorldRemaining = worldCardsRemaining(state)
  const worldToDraw = Math.min(
    Math.max(1, 2 - heldWorld),
    room,
    totalWorldRemaining,
  )

  // Draw world cards
  let current = state
  if (worldToDraw > 0) {
    const result = drawWorld(current, worldToDraw)
    current = result.state
    allEvents.push(...result.events)
  }

  // Player draw: fill remaining room up to 6
  let playerToDraw = Math.max(0, 6 - current.hand.length)

  if (current.skipDrawNext) {
    allEvents.push({ type: 'DrawSkipped' })
    current = { ...current, skipDrawNext: false }
    playerToDraw = 0
  }

  if (playerToDraw > 0) {
    const result = drawPlayer(current, playerToDraw)
    current = result.state
    allEvents.push(...result.events)
  }

  return { state: current, events: allEvents }
}
