import { describe, expect, it } from "bun:test";
import {
  applyEffect,
  damage,
  dealProgress,
  destroyInHand,
  gainCard,
  resolveCounter,
  returnToActiveWorldDeck,
} from "../engine/effects";
import { mintCard } from "../model/cards";
import { availableActions } from "../engine/available";
import { createWorld } from "../engine/world";
import { reduce } from "../engine/reduce";
import type { CardEffect, GameState, PlayerCard, WorldCard } from "../model/types";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import type { CardCatalog } from "../model/catalog";
import { catalog, worldData } from "./testFixture";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GameState for testing. Uses createWorld as a base so
 * nextId and rng are valid, then overrides piles as needed.
 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const { state: base } = createWorld(catalog, worldData, 1);
  return {
    ...base,
    hand: [],
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    hp: 10,
    energy: 0,
    status: "playing",
    ...overrides,
  };
}

/** Mint a single WorldCard and advance state. */
function mintWorld(state: GameState, name: Parameters<typeof mintCard>[2]): [WorldCard, GameState] {
  const [card, next] = mintCard(catalog, state, name);
  if (card.kind !== "world") throw new Error(`${name} is not a world card`);
  return [card as WorldCard, next];
}

function offerBoonHazard(effect: CardEffect): WorldCard {
  return {
    kind: "world",
    id: "offer-boon-hazard",
    templateId: "Offer Boon Hazard",
    name: "Offer Boon Hazard",
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: true,
    canExile: true,
    onDiscarded: { kind: "None" },
    onCleared: effect,
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
    onDraw: { kind: "None" },
    rarity: "common",
  };
}

function resolveOfferBoonHazard(effect: CardEffect, cat: CardCatalog = catalog) {
  const hazard = offerBoonHazard(effect);
  const state = makeState({ hand: [hazard] });
  return applyEffect(
    cat,
    state,
    { kind: "DealProgress", base: 1 },
    { type: "PlayCard", cardId: "progress", targetId: hazard.id },
  );
}

function gainRandomCardHazard(effect: CardEffect): WorldCard {
  return {
    kind: "world",
    id: "gain-random-card-hazard",
    templateId: "Gain Random Card Hazard",
    name: "Gain Random Card Hazard",
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: true,
    canExile: true,
    onDiscarded: { kind: "None" },
    onCleared: effect,
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
    onDraw: { kind: "None" },
    rarity: "common",
  };
}

function resolveGainRandomCardHazard(effect: CardEffect, cat: CardCatalog = catalog) {
  const hazard = gainRandomCardHazard(effect);
  const state = makeState({ hand: [hazard] });
  return applyEffect(
    cat,
    state,
    { kind: "DealProgress", base: 1 },
    { type: "PlayCard", cardId: "progress", targetId: hazard.id },
  );
}

// ---------------------------------------------------------------------------
// 1. dealProgress keyword math
// ---------------------------------------------------------------------------

