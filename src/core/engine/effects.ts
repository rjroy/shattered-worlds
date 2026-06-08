import type {
  Action,
  CardEffect,
  CardId,
  CardTemplateId,
  Dest,
  GameEvent,
  GameState,
  WorldCard,
} from '../model/types'
import type { CardCatalog } from '../model/catalog'
import { mintCard } from '../model/cards'
import { drawPlayer, drawWorld } from './draw'
import { shuffle } from './rng'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type EffectResult = { state: GameState; events: GameEvent[] }

// ---------------------------------------------------------------------------
// dealProgress
// ---------------------------------------------------------------------------

/**
 * Apply progress toward a hazard in hand. Auto-resolves the hazard (removes it
 * from hand and fires its onCleared effect) if accumulated progress meets or exceeds the
 * hazard's cost.
 */
export function dealProgress(
  catalog: CardCatalog,
  state: GameState,
  hazardId: CardId,
  base: number,
  bonus?: { tag: string; amount: number },
): EffectResult {
  const hazard = state.hand.find(
    (c): c is WorldCard => c.kind === 'world' && c.id === hazardId,
  )
  if (hazard === undefined) return { state, events: [] }

  const bonusAmount =
    bonus !== undefined && hazard.keywords.includes(bonus.tag as WorldCard['keywords'][number])
      ? bonus.amount
      : 0
  const amount = base + bonusAmount

  const newProgress = {
    ...state.progress,
    [hazardId]: (state.progress[hazardId] ?? 0) + amount,
  }
  const hazardTurnTotal = newProgress[hazardId]!

  const events: GameEvent[] = [
    { type: 'ProgressDealt', hazardId, amount, hazardTurnTotal },
  ]

  let current: GameState = { ...state, progress: newProgress }

  if (hazardTurnTotal >= hazard.cost) {
    // Remove hazard from hand (excess progress is wasted — do NOT touch progress)
    current = {
      ...current,
      hand: current.hand.filter((c) => c.id !== hazardId),
    }

    const rewardResult = applyEffect(catalog, current, hazard.onCleared)
    current = rewardResult.state
    events.push(...rewardResult.events)
    events.push({ type: 'HazardResolved', hazardId })
  }

  return { state: current, events }
}

// ---------------------------------------------------------------------------
// gainCard
// ---------------------------------------------------------------------------

/**
 * Mint a new card from a template and place it in the specified destination
 * zone.
 */
export function gainCard(
  catalog: CardCatalog,
  state: GameState,
  template: CardTemplateId,
  dest: Dest,
): EffectResult {
  const [card, nextState] = mintCard(catalog, state, template)

  let current: GameState
  switch (dest) {
    case 'playerDiscard':
      current = {
        ...nextState,
        playerDiscard: [card, ...nextState.playerDiscard],
      }
      break
    case 'playerDrawTop':
      current = {
        ...nextState,
        playerDraw: [card, ...nextState.playerDraw],
      }
      break
    case 'worldDrawTop':
      // Only world cards belong in worldDraw; callers are responsible for
      // only routing world-template ids here.
      current = {
        ...nextState,
        worldDraw: [card as WorldCard, ...nextState.worldDraw],
      }
      break
  }

  const events: GameEvent[] = [{ type: 'CardGained', id: card.id, dest }]
  return { state: current, events }
}

// ---------------------------------------------------------------------------
// returnToTopThree
// ---------------------------------------------------------------------------

/**
 * Return world cards from hand back into the top of worldDraw, shuffled with
 * the first three existing cards in that pile.
 *
 * Pool construction: first min(3, worldDraw.length) cards of worldDraw
 * + returned cards. The pool is shuffled (seeded), then placed at the front
 * of worldDraw with the remainder appended after.
 */
export function returnToTopThree(
  state: GameState,
  ids: readonly CardId[],
): EffectResult {
  if (ids.length === 0) {
    return { state, events: [] }
  }

  // Collect world cards from hand that match the requested ids, preserving
  // only those actually found (gracefully skip missing ids).
  const returned: WorldCard[] = []
  for (const id of ids) {
    const card = state.hand.find((c): c is WorldCard => c.kind === 'world' && c.id === id)
    if (card !== undefined) returned.push(card)
  }

  if (returned.length === 0) {
    return { state, events: [] }
  }

  const returnedIds = returned.map((c) => c.id)
  const handAfter = state.hand.filter((c) => !returnedIds.includes(c.id))

  const poolSize = Math.min(3, state.worldDraw.length)
  const poolBase = state.worldDraw.slice(0, poolSize)
  const remainder = state.worldDraw.slice(poolSize)

  const pool: WorldCard[] = [...poolBase, ...returned]
  const [shuffled, nextRng] = shuffle(pool, state.rng)

  const current: GameState = {
    ...state,
    rng: nextRng,
    hand: handAfter,
    worldDraw: [...shuffled, ...remainder],
  }

  const events: GameEvent[] = [{ type: 'WorldCardsReturned', ids: returnedIds }]
  return { state: current, events }
}

// ---------------------------------------------------------------------------
// destroyInHand
// ---------------------------------------------------------------------------

/**
 * Permanently remove a card from hand (not sent to any zone). If id is
 * undefined or the card is not found, nothing happens.
 */
export function destroyInHand(state: GameState, id?: CardId): EffectResult {
  if (id === undefined) return { state, events: [] }

  const exists = state.hand.some((c) => c.id === id)
  if (!exists) return { state, events: [] }

  const current: GameState = {
    ...state,
    hand: state.hand.filter((c) => c.id !== id),
  }
  const events: GameEvent[] = [{ type: 'CardDestroyed', id }]
  return { state: current, events }
}

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

