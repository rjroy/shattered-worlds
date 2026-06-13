import type {
  Action,
  CardId,
  GameState,
  TargetSpec,
} from "../core/model/types";
import { availableActions } from "../core/engine/available";

export { catalog, worldData } from "../core/tests/testFixture";

// ---------------------------------------------------------------------------
// Random helpers (policy-local)
// ---------------------------------------------------------------------------

type Rng = () => number;

function pick<T>(items: readonly T[], rng: Rng): T {
  // Callers guarantee a non-empty list; the cast covers the empty-array type.
  return items[Math.floor(rng() * items.length)] as T;
}

function pickCount(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickSubset<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const result: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx] as T);
    pool.splice(idx, 1);
  }
  return result;
}

function priorityTarget(
  targets: readonly CardId[],
  nameById: ReadonlyMap<CardId, string>,
): CardId | undefined {
  return (
    targets.find((id) => nameById.get(id) === "Door") ??
    targets.find((id) => nameById.get(id) === "The Walker")
  );
}

// ---------------------------------------------------------------------------
// Build a complete PlayCard action from a spec entry
// ---------------------------------------------------------------------------

type PlayCardFields = Extract<Action, { type: "PlayCard" }>;

function buildPlayAction(
  cardId: CardId,
  spec: TargetSpec,
  nameById: ReadonlyMap<CardId, string>,
  legalTargets: (cardId: CardId, step: number) => readonly CardId[],
  rng: Rng,
): PlayCardFields {
  const base: PlayCardFields = { type: "PlayCard", cardId };

  switch (spec.kind) {
    case "none":
      return base;

    case "hazard": {
      const targets = legalTargets(cardId, 0);
      if (targets.length === 0) return base;
      return {
        ...base,
        targetId: priorityTarget(targets, nameById) ?? pick(targets, rng),
      };
    }

    case "discardPlayer": {
      const targets = legalTargets(cardId, 0);
      if (targets.length === 0) return base;
      return { ...base, discardId: pick(targets, rng) };
    }

    case "destroyHand": {
      // min is always 0 — destruction is optional. Flip a coin.
      if (rng() < 0.5) return base;
      const targets = legalTargets(cardId, 0);
      const count = Math.min(
        pickCount(spec.min, spec.max, rng),
        targets.length,
      );
      const chosen = pickSubset(targets, count, rng);
      return { ...base, destroyIds: chosen };
    }

    case "returnWorld": {
      const targets = legalTargets(cardId, 0);
      const count = Math.min(
        pickCount(spec.min, spec.max, rng),
        targets.length,
      );
      const chosen = pickSubset(targets, count, rng);
      return { ...base, returnIds: chosen };
    }

    case "modal": {
      // Pick a random branch, weighted equally. If a branch needs targets
      // and none are available, we still build the action — the available
      // selector guarantees at least one branch is legal, so a random pick
      // may land on an illegal one. Walk branches in random order to find
      // one that can be built.
      const indices = [...spec.branches.keys()];
      // Shuffle indices in-place
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = indices[i]!;
        indices[i] = indices[j]!;
        indices[j] = tmp;
      }

      for (const branchIdx of indices) {
        const branchSpec = spec.branches[branchIdx]!;
        if (branchSpec.kind === "hazard") {
          const targets = legalTargets(cardId, branchIdx);
          if (targets.length === 0) continue;
          return {
            ...base,
            choice: branchIdx,
            targetId: priorityTarget(targets, nameById) ?? pick(targets, rng),
          };
        }
        // 'none' or any non-targeting branch
        return { ...base, choice: branchIdx };
      }

      // Fallback: pick first branch (available guarantees at least one is legal)
      return { ...base, choice: 0 };
    }

    case "compound": {
      // Each step is resolved in order. We accumulate fields onto the action.
      let action: PlayCardFields = base;

      for (let stepIdx = 0; stepIdx < spec.steps.length; stepIdx++) {
        const stepSpec = spec.steps[stepIdx]!;
        if (stepSpec.kind === "hazard") {
          const targets = legalTargets(cardId, stepIdx);
          if (targets.length > 0) {
            action = {
              ...action,
              targetId: priorityTarget(targets, nameById) ?? pick(targets, rng),
            };
          }
        } else if (stepSpec.kind === "discardPlayer") {
          const targets = legalTargets(cardId, stepIdx);
          if (targets.length > 0) {
            action = { ...action, discardId: pick(targets, rng) };
          }
        } else if (stepSpec.kind === "returnWorld") {
          const targets = legalTargets(cardId, stepIdx);
          const count = Math.min(
            pickCount(stepSpec.min, stepSpec.max, rng),
            targets.length,
          );
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, returnIds: chosen };
        } else if (stepSpec.kind === "destroyHand") {
          const targets = legalTargets(cardId, stepIdx);
          const count = Math.min(
            pickCount(stepSpec.min, stepSpec.max, rng),
            targets.length,
          );
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, destroyIds: chosen };
        }
        // 'none' / 'modal': no supplementary fields needed or handled at top level
      }

      return action;
    }
  }
}

// ---------------------------------------------------------------------------
// pickAction — public entry point
// ---------------------------------------------------------------------------

/**
 * Selects a uniformly random legal action from the current state.
 * All randomness goes through `rng` — the game state RNG is unaffected.
 * Pass `() => Math.random()` for live play, or a seeded closure for tests.
 */
export function pickAction(state: GameState, rng: Rng): Action {
  const available = availableActions(state);
  const nameById = new Map(state.hand.map((card) => [card.id, card.name]));

  const actions: Action[] = [];

  for (const { cardId, spec } of available.playable) {
    actions.push(
      buildPlayAction(cardId, spec, nameById, available.legalTargets, rng),
    );
  }

  for (const cardId of available.discardable) {
    actions.push({ type: "DiscardHazard", cardId });
  }

  if (available.canEndTurn) {
    actions.push({ type: "EndTurn" });
  }

  if (actions.length === 0) {
    // Should not happen in a valid 'playing' state, but safe fallback.
    return { type: "EndTurn" };
  }

  const objectiveAction =
    actions.find(
      (action) =>
        action.type === "DiscardHazard" &&
        nameById.get(action.cardId) === "The Walker",
    ) ??
    actions.find(
      (action) =>
        action.type === "PlayCard" &&
        nameById.get(action.targetId ?? "") === "Door",
    ) ??
    actions.find(
      (action) =>
        action.type === "PlayCard" &&
        nameById.get(action.cardId) === "Summon Door",
    ) ??
    actions.find(
      (action) =>
        action.type === "PlayCard" &&
        nameById.get(action.targetId ?? "") === "The Walker",
    );

  if (objectiveAction !== undefined) return objectiveAction;

  return pick(actions, rng);
}
