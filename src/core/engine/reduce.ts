import type { Action, GameEvent, GameState, WorldCard } from '../model/types'
import type { CardCatalog } from '../model/catalog'
import { availableActions, checkPlayAction } from './available'
import { applyEffect } from './effects'
import { startTurn, spendEnergy } from './energy'
import { IllegalActionError } from '../model/errors'

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

  // Remove the card from hand. A normal card recycles to playerDiscard; an
  // exhaust card is destroyed (sent to no zone).
  const exhaust = card.exhaust === true
  const stateAfterPlay: GameState = {
    ...state,
    hand: state.hand.filter((c) => c.id !== cardId),
    playerDiscard: exhaust ? state.playerDiscard : [card, ...state.playerDiscard],
  }

  const events: GameEvent[] = [{ type: 'CardPlayed', cardId }]

  // Deduct energy cost (REQ-ENERGY-10)
  // spendEnergy only emits EnergyChanged when cost > 0; cost-0 cards are silent
  const spendResult = spendEnergy(stateAfterPlay, card.energyCost)
  const stateAfterSpend = spendResult.state
  events.push(...spendResult.events)

  // Apply the card's effect (on the post-spend state)
  const effectResult = applyEffect(catalog, stateAfterSpend, card.effect, action)
  events.push(...effectResult.events)

  // CardDestroyed comes AFTER the effect events so the play reads as
  // play → spend → effect → the card vanishes.
  if (exhaust) {
    events.push({ type: 'CardDestroyed', id: cardId })
  }

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

  const penaltyResult = applyEffect(catalog, stateAfterRemove, (card as WorldCard).onDiscarded)

  const events: GameEvent[] = [
    { type: 'HazardDiscarded', cardId },
    ...penaltyResult.events,
  ]

  return { state: penaltyResult.state, events }
}

// ---------------------------------------------------------------------------
// EndTurn handler
// ---------------------------------------------------------------------------

function handleEndTurn(catalog: CardCatalog, state: GameState): ReduceResult {
  const events: GameEvent[] = [{ type: 'TurnEnded' }]

  // Fire onEndOfTurn for each world card in hand. The loop iterates a snapshot
  // of the world cards captured at loop entry (state.hand.filter(...)), so a
  // card spawned during the loop (e.g. AddWorldCardToTop) is NOT re-processed
  // this turn — this is what prevents a same-turn transform chain.
  let current = state
  for (const card of state.hand.filter((c): c is WorldCard => c.kind === 'world')) {
    // Pass card.id as selfId so self-referential hooks (DestroySelf) know which
    // card fired them.
    const r = applyEffect(catalog, current, card.onEndOfTurn, undefined, card.id)
    current = r.state
    events.push(...r.events)
    if (current.status !== 'playing') {
      return { state: current, events }
    }
  }

  // Discard all player cards from hand; world cards stay
  const playerCardsInHand = current.hand.filter((c) => c.kind === 'player')
  const worldCardsInHand = current.hand.filter((c) => c.kind === 'world')
  const discardedIds = playerCardsInHand.map((c) => c.id)

  const stateAfterDiscard: GameState = {
    ...current,
    hand: worldCardsInHand,
    playerDiscard: [...playerCardsInHand, ...current.playerDiscard],
    progress: {},
  }

  if (discardedIds.length > 0) {
    events.push({ type: 'CardsDiscarded', cardIds: discardedIds })
  }

  // Start turn: gain +1 energy, then refill hand (handles skipDrawNext internally)
  const turnStartResult = startTurn(stateAfterDiscard)
  events.push(...turnStartResult.events)

  // Livelock guard A: all draw piles and acts exhausted (player cards also
  // gone, e.g. all destroyed by Regroup) — nothing can ever enter the hand.
  const afterRefill = turnStartResult.state

  if (afterRefill.status === 'playing') {
    const hasNoFutureCards =
      afterRefill.playerDraw.length === 0 &&
      afterRefill.playerDiscard.length === 0 &&
      afterRefill.worldDraw.length === 0 &&
      afterRefill.acts.length === 0

    if (hasNoFutureCards) {
      // REQ-13: Check if ANY structural play exists, ignoring energy. Unaffordable
      // cards count as future progress (they will become affordable when energy rises).
      const avail = availableActions(afterRefill, { ignoreEnergy: true })
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
  //
  // REQ-13: Guard B checks for AddWorldCardToTop across zones, unaffected by energy.
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
      return handleEndTurn(catalog, state)
  }
}
