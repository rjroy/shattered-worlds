import type { Action, CardId, GameState, TargetSpec } from "../core/model/types";
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

/**
 * Build the action for a single modal branch, mirroring the per-kind field
 * builders of {@link buildPlayAction} but with `branchIdx` as the target path and
 * `choice` set. Returns `null` when the branch has no admissible selection (e.g.
 * a `thawHand`/`destroyHand` branch with too few legal targets), so the modal
 * loop can skip it — the available selector guarantees at least one branch is
 * legal. Nested `modal`/`compound` branches are not expected and fall back to a
 * bare choice rather than recursing.
 */
function buildModalBranch(
  base: PlayCardFields,
  cardId: CardId,
  branchIdx: number,
  branchSpec: TargetSpec,
  nameById: ReadonlyMap<CardId, string>,
  legalTargets: (cardId: CardId, step: number) => readonly CardId[],
  rng: Rng,
): PlayCardFields | null {
  // For a TOP-LEVEL modal, `legalTargets` resolves branch targets at
  // (cardId, branchIdx). A modal nested inside a compound passes an adapted
  // callback that resolves at (cardId, stepIdx, branchIdx) instead — see
  // `pickModalBranch`'s call site in the compound handler.
  const withChoice: PlayCardFields = { ...base, choice: branchIdx };

  switch (branchSpec.kind) {
    case "none":
    case "modal":
    case "compound":
      return withChoice;

    case "hazard": {
      const targets = legalTargets(cardId, branchIdx);
      if (targets.length === 0) return null;
      return {
        ...withChoice,
        targetId: priorityTarget(targets, nameById) ?? pick(targets, rng),
      };
    }

    case "discardPlayer": {
      const targets = legalTargets(cardId, branchIdx);
      if (targets.length === 0) return null;
      return { ...withChoice, discardId: pick(targets, rng) };
    }

    case "destroyHand": {
      const targets = legalTargets(cardId, branchIdx);
      if (targets.length < branchSpec.min) return null;
      const count = Math.min(pickCount(branchSpec.min, branchSpec.max, rng), targets.length);
      return { ...withChoice, destroyIds: pickSubset(targets, count, rng) };
    }

    case "thawHand": {
      const targets = legalTargets(cardId, branchIdx);
      if (targets.length < 1) return null;
      const count = Math.min(pickCount(1, branchSpec.amount, rng), targets.length);
      return { ...withChoice, thawIds: pickSubset(targets, count, rng) };
    }

    case "returnWorld": {
      const targets = legalTargets(cardId, branchIdx);
      // A min > 0 return with too few targets has no admissible selection:
      // clamping the count below `min` would emit an illegal short returnIds
      // (checkPlayAction rejects it), so skip the branch instead.
      if (targets.length < branchSpec.min) return null;
      const count = Math.min(pickCount(branchSpec.min, branchSpec.max, rng), targets.length);
      return { ...withChoice, returnIds: pickSubset(targets, count, rng) };
    }

    case "recallTarget": {
      const targets = legalTargets(cardId, branchIdx);
      // Same admissibility rule as returnWorld above.
      if (targets.length < branchSpec.min) return null;
      const count = Math.min(pickCount(branchSpec.min, branchSpec.max, rng), targets.length);
      return { ...withChoice, recallIds: pickSubset(targets, count, rng) };
    }
  }
}

/**
 * Walk a modal spec's branches in random order and return the first one with
 * an admissible selection, or `null` when none has one. `targetsFor` resolves
 * a branch's legal targets: top-level modals resolve at (cardId, branchIdx),
 * modals nested inside a compound at (cardId, stepIdx, branchIdx) via an
 * adapter closure. Both call sites layer their own fallback on a `null`.
 */
function pickModalBranch(
  base: PlayCardFields,
  cardId: CardId,
  branches: readonly TargetSpec[],
  nameById: ReadonlyMap<CardId, string>,
  targetsFor: (cardId: CardId, branchIdx: number) => readonly CardId[],
  rng: Rng,
): PlayCardFields | null {
  const indices = [...branches.keys()];
  // Shuffle indices in-place
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }

  for (const branchIdx of indices) {
    const branchSpec = branches[branchIdx]!;
    const branchAction = buildModalBranch(
      base,
      cardId,
      branchIdx,
      branchSpec,
      nameById,
      targetsFor,
      rng,
    );
    // null means the branch has no admissible selection; try the next one.
    if (branchAction !== null) return branchAction;
  }

  return null;
}

/**
 * Build a complete PlayCard action for `cardId`, or return `null` when the card
 * has no admissible play for its spec (e.g. a mandatory `destroyHand` with fewer
 * legal targets than `min`). A `null` result means the card must be omitted from
 * enumeration; `buildLegalActions` skips it.
 */
