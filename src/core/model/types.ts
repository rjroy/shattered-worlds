import type { RunModifiers } from "../../data/unlocks/types";
import type { RarityTier } from "./rarity";

export type CardId = string;

// Known template names (for documentation only — the type is open for JSON-loaded catalogs):
// 'Sprint' | 'Explore' | 'Barricade' | 'Med Kit' | 'Panic' | 'Adrenaline' | 'Listen' |
// 'Baseball Bat' | 'Regroup' | 'Summon Door' | 'Strange Sounds' | 'Rubble' | 'Screams' |
// 'Zombie' | 'Find Baseball Bat' | 'The Walker' | 'Door'
export type CardTemplateId = string;

export type KeywordName = "Obstructed" | "Creature" | "Slow" | "Spore" | "Concealed";

// A keyword as it lives on a minted card: a name plus an optional numeric
// value (e.g. "Concealed:3" authors as { name: "Concealed", value: 3 }).
// Bare keywords carry no value.
export type Keyword = { name: KeywordName; value?: number };

export type Dest = "playerDiscard" | "playerDrawTop" | "worldDraw" | "worldDrawTop";

export type CounterSpec =
  | { kind: "KeywordInHand"; keyword: KeywordName }
  | { kind: "FrozenPlayerCards" };

export type CardFxType = "Play" | "EndTurn" | "WhileVisible" | "Discard" | "Clear" | "PartialClear";

export type CardFx =
  // FX played once when the card is played
  | { kind: "Play"; key: string }
  // FX played once when the card is still in hand at the end of turn
  | { kind: "EndTurn"; key: string }
  // FX played in loop while the card is visible (legendary only)
  | { kind: "WhileVisible"; key: string }
  // FX played once when the card is discarded
  | { kind: "Discard"; key: string }
  // FX played once when the card is cleared
  | { kind: "Clear"; key: string }
  // FX played once when the card was partially cleared
  | { kind: "PartialClear"; key: string };

export type CardEffect =
  | {
      kind: "DealProgress";
      base: number;
      bonus?: { tag: KeywordName; amount: number };
    }
  | {
      kind: "DealProgressScaled";
      base: number;
      per: CounterSpec;
      amount: number;
    }
  | { kind: "Draw"; player?: number; world?: number }
  | { kind: "Heal"; amount: number }
  | { kind: "GainEnergy"; amount: number }
  | { kind: "ReturnWorldCards"; min: number; max: number }
  | { kind: "DestroyCardInHand"; min: number; max: number }
  | { kind: "DiscardThenDraw"; player: number }
  | { kind: "AddCard"; template: CardTemplateId; dest: Dest }
  | { kind: "AddWorldCardToDeck"; template: CardTemplateId; bTop?: boolean }
  | { kind: "AddThreatToWorldDeck" }
  | { kind: "Modal"; branches: readonly CardEffect[] }
  | { kind: "Sequence"; steps: readonly CardEffect[] }
  | { kind: "Damage"; amount: number }
  | { kind: "DamageScaled"; base: number; per: CounterSpec; amount: number }
  // Raises the player's global Light level. No target; mirrors GainEnergy/Heal.
  // Fog's exclusive signature effect: the only way to lift concealment.
  | { kind: "GainLight"; amount: number }
  | { kind: "GainCard"; template: CardTemplateId }
  // The rolled sibling of GainCard: draws one template from a named pool via
  // the weighted-draw kernel at resolution time and grants it to
  // playerDiscard by default. setName is authored per-effect-instance (not
  // derived from the pool) — it is the human label the action-preview layer
  // shows in place of the rolled card's identity (see D3 in the rarity plan).
  | { kind: "GainRandomCard"; setId: string; setName: string; bToDiscard?: boolean }
  | {
      kind: "OfferBoon";
      setId: string;
      setName: string;
      offeredCount: number;
      chooseCount: number;
      bToDiscard?: boolean;
    }
  | { kind: "AddPlayerCardToTop"; template: CardTemplateId }
  | { kind: "SurviveWorld" }
  // Queues a forced destruction of a random player card from the *next* hand.
  // Resolves at turn start after the hand refills (see resolveForceDestroy).
  | { kind: "ForceDestroy"; amount: number }
  // Removes the world card whose hook is firing (its selfId) from hand. Used by
  // onEndOfTurn to let a card degrade into another (Corpse → Zombie).
  | { kind: "DestroySelf" }
  | { kind: "None" }
  // Grants braceCharges that absorb ForceDestroy snatches before they can
  // destroy player cards. Charges persist across turns until consumed.
  | { kind: "Brace"; amount: number }
  // Applies progress to every world card currently in hand using a snapshot
  // taken at resolution time. Cards spawned mid-sweep (via onCleared) are not
  // included — the snapshot is frozen before the loop begins.
  | {
      kind: "DealProgressAll";
      base: number;
      bonus?: { tag: KeywordName; amount: number };
    }
  | { kind: "GainHeat"; amount: number }
  | { kind: "FreezeCards"; amount: number; duration: number }
  | { kind: "ThawCards"; amount: number; heatCost: number }
  // Permanently removes up to `amount` exilable cards from the top of worldDraw.
  // Non-exilable cards (canExile: false) are skipped in place; stops gracefully
  // when fewer exilable cards exist than amount.
  | { kind: "ExileTopWorldCards"; amount: number }
  // Tidal: the player-selected recall. Moves chosen cards from playerDiscard to
  // the top of playerDraw, preserving each card instance (no re-mint). The
  // chooser supplies the ids via PlayCard.recallIds; [min,max] bounds the
  // selection. min: 0 makes it an optional no-op.
  | { kind: "ReturnPlayerDiscardToTop"; min: number; max: number }
  // Tidal: the automatic recall fired by hazards and the world end-turn passive.
  // Picks `count ?? 1` cards from playerDiscard by `policy ?? "latest"` and moves
  // them to the top of playerDraw. Never played from hand.
  | {
      kind: "RecallPlayerDiscard";
      count?: number;
      policy?: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst";
    };

