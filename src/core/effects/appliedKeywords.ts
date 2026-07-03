/**
 * The applied-keyword effect family.
 *
 * `Alarm` is the first applied keyword, but nothing here is Alarm-specific: the
 * handlers operate on the general `appliedKeywords` collection (see
 * model/keywords) so future worlds can stamp their own transient keywords.
 *
 *   - ApplyKeyword  — stamp a keyword on cards (hand / self / first world card /
 *                     the next world card drawn).
 *   - KeywordGate   — fire a nested effect when enough cards carry a keyword,
 *                     unless an keywordGuard charge absorbs an Alarm trigger.
 *   - ProgressGate  — fire a nested effect when enough Progress was dealt this
 *                     turn (a greed signal; never touches keywordGuard).
 *   - RemoveKeyword — strip an applied keyword from cards in the hand.
 *
 * `tickAppliedKeywordsAtTurnStart` is the turn-start decay step, mirroring
 * `thawFrozenCardsAtTurnStart`.
 *
 * Pure core — no Phaser, no DOM. Lint enforces the boundary.
 */
import type {
  Card,
  CardEffect,
  CardId,
  CardTemplateId,
  GameEvent,
  GameState,
  Keyword,
  KeywordName,
  WorldCard,
} from "../model/types";
import {
  keywordValue,
  PERSISTENT_KEYWORDS,
  tickAppliedKeywords,
  withAppliedKeyword,
  withoutAppliedKeyword,
} from "../model/keywords";
import type { EffectLine, EffectToken } from "../view/effectGlyphs";
import type { PreviewEventSummary, PreviewFormatContext } from "../view/previewFormat";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, text, value } from "./tokens";
import { nextInt } from "../engine/rng";

type ApplyKeywordEffect = Extract<CardEffect, { kind: "ApplyKeyword" }>;
type ResourceGateEffect = Extract<CardEffect, { kind: "ResourceGate" }>;
type KeywordGateEffect = Extract<CardEffect, { kind: "KeywordGate" }>;
type ProgressGateEffect = Extract<CardEffect, { kind: "ProgressGate" }>;
type RemoveKeywordEffect = Extract<CardEffect, { kind: "RemoveKeyword" }>;

// NOTE: describe() does not recurse into the gate's `then` effect. Recursion
// would need EFFECTS from registry.ts, but this module is imported by energy.ts
// (for tickAppliedKeywordsAtTurnStart) *before* registry loads, so a top-level
// registry import would leave the gate handlers undefined when registry builds
// its EFFECTS map. compile() recurses safely via the ctx.compile seam instead.

/**
 * Shared preview copy for `KeywordApplied`. Single source for both call sites:
 * `ApplyKeywordHandler.previewEvent` (the `ApplyKeyword`-stamped hand instance)
 * and the `summarizeEvent` switch arm (the `Draw`-stamped deferred nextWorldCard
 * instance and the unstamped turn-start refill instance, neither of which routes
 * to this handler).
 */
export function keywordAppliedLine(
  event: Extract<GameEvent, { type: "KeywordApplied" }>,
  context: PreviewFormatContext,
): readonly string[] {
  const count = event.ids.length;
  return [`Apply ${event.keyword} to ${count} ${context.plural("card", count)}`];
}

/**
 * Shared preview copy for `KeywordRemoved`. Single source for both call sites:
 * `RemoveKeywordHandler.previewEvent` (the dispatch-stamped instance) and the
 * `summarizeEvent` switch arm (the unstamped `tickAppliedKeywordsAtTurnStart`
 * decay instance, which does not pass through dispatch).
 */
export function keywordRemovedLine(
  event: Extract<GameEvent, { type: "KeywordRemoved" }>,
  context: PreviewFormatContext,
): readonly string[] {
  const count = event.ids.length;
  return [`Remove ${event.keyword} from ${count} ${context.plural("card", count)}`];
}

/**
 * Stamp `kw` onto the hand cards whose ids are in `ids`, emitting a single
 * KeywordApplied event for the cards actually touched. A no-op (no event) when
 * no listed id is in hand.
 */
