export type RunModifiers = {
  readonly extraStartHp: number;
  readonly extraStartEnergy: number;
  readonly extraStartLight: number;
  readonly extraStartHeat: number;
  readonly extraStartBrace: number;
  readonly handSizeBonusPerAct: number;
  readonly minLightPerTurn: number;
  readonly minEnergyPerTurn: number;
  readonly keywordDamageBonus: number;
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
  keywordDamageBonus: 0,
};

export type UnlockEffect =
  | { readonly type: "startingStat"; readonly stat: "hp" | "energy" | "light" | "heat" | "brace"; readonly amount: number }
  | { readonly type: "handSizeBonus"; readonly amountPerAct: number }
  | { readonly type: "minResourcePerTurn"; readonly resource: "energy" | "light"; readonly floor: number }
  | { readonly type: "keywordDamageBonus"; readonly amount: number }
  | { readonly type: "starterDeckOverride"; readonly starterDeckId: string }
  | { readonly type: "actReward"; readonly offeredCount: number };

export type UnlockDefinition = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly destinyWeight: number;
  readonly effect: UnlockEffect;
};
