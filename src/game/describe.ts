/**
 * Human-readable descriptions of card behaviour.
 *
 * This is the single source of every English string that explains what a card
 * does — the card face, the modal chooser labels, and the live target preview
 * all read from here, so they can never disagree. It imports core *types* only
 * (no Phaser, no DOM), so it stays on the pure side of the renderer boundary
 * and is unit-tested headless.
 */
import type { CardEffect, GameState, PlayerCard, WorldCard } from '../core/index'

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * Describe a player-card effect as one or more display lines. Recurses into
 * `Modal` (a "Choose one:" header plus a bullet per branch) and `Sequence`
 * (one line per step, later steps prefixed "then …"), so nothing collapses to
 * an opaque "Choose…" / "Multi-step".
 */
export function describeEffect(effect: CardEffect): string[] {
  switch (effect.kind) {
    case 'DealProgress': {
      const bonus = effect.bonus ? ` (+${effect.bonus.amount} vs ${effect.bonus.tag})` : ''
      return [`Deal ${effect.base} Progress${bonus}`]
    }
    case 'Draw': {
      const parts: string[] = []
      if (effect.player !== undefined && effect.player > 0) parts.push(`Draw ${effect.player}`)
      if (effect.world !== undefined && effect.world > 0) parts.push(`+${effect.world} world`)
      return [parts.length > 0 ? parts.join(', ') : 'Draw nothing']
    }
    case 'Heal':
      return [`Heal ${effect.amount} HP`]
    case 'ReturnWorldCards':
      return [describeReturn(effect.min, effect.max)]
    case 'DestroyCardInHand':
      return ['Destroy a card in hand (optional)']
    case 'DiscardThenDraw':
      return [`Discard a card, then draw ${effect.player}`]
    case 'AddCard':
      return [`Gain a ${effect.template} card`]
    case 'AddWorldCardToTop':
      return [`Put a ${effect.template} on top of the world deck`]
    case 'Modal':
      return ['Choose one:', ...effect.branches.map((b) => `• ${describeEffect(b).join(', ')}`)]
    case 'Sequence':
      return effect.steps.flatMap((step, i) =>
        describeEffect(step).map((line, j) => (i > 0 && j === 0 ? `then ${lowerFirst(line)}` : line)),
      )
    default:
      return []
  }
}

function describeReturn(min: number, max: number): string {
  const count = min === max ? `${min}` : `${min}–${max}`
  const noun = max === 1 ? 'world card' : 'world cards'
  return `Return ${count} ${noun} to the deck`
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}

// ---------------------------------------------------------------------------
// Hazard penalties and rewards
// ---------------------------------------------------------------------------

/** Full sentence for a Hazard's discard penalty, or '' when there is none. */
export function describePenalty(penalty: CardEffect): string {
  switch (penalty.kind) {
    case 'Damage':
      return `If discarded: -${penalty.amount} HP`
    case 'SkipDrawNextTurn':
      return 'If discarded: skip next draw'
    case 'GainCard':
      return `If discarded: gain ${penalty.template}`
    case 'AddWorldCardToTop':
      return `If discarded: +${penalty.template} to world deck`
    case 'None':
      return ''
    default:
      return ''
  }
}

/** Full sentence for a Hazard's clear reward, or '' when there is none. */
export function describeReward(reward: CardEffect): string {
  switch (reward.kind) {
    case 'GainCard':
      return `Clear it: gain ${reward.template}`
    case 'AddPlayerCardToTop':
      return `Clear it: +${reward.template} to your deck`
    case 'AddWorldCardToTop':
      return `Clear it: +${reward.template} to world deck`
    case 'SurviveWorld':
      return 'Clear it: you survive the world'
    case 'None':
      return ''
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Live target preview
// ---------------------------------------------------------------------------

/**
 * One-line preview of playing `card` at `target`, given the current state.
 * Combines the card's base Progress, its keyword bonus against this target,
 * and the Progress already dealt this turn to say whether the play clears the
 * Hazard or how much remains. Returns null when the card deals no Progress
 * (the modal branch chosen draws instead, etc.).
 *
 * `branchIndex` selects a Modal branch when the card is modal and a branch has
 * been chosen; otherwise the first Progress-dealing effect is used.
 */
export function previewPlay(
  card: PlayerCard,
  target: WorldCard,
  state: GameState,
  branchIndex?: number,
): string | null {
  const deal = dealProgressOf(card.effect, branchIndex)
  if (deal === null) return null

  const bonus =
    deal.bonus !== undefined && target.keywords.includes(deal.bonus.tag) ? deal.bonus.amount : 0
  const amount = deal.base + bonus
  const already = state.progress[target.id] ?? 0
  const total = already + amount

  if (total >= target.cost) {
    return `Deals ${amount} → clears ${target.name}`
  }
  return `Deals ${amount} → ${target.cost - total} more to clear ${target.name}`
}

/** The Progress payload of an effect, looking through Modal/Sequence. */
function dealProgressOf(
  effect: CardEffect,
  branchIndex?: number,
): Extract<CardEffect, { kind: 'DealProgress' }> | null {
  switch (effect.kind) {
    case 'DealProgress':
      return effect
    case 'Modal': {
      const branch = branchIndex !== undefined ? effect.branches[branchIndex] : undefined
      return branch !== undefined ? dealProgressOf(branch) : null
    }
    case 'Sequence': {
      for (const step of effect.steps) {
        const found = dealProgressOf(step)
        if (found !== null) return found
      }
      return null
    }
    default:
      return null
  }
}