export interface PlayerCard {
  kind: "player";
  id: CardId;
  templateId: CardTemplateId;
  name: string;
  insetKey: string | undefined;
  sourceWorldId: string;
  effect: CardEffect;
  energyCost: number;
  // When true, the card is marked as modified due to an unlock.
  modified?: boolean;
  // When true, the card is destroyed (sent to no zone) on play instead of
  // recycling to playerDiscard.
  exhaust?: boolean;
  // Whiteout-only transient instance state. Positive values mean the card is
  // locked for that many turn-start thaw ticks; absent/0 means playable.
  frozen?: number;
  // Always present on minted cards (empty when the template omits keywords),
  // matching WorldCard so consumers never need undefined checks.
  keywords: readonly Keyword[];
  // Always concrete on minted cards (template.rarity ?? "common").
  rarity: RarityTier;
  fx?: CardFx[];
}

export interface WorldCard {
  kind: "world";
  id: CardId;
  templateId: CardTemplateId;
  name: string;
  insetKey: string | undefined;
  cost: number;
  keywords: readonly Keyword[];
  discardable: boolean;
  // When false, ExileTopWorldCards skips this card in place. Defaults to true
  // at mint time (template.canExile ?? true). Set to false for persistent cards
  // like Door and The Walker that should never be permanently removed.
  canExile: boolean;
  onDiscarded: CardEffect;
  onCleared: CardEffect;
  onEndOfTurn: CardEffect;
  onPartialClear: CardEffect;
  // Always concrete on minted cards (template.rarity ?? "common").
  rarity: RarityTier;
  fx?: CardFx[];
}

export type Card = PlayerCard | WorldCard;

