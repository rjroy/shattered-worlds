import type { Action, GameEvent, GameState, WorldCard } from "../model/types";
import type { CardCatalog } from "../model/catalog";
import { availableActions, checkPlayAction } from "./available";
import { applyEffect } from "./effects";
import { startTurn, spendEnergy } from "./energy";
import { IllegalActionError } from "../model/errors";
import { mintCard } from "../model/cards";
import { createActBoonOffer } from "./actBoon";
import { effectivePlayerCard } from "./effectiveCards";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type ReduceResult = { state: GameState; events: GameEvent[] };

// ---------------------------------------------------------------------------
// PlayCard handler
// ---------------------------------------------------------------------------

function handlePlayCard(
  catalog: CardCatalog,
  state: GameState,
  action: Extract<Action, { type: "PlayCard" }>,
): ReduceResult {
  const available = availableActions(state);

  // All spec-kind validation lives in checkPlayAction (available.ts owns the
  // spec shape; the reducer just enforces the result).
  const err = checkPlayAction(available, action);
  if (err !== null) {
    throw new IllegalActionError(action, state, err);
  }

  const { cardId } = action;

  const baseCard = state.hand.find((c) => c.id === cardId);
  if (baseCard === undefined || baseCard.kind !== "player") {
    throw new IllegalActionError(action, state, `Card ${cardId} not found in hand`);
  }

  const snapshot = effectivePlayerCard(baseCard, state);
  const templateOrdinalThisTurn =
    (state.turnPlayHistory.byTemplateId[baseCard.templateId] ?? 0) + 1;
  const turnPlayHistory = {
    cardsPlayedThisTurn: state.turnPlayHistory.cardsPlayedThisTurn + 1,
    byTemplateId: {
      ...state.turnPlayHistory.byTemplateId,
      [baseCard.templateId]: templateOrdinalThisTurn,
    },
  };

  // Remove the base card from hand. A normal card recycles to playerDiscard; an
  // exhaust card is destroyed (sent to no zone).
  const exhaust = snapshot.exhaust === true;
  const stateAfterPlay: GameState = {
    ...state,
    turnPlayHistory,
    hand: state.hand.filter((c) => c.id !== cardId),
    playerDiscard: exhaust ? state.playerDiscard : [baseCard, ...state.playerDiscard],
  };

  const events: GameEvent[] = [
    {
      type: "CardPlayed",
      cardId,
      templateId: baseCard.templateId,
      templateOrdinalThisTurn,
    },
  ];

  // Deduct energy cost (REQ-ENERGY-10)
  // spendEnergy only emits EnergyChanged when cost > 0; cost-0 cards are silent
  const spendResult = spendEnergy(stateAfterPlay, snapshot.energyCost);
  const stateAfterSpend = spendResult.state;
  events.push(...spendResult.events);

  // Apply the card's effect (on the post-spend state)
  const effectResult = applyEffect(catalog, stateAfterSpend, snapshot.effect, action);
  events.push(...effectResult.events);

  // CardDestroyed comes AFTER the effect events so the play reads as
  // play → spend → effect → the card vanishes.
  if (exhaust) {
    events.push({ type: "CardDestroyed", ids: [cardId], templateIds: [baseCard.templateId] });
  }

  return { state: effectResult.state, events };
}

// ---------------------------------------------------------------------------
// DiscardHazard handler
// ---------------------------------------------------------------------------

function handleDiscardHazard(
  catalog: CardCatalog,
  state: GameState,
  action: Extract<Action, { type: "DiscardHazard" }>,
): ReduceResult {
  const { cardId } = action;

  // Find the card in hand
  const card = state.hand.find((c) => c.id === cardId);
  if (card === undefined || card.kind !== "world") {
    throw new IllegalActionError(
      action,
      state,
      `Card ${cardId} not found in hand or is not a world card`,
    );
  }

  // Check it is discardable (Door is not)
  const available = availableActions(state);
  if (!available.discardable.includes(cardId)) {
    throw new IllegalActionError(
      action,
      state,
      `Card ${cardId} (${card.name}) cannot be discarded`,
    );
  }

  // Remove from hand
  const handAfterDiscard = state.hand.filter((c) => c.id !== cardId);
  const stateAfterRemove: GameState = { ...state, hand: handAfterDiscard };

  // Pass card.id as selfId so the discarded card's onDiscarded hook events
  // carry its provenance (preview masking for concealed discards).
  const penaltyResult = applyEffect(
    catalog,
    stateAfterRemove,
    (card as WorldCard).onDiscarded,
    undefined,
    card.id,
  );

  const events: GameEvent[] = [
    { type: "HazardDiscarded", cardId, templateId: card.templateId },
    ...penaltyResult.events,
  ];

  return { state: penaltyResult.state, events };
}