function applyToHandIds(state: GameState, ids: readonly CardId[], kw: Keyword): EffectResult {
  const idSet = new Set<CardId>(ids);
  const touched: Card[] = [];
  const hand = state.hand.map((card) => {
    if (!idSet.has(card.id)) return card;
    const next = withAppliedKeyword(card, kw);
    touched.push(next);
    return next;
  });
  if (touched.length === 0) return { state, events: [] };
  return {
    state: { ...state, hand },
    events: [
      {
        type: "KeywordApplied",
        ids: touched.map((c) => c.id),
        templateIds: touched.map((c) => c.templateId),
        keyword: kw.name,
        value: kw.value ?? 0,
      },
    ],
  };
}

export class ApplyKeywordHandler extends EffectHandler<ApplyKeywordEffect> {
  override apply(ctx: EffectContext, effect: ApplyKeywordEffect): EffectResult {
    const { state } = ctx;
    const kw: Keyword = { name: effect.keyword, value: effect.value };

    switch (effect.target) {
      case "nextWorldCard":
        // Deferred: no card changes now. drawWorld consumes the flag and stamps
        // the next world card pulled into hand.
        return {
          state: {
            ...state,
            pendingKeywordNextWorldCard: [
              ...state.pendingKeywordNextWorldCard,
              { name: effect.keyword, value: effect.value },
            ],
          },
          events: [],
        };

      case "self":
        return ctx.selfId !== undefined
          ? applyToHandIds(state, [ctx.selfId], kw)
          : { state, events: [] };

      case "hand":
        return applyToHandIds(
          state,
          state.hand.map((c) => c.id),
          kw,
        );

      case "firstWorldCardInHand": {
        const worldCards = state.hand.filter((c): c is WorldCard => c.kind === "world");
        if (worldCards.length === 0) return { state, events: [] };
        const noExisting = worldCards.filter((c): c is WorldCard => {
          return c.appliedKeywords === undefined
            ? true
            : undefined === c.appliedKeywords.find((akw) => akw.name === kw.name);
        });
        if (noExisting.length > 0 && noExisting[0] !== undefined) {
          return applyToHandIds(state, [noExisting[0].id], kw);
        }
        if (worldCards[0] !== undefined) {
          return applyToHandIds(state, [worldCards[0].id], kw);
        }
        // Should be unreachable.
        return { state, events: [] };
      }
      case "randomWorldCardInHand": {
        const worldCards = state.hand.filter((c): c is WorldCard => c.kind === "world");
        if (worldCards.length === 0) return { state, events: [] };
        const [index, newRng] = nextInt(state.rng, worldCards.length - 1);
        const afterPick = { ...state, rng: newRng };
        if (worldCards[index] === undefined) return { state: afterPick, events: [] };
        return applyToHandIds(afterPick, [worldCards[index].id], kw);
      }
    }
  }

  override previewEvent(event: GameEvent, ctx: PreviewFormatContext): PreviewEventSummary {
    if (event.type !== "KeywordApplied") return null;
    return keywordAppliedLine(event, ctx);
  }

  override describe(effect: ApplyKeywordEffect): string[] {
    const suffix = PERSISTENT_KEYWORDS.has(effect.keyword) ? "" : ` (${effect.value})`;
    return [`Apply ${effect.keyword}${suffix} to ${effect.target}`];
  }

  override compile(effect: ApplyKeywordEffect, _ctx: CompileContext): EffectLine[] {
    const tokens = [text("apply"), text(effect.keyword)];
    if (!PERSISTENT_KEYWORDS.has(effect.keyword)) tokens.push(value(`${effect.value}`, "penalty"));
    return [main(tokens)];
  }
}

