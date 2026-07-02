import type { CardTemplate } from "./cards";
import type { CardEffect } from "./types";
import { RARITY_ORDER } from "./rarity";
import { CatalogError } from "./errors";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CardCatalog = Record<string, CardTemplate>;

export type CardCount = { templateId: string; count: number };

export interface DeckComposition {
  acts: { cards: CardCount[] }[];
}

export interface WorldData {
  worldId: string;
  starterDeck: CardCount[];
  deckComposition: DeckComposition;
  // Starting Light level. Per-world (NOT a global const): only worlds that
  // use concealment set this above 0, so every other world boots with
  // light === 0. Defaults to 0.
  startLight?: number;
  startHeat?: number;
  // Per-world end-turn passive. Threaded onto GameState by
  // createWorld and applied in handleEndTurn. Absent ⇒ { kind: "None" }.
  onEndOfTurnPassive?: CardEffect;
}

export interface AssembledWorld {
  catalog: CardCatalog;
  worldData: WorldData;
}

export interface RawCardSource {
  worldId: string;
  cardTemplates: Record<string, CardTemplate>;
  starterDeck?: CardCount[];
  deckComposition?: DeckComposition;
  // Per-world starting Light (see WorldData.startLight). Defaults to 0.
  startLight?: number;
  startHeat?: number;
  // Per-world end-turn passive (see WorldData.onEndOfTurnPassive). Absent ⇒ None.
  onEndOfTurnPassive?: CardEffect;
}

// ---------------------------------------------------------------------------
// assembleCatalog
// ---------------------------------------------------------------------------

/**
 * Merges card templates from one or more RawCardSource objects into a single
 * catalog. Throws CatalogError if the same templateId appears in more than
 * one source — duplicate ids indicate a data authoring mistake and must not
 * be silently resolved by last-writer-wins. Also throws CatalogError if a
 * template authors a `rarity` value outside the four valid RarityTiers —
 * JSON-authored templates aren't compile-time type-checked, so this guards
 * against bad data reaching mintCard.
 */
export function assembleCatalog(sources: RawCardSource[]): CardCatalog {
  const catalog: CardCatalog = {};

  for (const source of sources) {
    for (const [templateId, template] of Object.entries(source.cardTemplates)) {
      if (Object.prototype.hasOwnProperty.call(catalog, templateId)) {
        throw new CatalogError(
          `Duplicate templateId "${templateId}" found in world "${source.worldId}"`,
        );
      }
      if (template.rarity !== undefined && !RARITY_ORDER.includes(template.rarity)) {
        throw new CatalogError(
          `Invalid rarity "${template.rarity}" for templateId "${templateId}" found in world "${source.worldId}"`,
        );
      }
      catalog[templateId] = template;
    }
  }

  return catalog;
}