// ---------------------------------------------------------------------------
// EndTurn handler
// ---------------------------------------------------------------------------

function handleEndTurn(catalog: CardCatalog, state: GameState): ReduceResult {
  const events: GameEvent[] = [{ type: "TurnEnded" }];

  // Fire onEndOfTurn for each world card in hand. The loop iterates a snapshot
  // of the world cards captured at loop entry (state.hand.filter(...)), so a
  // card spawned during the loop (e.g. AddWorldCardToDeck) is NOT re-processed
  // this turn — this is what prevents a same-turn transform chain.
  let current = state;
  for (const card of state.hand.filter((c): c is WorldCard => c.kind === "world")) {
    // Pass card.id as selfId so self-referential hooks (DestroySelf) know which
    // card fired them.
    const r = applyEffect(catalog, current, card.onEndOfTurn, undefined, card.id);
    current = r.state;
    events.push(...r.events);
    if (current.status !== "playing") {
      return { state: current, events };
    }
  }

  // Discard unfrozen player cards from hand; frozen player cards and world cards stay.
  const playerCardsInHand = current.hand.filter((c) => c.kind === "player");
  const unfrozenPlayerCards = playerCardsInHand.filter((c) => (c.frozen ?? 0) <= 0);
  const frozenPlayerCards = playerCardsInHand.filter((c) => (c.frozen ?? 0) > 0);
  const worldCardsInHand = current.hand.filter((c) => c.kind === "world");
  const discardedIds = unfrozenPlayerCards.map((c) => c.id);
  const templateIds = unfrozenPlayerCards.map((c) => c.templateId);

  const stateAfterDiscard: GameState = {
    ...current,
    hand: [...worldCardsInHand, ...frozenPlayerCards],
    playerDiscard: [...unfrozenPlayerCards, ...current.playerDiscard],
    progress: {},
    turnPlayHistory: { cardsPlayedThisTurn: 0, byTemplateId: {} },
  };

  if (discardedIds.length > 0) {
    events.push({ type: "CardsDiscarded", cardIds: discardedIds, templateIds });
  }

  // Start turn: gain +1 energy, then refill hand
  const turnStartResult = startTurn(stateAfterDiscard);
  events.push(...turnStartResult.events);

  let afterRefill = turnStartResult.state;
  const actBoon = afterRefill.runModifiers.actBoon;
  if (afterRefill.status === "playing" && actBoon !== null) {
    for (const event of turnStartResult.events) {
      if (event.type !== "ActAdvanced") continue;
      const offer = createActBoonOffer(catalog, afterRefill, actBoon, event.act);
      afterRefill = offer.state;
      if (offer.event !== null) {
        events.push(offer.event);
      }
    }
    if (afterRefill.pendingBoonChoices.length > 0) {
      return { state: afterRefill, events };
    }
  }

  // Livelock guard A: all draw piles and acts exhausted (player cards also
  // gone, e.g. all destroyed by Regroup) — nothing can ever enter the hand.
  // Lose immediately if the draw phase yielded zero player cards. This covers
  // both "no room because hazards filled the hand" and "player deck exhausted".
  if (afterRefill.status === "playing" && turnStartResult.playerCardsDrawn === 0) {
    const lostState: GameState = { ...afterRefill, status: "lost" };
    events.push({ type: "WorldLost" });
    return { state: lostState, events };
  }

  if (afterRefill.status === "playing") {
    const hasNoFutureCards =
      afterRefill.playerDraw.length === 0 &&
      afterRefill.playerDiscard.length === 0 &&
      afterRefill.worldDraw.length === 0 &&
      afterRefill.acts.length === 0;

    if (hasNoFutureCards) {
      // REQ-13: Check if ANY structural play exists, ignoring energy. Unaffordable
      // cards count as future progress (they will become affordable when energy rises).
      const avail = availableActions(afterRefill, { ignoreEnergy: true });
      const noProgressPossible = avail.playable.length === 0 && avail.discardable.length === 0;
      if (noProgressPossible) {
        const lostState: GameState = { ...afterRefill, status: "lost" };
        events.push({ type: "WorldLost" });
        return { state: lostState, events };
      }
    }
  }

  // Livelock guard B: world deck exhausted and no player card in any zone can
  // introduce world cards (AddWorldCardToDeck). With proper deck recycling, the
  // player pile never empties on its own — but if there are no world cards
  // anywhere and no way to create them, the game loops forever (no hazards to
  // deal progress to, discard for damage, or win against).
  //
  // The Walker in hand is a world card and keeps the check false; Summon Door
  // anywhere in the player zones is the only escape hatch.
  //
  // REQ-13: Guard B checks for AddWorldCardToDeck across zones, unaffected by energy.
  if (afterRefill.status === "playing") {
    const noWorldAnywhere =
      afterRefill.worldDraw.length === 0 &&
      afterRefill.acts.length === 0 &&
      !afterRefill.hand.some((c) => c.kind === "world");

    if (noWorldAnywhere) {
      const allPlayerCards = [
        ...afterRefill.playerDraw,
        ...afterRefill.playerDiscard,
        ...afterRefill.hand,
      ];
      const canIntroduceWorld = allPlayerCards.some((c) => {
        if (c.kind === "player") {
          switch (c.effect.kind) {
            case "AddWorldCardToDeck":
              return true;
            case "Sequence":
              return c.effect.steps.some((step) => step.kind === "AddWorldCardToDeck");
            case "Modal":
              return c.effect.branches.some((branch) => branch.kind === "AddWorldCardToDeck");
            default:
              return false;
          }
        }
        return false;
      });
      if (!canIntroduceWorld) {
        const lostState: GameState = { ...afterRefill, status: "lost" };
        events.push({ type: "WorldLost" });
        return { state: lostState, events };
      }
    }
  }

  return { state: afterRefill, events };
}