export class ResourceGateHandler extends EffectHandler<ResourceGateEffect> {
  override apply(ctx: EffectContext, effect: ResourceGateEffect): EffectResult {
    const { state } = ctx;
    const total = (() => {
      switch (effect.resource) {
        case "Light":
          return ctx.state.light;
        case "Heat":
          return ctx.state.heat;
        case "HP":
          return ctx.state.hp;
        case "Brace":
          return ctx.state.braceCharges;
        case "KeywordGuard":
          return ctx.state.keywordGuard;
      }
    })();

    switch (effect.op) {
      case "lte":
        if (total > effect.value) return { state, events: [] };
        // continue because total <= effect.value
        break;
      case "gte":
        if (total < effect.value) return { state, events: [] };
        // continue because total >= effect.value
        break;
    }

    return ctx.apply(ctx, effect.then);
  }

  override describe(effect: ResourceGateEffect): string[] {
    return [
      `If ${effect.resource} ${effect.op === "lte" ? "<=" : ">="} ${effect.value}, trigger a disruption`,
    ];
  }

  override compile(effect: ResourceGateEffect, ctx: CompileContext): EffectLine[] {
    const resourceToken: EffectToken = (() => {
      switch (effect.resource) {
        case "HP":
          return icon("hp");
        case "Light":
          return icon("light");
        case "Heat":
          return icon("heat");
        case "Brace":
          return icon("brace");
        case "KeywordGuard":
          return text("Guard");
      }
    })();
    return [
      main([
        resourceToken,
        text(`${effect.op === "lte" ? "<=" : ">="} ${effect.value}`),
        text("→"),
      ]),
      ...ctx.compile(effect.then, { ...ctx, compactSequences: true }),
    ];
  }
}

export class KeywordGateHandler extends EffectHandler<KeywordGateEffect> {
  override apply(ctx: EffectContext, effect: KeywordGateEffect): EffectResult {
    const { state } = ctx;
    const total = (() => {
      switch (effect.zone) {
        case "hand":
          return state.hand.reduce((sum, c) => sum + keywordValue(c, effect.keyword), 0);
        case "self":
          return state.hand
            .filter((c) => c.id === ctx.selfId)
            .reduce((sum, c) => sum + keywordValue(c, effect.keyword), 0);
      }
    })();
    if (total < effect.min) return { state, events: [] };

    if (state.keywordGuard > 0) {
      // A guard charge defuses the disruption: spend it and suppress `then`.
      const remaining = state.keywordGuard - 1;
      return {
        state: { ...state, keywordGuard: remaining },
        events: [{ type: "KeywordGuardConsumed", absorbed: 1, remaining }],
      };
    }

    return ctx.apply(ctx, effect.then);
  }

  override previewEvent(event: GameEvent, _ctx: PreviewFormatContext): PreviewEventSummary {
    if (event.type !== "KeywordGuardConsumed") return null;
    return [`Keyword Guard absorbs the trigger; ${event.remaining} remaining`];
  }

  override describe(effect: KeywordGateEffect): string[] {
    return [`If ${effect.min}+ ${effect.keyword} in hand, trigger a disruption`];
  }

  override compile(effect: KeywordGateEffect, ctx: CompileContext): EffectLine[] {
    return [
      main([text(`${effect.min}+ ${effect.keyword}`), text("→")]),
      ...ctx.compile(effect.then, { ...ctx, compactSequences: true }),
    ];
  }
}

export class ProgressGateHandler extends EffectHandler<ProgressGateEffect> {
  override apply(ctx: EffectContext, effect: ProgressGateEffect): EffectResult {
    if (ctx.state.progressDealtThisTurn < effect.min) return { state: ctx.state, events: [] };
    return ctx.apply(ctx, effect.then);
  }

  override describe(effect: ProgressGateEffect): string[] {
    return [`If ${effect.min}+ Progress dealt this turn, trigger a reward`];
  }

  override compile(effect: ProgressGateEffect, ctx: CompileContext): EffectLine[] {
    return [
      main([icon("progress"), text(`${effect.min}+ this turn`), text("→")]),
      ...ctx.compile(effect.then, { ...ctx, compactSequences: true }),
    ];
  }
}

