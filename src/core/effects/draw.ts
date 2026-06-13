import type { CardEffect, CardId, GameEvent, GameState } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import { drawPlayer, drawWorld } from '../engine/draw'
import type { CompileContext, EffectContext, EffectResult } from './EffectContext'
import { EffectHandler } from './EffectHandler'
import { icon, main, text, value } from './tokens'
import { playerCardsInHand } from './handState'

type DrawEffect = Extract<CardEffect, { kind: 'Draw' }>
type DiscardThenDrawEffect = Extract<CardEffect, { kind: 'DiscardThenDraw' }>

export class DrawHandler extends EffectHandler<DrawEffect> {
  override apply(ctx: EffectContext, effect: DrawEffect): EffectResult {
    const playerCount = effect.player ?? 0
    const worldCount = effect.world ?? 0
    const events: GameEvent[] = []
    let current = ctx.state

    if (playerCount > 0) {
      const r = drawPlayer(current, playerCount)
      current = r.state
      events.push(...r.events)
    }
    if (worldCount > 0) {
      const r = drawWorld(current, worldCount)
      current = r.state
      events.push(...r.events)
    }

    return { state: current, events }
  }

  override describe(effect: DrawEffect): string[] {
    const parts: string[] = []
    if (effect.player !== undefined && effect.player > 0) parts.push(`Draw ${effect.player}`)
    if (effect.world !== undefined && effect.world > 0) parts.push(`+${effect.world} world`)
    return [parts.length > 0 ? parts.join(', ') : 'Draw nothing']
  }

  override compile(effect: DrawEffect, _ctx: CompileContext): EffectLine[] {
    const tokens: EffectLine['tokens'] = []
    if (effect.player !== undefined && effect.player > 0) {
      tokens.push(icon('draw'), value(`${effect.player}`, 'reward'))
    }
    if (effect.world !== undefined && effect.world > 0) {
      if (tokens.length > 0) tokens.push(text('·'))
      tokens.push(icon('worldDraw'), value(`${effect.world}`, 'penalty'))
    }
    return [main(tokens.length > 0 ? tokens : [text('draw nothing')])]
  }
}

export class DiscardThenDrawHandler extends EffectHandler<DiscardThenDrawEffect> {
  override apply(ctx: EffectContext, effect: DiscardThenDrawEffect): EffectResult {
    const discardId = ctx.discardId
    if (discardId === undefined) return { state: ctx.state, events: [] }

    const discardedCard = ctx.state.hand.find((c) => c.id === discardId)
    if (discardedCard === undefined) return { state: ctx.state, events: [] }

    const afterDiscard: GameState = {
      ...ctx.state,
      hand: ctx.state.hand.filter((c) => c.id !== discardId),
      playerDiscard: [discardedCard, ...ctx.state.playerDiscard],
    }

    const drawResult = drawPlayer(afterDiscard, effect.player)
    return {
      state: drawResult.state,
      events: [{ type: 'CardsDiscarded', cardIds: [discardId] }, ...drawResult.events],
    }
  }

  override describe(effect: DiscardThenDrawEffect): string[] {
    return [`Discard a card, then draw ${effect.player}`]
  }

  override compile(effect: DiscardThenDrawEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('discard'), value('1'), text('→'), icon('draw'), value(`${effect.player}`)])]
  }

  override structuralSpec(_effect: DiscardThenDrawEffect) {
    return { kind: 'discardPlayer' } as const
  }

  override isPlayable(_effect: DiscardThenDrawEffect, state: GameState, selfId: CardId): boolean {
    return playerCardsInHand(state).some((c) => c.id !== selfId)
  }

  override legalTargets(
    _effect: DiscardThenDrawEffect,
    selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    return playerCardsInHand(state)
      .filter((c) => c.id !== selfId)
      .map((c) => c.id)
  }
}
