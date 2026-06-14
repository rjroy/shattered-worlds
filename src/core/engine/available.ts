import type {
  Action,
  AvailableActions,
  CardEffect,
  CardId,
  GameState,
  PlayerCard,
  TargetSpec,
  WorldCard,
} from "../model/types";
import { EFFECTS } from "../effects/registry";
import { effectAtStep } from "../effects/composite";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive the structural TargetSpec for an Effect — the shape the UI needs to
 * present the card — without testing whether the play is legal. Used for
 * Modal branch specs so that each branch always reports its intended spec
 * regardless of current hand state.
 */
function structuralSpec(effect: CardEffect): TargetSpec {
  const h = EFFECTS[effect.kind];
  return h.structuralSpec(effect as never);
}

/**
 * Determine whether a single Effect has a legal play given the current hand.
 *
 * `selfId` is the id of the card being evaluated — used to exclude self from
 * target lists for DiscardThenDraw legality checks.
 */
function isPlayable(effect: CardEffect, state: GameState, selfId: CardId): boolean {
  const h = EFFECTS[effect.kind];
  return h.isPlayable(effect as never, state, selfId);
}

export function structuralSpecOf(effect: CardEffect): TargetSpec {
  return structuralSpec(effect);
}

export function isPlayableOf(effect: CardEffect, state: GameState, selfId: CardId): boolean {
  return isPlayable(effect, state, selfId);
}

/**
 * Returns the structural TargetSpec when the effect is playable given the
 * current hand, or null when the card should be excluded from `playable`.
 * Legality (isPlayable) and spec shape (structuralSpec) each have one home.
 */
function playableSpec(effect: CardEffect, state: GameState, selfId: CardId): TargetSpec | null {
  return isPlayable(effect, state, selfId) ? structuralSpec(effect) : null;
}

// ---------------------------------------------------------------------------
// legalTargets implementation
// ---------------------------------------------------------------------------

/**
 * Resolve concrete target ids for a card at a specific step/branch index.
 * Operates on the current hand state — does not simulate effect application.
 */
function computeLegalTargetsForEffect(
  card: PlayerCard,
  effect: CardEffect,
  state: GameState,
): readonly CardId[] {
  const h = EFFECTS[effect.kind];
  return h.legalTargets(effect as never, card.id, state);
}

function computeLegalTargets(card: PlayerCard, step: number, state: GameState): readonly CardId[] {
  const effect = card.effect;
  const stepEffect =
    effect.kind === "Modal" || effect.kind === "Sequence"
      ? effectAtStep(effect, step)
      : step === 0
        ? effect
        : null;
  return stepEffect === null ? [] : computeLegalTargetsForEffect(card, stepEffect, state);
}

// ---------------------------------------------------------------------------
// checkPlayAction — single validation point for PlayCard actions
// ---------------------------------------------------------------------------

/**
 * Validates the supplementary fields of a PlayCard action against the spec
 * returned by availableActions. Returns null if the action is valid or a
 * human-readable error message if it is not.
 *
 * This lives in available.ts (not in reduce.ts) so that spec-kind knowledge
 * has exactly one home. The reducer calls this and throws on non-null.
 */
export function checkPlayAction(
  available: AvailableActions,
  action: Extract<Action, { type: "PlayCard" }>,
): string | null {
  const entry = available.playable.find((p) => p.cardId === action.cardId);
  if (entry === undefined) {
    return `Card ${action.cardId} is not playable`;
  }

  return checkSpec(entry.spec, action, entry.cardId, available, 0);
}

function checkSpec(
  spec: TargetSpec,
  action: Extract<Action, { type: "PlayCard" }>,
  cardId: CardId,
  available: AvailableActions,
  step: number,
): string | null {
  switch (spec.kind) {
    case "none":
      return null;

    case "hazard": {
      const legal = available.legalTargets(cardId, step);
      if (action.targetId === undefined || !legal.includes(action.targetId)) {
        return `targetId ${action.targetId} is not a legal hazard target for card ${cardId}`;
      }
      return null;
    }

    case "returnWorld": {
      const legal = available.legalTargets(cardId, step);
      const ids = action.returnIds ?? [];
      if (ids.length < spec.min || ids.length > spec.max) {
        return `returnIds count ${ids.length} is outside [${spec.min},${spec.max}] for card ${cardId}`;
      }
      for (const id of ids) {
        if (!legal.includes(id)) {
          return `returnId ${id} is not a legal return target for card ${cardId}`;
        }
      }
      return null;
    }

    case "destroyHand": {
      const length = action.destroyIds === undefined ? 0 : action.destroyIds.length;
      if (length === 0 && spec.min === 0) return null; // min is 0, destruction is optional
      const legal = available.legalTargets(cardId, step);
      if (length === 0 || !legal.some((id) => action.destroyIds?.includes(id))) {
        return `destroyIds ${action.destroyIds} are not a legal destroy target for card ${cardId}`;
      }
      return null;
    }

    case "discardPlayer": {
      const legal = available.legalTargets(cardId, step);
      if (action.discardId === undefined || !legal.includes(action.discardId)) {
        return `discardId ${action.discardId} is not a legal discard target for card ${cardId}`;
      }
      return null;
    }

    case "modal": {
      const choice = action.choice;
      if (choice === undefined || choice < 0 || choice >= spec.branches.length) {
        return `choice ${action.choice} is not a valid branch index for card ${cardId}`;
      }
      return checkSpec(spec.branches[choice]!, action, cardId, available, choice);
    }

    case "compound": {
      for (let i = 0; i < spec.steps.length; i++) {
        const err = checkSpec(spec.steps[i]!, action, cardId, available, i);
        if (err !== null) return err;
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// availableActions — public selector
// ---------------------------------------------------------------------------

/**
 * Pure selector: derives all legal actions from the current GameState.
 * No state mutation; no effects applied.
 *
 * @param state The current game state
 * @param opts.ignoreEnergy When true, skip energy affordability checks (used by loss guard in Step 6)
 */
export function availableActions(
  state: GameState,
  opts?: { ignoreEnergy?: boolean },
): AvailableActions {
  const playable: { cardId: CardId; spec: TargetSpec }[] = [];

  for (const card of state.hand) {
    if (card.kind !== "player") continue;

    // Energy affordability gate: skip if card costs more than current energy,
    // unless ignoreEnergy is explicitly true (used only by loss guard in Step 6).
    if (opts?.ignoreEnergy !== true && card.energyCost > state.energy) {
      continue;
    }

    const spec = playableSpec(card.effect, state, card.id);
    if (spec !== null) {
      playable.push({ cardId: card.id, spec });
    }
  }

  const discardable = state.hand
    .filter((c): c is WorldCard => c.kind === "world" && c.discardable)
    .map((c) => c.id);

  const canEndTurn = state.status === "playing";

  function legalTargets(cardId: CardId, step: number): readonly CardId[] {
    const card = state.hand.find((c) => c.id === cardId);
    if (card === undefined || card.kind !== "player") return [];
    return computeLegalTargets(card, step, state);
  }

  return { playable, discardable, canEndTurn, legalTargets };
}