export type Action =
  | {
      type: "PlayCard";
      cardId: CardId;
      targetId?: CardId;
      choice?: number;
      returnIds?: readonly CardId[];
      destroyIds?: readonly CardId[];
      thawIds?: readonly CardId[];
      discardId?: CardId;
      // Player-selected discard ids for ReturnPlayerDiscardToTop (Tidal).
      recallIds?: readonly CardId[];
    }
  | { type: "DiscardHazard"; cardId: CardId }
  | { type: "EndTurn" }
  | { type: "ChooseBoon"; templateId: CardTemplateId };

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export type TurnPlayHistory = {
  readonly cardsPlayedThisTurn: number;
  readonly byTemplateId: Readonly<Record<CardTemplateId, number>>;
};

export interface GameState {
  playerDraw: readonly Card[];
  hand: readonly Card[];
  playerDiscard: readonly Card[];
  worldDraw: readonly WorldCard[];
  acts: readonly (readonly WorldCard[])[];
  actIndex: number;
  totalActs: number;
  progress: Readonly<Record<CardId, number>>;
  hp: number;
  energy: number;
  // The player's global Light level. A standing resource (not a pool): seeing
  // is free, light is only spent by turn-start decay and raised by GainLight.
  // A world card is concealed iff its Concealed:N depth exceeds `light`.
  // Non-Fog worlds run with light === 0 throughout (startLight defaults to 0),
  // which keeps decay (emit-on-change) and concealment no-ops everywhere but Fog.
  light: number;
  // Spendable warmth used by Whiteout thaw effects. Non-heat worlds may carry
  // a number from unlocks, but it has no local meaning unless the world uses it.
  heat: number;
  // Count of random player cards to destroy from the next refilled hand.
  // Queued by the ForceDestroy effect; drained at turn start.
  pendingForceDestroy: number;
  // Id of a world card that queued the pending destroy. ForceDestroy defers its
  // CardDestroyed/BraceConsumed events to turn start (resolveForceDestroy), past
  // the applyEffect provenance boundary, so the queuing card's id is carried
  // here and stamped onto those deferred events. The first queuing card wins;
  // the preview decides whether that source is concealed. Cleared (set back to
  // undefined) whenever pendingForceDestroy resets to 0, so the `| undefined` is
  // explicit to allow that reset under exactOptionalPropertyTypes.
  pendingForceDestroySource?: CardId | undefined;
  // Charges that absorb ForceDestroy snatches before they destroy player
  // cards. Granted by the Brace effect; consumed in resolveForceDestroy.
  braceCharges: number;
  pendingBoonChoices: readonly PendingBoonChoice[];
  // The per-world end-turn passive, threaded onto state once by createWorld
  // (reduce() does not receive WorldData). Defaults to { kind: "None" } for
  // every world except those that author onEndOfTurnPassive (Tidal Memory).
  endOfTurnPassive: CardEffect;
  readonly runModifiers: RunModifiers;
  readonly turnPlayHistory: TurnPlayHistory;
  status: "playing" | "won" | "lost";
  worldId: string;
  rng: RngState;
  nextId: number;
}

export type BoonChoiceSource = "act" | "worldClear";

export type BoonOffered =
  | {
      readonly type: "BoonOffered";
      readonly source: "act";
      readonly setId: string;
      readonly setName: string;
      readonly templateIds: readonly CardTemplateId[];
      // Index-aligned with templateIds: rarities[i] is the rarity of templateIds[i].
      readonly rarities: readonly RarityTier[];
      readonly act: number;
    }
  | {
      readonly type: "BoonOffered";
      readonly source: "worldClear";
      readonly setId: string;
      readonly setName: string;
      readonly templateIds: readonly CardTemplateId[];
      // Index-aligned with templateIds: rarities[i] is the rarity of templateIds[i].
      readonly rarities: readonly RarityTier[];
      readonly act?: never;
    };

export type PendingBoonChoice = {
  readonly source: BoonChoiceSource;
  readonly act?: number;
  readonly setId: string;
  readonly setName: string;
  readonly offeredTemplateIds: readonly CardTemplateId[];
  readonly chooseCount: number;
  readonly bToDiscard: boolean;
};

