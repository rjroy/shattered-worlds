import type {
  Action,
  AvailableActions,
  CardEffect,
  CardId,
  GameState,
  PlayerCard,
  TargetSpec,
  WorldCard,
} from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function worldCardsInHand(state: GameState): WorldCard[] {
  return state.hand.filter((c): c is WorldCard => c.kind === 'world')
}

function playerCardsInHand(state: GameState): PlayerCard[] {
  return state.hand.filter((c): c is PlayerCard => c.kind === 'player')
}

/**
 * Derive the structural TargetSpec for an Effect — the shape the UI needs to
 * present the card — without testing whether the play is legal. Used for
 * Modal branch specs so that each branch always reports its intended spec
 * regardless of current hand state.
 */
function structuralSpec(effect: CardEffect): TargetSpec {
  switch (effect.kind) {
    case 'DealProgress': {
      const tag = effect.bonus?.tag
      return tag !== undefined ? { kind: 'hazard', tag } : { kind: 'hazard' }
    }
    case 'Heal':
    case 'AddWorldCardToTop':
    case 'AddCard':
    case 'Draw':
      return { kind: 'none' }
    case 'ReturnWorldCards':
      return { kind: 'returnWorld', min: effect.min, max: effect.max }
    case 'DestroyCardInHand':
      return { kind: 'destroyHand', min: effect.min, max: effect.max }
    case 'DiscardThenDraw':
      return { kind: 'discardPlayer' }
    case 'Modal':
      return { kind: 'modal', branches: effect.branches.map(structuralSpec) }
    case 'Sequence':
      return { kind: 'compound', steps: effect.steps.map(structuralSpec) }
    default:
      return { kind: 'none' }
  }
}

/**
 * Determine whether a single Effect has a legal play given the current hand.
 * Returns the TargetSpec when playable, or null when the card should be
 * excluded from `playable`.
 *
 * `selfId` is the id of the card being evaluated — used to exclude self from
 * target lists for DiscardThenDraw legality checks.
 */
