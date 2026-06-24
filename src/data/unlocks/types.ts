import type { CardEffect, CardTemplateId, Keyword } from "../../core/model/types";

export type PlayerCardModifier = {
  readonly id: string;
  readonly target: PlayerCardModifierTarget;
  readonly displayName: string;
  readonly condition: PlayerCardModifierCondition;
  readonly patches: readonly PlayerCardPatch[];
};

export type PlayerCardModifierTarget = {
  readonly kind: "template";
  readonly templateId: CardTemplateId;
};

export type PlayerCardModifierComparison =
  | "lessThan"
  | "lessThanOrEqual"
  | "equal"
  | "greaterThanOrEqual"
  | "greaterThan";

export type PlayerCardModifierCondition =
  | { readonly kind: "always" }
  | { readonly kind: "templatePlayOrdinalThisTurn"; readonly ordinal: number }
  | { readonly kind: "anyPlayOrdinalThisTurn"; readonly ordinal: number }
  | {
      readonly kind: "hp";
      readonly comparison: PlayerCardModifierComparison;
      readonly value: number;
    }
  | {
      readonly kind: "resource";
      readonly resource: "energy" | "light" | "heat" | "brace";
      readonly comparison: PlayerCardModifierComparison;
      readonly value: number;
    }
  | { readonly kind: "and"; readonly conditions: readonly PlayerCardModifierCondition[] }
  | { readonly kind: "or"; readonly conditions: readonly PlayerCardModifierCondition[] }
  | { readonly kind: "not"; readonly condition: PlayerCardModifierCondition };

export type PlayerCardPatch =
  | { readonly kind: "setEnergyCost"; readonly energyCost: number }
  | { readonly kind: "addEnergyCost"; readonly amount: number }
  | { readonly kind: "setExhaust"; readonly exhaust: boolean }
  | { readonly kind: "replaceEffect"; readonly effect: CardEffect }
  | { readonly kind: "prependEffect"; readonly effect: CardEffect }
  | { readonly kind: "appendEffect"; readonly effect: CardEffect }
  | { readonly kind: "addKeyword"; readonly keyword: Keyword }
  | { readonly kind: "rename"; readonly name: string };

export type RunModifiers = {
  readonly extraStartHp: number;
  readonly extraStartEnergy: number;
  readonly extraStartLight: number;
  readonly extraStartHeat: number;
  readonly extraStartBrace: number;
  readonly handSizeBonusPerAct: number;
  readonly minLightPerTurn: number;
  readonly minEnergyPerTurn: number;
  readonly rarityBonus: number;
  readonly keywordDamageBonus: number;
  readonly actBoon: {
    readonly poolId: string;
    readonly poolName: string;
    readonly poolTemplateIds: readonly string[];
    readonly offeredCount: number;
    readonly chooseCount: number;
    readonly bToDiscard?: boolean;
  } | null;
  readonly playerCardModifiers: readonly PlayerCardModifier[];
};

export const DEFAULT_RUN_MODIFIERS: RunModifiers = {
  extraStartHp: 0,
  extraStartEnergy: 0,
  extraStartLight: 0,
  extraStartHeat: 0,
  extraStartBrace: 0,
  handSizeBonusPerAct: 0,
  minLightPerTurn: 0,
  minEnergyPerTurn: 0,
  rarityBonus: 0,
  keywordDamageBonus: 0,
  actBoon: null,
  playerCardModifiers: [],
};

export type UnlockEffect =
  | {
      readonly type: "startingStat";
      readonly stat: "hp" | "energy" | "light" | "heat" | "brace";
      readonly amount: number;
    }
  | { readonly type: "handSizeBonus"; readonly amountPerAct: number }
  | {
      readonly type: "minResourcePerTurn";
      readonly resource: "energy" | "light";
      readonly floor: number;
    }
  | { readonly type: "rarityBonus"; readonly amount: number }
  | { readonly type: "keywordDamageBonus"; readonly amount: number }
  | { readonly type: "playerCardModifier"; readonly modifier: PlayerCardModifier }
  | { readonly type: "starterDeckOverride"; readonly starterDeckId: string }
  | { readonly type: "worldUnlock"; readonly worldId: string }
  | {
      readonly type: "actReward";
      readonly boonPoolId: string;
      readonly boonPoolName: string;
      readonly offeredCount: number;
      readonly chooseCount: number;
    };

export type UnlockDefinition = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly destinyWeight: number;
  readonly effect: UnlockEffect;
};
