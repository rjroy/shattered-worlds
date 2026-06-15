import { describe, expect, it } from "bun:test";
import { drawPlayer, drawWorld, refillHand, resolveForceDestroy } from "../engine/draw";
import { createWorld, WORLD_CONSTS } from "../engine/world";
import type { GameState, PlayerCard, WorldCard } from "../model/types";
import { mintCard } from "../model/cards";
import { catalog, worldData } from "./testFixture";

// ---------------------------------------------------------------------------
// 1. Draw table: refillHand respects the 2-world-minimum rule
// ---------------------------------------------------------------------------

describe("refillHand draw table", () => {
  it(`0 world cards held → draws ${WORLD_CONSTS.startWorldCards} world + ${WORLD_CONSTS.startWorldCards} player (total ${WORLD_CONSTS.maxHandSize})`, () => {
    // createWorld already fills hand; start from raw piles instead
    const { state: base } = createWorld(catalog, worldData, 1);
    // Move all hand cards back to their piles so hand is empty
    const playerCards = base.hand.filter((c) => c.kind === "player");
    const worldCards = base.hand.filter((c) => c.kind === "world") as WorldCard[];
    const state: GameState = {
      ...base,
      hand: [],
      playerDraw: [...playerCards, ...base.playerDraw],
      worldDraw: [...worldCards, ...base.worldDraw],
    };

    const { state: filled } = refillHand(state);

    expect(filled.hand).toHaveLength(WORLD_CONSTS.maxHandSize);
    expect(filled.hand.filter((c) => c.kind === "world")).toHaveLength(
      WORLD_CONSTS.startWorldCards,
    );
    expect(filled.hand.filter((c) => c.kind === "player")).toHaveLength(
      WORLD_CONSTS.startPlayerCards,
    );
  });

  it(`1 world card held → draws 2 world + 3 player (total ${WORLD_CONSTS.maxHandSize})`, () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const playerCards = base.hand.filter((c) => c.kind === "player");
    const worldCards = base.hand.filter((c) => c.kind === "world") as WorldCard[];

    // Hold 1 world card, return the rest
    const [heldWorld, ...returnedWorld] = worldCards;
    if (heldWorld === undefined) throw new Error("no world cards in hand");

    const state: GameState = {
      ...base,
      hand: [heldWorld],
      playerDraw: [...playerCards, ...base.playerDraw],
      worldDraw: [...returnedWorld, ...base.worldDraw],
    };

    const { state: filled } = refillHand(state);

    expect(filled.hand).toHaveLength(WORLD_CONSTS.maxHandSize);
    // 1 held + 2 drawn = 3 world (first held card is "free"; draw still targets startWorldCards)
    expect(filled.hand.filter((c) => c.kind === "world")).toHaveLength(3);
    expect(filled.hand.filter((c) => c.kind === "player")).toHaveLength(3);
  });

  it(`2 world cards held → draws 1 world + ${WORLD_CONSTS.maxHandSize - 3} player (total ${WORLD_CONSTS.maxHandSize})`, () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const playerCards = base.hand.filter((c) => c.kind === "player");

    // Keep both world cards in hand (they came from createWorld)
    const worldCards = base.hand.filter((c) => c.kind === "world") as WorldCard[];
    expect(worldCards).toHaveLength(2); // sanity

    const state: GameState = {
      ...base,
      hand: worldCards,
      playerDraw: [...playerCards, ...base.playerDraw],
    };

    const { state: filled } = refillHand(state);

    expect(filled.hand).toHaveLength(WORLD_CONSTS.maxHandSize);
    // 2 held + 1 drawn = 3 world
    expect(filled.hand.filter((c) => c.kind === "world")).toHaveLength(3);
    expect(filled.hand.filter((c) => c.kind === "player")).toHaveLength(
      WORLD_CONSTS.maxHandSize - 3,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Hand already at WORLD_CONSTS.maxHandSize — no draws
// ---------------------------------------------------------------------------

describe("refillHand with full hand", () => {
  it(`returns no events and unchanged state when hand has ${WORLD_CONSTS.maxHandSize} cards and worldDraw is empty`, () => {
    const { state: base } = createWorld(catalog, worldData, 1);

    const state: GameState = {
      ...base,
      // worldDraw empty: no world cards to draw, so no draws fire at all
      worldDraw: [],
      acts: [],
    };

    // Sanity: hand must be exactly WORLD_CONSTS.maxHandSize
    expect(state.hand).toHaveLength(WORLD_CONSTS.maxHandSize);

    const { state: filled, events } = refillHand(state);

    expect(events).toHaveLength(0);
    expect(filled.hand).toHaveLength(WORLD_CONSTS.maxHandSize);
    expect(filled).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// 4. Act advancement: drawWorld shuffles next act when worldDraw empties
// ---------------------------------------------------------------------------

describe("drawWorld act advancement", () => {
  it("shuffles acts[0] into worldDraw and emits ActAdvanced when worldDraw is empty", () => {
    const { state: base } = createWorld(catalog, worldData, 1);

    // Construct a state with worldDraw empty but acts non-empty
    const act2 = base.acts[0];
    if (act2 === undefined) throw new Error("acts[0] missing");

    const state: GameState = {
      ...base,
      hand: [],
      worldDraw: [],
      acts: [act2],
      actIndex: 0,
    };

    const { state: after, events } = drawWorld(state, 1);

    const actAdvanced = events.find((e) => e.type === "ActAdvanced");
    expect(actAdvanced).toBeDefined();
    if (actAdvanced?.type === "ActAdvanced") {
      expect(actAdvanced.act).toBe(1);
    }

    // The card was drawn from the newly shuffled act
    expect(after.hand).toHaveLength(1);
    expect(after.hand[0]!.kind).toBe("world");

    // Acts queue advanced
    expect(after.acts).toHaveLength(0);
    expect(after.actIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Act exhaustion is safe — drawWorld never throws
// ---------------------------------------------------------------------------

describe("drawWorld exhaustion safety", () => {
  it("returns empty events and unchanged hand when both worldDraw and acts are empty", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const state: GameState = {
      ...base,
      hand: [],
      worldDraw: [],
      acts: [],
    };

    const { state: after, events } = drawWorld(state, 3);

    expect(after.hand).toHaveLength(0);
    // No CardsDrawn event since nothing was drawn
    expect(events.filter((e) => e.type === "CardsDrawn")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Player pile reshuffle: drawPlayer reshuffles discard mid-draw
// ---------------------------------------------------------------------------

describe("drawPlayer discard reshuffle", () => {
  it("reshuffles discard mid-draw, emits DeckShuffled, draws all 4 cards", () => {
    // Build a state using mintCard to get valid card objects
    let state: GameState = createWorld(catalog, worldData, 1).state;

    // Clear all piles and hand, set up 1 in draw + 3 in discard
    const [c1, s1] = mintCard(catalog, state, "Sprint");
    const [c2, s2] = mintCard(catalog, s1, "Sprint");
    const [c3, s3] = mintCard(catalog, s2, "Explore");
    const [c4, s4] = mintCard(catalog, s3, "Explore");
    state = { ...s4, playerDraw: [c1], playerDiscard: [c2, c3, c4], hand: [] };

    const { state: after, events } = drawPlayer(state, 4);

    expect(after.hand.filter((c) => c.kind === "player")).toHaveLength(4);
    expect(events.some((e) => e.type === "DeckShuffled")).toBe(true);
    expect(events.some((e) => e.type === "CardsDrawn")).toBe(true);
    // Both piles drained
    expect(after.playerDraw).toHaveLength(0);
    expect(after.playerDiscard).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. createWorld opening deal
// ---------------------------------------------------------------------------

describe("createWorld opening deal", () => {
  it(`hand has exactly ${WORLD_CONSTS.maxHandSize} cards`, () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand).toHaveLength(WORLD_CONSTS.maxHandSize);
  });

  it(`hand has exactly ${WORLD_CONSTS.startWorldCards} world cards`, () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand.filter((c) => c.kind === "world")).toHaveLength(WORLD_CONSTS.startWorldCards);
  });

  it(`hand has exactly ${WORLD_CONSTS.startPlayerCards} player cards`, () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand.filter((c) => c.kind === "player")).toHaveLength(
      WORLD_CONSTS.startPlayerCards,
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("same seed produces identical hand card names", () => {
    const { state: a } = createWorld(catalog, worldData, 1);
    const { state: b } = createWorld(catalog, worldData, 1);
    expect(a.hand.map((c) => c.name)).toEqual(b.hand.map((c) => c.name));
  });

  it("different seeds produce different hand card name orders", () => {
    const { state: a } = createWorld(catalog, worldData, 1);
    const { state: b } = createWorld(catalog, worldData, 2);
    // The probability of accidental equality is negligible given shuffled decks
    const aNamesStr = a.hand.map((c) => c.name).join(",");
    const bNamesStr = b.hand.map((c) => c.name).join(",");
    expect(aNamesStr).not.toEqual(bNamesStr);
  });
});

// ---------------------------------------------------------------------------
// 9. resolveForceDestroy
// ---------------------------------------------------------------------------

describe("resolveForceDestroy", () => {
  /** Build a hand of n player cards (minted from the Explore template). */
  function handOfPlayers(base: GameState, n: number): [PlayerCard[], GameState] {
    const cards: PlayerCard[] = [];
    let state = base;
    for (let i = 0; i < n; i++) {
      const [card, next] = mintCard(catalog, state, "Explore");
      cards.push(card as PlayerCard);
      state = next;
    }
    return [cards, state];
  }

  it("no pending charge is a no-op", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = { ...s1, hand: players, pendingForceDestroy: 0 };

    const { state: after, events } = resolveForceDestroy(state);

    expect(after.hand).toHaveLength(3);
    expect(events).toHaveLength(0);
  });

  it("destroys one random player card and drains the charge", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = { ...s1, hand: players, pendingForceDestroy: 1 };

    const { state: after, events } = resolveForceDestroy(state);

    expect(after.hand).toHaveLength(2);
    expect(after.pendingForceDestroy).toBe(0);
    expect(events.length).toBe(1);
    expect((events[0] as { type: string }).type).toEqual("CardDestroyed");
    // The destroyed id is one that was in the original hand.
    const destroyedIds = (events[0] as { ids: readonly string[] }).ids;
    expect(players.some((c) => destroyedIds.includes(c.id))).toBe(true);
    expect(after.hand.some((c) => destroyedIds.includes(c.id))).toBe(false);
  });

  it("spares world cards — only player cards are eligible", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [zombie, s1] = mintCard(catalog, base, "Zombie");
    const [players, s2] = handOfPlayers(s1, 1);
    const state: GameState = {
      ...s2,
      hand: [zombie as WorldCard, ...players],
      pendingForceDestroy: 5, // more charges than player cards
    };

    const { state: after, events } = resolveForceDestroy(state);

    // The single player card is taken; the world card survives.
    expect(after.hand).toEqual([zombie as WorldCard]);
    expect(events).toHaveLength(1);
    expect(after.pendingForceDestroy).toBe(0);
  });

  it("fizzles (drains the charge) when no player cards are present", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [zombie, s1] = mintCard(catalog, base, "Zombie");
    const state: GameState = {
      ...s1,
      hand: [zombie as WorldCard],
      pendingForceDestroy: 2,
    };

    const { state: after, events } = resolveForceDestroy(state);

    expect(after.hand).toEqual([zombie as WorldCard]);
    expect(events).toHaveLength(0);
    expect(after.pendingForceDestroy).toBe(0);
  });

  it("multiple charges destroy multiple distinct player cards", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = { ...s1, hand: players, pendingForceDestroy: 2 };

    const { state: after, events } = resolveForceDestroy(state);

    expect(after.hand).toHaveLength(1);
    expect(events).toHaveLength(1);
    const ids = events.flatMap((e) => (e as { ids: readonly string[] }).ids);
    expect(new Set(ids).size).toBe(2); // distinct
  });
});

// ---------------------------------------------------------------------------
// 10. resolveForceDestroy with Brace
// ---------------------------------------------------------------------------

describe("resolveForceDestroy with Brace", () => {
  function handOfPlayers(base: GameState, n: number): [PlayerCard[], GameState] {
    const cards: PlayerCard[] = [];
    let state = base;
    for (let i = 0; i < n; i++) {
      const [card, next] = mintCard(catalog, state, "Explore");
      cards.push(card as PlayerCard);
      state = next;
    }
    return [cards, state];
  }

  it("charges >= pending: all absorbed, zero cards destroyed, counter decremented", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = {
      ...s1,
      hand: players,
      pendingForceDestroy: 1,
      braceCharges: 2,
    };

    const { state: after, events } = resolveForceDestroy(state);

    // All pending absorbed — no cards destroyed
    expect(after.hand).toHaveLength(3);
    expect(after.pendingForceDestroy).toBe(0);
    // One charge consumed; one remains
    expect(after.braceCharges).toBe(1);
    // BraceConsumed event emitted, no CardDestroyed
    expect(events.some((e) => e.type === "BraceConsumed")).toBe(true);
    expect(events.some((e) => e.type === "CardDestroyed")).toBe(false);
    const consumed = events.find((e) => e.type === "BraceConsumed");
    if (consumed?.type === "BraceConsumed") {
      expect(consumed.absorbed).toBe(1);
      expect(consumed.remaining).toBe(0);
    }
  });

  it("charges < pending: partial absorption, remainder destroys cards", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = {
      ...s1,
      hand: players,
      pendingForceDestroy: 3,
      braceCharges: 1,
    };

    const { state: after, events } = resolveForceDestroy(state);

    // 1 absorbed by brace, 2 remaining → 1 card destroyed event (2 cards)
    expect(after.hand).toHaveLength(1);
    expect(after.pendingForceDestroy).toBe(0);
    expect(after.braceCharges).toBe(0);
    expect(events.filter((e) => e.type === "CardDestroyed")).toHaveLength(1);
    expect(
      events
        .filter((e) => e.type === "CardDestroyed")
        .reduce((total, e) => total + e.ids.length, 0),
    ).toBe(2);
    const consumed = events.find((e) => e.type === "BraceConsumed");
    if (consumed?.type === "BraceConsumed") {
      expect(consumed.absorbed).toBe(1);
      expect(consumed.remaining).toBe(2);
    }
  });

  it("zero charges: unchanged behavior (existing ForceDestroy logic)", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = {
      ...s1,
      hand: players,
      pendingForceDestroy: 2,
      braceCharges: 0,
    };

    const { state: after, events } = resolveForceDestroy(state);

    expect(after.hand).toHaveLength(1);
    expect(after.pendingForceDestroy).toBe(0);
    expect(after.braceCharges).toBe(0);
    expect(events.filter((e) => e.type === "CardDestroyed")).toHaveLength(1);
    expect(
      events
        .filter((e) => e.type === "CardDestroyed")
        .reduce((total, e) => total + e.ids.length, 0),
    ).toBe(2);
    expect(events.some((e) => e.type === "BraceConsumed")).toBe(false);
  });

  it("emits BraceConsumed before CardDestroyed", () => {
    const { state: base } = createWorld(catalog, worldData, 1);
    const [players, s1] = handOfPlayers(base, 3);
    const state: GameState = {
      ...s1,
      hand: players,
      pendingForceDestroy: 2,
      braceCharges: 1,
    };

    const { events } = resolveForceDestroy(state);

    const types = events.map((e) => e.type);
    const braceIdx = types.indexOf("BraceConsumed");
    const destroyIdx = types.indexOf("CardDestroyed");
    expect(braceIdx).toBeGreaterThanOrEqual(0);
    expect(destroyIdx).toBeGreaterThanOrEqual(0);
    expect(braceIdx).toBeLessThan(destroyIdx);
  });
});

// ---------------------------------------------------------------------------
// 10. HazardAdded event
// ---------------------------------------------------------------------------

describe("HazardAdded event", () => {
  it("drawWorld emits HazardAdded with templateId for each world card drawn", () => {
    let state = createWorld(catalog, worldData, 1).state;
    // Move all cards out of hand and clear worldDraw of existing, mint fresh
    const [zombie, s1] = mintCard(catalog, state, "Zombie");
    state = { ...s1, hand: [], worldDraw: [zombie as WorldCard], acts: [] };

    const { events } = drawWorld(state, 1);

    const hazardAdded = events.find((e) => e.type === "HazardAdded");
    expect(hazardAdded).toBeDefined();
    if (hazardAdded?.type === "HazardAdded") {
      expect(hazardAdded.templateId).toBe("Zombie");
    }
  });

  it("drawWorld emits one HazardAdded per card drawn (two cards = two events)", () => {
    let state = createWorld(catalog, worldData, 1).state;
    const [w1, s1] = mintCard(catalog, state, "Zombie");
    const [w2, s2] = mintCard(catalog, s1, "Rubble");
    state = { ...s2, hand: [], worldDraw: [w1 as WorldCard, w2 as WorldCard], acts: [] };

    const { events } = drawWorld(state, 2);

    const hazardEvents = events.filter((e) => e.type === "HazardAdded");
    expect(hazardEvents).toHaveLength(2);
  });
});
