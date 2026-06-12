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

export interface BasicCardTemplate {
  name: string
  insetKey?: string
}

export interface PlayerCardTemplate extends BasicCardTemplate {
  kind: 'player'
  effect: CardEffect
  energyCost?: number
  exhaust?: boolean
  // Optional in templates so existing JSON catalogs load unchanged; minted
  // cards always carry a concrete (possibly empty) keywords array.
  keywords?: readonly Keyword[]
}

export interface WorldCardTemplate extends BasicCardTemplate {
  kind: 'world'
  cost: number
  keywords: readonly Keyword[]
  discardable: boolean
  // When explicitly false, the minted card gets canExile: false. Omitting it
  // defaults to true (most world cards can be exiled).
  canExile?: boolean
  onDiscarded: CardEffect
  onCleared: CardEffect
  onEndOfTurn: CardEffect
  onPartialClear: CardEffect
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
      insetKey: template.insetKey,
      sourceWorldId: state.worldId,
      effect: template.effect,
      energyCost: template.energyCost ?? 0,
      exhaust: template.exhaust ?? false,
      keywords: template.keywords ?? [],
    }
    return [card, next]
  }

  const card: WorldCard = {
    kind: 'world',
    id,
    name: template.name,
    insetKey: template.insetKey,
    cost: template.cost,
    keywords: template.keywords,
    discardable: template.discardable,
    canExile: template.canExile ?? true,
    onDiscarded: template.onDiscarded,
    onCleared: template.onCleared,
    onEndOfTurn: template.onEndOfTurn,
    onPartialClear: template.onPartialClear,
  }
  return [card, next]
}
