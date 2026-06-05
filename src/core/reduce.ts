import type { Action, GameEvent, GameState, WorldCard } from './types'
import type { CardCatalog } from './catalog'
import { availableActions, checkPlayAction } from './available'
import { applyEffect, applyPenalty } from './effects'
import { refillHand } from './draw'
import { IllegalActionError } from './errors'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type ReduceResult = { state: GameState; events: GameEvent[] }

// ---------------------------------------------------------------------------
// PlayCard handler
// ---------------------------------------------------------------------------

function handlePlayCard(
  catalog: CardCatalog,
  state: GameState,
  action: Extract<Action, { type: 'PlayCard' }>,
): ReduceResult {
  const available = availableActions(state)

  // All spec-kind validation lives in checkPlayAction (available.ts owns the
  // spec shape; the reducer just enforces the result).
  const err = checkPlayAction(available, action)
  if (err !== null) {
    throw new IllegalActionError(action, state, err)
  }

  const { cardId } = action

  // Find the card object in hand to get its effect
  const card = state.hand.find((c) => c.id === cardId)
  if (card === undefined || card.kind !== 'player') {
    throw new IllegalActionError(action, state, `Card ${cardId} not found in hand`)
  }

  // Remove the card from hand and send it to playerDiscard so it recycles
  const handAfterPlay = state.hand.filter((c) => c.id !== cardId)
  const stateAfterPlay: GameState = {
    ...state,
    hand: handAfterPlay,
    playerDiscard: [card, ...state.playerDiscard],
  }

  const events: GameEvent[] = [{ type: 'CardPlayed', cardId }]

  // Apply the card's effect
  const effectResult = applyEffect(catalog, stateAfterPlay, card.effect, action)
  events.push(...effectResult.events)

  return { state: effectResult.state, events }
}

// ---------------------------------------------------------------------------
// DiscardHazard handler
// ---------------------------------------------------------------------------

function handleDiscardHazard(
  catalog: CardCatalog,
  state: GameState,
  action: Extract<Action, { type: 'DiscardHazard' }>,
): ReduceResult {
  const { cardId } = action

  // Find the card in hand
  const card = state.hand.find((c) => c.id === cardId)
  if (card === undefined || card.kind !== 'world') {
    throw new IllegalActionError(
      action,
      state,
      `Card ${cardId} not found in hand or is not a world card`,
    )
  }

  // Check it is discardable (Door is not)
  const available = availableActions(state)
  if (!available.discardable.includes(cardId)) {
    throw new IllegalActionError(
      action,
      state,
      `Card ${cardId} (${card.name}) cannot be discarded`,
    )
  }

  // Remove from hand
  const handAfterDiscard = state.hand.filter((c) => c.id !== cardId)
  const stateAfterRemove: GameState = { ...state, hand: handAfterDiscard }

  // Apply penalty
  const penaltyResult = applyPenalty(catalog, stateAfterRemove, (card as WorldCard).penalty)

  const events: GameEvent[] = [
    { type: 'HazardDiscarded', cardId },
    ...penaltyResult.events,
  ]

  return { state: penaltyResult.state, events }
}

// ---------------------------------------------------------------------------
// EndTurn handler
// ---------------------------------------------------------------------------

function handleEndTurn(state: GameState): ReduceResult {
  // Discard all player cards from hand; world cards stay
  const playerCardsInHand = state.hand.filter((c) => c.kind === 'player')
  const worldCardsInHand = state.hand.filter((c) => c.kind === 'world')
  const discardedIds = playerCardsInHand.map((c) => c.id)

  const stateAfterDiscard: GameState = {
    ...state,
    hand: worldCardsInHand,
    playerDiscard: [...playerCardsInHand, ...state.playerDiscard],
    progress: {},
  }

  const events: GameEvent[] = [{ type: 'TurnEnded' }]
  if (discardedIds.length > 0) {
    events.push({ type: 'CardsDiscarded', cardIds: discardedIds })
  }

  // Refill hand (handles skipDrawNext internally)
  const refillResult = refillHand(stateAfterDiscard)
  events.push(...refillResult.events)

  // Livelock guard A: all draw piles and acts exhausted (player cards also
  // gone, e.g. all destroyed by Regroup) — nothing can ever enter the hand.
  const afterRefill = refillResult.state

  if (afterRefill.status === 'playing') {
    const hasNoFutureCards =
      afterRefill.playerDraw.length === 0 &&
      afterRefill.playerDiscard.length === 0 &&
      afterRefill.worldDraw.length === 0 &&
      afterRefill.acts.length === 0

    if (hasNoFutureCards) {
      const avail = availableActions(afterRefill)
      const noProgressPossible = avail.playable.length === 0 && avail.discardable.length === 0
      if (noProgressPossible) {
        const lostState: GameState = { ...afterRefill, status: 'lost' }
        events.push({ type: 'WorldLost' })
        return { state: lostState, events }
      }
    }
  }

  // Livelock guard B: world deck exhausted and no player card in any zone can
  // introduce world cards (AddWorldCardToTop). With proper deck recycling, the
  // player pile never empties on its own — but if there are no world cards
  // anywhere and no way to create them, the game loops forever (no hazards to
  // deal progress to, discard for damage, or win against).
  //
  // The Walker in hand is a world card and keeps the check false; Summon Door
  // anywhere in the player zones is the only escape hatch.
  if (afterRefill.status === 'playing') {
    const noWorldAnywhere =
      afterRefill.worldDraw.length === 0 &&
      afterRefill.acts.length === 0 &&
      !afterRefill.hand.some((c) => c.kind === 'world')

    if (noWorldAnywhere) {
      const allPlayerCards = [
        ...afterRefill.playerDraw,
        ...afterRefill.playerDiscard,
        ...afterRefill.hand,
      ]
      const canIntroduceWorld = allPlayerCards.some(
        (c) => c.kind === 'player' && c.effect.kind === 'AddWorldCardToTop',
      )
      if (!canIntroduceWorld) {
        const lostState: GameState = { ...afterRefill, status: 'lost' }
        events.push({ type: 'WorldLost' })
        return { state: lostState, events }
      }
    }
  }

  return { state: afterRefill, events }
}

// ---------------------------------------------------------------------------
// reduce — public entry point
// ---------------------------------------------------------------------------

/**
 * Pure reducer: applies an action to a GameState and returns the next state
 * plus the events that occurred.
 *
 * Throws IllegalActionError for any illegal or malformed action.
 */
export function reduce(catalog: CardCatalog, state: GameState, action: Action): ReduceResult {
  if (state.status !== 'playing') {
    throw new IllegalActionError(
      action,
      state,
      `Cannot dispatch ${action.type} — game status is '${state.status}'`,
    )
  }

  switch (action.type) {
    case 'PlayCard':
      return handlePlayCard(catalog, state, action)
    case 'DiscardHazard':
      return handleDiscardHazard(catalog, state, action)
    case 'EndTurn':
      return handleEndTurn(state)
  }
}
