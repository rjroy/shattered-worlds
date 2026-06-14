/**
 * Keyword helpers — the single place that parses authoring strings into
 * structured `Keyword`s and the single place consumers ask "does this card
 * carry keyword X?". Routing every consumer through `hasKeyword` /
 * `keywordNames` keeps the structured `{ name, value }` shape an internal
 * detail rather than something every call site has to unpack.
 *
 * Pure core — no Phaser, no DOM.
 */
import type { Card, Keyword, KeywordName } from "./types";

// The closed set of valid keyword names. Kept in sync with `KeywordName`;
// used at parse time to reject unknown authoring strings.
const KEYWORD_NAMES: readonly KeywordName[] = ["Hidden", "Creature", "Slow", "Spore", "Concealed"];

function isKeywordName(s: string): s is KeywordName {
  return (KEYWORD_NAMES as readonly string[]).includes(s);
}

/**
 * Parse an authoring string into a structured keyword.
 *   "Spore"       → { name: "Spore" }
 *   "Concealed:3" → { name: "Concealed", value: 3 }
 * Throws on an unknown name or a non-numeric value.
 */
export function parseKeyword(s: string): Keyword {
  const sep = s.indexOf(":");
  if (sep === -1) {
    if (!isKeywordName(s)) throw new Error(`Unknown keyword "${s}"`);
    return { name: s };
  }

  const name = s.slice(0, sep);
  const rawValue = s.slice(sep + 1);
  if (!isKeywordName(name)) throw new Error(`Unknown keyword "${name}"`);

  const value = Number(rawValue);
  if (rawValue.trim() === "" || !Number.isFinite(value)) {
    throw new Error(`Keyword "${name}" has a non-numeric value "${rawValue}"`);
  }
  return { name, value };
}

/** The names of every keyword on a card (ignoring values). */
export function keywordNames(card: Card): KeywordName[] {
  return card.keywords.map((k) => k.name);
}

/** Whether the card carries a keyword with the given name (value ignored). */
export function hasKeyword(card: Card, name: KeywordName): boolean {
  return card.keywords.some((k) => k.name === name);
}

/**
 * The card's Concealed depth — the value of its `Concealed` keyword, or 0 when
 * the card carries no `Concealed` keyword (so non-fog cards are never concealed).
 */
export function concealOf(card: Card): number {
  const concealed = card.keywords.find((k) => k.name === "Concealed");
  return concealed?.value ?? 0;
}

/**
 * Whether the card is hidden by fog at the given Light level. Visibility is
 * recomputed live from `light` and the keyword — there is no stored "revealed"
 * flag. A card is concealed iff its depth strictly exceeds Light, so a card at
 * `concealOf === light` is REVEALED (the threshold is inclusive of seeing).
 */
export function isConcealed(card: Card, light: number): boolean {
  return concealOf(card) > light;
}
