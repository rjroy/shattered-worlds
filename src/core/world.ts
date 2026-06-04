import type { GameState, WorldCard } from './types'
import { createRng, shuffle } from './rng'
import { mintCard } from './cards'
import { refillHand } from './draw'

// ---------------------------------------------------------------------------
// Act compositions (REQ-WDS-19)
// ---------------------------------------------------------------------------

// Each act is a list of [templateId, count] pairs that fully specifies the
// cards to mint. Acts 2 and 3 are queued without shuffling; shuffling happens
// when an act activates in drawWorld (Phase 3).

type ActSpec = ReadonlyArray<
  | 'Strange Sounds'
  | 'Rubble'
  | 'Screams'
  | 'Zombie'
  | 'Find Baseball Bat'
  | 'The Walker'
  | 'Door'
>

const ACT_1_SPEC: ActSpec = [
  'Strange Sounds',
  'Strange Sounds',
  'Rubble',
  'Rubble',
  'Screams',
  'Screams',
]

const ACT_2_SPEC: ActSpec = ['Rubble', 'Rubble', 'Zombie', 'Zombie', 'Zombie', 'Find Baseball Bat']

const ACT_3_SPEC: ActSpec = [
  'Find Baseball Bat',
  'Zombie',
  'Zombie',
  'Zombie',
  'Zombie',
  'The Walker',
]

// ---------------------------------------------------------------------------
// Starter deck composition
// ---------------------------------------------------------------------------

type StarterSpec = ReadonlyArray<
  'Sprint' | 'Explore' | 'Barricade' | 'Med Kit' | 'Panic' | 'Adrenaline'
>

const STARTER_SPEC: StarterSpec = [
  'Sprint',
  'Sprint',
  'Explore',
  'Explore',
  'Explore',
  'Barricade',
  'Barricade',
  'Med Kit',
  'Panic',
  'Adrenaline',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mint every template id in `spec` in sequence, threading state through each
 * call so ids remain globally unique.
 */
function mintAll(
  state: GameState,
  spec: ReadonlyArray<
    | 'Sprint'
    | 'Explore'
    | 'Barricade'
    | 'Med Kit'
    | 'Panic'
    | 'Adrenaline'
    | 'Strange Sounds'
    | 'Rubble'
    | 'Screams'
    | 'Zombie'
    | 'Find Baseball Bat'
    | 'The Walker'
    | 'Door'
  >,
): [cards: (GameState['playerDraw'][number])[], next: GameState] {
  const cards: (GameState['playerDraw'][number])[] = []
  let current = state
  for (const templateId of spec) {
    const [card, next] = mintCard(current, templateId)
    cards.push(card)
    current = next
  }
  return [cards, current]
}

/**
 * Narrow an array of `Card` down to `WorldCard[]`. Every card minted from a
 * world template is a WorldCard; the cast is safe because mintAll is only
 * ever called with world-template ids for act specs.
 */
function asWorldCards(cards: (GameState['playerDraw'][number])[]): WorldCard[] {
  return cards.filter((c): c is WorldCard => c.kind === 'world')
}

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------

/**
 * Build the initial GameState for the Zombie Big-Box world.
 *
 * - Starter deck (10 cards) is shuffled into playerDraw.
 * - Act 1 (6 cards) is shuffled into worldDraw.
 * - Acts 2 and 3 are queued in `acts` unshuffled; they are shuffled when
 *   each act activates in drawWorld (Phase 3).
 * - Hand is left empty — refillHand is wired in Phase 3.
 */
export function createWorld(seed: number): GameState {
  const rng = createRng(seed)

  // Bootstrap a skeleton state so mintCard has a valid GameState to thread.
  // hp, status, and the pile arrays are all filled in below.
  let state: GameState = {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    progress: {},
    hp: 20,
    skipDrawNext: false,
    status: 'playing',
    worldId: 'zombie-big-box',
    rng,
    nextId: 0,
  }

  // --- Starter deck ---
  const [starterCards, afterStarter] = mintAll(state, STARTER_SPEC)
  state = afterStarter
  const [shuffledStarter, rngAfterStarter] = shuffle(starterCards, state.rng)
  state = { ...state, rng: rngAfterStarter, playerDraw: shuffledStarter }

  // --- Act 1 — shuffled immediately into worldDraw ---
  const [act1Cards, afterAct1] = mintAll(state, ACT_1_SPEC)
  state = afterAct1
  const worldCards1 = asWorldCards(act1Cards)
  const [shuffledAct1, rngAfterAct1] = shuffle(worldCards1, state.rng)
  state = { ...state, rng: rngAfterAct1, worldDraw: shuffledAct1 }

  // --- Act 2 — minted but not shuffled ---
  const [act2Cards, afterAct2] = mintAll(state, ACT_2_SPEC)
  state = afterAct2
  const worldCards2 = asWorldCards(act2Cards)

  // --- Act 3 — minted but not shuffled ---
  const [act3Cards, afterAct3] = mintAll(state, ACT_3_SPEC)
  state = afterAct3
  const worldCards3 = asWorldCards(act3Cards)

  const baseState: GameState = {
    ...state,
    acts: [worldCards2, worldCards3],
    hand: [],
  }

  // Deal the opening hand (REQ-WDS-7) — events are discarded at init time.
  const { state: dealt } = refillHand(baseState)
  return dealt
}
