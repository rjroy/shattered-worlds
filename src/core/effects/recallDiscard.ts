/**
 * Tidal Archive discard-recall effects.
 *
 * Mirrors the structure of `worldCards.ts`: one shared zone-move helper
 * (`recallToTop`) plus two handlers. The Tidal signature verb is "displace" —
 * these effects move existing player card *instances* from playerDiscard to the
 * top of playerDraw without minting copies, so a discarded card is never gone,
 * only relocated.
 *
 * `ReturnPlayerDiscardToTop` is the player-selected reward form (the chooser
 * supplies ids). `RecallPlayerDiscard` is the automatic form fired by hazards
 * and the world end-turn passive — never played from hand.
 *
 * Pure core — no Phaser, no DOM. Lint enforces the boundary.
 */
import type {
  Card,
  CardEffect,
  CardId,
  GameEvent,
  GameState,
  PlayerCard,
  TargetSpec,
} from "../model/types";
import type { EffectLine } from "../view/effectGlyphs";
import { nextFloat } from "../engine/rng";
import type { CompileContext, ConnectorStyle, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, rangeText, rider, text, value } from "./tokens";

type ReturnPlayerDiscardToTopEffect = Extract<CardEffect, { kind: "ReturnPlayerDiscardToTop" }>;
type RecallPlayerDiscardEffect = Extract<CardEffect, { kind: "RecallPlayerDiscard" }>;

type RecallSource = Extract<GameEvent, { type: "PlayerDiscardRecalled" }>["source"];

type RecallPolicy = NonNullable<RecallPlayerDiscardEffect["policy"]>;

/** Human-readable label for an automatic recall policy (chooser/glyph text). */
function policyLabel(policy: RecallPolicy): string {
  switch (policy) {
    case "latest":
      return "newest";
    case "random":
      return "random";
    case "lowestCost":
      return "cheapest";
    case "highestCost":
      return "priciest";
    case "panicFirst":
      return "Panic first";
  }
}

/**
 * The single zone-move entry point. For each id found in playerDiscard, remove
 * it from playerDiscard and prepend it to playerDraw, preserving the exact card
 * instance (no re-mint). Selected ids land on top of playerDraw in the given
 * order. Empty or not-found ids are a no-op with no event.
 */
export function recallToTop(
  state: GameState,
  ids: readonly CardId[],
  source: RecallSource,
): EffectResult {
  if (ids.length === 0) return { state, events: [] };

  // Resolve ids to the actual instances in playerDiscard, in the order given.
  // Ids not present in the pile are silently dropped (no-op for those).
  const recalled: Card[] = [];
  for (const id of ids) {
    const card = state.playerDiscard.find((c) => c.id === id);
    if (card !== undefined) recalled.push(card);
  }

  if (recalled.length === 0) return { state, events: [] };

  const recalledIds = recalled.map((c) => c.id);
  const discardAfter = state.playerDiscard.filter((c) => !recalledIds.includes(c.id));

  const current: GameState = {
    ...state,
    playerDiscard: discardAfter,
    playerDraw: [...recalled, ...state.playerDraw],
  };

  const events: GameEvent[] = [
    {
      type: "PlayerDiscardRecalled",
      cardIds: recalledIds,
      templateIds: recalled.map((c) => c.templateId),
      source,
      dest: "playerDrawTop",
    },
  ];
  return { state: current, events };
}

/** Player cards currently in the discard pile, in pile order (head = latest). */
function playerCardsInDiscard(state: GameState): PlayerCard[] {
  return state.playerDiscard.filter((c): c is PlayerCard => c.kind === "player");
}

/**
 * Resolve which discard ids the automatic recall picks, given count and policy.
 * Returns the chosen ids and the (possibly advanced) rng — only `random`
 * advances it. All policies operate over player cards only (world cards never
 * enter playerDiscard today, but the Card[] type does not enforce that).
 */
function resolveAutoRecall(
  state: GameState,
  count: number,
  policy: RecallPolicy,
): { ids: readonly CardId[]; rng: GameState["rng"] } {
  const candidates = playerCardsInDiscard(state);
  if (candidates.length === 0) return { ids: [], rng: state.rng };

  switch (policy) {
    case "latest":
      // handleEndTurn prepends discarded cards, so the head is the most recent.
      return { ids: candidates.slice(0, count).map((c) => c.id), rng: state.rng };

    case "lowestCost": {
      const sorted = [...candidates].sort((a, b) => a.energyCost - b.energyCost);
      return { ids: sorted.slice(0, count).map((c) => c.id), rng: state.rng };
    }

    case "highestCost": {
      const sorted = [...candidates].sort((a, b) => b.energyCost - a.energyCost);
      return { ids: sorted.slice(0, count).map((c) => c.id), rng: state.rng };
    }

    case "panicFirst": {
      const panic = candidates.find((c) => c.templateId === "Panic");
      const ordered =
        panic !== undefined ? [panic, ...candidates.filter((c) => c !== panic)] : candidates;
      return { ids: ordered.slice(0, count).map((c) => c.id), rng: state.rng };
    }

    case "random": {
      // Seeded selection without replacement. Threads rng back so replays match.
      const pool = [...candidates];
      const chosen: CardId[] = [];
      let rng = state.rng;
      for (let i = 0; i < count && pool.length > 0; i++) {
        const [raw, next] = nextFloat(rng);
        rng = next;
        const idx = Math.floor(raw * pool.length);
        chosen.push(pool[idx]!.id);
        pool.splice(idx, 1);
      }
      return { ids: chosen, rng };
    }
  }
}

