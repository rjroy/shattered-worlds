import type {
  PlayerCardModifierComparison,
  PlayerCardModifierCondition,
  PlayerCardPatch,
  PlayerCardModifierTarget,
} from "../../data/unlocks/types";
import type { Card, CardEffect, GameState, Keyword, PlayerCard } from "../model/types";

export function effectivePlayerCard(card: PlayerCard, state: GameState): PlayerCard {
  let effective: PlayerCard = clonePlayerCard(card);

  for (const modifier of state.runModifiers.playerCardModifiers) {
    if (!matchesTarget(card, modifier.target)) continue;
    if (!conditionApplies(card, state, modifier.condition)) continue;

    effective.name = modifier.displayName;
    effective.modified = true;
    for (const patch of modifier.patches) {
      effective = applyPatch(effective, patch);
    }
  }

  return {
    ...effective,
    id: card.id,
    templateId: card.templateId,
    sourceWorldId: card.sourceWorldId,
    energyCost: normalizeEnergyCost(effective.energyCost),
  };
}

export function effectiveCard(card: Card, state: GameState): Card {
  return card.kind === "player" ? effectivePlayerCard(card, state) : card;
}

export function effectiveHand(state: GameState): readonly Card[] {
  return state.hand.map((card) => effectiveCard(card, state));
}

function clonePlayerCard(card: PlayerCard): PlayerCard {
  return {
    ...card,
    effect: cloneEffect(card.effect),
    keywords: card.keywords.map(cloneKeyword),
  };
}

function cloneKeyword(keyword: Keyword): Keyword {
  return keyword.value === undefined
    ? { name: keyword.name }
    : { name: keyword.name, value: keyword.value };
}

function matchesTarget(card: PlayerCard, target: PlayerCardModifierTarget): boolean {
  switch (target.kind) {
    case "template":
      return card.templateId === target.templateId;
  }
}

function conditionApplies(
  card: PlayerCard,
  state: GameState,
  condition: PlayerCardModifierCondition,
): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "templatePlayOrdinalThisTurn":
      return templateOrdinalThisTurn(card, state) === condition.ordinal;
    case "anyPlayOrdinalThisTurn":
      return state.turnPlayHistory.cardsPlayedThisTurn + 1 === condition.ordinal;
    case "hp":
      return compareValue(state.hp, condition.comparison, condition.value);
    case "resource":
      return compareValue(
        resourceValue(state, condition.resource),
        condition.comparison,
        condition.value,
      );
    case "and":
      return condition.conditions.every((child) => conditionApplies(card, state, child));
    case "or":
      return condition.conditions.some((child) => conditionApplies(card, state, child));
    case "not":
      return !conditionApplies(card, state, condition.condition);
  }
}

function templateOrdinalThisTurn(card: PlayerCard, state: GameState): number {
  return (state.turnPlayHistory.byTemplateId[card.templateId] ?? 0) + 1;
}

function resourceValue(
  state: GameState,
  resource: Extract<PlayerCardModifierCondition, { kind: "resource" }>["resource"],
): number {
  switch (resource) {
    case "energy":
      return state.energy;
    case "light":
      return state.light;
    case "heat":
      return state.heat;
    case "brace":
      return state.braceCharges;
  }
}

function compareValue(
  actual: number,
  comparison: PlayerCardModifierComparison,
  expected: number,
): boolean {
  switch (comparison) {
    case "lessThan":
      return actual < expected;
    case "lessThanOrEqual":
      return actual <= expected;
    case "equal":
      return actual === expected;
    case "greaterThanOrEqual":
      return actual >= expected;
    case "greaterThan":
      return actual > expected;
  }
}

