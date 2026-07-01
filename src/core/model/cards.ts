import type {
  CardEffect,
  CardFx,
  CardTemplateId,
  GameState,
  PersistentModifier,
  PlayerCard,
  WorldCard,
} from "./types";
import type { CardCatalog } from "./catalog";
import type { RarityTier } from "./rarity";
import { parseKeyword } from "./keywords";
import { UnknownTemplateError } from "./errors";

// ---------------------------------------------------------------------------
// Static template shapes
// ---------------------------------------------------------------------------

export interface BasicCardTemplate {
  name: string;
  insetKey?: string;
  // Authored tier; optional so existing JSON catalogs load unchanged. Minted
  // cards always carry a concrete tier (template.rarity ?? "common").
  rarity?: RarityTier;
  fx?: CardFx[];
}

export interface PlayerCardTemplate extends BasicCardTemplate {
  kind: "player";
  effect: CardEffect;
  canDestroy?: boolean;
  energyCost?: number;
  exhaust?: boolean;
  // Authored as strings ("Name" or "Name:N"); parsed to structured Keywords at
  // mint. Optional in templates so existing JSON catalogs load unchanged;
  // minted cards always carry a concrete (possibly empty) keywords array.
  keywords?: readonly string[];
}

export interface WorldCardTemplate extends BasicCardTemplate {
  kind: "world";
  cost: number;
  persistent?: PersistentModifier;
  // Authored as strings ("Name" or "Name:N"); parsed to structured Keywords at
  // mint.
  keywords: readonly string[];
  discardable: boolean;
  // When explicitly false, the minted card gets canExile: false. Omitting it
  // defaults to true (most world cards can be exiled).
  canExile?: boolean;
  onDiscarded: CardEffect;
  onCleared: CardEffect;
  onEndOfTurn: CardEffect;
  onPartialClear: CardEffect;
  onDraw: CardEffect;
}

export type CardTemplate = PlayerCardTemplate | WorldCardTemplate;

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
  const id = String(state.nextId);
  const next: GameState = { ...state, nextId: state.nextId + 1 };
  const template = catalog[templateId];

  if (template === undefined) throw new UnknownTemplateError(templateId, state);

  if (template.kind === "player") {
    const card: PlayerCard = {
      kind: "player",
      id,
      templateId,
      name: template.name,
      insetKey: template.insetKey,
      sourceWorldId: state.worldId,
      effect: template.effect,
      canDestroy: template.canDestroy ?? true,
      energyCost: template.energyCost ?? 0,
      exhaust: template.exhaust ?? false,
      keywords: (template.keywords ?? []).map(parseKeyword),
      rarity: template.rarity ?? "common",
      fx: template.fx ?? [],
    };
    return [card, next];
  }

  const card: WorldCard = {
    kind: "world",
    id,
    templateId,
    name: template.name,
    insetKey: template.insetKey,
    cost: template.cost,
    ...(template.persistent === undefined ? {} : { persistent: template.persistent }),
    keywords: template.keywords.map(parseKeyword),
    discardable: template.discardable,
    canExile: template.canExile ?? true,
    onDiscarded: template.onDiscarded,
    onCleared: template.onCleared,
    onEndOfTurn: template.onEndOfTurn,
    onPartialClear: template.onPartialClear,
    onDraw: template.onDraw,
    rarity: template.rarity ?? "common",
    fx: template.fx ?? [],
  };
  return [card, next];
}
