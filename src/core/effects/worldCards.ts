import type { CardEffect, CardId, GameEvent, GameState, TargetSpec, WorldCard } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import { shuffle } from '../engine/rng'
import type { CompileContext, ConnectorStyle, EffectContext, EffectResult } from './EffectContext'
import { EffectHandler } from './EffectHandler'
import { icon, main, rangeText, text, value } from './tokens'
import { playerCardsInHand, worldCardsInHand } from './handState'

type ReturnWorldCardsEffect = Extract<CardEffect, { kind: 'ReturnWorldCards' }>
type DestroyCardInHandEffect = Extract<CardEffect, { kind: 'DestroyCardInHand' }>
type DestroySelfEffect = Extract<CardEffect, { kind: 'DestroySelf' }>
type ForceDestroyEffect = Extract<CardEffect, { kind: 'ForceDestroy' }>
type ExileTopWorldCardsEffect = Extract<CardEffect, { kind: 'ExileTopWorldCards' }>
type SurviveWorldEffect = Extract<CardEffect, { kind: 'SurviveWorld' }>

export function returnToActiveWorldDeck(state: GameState, ids: readonly CardId[]): EffectResult {
  if (ids.length === 0) {
    return { state, events: [] }
  }

  const returned: WorldCard[] = []
  for (const id of ids) {
    const card = state.hand.find((c): c is WorldCard => c.kind === 'world' && c.id === id)
    if (card !== undefined) returned.push(card)
  }

  if (returned.length === 0) {
    return { state, events: [] }
  }

  const returnedIds = returned.map((c) => c.id)
  const handAfter = state.hand.filter((c) => !returnedIds.includes(c.id))

  const pool: WorldCard[] = [...state.worldDraw, ...returned]
  const [shuffled, nextRng] = shuffle(pool, state.rng)

  const current: GameState = {
    ...state,
    rng: nextRng,
    hand: handAfter,
    worldDraw: shuffled,
  }

  const events: GameEvent[] = [{ type: 'WorldCardsReturned', ids: returnedIds }]
  return { state: current, events }
}

export function destroyInHand(state: GameState, ids: readonly CardId[]): EffectResult {
  if (ids.length === 0) return { state, events: [] }

  const exists = state.hand.some((c) => ids.includes(c.id))
  if (!exists) return { state, events: [] }

  const current: GameState = {
    ...state,
    hand: state.hand.filter((c) => !ids.includes(c.id)),
  }
  const events: GameEvent[] = [{ type: 'CardDestroyed', ids }]
  return { state: current, events }
}

export class ReturnWorldCardsHandler extends EffectHandler<ReturnWorldCardsEffect> {
  override apply(ctx: EffectContext, _effect: ReturnWorldCardsEffect): EffectResult {
    return returnToActiveWorldDeck(ctx.state, ctx.returnIds ?? [])
  }

  override describe(effect: ReturnWorldCardsEffect): string[] {
    return [describeReturn(effect.min, effect.max)]
  }

  override compile(effect: ReturnWorldCardsEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('return'), value(rangeText(effect.min, effect.max), 'reward')])]
  }

  override structuralSpec(effect: ReturnWorldCardsEffect): TargetSpec {
    return { kind: 'returnWorld', min: effect.min, max: effect.max }
  }

  override isPlayable(effect: ReturnWorldCardsEffect, state: GameState, _selfId: CardId): boolean {
    return !(effect.min > 0 && worldCardsInHand(state).length < effect.min)
  }

  override legalTargets(
    _effect: ReturnWorldCardsEffect,
    _selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    return worldCardsInHand(state).map((c) => c.id)
  }

  override connectorStyle(_effect: ReturnWorldCardsEffect): ConnectorStyle {
    return 'return'
  }
}

export class DestroyCardInHandHandler extends EffectHandler<DestroyCardInHandEffect> {
  override apply(ctx: EffectContext, _effect: DestroyCardInHandEffect): EffectResult {
    return destroyInHand(ctx.state, ctx.destroyIds ?? [])
  }

  override describe(effect: DestroyCardInHandEffect): string[] {
    const lines = [
      effect.max == 1 ? 'Destroy a card in hand' : `Destroy ${effect.min}–${effect.max} cards in hand`,
    ]
    if (effect.min == 0 && effect.max == 1) lines.push('(optional)')
    return lines
  }

