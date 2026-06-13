/**
 * The effect-handler registry: one stateless handler singleton per `kind`,
 * indexed by `effect.kind`. Dispatchers (`applyEffect`, `describeEffect`,
 * `compileEffect`, and the `available.ts` targeting selectors) look a handler up
 * here and delegate to it; the per-kind switch bodies remain only as a
 * transitional fallback for kinds not yet registered (Step 5). Step 7 tightens
 * `EFFECTS` to the exhaustive mapped type and deletes those switches.
 *
 * Pure core — no Phaser, no DOM. Lint enforces the boundary.
 */
import type { CardEffect } from '../model/types'
import type { EffectHandler } from './EffectHandler'
import type { ConnectorStyle } from './EffectContext'
import { ModalHandler, SequenceHandler } from './composite'
import { DealProgressHandler, DealProgressScaledHandler, DealProgressAllHandler } from './dealProgress'
import { DamageHandler, DamageScaledHandler } from './damage'
import { DiscardThenDrawHandler, DrawHandler } from './draw'
import {
  AddCardHandler,
  AddPlayerCardToTopHandler,
  AddThreatToWorldDeckHandler,
  AddWorldCardToDeckHandler,
  GainCardHandler,
} from './gainCard'
import { NoneHandler } from './none'
import { BraceHandler, GainEnergyHandler, HealHandler } from './resources'
import {
  DestroyCardInHandHandler,
  DestroySelfHandler,
  ExileTopWorldCardsHandler,
  ForceDestroyHandler,
  ReturnWorldCardsHandler,
  SurviveWorldHandler,
} from './worldCards'

/**
 * The exhaustive handler index. A missing `CardEffect["kind"]` is a compile
 * error, so adding a kind requires adding its one handler and one registry line.
 */
export const EFFECTS: {
  [K in CardEffect['kind']]: EffectHandler<Extract<CardEffect, { kind: K }>>
} = {
  Modal: new ModalHandler(),
  Sequence: new SequenceHandler(),
  DealProgress: new DealProgressHandler(),
  DealProgressScaled: new DealProgressScaledHandler(),
  DealProgressAll: new DealProgressAllHandler(),
  Draw: new DrawHandler(),
  DiscardThenDraw: new DiscardThenDrawHandler(),
  Heal: new HealHandler(),
  GainEnergy: new GainEnergyHandler(),
  Brace: new BraceHandler(),
  Damage: new DamageHandler(),
  DamageScaled: new DamageScaledHandler(),
  AddCard: new AddCardHandler(),
  GainCard: new GainCardHandler(),
  AddPlayerCardToTop: new AddPlayerCardToTopHandler(),
  AddWorldCardToDeck: new AddWorldCardToDeckHandler(),
  AddThreatToWorldDeck: new AddThreatToWorldDeckHandler(),
  ReturnWorldCards: new ReturnWorldCardsHandler(),
  DestroyCardInHand: new DestroyCardInHandHandler(),
  DestroySelf: new DestroySelfHandler(),
  ForceDestroy: new ForceDestroyHandler(),
  ExileTopWorldCards: new ExileTopWorldCardsHandler(),
  SurviveWorld: new SurviveWorldHandler(),
  None: new NoneHandler(),
}

export function connectorStyleOf(effect: CardEffect): ConnectorStyle | null {
  const style = EFFECTS[effect.kind].connectorStyle(effect as never)
  if (style !== null) return style

  if (effect.kind === 'Modal') {
    for (const branch of effect.branches) {
      const branchStyle = connectorStyleOf(branch)
      if (branchStyle !== null) return branchStyle
    }
  }

  if (effect.kind === 'Sequence') {
    for (const step of effect.steps) {
      const stepStyle = connectorStyleOf(step)
      if (stepStyle !== null) return stepStyle
    }
  }

  return null
}
