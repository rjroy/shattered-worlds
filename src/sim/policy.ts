import type { Action, CardId, GameState, TargetSpec } from '../core/types'
import { availableActions } from '../core/available'

// ---------------------------------------------------------------------------
// Random helpers (policy-local, not deterministic with game state RNG)
// ---------------------------------------------------------------------------

function pick<T>(items: readonly T[]): T {
  // Callers guarantee non-empty lists before calling pick.
  // The assertion comment is accurate: this function is only called when
  // the list has been checked to be non-empty at the call site.
  return items[Math.floor(Math.random() * items.length)] as T
}

function pickCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickSubset<T>(items: readonly T[], count: number): T[] {
  const pool = [...items]
  const result: T[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool[idx] as T)
    pool.splice(idx, 1)
  }
  return result
}

// ---------------------------------------------------------------------------
// Build a complete PlayCard action from a spec entry
// ---------------------------------------------------------------------------

interface PlayCardFields {
  type: 'PlayCard'
  cardId: CardId
  targetId?: CardId
  choice?: number
  returnIds?: readonly CardId[]
  destroyId?: CardId
  discardId?: CardId
}

function buildPlayAction(
  cardId: CardId,
  spec: TargetSpec,
  legalTargets: (cardId: CardId, step: number) => readonly CardId[],
): PlayCardFields {
  const base: PlayCardFields = { type: 'PlayCard', cardId }

  switch (spec.kind) {
    case 'none':
      return base

    case 'hazard': {
      const targets = legalTargets(cardId, 0)
      if (targets.length === 0) return base
      return { ...base, targetId: pick(targets) }
    }

    case 'discardPlayer': {
      const targets = legalTargets(cardId, 0)
      if (targets.length === 0) return base
      return { ...base, discardId: pick(targets) }
    }

    case 'destroyHand': {
      // min is always 0 — destruction is optional. Flip a coin.
      if (Math.random() < 0.5) return base
      const targets = legalTargets(cardId, 0)
      if (targets.length === 0) return base
      return { ...base, destroyId: pick(targets) }
    }

    case 'returnWorld': {
      const targets = legalTargets(cardId, 0)
      const count = Math.min(pickCount(spec.min, spec.max), targets.length)
      const chosen = pickSubset(targets, count)
      return { ...base, returnIds: chosen }
    }

    case 'modal': {
      // Pick a random branch, weighted equally. If a branch needs targets
      // and none are available, we still build the action — the available
      // selector guarantees at least one branch is legal, so a random pick
      // may land on an illegal one. Walk branches in random order to find
      // one that can be built.
      const indices = [...spec.branches.keys()]
      // Shuffle indices in-place
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = indices[i]!
        indices[i] = indices[j]!
        indices[j] = tmp
      }

      for (const branchIdx of indices) {
        const branchSpec = spec.branches[branchIdx]!
        if (branchSpec.kind === 'hazard') {
          const targets = legalTargets(cardId, branchIdx)
          if (targets.length === 0) continue
          return { ...base, choice: branchIdx, targetId: pick(targets) }
        }
        // 'none', 'draw', or any non-targeting branch
        return { ...base, choice: branchIdx }
      }

      // Fallback: pick first branch (available guarantees at least one is legal)
      return { ...base, choice: 0 }
    }

    case 'compound': {
      // Each step is resolved in order. We accumulate fields onto the action.
      let action: PlayCardFields = base

      for (let stepIdx = 0; stepIdx < spec.steps.length; stepIdx++) {
        const stepSpec = spec.steps[stepIdx]!
        if (stepSpec.kind === 'hazard') {
          const targets = legalTargets(cardId, stepIdx)
          if (targets.length > 0) {
            action = { ...action, targetId: pick(targets) }
          }
        } else if (stepSpec.kind === 'returnWorld') {
          const targets = legalTargets(cardId, stepIdx)
          const count = Math.min(pickCount(stepSpec.min, stepSpec.max), targets.length)
          const chosen = pickSubset(targets, count)
          action = { ...action, returnIds: chosen }
        }
        // 'none' / 'draw': no supplementary fields needed
      }

      return action
    }
  }
}

// ---------------------------------------------------------------------------
// pickAction — public entry point
// ---------------------------------------------------------------------------

/**
 * Selects a uniformly random legal action from the current state.
 * Uses Math.random() for policy choices — the game state RNG is unaffected.
 */
export function pickAction(state: GameState): Action {
  const available = availableActions(state)

  const actions: Action[] = []

  for (const { cardId, spec } of available.playable) {
    actions.push(buildPlayAction(cardId, spec, available.legalTargets))
  }

  for (const cardId of available.discardable) {
    actions.push({ type: 'DiscardHazard', cardId })
  }

  if (available.canEndTurn) {
    actions.push({ type: 'EndTurn' })
  }

  if (actions.length === 0) {
    // Should not happen in a valid 'playing' state, but safe fallback.
    return { type: 'EndTurn' }
  }

  return pick(actions)
}
