import type { RunModifiers } from "../../data/unlocks/types";
import type { RarityTier } from "./rarity";

export type CardId = string;

// Known template names (for documentation only — the type is open for JSON-loaded catalogs):
// 'Sprint' | 'Explore' | 'Barricade' | 'Med Kit' | 'Panic' | 'Adrenaline' | 'Listen' |
// 'Baseball Bat' | 'Regroup' | 'Summon Door' | 'Strange Sounds' | 'Rubble' | 'Screams' |
// 'Zombie' | 'Find Baseball Bat' | 'The Walker' | 'Door'
export type CardTemplateId = string;

export type KeywordName =
  | "Obstructed"
  | "Creature"
  | "Slow"
  | "Spore"
  | "Concealed"
  | "Alarm"
  | "Lockdown";

// A keyword as it lives on a minted card: a name plus an optional numeric
// value (e.g. "Concealed:3" authors as { name: "Concealed", value: 3 }).
// Bare keywords carry no value.
export type Keyword = { name: KeywordName; value?: number };

export type PersistentModifier =
  | { kind: "ClearCostPerKeywordCount"; costPer: number }
  | { kind: "ClearCostPerOtherKeyword"; costPer: number }
  | { kind: "ClearCostPerSelfKeyword"; costPer: number };

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
  // The only way to lift concealment.
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
  // The player-selected recall. Moves chosen cards from playerDiscard to
  // the top of playerDraw, preserving each card instance (no re-mint). The
  // chooser supplies the ids via PlayCard.recallIds; [min,max] bounds the
  // selection. min: 0 makes it an optional no-op.
  | { kind: "ReturnPlayerDiscardToTop"; min: number; max: number }
  // The automatic recall fired by hazards and a world's end-turn passive.
  // Picks `count ?? 1` cards from playerDiscard by `policy ?? "latest"` and moves
  // them to the top of playerDraw. Never played from hand.
  | {
      kind: "RecallPlayerDiscard";
      count?: number;
      policy?: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst";
    }
  // Applied-keyword family. `ApplyKeyword` stamps a transient
  // keyword (e.g. Alarm) onto cards. `value` is the lifetime in turn-start ticks
  // (see appliedKeywords / tickAppliedKeywords). Targets:
  //   "hand"               — every card currently in hand
  //   "self"               — the world card whose hook is firing (ctx.selfId)
  //   "firstWorldCardInHand" — the world card in hand with the smallest mint id
  //   "randomWorldCardInHand" — a random world card in hand
  //   "nextWorldCard"      — deferred: stamps the next world card pulled into
  //                          hand (queued via pendingKeywordNextWorldCard, applied
  //                          in drawWorld), not any card present now.
  | {
      kind: "ApplyKeyword";
      keyword: KeywordName;
      value: number;
      target: "hand" | "nextWorldCard" | "self" | "firstWorldCardInHand" | "randomWorldCardInHand";
    }
  // Fires `then` only when at least `min` cards in `zone` carry `keyword`
  // (authored OR applied). An available keywordGuard charge absorbs the trigger:
  // the charge is spent and `then` is suppressed (the greed disruption is
  // defused). Below `min` it is a silent no-op.
  | { kind: "KeywordGate"; keyword: KeywordName; min: number; zone: "hand"; then: CardEffect }
  // Fires `then` only when progressDealtThisTurn >= min. A greed signal that
  // reads the per-turn progress meter; it never consumes keywordGuard.
  | { kind: "ProgressGate"; min: number; then: CardEffect }
  // Strips an applied `keyword` from up to `amount` cards in the hand, in
  // ascending mint-id order. Only removes applied entries, never authored ones.
  | { kind: "RemoveKeyword"; keyword: KeywordName; target: "hand"; amount: number }
  // Grants keywordGuard charges (a GameState counter, like braceCharges) that
  // absorb KeywordGate triggers.
  | { kind: "GainKeywordGuard"; amount: number };

