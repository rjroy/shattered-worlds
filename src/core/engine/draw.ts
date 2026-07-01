import type { CardId, CardTemplateId, GameEvent, GameState, WorldCard } from "../model/types";
import { effectiveHandSize, WORLD_CONSTS } from "./world";
import { withAppliedKeyword } from "../model/keywords";
import { shuffle } from "./rng";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Total world cards remaining across worldDraw pile and all queued acts. */
function worldCardsRemaining(state: GameState): number {
  return state.worldDraw.length + state.acts.reduce((sum, act) => sum + act.length, 0);
}

// ---------------------------------------------------------------------------
// drawPlayer
// ---------------------------------------------------------------------------

/**
 * Pull `n` cards from playerDraw into hand. If playerDraw runs dry mid-draw,
 * shuffle playerDiscard into a new playerDraw (emitting DeckShuffled) and
 * continue. If both piles are empty, draws whatever is available without
 * throwing.
 *
 * Emits: DeckShuffled (0 or more), CardsDrawn (exactly 1, omitted if 0 drawn)
 */
export function drawPlayer(state: GameState, n: number): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const drawnIds: CardId[] = [];
  const templateIds: CardTemplateId[] = [];
  let remaining = n;

  while (remaining > 0) {
    if (current.playerDraw.length === 0) {
      // Nothing in discard either — stop gracefully
      if (current.playerDiscard.length === 0) break;

      // Reshuffle discard into a new draw pile
      const [shuffled, nextRng] = shuffle(current.playerDiscard, current.rng);
      current = {
        ...current,
        rng: nextRng,
        playerDraw: shuffled,
        playerDiscard: [],
      };
      events.push({ type: "DeckShuffled" });
    }

    // noUncheckedIndexedAccess: playerDraw is non-empty here (guarded above).
    const card = current.playerDraw[0]!;
    current = {
      ...current,
      playerDraw: current.playerDraw.slice(1),
      hand: [...current.hand, card],
    };
    drawnIds.push(card.id);
    remaining--;
  }

  if (drawnIds.length > 0) {
    events.push({
      type: "CardsDrawn",
      ids: drawnIds,
      templateIds,
      bHazard: false,
      revealedFromHidden: true,
    });
  }

  return { state: current, events };
}

// ---------------------------------------------------------------------------
// drawWorld
// ---------------------------------------------------------------------------

/**
 * Pull `n` world cards from worldDraw into hand. If worldDraw runs dry
 * mid-draw and acts remain, shuffle the next act into a new worldDraw
 * (emitting ActAdvanced) and continue. Stops gracefully if no cards remain.
 *
 * Emits: ActAdvanced (0 or more), CardsDrawn (exactly 1, omitted if 0 drawn)
 */
export function drawWorld(state: GameState, n: number): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const drawnIds: string[] = [];
  const templateIds: CardTemplateId[] = [];
  const pendingKeywordEvents: GameEvent[] = [];
  let remaining = n;

  while (remaining > 0) {
    if (current.worldDraw.length === 0) {
      // No more acts to advance into — stop gracefully
      if (current.acts.length === 0) break;

      // Advance to the next act: shuffle acts[0] into a new worldDraw
      const nextAct = current.acts[0]!;
      const [shuffled, nextRng] = shuffle(nextAct as WorldCard[], current.rng);
      const newActIndex = current.actIndex + 1;
      current = {
        ...current,
        rng: nextRng,
        worldDraw: shuffled,
        acts: current.acts.slice(1),
        actIndex: newActIndex,
      };
      events.push({ type: "ActAdvanced", act: newActIndex });
    }

    // noUncheckedIndexedAccess: worldDraw is non-empty here (guarded above).
    const pulled = current.worldDraw[0]!;

    // Some worlds — consume a queued "next world card" keyword (ApplyKeyword
    // target "nextWorldCard"). Stamp the FIRST world card pulled while the flag is set,
    // then clear it (consume-and-clear, mirroring resolveForceDestroy). When the
    // flag is absent (every non-Eden draw) this branch never runs and the event
    // stream is byte-identical.
    const pendingKeywords = current.pendingKeywordNextWorldCard;
    let card = pulled;
    if (pendingKeywords.length > 0) {
      card = pendingKeywords.reduce((partial, kw) => withAppliedKeyword(partial, kw), card);
      current = { ...current, pendingKeywordNextWorldCard: [] };
      const newEvents = pendingKeywords.map((kw) => {
        return {
          type: "KeywordApplied",
          ids: [card.id],
          templateIds: [card.templateId],
          keyword: kw.name,
          value: kw.value,
        } as GameEvent;
      });
      pendingKeywordEvents.push(...newEvents);
    }

    current = {
      ...current,
      worldDraw: current.worldDraw.slice(1),
      hand: [...current.hand, card],
    };
    drawnIds.push(card.id);
    templateIds.push(card.templateId);
    events.push({
      type: "HazardAdded",
      templateId: card.name,
      id: card.id,
      revealedFromHidden: true,
    });
    remaining--;
  }

  if (drawnIds.length > 0) {
    events.push({
      type: "CardsDrawn",
      ids: drawnIds,
      templateIds,
      bHazard: true,
      revealedFromHidden: true,
    });
    events.push(...pendingKeywordEvents);
  }

  return { state: current, events };
}

