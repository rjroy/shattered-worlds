import type {
  Action,
  CardEffect,
  CardId,
  CardTemplateId,
  CounterSpec,
  Dest,
  GameEvent,
  GameState,
  WorldCard,
} from "../model/types";
import type { CardCatalog } from "../model/catalog";
import { mintCard } from "../model/cards";
import { drawPlayer, drawWorld } from "./draw";
import { shuffle } from "./rng";
import type { EffectResult } from "../effects/EffectContext";

const WORLD_THREAT_BY_WORLD_ID: Record<string, CardTemplateId> = {
  "zombie-big-box": "Zombie",
  "highway-volcano": "Lava Flow",
  "bird-building": "Gripping Talon",
  "overgrown-mall": "Something in the Atrium",
};

export function worldThreatByWorldId(worldId: string): string {
  return WORLD_THREAT_BY_WORLD_ID[worldId] ?? "<Unknown>";
}

// ---------------------------------------------------------------------------
// dealProgress
// ---------------------------------------------------------------------------

/**
 * Apply progress toward a hazard in hand. Auto-resolves the hazard (removes it
 * from hand and fires its onCleared effect) if accumulated progress meets or exceeds the
 * hazard's cost.
 */
export function dealProgress(
  catalog: CardCatalog,
  state: GameState,
  hazardId: CardId,
  base: number,
  bonus?: { tag: string; amount: number },
): EffectResult {
  const hazard = state.hand.find((c): c is WorldCard => c.kind === "world" && c.id === hazardId);
  if (hazard === undefined) return { state, events: [] };

  const bonusAmount =
    bonus !== undefined && hazard.keywords.includes(bonus.tag as WorldCard["keywords"][number])
      ? bonus.amount
      : 0;
  const amount = base + bonusAmount;

  const newProgress = {
    ...state.progress,
    [hazardId]: (state.progress[hazardId] ?? 0) + amount,
  };
  const hazardTurnTotal = newProgress[hazardId]!;

  const events: GameEvent[] = [{ type: "ProgressDealt", hazardId, amount, hazardTurnTotal }];

  let current: GameState = { ...state, progress: newProgress };

  if (hazardTurnTotal >= hazard.cost) {
    // Remove hazard from hand (excess progress is wasted — do NOT touch progress)
    current = {
      ...current,
      hand: current.hand.filter((c) => c.id !== hazardId),
    };

    const rewardResult = applyEffect(catalog, current, hazard.onCleared);
    current = rewardResult.state;
    events.push(...rewardResult.events);
    events.push({ type: "HazardResolved", hazardId });
  } else {
    // Hazard not yet resolved
    const partialResult = applyEffect(catalog, current, hazard.onPartialClear, undefined, hazardId);
    current = partialResult.state;
    events.push(...partialResult.events);
    events.push({ type: "HazardPartial", hazardId });
  }

  return { state: current, events };
}

