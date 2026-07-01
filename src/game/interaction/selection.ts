/**
 * Renderer-only selection state machine.
 *
 * Tracks the multi-step targeting process (idle → awaiting-modal → targeting
 * → complete) without touching GameState. When a selection is complete,
 * `buildAction` emits a finished Action for dispatch.
 *
 * Key invariant: the `steps` array is NEVER stripped of 'none' entries.
 * stepIdx stays 1:1 with the core's Sequence.steps indices so that
 * legalTargets(cardId, step) receives the correct step number.
 */
import type { Action, CardId, TargetSpec } from "../../core/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepResult =
  | { kind: "hazard"; targetId: CardId }
  | { kind: "destroyHand"; destroyIds: readonly CardId[] } // undefined = skipped optional destroy
  | { kind: "thawHand"; thawIds: readonly CardId[] }
  | { kind: "returnWorld"; returnIds: readonly CardId[] }
  | { kind: "recallTarget"; recallIds: readonly CardId[] } // discard-recall chooser; [] = optional skip
  | { kind: "discardPlayer"; discardId: CardId };

export type SelectionState =
  | { phase: "idle" }
  | { phase: "awaiting-modal"; cardId: CardId }
  | {
      phase: "targeting";
      cardId: CardId;
      choice?: number; // modal branch index, when entered through a modal
      steps: readonly TargetSpec[]; // NEVER stripped — indices stay 1:1 with core's Sequence.steps
      stepIdx: number; // stepIdx === steps.length => complete
      done: readonly StepResult[]; // completed step results, in order
      current: readonly CardId[]; // picks accumulating for steps[stepIdx]
    };

export const IDLE: SelectionState = { phase: "idle" };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Empty-pile / min:0 flow for the recall chooser (REQ-TIDAL-14):
 *
 * The recall chooser targets cards in `playerDiscard`, which this pure state
 * machine cannot see (it has no GameState). So the EMPTY-PILE auto-skip is the
 * scene's job, not this module's: the scene checks `legalTargets` for the
 * recall step and, when the discard pile is empty AND `min === 0` (e.g. Shelf
 * Map), advances the step immediately with no picks — folding a `recallIds: []`
 * StepResult and committing without ever opening an empty chooser. When `min > 0`
 * and the pile is empty the card is already unplayable (core's
 * ReturnPlayerDiscardToTopHandler.isPlayable), so targeting never begins. With a
 * non-empty pile the scene opens the chooser, which enforces min/max and offers
 * a "confirm 0 / done" affordance for the min:0 case. This module only models
 * the resulting picks; it never special-cases empty legal-target sets, keeping
 * it identical to the returnWorld flow it mirrors.
 */

/** "1" when min === max, otherwise "min–max" — for chooser hint text. */
function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

/** Advance stepIdx past any consecutive 'none' steps starting at `idx`. */
function skipNoneSteps(steps: readonly TargetSpec[], idx: number): number {
  let i = idx;
  while (i < steps.length && steps[i]?.kind === "none") {
    i++;
  }
  return i;
}

/** Effective min for a leaf TargetSpec. */
function stepMin(spec: TargetSpec): number {
  switch (spec.kind) {
    case "hazard":
      return 1;
    case "discardPlayer":
      return 1;
    case "destroyHand":
      return spec.min;
    case "thawHand":
      return 1;
    case "returnWorld":
      return spec.min;
    case "recallTarget":
      return spec.min;
    default:
      return 0;
  }
}

/** Effective max for a leaf TargetSpec. */
export function stepMax(spec: TargetSpec): number {
  switch (spec.kind) {
    case "hazard":
      return 1;
    case "discardPlayer":
      return 1;
    case "destroyHand":
      return spec.max;
    case "thawHand":
      return spec.amount;
    case "returnWorld":
      return spec.max;
    case "recallTarget":
      return spec.max;
    default:
      return 0;
  }
}