export interface PlayerCard {
  kind: "player";
  id: CardId;
  templateId: CardTemplateId;
  name: string;
  insetKey: string | undefined;
  sourceWorldId: string;
  effect: CardEffect;
  canDestroy: boolean;
  energyCost: number;
  // When true, the card is marked as modified due to an unlock.
  modified?: boolean;
  // When true, the card is destroyed (sent to no zone) on play instead of
  // recycling to playerDiscard.
  exhaust?: boolean;
  // Transient instance state for freeze mechanics. Positive values mean the
  // card is locked for that many turn-start thaw ticks; absent/0 means playable.
  frozen?: number;
  // Always present on minted cards (empty when the template omits keywords),
  // matching WorldCard so consumers never need undefined checks.
  keywords: readonly Keyword[];
  // Transient keywords stamped at runtime (e.g. Alarm), distinct from the
  // authored `keywords` array. Absent on minted cards (mirrors `frozen`); each
  // entry's `value` is its remaining lifetime in turn-start ticks. hasKeyword /
  // keywordNames union this set with `keywords`.
  appliedKeywords?: readonly Keyword[];
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
  // Transient keywords stamped at runtime (e.g. Alarm), distinct from the
  // authored `keywords` array. Absent on minted cards; each entry's `value` is
  // its remaining lifetime in turn-start ticks. See PlayerCard.appliedKeywords.
  appliedKeywords?: readonly Keyword[];
  discardable: boolean;
  // When false, ExileTopWorldCards skips this card in place. Defaults to true
  // at mint time (template.canExile ?? true). Set to false for persistent cards
  // like Door and The Walker that should never be permanently removed.
  canExile: boolean;
  onDiscarded: CardEffect;
  onCleared: CardEffect;
  onEndOfTurn: CardEffect;
  onPartialClear: CardEffect;
  onDraw: CardEffect;
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
      // Player-selected discard ids for ReturnPlayerDiscardToTop.
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
  // Worlds that don't set startLight run with light === 0 throughout, which
  // keeps decay (emit-on-change) and concealment no-ops for them.
  light: number;
  // Spendable warmth used by thaw effects. Worlds that don't use heat may
  // carry a number from unlocks, but it has no local meaning unless the world
  // uses it.
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
  // Charges that absorb a KeywordGate (e.g. Alarm) trigger before it
  // disrupts. Granted by GainKeywordGuard; consumed inside KeywordGate. Mirrors
  // braceCharges; 0 for worlds that never grant any.
  keywordGuard: number;
  // Running total of Progress dealt this turn, incremented at the
  // single dealProgress() choke point and read by ProgressGate. Reset to 0 at
  // the turn boundary alongside turnPlayHistory.
  progressDealtThisTurn: number;
  // Lifetime queued by ApplyKeyword target "nextWorldCard". The
  // next world card pulled into hand (drawWorld) is stamped with the queued
  // keyword at this value, then the flag is cleared. Omitted (absent) when
  // none is queued; the explicit `| undefined` allows the consume-and-clear
  // reset under exactOptionalPropertyTypes (mirrors pendingForceDestroySource).
  pendingKeywordNextWorldCard: readonly Keyword[];
  pendingBoonChoices: readonly PendingBoonChoice[];
  // The per-world end-turn passive, threaded onto state once by createWorld
  // (reduce() does not receive WorldData). Defaults to { kind: "None" } for
  // every world except those that author onEndOfTurnPassive.
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
  // Selecting cards from playerDiscard for ReturnPlayerDiscardToTop.
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

// Why a world was lost, attached to the `WorldLost` event so downstream
// consumers (notably the sim layer) can attribute failures. Optional on the
// event itself for low blast radius; existing consumers ignore it.
export type WorldLostCause = "hp" | "noPlayerCards" | "exhausted" | "worldLivelock";

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
  | { type: "PendingCardDestroy"; count: number }
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
  | { type: "WorldLost"; cause?: WorldLostCause }
  | { type: "BraceChanged"; braceCharges: number }
  | { type: "BraceConsumed"; absorbed: number; remaining: number }
  // Applied-keyword lifecycle. Mirror the CardsFrozen/CardsThawed
  // shape (ids + templateIds) so the renderer can target the affected cards,
  // plus the keyword name (and lifetime, for KeywordApplied).
  | {
      type: "KeywordApplied";
      ids: readonly CardId[];
      templateIds: readonly CardTemplateId[];
      keyword: KeywordName;
      value: number;
    }
  | {
      type: "KeywordRemoved";
      ids: readonly CardId[];
      templateIds: readonly CardTemplateId[];
      keyword: KeywordName;
    }
  // Mirrors BraceChanged / BraceConsumed.
  | { type: "keywordGuardChanged"; keywordGuard: number }
  | { type: "KeywordGuardConsumed"; absorbed: number; remaining: number }
  | { type: "WorldCardsExiled"; ids: readonly CardId[]; templateIds: readonly CardTemplateId[] }
  | { type: "HealReceived"; amount: number }
  | { type: "HazardAdded"; templateId: CardTemplateId; id: CardId }
  | {
      type: "PlayerDiscardRecalled";
      cardIds: readonly CardId[];
      templateIds: readonly CardTemplateId[];
      source: "latest" | "random" | "lowestCost" | "highestCost" | "panicFirst" | "playerSelected";
      dest: "playerDrawTop";
    }
) & {
  readonly sourceCardId?: CardId;
  // Stamped at the dispatch() boundary (innermost wins), mirroring sourceCardId:
  // the originating CardEffect kind for events that flow through an effect handler.
  // Engine-emitted events (turn-start ticks, exhaust, act cascades) bypass
  // dispatch() and stay unstamped.
  readonly sourceKind?: CardEffect["kind"];
  // Stamped at the emit site (not at a boundary): within one effect some events
  // are random and some are not, so the flags ride the individual event.
  readonly randomized?: boolean; // outcome chosen via rng at resolution
  readonly revealedFromHidden?: boolean; // identities came from a hidden zone
};
