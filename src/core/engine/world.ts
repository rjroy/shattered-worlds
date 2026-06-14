import type { GameState, WorldCard } from "../model/types";
import type { CardCatalog, CardCount, WorldData } from "../model/catalog";
import { createRng, shuffle } from "./rng";
import { mintCard } from "../model/cards";
import { startTurn } from "./energy";

export const WORLD_CONSTS = {
  startHp: 10,
  maxHandSize: 6,
  startWorldCards: 2,
  get startPlayerCards(): number {
    return WORLD_CONSTS.maxHandSize - WORLD_CONSTS.startWorldCards;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mint every entry in `spec` (each entry is a {templateId, count} pair),
 * repeating each templateId `count` times. Threads state through each call
 * so ids remain globally unique.
 */
function mintAll(
  catalog: CardCatalog,
  state: GameState,
  spec: readonly CardCount[],
): [cards: GameState["playerDraw"][number][], next: GameState] {
  const cards: GameState["playerDraw"][number][] = [];
  let current = state;
  for (const { templateId, count } of spec) {
    for (let i = 0; i < count; i++) {
      const [card, next] = mintCard(catalog, current, templateId);
      cards.push(card);
      current = next;
    }
  }
  return [cards, current];
}

/**
 * Narrow an array of `Card` down to `WorldCard[]`. Every card minted from a
 * world template is a WorldCard; the cast is safe because mintAll is only
 * ever called with world-template ids for act specs.
 */
function asWorldCards(cards: GameState["playerDraw"][number][]): WorldCard[] {
  return cards.filter((c): c is WorldCard => c.kind === "world");
}

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------

/**
 * Build the initial GameState from a WorldData descriptor and catalog.
 *
 * - Starter deck (count-expanded from world.starterDeck) is shuffled into playerDraw.
 * - Act 1 (from world.deckComposition.acts[0]) is shuffled into worldDraw.
 * - Remaining acts are queued in `acts` unshuffled; they are shuffled when
 *   each act activates in drawWorld.
 * - Hand is left empty — refillHand deals the opening hand.
 */
export function createWorld(catalog: CardCatalog, world: WorldData, seed: number): GameState {
  const rng = createRng(seed);

  // Bootstrap a skeleton state so mintCard has a valid GameState to thread.
  // hp, status, and the pile arrays are all filled in below.
  let state: GameState = {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    totalActs: world.deckComposition.acts.length,
    progress: {},
    hp: WORLD_CONSTS.startHp,
    energy: 0,
    // Per-world starting Light. 0 everywhere but Fog (world.startLight unset),
    // which is the invariant keeping decay and concealment no-ops elsewhere.
    light: world.startLight ?? 0,
    pendingForceDestroy: 0,
    braceCharges: 0,
    status: "playing",
    worldId: "starter",
    rng,
    nextId: 0,
  };

  // --- Starter deck — minted while worldId is 'starter' so player cards carry
  //     sourceWorldId: 'starter' as their provenance. ---
  const [starterCards, afterStarter] = mintAll(catalog, state, world.starterDeck);
  state = afterStarter;
  const [shuffledStarter, rngAfterStarter] = shuffle(starterCards, state.rng);
  state = { ...state, rng: rngAfterStarter, playerDraw: shuffledStarter };

  // Switch to the active world before minting act cards.
  state = { ...state, worldId: world.worldId };

  // --- Act 1 (deckComposition.acts[0]) — shuffled immediately into worldDraw ---
  const acts = world.deckComposition.acts;
  const act1Spec = acts[0]?.cards ?? [];
  const [act1Cards, afterAct1] = mintAll(catalog, state, act1Spec);
  state = afterAct1;
  const worldCards1 = asWorldCards(act1Cards);
  const [shuffledAct1, rngAfterAct1] = shuffle(worldCards1, state.rng);
  state = { ...state, rng: rngAfterAct1, worldDraw: shuffledAct1 };

  // --- Remaining acts — minted but not shuffled ---
  const queuedActs: WorldCard[][] = [];
  for (let i = 1; i < acts.length; i++) {
    const actSpec = acts[i]?.cards ?? [];
    const [actCards, afterAct] = mintAll(catalog, state, actSpec);
    state = afterAct;
    queuedActs.push(asWorldCards(actCards));
  }

  const baseState: GameState = {
    ...state,
    acts: queuedActs,
    hand: [],
  };

  // Deal the opening hand — events are discarded at init time.
  // startTurn ensures the opening hand is a turn start (energy === 1).
  const { state: dealt } = startTurn(baseState);
  return dealt;
}
