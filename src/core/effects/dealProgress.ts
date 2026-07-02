/**
 * The `DealProgress` handler family: `DealProgress`, `DealProgressScaled`, and
 * `DealProgressAll`.
 *
 * The split here is deliberate and is the point of this file:
 *
 *   - `DealProgress` and `DealProgressScaled` are real hazard-targeting kinds —
 *     the player picks a world card in hand and the play is legal only when one
 *     exists. They share that targeting behavior (`structuralSpec`, `isPlayable`,
 *     unfiltered `legalTargets`) via `HazardTargetingHandler`, written once
 *     there. The `progress` connector and the `base === 0` keyword filter are
 *     `DealProgress`-only and stay on `DealProgressHandler`.
 *   - `DealProgressAll` only *looks* like a sibling. It auto-targets every world
 *     card in hand and has no player target, so its structural spec, legal
 *     targets, and connector style are all the *base* defaults (`{kind:'none'}`,
 *     `[]`, `null`). It therefore extends `EffectHandler` directly and overrides
 *     only `isPlayable` (plus `apply`/`describe`/`compile`). Extending
 *     `HazardTargetingHandler` would silently regress those three concerns — a
 *     behavior change no compile error would catch.
 *
 * `dealProgress` and `resolveCounter` are the shared helpers, relocated here
 * from `effects.ts` (which re-exports them as a facade so existing test imports
 * keep resolving). `dealProgress` recurses through the *public* `applyEffect`
 * wrapper (imported from `effects.ts`), not `ctx.apply`: it keeps its
 * `(catalog, state, ...)` signature and the public wrapper rebuilds a fresh
 * `EffectContext` per call. The import is used only inside the function body, so
 * it is call-time-safe and forms no top-level evaluation cycle with `effects.ts`.
 *
 * Pure core — no Phaser, no DOM. Lint enforces the boundary.
 */
import type {
  CardEffect,
  CardId,
  CounterSpec,
  GameEvent,
  GameState,
  KeywordName,
  TargetSpec,
  WorldCard,
} from "../model/types";
import type { CardCatalog } from "../model/catalog";
import { hasKeyword, isConcealed } from "../model/keywords";
import type { EffectLine } from "../view/effectGlyphs";
import { applyEffect } from "../engine/effects";
import { effectiveWorldCardCost } from "../engine/effectiveCards";
import type { CompileContext, ConnectorStyle, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler, HazardTargetingHandler } from "./EffectHandler";
import { worldCardsInHand } from "./handState";
import { bonusRider, counterLabel, icon, main, perRider, text, value } from "./tokens";

type DealProgressEffect = Extract<CardEffect, { kind: "DealProgress" }>;
type DealProgressScaledEffect = Extract<CardEffect, { kind: "DealProgressScaled" }>;
type DealProgressAllEffect = Extract<CardEffect, { kind: "DealProgressAll" }>;

// ---------------------------------------------------------------------------
// dealProgress / resolveCounter — shared helpers (relocated from effects.ts)
// ---------------------------------------------------------------------------

/**
 * Apply progress toward a hazard in hand. Auto-resolves the hazard (removes it
 * from hand and fires its onCleared effect) if accumulated progress meets or exceeds the
 * hazard's cost.
 */