// ---------------------------------------------------------------------------
// ChooseBoon handler
// ---------------------------------------------------------------------------

function handleChooseBoon(
  catalog: CardCatalog,
  state: GameState,
  action: Extract<Action, { type: "ChooseBoon" }>,
): ReduceResult {
  const choice = state.pendingBoonChoices[0];
  if (choice === undefined) {
    throw new IllegalActionError(action, state, "No boon choice is pending");
  }

  if (!choice.offeredTemplateIds.includes(action.templateId)) {
    throw new IllegalActionError(
      action,
      state,
      `Template ${action.templateId} was not offered for this boon choice`,
    );
  }

  const [card, afterMint] = mintCard(catalog, state, action.templateId);
  if (card.kind !== "player") {
    throw new IllegalActionError(
      action,
      state,
      `Boon template ${action.templateId} must mint a player card`,
    );
  }

  // Choices after the current choice.
  const remainingPendingBoonChoices = afterMint.pendingBoonChoices.slice(1);
  // Update the current choice.
  const afterChoice = { ...choice, chooseCount: choice.chooseCount - 1 };
  // Reconstruct the list of choices based on the changes.
  const afterPendingBoonChoices =
    afterChoice.chooseCount > 0
      ? [afterChoice, ...remainingPendingBoonChoices]
      : remainingPendingBoonChoices;

  const dest = choice.bToDiscard ? "playerDiscard" : "hand";
  return {
    state: {
      ...afterMint,
      hand: dest === "hand" ? [...afterMint.hand, card] : afterMint.hand,
      playerDiscard:
        dest === "playerDiscard" ? [card, ...afterMint.playerDiscard] : afterMint.playerDiscard,
      pendingBoonChoices: afterPendingBoonChoices,
    },
    events: [{ type: "BoonCardGranted", cardId: card.id, templateId: card.templateId, dest }],
  };
}

// ---------------------------------------------------------------------------
// reduce — public entry point
// ---------------------------------------------------------------------------

/**
 * Pure reducer: applies an action to a GameState and returns the next state
 * plus the events that occurred.
 *
 * Throws IllegalActionError for any illegal or malformed action.
 */
export function reduce(catalog: CardCatalog, state: GameState, action: Action): ReduceResult {
  if (state.status !== "playing") {
    throw new IllegalActionError(
      action,
      state,
      `Cannot dispatch ${action.type} — game status is '${state.status}'`,
    );
  }

  if (state.pendingBoonChoices.length > 0 && action.type !== "ChooseBoon") {
    throw new IllegalActionError(
      action,
      state,
      `Cannot dispatch ${action.type} while a boon choice is pending`,
    );
  }

  switch (action.type) {
    case "PlayCard":
      return handlePlayCard(catalog, state, action);
    case "DiscardHazard":
      return handleDiscardHazard(catalog, state, action);
    case "EndTurn":
      return handleEndTurn(catalog, state);
    case "ChooseBoon":
      return handleChooseBoon(catalog, state, action);
  }
}