// ---------------------------------------------------------------------------
// refillHand (REQ-WDS-7)
// ---------------------------------------------------------------------------

/**
 * Fill the hand to {effectiveHandSize(state)} cards using the draw formula from REQ-WDS-7.
 *
 * Formula (evaluated after player cards have been discarded at EndTurn, so
 * hand contains only world cards):
 *
 *   heldWorld = hand.filter(c => c.kind === 'world').length
 *   room      = effectiveHandSize(state) - heldWorld
 *
 *   worldToDraw = clamp(max(1, WORLD_CONSTS.startWorldCards - heldWorld), 0, min(room, worldCardsRemaining))
 *   playerToDraw = max(0, WORLD_CONSTS.baseHandSize - newHand.length)   — after world draw
 */
export function refillHand(state: GameState): {
  state: GameState;
  events: GameEvent[];
} {
  const allEvents: GameEvent[] = [];

  const heldWorld = state.hand.filter((c) => c.kind === "world").length;
  const room = effectiveHandSize(state) - heldWorld;

  if (room === 0) {
    return { state, events: [] };
  }

  // World draw count: minimum 1, minimum (2 - held), capped by room and
  // by total world cards remaining. If no world cards exist at all, this
  // collapses to 0 via the min(…, worldCardsRemaining) clip.
  const totalWorldRemaining = worldCardsRemaining(state);
  const worldToDraw = Math.min(
    // Draw startWorldCards if none held, otherwise draw 1 if possible.
    Math.max(1, WORLD_CONSTS.startWorldCards - heldWorld),
    room,
    totalWorldRemaining,
  );

  // Draw world cards
  let current = state;
  if (worldToDraw > 0) {
    const result = drawWorld(current, worldToDraw);
    current = result.state;
    allEvents.push(...result.events);
  }

  // Player draw: fill remaining room up to the turn-start effective hand size.
  const playerToDraw = Math.max(0, effectiveHandSize(state) - current.hand.length);

  if (playerToDraw > 0) {
    const result = drawPlayer(current, playerToDraw);
    current = result.state;
    allEvents.push(...result.events);
  }

  return { state: current, events: allEvents };
}

// ---------------------------------------------------------------------------
// resolveForceDestroy
// ---------------------------------------------------------------------------

/**
 * Drain pending ForceDestroy charges against the freshly refilled hand: remove
 * up to `pendingForceDestroy` random *player* cards (the bird carries off your
 * gear; destroying a world hazard would only help you, so hazards are spared).
 *
 * Destroyed cards leave the game entirely — they are not sent to playerDiscard.
 * The counter is fully consumed even if fewer player cards are available, so an
 * unsatisfiable charge fizzles rather than lingering into a later turn.
 *
 * Emits: CardDestroyed (one per card removed).
 */
export function resolveForceDestroy(state: GameState): {
  state: GameState;
  events: GameEvent[];
} {
  if (state.pendingForceDestroy <= 0) {
    return { state, events: [] };
  }

  const events: GameEvent[] = [];
  let current = state;

  // Provenance for the deferred events: if a (concealed) world card queued this
  // destroy, its id rides along so the preview can mask the snatch. Stamped onto
  // BraceConsumed and CardDestroyed; the preview decides if the source is hidden.
  const source = state.pendingForceDestroySource;
  const withSource = (event: GameEvent): GameEvent =>
    source !== undefined ? { ...event, sourceCardId: source } : event;

  // Absorb brace charges first (D3): each charge cancels one pending snatch.
  const absorbed = Math.min(current.braceCharges, current.pendingForceDestroy);
  if (absorbed > 0) {
    const remaining = current.pendingForceDestroy - absorbed;
    current = {
      ...current,
      braceCharges: current.braceCharges - absorbed,
      pendingForceDestroy: remaining,
    };
    events.push(withSource({ type: "BraceConsumed", absorbed, remaining }));
  }

  if (current.pendingForceDestroy <= 0) {
    // Fully absorbed: clear the carried source alongside the drained counter.
    return { state: { ...current, pendingForceDestroySource: undefined }, events };
  }

  const playerCards = current.hand.filter((c) => c.kind === "player" && c.canDestroy);
  const takeCount = Math.min(current.pendingForceDestroy, playerCards.length);

  if (takeCount === 0) {
    // Nothing to grab — consume the charge so it does not carry over.
    return {
      state: { ...current, pendingForceDestroy: 0, pendingForceDestroySource: undefined },
      events,
    };
  }

  const [shuffled, nextRng] = shuffle(playerCards, current.rng);
  const doomedCards = shuffled.slice(0, takeCount);
  const doomedIds = new Set<CardId>(doomedCards.map((c) => c.id));
  const templateIds = doomedCards.map((c) => c.templateId);

  const final: GameState = {
    ...current,
    rng: nextRng,
    hand: current.hand.filter((c) => !doomedIds.has(c.id)),
    pendingForceDestroy: 0,
    pendingForceDestroySource: undefined,
  };

  const destroyEvent: GameEvent = withSource({
    type: "CardDestroyed",
    ids: [...doomedIds],
    templateIds,
    // The shuffle above picks victims, so the outcome is rng-chosen. This rides
    // alongside the withSource provenance stamp; the two flags coexist.
    randomized: true,
  });

  return { state: final, events: [...events, destroyEvent] };
}
