/** The exhaustive effect-handler registry: one stateless handler per `kind`. */
import type { CardEffect } from "../model/types";
import type { EffectHandler } from "./EffectHandler";
import type { ConnectorStyle } from "./EffectContext";
import { ModalHandler, SequenceHandler } from "./composite";
import {
  DealProgressHandler,
  DealProgressScaledHandler,
  DealProgressAllHandler,
} from "./dealProgress";
import { DamageHandler, DamageScaledHandler } from "./damage";
import { DiscardThenDrawHandler, DrawHandler } from "./draw";
import {
  AddCardHandler,
  AddPlayerCardToTopHandler,
  AddThreatToWorldDeckHandler,
  AddWorldCardToDeckHandler,
  GainCardHandler,
} from "./gainCard";
import { NoneHandler } from "./none";
import { BraceHandler, GainEnergyHandler, GainLightHandler, HealHandler } from "./resources";
import {
  DestroyCardInHandHandler,
  DestroySelfHandler,
  ExileTopWorldCardsHandler,
  ForceDestroyHandler,
  ReturnWorldCardsHandler,
  SurviveWorldHandler,
} from "./worldCards";

export const EFFECTS: {
  [K in CardEffect["kind"]]: EffectHandler<Extract<CardEffect, { kind: K }>>;
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
  GainLight: new GainLightHandler(),
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
};

export function connectorStyleOf(effect: CardEffect): ConnectorStyle | null {
  const style = EFFECTS[effect.kind].connectorStyle(effect as never);
  if (style !== null) return style;

  if (effect.kind === "Modal") {
    for (const branch of effect.branches) {
      const branchStyle = connectorStyleOf(branch);
      if (branchStyle !== null) return branchStyle;
    }
  }

  if (effect.kind === "Sequence") {
    for (const step of effect.steps) {
      const stepStyle = connectorStyleOf(step);
      if (stepStyle !== null) return stepStyle;
    }
  }

  return null;
}
