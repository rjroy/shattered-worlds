/**
 * Shared test fixture: assembles the catalog and worldData once, plus the
 * small set of state/card builders that every core test reuses. Import from
 * here instead of duplicating setup.
 */
import { buildWorld } from '../../data/worldManifest'
import { createWorld } from '../engine/world'
import { mintCard } from '../model/cards'
import type { CardCatalog } from '../model/catalog'
import type { GameState, PlayerCard, WorldCard } from '../model/types'

export const { catalog, worldData } = buildWorld('zombie-big-box')

/**
 * Build a minimal GameState forked from createWorld (so nextId and rng are
 * valid), with the hand, piles, acts, and progress cleared. Pass overrides to
 * set up exactly what a test needs.
 *
 * `cat`/`world` default to the shared zombie-big-box fixture; pass another
 * world's pair to seed from a different catalog.
 */
export function makeState(
  overrides: Partial<GameState> = {},
  cat: CardCatalog = catalog,
  world = worldData,
): GameState {
  const { state: base } = createWorld(cat, world, 1)
  return {
    ...base,
    hand: [],
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    energy: 0,
    status: 'playing',
    ...overrides,
  }
}

/** Mint a card of the expected kind and advance the id/rng chain. */
export function mintPlayer(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
  cat: CardCatalog = catalog,
): [PlayerCard, GameState] {
  const [card, next] = mintCard(cat, state, name)
  if (card.kind !== 'player') throw new Error(`${name} is not a player card`)
  return [card, next]
}

export function mintWorld(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
  cat: CardCatalog = catalog,
): [WorldCard, GameState] {
  const [card, next] = mintCard(cat, state, name)
  if (card.kind !== 'world') throw new Error(`${name} is not a world card`)
  return [card, next]
}

/** Mint `n` player cards from a single template, threading state through. */
export function mintPlayers(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
  n: number,
  cat: CardCatalog = catalog,
): [PlayerCard[], GameState] {
  const cards: PlayerCard[] = []
  let acc = state
  for (let i = 0; i < n; i++) {
    const [card, next] = mintPlayer(acc, name, cat)
    cards.push(card)
    acc = next
  }
  return [cards, acc]
}

/** Mint `n` world cards from a single template, threading state through. */
export function mintWorlds(
  state: GameState,
  name: Parameters<typeof mintCard>[2],
  n: number,
  cat: CardCatalog = catalog,
): [WorldCard[], GameState] {
  const cards: WorldCard[] = []
  let acc = state
  for (let i = 0; i < n; i++) {
    const [card, next] = mintWorld(acc, name, cat)
    cards.push(card)
    acc = next
  }
  return [cards, acc]
}

/** Build a WorldCard literal with sensible defaults; override as needed. */
export function makeWorldCard(overrides: Partial<WorldCard> & Pick<WorldCard, 'id'>): WorldCard {
  return {
    kind: 'world',
    name: overrides.id,
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: true,
    canExile: true,
    onDiscarded: { kind: 'None' },
    onCleared: { kind: 'None' },
    onEndOfTurn: { kind: 'None' },
    onPartialClear: { kind: 'None' },
    ...overrides,
  }
}

/** Build a PlayerCard literal with sensible defaults; override as needed. */
export function makePlayerCard(
  overrides: Partial<PlayerCard> & Pick<PlayerCard, 'id'>,
): PlayerCard {
  return {
    kind: 'player',
    name: overrides.id,
    insetKey: undefined,
    sourceWorldId: 'test',
    effect: { kind: 'None' },
    energyCost: 0,
    keywords: [],
    ...overrides,
  }
}