/**
 * Player-selected recall (Tidal reward cards). Reads ctx.recallIds (validated
 * against [min,max] by the runtime gate before apply) and moves them to the
 * top of playerDraw. min: 0 makes an empty selection a legal no-op.
 */
export class ReturnPlayerDiscardToTopHandler extends EffectHandler<ReturnPlayerDiscardToTopEffect> {
  override apply(ctx: EffectContext, _effect: ReturnPlayerDiscardToTopEffect): EffectResult {
    return recallToTop(ctx.state, ctx.recallIds ?? [], "playerSelected");
  }

  override describe(effect: ReturnPlayerDiscardToTopEffect): string[] {
    const count = rangeText(effect.min, effect.max);
    const noun = effect.max === 1 ? "discard" : "discards";
    const lines = [`Return ${count} ${noun} to the top of your deck`];
    if (effect.min === 0) lines.push("(optional)");
    return lines;
  }

  override compile(effect: ReturnPlayerDiscardToTopEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([icon("recall"), value(rangeText(effect.min, effect.max), "reward"), text("to top")]),
    ];
  }

  override structuralSpec(effect: ReturnPlayerDiscardToTopEffect): TargetSpec {
    return { kind: "recallTarget", min: effect.min, max: effect.max };
  }

  override isPlayable(
    effect: ReturnPlayerDiscardToTopEffect,
    state: GameState,
    _selfId: CardId,
  ): boolean {
    // min: 0 is always playable (zero-selection is a legal no-op). min > 0
    // requires at least min legal discard targets.
    return !(effect.min > 0 && this.legalTargets(effect, _selfId, state).length < effect.min);
  }

  override legalTargets(
    _effect: ReturnPlayerDiscardToTopEffect,
    _selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    return state.playerDiscard.map((c) => c.id);
  }

  override connectorStyle(_effect: ReturnPlayerDiscardToTopEffect): ConnectorStyle | null {
    // The chooser is an overlay, not an in-hand connector line.
    return null;
  }
}

/**
 * Automatic recall fired by world hooks and the end-turn passive. Never played
 * from hand (isPlayable === false), so availableActions never reports it as a
 * hand-playable target — matching GainCardHandler / AddPlayerCardToTopHandler.
 */
export class RecallPlayerDiscardHandler extends EffectHandler<RecallPlayerDiscardEffect> {
  override apply(ctx: EffectContext, effect: RecallPlayerDiscardEffect): EffectResult {
    const count = effect.count ?? 1;
    const policy = effect.policy ?? "latest";
    const { ids, rng } = resolveAutoRecall(ctx.state, count, policy);
    if (ids.length === 0) return { state: ctx.state, events: [] };
    const result = recallToTop({ ...ctx.state, rng }, ids, policy);

    // Only the `random` policy chooses victims via rng, so only it gets the
    // stamp. recallToTop is shared with the deterministic policies and the
    // playerSelected path, so we stamp here (the auto-recall caller) rather
    // than changing recallToTop's signature. PlayerDiscardRecalled is the only
    // event recallToTop emits.
    if (policy !== "random") return result;
    return {
      state: result.state,
      events: result.events.map((event) =>
        event.type === "PlayerDiscardRecalled" ? { ...event, randomized: true } : event,
      ),
    };
  }

  override describe(effect: RecallPlayerDiscardEffect): string[] {
    const count = effect.count ?? 1;
    const noun = count === 1 ? "discard" : "discards";
    const policy = effect.policy ?? "latest";
    return [`Recall ${count} ${noun} (${policyLabel(policy)}) to the top of your deck`];
  }

  override compile(effect: RecallPlayerDiscardEffect, _ctx: CompileContext): EffectLine[] {
    const policy = effect.policy ?? "latest";
    return [
      main([icon("recall"), value(`${effect.count ?? 1}`, "penalty"), text("from discard")]),
      rider([text(policyLabel(policy))]),
    ];
  }

  override isPlayable(): boolean {
    return true;
  }
}
