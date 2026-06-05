import type {
  CardEffect,
  CardTemplateId,
  GameState,
  Keyword,
  PlayerCard,
  WorldCard,
} from './types'
import type { CardCatalog } from './catalog'
import { UnknownTemplateError } from './errors'

// ---------------------------------------------------------------------------
// Static template shapes
// ---------------------------------------------------------------------------

export interface PlayerCardTemplate {
  kind: 'player'
  name: string
  effect: CardEffect
}

export interface WorldCardTemplate {
  kind: 'world'
  name: string
  cost: number
  keywords: readonly Keyword[]
  discardable: boolean
  onDiscarded: CardEffect
  onCleared: CardEffect
  onEndOfTurn: CardEffect
}

export type CardTemplate = PlayerCardTemplate | WorldCardTemplate

// ---------------------------------------------------------------------------
// mintCard — stamps a template with the next sequential id
// ---------------------------------------------------------------------------

/**
 * Produces a single card from a template and advances `state.nextId`.
 * Returns the new card and the updated GameState; neither the card nor the
 * state is mutated in place.
 */
export function mintCard(
  catalog: CardCatalog,
  state: GameState,
  templateId: CardTemplateId,
): [card: PlayerCard | WorldCard, next: GameState] {
  const id = String(state.nextId)
  const next: GameState = { ...state, nextId: state.nextId + 1 }
  const template = catalog[templateId]

  if (template === undefined) throw new UnknownTemplateError(templateId, state)

  if (template.kind === 'player') {
    const card: PlayerCard = {
      kind: 'player',
      id,
      name: template.name,
      sourceWorldId: state.worldId,
      effect: template.effect,
    }
    return [card, next]
  }

  const card: WorldCard = {
    kind: 'world',
    id,
    name: template.name,
    cost: template.cost,
    keywords: template.keywords,
    discardable: template.discardable,
    onDiscarded: template.onDiscarded,
    onCleared: template.onCleared,
    onEndOfTurn: template.onEndOfTurn,
  }
  return [card, next]
}