export type TargetSpec =
  | { kind: "none" }
  | { kind: "hazard"; tag?: KeywordName }
  | { kind: "modal"; branches: readonly TargetSpec[] }
  | { kind: "returnWorld"; min: number; max: number }
  | { kind: "destroyHand"; min: number; max: number; maxCost?: number }
  | { kind: "thawHand"; amount: number; heatCost: number }
  | { kind: "discardPlayer" }
  // Tidal: selecting cards from playerDiscard for ReturnPlayerDiscardToTop.
  // Named recallTarget (not playerDiscard) to avoid colliding with the
  // discardPlayer spec, which means "discard a hand card" — the opposite intent.
  | { kind: "recallTarget"; min: number; max: number }
  | { kind: "compound"; steps: readonly TargetSpec[] };

export interface AvailableActions {
  playable: readonly { cardId: CardId; spec: TargetSpec }[];
  discardable: readonly CardId[];
  canEndTurn: boolean;
  legalTargets(cardId: CardId, step: number, choice?: number): readonly CardId[];
}

// Every GameEvent variant gains an optional `sourceCardId` via the trailing
// intersection. Intersection distributes over the union — `(A | B) & P` is
// `(A & P) | (B & P)` — so each variant keeps its `type` discriminant and also
// carries optional provenance. It is stamped at the applyEffect boundary
// (effects.ts) with the id of the world card whose hook emitted the event, so
// the preview layer can mask events that come from concealed sources without
// re-deriving the reducer's emission pattern. Player-played effects leave it
// undefined.
export type GameEvent = (
  | {
      type: "CardPlayed";
      cardId: CardId;
      templateId: CardTemplateId;
      templateOrdinalThisTurn: number;
    }
  | {
      type: "ProgressDealt";
      hazardId: CardId;
      templateId: CardTemplateId;
      amount: number;
      hazardTurnTotal: number;
    }
  | { type: "HazardResolved"; hazardId: CardId; templateId: CardTemplateId }
  | { type: "HazardPartial"; hazardId: CardId; templateId: CardTemplateId }
  | { type: "HazardDiscarded"; cardId: CardId; templateId: CardTemplateId }
  | { type: "DamageDealt"; amount: number }
  | {
      type: "CardGained";
      id: CardId;
      templateId: CardTemplateId;
      dest: Dest;
      rarity: RarityTier;
      // Set only by GainRandomCardHandler, naming the pool the card was
      // rolled from. Every fixed-reward source (AddCard, GainCard,
      // AddPlayerCardToTop, AddWorldCardToDeck, AddThreatToWorldDeck) leaves
      // this undefined. The action-preview layer (D3) branches on its
      // presence to mask the rolled template's identity before commit.
      setName?: string;
    }
  | { type: "CardDestroyed"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "WorldCardsReturned"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "HpChanged"; hp: number }
  | { type: "EnergyChanged"; energy: number }
  | { type: "LightChanged"; light: number }
  | { type: "HeatChanged"; heat: number; delta: number }
  | { type: "CardsFrozen"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "CardsThawed"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "CardsBurnedForHeat"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "CardsDiscarded"; cardIds: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "DeckShuffled" }
  | { type: "ActAdvanced"; act: number }
  | BoonOffered
  | {
      type: "BoonCardGranted";
      cardId: CardId;
      templateId: CardTemplateId;
      dest: "hand" | "playerDiscard";
      rarity: RarityTier;
    }
  | {
      type: "CardsDrawn";
      ids: readonly CardId[];
      templateIds: readonly CardTemplateId[];
      bHazard: boolean;
    }
  | { type: "TurnEnded" }
  | { type: "WorldWon" }
  | { type: "WorldLost" }
  | { type: "BraceChanged"; braceCharges: number }
  | { type: "BraceConsumed"; absorbed: number; remaining: number }
  | { type: "WorldCardsExiled"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "HealReceived"; amount: number }
  | { type: "HazardAdded"; templateId: CardTemplateId }
  | {
      type: "PlayerDiscardRecalled";
      cardIds: readonly CardId[];
      templateIds: readonly CardTemplateId[];
      source: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst" | "playerSelected";
      dest: "playerDrawTop";
    }
) & { readonly sourceCardId?: CardId };
