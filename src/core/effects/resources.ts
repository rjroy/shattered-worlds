import type { CardEffect, GameState } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import type { CompileContext, EffectContext, EffectResult } from './EffectContext'
import { EffectHandler } from './EffectHandler'
import { icon, main, value } from './tokens'

type HealEffect = Extract<CardEffect, { kind: 'Heal' }>
type GainEnergyEffect = Extract<CardEffect, { kind: 'GainEnergy' }>
type BraceEffect = Extract<CardEffect, { kind: 'Brace' }>

export function heal(state: GameState, n: number): EffectResult {
  const newHp = state.hp + n
  const current: GameState = { ...state, hp: newHp }
  return { state: current, events: [{ type: 'HpChanged', hp: newHp }] }
}

export function gainEnergy(state: GameState, n: number): EffectResult {
  const newEnergy = state.energy + n
  const current: GameState = { ...state, energy: newEnergy }
  return { state: current, events: [{ type: 'EnergyChanged', energy: newEnergy }] }
}

export class HealHandler extends EffectHandler<HealEffect> {
  override apply(ctx: EffectContext, effect: HealEffect): EffectResult {
    return heal(ctx.state, effect.amount)
  }

  override describe(effect: HealEffect): string[] {
    return [`Heal ${effect.amount} HP`]
  }

  override compile(effect: HealEffect, _ctx: CompileContext): EffectLine[] {
    return [main([value(`+${effect.amount}`, 'reward'), icon('hp')])]
  }
}

export class GainEnergyHandler extends EffectHandler<GainEnergyEffect> {
  override apply(ctx: EffectContext, effect: GainEnergyEffect): EffectResult {
    return gainEnergy(ctx.state, effect.amount)
  }

  override describe(effect: GainEnergyEffect): string[] {
    return [`Gain ${effect.amount} Energy`]
  }

  override compile(effect: GainEnergyEffect, _ctx: CompileContext): EffectLine[] {
    return [main([value(`+${effect.amount}`, 'reward'), icon('energy')])]
  }
}

export class BraceHandler extends EffectHandler<BraceEffect> {
  override apply(ctx: EffectContext, effect: BraceEffect): EffectResult {
    const newCharges = ctx.state.braceCharges + effect.amount
    const current: GameState = { ...ctx.state, braceCharges: newCharges }
    return { state: current, events: [{ type: 'BraceChanged', braceCharges: newCharges }] }
  }

  override describe(effect: BraceEffect): string[] {
    return [
      effect.amount === 1
        ? 'Brace: absorb the next snatch'
        : `Brace: absorb the next ${effect.amount} snatches`,
    ]
  }

  override compile(effect: BraceEffect, _ctx: CompileContext): EffectLine[] {
    return [main([value(`+${effect.amount}`, 'brace'), icon('brace')])]
  }
}