export class RemoveKeywordHandler extends EffectHandler<RemoveKeywordEffect> {
  override apply(ctx: EffectContext, effect: RemoveKeywordEffect): EffectResult {
    const { state } = ctx;
    // target is "hand". Only cards that carry the keyword as an APPLIED entry
    // are eligible — authored keywords are template traits and are never
    // stripped. Deterministic order: ascending numeric mint id.
    const eligible = state.hand
      .filter((c) => (c.appliedKeywords ?? []).some((k) => k.name === effect.keyword))
      .slice()
      .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
      .slice(0, effect.amount);

    if (eligible.length === 0) return { state, events: [] };

    const targetIds = new Set<CardId>(eligible.map((c) => c.id));
    const hand = state.hand.map((c) =>
      targetIds.has(c.id) ? withoutAppliedKeyword(c, effect.keyword) : c,
    );

    return {
      state: { ...state, hand },
      events: [
        {
          type: "KeywordRemoved",
          ids: eligible.map((c) => c.id),
          templateIds: eligible.map((c) => c.templateId),
          keyword: effect.keyword,
        },
      ],
    };
  }

  override previewEvent(event: GameEvent, ctx: PreviewFormatContext): PreviewEventSummary {
    if (event.type !== "KeywordRemoved") return null;
    return keywordRemovedLine(event, ctx);
  }

  override describe(effect: RemoveKeywordEffect): string[] {
    const noun = effect.amount === 1 ? "card" : "cards";
    return [`Remove ${effect.keyword} from ${effect.amount} ${noun}`];
  }

  override compile(effect: RemoveKeywordEffect, _ctx: CompileContext): EffectLine[] {
    return [main([text(`clear ${effect.keyword}`), value(`${effect.amount}`, "reward")])];
  }
}

// ---------------------------------------------------------------------------
// Turn-start decay — mirrors thawFrozenCardsAtTurnStart in heat.ts.
// ---------------------------------------------------------------------------

/**
 * Decrement every applied keyword's lifetime by one for every card in hand,
 * dropping entries that reach zero. Emits one KeywordRemoved per keyword that
 * expired this tick (grouped across the cards that lost it), in first-seen
 * keyword order. A no-op (no event, identical state) when nothing was applied.
 */
export function tickAppliedKeywordsAtTurnStart(state: GameState): EffectResult {
  const expiries = new Map<KeywordName, { ids: CardId[]; templateIds: CardTemplateId[] }>();
  const reduced = new Map<KeywordName, { ids: CardId[]; templateIds: CardTemplateId[] }>();
  // True once any card actually carried an applied keyword. When no card does
  // (every non-Eden turn) the original state is returned untouched, keeping the
  // event stream and state byte-identical to the pre-slice engine.
  let ticked = false;

  const hand = state.hand.map((card) => {
    const applied = card.appliedKeywords;
    if (applied === undefined || applied.length === 0) return card;
    ticked = true;
    const next = tickAppliedKeywords(card);
    const remaining = next.appliedKeywords ?? [];
    for (const kw of applied) {
      if (PERSISTENT_KEYWORDS.has(kw.name)) {
        const bucket = reduced.get(kw.name) ?? { ids: [], templateIds: [] };
        bucket.ids.push(card.id);
        bucket.templateIds.push(card.templateId);
        reduced.set(kw.name, bucket);
      }
      if (!remaining.some((k) => k.name === kw.name)) {
        const bucket = expiries.get(kw.name) ?? { ids: [], templateIds: [] };
        bucket.ids.push(card.id);
        bucket.templateIds.push(card.templateId);
        expiries.set(kw.name, bucket);
      }
    }
    return next;
  });

  if (!ticked) return { state, events: [] };

  // Decremented (but not yet expired) lifetimes still update the hand; events
  // fire only for keywords that hit zero this tick.
  const events: GameEvent[] = [];
  for (const [keyword, { ids, templateIds }] of expiries) {
    events.push({ type: "KeywordReduced", ids, templateIds, keyword });
  }
  for (const [keyword, { ids, templateIds }] of expiries) {
    events.push({ type: "KeywordRemoved", ids, templateIds, keyword });
  }
  return { state: { ...state, hand }, events };
}