function buildPlayAction(
  cardId: CardId,
  spec: TargetSpec,
  nameById: ReadonlyMap<CardId, string>,
  legalTargets: (cardId: CardId, step: number, choice?: number) => readonly CardId[],
  rng: Rng,
): PlayCardFields | null {
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
      const targets = legalTargets(cardId, 0);
      // When min > 0 the destroy is mandatory: core's checkPlayAction
      // (available.ts) rejects an empty/short selection. `isPlayable` gates on
      // playerCardsInHand > min, but `legalTargets` further excludes self and
      // non-destroyable cards, so a card can be "playable" with fewer than `min`
      // legal targets. In that case there is no admissible play for this effect,
      // so exclude the card from enumeration entirely (return null) rather than
      // emit an illegal action.
      if (targets.length < spec.min) return null;
      // min === 0: destruction is optional. Flip a coin to skip.
      if (spec.min === 0 && rng() < 0.5) return base;
      const count = Math.min(pickCount(spec.min, spec.max, rng), targets.length);
      const chosen = pickSubset(targets, count, rng);
      return { ...base, destroyIds: chosen };
    }

    case "thawHand": {
      const targets = legalTargets(cardId, 0);
      // thawHand's implicit minimum is 1 (checkPlayAction rejects an empty
      // thawIds). As with destroyHand, a card can be "playable" while having no
      // legal thaw targets (e.g. nothing frozen), so there is no admissible play
      // — exclude it from enumeration rather than emit an illegal empty action.
      if (targets.length < 1) return null;
      const count = Math.min(pickCount(1, spec.amount, rng), targets.length);
      const chosen = pickSubset(targets, count, rng);
      return { ...base, thawIds: chosen };
    }

    case "returnWorld": {
      const targets = legalTargets(cardId, 0);
      const count = Math.min(pickCount(spec.min, spec.max, rng), targets.length);
      const chosen = pickSubset(targets, count, rng);
      return { ...base, returnIds: chosen };
    }

    case "recallTarget": {
      const targets = legalTargets(cardId, 0);
      const count = Math.min(pickCount(spec.min, spec.max, rng), targets.length);
      const chosen = pickSubset(targets, count, rng);
      return { ...base, recallIds: chosen };
    }

    case "modal": {
      // Pick a random branch, weighted equally: walk branches in random order
      // and keep the first with an admissible selection.
      const action = pickModalBranch(base, cardId, spec.branches, nameById, legalTargets, rng);
      // Fallback: pick first branch (available guarantees at least one is legal)
      return action ?? { ...base, choice: 0 };
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
          const count = Math.min(pickCount(stepSpec.min, stepSpec.max, rng), targets.length);
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, returnIds: chosen };
        } else if (stepSpec.kind === "recallTarget") {
          const targets = legalTargets(cardId, stepIdx);
          const count = Math.min(pickCount(stepSpec.min, stepSpec.max, rng), targets.length);
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, recallIds: chosen };
        } else if (stepSpec.kind === "destroyHand") {
          const targets = legalTargets(cardId, stepIdx);
          // Same admissibility rule as the standalone destroyHand branch: a
          // min > 0 step with fewer than `min` legal targets has no admissible
          // selection, so the whole compound action is inadmissible and the card
          // is excluded from enumeration.
          if (targets.length < stepSpec.min) return null;
          const count = Math.min(pickCount(stepSpec.min, stepSpec.max, rng), targets.length);
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, destroyIds: chosen };
        } else if (stepSpec.kind === "thawHand") {
          const targets = legalTargets(cardId, stepIdx);
          // Same admissibility rule as the standalone thawHand branch: a step
          // with no legal thaw target has no admissible selection (min is 1), so
          // the whole compound action is inadmissible and the card is excluded.
          if (targets.length < 1) return null;
          const count = Math.min(pickCount(1, stepSpec.amount, rng), targets.length);
          const chosen = pickSubset(targets, count, rng);
          action = { ...action, thawIds: chosen };
        } else if (stepSpec.kind === "modal") {
          // A modal nested inside a compound (e.g. a Sequence whose first step
          // is a Modal, like the panic-response unlock's rewritten Panic).
          // checkPlayAction demands `choice` for this step, so the top-level
          // "handled elsewhere" shortcut does not apply here. Branch targets
          // resolve at (stepIdx, branchIdx); the adapter closure carries the
          // step. No admissible branch means the whole compound play is
          // inadmissible — exclude the card rather than emit an illegal action.
          const withBranch = pickModalBranch(
            action,
            cardId,
            stepSpec.branches,
            nameById,
            (id, branchIdx) => legalTargets(id, stepIdx, branchIdx),
            rng,
          );
          if (withBranch === null) return null;
          action = withBranch;
        }
        // 'none': no supplementary fields needed
      }

      return action;
    }
  }
}

// ---------------------------------------------------------------------------
// Legal-action enumeration (shared) and the policies that build on it
// ---------------------------------------------------------------------------

