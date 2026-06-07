import type { CardTemplate } from './cards'
import { CatalogError } from './errors'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CardCatalog = Record<string, CardTemplate>

export type CardCount = { templateId: string; count: number }

export interface DeckComposition {
  acts: { cards: CardCount[] }[]
}

export interface WorldData {
  worldId: string
  starterDeck: CardCount[]
  deckComposition: DeckComposition
}

export interface AssembledWorld {
  catalog: CardCatalog
  worldData: WorldData
}

export interface RawCardSource {
  worldId: string
  cardTemplates: Record<string, CardTemplate>
  starterDeck?: CardCount[]
  deckComposition?: DeckComposition
}

// ---------------------------------------------------------------------------
// assembleCatalog
// ---------------------------------------------------------------------------

/**
 * Merges card templates from one or more RawCardSource objects into a single
 * catalog. Throws CatalogError if the same templateId appears in more than
 * one source — duplicate ids indicate a data authoring mistake and must not
 * be silently resolved by last-writer-wins.
 */
export function assembleCatalog(sources: RawCardSource[]): CardCatalog {
  const catalog: CardCatalog = {}

  for (const source of sources) {
    for (const [templateId, template] of Object.entries(source.cardTemplates)) {
      if (Object.prototype.hasOwnProperty.call(catalog, templateId)) {
        throw new CatalogError(
          `Duplicate templateId "${templateId}" found in world "${source.worldId}"`,
        )
      }
      catalog[templateId] = template
    }
  }

  return catalog
}
