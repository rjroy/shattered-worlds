/**
 * Human-readable descriptions of card behaviour.
 *
 * This is the single source of every English string that explains what a card
 * does — the card face, the modal chooser labels, and the live target preview
 * all read from here, so they can never disagree. It imports core *types* only
 * (no Phaser, no DOM), so it stays on the pure side of the renderer boundary
 * and is unit-tested headless.
 */
import type { CardEffect, GameState, PlayerCard, WorldCard } from "../../core/index";
import { EFFECTS } from "../effects/registry";

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * Describe a player-card effect as one or more display lines. Recurses into
 * `Modal` (a "Choose one:" header plus a bullet per branch) and `Sequence`
 * (one line per step, later steps prefixed "then …"), so nothing collapses to
 * an opaque "Choose…" / "Multi-step".
 */
export function describeEffect(effect: CardEffect): string[] {
  const h = EFFECTS[effect.kind];
  return h.describe(effect as never);
}

// ---------------------------------------------------------------------------
// Live target preview
// ---------------------------------------------------------------------------

/**
 * One-line preview of playing `card` at `target`, given the current state.
 * Combines the card's base Progress, its keyword bonus against this target,
 * and the Progress already dealt this turn to say whether the play clears the
 * Hazard or how much remains. Returns null when the card deals no Progress
 * (the modal branch chosen draws instead, etc.).
 *
 * `branchIndex` selects a Modal branch when the card is modal and a branch has
 * been chosen; otherwise the first Progress-dealing effect is used.
 */
export function previewPlay(
  card: PlayerCard,
  target: WorldCard,
  state: GameState,
  branchIndex?: number,
): string | null {
  const deal = dealProgressOf(card.effect, branchIndex);
  if (deal === null) return null;

  const bonus =
    deal.bonus !== undefined && target.keywords.includes(deal.bonus.tag) ? deal.bonus.amount : 0;
  const amount = deal.base + bonus;
  const already = state.progress[target.id] ?? 0;
  const total = already + amount;

  if (total >= target.cost) {
    return `Make ${amount} Progress → clears ${target.name}`;
  }
  return `Make ${amount} Progress → ${target.cost - total} more to clear ${target.name}`;
}

/** The Progress payload of an effect, looking through Modal/Sequence. */
function dealProgressOf(
  effect: CardEffect,
  branchIndex?: number,
): Extract<CardEffect, { kind: "DealProgress" }> | null {
  switch (effect.kind) {
    case "DealProgress":
      return effect;
    case "DealProgressAll":
      // Treat as a DealProgress-shaped payload so previewPlay shows per-hazard math.
      return effect.bonus !== undefined
        ? { kind: "DealProgress", base: effect.base, bonus: effect.bonus }
        : { kind: "DealProgress", base: effect.base };
    case "Modal": {
      const branch = branchIndex !== undefined ? effect.branches[branchIndex] : undefined;
      return branch !== undefined ? dealProgressOf(branch) : null;
    }
    case "Sequence": {
      for (const step of effect.steps) {
        const found = dealProgressOf(step);
        if (found !== null) return found;
      }
      return null;
    }
    // Non-progress effects: nothing to preview as Progress math.
    case "DealProgressScaled":
    case "Draw":
    case "Heal":
    case "GainEnergy":
    case "ReturnWorldCards":
    case "DestroyCardInHand":
    case "DiscardThenDraw":
    case "AddCard":
    case "AddWorldCardToDeck":
    case "AddThreatToWorldDeck":
    case "Damage":
    case "DamageScaled":
    case "GainCard":
    case "AddPlayerCardToTop":
    case "SurviveWorld":
    case "ForceDestroy":
    case "DestroySelf":
    case "None":
    case "Brace":
    case "ExileTopWorldCards":
      return null;
  }
}
