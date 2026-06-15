import { describe, expect, it } from "bun:test";
import { createWorld } from "../engine/world";
import { startTurn } from "../engine/energy";
import { applyEffect } from "../engine/effects";
import { createGame } from "../engine/game";
import type { GameEvent } from "../model/types";
import type { WorldData } from "../model/catalog";
import { catalog, worldData } from "./testFixture";

// ---------------------------------------------------------------------------
// 1. Act 1 composition
// ---------------------------------------------------------------------------

describe("Act 1 composition", () => {
  it("worldDraw + hand world cards total 10 after opening deal", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const handWorldCount = state.hand.filter((c) => c.kind === "world").length;
    expect(state.worldDraw.length + handWorldCount).toBe(10);
  });

  it("worldDraw + hand world cards contain 3 Strange Sounds, 4 Rubble, 3 Screams", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const handWorldCards = state.hand.filter((c) => c.kind === "world");
    const allAct1 = [...state.worldDraw, ...handWorldCards];
    const names = allAct1.map((c) => c.name);
    expect(names.filter((n) => n === "Strange Sounds")).toHaveLength(3);
    expect(names.filter((n) => n === "Rubble")).toHaveLength(4);
    expect(names.filter((n) => n === "Screams")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Act queuing
// ---------------------------------------------------------------------------

describe("act queuing", () => {
  it("acts has 2 entries", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.acts).toHaveLength(2);
  });

  it("acts[0] has 10 cards: Rubble×2, Zombie×3, Corpse×3, Find Baseball Bat×2", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const act2 = state.acts[0];
    if (act2 === undefined) throw new Error("acts[0] missing");

    expect(act2).toHaveLength(10);
    const names = act2.map((c) => c.name);
    expect(names.filter((n) => n === "Rubble")).toHaveLength(2);
    expect(names.filter((n) => n === "Zombie")).toHaveLength(3);
    expect(names.filter((n) => n === "Corpse")).toHaveLength(3);
    expect(names.filter((n) => n === "Find Baseball Bat")).toHaveLength(2);
  });

  it("acts[1] has 10 cards: Find Shotgun×1, Zombie×4, Corpse×2, Echoing Aisles×2, The Walker×1", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const act3 = state.acts[1];
    if (act3 === undefined) throw new Error("acts[1] missing");

    expect(act3).toHaveLength(10);
    const names = act3.map((c) => c.name);
    expect(names.filter((n) => n === "Find Shotgun")).toHaveLength(1);
    expect(names.filter((n) => n === "Zombie")).toHaveLength(4);
    expect(names.filter((n) => n === "Corpse")).toHaveLength(2);
    expect(names.filter((n) => n === "Echoing Aisles")).toHaveLength(2);
    expect(names.filter((n) => n === "The Walker")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. PlayerDraw
// ---------------------------------------------------------------------------

describe("playerDraw", () => {
  it("playerDraw + hand player cards total 10 after opening deal", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const handPlayerCount = state.hand.filter((c) => c.kind === "player").length;
    expect(state.playerDraw.length + handPlayerCount).toBe(10);
  });

  it("playerDraw + hand player cards contain correct starter names", () => {
    const { state } = createWorld(catalog, worldData, 42);
    const handPlayerCards = state.hand.filter((c) => c.kind === "player");
    const allStarter = [...state.playerDraw, ...handPlayerCards];
    const names = allStarter.map((c) => c.name);
    expect(names.filter((n) => n === "Sprint")).toHaveLength(2);
    expect(names.filter((n) => n === "Explore")).toHaveLength(3);
    expect(names.filter((n) => n === "Barricade")).toHaveLength(2);
    expect(names.filter((n) => n === "Med Kit")).toHaveLength(1);
    expect(names.filter((n) => n === "Panic")).toHaveLength(1);
    expect(names.filter((n) => n === "Adrenaline")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("two calls with the same seed produce identical Act 1 card name order", () => {
    const { state: a } = createWorld(catalog, worldData, 42);
    const { state: b } = createWorld(catalog, worldData, 42);
    expect(a.worldDraw.map((c) => c.name)).toEqual(b.worldDraw.map((c) => c.name));
  });

  it("two calls with the same seed produce identical playerDraw name order", () => {
    const { state: a } = createWorld(catalog, worldData, 42);
    const { state: b } = createWorld(catalog, worldData, 42);
    expect(a.playerDraw.map((c) => c.name)).toEqual(b.playerDraw.map((c) => c.name));
  });

  it("different seeds produce different opening hands (same card multiset, different order)", () => {
    const { state: a } = createWorld(catalog, worldData, 1);
    const { state: b } = createWorld(catalog, worldData, 2);

    // Compare full Act 1 card sequence: worldDraw + world cards in hand
    const aAct1 = [...a.worldDraw, ...a.hand.filter((c) => c.kind === "world")];
    const bAct1 = [...b.worldDraw, ...b.hand.filter((c) => c.kind === "world")];

    const aNamesStr = aAct1.map((c) => c.name).join(",");
    const bNamesStr = bAct1.map((c) => c.name).join(",");

    // Same multiset of names (both draw from the same act 1 spec)
    const aNamesSorted = aAct1
      .map((c) => c.name)
      .sort()
      .join(",");
    const bNamesSorted = bAct1
      .map((c) => c.name)
      .sort()
      .join(",");
    expect(aNamesSorted).toEqual(bNamesSorted);

    // Different order across the combined sequence (probability of accidental
    // equality is extremely low given different seeds)
    expect(aNamesStr).not.toEqual(bNamesStr);
  });
});

// ---------------------------------------------------------------------------
// 5. Unique ids across all piles
// ---------------------------------------------------------------------------

describe("unique ids", () => {
  it("all 40 card ids across all piles and hand are unique", () => {
    const { state } = createWorld(catalog, worldData, 42);

    const act2 = state.acts[0] ?? [];
    const act3 = state.acts[1] ?? [];

    // Include hand — Phase 3 deals cards out of the piles into hand
    const allCards = [...state.hand, ...state.playerDraw, ...state.worldDraw, ...act2, ...act3];
    const ids = allCards.map((c) => c.id);

    // 10 starter + 10 act1 + 10 act2 + 10 act3 = 40 total
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// 6. Opening hand (Phase 3 — refillHand wired in createWorld)
// ---------------------------------------------------------------------------

describe("hand", () => {
  it("createWorld deals an opening hand of 6 cards", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand).toHaveLength(6);
  });

  it("opening hand has exactly 2 world cards", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand.filter((c) => c.kind === "world")).toHaveLength(2);
  });

  it("opening hand has exactly 4 player cards", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.hand.filter((c) => c.kind === "player")).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 7. Starter provenance (integration)
// ---------------------------------------------------------------------------

describe("starter provenance", () => {
  it('all player cards in playerDraw have sourceWorldId === "starter"', () => {
    const { state } = createWorld(catalog, worldData, 42);
    // Collect all player cards across playerDraw and hand
    const handPlayers = state.hand.filter((c) => c.kind === "player");
    const drawPlayers = state.playerDraw.filter((c) => c.kind === "player");
    const allPlayers = [...handPlayers, ...drawPlayers];

    expect(allPlayers.length).toBeGreaterThan(0);
    for (const card of allPlayers) {
      if (card.kind !== "player") continue;
      expect(card.sourceWorldId).toBe("basic");
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Energy initialization
// ---------------------------------------------------------------------------

describe("energy initialization", () => {
  it("createWorld initializes energy to 1 (opening hand is a turn start)", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.energy).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Light: initialization, decay clock, and the non-Fog invariant
// ---------------------------------------------------------------------------

/** A light-using world descriptor: the zombie world with a starting Light. */
function litWorldData(startLight: number): WorldData {
  return { ...worldData, startLight };
}

describe("Light initialization", () => {
  it("createWorld defaults light to 0 when the world omits startLight", () => {
    const { state } = createWorld(catalog, worldData, 42);
    expect(state.light).toBe(0);
  });

  it("createWorld seeds light from world.startLight (minus the opening-turn decay)", () => {
    // createWorld runs one startTurn to deal the opening hand, so a startLight
    // of 4 has already decayed one step to 3 by the time the hand is dealt.
    const { state } = createWorld(catalog, litWorldData(4), 42);
    expect(state.light).toBe(3);
  });
});

describe("Light decay clock (startTurn)", () => {
  it("decrements light and emits LightChanged when light > 0", () => {
    const { state: base } = createWorld(catalog, worldData, 42);
    const lit = { ...base, light: 2 };
    const { state, events } = startTurn(lit);
    expect(state.light).toBe(1);
    expect(events.some((e) => e.type === "LightChanged" && e.light === 1)).toBe(true);
  });

  it("floors at 0 and emits LightChanged when stepping down from 1", () => {
    const { state: base } = createWorld(catalog, worldData, 42);
    const { state, events } = startTurn({ ...base, light: 1 });
    expect(state.light).toBe(0);
    expect(events.some((e) => e.type === "LightChanged" && e.light === 0)).toBe(true);
  });

  it("emits NO LightChanged when light is already 0 (emit-on-change)", () => {
    const { state: base } = createWorld(catalog, worldData, 42);
    const { state, events } = startTurn({ ...base, light: 0 });
    expect(state.light).toBe(0);
    expect(events.some((e) => e.type === "LightChanged")).toBe(false);
  });

  it("fires decay BEFORE the energy gain in the event stream", () => {
    const { state: base } = createWorld(catalog, worldData, 42);
    const { events } = startTurn({ ...base, light: 2, energy: 0 });
    const lightIdx = events.findIndex((e) => e.type === "LightChanged");
    const energyIdx = events.findIndex((e) => e.type === "EnergyChanged");
    expect(lightIdx).toBeGreaterThanOrEqual(0);
    expect(energyIdx).toBeGreaterThanOrEqual(0);
    expect(lightIdx).toBeLessThan(energyIdx);
  });

  it("fires decay BEFORE the hand refill (cards drawn into the dimmer light)", () => {
    const { state: base } = createWorld(catalog, worldData, 42);
    // Empty the hand so the refill produces CardsDrawn events to order against.
    const { events } = startTurn({ ...base, light: 2, hand: [] });
    const lightIdx = events.findIndex((e) => e.type === "LightChanged");
    const drawnIdx = events.findIndex((e) => e.type === "CardsDrawn");
    expect(lightIdx).toBeGreaterThanOrEqual(0);
    expect(drawnIdx).toBeGreaterThanOrEqual(0);
    expect(lightIdx).toBeLessThan(drawnIdx);
  });
});

describe("non-Fog Light invariant", () => {
  it("a non-Fog world runs with light === 0 throughout and emits NO LightChanged", () => {
    // Play several turns of the real zombie world; light must never move off 0
    // and the event stream must carry no LightChanged at all. This is what keeps
    // the decay/concealment additions byte-identical for every non-Fog run.
    const game = createGame(catalog, worldData, 42);
    expect(game.state.light).toBe(0);

    const allEvents: GameEvent[] = [];
    for (let turn = 0; turn < 6 && game.state.status === "playing"; turn++) {
      const { events } = game.dispatch({ type: "EndTurn" });
      allEvents.push(...events);
      expect(game.state.light).toBe(0);
    }

    expect(allEvents.some((e) => e.type === "LightChanged")).toBe(false);
  });
});

describe("determinism with light decay", () => {
  it("two light-world runs with the same seed + actions replay identically", () => {
    function run(): { light: number; eventTypes: string[]; status: string } {
      const game = createGame(catalog, litWorldData(5), 7);
      const eventTypes: string[] = [];
      for (let turn = 0; turn < 5 && game.state.status === "playing"; turn++) {
        const { events } = game.dispatch({ type: "EndTurn" });
        eventTypes.push(...events.map((e) => e.type));
      }
      return { light: game.state.light, eventTypes, status: game.state.status };
    }

    const a = run();
    const b = run();
    expect(a.light).toBe(b.light);
    expect(a.status).toBe(b.status);
    expect(a.eventTypes).toEqual(b.eventTypes);
    // The light-world run actually exercised decay (sanity: LightChanged fired).
    expect(a.eventTypes).toContain("LightChanged");
  });
});

// ---------------------------------------------------------------------------
// 8. onCleared provenance
// ---------------------------------------------------------------------------

describe("onCleared provenance", () => {
  it("a GainCard onCleared mints a player card stamped with the active worldId", () => {
    // Start from a createWorld state so nextId and rng are valid, then override
    // worldId to 'zombie-big-box' before firing the onCleared effect.
    const { state: base } = createWorld(catalog, worldData, 1);
    const state = { ...base, worldId: "zombie-big-box" };

    // Strange Sounds onCleared: { kind: 'GainCard', template: 'Listen' }
    const { state: after } = applyEffect(catalog, state, { kind: "GainCard", template: "Listen" });

    // The newly minted Listen card lands in playerDiscard
    expect(after.playerDiscard).toHaveLength(1);
    const listenCard = after.playerDiscard[0];
    if (listenCard === undefined) throw new Error("expected a card in playerDiscard");
    if (listenCard.kind !== "player") throw new Error("expected player card");
    expect(listenCard.name).toBe("Listen");
    expect(listenCard.sourceWorldId).toBe("zombie-big-box");
  });
});