export function dealProgress(
  catalog: CardCatalog,
  state: GameState,
  hazardId: CardId,
  base: number,
  bonus?: { tag: KeywordName; amount: number },
): EffectResult {
  const hazard = state.hand.find((c): c is WorldCard => c.kind === "world" && c.id === hazardId);
  if (hazard === undefined) return { state, events: [] };

  const bonusAmount =
    bonus !== undefined && hasKeyword(hazard, bonus.tag)
      ? bonus.amount + state.runModifiers.keywordDamageBonus
      : 0;
  const amount = base + bonusAmount;

  const newProgress = {
    ...state.progress,
    [hazardId]: (state.progress[hazardId] ?? 0) + amount,
  };
  const hazardTurnTotal = newProgress[hazardId]!;

  const events: GameEvent[] = [
    { type: "ProgressDealt", hazardId, templateId: hazard.templateId, amount, hazardTurnTotal },
  ];

  // Single choke point for the per-turn Progress meter (ProgressGate
  // reads it). Every progress effect — DealProgress, DealProgressScaled,
  // DealProgressAll — routes through here, so this is the one place to count.
  let current: GameState = {
    ...state,
    progress: newProgress,
    progressDealtThisTurn: state.progressDealtThisTurn + amount,
  };

  if (hazardTurnTotal >= effectiveWorldCardCost(hazard, current)) {
    // Remove hazard from hand (excess progress is wasted — do NOT touch progress)
    current = {
      ...current,
      hand: current.hand.filter((c) => c.id !== hazardId),
    };

    // Pass hazardId as selfId so the cleared hazard's onCleared hook events
    // carry its provenance (preview masking for concealed clears).
    const rewardResult = applyEffect(catalog, current, hazard.onCleared, undefined, hazardId);
    current = rewardResult.state;
    events.push(...rewardResult.events);
    events.push({ type: "HazardResolved", hazardId, templateId: hazard.templateId });
  } else {
    // Hazard not yet resolved
    const partialResult = applyEffect(catalog, current, hazard.onPartialClear, undefined, hazardId);
    current = partialResult.state;
    events.push(...partialResult.events);
    events.push({ type: "HazardPartial", hazardId, templateId: hazard.templateId });
  }

  return { state: current, events };
}

