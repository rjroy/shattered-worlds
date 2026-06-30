import type { CardEffect, GameEvent, GameState } from "../model/types";
import type { EffectLine } from "../view/effectGlyphs";
import type { PreviewEventSummary, PreviewFormatContext } from "../view/previewFormat";
import type { CompileContext, EffectContext, EffectResult } from "./EffectContext";
import { EffectHandler } from "./EffectHandler";
import { counterLabel, icon, main, perRider, value } from "./tokens";
import { resolveCounter } from "./dealProgress";

type DamageEffect = Extract<CardEffect, { kind: "Damage" }>;
type DamageScaledEffect = Extract<CardEffect, { kind: "DamageScaled" }>;

export function previewDamageEvent(
  event: GameEvent,
  _context: PreviewFormatContext,
): PreviewEventSummary {
  if (event.type !== "DamageDealt") return null;
  return [`Take ${event.amount} damage`];
}

export function damage(state: GameState, n: number): EffectResult {
  const newHp = state.hp - n;
  const events: GameEvent[] = [
    { type: "DamageDealt", amount: n },
    { type: "HpChanged", hp: newHp },
  ];

  let current: GameState = { ...state, hp: newHp };

  if (newHp <= 0) {
    current = { ...current, status: "lost" };
    events.push({ type: "WorldLost", cause: "hp" });
  }

  return { state: current, events };
}

export class DamageHandler extends EffectHandler<DamageEffect> {
  override apply(ctx: EffectContext, effect: DamageEffect): EffectResult {
    return damage(ctx.state, effect.amount);
  }

  override describe(effect: DamageEffect): string[] {
    return [`-${effect.amount} HP`];
  }

  override compile(effect: DamageEffect, _ctx: CompileContext): EffectLine[] {
    return [main([value(`−${effect.amount}`, "penalty"), icon("hp")])];
  }
}

export class DamageScaledHandler extends EffectHandler<DamageScaledEffect> {
  override apply(ctx: EffectContext, effect: DamageScaledEffect): EffectResult {
    const amount = effect.base + effect.amount * resolveCounter(ctx.state, effect.per);
    return damage(ctx.state, amount);
  }

  override describe(effect: DamageScaledEffect): string[] {
    return [`-${effect.base} HP`, `-${effect.amount} per ${counterLabel(effect.per)}`];
  }

  override compile(effect: DamageScaledEffect, _ctx: CompileContext): EffectLine[] {
    return [
      main([value(`−${effect.base}`, "penalty"), icon("hp")]),
      perRider("−", effect.amount, effect.per),
    ];
  }
}
