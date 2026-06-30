/**
 * Eden Prime — the applied-keyword effect family.
 *
 * `Alarm` is the first applied keyword, but nothing here is Alarm-specific: the
 * handlers operate on the general `appliedKeywords` collection (see
 * model/keywords) so future worlds can stamp their own transient keywords.
 *
 *   - ApplyKeyword  — stamp a keyword on cards (hand / self / first world card /
 *                     the next world card drawn).
 *   - KeywordGate   — fire a nested effect when enough cards carry a keyword,
 *                     unless an alarmGuard charge absorbs an Alarm trigger.
 *   - ProgressGate  — fire a nested effect when enough Progress was dealt this
 *                     turn (a greed signal; never touches alarmGuard).
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
  hasKeyword,
  tickAppliedKeywords,
  withAppliedKeyword,
  withoutAppliedKeyword,
} from "../model/keywords";
import type { EffectLine } from "../view/effectGlyphs";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { icon, main, text, value } from "./tokens";

type ApplyKeywordEffect = Extract<CardEffect, { kind: "ApplyKeyword" }>;
type KeywordGateEffect = Extract<CardEffect, { kind: "KeywordGate" }>;
type ProgressGateEffect = Extract<CardEffect, { kind: "ProgressGate" }>;
type RemoveKeywordEffect = Extract<CardEffect, { kind: "RemoveKeyword" }>;

// NOTE: describe() does not recurse into the gate's `then` effect. Recursion
// would need EFFECTS from registry.ts, but this module is imported by energy.ts
// (for tickAppliedKeywordsAtTurnStart) *before* registry loads, so a top-level
// registry import would leave the gate handlers undefined when registry builds
// its EFFECTS map. compile() recurses safely via the ctx.compile seam instead.

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
            pendingAlarmNextWorldCard: { keyword: effect.keyword, value: effect.value },
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
        // Mint ids are String(nextId); compare numerically. A string compare
        // inverts at id >= 10 ("10" < "2"), so it would pick the wrong card on
        // any board past 9 minted cards — a latent determinism bug.
        const first = worldCards.reduce((lowest, candidate) =>
          parseInt(candidate.id, 10) < parseInt(lowest.id, 10) ? candidate : lowest,
        );
        return applyToHandIds(state, [first.id], kw);
      }
    }
  }

  override describe(effect: ApplyKeywordEffect): string[] {
    return [`Apply ${effect.keyword} (${effect.value}) to ${effect.target}`];
  }

  override compile(effect: ApplyKeywordEffect, _ctx: CompileContext): EffectLine[] {
    return [main([text("apply"), text(effect.keyword), value(`${effect.value}`, "penalty")])];
  }
}

export class KeywordGateHandler extends EffectHandler<KeywordGateEffect> {
  override apply(ctx: EffectContext, effect: KeywordGateEffect): EffectResult {
    const { state } = ctx;
    // zone is "hand".
    const count = state.hand.filter((c) => hasKeyword(c, effect.keyword)).length;
    if (count < effect.min) return { state, events: [] };

    if (effect.keyword === "Alarm" && state.alarmGuard > 0) {
      // A guard charge defuses the disruption: spend it and suppress `then`.
      const remaining = state.alarmGuard - 1;
      return {
        state: { ...state, alarmGuard: remaining },
        events: [{ type: "AlarmGuardConsumed", absorbed: 1, remaining }],
      };
    }

    return ctx.apply(ctx, effect.then);
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
    events.push({ type: "KeywordRemoved", ids, templateIds, keyword });
  }
  return { state: { ...state, hand }, events };
}