export function resolveCounter(state: GameState, spec: CounterSpec): number {
  switch (spec.kind) {
    case "KeywordInHand":
      return state.hand.filter((card) => hasKeyword(card, spec.keyword)).length;
    case "FrozenPlayerCards":
      return state.hand.filter((card) => card.kind === "player" && (card.frozen ?? 0) > 0).length;

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// DealProgress — hazard-targeting, with a keyword-tag structural spec
// ---------------------------------------------------------------------------

/**
 * `DealProgress`: deal a fixed amount of progress to one chosen hazard, with an
 * optional keyword bonus. Inherits `isPlayable` from `HazardTargetingHandler`,
 * and overrides the three `DealProgress`-specific behaviors:
 *   - `structuralSpec` surfaces the keyword tag so the UI can highlight hazards.
 *   - `connectorStyle` returns `'progress'` — this is the only kind that draws
 *     the progress connector (`DealProgressScaled` inherits the base `null`).
 *   - `legalTargets` filters to keyword-matching hazards when `base === 0` and a
 *     bonus tag is present; otherwise all world cards (the base behavior).
 */
export class DealProgressHandler extends HazardTargetingHandler<DealProgressEffect> {
  override apply(ctx: EffectContext, effect: DealProgressEffect): EffectResult {
    return dealProgress(ctx.catalog, ctx.state, ctx.targetId ?? "", effect.base, effect.bonus);
  }

  override describe(effect: DealProgressEffect): string[] {
    const bonus = effect.bonus ? `\n(+${effect.bonus.amount} vs ${effect.bonus.tag})` : "";
    return [`Add ${effect.base} Progress${bonus}`];
  }

  override compile(effect: DealProgressEffect, _ctx: CompileContext): EffectLine[] {
    const lines = [main([text("+"), value(`${effect.base}`, "progress"), icon("progress")])];
    if (effect.bonus) lines.push(bonusRider(effect.bonus, "progress"));
    return lines;
  }

  override structuralSpec(effect: DealProgressEffect): TargetSpec {
    const tag = effect.bonus?.tag;
    return tag !== undefined ? { kind: "hazard", tag } : { kind: "hazard" };
  }

  override connectorStyle(_effect: DealProgressEffect): ConnectorStyle {
    return "progress";
  }

  override legalTargets(
    effect: DealProgressEffect,
    _selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    // Concealed hazards are never legal single-targets — you can't aim at what
    // you cannot see (it is unfiltered when light === 0, i.e. no concealment).
    const visible = worldCardsInHand(state).filter((c) => !isConcealed(c, state.light));
    if (effect.base === 0) {
      const tag = effect.bonus?.tag;
      if (tag !== undefined) {
        // Filter to visible world cards that carry the matching keyword.
        return visible.filter((c) => hasKeyword(c, tag)).map((c) => c.id);
      }
    }
    return visible.map((c) => c.id);
  }
}

// ---------------------------------------------------------------------------
// DealProgressScaled — hazard-targeting, amount scales with a counter
// ---------------------------------------------------------------------------

/**
 * `DealProgressScaled`: deal `base + amount * counter` progress to one chosen
 * hazard. Pure inherit of the hazard base — `structuralSpec`, `isPlayable`, and
 * `legalTargets` (all world cards, unfiltered) come straight from
 * `HazardTargetingHandler`, and `connectorStyle` inherits the base `null` (only
 * `DealProgress` draws the progress connector). Only apply/describe/compile
 * differ from `DealProgress`.
 */
export class DealProgressScaledHandler extends HazardTargetingHandler<DealProgressScaledEffect> {
  override apply(ctx: EffectContext, effect: DealProgressScaledEffect): EffectResult {
    const amount = effect.base + effect.amount * resolveCounter(ctx.state, effect.per);
    return dealProgress(ctx.catalog, ctx.state, ctx.targetId ?? "", amount);
  }

  override describe(effect: DealProgressScaledEffect): string[] {
    return [`Add ${effect.base} Progress`, `+${effect.amount} per ${counterLabel(effect.per)}`];
  }

  override compile(effect: DealProgressScaledEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([text("+"), value(`${effect.base}`, "progress"), icon("progress")]),
      perRider("+", effect.amount, effect.per),
    ];
  }
}

// ---------------------------------------------------------------------------
// DealProgressAll — auto-targets every hazard; NOT hazard-targeting
// ---------------------------------------------------------------------------

/**
 * `DealProgressAll`: deal progress to every world card in hand using a snapshot
 * taken before the sweep begins. It has no player target, so it extends
 * `EffectHandler` directly to keep the base defaults for `structuralSpec`
 * (`{kind:'none'}`), `legalTargets` (`[]`), and `connectorStyle` (`null`). It
 * overrides only `isPlayable` (a hazard must exist) plus apply/describe/compile.
 */
export class DealProgressAllHandler extends EffectHandler<DealProgressAllEffect> {
  override apply(ctx: EffectContext, effect: DealProgressAllEffect): EffectResult {
    // Snapshot world cards in hand at resolution time — mid-sweep spawned
    // cards are excluded (they land in worldDraw via AddWorldCardToDeck, not hand).
    const snapshot = ctx.state.hand.filter((c): c is WorldCard => c.kind === "world");
    let current = ctx.state;
    const events: GameEvent[] = [];
    for (const hazard of snapshot) {
      const r = dealProgress(ctx.catalog, current, hazard.id, effect.base, effect.bonus);
      current = r.state;
      events.push(...r.events);
      if (current.status !== "playing") break;
    }
    return { state: current, events };
  }

  override describe(effect: DealProgressAllEffect): string[] {
    const bonus = effect.bonus ? `\n(+${effect.bonus.amount} vs ${effect.bonus.tag})` : "";
    return [`${effect.base} Progress to every hazard${bonus}`];
  }

  override compile(effect: DealProgressAllEffect, _ctx: CompileContext): EffectLine[] {
    const lines = [
      main([text("+"), value(`${effect.base}`, "progress"), text("all"), icon("progressAll")]),
    ];
    if (effect.bonus) lines.push(bonusRider(effect.bonus, "progress"));
    return lines;
  }

  override isPlayable(_effect: DealProgressAllEffect, state: GameState, _selfId: CardId): boolean {
    return worldCardsInHand(state).length > 0;
  }
}