function applyPatch(card: PlayerCard, patch: PlayerCardPatch): PlayerCard {
  switch (patch.kind) {
    case "setEnergyCost":
      return { ...card, energyCost: normalizeEnergyCost(patch.energyCost) };
    case "addEnergyCost":
      return { ...card, energyCost: normalizeEnergyCost(card.energyCost + patch.amount) };
    case "setExhaust":
      return { ...card, exhaust: patch.exhaust };
    case "replaceEffect":
      return { ...card, effect: cloneEffect(patch.effect) };
    case "prependEffect":
      return { ...card, effect: composeEffects(patch.effect, card.effect) };
    case "appendEffect":
      return { ...card, effect: composeEffects(card.effect, patch.effect) };
    case "addKeyword":
      return { ...card, keywords: [...card.keywords, cloneKeyword(patch.keyword)] };
    case "rename":
      return { ...card, name: patch.name };
  }
}

function normalizeEnergyCost(cost: number): number {
  return Math.max(0, Math.trunc(cost));
}

export function composeEffects(first: CardEffect, second: CardEffect): CardEffect {
  return {
    kind: "Sequence",
    steps: [...flattenSequence(first), ...flattenSequence(second)],
  };
}

function flattenSequence(effect: CardEffect): CardEffect[] {
  const cloned = cloneEffect(effect);
  return cloned.kind === "Sequence" ? [...cloned.steps] : [cloned];
}

function cloneEffect(effect: CardEffect): CardEffect {
  switch (effect.kind) {
    case "DealProgress":
      return cloneDealProgress(effect);
    case "DealProgressScaled":
      return { ...effect, per: { ...effect.per } };
    case "Draw":
      return { ...effect };
    case "Heal":
      return { ...effect };
    case "GainEnergy":
      return { ...effect };
    case "ReturnWorldCards":
      return { ...effect };
    case "DestroyCardInHand":
      return { ...effect };
    case "DiscardThenDraw":
      return { ...effect };
    case "AddCard":
      return { ...effect };
    case "AddWorldCardToDeck":
      return { ...effect };
    case "AddThreatToWorldDeck":
      return { ...effect };
    case "Modal":
      return { kind: "Modal", branches: effect.branches.map(cloneEffect) };
    case "Sequence":
      return { kind: "Sequence", steps: effect.steps.map(cloneEffect) };
    case "Damage":
      return { ...effect };
    case "DamageScaled":
      return { ...effect, per: { ...effect.per } };
    case "GainLight":
      return { ...effect };
    case "GainCard":
      return { ...effect };
    case "GainRandomCard":
      return { ...effect };
    case "OfferBoon":
      return { ...effect };
    case "AddPlayerCardToTop":
      return { ...effect };
    case "SurviveWorld":
      return { ...effect };
    case "ForceDestroy":
      return { ...effect };
    case "DestroySelf":
      return { ...effect };
    case "None":
      return { ...effect };
    case "Brace":
      return { ...effect };
    case "DealProgressAll":
      return cloneDealProgressAll(effect);
    case "GainHeat":
      return { ...effect };
    case "FreezeCards":
      return { ...effect };
    case "ThawCards":
      return { ...effect };
    case "ExileTopWorldCards":
      return { ...effect };
    case "ReturnPlayerDiscardToTop":
      return { ...effect };
    case "RecallPlayerDiscard":
      return { ...effect };
    case "ApplyKeyword":
      return { ...effect };
    // Gates carry a nested `then` effect — deep-clone it so the clone shares no
    // mutable child with the original.
    case "KeywordGate":
      return { ...effect, then: cloneEffect(effect.then) };
    case "ProgressGate":
      return { ...effect, then: cloneEffect(effect.then) };
    case "RemoveKeyword":
      return { ...effect };
    case "GainAlarmGuard":
      return { ...effect };
  }
}

function cloneDealProgress(effect: Extract<CardEffect, { kind: "DealProgress" }>): CardEffect {
  const bonus = effect.bonus === undefined ? undefined : { ...effect.bonus };
  return bonus === undefined
    ? { kind: "DealProgress", base: effect.base }
    : { kind: "DealProgress", base: effect.base, bonus };
}

function cloneDealProgressAll(
  effect: Extract<CardEffect, { kind: "DealProgressAll" }>,
): CardEffect {
  const bonus = effect.bonus === undefined ? undefined : { ...effect.bonus };
  return bonus === undefined
    ? { kind: "DealProgressAll", base: effect.base }
    : { kind: "DealProgressAll", base: effect.base, bonus };
}