export function doesStepResultContain(result: StepResult, target: CardId): boolean {
  switch (result.kind) {
    case "hazard":
      return result.targetId === target;
    case "destroyHand":
      return result.destroyIds.includes(target);
    case "thawHand":
      return result.thawIds.includes(target);
    case "returnWorld":
      return result.returnIds.includes(target);
    case "recallTarget":
      return result.recallIds.includes(target);
    case "discardPlayer":
      return result.discardId === target;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/**
 * Begin a targeting sequence for `cardId` given a TargetSpec.
 *
 * - compound: uses spec.steps as-is (no stripping)
 * - none: immediately complete (empty steps array)
 * - leaf specs: wrapped in a single-element array
 *
 * Leading 'none' steps are skipped via stepIdx advancement.
 * If the result is already complete (stepIdx === steps.length), returns it
 * as-is so the caller can dispatch immediately.
 */
export function beginTargeting(cardId: CardId, spec: TargetSpec, choice?: number): SelectionState {
  let steps: readonly TargetSpec[];

  if (spec.kind === "compound") {
    steps = [...spec.steps];
  } else if (spec.kind === "none") {
    steps = [];
  } else if (spec.kind === "modal") {
    // Modal is handled by chooseModal; falling through here would be misuse.
    // Treat as immediate-idle (no-op).
    return IDLE;
  } else {
    steps = [spec];
  }

  // Warn in dev if the same non-none kind appears more than once (mirrors
  // core's checkSpec constraint).
  if (process.env.NODE_ENV !== "production") {
    const seen = new Set<string>();
    for (const s of steps) {
      if (s.kind !== "none") {
        if (seen.has(s.kind)) {
          console.warn(`[selection] duplicate step kind "${s.kind}" in steps array`);
        }
        seen.add(s.kind);
      }
    }
  }

  const stepIdx = skipNoneSteps(steps, 0);

  const state: SelectionState = {
    phase: "targeting",
    cardId,
    steps,
    stepIdx,
    done: [],
    current: [],
  };

  if (choice !== undefined) {
    return { ...state, choice };
  }

  return state;
}

/**
 * From awaiting-modal, advance to the appropriate targeting state based on
 * the chosen branch.
 *
 * Returns sel unchanged if not in awaiting-modal phase or if the branch index
 * is out of range.
 */
export function chooseModal(
  sel: SelectionState,
  choice: number,
  spec: Extract<TargetSpec, { kind: "modal" }>,
): SelectionState {
  const branch = spec.branches[choice];
  if (branch === undefined) return sel;

  if (sel.phase === "awaiting-modal") {
    return beginTargeting(sel.cardId, branch, choice);
  }

  if (sel.phase !== "targeting") return sel;
  if (sel.stepIdx >= sel.steps.length) return sel;
  if (sel.steps[sel.stepIdx]?.kind !== "modal") return sel;

  const steps = [...sel.steps];
  steps[sel.stepIdx] = branch;
  return {
    ...sel,
    choice,
    steps,
    stepIdx: skipNoneSteps(steps, sel.stepIdx),
    current: [],
  };
}

export function activeModalStep(
  sel: SelectionState,
): Extract<TargetSpec, { kind: "modal" }> | null {
  if (sel.phase !== "targeting" || sel.stepIdx >= sel.steps.length) return null;
  const step = sel.steps[sel.stepIdx];
  return step?.kind === "modal" ? step : null;
}

/**
 * Add or remove a pick from the current step's accumulator.
 *
 * - If `id` is already in current: removes it (toggle off)
 * - If not in current: adds it, subject to the step's max cap
 * - For single-pick steps (max===1), adding when at max replaces the existing pick
 * - Only works in targeting phase; returns sel unchanged otherwise
 */
export function togglePick(sel: SelectionState, id: CardId): SelectionState {
  if (sel.phase !== "targeting") return sel;
  if (sel.stepIdx >= sel.steps.length) return sel;

  // Bounds checked above; cast is safe
  const step = sel.steps[sel.stepIdx] as TargetSpec;
  const current = sel.current;

  if (current.includes(id)) {
    // Toggle off
    return { ...sel, current: current.filter((c) => c !== id) };
  }

  const max = stepMax(step);

  if (current.length >= max) {
    if (max === 1) {
      // Replace the single pick
      return { ...sel, current: [id] };
    }
    // At capacity and multi-pick — do nothing
    return sel;
  }

  return { ...sel, current: [...current, id] };
}

/**
 * Fold the current picks into a StepResult, append it to done, advance
 * stepIdx (skipping any subsequent 'none' steps), and reset current to [].
 *
 * If stepIdx is already at or past steps.length, returns sel unchanged (the
 * caller should check isComplete first).
 */
export function advance(sel: SelectionState): SelectionState {
  if (sel.phase !== "targeting") return sel;
  if (sel.stepIdx >= sel.steps.length) return sel;

  // Bounds checked above; cast is safe
  const step = sel.steps[sel.stepIdx] as TargetSpec;
  const current = sel.current;

  let result: StepResult;

  switch (step.kind) {
    case "hazard":
      result = { kind: "hazard", targetId: current[0] as CardId };
      break;
    case "discardPlayer":
      result = { kind: "discardPlayer", discardId: current[0] as CardId };
      break;
    case "destroyHand":
      result = { kind: "destroyHand", destroyIds: [...current] };
      break;
    case "thawHand":
      result = { kind: "thawHand", thawIds: [...current] };
      break;
    case "returnWorld":
      result = { kind: "returnWorld", returnIds: [...current] };
      break;
    case "recallTarget":
      result = { kind: "recallTarget", recallIds: [...current] };
      break;
    default:
      // 'none' steps should never reach advance() (they are skipped by
      // skipNoneSteps), but guard defensively.
      return sel;
  }

  const nextRaw = sel.stepIdx + 1;
  const nextIdx = skipNoneSteps(sel.steps, nextRaw);

  return {
    ...sel,
    done: [...sel.done, result],
    stepIdx: nextIdx,
    current: [],
  };
}

/** Cancel from any state — always returns idle. */
export function cancel(): SelectionState {
  return IDLE;
}

// ---------------------------------------------------------------------------
// Read-models (pure derivations)
// ---------------------------------------------------------------------------

/**
 * True when the current step will auto-advance after a single pick (max===1
 * and current already has 1 pick).
 *
 * Used by the renderer to skip the confirm button for exact-count steps.
 */
export function autoAdvances(sel: SelectionState): boolean {
  if (sel.phase !== "targeting") return false;
  if (sel.stepIdx >= sel.steps.length) return false;
  const step = sel.steps[sel.stepIdx] as TargetSpec;
  return stepMax(step) === 1 && sel.current.length === 1;
}

/**
 * True when the current step is variable-length (min !== max), meaning the
 * player needs an explicit confirm button to proceed.
 */
export function needsConfirm(sel: SelectionState): boolean {
  if (sel.phase !== "targeting") return false;
  if (sel.stepIdx >= sel.steps.length) return false;
  const step = sel.steps[sel.stepIdx] as TargetSpec;
  return stepMin(step) !== stepMax(step);
}

/**
 * True when the current picks satisfy the minimum for the current step.
 * Optional steps (min===0) are always satisfied.
 */
export function stepSatisfied(sel: SelectionState): boolean {
  if (sel.phase !== "targeting") return false;
  if (sel.stepIdx >= sel.steps.length) return false;
  const step = sel.steps[sel.stepIdx] as TargetSpec;
  return sel.current.length >= stepMin(step);
}

/** True when all steps have been completed. */
export function isComplete(sel: SelectionState): boolean {
  return sel.phase === "targeting" && sel.stepIdx === sel.steps.length;
}

/**
 * The active step/branch index — the single source of truth shared by click
 * gating, highlight, and the connector.
 *
 * For modal cards, this is the branch index (sel.choice).
 * For sequence cards, this is the step index within the card's original
 * Sequence.steps (maintained by the no-strip rule).
 * Returns 0 for idle and awaiting-modal phases.
 */
export function activeStep(sel: SelectionState): number {
  if (sel.phase !== "targeting") return 0;
  return sel.choice ?? sel.stepIdx;
}

/** The phase-instruction text (and whether to show it) for a selection state. */
export function hintForSelection(sel: SelectionState): {
  text: string;
  visible: boolean;
} {
  if (sel.phase === "idle") {
    return { text: "", visible: false };
  }

  if (sel.phase === "awaiting-modal") {
    return { text: "Choose an option above", visible: true };
  }

  // targeting phase
  if (sel.stepIdx >= sel.steps.length) {
    return { text: "", visible: false };
  }

  const step = sel.steps[sel.stepIdx] as TargetSpec;
  const min = stepMin(step);
  const max = stepMax(step);

  switch (step.kind) {
    case "modal":
      return { text: "Choose an option above", visible: true };
    case "hazard":
      return { text: "Select a Hazard target", visible: true };
    case "discardPlayer":
      return { text: "Select a player card to discard", visible: true };
    case "destroyHand":
      return {
        text:
          `Select a card to destroy (${sel.current.length} chosen)` +
          (min === 0 ? "(optional)" : ""),
        visible: true,
      };
    case "thawHand":
      return {
        text: `Select up to ${max} frozen cards to thaw (${sel.current.length} chosen)`,
        visible: true,
      };
    case "returnWorld":
      return {
        text: `Select ${min}–${max} world cards to return (${sel.current.length} chosen)`,
        visible: true,
      };
    case "recallTarget": {
      const recallNoun = max === 1 ? "discard" : "discards";
      const optional = min === 0 ? " (optional)" : "";
      return {
        text: `Recall ${rangeLabel(min, max)} ${recallNoun} to the top of your deck${optional} (${sel.current.length} chosen)`,
        visible: true,
      };
    }
    default:
      return { text: "", visible: false };
  }
}

/**
 * Build the core Action when the selection is complete. Returns null if not
 * yet complete.
 *
 * Folds done[] into a flat PlayCard action. Fields are omitted when undefined
 * (e.g. destroyIds when the destroy step was skipped).
 */
export function buildAction(sel: SelectionState): Action | null {
  if (sel.phase !== "targeting") return null;
  if (sel.stepIdx !== sel.steps.length) return null;

  const action: Extract<Action, { type: "PlayCard" }> = {
    type: "PlayCard",
    cardId: sel.cardId,
  };

  if (sel.choice !== undefined) {
    Object.assign(action, { choice: sel.choice });
  }

  for (const result of sel.done) {
    switch (result.kind) {
      case "hazard":
        Object.assign(action, { targetId: result.targetId });
        break;
      case "returnWorld":
        Object.assign(action, { returnIds: result.returnIds });
        break;
      case "recallTarget":
        Object.assign(action, { recallIds: result.recallIds });
        break;
      case "discardPlayer":
        Object.assign(action, { discardId: result.discardId });
        break;
      case "destroyHand":
        Object.assign(action, { destroyIds: result.destroyIds });
        break;
      case "thawHand":
        Object.assign(action, { thawIds: result.thawIds });
        break;
    }
  }

  return action;
}