/**
 * Reduce player HP by n. Transitions status to 'lost' if HP reaches zero or
 * below.
 */
export function damage(state: GameState, n: number): EffectResult {
  const newHp = state.hp - n
  const events: GameEvent[] = [
    { type: 'DamageDealt', amount: n },
    { type: 'HpChanged', hp: newHp },
  ]

  let current: GameState = { ...state, hp: newHp }

  if (newHp <= 0) {
    current = { ...current, status: 'lost' }
    events.push({ type: 'WorldLost' })
  }

  return { state: current, events }
}

// ---------------------------------------------------------------------------
// heal
// ---------------------------------------------------------------------------

/**
 * Increase player HP by n (uncapped in this slice).
 */
export function heal(state: GameState, n: number): EffectResult {
  const newHp = state.hp + n
  const current: GameState = { ...state, hp: newHp }
  const events: GameEvent[] = [{ type: 'HpChanged', hp: newHp }]
  return { state: current, events }
}

// ---------------------------------------------------------------------------
// applyEffect
// ---------------------------------------------------------------------------

/**
 * Apply any CardEffect. Pass `action` for player-card effects that require
 * targeting information (DealProgress, ReturnWorldCards, etc.); omit it for
 * onDiscarded and onCleared effects that run without player input.
 *
 * `selfId` is the id of the world card whose hook is firing, for
 * self-referential effects like DestroySelf; undefined for player-played
 * effects.
 */
export function applyEffect(
  catalog: CardCatalog,
  state: GameState,
  effect: CardEffect,
  action?: Action,
  selfId?: CardId,
): EffectResult {
  // Narrow to PlayCard once; cases that need targeting fields (DealProgress,
  // ReturnWorldCards, etc.) use this. onDiscarded/onCleared cases ignore it.
  const play = action?.type === 'PlayCard' ? action : undefined

  switch (effect.kind) {
    case 'DealProgress':
      return dealProgress(catalog, state, play?.targetId ?? '', effect.base, effect.bonus)

    case 'Draw': {
      const playerCount = effect.player ?? 0
      const worldCount = effect.world ?? 0
      const events: GameEvent[] = []
      let current = state

      if (playerCount > 0) {
        const r = drawPlayer(current, playerCount)
        current = r.state
        events.push(...r.events)
      }
      if (worldCount > 0) {
        const r = drawWorld(current, worldCount)
        current = r.state
        events.push(...r.events)
      }

      return { state: current, events }
    }

    case 'Heal':
      return heal(state, effect.amount)

    case 'ReturnWorldCards':
      return returnToTopThree(state, play?.returnIds ?? [])

    case 'DestroyCardInHand':
      return destroyInHand(state, play?.destroyId)

    case 'DiscardThenDraw': {
      if (play?.discardId === undefined) return { state, events: [] }

      const discardedCard = state.hand.find((c) => c.id === play.discardId)
      if (discardedCard === undefined) return { state, events: [] }

      const afterDiscard: GameState = {
        ...state,
        hand: state.hand.filter((c) => c.id !== play.discardId),
        playerDiscard: [discardedCard, ...state.playerDiscard],
      }

      return drawPlayer(afterDiscard, effect.player)
    }

    case 'AddCard':
      return gainCard(catalog, state, effect.template, effect.dest)

    case 'AddWorldCardToTop':
      return gainCard(catalog, state, effect.template, 'worldDrawTop')

    case 'Modal': {
      const choice = play?.choice ?? 0
      const branch = effect.branches[choice]
      if (branch === undefined) return { state, events: [] }
      return applyEffect(catalog, state, branch, action, selfId)
    }

    case 'Sequence': {
      let current = state
      const events: GameEvent[] = []

      for (const step of effect.steps) {
        const r = applyEffect(catalog, current, step, action, selfId)
        current = r.state
        events.push(...r.events)
      }

      return { state: current, events }
    }

    case 'Damage':
      return damage(state, effect.amount)

    case 'SkipDrawNextTurn': {
      // Idempotent — setting to true when already true is a no-op.
      const current: GameState = { ...state, skipDrawNext: true }
      return { state: current, events: [] }
    }

    case 'GainCard':
      return gainCard(catalog, state, effect.template, 'playerDiscard')

    case 'AddPlayerCardToTop':
      return gainCard(catalog, state, effect.template, 'playerDrawTop')

    case 'SurviveWorld': {
      const current: GameState = { ...state, status: 'won' }
      const events: GameEvent[] = [{ type: 'WorldWon' }]
      return { state: current, events }
    }

    case 'ForceDestroy': {
      // Queue one forced destruction; it resolves against the next refilled
      // hand at turn start (resolveForceDestroy), not the current hand. No
      // event fires here — CardDestroyed is emitted when the card is taken.
      const current: GameState = {
        ...state,
        pendingForceDestroy: state.pendingForceDestroy + 1,
      }
      return { state: current, events: [] }
    }

    case 'ForceDestroy': {
      // Queue one forced destruction; it resolves against the next refilled
      // hand at turn start (resolveForceDestroy), not the current hand. No
      // event fires here — CardDestroyed is emitted when the card is taken.
      const current: GameState = {
        ...state,
        pendingForceDestroy: state.pendingForceDestroy + 1,
      }
      return { state: current, events: [] }
    }

    case 'DestroySelf':
      return destroyInHand(state, selfId)

    case 'None':
      return { state, events: [] }
  }
}
