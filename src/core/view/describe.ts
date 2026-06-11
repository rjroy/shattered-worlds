/**
 * Human-readable descriptions of card behaviour.
 *
 * This is the single source of every English string that explains what a card
 * does — the card face, the modal chooser labels, and the live target preview
 * all read from here, so they can never disagree. It imports core *types* only
 * (no Phaser, no DOM), so it stays on the pure side of the renderer boundary
 * and is unit-tested headless.
 */
import type { CardEffect, GameState, PlayerCard, WorldCard } from '../../core/index'

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
      const bonus = effect.bonus ? `\n(+${effect.bonus.amount} vs ${effect.bonus.tag})` : ''
      return [`Add ${effect.base} Progress${bonus}`]
    }
    case 'Draw': {
      const parts: string[] = []
      if (effect.player !== undefined && effect.player > 0) parts.push(`Draw ${effect.player}`)
      if (effect.world !== undefined && effect.world > 0) parts.push(`+${effect.world} world`)
      return [parts.length > 0 ? parts.join(', ') : 'Draw nothing']
    }
    case 'Heal':
      return [`Heal ${effect.amount} HP`]
    case 'GainEnergy':
      return [`Gain ${effect.amount} Energy`]
    case 'ReturnWorldCards':
      return [describeReturn(effect.min, effect.max)]
    case 'DestroyCardInHand':
      return [
        effect.max == 1 ? `Destroy a card in hand` : `Destroy ${effect.min}–${effect.max} cards in hand`, 
        (effect.min == 0 && effect.max == 1) ? '(optional)' : ``
      ]
    case 'DiscardThenDraw':
      return [`Discard a card, then draw ${effect.player}`]
    case 'AddCard':
      return [`Gain a ${effect.template} card`]
    case 'AddWorldCardToTop':
      return [`+${effect.template} to world deck`]
    case 'AddThreatToWorldDeck':
      return ['+theme threat to world deck']
    case 'Modal':
      return ['Choose one:', ...effect.branches.map((b) => `• ${describeEffect(b).join(', ')}`)]
    case 'Sequence':
      return effect.steps.flatMap((step, i) =>
        describeEffect(step).map((line, j) => (i > 0 && j === 0 ? `then ${lowerFirst(line)}` : line)),
      )
    case 'Damage':
      return [`-${effect.amount} HP`]
    case 'SkipDrawNextTurn':
      return ['skip next draw']
    case 'GainCard':
      return [`gain ${effect.template}`]
    case 'AddPlayerCardToTop':
      return [`+${effect.template} to your deck`]
    case 'SurviveWorld':
      return ['you survive the world']
    case 'ForceDestroy':
      return ['destroy a random card from your next hand']
    case 'DestroySelf':
      return ['vanishes']
    case 'None':
      return []
    case 'Brace':
      return [
        effect.amount === 1
          ? 'Brace: absorb the next snatch'
          : `Brace: absorb the next ${effect.amount} snatches`,
      ]
    case 'DealProgressAll': {
      const bonus = effect.bonus ? `\n(+${effect.bonus.amount} vs ${effect.bonus.tag})` : ''
      return [`${effect.base} Progress to every hazard${bonus}`]
    }
    case 'ExileTopWorldCards':
      return [
        `Exile the top ${effect.amount} card${effect.amount === 1 ? '' : 's'} of the world deck`,
      ]
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
    return `Make ${amount} Progress → clears ${target.name}`
  }
  return `Make ${amount} Progress → ${target.cost - total} more to clear ${target.name}`
}

/** The Progress payload of an effect, looking through Modal/Sequence. */
function dealProgressOf(
  effect: CardEffect,
  branchIndex?: number,
): Extract<CardEffect, { kind: 'DealProgress' }> | null {
  switch (effect.kind) {
    case 'DealProgress':
      return effect
    case 'DealProgressAll':
      // Treat as a DealProgress-shaped payload so previewPlay shows per-hazard math.
      return effect.bonus !== undefined
        ? { kind: 'DealProgress', base: effect.base, bonus: effect.bonus }
        : { kind: 'DealProgress', base: effect.base }
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
