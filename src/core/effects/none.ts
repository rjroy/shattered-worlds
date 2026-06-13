import type { CardEffect } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import type { CompileContext, EffectContext, EffectResult } from './EffectContext'
import { EffectHandler } from './EffectHandler'

type NoneEffect = Extract<CardEffect, { kind: 'None' }>

export class NoneHandler extends EffectHandler<NoneEffect> {
  override apply(ctx: EffectContext, _effect: NoneEffect): EffectResult {
    return { state: ctx.state, events: [] }
  }

  override describe(_effect: NoneEffect): string[] {
    return ['no effect']
  }

  override compile(_effect: NoneEffect, _ctx: CompileContext): EffectLine[] {
    return []
  }
}