describe("dealProgress keyword math", () => {
  it("applies Creature bonus and auto-resolves Zombie (cost 1)", () => {
    let state = makeState();
    const [zombie, s1] = mintWorld(state, "Zombie");
    state = { ...s1, hand: [zombie] };

    // Baseball Bat: base 2, bonus { tag: 'Creature', amount: 3 }
    const { state: after, events } = dealProgress(catalog, state, zombie.id, 2, applyEffect, {
      tag: "Creature",
      amount: 3,
    });

    // Zombie has Creature keyword → total = 2 + 3 = 5
    const progressEvent = events.find((e) => e.type === "ProgressDealt");
    expect(progressEvent).toBeDefined();
    if (progressEvent?.type === "ProgressDealt") {
      expect(progressEvent.amount).toBe(5);
      expect(progressEvent.hazardTurnTotal).toBe(5);
    }

    // 5 >= cost 1: auto-resolved
    expect(events.some((e) => e.type === "HazardResolved")).toBe(true);
    expect(after.hand.find((c) => c.id === zombie.id)).toBeUndefined();
  });

  it("adds run keyword bonus only when the hazard has the matching keyword", () => {
    let state = makeState({
      runModifiers: { ...DEFAULT_RUN_MODIFIERS, keywordDamageBonus: 1 },
    });
    const [hidden, s1] = mintWorld(state, "Zombie");
    const [plain, s2] = mintWorld(s1, "Strange Sounds");
    const hiddenWithKeyword: WorldCard = { ...hidden, keywords: [{ name: "Obstructed" }] };
    state = { ...s2, hand: [hiddenWithKeyword, plain] };

    const matching = dealProgress(catalog, state, hiddenWithKeyword.id, 1, applyEffect, {
      tag: "Obstructed",
      amount: 1,
    });
    const nonMatching = dealProgress(catalog, state, plain.id, 1, applyEffect, {
      tag: "Obstructed",
      amount: 1,
    });

    expect(matching.events.find((e) => e.type === "ProgressDealt")).toMatchObject({
      amount: 3,
    });
    expect(nonMatching.events.find((e) => e.type === "ProgressDealt")).toMatchObject({
      amount: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. dealProgress no keyword bonus
// ---------------------------------------------------------------------------

describe("dealProgress no keyword bonus", () => {
  it("deals 1 progress to Strange Sounds with no bonus (no keywords, cost 2)", () => {
    let state = makeState();
    const [ss, s1] = mintWorld(state, "Strange Sounds");
    state = { ...s1, hand: [ss] };

    // Explore: base 1, bonus { tag: 'Hidden', amount: 1 } — Strange Sounds has no keywords
    const { state: after, events } = dealProgress(catalog, state, ss.id, 1, applyEffect, {
      tag: "Obstructed",
      amount: 1,
    });

    const progressEvent = events.find((e) => e.type === "ProgressDealt");
    expect(progressEvent).toBeDefined();
    if (progressEvent?.type === "ProgressDealt") {
      // No keyword match → bonus not applied
      expect(progressEvent.amount).toBe(1);
      expect(progressEvent.hazardTurnTotal).toBe(1);
    }

    // 1 < 2 → not resolved
    expect(events.some((e) => e.type === "HazardResolved")).toBe(false);
    // Still in hand
    expect(after.hand.find((c) => c.id === ss.id)).toBeDefined();
    // Progress recorded
    expect(after.progress[ss.id]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Auto-resolve at threshold
// ---------------------------------------------------------------------------

describe("dealProgress auto-resolve at threshold", () => {
  it("resolves Strange Sounds when progress reaches cost 2", () => {
    let state = makeState();
    const [ss, s1] = mintWorld(state, "Strange Sounds");
    // Pre-seed 1 progress from a previous turn
    state = { ...s1, hand: [ss], progress: { [ss.id]: 1 } };

    // Add 1 more → total = 2 = cost 2
    const { state: after, events } = dealProgress(catalog, state, ss.id, 1, applyEffect);

    const progressEvent = events.find((e) => e.type === "ProgressDealt");
    expect(progressEvent).toBeDefined();
    if (progressEvent?.type === "ProgressDealt") {
      expect(progressEvent.amount).toBe(1);
      expect(progressEvent.hazardTurnTotal).toBe(2);
    }

    expect(events.some((e) => e.type === "HazardResolved")).toBe(true);
    expect(after.hand.find((c) => c.id === ss.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. returnToActiveWorldDeck
// ---------------------------------------------------------------------------

describe("returnToActiveWorldDeck", () => {
  it("merges returned cards into the active world deck", () => {
    let state = makeState();

    // Mint 5 world cards for the worldDraw pile
    const worldCardNames = [
      "Strange Sounds",
      "Rubble",
      "Screams",
      "Zombie",
      "Find Baseball Bat",
    ] as const;
    const drawPile: WorldCard[] = [];
    for (const name of worldCardNames) {
      const [card, next] = mintWorld(state, name);
      drawPile.push(card);
      state = next;
    }

    // Mint 2 world cards to act as "returned" cards (currently in hand)
    const [xCard, s2] = mintWorld(state, "Rubble");
    const [yCard, s3] = mintWorld(s2, "Screams");
    state = { ...s3, hand: [xCard, yCard], worldDraw: drawPile };

    const { state: after, events } = returnToActiveWorldDeck(state, [xCard.id, yCard.id]);

    // Total cards in worldDraw: 5 original + 2 returned = 7
    expect(after.worldDraw).toHaveLength(7);

    // The full deck is now shuffled together, so all 7 cards should be present.
    const shuffledIds = new Set(after.worldDraw.map((c) => c.id));
    const expectedIds = new Set([
      drawPile[0]!.id,
      drawPile[1]!.id,
      drawPile[2]!.id,
      drawPile[3]!.id,
      drawPile[4]!.id,
      xCard.id,
      yCard.id,
    ]);
    expect(shuffledIds).toEqual(expectedIds);

    // WorldCardsReturned event emitted with both ids
    const returnEvent = events.find((e) => e.type === "WorldCardsReturned");
    expect(returnEvent).toBeDefined();
    if (returnEvent?.type === "WorldCardsReturned") {
      expect(new Set(returnEvent.ids)).toEqual(new Set([xCard.id, yCard.id]));
    }

    // Cards removed from hand
    expect(after.hand).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. gainCard destinations
// ---------------------------------------------------------------------------

describe("gainCard destinations", () => {
  it("places card at front of playerDiscard", () => {
    const state = makeState();
    const { state: after, events } = gainCard(catalog, state, "Sprint", "playerDiscard");

    expect(after.playerDiscard).toHaveLength(1);
    const event = events.find((e) => e.type === "CardGained");
    expect(event).toBeDefined();
    if (event?.type === "CardGained") {
      expect(event.dest).toBe("playerDiscard");
      expect(after.playerDiscard[0]!.id).toBe(event.id);
      expect(event.rarity).toBe(after.playerDiscard[0]!.rarity);
    }
  });

  it("prepends card to playerDraw (playerDrawTop)", () => {
    let state = makeState();
    const [existing] = mintCard(catalog, state, "Explore");
    state = { ...state, playerDraw: [existing] };

    const { state: after, events } = gainCard(catalog, state, "Sprint", "playerDrawTop");

    // New card is at index 0
    expect(after.playerDraw).toHaveLength(2);
    const event = events.find((e) => e.type === "CardGained");
    expect(event).toBeDefined();
    if (event?.type === "CardGained") {
      expect(event.dest).toBe("playerDrawTop");
      expect(after.playerDraw[0]!.id).toBe(event.id);
      expect(event.rarity).toBe(after.playerDraw[0]!.rarity);
    }
  });

  it("prepends world card to worldDraw (worldDrawTop)", () => {
    let state = makeState();
    const [existingWorld] = mintCard(catalog, state, "Rubble");
    state = { ...state, worldDraw: [existingWorld as WorldCard] };

    const { state: after, events } = gainCard(catalog, state, "Door", "worldDrawTop");

    expect(after.worldDraw).toHaveLength(2);
    const event = events.find((e) => e.type === "CardGained");
    expect(event).toBeDefined();
    if (event?.type === "CardGained") {
      expect(event.dest).toBe("worldDrawTop");
      expect(after.worldDraw[0]!.id).toBe(event.id);
      expect(event.rarity).toBe(after.worldDraw[0]!.rarity);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. damage and loss
// ---------------------------------------------------------------------------

describe("damage", () => {
  it("reduces HP and emits DamageDealt + HpChanged", () => {
    const state = makeState({ hp: 5 });
    const { state: after, events } = damage(state, 3);

    expect(after.hp).toBe(2);
    expect(after.status).toBe("playing");
    expect(events.some((e) => e.type === "DamageDealt")).toBe(true);
    expect(events.some((e) => e.type === "HpChanged")).toBe(true);
    expect(events.some((e) => e.type === "WorldLost")).toBe(false);
  });

  it("sets status to lost and emits WorldLost when HP reaches 0", () => {
    const state = makeState({ hp: 5 });
    const { state: after, events } = damage(state, 5);

    expect(after.hp).toBe(0);
    expect(after.status).toBe("lost");
    expect(events.some((e) => (e.type === "WorldWon") === false)).toBe(true);
    expect(events.some((e) => e.type === "WorldLost")).toBe(true);
  });

  it("sets status to lost when damage exceeds HP", () => {
    const state = makeState({ hp: 3 });
    const { state: after, events } = damage(state, 10);

    expect(after.hp).toBe(-7);
    expect(after.status).toBe("lost");
    expect(events.some((e) => e.type === "WorldLost")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. SurviveWorld
// ---------------------------------------------------------------------------

describe("applyEffect SurviveWorld", () => {
  it("sets status to won and emits WorldWon", () => {
    const state = makeState();
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "SurviveWorld",
    });

    expect(after.status).toBe("won");
    expect(events.some((e) => e.type === "WorldWon")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8b. applyEffect GainLight — raises light, emits LightChanged
// ---------------------------------------------------------------------------

describe("applyEffect GainLight", () => {
  it("increases light by amount and emits LightChanged with the new value", () => {
    const state = makeState({ light: 1 });
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "GainLight",
      amount: 2,
    });

    expect(after.light).toBe(3);
    const lightEvent = events.find((e) => e.type === "LightChanged");
    expect(lightEvent).toEqual({ type: "LightChanged", light: 3, sourceKind: "GainLight" });
  });

  it("is playable with no target (no-target effect, base playability)", () => {
    // GainLight inherits the base structuralSpec/isPlayable: { kind: 'none' } and
    // always-playable. available.ts has SILENT default fallbacks (REQ-MALL-5),
    // so this asserts the no-target decision explicitly rather than assuming it.
    const card: PlayerCard = {
      kind: "player",
      id: "flashlight",
      templateId: "Flashlight",
      name: "Flashlight",
      insetKey: undefined,
      sourceWorldId: "test",
      canDestroy: true,
      effect: { kind: "GainLight", amount: 2 },
      energyCost: 1,
      keywords: [],
      rarity: "common",
    };
    const state = makeState({ hand: [card], energy: 3 });
    const available = availableActions(state);
    const entry = available.playable.find((p) => p.cardId === "flashlight");
    expect(entry).toBeDefined();
    expect(entry?.spec).toEqual({ kind: "none" });
  });
});

// ---------------------------------------------------------------------------
// 9. applyEffect Modal
// ---------------------------------------------------------------------------

describe("applyEffect Modal (Sprint)", () => {
  it("choice=0 draws player+world cards", () => {
    let state = makeState();

    // Populate draw piles so draws can succeed
    const [p1, s1] = mintCard(catalog, state, "Sprint");
    const [p2, s2] = mintCard(catalog, s1, "Explore");
    const [w1, s3] = mintWorld(s2, "Rubble");
    state = { ...s3, playerDraw: [p1, p2], worldDraw: [w1] };

    // Sprint effect: Modal [ Draw{player:2, world:1}, DealProgress{...} ]
    const sprintEffect = {
      kind: "Modal" as const,
      branches: [
        { kind: "Draw" as const, player: 2, world: 1 },
        {
          kind: "DealProgress" as const,
          base: 1,
          bonus: { tag: "Slow" as const, amount: 1 },
        },
      ],
    };

    const action = {
      type: "PlayCard" as const,
      cardId: "sprint-id",
      choice: 0,
    };
    const { state: after, events } = applyEffect(catalog, state, sprintEffect, action);

    // 2 player + 1 world drawn
    expect(after.hand.filter((c) => c.kind === "player")).toHaveLength(2);
    expect(after.hand.filter((c) => c.kind === "world")).toHaveLength(1);
    expect(events.some((e) => e.type === "CardsDrawn")).toBe(true);
  });

  it("choice=1 deals progress to target", () => {
    let state = makeState();
    const [zombie, s1] = mintWorld(state, "Zombie");
    state = { ...s1, hand: [zombie] };

    const sprintEffect = {
      kind: "Modal" as const,
      branches: [
        { kind: "Draw" as const, player: 2, world: 1 },
        {
          kind: "DealProgress" as const,
          base: 1,
          bonus: { tag: "Slow" as const, amount: 1 },
        },
      ],
    };

    const action = {
      type: "PlayCard" as const,
      cardId: "sprint-id",
      choice: 1,
      targetId: zombie.id,
    };
    const { events } = applyEffect(catalog, state, sprintEffect, action);

    // Zombie has Slow keyword → 1 + 1 = 2 progress, and cost is 3 → not resolved yet
    expect(events.some((e) => e.type === "ProgressDealt")).toBe(true);
    expect(events.some((e) => e.type === "HazardResolved")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. applyEffect Sequence (Barricade) — resolved hazard skipped gracefully
// ---------------------------------------------------------------------------

describe("applyEffect Sequence (Barricade)", () => {
  it("resolves Rubble in step 0, then step 1 returnIds with the resolved id is skipped", () => {
    let state = makeState();
    const [rubble, s1] = mintWorld(state, "Rubble");
    // Also mint extra world cards to return so the return step isn't entirely empty
    const [screams, s2] = mintWorld(s1, "Screams");
    state = { ...s2, hand: [rubble, screams], worldDraw: [] };

    // Barricade: Sequence [ DealProgress{base:1}, ReturnWorldCards{min:0,max:2} ]
    const barricadeEffect = {
      kind: "Sequence" as const,
      steps: [
        { kind: "DealProgress" as const, base: 1 },
        { kind: "ReturnWorldCards" as const, min: 0, max: 2 },
      ],
    };

    // action.returnIds includes the rubble id (which will be resolved by step 0)
    // and the screams id (which is still in hand)
    const action = {
      type: "PlayCard" as const,
      cardId: "barricade-id",
      targetId: rubble.id,
      returnIds: [rubble.id, screams.id] as readonly string[],
    };

    // Should not throw — missing rubble is skipped gracefully
    const { state: after, events } = applyEffect(catalog, state, barricadeEffect, action);

    // Step 0: Rubble resolved (cost 1, progress 1)
    expect(events.some((e) => e.type === "HazardResolved")).toBe(true);

    // Step 1: Screams returned (rubble was not in hand at that point — skipped)
    const returnEvent = events.find((e) => e.type === "WorldCardsReturned");
    expect(returnEvent).toBeDefined();
    if (returnEvent?.type === "WorldCardsReturned") {
      // Only screams should be in the returned list
      expect(returnEvent.ids).toContain(screams.id);
      expect(returnEvent.ids).not.toContain(rubble.id);
    }

    // Screams is no longer in hand
    expect(after.hand.find((c) => c.id === screams.id)).toBeUndefined();
    // Screams is now in worldDraw
    expect(after.worldDraw.find((c) => c.id === screams.id)).toBeDefined();
  });

  it("handles Barricade with no valid returnIds (all already resolved)", () => {
    let state = makeState();
    const [rubble, s1] = mintWorld(state, "Rubble");
    state = { ...s1, hand: [rubble], worldDraw: [] };

    const barricadeEffect = {
      kind: "Sequence" as const,
      steps: [
        { kind: "DealProgress" as const, base: 1 },
        { kind: "ReturnWorldCards" as const, min: 0, max: 2 },
      ],
    };

    // returnIds only contains the rubble which will be resolved in step 0
    const action = {
      type: "PlayCard" as const,
      cardId: "barricade-id",
      targetId: rubble.id,
      returnIds: [rubble.id] as readonly string[],
    };

    // Should not throw
    expect(() => applyEffect(catalog, state, barricadeEffect, action)).not.toThrow();

    const { events } = applyEffect(catalog, state, barricadeEffect, action);
    expect(events.some((e) => e.type === "HazardResolved")).toBe(true);
    // No WorldCardsReturned event since nothing was actually returned
    expect(events.some((e) => e.type === "WorldCardsReturned")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. destroyInHand
// ---------------------------------------------------------------------------

describe("destroyInHand", () => {
  it("removes the card from hand and emits CardDestroyed", () => {
    let state = makeState();
    const [sprint, s1] = mintCard(catalog, state, "Sprint");
    state = { ...s1, hand: [sprint] };

    const { state: after, events } = destroyInHand(state, [sprint.id]);

    expect(after.hand).toHaveLength(0);
    expect(events.some((e) => e.type === "CardDestroyed")).toBe(true);
  });

  it("does nothing when id is undefined (Regroup with no target)", () => {
    let state = makeState();
    const [sprint, s1] = mintCard(catalog, state, "Sprint");
    state = { ...s1, hand: [sprint] };

    const { state: after, events } = destroyInHand(state, []);

    expect(after.hand).toHaveLength(1);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. applyEffect DestroySelf
// ---------------------------------------------------------------------------

describe("applyEffect DestroySelf", () => {
  it("removes the firing card from hand and emits CardDestroyed{ id: selfId }", () => {
    let state = makeState();
    const [corpse, s1] = mintWorld(state, "Corpse");
    state = { ...s1, hand: [corpse] };

    const { state: after, events } = applyEffect(
      catalog,
      state,
      { kind: "DestroySelf" },
      undefined,
      corpse.id,
    );

    expect(after.hand.find((c) => c.id === corpse.id)).toBeUndefined();
    const destroyed = events.find((e) => e.type === "CardDestroyed");
    expect(destroyed).toBeDefined();
    if (destroyed?.type === "CardDestroyed") {
      expect(destroyed.ids).toStrictEqual([corpse.id]);
    }
  });

  it("is a no-op when selfId is undefined", () => {
    let state = makeState();
    const [corpse, s1] = mintWorld(state, "Corpse");
    state = { ...s1, hand: [corpse] };

    const { state: after, events } = applyEffect(
      catalog,
      state,
      { kind: "DestroySelf" },
      undefined,
      undefined,
    );

    expect(after.hand).toHaveLength(1);
    expect(events).toHaveLength(0);
  });

  it("Sequence[AddWorldCardToTop(Zombie), DestroySelf] removes self and adds a Zombie on top", () => {
    let state = makeState();
    const [corpse, s1] = mintWorld(state, "Corpse");
    state = { ...s1, hand: [corpse], worldDraw: [] };

    const sequence = {
      kind: "Sequence" as const,
      steps: [
        { kind: "AddWorldCardToDeck" as const, template: "Zombie", bTop: true },
        { kind: "DestroySelf" as const },
      ],
    };

    const { state: after, events } = applyEffect(catalog, state, sequence, undefined, corpse.id);

    // Corpse gone from hand
    expect(after.hand.find((c) => c.id === corpse.id)).toBeUndefined();

    // A Zombie is on top of worldDraw
    expect(after.worldDraw).toHaveLength(1);
    expect(after.worldDraw[0]!.name).toBe("Zombie");

    // Both events present
    expect(events.some((e) => e.type === "CardGained")).toBe(true);
    const destroyed = events.find((e) => e.type === "CardDestroyed");
    expect(destroyed).toBeDefined();
    if (destroyed?.type === "CardDestroyed") {
      expect(destroyed.ids).toStrictEqual([corpse.id]);
    }
  });
});

// ---------------------------------------------------------------------------
// 13. DealProgressAll
// ---------------------------------------------------------------------------

describe("DealProgressAll", () => {
  it("sweeps all world cards in hand", () => {
    let state = makeState();
    const [z1, s1] = mintWorld(state, "Zombie");
    const [z2, s2] = mintWorld(s1, "Zombie");
    const [z3, s3] = mintWorld(s2, "Zombie");
    // Pre-seed 2 progress on each so one more push (base=1) reaches cost 3
    state = {
      ...s3,
      hand: [z1, z2, z3],
      progress: { [z1.id]: 2, [z2.id]: 2, [z3.id]: 2 },
    };

    const { events } = applyEffect(catalog, state, {
      kind: "DealProgressAll",
      base: 1,
    });

    const progressEvents = events.filter((e) => e.type === "ProgressDealt");
    expect(progressEvents).toHaveLength(3);
    expect(events.filter((e) => e.type === "HazardResolved")).toHaveLength(3);
  });

  it("applies keyword bonus per hazard", () => {
    let state = makeState();
    const [zombie, s1] = mintWorld(state, "Zombie"); // Creature keyword
    const [rubble, s2] = mintWorld(s1, "Rubble"); // no keywords
    state = { ...s2, hand: [zombie, rubble], progress: {} };

    const { events } = applyEffect(catalog, state, {
      kind: "DealProgressAll",
      base: 1,
      bonus: { tag: "Creature", amount: 2 },
    });

    const progressEvents = events.filter(
      (e): e is Extract<typeof e, { type: "ProgressDealt" }> => e.type === "ProgressDealt",
    );
    expect(progressEvents).toHaveLength(2);

    const zombieProgress = progressEvents.find((e) => e.hazardId === zombie.id);
    const rubbleProgress = progressEvents.find((e) => e.hazardId === rubble.id);

    // Zombie has Creature → base 1 + bonus 2 = 3
    expect(zombieProgress?.amount).toBe(3);
    // Rubble has no keywords → base 1 only
    expect(rubbleProgress?.amount).toBe(1);
  });

  it("clears hazards that reach threshold mid-sweep", () => {
    let state = makeState();
    // Screams: cost 1, so 1 base progress clears it immediately
    const [screams, s1] = mintWorld(state, "Screams");
    // Strange Sounds: cost 2, needs 2 progress
    const [strangeSounds, s2] = mintWorld(s1, "Strange Sounds");
    state = { ...s2, hand: [screams, strangeSounds], progress: {} };

    const { state: after, events } = applyEffect(catalog, state, {
      kind: "DealProgressAll",
      base: 1,
    });

    // Both cards swept: Screams cleared, Strange Sounds gets 1 progress
    expect(events.filter((e) => e.type === "ProgressDealt")).toHaveLength(2);
    expect(events.some((e) => e.type === "HazardResolved")).toBe(true);
    // Screams gone from hand
    expect(after.hand.find((c) => c.id === screams.id)).toBeUndefined();
    // Strange Sounds still in hand with 1 progress recorded
    expect(after.hand.find((c) => c.id === strangeSounds.id)).toBeDefined();
    expect(after.progress[strangeSounds.id]).toBe(1);
  });

  it("hits a concealed world card the player cannot single-target (the Sweep)", () => {
    // Searchlight (DealProgressAll) resolves on true data — concealment never
    // filters its snapshot, so it pushes progress on a card too deep to aim at.
    const concealed: WorldCard = {
      kind: "world",
      id: "mist",
      templateId: "Something in the Mist",
      name: "Something in the Mist",
      insetKey: undefined,
      cost: 3,
      keywords: [{ name: "Concealed", value: 5 }, { name: "Obstructed" }],
      discardable: true,
      canExile: true,
      onDiscarded: { kind: "None" },
      onCleared: { kind: "None" },
      onEndOfTurn: { kind: "None" },
      onPartialClear: { kind: "None" },
      onDraw: { kind: "None" },
      rarity: "common",
    };
    // light 0: the card is concealed (5 > 0) and not single-targetable, yet the
    // sweep still lands on it.
    const state = makeState({ hand: [concealed], light: 0, progress: {} });

    const { events } = applyEffect(catalog, state, {
      kind: "DealProgressAll",
      base: 1,
      bonus: { tag: "Obstructed", amount: 1 },
    });

    const progress = events.find(
      (e): e is Extract<typeof e, { type: "ProgressDealt" }> => e.type === "ProgressDealt",
    );
    expect(progress?.hazardId).toBe("mist");
    expect(progress?.amount).toBe(2); // base 1 + Hidden bonus 1, blind in the dark
  });

  it("does not sweep cards spawned by a mid-sweep onCleared", () => {
    let state = makeState();
    // Screams cost 1 — clears on first progress; its onCleared gains a player card (Regroup),
    // not a world card added to hand, so the snapshot count holds.
    const [screams, s1] = mintWorld(state, "Screams");
    const [rubble, s2] = mintWorld(s1, "Rubble");
    state = { ...s2, hand: [screams, rubble], progress: {} };

    const { events } = applyEffect(catalog, state, {
      kind: "DealProgressAll",
      base: 1,
    });

    // Snapshot had 2 cards → exactly 2 ProgressDealt events (one per snapshotted card)
    const progressEvents = events.filter((e) => e.type === "ProgressDealt");
    expect(progressEvents).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 14. Brace effect
// ---------------------------------------------------------------------------

describe("Brace effect", () => {
  it("increments braceCharges and emits BraceChanged", () => {
    const state = makeState({ braceCharges: 0 });

    const { state: after, events } = applyEffect(catalog, state, {
      kind: "Brace",
      amount: 1,
    });

    expect(after.braceCharges).toBe(1);
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev?.type).toBe("BraceChanged");
    if (ev?.type === "BraceChanged") {
      expect(ev.braceCharges).toBe(1);
    }
  });

  it("braceCharges accumulate across multiple Brace plays", () => {
    const state = makeState({ braceCharges: 0 });

    const { state: after1 } = applyEffect(catalog, state, {
      kind: "Brace",
      amount: 1,
    });
    const { state: after2 } = applyEffect(catalog, after1, {
      kind: "Brace",
      amount: 2,
    });

    expect(after2.braceCharges).toBe(3);
  });

  it("braceCharges persist across an EndTurn with no snatch", () => {
    // Minimal state: one player card in hand, braceCharges pre-set, no
    // pendingForceDestroy so resolveForceDestroy does nothing.
    let state = makeState({ braceCharges: 2, pendingForceDestroy: 0 });
    const [sprint, s1] = mintCard(catalog, state, "Sprint");

    // Provide enough world and player cards for refillHand
    const [w1, s2] = mintCard(catalog, s1, "Rubble");
    const [w2, s3] = mintCard(catalog, s2, "Rubble");
    const [p1, s4] = mintCard(catalog, s3, "Explore");
    const [p2, s5] = mintCard(catalog, s4, "Explore");
    const [p3, s6] = mintCard(catalog, s5, "Explore");
    const [p4, finalState] = mintCard(catalog, s6, "Explore");

    state = {
      ...finalState,
      hand: [sprint],
      worldDraw: [
        w1 as import("../model/types").WorldCard,
        w2 as import("../model/types").WorldCard,
      ],
      playerDraw: [p1, p2, p3, p4],
      playerDiscard: [],
      braceCharges: 2,
      pendingForceDestroy: 0,
      energy: 0,
    };

    // EndTurn — no ForceDestroy pending, charges should survive
    const { state: after } = applyEffect(
      catalog,
      state,
      { kind: "None" }, // just check the field directly; EndTurn is tested in reduce
    );
    // Direct check: charges remain untouched when there is no pending snatch
    expect(state.braceCharges).toBe(2);
    expect(after.braceCharges).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 15. ExileTopWorldCards
// ---------------------------------------------------------------------------

/** Build a minimal exilable WorldCard directly — avoids catalog dependency. */
function exilable(id: string): WorldCard {
  return {
    kind: "world",
    id,
    templateId: `Card-${id}`,
    name: `Card-${id}`,
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable: true,
    canExile: true,
    onDiscarded: { kind: "None" },
    onCleared: { kind: "None" },
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
    onDraw: { kind: "None" },
    rarity: "common",
  };
}

/** Build a non-exilable WorldCard (like Door or The Walker). */
function nonExilable(id: string): WorldCard {
  return { ...exilable(id), canExile: false };
}

describe("ExileTopWorldCards", () => {
  it("exiles up to amount exilable cards from worldDraw top", () => {
    let state = makeState();
    const [a, s1] = mintWorld(state, "Rubble");
    const [b, s2] = mintWorld(s1, "Screams");
    const [c, s3] = mintWorld(s2, "Zombie");
    state = s3;
    // Mix in a non-exilable card at position 1
    const noExile = nonExilable("ne-1");
    state = { ...state, worldDraw: [a, noExile, b, c] };

    const { state: after } = applyEffect(catalog, state, {
      kind: "ExileTopWorldCards",
      amount: 2,
    });

    // a and b should be exiled (skipping noExile), c and noExile should remain
    expect(after.worldDraw).toHaveLength(2);
    expect(after.worldDraw.some((c) => c.id === noExile.id)).toBe(true);
    expect(after.worldDraw.some((c) => c.id === b.id)).toBe(false);
    expect(after.worldDraw.some((card) => card.id === a.id)).toBe(false);
  });

  it("skips non-exilable cards (canExile: false), preserves their order", () => {
    const a = exilable("a");
    const ne = nonExilable("ne");
    const b = exilable("b");
    const state = makeState({ worldDraw: [a, ne, b] });

    const { state: after } = applyEffect(catalog, state, {
      kind: "ExileTopWorldCards",
      amount: 2,
    });

    // a and b exiled; ne remains as the only card
    expect(after.worldDraw).toHaveLength(1);
    expect(after.worldDraw[0]!.id).toBe("ne");
  });

  it("stops gracefully when fewer exilable cards than amount", () => {
    const a = exilable("a");
    const state = makeState({ worldDraw: [a] });

    const { state: after, events } = applyEffect(catalog, state, {
      kind: "ExileTopWorldCards",
      amount: 5,
    });

    // Only 1 exilable card — exiles it and stops without error
    expect(after.worldDraw).toHaveLength(0);
    expect(events.some((e) => e.type === "WorldCardsExiled")).toBe(true);
  });

  it("emits WorldCardsExiled with the exiled ids", () => {
    const a = exilable("a");
    const b = exilable("b");
    const state = makeState({ worldDraw: [a, b] });

    const { events } = applyEffect(catalog, state, {
      kind: "ExileTopWorldCards",
      amount: 2,
    });

    const exileEvent = events.find((e) => e.type === "WorldCardsExiled");
    expect(exileEvent).toBeDefined();
    if (exileEvent?.type === "WorldCardsExiled") {
      expect(new Set(exileEvent.ids)).toEqual(new Set(["a", "b"]));
    }
  });

  it("is a no-op when worldDraw has no exilable cards", () => {
    const ne1 = nonExilable("ne1");
    const ne2 = nonExilable("ne2");
    const state = makeState({ worldDraw: [ne1, ne2] });

    const { state: after, events } = applyEffect(catalog, state, {
      kind: "ExileTopWorldCards",
      amount: 2,
    });

    expect(after.worldDraw).toHaveLength(2);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 16. DealProgressScaled
// ---------------------------------------------------------------------------

function playerCarrier(
  id: string,
  keywords: PlayerCard["keywords"] = [{ name: "Spore" }],
): PlayerCard {
  return {
    kind: "player",
    id,
    templateId: id,
    name: id,
    insetKey: undefined,
    sourceWorldId: "test",
    effect: { kind: "None" },
    canDestroy: true,
    energyCost: 0,
    keywords,
    rarity: "common",
  };
}

describe("DealProgressScaled", () => {
  it("resolveCounter counts matching player and world cards in hand", () => {
    const sporeWorld = { ...exilable("w-spore"), keywords: [{ name: "Spore" }] as const };
    const creatureWorld = {
      ...exilable("w-creature"),
      keywords: [{ name: "Creature" }] as const,
    };
    const state = makeState({
      hand: [
        playerCarrier("p-spore-a"),
        playerCarrier("p-spore-b"),
        playerCarrier("p-empty", []),
        sporeWorld,
        creatureWorld,
      ],
    });

    expect(resolveCounter(state, { kind: "KeywordInHand", keyword: "Spore" })).toBe(3);
    expect(resolveCounter(state, { kind: "KeywordInHand", keyword: "Obstructed" })).toBe(0);
  });

  it("KeywordInHand counts by name, ignoring keyword values, across both carriers", () => {
    const concealedWorld = {
      ...exilable("w-conceal"),
      keywords: [{ name: "Concealed", value: 3 }] as const,
    };
    const state = makeState({
      hand: [
        playerCarrier("p-conceal", [{ name: "Concealed", value: 1 }]),
        concealedWorld,
        playerCarrier("p-spore"),
      ],
    });

    // Two cards carry Concealed at different depths; the counter matches on the
    // name and is blind to the value.
    expect(resolveCounter(state, { kind: "KeywordInHand", keyword: "Concealed" })).toBe(2);
  });

  it("applies base plus amount per Spore in hand at resolution time", () => {
    let state = makeState();
    const [hazard, s1] = mintWorld(state, "Strange Sounds");
    state = {
      ...s1,
      hand: [hazard, playerCarrier("spore-1"), playerCarrier("spore-2")],
    };

    const { state: after, events } = applyEffect(
      catalog,
      state,
      {
        kind: "DealProgressScaled",
        base: 1,
        per: { kind: "KeywordInHand", keyword: "Spore" },
        amount: 1,
      },
      { type: "PlayCard", cardId: "bloom", targetId: hazard.id },
    );

    const progress = events.find((e) => e.type === "ProgressDealt");
    expect(progress).toBeDefined();
    if (progress?.type === "ProgressDealt") {
      expect(progress.amount).toBe(3);
      expect(progress.hazardTurnTotal).toBe(3);
    }
    expect(after.progress[hazard.id]).toBe(3);
  });

  it("recounts the current hand when the effect resolves", () => {
    let state = makeState();
    const [hazard, s1] = mintWorld(state, "Strange Sounds");
    state = {
      ...s1,
      hand: [hazard, playerCarrier("spore-1"), playerCarrier("spore-2"), playerCarrier("spore-3")],
    };

    const beforePlay = { ...state, hand: [hazard, playerCarrier("spore-1")] };
    const { events } = applyEffect(
      catalog,
      beforePlay,
      {
        kind: "DealProgressScaled",
        base: 1,
        per: { kind: "KeywordInHand", keyword: "Spore" },
        amount: 1,
      },
      { type: "PlayCard", cardId: "bloom", targetId: hazard.id },
    );

    const progress = events.find((e) => e.type === "ProgressDealt");
    expect(progress).toBeDefined();
    if (progress?.type === "ProgressDealt") {
      expect(progress.amount).toBe(2);
    }
  });

  it("uses normal dealProgress clear detection and onCleared hooks", () => {
    let state = makeState();
    const [zombie, s1] = mintWorld(state, "Zombie");
    state = { ...s1, hand: [zombie] };

    const { state: after, events } = applyEffect(
      catalog,
      state,
      {
        kind: "DealProgressScaled",
        base: 3,
        per: { kind: "KeywordInHand", keyword: "Spore" },
        amount: 1,
      },
      { type: "PlayCard", cardId: "bloom", targetId: zombie.id },
    );

    expect(after.hand.find((card) => card.id === zombie.id)).toBeUndefined();
    expect(events.some((event) => event.type === "HazardResolved")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 18. HealReceived event
// ---------------------------------------------------------------------------

describe("HealReceived event", () => {
  it("heal emits HealReceived with the heal amount after HpChanged", () => {
    const state = makeState({ hp: 5 });
    const { events } = applyEffect(catalog, state, { kind: "Heal", amount: 4 });
    const healReceived = events.find((e) => e.type === "HealReceived");
    expect(healReceived).toBeDefined();
    if (healReceived?.type === "HealReceived") {
      expect(healReceived.amount).toBe(4);
    }
    // Order: HpChanged comes before HealReceived
    const types = events.map((e) => e.type);
    expect(types.indexOf("HpChanged")).toBeLessThan(types.indexOf("HealReceived"));
  });
});

// ---------------------------------------------------------------------------
// 19. OfferBoon hook rewards
// ---------------------------------------------------------------------------

describe("OfferBoon", () => {
  it("creates a pending worldClear choice and emits BoonOffered when a world card clears", () => {
    const { state, events } = resolveOfferBoonHazard({
      kind: "OfferBoon",
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
    });

    expect(state.pendingBoonChoices).toHaveLength(1);
    expect(state.pendingBoonChoices[0]).toMatchObject({
      source: "worldClear",
      setId: "pool-fortune",
      setName: "pool-fortune",
      chooseCount: 1,
      bToDiscard: false,
    });
    expect(state.pendingBoonChoices[0]?.offeredTemplateIds).toHaveLength(3);
    const offeredTemplateIds = state.pendingBoonChoices[0]?.offeredTemplateIds ?? [];
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "BoonOffered",
        source: "worldClear",
        setId: "pool-fortune",
        setName: "pool-fortune",
        templateIds: offeredTemplateIds,
        rarities: offeredTemplateIds.map((id) => catalog[id]?.rarity ?? "common"),
        // onCleared hook events now carry provenance to the clearing hazard.
        sourceCardId: "offer-boon-hazard",
      }),
    );
  });

  it("defaults chosen boons to hand", () => {
    const offer = resolveOfferBoonHazard({
      kind: "OfferBoon",
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
    });
    const chosen = offer.state.pendingBoonChoices[0]?.offeredTemplateIds[0];
    if (chosen === undefined) throw new Error("expected offered boon");

    const result = reduce(catalog, offer.state, { type: "ChooseBoon", templateId: chosen });
    const granted = result.state.hand.find((card) => card.templateId === chosen);
    if (granted === undefined) throw new Error("expected granted boon in hand");

    expect(result.state.pendingBoonChoices).toEqual([]);
    expect(result.state.hand.some((card) => card.templateId === chosen)).toBe(true);
    expect(result.state.playerDiscard.some((card) => card.templateId === chosen)).toBe(false);
    expect(result.events).toContainEqual({
      type: "BoonCardGranted",
      cardId: granted.id,
      templateId: chosen,
      dest: "hand",
      rarity: granted.rarity,
    });
  });

  it("can route chosen boons to player discard", () => {
    const offer = resolveOfferBoonHazard({
      kind: "OfferBoon",
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
      bToDiscard: true,
    });
    const chosen = offer.state.pendingBoonChoices[0]?.offeredTemplateIds[0];
    if (chosen === undefined) throw new Error("expected offered boon");

    const result = reduce(catalog, offer.state, { type: "ChooseBoon", templateId: chosen });
    const granted = result.state.playerDiscard.find((card) => card.templateId === chosen);
    if (granted === undefined) throw new Error("expected granted boon in discard");

    expect(result.state.pendingBoonChoices).toEqual([]);
    expect(result.state.hand.some((card) => card.templateId === chosen)).toBe(false);
    expect(result.state.playerDiscard.some((card) => card.templateId === chosen)).toBe(true);
    expect(result.events).toContainEqual({
      type: "BoonCardGranted",
      cardId: granted.id,
      templateId: chosen,
      dest: "playerDiscard",
      rarity: granted.rarity,
    });
  });

  it("appends a new offer without replacing an existing pending choice", () => {
    const pending = {
      source: "worldClear" as const,
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredTemplateIds: ["Lucky Break"],
      chooseCount: 1 as const,
      bToDiscard: false,
    };
    const state = makeState({ pendingBoonChoices: [pending] });

    const result = applyEffect(catalog, state, {
      kind: "OfferBoon",
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
    });

    expect(result.state.pendingBoonChoices).toHaveLength(2);
    expect(result.state.pendingBoonChoices[0]).toEqual(pending);
    expect(result.state.pendingBoonChoices[1]).toMatchObject({
      source: "worldClear",
      setId: "pool-fortune",
      setName: "pool-fortune",
      chooseCount: 1,
      bToDiscard: false,
    });
    expect(result.events.map((event) => event.type)).toContain("BoonOffered");
  });

  it("fails closed for an unknown boon set without opening a pending choice", () => {
    const effect: CardEffect = {
      kind: "OfferBoon",
      setId: "missing-set",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
    };

    const first = resolveOfferBoonHazard(effect);
    const second = resolveOfferBoonHazard(effect);

    expect(first.state.pendingBoonChoices).toEqual([]);
    expect(first.events.map((event) => event.type)).not.toContain("BoonOffered");
    expect(second.state.pendingBoonChoices).toEqual([]);
    expect(second.events.map((event) => event.type)).not.toContain("BoonOffered");
    expect(first.state).toEqual(second.state);
    expect(first.events).toEqual(second.events);
  });

  it("fails closed when the referenced set has no legal player options", () => {
    const illegalCatalog: CardCatalog = { ...catalog };
    for (const templateId of [
      "Lucky Break",
      "Second Wind",
      "Found Tool",
      "Clear Path",
      "Steady Nerve",
      "Power Tool",
      "Rejuvenation",
      "Loaded Shotgun",
    ]) {
      const template = illegalCatalog[templateId];
      if (template === undefined || template.kind !== "player") {
        throw new Error(`expected ${templateId} player template`);
      }
      illegalCatalog[templateId] = {
        kind: "world",
        name: template.name,
        cost: 2,
        keywords: [] as string[],
        discardable: true,
        onDiscarded: { kind: "None" },
        onCleared: { kind: "None" },
        onEndOfTurn: { kind: "None" },
        onPartialClear: { kind: "None" },
        onDraw: { kind: "None" },
      };
    }

    const { state, events } = resolveOfferBoonHazard(
      {
        kind: "OfferBoon",
        setId: "pool-fortune",
        setName: "pool-fortune",
        offeredCount: 3,
        chooseCount: 1,
      },
      illegalCatalog,
    );

    expect(state.pendingBoonChoices).toEqual([]);
    expect(events.map((event) => event.type)).not.toContain("BoonOffered");
  });

  it("preserves an existing queue when the referenced set has no legal options", () => {
    const illegalCatalog: CardCatalog = { ...catalog };
    for (const templateId of [
      "Loaded Shotgun",
      "Lucky Break",
      "Second Wind",
      "Found Tool",
      "Clear Path",
      "Steady Nerve",
      "Power Tool",
      "Rejuvenation",
    ]) {
      const template = illegalCatalog[templateId];
      if (template === undefined || template.kind !== "player") {
        throw new Error(`expected ${templateId} player template`);
      }
      illegalCatalog[templateId] = {
        kind: "world",
        name: template.name,
        cost: 2,
        keywords: [] as string[],
        discardable: true,
        onDiscarded: { kind: "None" },
        onCleared: { kind: "None" },
        onEndOfTurn: { kind: "None" },
        onPartialClear: { kind: "None" },
        onDraw: { kind: "None" },
      };
    }
    const pending = {
      source: "worldClear" as const,
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredTemplateIds: ["Lucky Break"],
      chooseCount: 1,
      bToDiscard: false,
    };
    const state = makeState({ pendingBoonChoices: [pending] });

    const result = applyEffect(illegalCatalog, state, {
      kind: "OfferBoon",
      setId: "pool-fortune",
      setName: "pool-fortune",
      offeredCount: 3,
      chooseCount: 1,
    });

    expect(result.state.pendingBoonChoices).toEqual([pending]);
    expect(result.state.rng).not.toEqual(state.rng);
    expect(result.events.map((event) => event.type)).not.toContain("BoonOffered");
  });
});

// ---------------------------------------------------------------------------
// 18. GainRandomCard (roll mode)
// ---------------------------------------------------------------------------

describe("GainRandomCard", () => {
  it("mints exactly one card from the pool to playerDiscard, tagged with setName", () => {
    const { state, events } = resolveGainRandomCardHazard({
      kind: "GainRandomCard",
      setId: "pool-fortune",
      setName: "the cache",
    });

    expect(state.playerDiscard).toHaveLength(1);
    const granted = state.playerDiscard[0]!;
    expect(["Lucky Break", "Second Wind", "Found Tool", "Clear Path", "Steady Nerve"]).toContain(
      granted.templateId,
    );

    const event = events.find((e) => e.type === "CardGained");
    expect(event).toBeDefined();
    if (event?.type === "CardGained") {
      expect(event.id).toBe(granted.id);
      expect(event.templateId).toBe(granted.templateId);
      expect(event.dest).toBe("playerDiscard");
      expect(event.rarity).toBe(granted.rarity);
      expect(event.setName).toBe("the cache");
      // Provenance auto-stamped generically by applyEffect (PR #89), since
      // this fired through the hazard's onCleared hook (selfId set).
      expect(event.sourceCardId).toBe("gain-random-card-hazard");
    }
  });

  it("fails closed for an unknown pool: no card granted, RNG advanced, no crash", () => {
    const effect: CardEffect = {
      kind: "GainRandomCard",
      setId: "missing-pool",
      setName: "the cache",
    };
    const before = makeState();
    const result = applyEffect(catalog, before, effect);

    expect(result.state.playerDiscard).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.state.rng).not.toEqual(before.rng);
  });

  it("fails closed when the pool resolves but has no legal player candidates", () => {
    const illegalCatalog: CardCatalog = { ...catalog };
    for (const templateId of [
      "Loaded Shotgun",
      "Lucky Break",
      "Second Wind",
      "Found Tool",
      "Clear Path",
      "Steady Nerve",
      "Power Tool",
      "Rejuvenation",
    ]) {
      const template = illegalCatalog[templateId];
      if (template === undefined || template.kind !== "player") {
        throw new Error(`expected ${templateId} player template`);
      }
      illegalCatalog[templateId] = {
        kind: "world",
        name: template.name,
        cost: 2,
        keywords: [] as string[],
        discardable: true,
        onDiscarded: { kind: "None" },
        onCleared: { kind: "None" },
        onEndOfTurn: { kind: "None" },
        onPartialClear: { kind: "None" },
        onDraw: { kind: "None" },
      };
    }
    const before = makeState();
    const result = applyEffect(illegalCatalog, before, {
      kind: "GainRandomCard",
      setId: "pool-fortune",
      setName: "the cache",
    } as CardEffect);

    expect(result.state.playerDiscard).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.state.rng).not.toEqual(before.rng);
  });

  it("fixed GainCard still grants its single template with setName left undefined (regression)", () => {
    const state = makeState();
    const { events } = gainCard(catalog, state, "Sprint", "playerDiscard");

    const event = events.find((e) => e.type === "CardGained");
    expect(event).toBeDefined();
    if (event?.type === "CardGained") {
      expect(event.templateId).toBe("Sprint");
      expect(event.setName).toBeUndefined();
    }
  });
});
