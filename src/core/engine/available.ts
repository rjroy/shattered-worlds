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
import { effectivePlayerCard } from "./effectiveCards";

type TargetPathSegment =
  | { kind: "step"; index: number }
  | { kind: "branch"; index: number };

type LegalTargetsAtPath = (
  cardId: CardId,
  path: readonly TargetPathSegment[],
) => readonly CardId[];

const legalTargetsAtPathByAvailable = new WeakMap<AvailableActions, LegalTargetsAtPath>();

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

function computeLegalTargets(
  card: PlayerCard,
  step: number,
  state: GameState,
  choice?: number,
): readonly CardId[] {
  if (choice !== undefined) {
    return computeLegalTargetsAtPath(
      card,
      [
        { kind: "step", index: step },
        { kind: "branch", index: choice },
      ],
      state,
    );
  }

  const effect = card.effect;
  const stepEffect =
    effect.kind === "Modal" || effect.kind === "Sequence"
      ? effectAtStep(effect, step)
      : step === 0
        ? effect
        : null;
  return stepEffect === null ? [] : computeLegalTargetsForEffect(card, stepEffect, state);
}

function computeLegalTargetsAtPath(
  card: PlayerCard,
  path: readonly TargetPathSegment[],
  state: GameState,
): readonly CardId[] {
  const effect = effectAtPath(card.effect, path);
  return effect === null ? [] : computeLegalTargetsForEffect(card, effect, state);
}

function effectAtPath(
  effect: CardEffect,
  path: readonly TargetPathSegment[],
): CardEffect | null {
  let current: CardEffect | null = effect;

  for (const segment of path) {
    if (current === null) return null;
    if (segment.kind === "step") {
      current = current.kind === "Sequence" ? (current.steps[segment.index] ?? null) : null;
    } else {
      current = current.kind === "Modal" ? (current.branches[segment.index] ?? null) : null;
    }
  }

  return current;
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

  return checkSpec(entry.spec, action, entry.cardId, available, []);
}

function checkSpec(
  spec: TargetSpec,
  action: Extract<Action, { type: "PlayCard" }>,
  cardId: CardId,
  available: AvailableActions,
  path: readonly TargetPathSegment[],
): string | null {
  switch (spec.kind) {
    case "none":
      return null;

    case "hazard": {
      const legal = legalTargetsForCheck(available, cardId, path);
      if (action.targetId === undefined || !legal.includes(action.targetId)) {
        return `targetId ${action.targetId} is not a legal hazard target for card ${cardId}`;
      }
      return null;
    }

    case "returnWorld": {
      const legal = legalTargetsForCheck(available, cardId, path);
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
      const legal = legalTargetsForCheck(available, cardId, path);
      if (length === 0 || !legal.some((id) => action.destroyIds?.includes(id))) {
        return `destroyIds ${action.destroyIds} are not a legal destroy target for card ${cardId}`;
      }
      return null;
    }

    case "thawHand": {
      const ids = action.thawIds ?? [];
      if (ids.length === 0 || ids.length > spec.amount) {
        return `thawIds count ${ids.length} is outside [1,${spec.amount}] for card ${cardId}`;
      }
      const legal = legalTargetsForCheck(available, cardId, path);
      for (const id of ids) {
        if (!legal.includes(id)) {
          return `thawId ${id} is not a legal thaw target for card ${cardId}`;
        }
      }
      return null;
    }

    case "discardPlayer": {
      const legal = legalTargetsForCheck(available, cardId, path);
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
      return checkSpec(spec.branches[choice]!, action, cardId, available, [
        ...path,
        { kind: "branch", index: choice },
      ]);
    }

    case "compound": {
      for (let i = 0; i < spec.steps.length; i++) {
        const err = checkSpec(spec.steps[i]!, action, cardId, available, [
          ...path,
          { kind: "step", index: i },
        ]);
        if (err !== null) return err;
      }
      return null;
    }
  }
}

function legalTargetsForCheck(
  available: AvailableActions,
  cardId: CardId,
  path: readonly TargetPathSegment[],
): readonly CardId[] {
  const legalTargetsAtPath = legalTargetsAtPathByAvailable.get(available);
  if (legalTargetsAtPath !== undefined) return legalTargetsAtPath(cardId, path);

  const fallback = fallbackPublicSelector(path);
  return available.legalTargets(cardId, fallback.step, fallback.choice);
}

function fallbackPublicSelector(path: readonly TargetPathSegment[]): {
  step: number;
  choice?: number;
} {
  const topLevel = path[0];
  if (topLevel === undefined) return { step: 0 };

  if (topLevel.kind === "branch") {
    return { step: topLevel.index };
  }

  const branch = path[1];
  if (branch?.kind === "branch") {
    return { step: topLevel.index, choice: branch.index };
  }

  return { step: topLevel.index };
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
  if (state.pendingBoonChoices.length > 0) {
    return {
      playable: [],
      discardable: [],
      canEndTurn: false,
      legalTargets: () => [],
    };
  }

  const playable: { cardId: CardId; spec: TargetSpec }[] = [];

  for (const card of state.hand) {
    if (card.kind !== "player") continue;
    if ((card.frozen ?? 0) > 0) continue;
    const effectiveCard = effectivePlayerCard(card, state);

    // Energy affordability gate: skip if card costs more than current energy,
    // unless ignoreEnergy is explicitly true (used only by loss guard in Step 6).
    if (opts?.ignoreEnergy !== true && effectiveCard.energyCost > state.energy) {
      continue;
    }

    const spec = playableSpec(effectiveCard.effect, state, effectiveCard.id);
    if (spec !== null) {
      playable.push({ cardId: effectiveCard.id, spec });
    }
  }

  const discardable = state.hand
    .filter((c): c is WorldCard => c.kind === "world" && c.discardable)
    .map((c) => c.id);

  const canEndTurn = state.status === "playing";

  function legalTargets(cardId: CardId, step: number, choice?: number): readonly CardId[] {
    const card = state.hand.find((c) => c.id === cardId);
    if (card === undefined || card.kind !== "player") return [];
    return computeLegalTargets(effectivePlayerCard(card, state), step, state, choice);
  }

  const result: AvailableActions = { playable, discardable, canEndTurn, legalTargets };
  legalTargetsAtPathByAvailable.set(result, (cardId, path) => {
    const card = state.hand.find((c) => c.id === cardId);
    if (card === undefined || card.kind !== "player") return [];
    return computeLegalTargetsAtPath(effectivePlayerCard(card, state), path, state);
  });

  return result;
}