/**
 * Build the full legal-action list for `state`, given a `nameById` lookup that
 * `buildPlayAction` uses for its card-name target preference. Boon-pending
 * states enumerate their offered `ChooseBoon` options; otherwise the playable,
 * discardable, and end-turn actions are listed in that fixed order.
 *
 * Splitting `nameById` out as a parameter is what lets both the name-steered
 * `pickAction` and the name-free `enumerateActions` share one builder while
 * consuming `rng` identically (see `enumerateActions`).
 */
function buildLegalActions(
  state: GameState,
  nameById: ReadonlyMap<CardId, string>,
  rng: Rng,
): Action[] {
  const pendingBoonChoice = state.pendingBoonChoices[0];
  if (pendingBoonChoice !== undefined) {
    return pendingBoonChoice.offeredTemplateIds.map(
      (templateId): Action => ({ type: "ChooseBoon", templateId }),
    );
  }

  const available = availableActions(state);
  const actions: Action[] = [];

  for (const { cardId, spec } of available.playable) {
    const action = buildPlayAction(cardId, spec, nameById, available.legalTargets, rng);
    // null means the card has no admissible play for its spec (see
    // buildPlayAction); omit it so enumeration agrees with checkPlayAction.
    if (action !== null) actions.push(action);
  }

  for (const cardId of available.discardable) {
    actions.push({ type: "DiscardHazard", cardId });
  }

  if (available.canEndTurn) {
    actions.push({ type: "EndTurn" });
  }

  return actions;
}

// A shared empty lookup for the name-free enumeration. With no entries,
// buildPlayAction's priorityTarget never matches, so target selection falls
// through to a uniform random pick — no card-name steering can leak out.
const EMPTY_NAME_MAP: ReadonlyMap<CardId, string> = new Map();

/**
 * The FULL, UN-PRIORITIZED legal action list for `state` (every action
 * `availableActions` admits, plus `ChooseBoon` options when a boon is pending).
 *
 * Name-free by construction (REQ-SCC-4): it passes an empty `nameById`, so
 * `buildPlayAction` never applies its card-name target preference and no
 * card-name steering reaches the caller (e.g. the eval policy). The card-name
 * *selection* logic lives only in `pickAction`, not here.
 *
 * `rng` is consumed only to fill in random targets/branches for playable cards,
 * exactly as `buildLegalActions` does for `pickAction`.
 */
export function enumerateActions(state: GameState, rng: Rng): Action[] {
  return buildLegalActions(state, EMPTY_NAME_MAP, rng);
}

/**
 * A decision function: given a (player-honest) `view` of the game and a random
 * source, return the action to take. The runner is responsible for handing the
 * policy a determinized snapshot and applying the chosen action to the real
 * state — the policy itself never sees, and so cannot cheat on, hidden info it
 * isn't shown. `rng` stays in `() => number` closure form; the runner owns the
 * bridge from the pure `RngState` it threads to this closure.
 */
export type Policy = (view: GameState, rng: Rng) => Action;

/**
 * Selects a legal action, biased toward the world objective by card name and
 * otherwise uniformly random. All randomness goes through `rng` — the game state
 * RNG is unaffected. Pass `() => Math.random()` for live play, or a seeded
 * closure for tests.
 *
 * It builds the legal list with the REAL `nameById` (so `buildPlayAction`'s
 * target preference applies) and then layers its own card-name *selection* on
 * top. The `rng` consumption is identical to the pre-refactor inline version:
 * the build loop consumes the same values in the same order, and the final
 * uniform `pick` (including the boon path, where no objective ever matches)
 * consumes exactly one value — so the random stream is byte-for-byte preserved.
 */
export function pickAction(state: GameState, rng: Rng): Action {
  const nameById = new Map(state.hand.map((card) => [card.id, card.name]));
  const actions = buildLegalActions(state, nameById, rng);

  if (actions.length === 0) {
    // Should not happen in a valid 'playing' state, but safe fallback.
    return { type: "EndTurn" };
  }

  const objectiveAction =
    actions.find(
      (action) => action.type === "DiscardHazard" && nameById.get(action.cardId) === "The Walker",
    ) ??
    actions.find(
      (action) => action.type === "PlayCard" && nameById.get(action.targetId ?? "") === "Door",
    ) ??
    actions.find(
      (action) => action.type === "PlayCard" && nameById.get(action.cardId) === "Summon Door",
    ) ??
    actions.find(
      (action) =>
        action.type === "PlayCard" && nameById.get(action.targetId ?? "") === "The Walker",
    );

  if (objectiveAction !== undefined) return objectiveAction;

  return pick(actions, rng);
}

/**
 * The baseline policy: `pickAction` exactly. It ignores hidden information
 * entirely (it only ever reads the hand, resources, and the live board), so it
 * plays identically whether handed the real state or a determinized snapshot —
 * which is precisely why the seam is behavior-preserving for it.
 */
export const randomPolicy: Policy = pickAction;
