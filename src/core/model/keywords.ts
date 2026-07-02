/**
 * Keyword helpers — the single place that parses authoring strings into
 * structured `Keyword`s and the single place consumers ask "does this card
 * carry keyword X?". Routing every consumer through `hasKeyword` /
 * `keywordNames` keeps the structured `{ name, value }` shape an internal
 * detail rather than something every call site has to unpack.
 *
 * Pure core — no Phaser, no DOM.
 */
import type { Card, Keyword, KeywordName, PersistentModifier } from "./types";

// The closed set of valid keyword names. Kept in sync with `KeywordName`;
// used at parse time to reject unknown authoring strings.
export const KEYWORD_NAMES: readonly KeywordName[] = [
  "Obstructed",
  "Creature",
  "Slow",
  "Spore",
  "Concealed",
  "Alarm",
  "Lockdown",
  "Reroute",
];

export const PERSISTENT_KEYWORDS: ReadonlySet<KeywordName> = new Set(["Lockdown"]);

export const KEYWORD_COST_MODIFIERS: Partial<Record<KeywordName, PersistentModifier>> = {
  Lockdown: { kind: "ClearCostPerSelfKeyword", costPer: 1 },
  Alarm: { kind: "ClearCostPerKeywordCount", costPer: 1 },
  Reroute: { kind: "ClearCostPerSelfKeyword", costPer: 1 },
};

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

/**
 * The names of every keyword on a card (ignoring values). Unions the authored
 * `keywords` with the transient `appliedKeywords`, so a runtime-applied keyword
 * (e.g. Alarm) is reported here exactly like an authored one. Authored names
 * come first, applied names follow, each in source order.
 */
export function keywordNames(card: Card): KeywordName[] {
  const applied = card.appliedKeywords ?? [];
  return [...card.keywords, ...applied].map((k) => k.name);
}

/**
 * Whether the card carries a keyword with the given name (value ignored). True
 * iff the name is in the authored `keywords` OR the transient
 * `appliedKeywords` — so KeywordGate counting, CounterSpec.KeywordInHand, and
 * DealProgress.bonus.tag all recognize applied keywords with no further change.
 */
export function hasKeyword(card: Card, name: KeywordName): boolean {
  if (card.keywords.some((k) => k.name === name)) return true;
  return (card.appliedKeywords ?? []).some((k) => k.name === name);
}

/**
 * Returns the value of the named keyword on this card, combining both authored
 * and transient applied keywords. If no such keyword exists, returns 0.
 */
export function keywordValue(card: Card, name: KeywordName): number {
  const keywordEntry = card.keywords.find((k) => k.name === name);
  const keywordValue = keywordEntry === undefined ? 0 : Math.max(keywordEntry.value ?? 1, 1);
  const appliedEntry = (card.appliedKeywords ?? []).find((k) => k.name === name);
  const appliedValue = appliedEntry === undefined ? 0 : Math.max(appliedEntry.value ?? 1, 1);
  return keywordValue + appliedValue;
}

// ---------------------------------------------------------------------------
// Applied (transient) keyword helpers — pure and generic over PlayerCard /
// WorldCard. They mirror the `frozen` lifecycle (refresh-don't-shorten on
// apply, decrement-and-drop at turn start), generalized to a keyword list.
// ---------------------------------------------------------------------------

/**
 * Return `card` with `kw` present in its `appliedKeywords`. If an applied entry
 * of the same name already exists, its lifetime is raised to the larger of the
 * two values (refresh, never shorten — mirrors setPlayerFrozen's Math.max).
 */
export function withAppliedKeyword<C extends Card>(card: C, kw: Keyword): C {
  const existing = card.appliedKeywords ?? [];
  const prior = existing.find((k) => k.name === kw.name);
  const merged: Keyword =
    prior !== undefined ? { name: kw.name, value: Math.max(prior.value ?? 0, kw.value ?? 0) } : kw;
  const appliedKeywords: readonly Keyword[] = [
    ...existing.filter((k) => k.name !== kw.name),
    merged,
  ];
  return { ...card, appliedKeywords } as C;
}

/**
 * Return `card` with any applied keyword named `name` removed. When the last
 * applied entry is removed, the `appliedKeywords` property is dropped entirely
 * so the card is byte-identical to one that never carried it (mirrors how the
 * thaw path strips `frozen`).
 */
export function withoutAppliedKeyword<C extends Card>(card: C, name: KeywordName): C {
  const existing = card.appliedKeywords;
  if (existing === undefined) return card;
  const next = existing.filter((k) => k.name !== name);
  if (next.length === existing.length) return card;
  if (next.length === 0) {
    const { appliedKeywords: _dropped, ...rest } = card;
    return rest as C;
  }
  return { ...card, appliedKeywords: next } as C;
}

/** The lifetime of the card's applied keyword `name`, or 0 when absent. */
export function appliedKeywordValue(card: Card, name: KeywordName): number {
  const entry = (card.appliedKeywords ?? []).find((k) => k.name === name);
  return entry === undefined ? 0 : Math.max(entry.value ?? 1, 1);
}

/**
 * Decrement every applied keyword's lifetime by one and drop entries that reach
 * zero. When the list empties, the `appliedKeywords` property is removed (see
 * withoutAppliedKeyword). Pure: returns a new card, never mutates.
 */
export function tickAppliedKeywords<C extends Card>(card: C): C {
  const existing = card.appliedKeywords;
  if (existing === undefined || existing.length === 0) return card;
  const next = existing
    .map((kw) =>
      PERSISTENT_KEYWORDS.has(kw.name) ? kw : { name: kw.name, value: (kw.value ?? 0) - 1 },
    )
    .filter((kw) => PERSISTENT_KEYWORDS.has(kw.name) || (kw.value ?? 0) > 0);
  if (next.length === 0) {
    const { appliedKeywords: _dropped, ...rest } = card;
    return rest as C;
  }
  return { ...card, appliedKeywords: next } as C;
}

/**
 * The card's Concealed depth — the value of its `Concealed` keyword, or 0 when
 * the card carries no `Concealed` keyword.
 */
export function concealOf(card: Card): number {
  const concealed = card.keywords.find((k) => k.name === "Concealed");
  return concealed?.value ?? 0;
}

/**
 * Whether the card is hidden at the given Light level. Visibility is
 * recomputed live from `light` and the keyword — there is no stored "revealed"
 * flag. A card is concealed iff its depth strictly exceeds Light, so a card at
 * `concealOf === light` is REVEALED (the threshold is inclusive of seeing).
 */
export function isConcealed(card: Card, light: number): boolean {
  return concealOf(card) > light;
}