  override compile(effect: DestroyCardInHandEffect, _ctx: CompileContext): EffectLine[] {
    const count = effect.max === 1 ? '1' : rangeText(effect.min, effect.max)
    const lines = [main([icon('destroy'), value(count, 'penalty'), text('in hand')])]
    if (effect.min === 0 && effect.max === 1) lines.push({ tokens: [text('(optional)')], role: 'rider' })
    return lines
  }

  override structuralSpec(effect: DestroyCardInHandEffect): TargetSpec {
    return { kind: 'destroyHand', min: effect.min, max: effect.max }
  }

  override isPlayable(effect: DestroyCardInHandEffect, state: GameState, _selfId: CardId): boolean {
    return playerCardsInHand(state).length > effect.min
  }

  override legalTargets(
    _effect: DestroyCardInHandEffect,
    selfId: CardId,
    state: GameState,
  ): readonly CardId[] {
    return playerCardsInHand(state)
      .filter((c) => c.id !== selfId)
      .map((c) => c.id)
  }

  override connectorStyle(_effect: DestroyCardInHandEffect): ConnectorStyle {
    return 'destroy'
  }
}

export class DestroySelfHandler extends EffectHandler<DestroySelfEffect> {
  override apply(ctx: EffectContext, _effect: DestroySelfEffect): EffectResult {
    return destroyInHand(ctx.state, ctx.selfId ? [ctx.selfId] : [])
  }

  override describe(_effect: DestroySelfEffect): string[] {
    return ['vanishes']
  }

  override compile(_effect: DestroySelfEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('vanish')])]
  }

  override isPlayable(): boolean {
    return false
  }
}

export class ForceDestroyHandler extends EffectHandler<ForceDestroyEffect> {
  override apply(ctx: EffectContext, effect: ForceDestroyEffect): EffectResult {
    const current: GameState = {
      ...ctx.state,
      pendingForceDestroy: ctx.state.pendingForceDestroy + effect.amount,
    }
    return { state: current, events: [] }
  }

  override describe(_effect: ForceDestroyEffect): string[] {
    return ['destroy a random card from your next hand']
  }

  override compile(_effect: ForceDestroyEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('destroy'), text('random, next hand')])]
  }

  override isPlayable(): boolean {
    return false
  }
}

export class ExileTopWorldCardsHandler extends EffectHandler<ExileTopWorldCardsEffect> {
  override apply(ctx: EffectContext, effect: ExileTopWorldCardsEffect): EffectResult {
    let remaining = effect.amount
    const exiledIds: CardId[] = []
    const nextDraw: WorldCard[] = []

    for (const card of ctx.state.worldDraw) {
      if (remaining > 0 && card.canExile) {
        exiledIds.push(card.id)
        remaining--
      } else {
        nextDraw.push(card)
      }
    }

    if (exiledIds.length === 0) {
      return { state: ctx.state, events: [] }
    }

    const current: GameState = { ...ctx.state, worldDraw: nextDraw }
    const events: GameEvent[] = [{ type: 'WorldCardsExiled', ids: exiledIds }]
    return { state: current, events }
  }

  override describe(effect: ExileTopWorldCardsEffect): string[] {
    return [`Exile the top ${effect.amount} card${effect.amount === 1 ? '' : 's'} of the world deck`]
  }

  override compile(effect: ExileTopWorldCardsEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('exile'), text('top'), value(`${effect.amount}`)])]
  }

  override isPlayable(_effect: ExileTopWorldCardsEffect, state: GameState, _selfId: CardId): boolean {
    return state.worldDraw.some((c) => c.canExile)
  }
}

export class SurviveWorldHandler extends EffectHandler<SurviveWorldEffect> {
  override apply(ctx: EffectContext, _effect: SurviveWorldEffect): EffectResult {
    const current: GameState = { ...ctx.state, status: 'won' }
    const events: GameEvent[] = [{ type: 'WorldWon' }]
    return { state: current, events }
  }

  override describe(_effect: SurviveWorldEffect): string[] {
    return ['you survive the world']
  }

  override compile(_effect: SurviveWorldEffect, _ctx: CompileContext): EffectLine[] {
    return [main([icon('survive'), text('SURVIVE!')])]
  }

  override isPlayable(): boolean {
    return false
  }
}

function describeReturn(min: number, max: number): string {
  const count = min === max ? `${min}` : `${min}–${max}`
  const noun = max === 1 ? 'world card' : 'world cards'
  return `Return ${count} ${noun} to the deck`
}