export function resolveCounter(state: GameState, spec: CounterSpec): number {
  switch (spec.kind) {
    case "KeywordInHand":
      return state.hand.filter((card) => card.keywords.includes(spec.keyword)).length;

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// gainCard
// ---------------------------------------------------------------------------

/**
 * Mint a new card from a template and place it in the specified destination
 * zone.
 */
export function gainCard(
  catalog: CardCatalog,
  state: GameState,
  template: CardTemplateId,
  dest: Dest,
): EffectResult {
  const [card, nextState] = mintCard(catalog, state, template);

  let current: GameState;
  switch (dest) {
    case "playerDiscard":
      current = {
        ...nextState,
        playerDiscard: [card, ...nextState.playerDiscard],
      };
      break;
    case "playerDrawTop":
      current = {
        ...nextState,
        playerDraw: [card, ...nextState.playerDraw],
      };
      break;
    case "worldDraw": {
      const shuffled = shuffle([card as WorldCard, ...nextState.worldDraw], nextState.rng);
      current = {
        ...nextState,
        worldDraw: shuffled[0],
        rng: shuffled[1],
      };
      break;
    }
    case "worldDrawTop":
      // Only world cards belong in worldDraw; callers are responsible for
      // only routing world-template ids here.
      current = {
        ...nextState,
        worldDraw: [card as WorldCard, ...nextState.worldDraw],
      };
      break;
  }

  const events: GameEvent[] = [{ type: "CardGained", id: card.id, dest }];
  return { state: current, events };
}

// ---------------------------------------------------------------------------
// returnToActiveWorldDeck
// ---------------------------------------------------------------------------

/**
 * Return world cards from hand back into worldDraw, shuffled with the current
 * active deck.
 */
export function returnToActiveWorldDeck(state: GameState, ids: readonly CardId[]): EffectResult {
  if (ids.length === 0) {
    return { state, events: [] };
  }

  // Collect world cards from hand that match the requested ids, preserving
  // only those actually found (gracefully skip missing ids).
  const returned: WorldCard[] = [];
  for (const id of ids) {
    const card = state.hand.find((c): c is WorldCard => c.kind === "world" && c.id === id);
    if (card !== undefined) returned.push(card);
  }

  if (returned.length === 0) {
    return { state, events: [] };
  }

  const returnedIds = returned.map((c) => c.id);
  const handAfter = state.hand.filter((c) => !returnedIds.includes(c.id));

  const pool: WorldCard[] = [...state.worldDraw, ...returned];
  const [shuffled, nextRng] = shuffle(pool, state.rng);

  const current: GameState = {
    ...state,
    rng: nextRng,
    hand: handAfter,
    worldDraw: shuffled,
  };

  const events: GameEvent[] = [{ type: "WorldCardsReturned", ids: returnedIds }];
  return { state: current, events };
}

// ---------------------------------------------------------------------------
// destroyInHand
// ---------------------------------------------------------------------------

/**
 * Permanently remove a card from hand (not sent to any zone). If id is
 * undefined or the card is not found, nothing happens.
 */
export function destroyInHand(state: GameState, ids: readonly CardId[]): EffectResult {
  if (ids.length === 0) return { state, events: [] };

  const exists = state.hand.some((c) => ids.includes(c.id));
  if (!exists) return { state, events: [] };

  const current: GameState = {
    ...state,
    hand: state.hand.filter((c) => !ids.includes(c.id)),
  };
  const events: GameEvent[] = [{ type: "CardDestroyed", ids }];
  return { state: current, events };
}

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

/**
 * Reduce player HP by n. Transitions status to 'lost' if HP reaches zero or
 * below.
 */
export function damage(state: GameState, n: number): EffectResult {
  const newHp = state.hp - n;
  const events: GameEvent[] = [
    { type: "DamageDealt", amount: n },
    { type: "HpChanged", hp: newHp },
  ];

  let current: GameState = { ...state, hp: newHp };

  if (newHp <= 0) {
    current = { ...current, status: "lost" };
    events.push({ type: "WorldLost" });
  }

  return { state: current, events };
}

// ---------------------------------------------------------------------------
// heal
// ---------------------------------------------------------------------------

/**
 * Increase player HP by n (uncapped in this slice).
 */
export function heal(state: GameState, n: number): EffectResult {
  const newHp = state.hp + n;
  const current: GameState = { ...state, hp: newHp };
  const events: GameEvent[] = [{ type: "HpChanged", hp: newHp }];
  return { state: current, events };
}

// ---------------------------------------------------------------------------
// gainEnergy
// ---------------------------------------------------------------------------

/**
 * Increase player energy by n (uncapped in this slice).
 */
export function gainEnergy(state: GameState, n: number): EffectResult {
  const newEnergy = state.energy + n;
  const current: GameState = { ...state, energy: newEnergy };
  const events: GameEvent[] = [{ type: "EnergyChanged", energy: newEnergy }];
  return { state: current, events };
}

// ---------------------------------------------------------------------------
// applyEffect
// ---------------------------------------------------------------------------

/**
 * Apply any CardEffect. Pass `action` for player-card effects that require
 * targeting information (DealProgress, ReturnWorldCards, etc.); omit it for
 * onDiscarded and onCleared effects that run without player input.
 *
 * `selfId` is the id of the world card whose hook is firing, for
 * self-referential effects like DestroySelf; undefined for player-played
 * effects.
 */
export function applyEffect(
  catalog: CardCatalog,
  state: GameState,
  effect: CardEffect,
  action?: Action,
  selfId?: CardId,
): EffectResult {
  // Narrow to PlayCard once; cases that need targeting fields (DealProgress,
  // ReturnWorldCards, etc.) use this. onDiscarded/onCleared cases ignore it.
  const play = action?.type === "PlayCard" ? action : undefined;

  switch (effect.kind) {
    case "DealProgress":
      return dealProgress(catalog, state, play?.targetId ?? "", effect.base, effect.bonus);

    case "DealProgressScaled": {
      const amount = effect.base + effect.amount * resolveCounter(state, effect.per);
      return dealProgress(catalog, state, play?.targetId ?? "", amount);
    }

    case "Draw": {
      const playerCount = effect.player ?? 0;
      const worldCount = effect.world ?? 0;
      const events: GameEvent[] = [];
      let current = state;

      if (playerCount > 0) {
        const r = drawPlayer(current, playerCount);
        current = r.state;
        events.push(...r.events);
      }
      if (worldCount > 0) {
        const r = drawWorld(current, worldCount);
        current = r.state;
        events.push(...r.events);
      }

      return { state: current, events };
    }

    case "Heal":
      return heal(state, effect.amount);

    case "GainEnergy":
      return gainEnergy(state, effect.amount);

    case "ReturnWorldCards":
      return returnToActiveWorldDeck(state, play?.returnIds ?? []);

    case "DestroyCardInHand":
      return destroyInHand(state, play?.destroyIds ?? []);

    case "DiscardThenDraw": {
      if (play?.discardId === undefined) return { state, events: [] };

      const discardedCard = state.hand.find((c) => c.id === play.discardId);
      if (discardedCard === undefined) return { state, events: [] };

      const afterDiscard: GameState = {
        ...state,
        hand: state.hand.filter((c) => c.id !== play.discardId),
        playerDiscard: [discardedCard, ...state.playerDiscard],
      };

      const drawResult = drawPlayer(afterDiscard, effect.player);
      return {
        state: drawResult.state,
        events: [{ type: "CardsDiscarded", cardIds: [play.discardId] }, ...drawResult.events],
      };
    }

    case "AddCard":
      return gainCard(catalog, state, effect.template, effect.dest);

    case "AddWorldCardToDeck":
      return gainCard(catalog, state, effect.template, effect.bTop ? "worldDrawTop" : "worldDraw");

    case "AddThreatToWorldDeck": {
      const template = WORLD_THREAT_BY_WORLD_ID[state.worldId];
      return template !== undefined
        ? gainCard(catalog, state, template, "worldDrawTop")
        : { state, events: [] };
    }

    case "Modal": {
      const choice = play?.choice ?? 0;
      const branch = effect.branches[choice];
      if (branch === undefined) return { state, events: [] };
      return applyEffect(catalog, state, branch, action, selfId);
    }

    case "Sequence": {
      let current = state;
      const events: GameEvent[] = [];

      for (const step of effect.steps) {
        const r = applyEffect(catalog, current, step, action, selfId);
        current = r.state;
        events.push(...r.events);
      }

      return { state: current, events };
    }

    case "Damage":
      return damage(state, effect.amount);

    case "DamageScaled": {
      const amount = effect.base + effect.amount * resolveCounter(state, effect.per);
      return damage(state, amount);
    }

    case "GainCard":
      return gainCard(catalog, state, effect.template, "playerDiscard");

    case "AddPlayerCardToTop":
      return gainCard(catalog, state, effect.template, "playerDrawTop");

    case "SurviveWorld": {
      const current: GameState = { ...state, status: "won" };
      const events: GameEvent[] = [{ type: "WorldWon" }];
      return { state: current, events };
    }

    case "ForceDestroy": {
      // Queue one forced destruction; it resolves against the next refilled
      // hand at turn start (resolveForceDestroy), not the current hand. No
      // event fires here — CardDestroyed is emitted when the card is taken.
      const current: GameState = {
        ...state,
        pendingForceDestroy: state.pendingForceDestroy + effect.amount,
      };
      return { state: current, events: [] };
    }

    case "DestroySelf":
      return destroyInHand(state, selfId ? [selfId] : []);

    case "None":
      return { state, events: [] };

    case "Brace": {
      const newCharges = state.braceCharges + effect.amount;
      const current: GameState = { ...state, braceCharges: newCharges };
      const events: GameEvent[] = [{ type: "BraceChanged", braceCharges: newCharges }];
      return { state: current, events };
    }

    case "DealProgressAll": {
      // Snapshot world cards in hand at resolution time — mid-sweep spawned
      // cards are excluded (they land in worldDraw via AddWorldCardToDeck, not hand).
      const snapshot = state.hand.filter((c): c is WorldCard => c.kind === "world");
      let current = state;
      const events: GameEvent[] = [];
      for (const hazard of snapshot) {
        const r = dealProgress(catalog, current, hazard.id, effect.base, effect.bonus);
        current = r.state;
        events.push(...r.events);
        if (current.status !== "playing") break;
      }
      return { state: current, events };
    }

    case "ExileTopWorldCards": {
      let remaining = effect.amount;
      const exiledIds: CardId[] = [];
      const nextDraw: WorldCard[] = [];

      for (const card of state.worldDraw) {
        if (remaining > 0 && card.canExile) {
          exiledIds.push(card.id);
          remaining--;
        } else {
          nextDraw.push(card);
        }
      }

      if (exiledIds.length === 0) {
        return { state, events: [] };
      }

      const current: GameState = { ...state, worldDraw: nextDraw };
      const events: GameEvent[] = [{ type: "WorldCardsExiled", ids: exiledIds }];
      return { state: current, events };
    }
  }
}