function playableSpec(
  effect: CardEffect,
  state: GameState,
  selfId: CardId,
): TargetSpec | null {
  switch (effect.kind) {
    case 'DealProgress': {
      // Requires at least one world card in hand as a target.
      if (worldCardsInHand(state).length === 0) return null
      return structuralSpec(effect)
    }

    case 'Heal':
    case 'AddWorldCardToTop':
    case 'AddCard':
      return { kind: 'none' }

    case 'DestroyCardInHand':
      // min is 0, so destroying nothing is valid — always playable.
      return structuralSpec(effect)

    case 'DiscardThenDraw': {
      // Requires at least one other player card in hand to discard.
      const others = playerCardsInHand(state).filter((c) => c.id !== selfId)
      if (others.length === 0) return null
      return { kind: 'discardPlayer' }
    }

    case 'Draw':
      return { kind: 'none' }

    case 'ReturnWorldCards': {
      // When min >= 1, the player must return that many world cards — requires
      // at least `min` world cards in hand.
      if (effect.min > 0 && worldCardsInHand(state).length < effect.min) return null
      return structuralSpec(effect)
    }

    case 'Modal': {
      // Each branch is checked for playability. The modal card is playable as
      // long as at least one branch is viable. Branch specs always use their
      // structural shape so the UI knows what each branch requires.
      const anyBranchLegal = effect.branches.some(
        (branch) => playableSpec(branch, state, selfId) !== null,
      )
      if (!anyBranchLegal) return null
      return { kind: 'modal', branches: effect.branches.map(structuralSpec) }
    }

    case 'Sequence': {
      // The first step determines whether the card is playable — if it
      // returns null the whole sequence is unplayable.
      const firstSpec = playableSpec(effect.steps[0]!, state, selfId)
      if (firstSpec === null) return null
      return { kind: 'compound', steps: effect.steps.map(structuralSpec) }
    }

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// legalTargets implementation
// ---------------------------------------------------------------------------

/**
 * Resolve concrete target ids for a card at a specific step/branch index.
 * Operates on the current hand state — does not simulate effect application.
 */
function computeLegalTargets(
  card: PlayerCard,
  step: number,
  state: GameState,
): readonly CardId[] {
  const effect = card.effect

  switch (effect.kind) {
    case 'DealProgress':
      // step 0: all world cards in hand are legal targets
      if (step !== 0) return []
      return worldCardsInHand(state).map((c) => c.id)

    case 'Modal': {
      // step = branch index
      const branch = effect.branches[step]
      if (branch === undefined) return []
      if (branch.kind === 'DealProgress') {
        const tag = branch.bonus?.tag
        if (tag !== undefined) {
          // Filter to world cards that have the matching keyword
          return worldCardsInHand(state)
            .filter((c) => c.keywords.includes(tag))
            .map((c) => c.id)
        }
        return worldCardsInHand(state).map((c) => c.id)
      }
      // Draw or other non-targeting branch
      return []
    }

    case 'Sequence': {
      const stepEffect = effect.steps[step]
      if (stepEffect === undefined) return []
      if (stepEffect.kind === 'DealProgress') {
        return worldCardsInHand(state).map((c) => c.id)
      }
      if (stepEffect.kind === 'ReturnWorldCards') {
        return worldCardsInHand(state).map((c) => c.id)
      }
      // Draw or other non-targeting step
      return []
    }

    case 'DiscardThenDraw':
      // step 0: all player cards in hand except self
      if (step !== 0) return []
      return playerCardsInHand(state)
        .filter((c) => c.id !== card.id)
        .map((c) => c.id)

    case 'DestroyCardInHand':
      // step 0: all cards in hand except self
      if (step !== 0) return []
      return state.hand.filter((c) => c.id !== card.id).map((c) => c.id)

    case 'Heal':
    case 'AddWorldCardToTop':
    case 'AddCard':
    case 'Draw':
    case 'ReturnWorldCards':
      return []
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// checkPlayAction — single validation point for PlayCard actions
// ---------------------------------------------------------------------------

/**
 * Validates the supplementary fields of a PlayCard action against the spec
 * returned by availableActions. Returns null if the action is valid or a
 * human-readable error message if it is not.
 *
 * This lives in available.ts (not in reduce.ts) so that spec-kind knowledge
 * has exactly one home. The reducer calls this and throws on non-null.
 */
export function checkPlayAction(
  available: AvailableActions,
  action: Extract<Action, { type: 'PlayCard' }>,
): string | null {
  const entry = available.playable.find((p) => p.cardId === action.cardId)
  if (entry === undefined) {
    return `Card ${action.cardId} is not playable`
  }

  return checkSpec(entry.spec, action, entry.cardId, available, 0)
}

function checkSpec(
  spec: TargetSpec,
  action: Extract<Action, { type: 'PlayCard' }>,
  cardId: CardId,
  available: AvailableActions,
  step: number,
): string | null {
  switch (spec.kind) {
    case 'none':
      return null

    case 'hazard': {
      const legal = available.legalTargets(cardId, step)
      if (action.targetId === undefined || !legal.includes(action.targetId)) {
        return `targetId ${action.targetId} is not a legal hazard target for card ${cardId}`
      }
      return null
    }

    case 'returnWorld': {
      const legal = available.legalTargets(cardId, step)
      const ids = action.returnIds ?? []
      if (ids.length < spec.min || ids.length > spec.max) {
        return `returnIds count ${ids.length} is outside [${spec.min},${spec.max}] for card ${cardId}`
      }
      for (const id of ids) {
        if (!legal.includes(id)) {
          return `returnId ${id} is not a legal return target for card ${cardId}`
        }
      }
      return null
    }

    case 'destroyHand': {
      if (action.destroyId === undefined) return null // min is 0, destruction is optional
      const legal = available.legalTargets(cardId, step)
      if (!legal.includes(action.destroyId)) {
        return `destroyId ${action.destroyId} is not a legal destroy target for card ${cardId}`
      }
      return null
    }

    case 'discardPlayer': {
      const legal = available.legalTargets(cardId, step)
      if (action.discardId === undefined || !legal.includes(action.discardId)) {
        return `discardId ${action.discardId} is not a legal discard target for card ${cardId}`
      }
      return null
    }

    case 'modal': {
      const choice = action.choice
      if (choice === undefined || choice < 0 || choice >= spec.branches.length) {
        return `choice ${action.choice} is not a valid branch index for card ${cardId}`
      }
      return checkSpec(spec.branches[choice]!, action, cardId, available, choice)
    }

    case 'compound': {
      for (let i = 0; i < spec.steps.length; i++) {
        const err = checkSpec(spec.steps[i]!, action, cardId, available, i)
        if (err !== null) return err
      }
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// availableActions — public selector
// ---------------------------------------------------------------------------

/**
 * Pure selector: derives all legal actions from the current GameState.
 * No state mutation; no effects applied.
 */
export function availableActions(state: GameState): AvailableActions {
  const playable: { cardId: CardId; spec: TargetSpec }[] = []

  for (const card of state.hand) {
    if (card.kind !== 'player') continue
    const spec = playableSpec(card.effect, state, card.id)
    if (spec !== null) {
      playable.push({ cardId: card.id, spec })
    }
  }

  const discardable = state.hand
    .filter((c): c is WorldCard => c.kind === 'world' && c.discardable)
    .map((c) => c.id)

  const canEndTurn = state.status === 'playing'

  function legalTargets(cardId: CardId, step: number): readonly CardId[] {
    const card = state.hand.find((c) => c.id === cardId)
    if (card === undefined || card.kind !== 'player') return []
    return computeLegalTargets(card, step, state)
  }

  return { playable, discardable, canEndTurn, legalTargets }
}
