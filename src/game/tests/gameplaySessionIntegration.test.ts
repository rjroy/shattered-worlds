import { describe, expect, it } from "bun:test";

import type { WorldData } from "../../core/index";
import { catalog, worldData } from "../../core/tests/testFixture";
import { createGameplaySession } from "../runtime/gameplaySession";
import type {
  GameplayBatch,
  RunEnded,
  RunStarted,
  RunStreamItem,
} from "../runtime/gameplayEventStream";

function createGuaranteedWinWorldData(): WorldData {
  return {
    worldId: "req-events-win-world",
    starterDeck: [{ templateId: "Explore", count: 4 }],
    deckComposition: {
      acts: [
        {
          cards: [{ templateId: "Door", count: 2 }],
        },
      ],
    },
  };
}

describe("gameplaySession integration", () => {
  it("delivers one dispatch batch to multiple subscribers from the same session flow", () => {
    const session = createGameplaySession(catalog, worldData, 42, {
      makeSessionId: () => "renderer-session",
      clock: () => 1_000,
    });
    const rendererObserved: GameplayBatch[] = [];
    const secondObserved: GameplayBatch[] = [];

    session.subscribe((item) => {
      if (item.kind === "GameplayBatch") {
        rendererObserved.push(item);
      }
    });
    session.subscribe((item) => {
      if (item.kind === "GameplayBatch") {
        secondObserved.push(item);
      }
    });

    const resolution = session.dispatch({ type: "EndTurn" });

    expect(rendererObserved).toHaveLength(1);
    expect(secondObserved).toHaveLength(1);
    expect(rendererObserved[0]).toEqual(secondObserved[0]);
    expect(rendererObserved[0]).toEqual({
      kind: "GameplayBatch",
      sessionId: "renderer-session",
      timestamp: 1_000,
      action: { type: "EndTurn" },
      events: resolution.events,
      state: resolution.state,
    });
    expect(session.state).toEqual(resolution.state);
  });

  it("gives initial subscribers identical full history from run start through terminal outcome", () => {
    const firstHistory: RunStreamItem[] = [];
    const secondHistory: RunStreamItem[] = [];
    const session = createGameplaySession(catalog, worldData, 17, {
      makeSessionId: () => "shared-history",
      clock: () => 2_000,
      subscribers: [(item) => firstHistory.push(item), (item) => secondHistory.push(item)],
    });

    for (let turn = 0; turn < 5; turn += 1) {
      session.dispatch({ type: "EndTurn" });
    }

    expect(firstHistory).toEqual(secondHistory);
    expect(firstHistory.map((item) => item.kind)).toEqual([
      "RunStarted",
      "GameplayBatch",
      "GameplayBatch",
      "GameplayBatch",
      "GameplayBatch",
      "GameplayBatch",
      "RunEnded",
    ]);
    const started = firstHistory[0];
    expect(started?.kind).toBe("RunStarted");
    expect(started && "sessionId" in started ? started.sessionId : undefined).toBe(
      "shared-history",
    );
    expect(started && "worldId" in started ? started.worldId : undefined).toBe(worldData.worldId);
    expect(started && "seed" in started ? started.seed : undefined).toBe(17);
    expect(started && "appliedModifiers" in started ? started.appliedModifiers : undefined).toEqual(
      [],
    );
    expect(started && "timestamp" in started ? started.timestamp : undefined).toBe(2_000);
    expect(
      started && "initialEvents" in started ? Array.isArray(started.initialEvents) : false,
    ).toBe(true);
    expect(started && "initialState" in started ? started.initialState : undefined).toBeDefined();
    expect(firstHistory.at(-1)).toMatchObject({
      kind: "RunEnded",
      sessionId: "shared-history",
      outcome: "lost",
      finalActIndex: session.state.actIndex,
      timestamp: 2_000,
    });
    expect(firstHistory.every((item) => item.sessionId === "shared-history")).toBe(true);
  });

  it("emits one winning RunEnded with the real terminal session identity and act index", () => {
    const items: RunStreamItem[] = [];
    const session = createGameplaySession(catalog, createGuaranteedWinWorldData(), 42, {
      makeSessionId: () => "winning-history",
      clock: () => 3_000,
      subscribers: [(item) => items.push(item)],
    });
    const doorId = session.state.hand.find(
      (card) => card.kind === "world" && card.name === "Door",
    )?.id;

    expect(doorId).toBeDefined();
    if (doorId === undefined) {
      throw new Error("expected Door in opening hand");
    }

    for (let plays = 0; plays < 2; plays += 1) {
      const exploreId = session.state.hand.find(
        (card) => card.kind === "player" && card.name === "Explore",
      )?.id;

      expect(exploreId).toBeDefined();
      if (exploreId === undefined) {
        throw new Error("expected Explore in opening hand");
      }

      session.dispatch({ type: "PlayCard", cardId: exploreId, targetId: doorId });
    }

    expect(session.state.status).toBe("won");
    expect(items.map((item) => item.kind)).toEqual([
      "RunStarted",
      "GameplayBatch",
      "GameplayBatch",
      "RunEnded",
    ]);

    const runEndedItems = items.filter((item) => item.kind === "RunEnded");

    expect(runEndedItems).toHaveLength(1);
    expect(runEndedItems[0]).toMatchObject({
      kind: "RunEnded",
      sessionId: "winning-history",
      outcome: "won",
      finalActIndex: session.state.actIndex,
      timestamp: 3_000,
    });
    expect(session.state.actIndex).toBe(0);
  });
});

describe("RunStarted Phase 2 — initialEvents and initialState", () => {
  it("RunStarted.initialEvents contains HazardAdded for world cards in the opening hand", () => {
    const captured: RunStarted[] = [];
    createGameplaySession(catalog, worldData, 42, {
      clock: () => 0,
      makeSessionId: () => "phase2-test",
      subscribers: [
        (item) => {
          if (item.kind === "RunStarted") captured.push(item);
        },
      ],
    });

    expect(captured).toHaveLength(1);
    const started = captured[0]!;
    expect(Array.isArray(started.initialEvents)).toBe(true);

    // The opening hand always includes world cards (HazardAdded events from
    // the startTurn draw). The zombie-big-box world starts with 2 world cards.
    const hazardEvents = started.initialEvents.filter((e) => e.type === "HazardAdded");
    expect(hazardEvents.length).toBeGreaterThan(0);
  });

  it("RunStarted.initialState has the opening hand populated", () => {
    const captured: RunStarted[] = [];
    createGameplaySession(catalog, worldData, 42, {
      clock: () => 0,
      makeSessionId: () => "phase2-state-test",
      subscribers: [
        (item) => {
          if (item.kind === "RunStarted") captured.push(item);
        },
      ],
    });

    expect(captured).toHaveLength(1);
    const started = captured[0]!;
    expect(started.initialState).toBeDefined();
    expect(started.initialState.hand.length).toBeGreaterThan(0);
    expect(started.initialState.worldId).toBe(worldData.worldId);
  });

  it("RunStarted.initialEvents is deterministic — same seed produces same events", () => {
    function captureInitialEvents(seed: number) {
      let captured: RunStarted | undefined;
      createGameplaySession(catalog, worldData, seed, {
        clock: () => 0,
        makeSessionId: () => `det-test-${seed}`,
        subscribers: [
          (item) => {
            if (item.kind === "RunStarted") captured = item;
          },
        ],
      });
      return captured?.initialEvents ?? [];
    }

    const run1 = captureInitialEvents(7);
    const run2 = captureInitialEvents(7);
    expect(run1).toEqual(run2);

    const run3 = captureInitialEvents(8);
    // Different seeds can produce different event sequences (different shuffle order).
    // At minimum, verify both are valid non-empty arrays.
    expect(run3.length).toBeGreaterThan(0);
    expect(run1.length).toBeGreaterThan(0);
  });
});

// REQ-EVENTS-16 (Phase 3): RunEnded.finalState
describe("RunEnded Phase 3 — finalState", () => {
  it("RunEnded.finalState is defined and contains valid game state on abandon", () => {
    const capturedEnded: RunEnded[] = [];
    createGameplaySession(catalog, worldData, 42, {
      clock: () => 0,
      subscribers: [
        (item) => {
          if (item.kind === "RunEnded") capturedEnded.push(item);
        },
      ],
    }).abandon();

    expect(capturedEnded).toHaveLength(1);
    const ended = capturedEnded[0]!;
    expect(ended.finalState).toBeDefined();
    expect(ended.finalState.hp).toBeGreaterThan(0);
    expect(ended.outcome).toBe("abandoned");
  });

  it("RunEnded.finalState hp and energy match session state at the moment of close", () => {
    const capturedEnded: RunEnded[] = [];
    const session = createGameplaySession(catalog, worldData, 42, {
      clock: () => 0,
      subscribers: [
        (item) => {
          if (item.kind === "RunEnded") capturedEnded.push(item);
        },
      ],
    });

    const stateBeforeClose = session.state;
    session.abandon();

    expect(capturedEnded).toHaveLength(1);
    const ended = capturedEnded[0]!;
    expect(ended.finalState.hp).toBe(stateBeforeClose.hp);
    expect(ended.finalState.energy).toBe(stateBeforeClose.energy);
  });

  it("RunEnded.finalState matches the terminal game state after a lost run", () => {
    const capturedEnded: RunEnded[] = [];
    const session = createGameplaySession(catalog, worldData, 17, {
      clock: () => 0,
      subscribers: [
        (item) => {
          if (item.kind === "RunEnded") capturedEnded.push(item);
        },
      ],
    });

    for (let turn = 0; turn < 5; turn += 1) {
      session.dispatch({ type: "EndTurn" });
    }

    expect(session.state.status).toBe("lost");
    expect(capturedEnded).toHaveLength(1);
    const ended = capturedEnded[0]!;
    expect(ended.outcome).toBe("lost");
    expect(ended.finalState.hp).toBe(session.state.hp);
    expect(ended.finalState.status).toBe("lost");
    expect(ended.finalState.actIndex).toBe(session.state.actIndex);
  });

  it("RunEnded.finalState is a deep-frozen snapshot independent of live session state", () => {
    const capturedEnded: RunEnded[] = [];
    createGameplaySession(catalog, worldData, 42, {
      clock: () => 0,
      subscribers: [
        (item) => {
          if (item.kind === "RunEnded") capturedEnded.push(item);
        },
      ],
    }).abandon();

    const ended = capturedEnded[0]!;
    expect(Object.isFrozen(ended.finalState)).toBe(true);
    expect(Object.isFrozen(ended.finalState.hand)).toBe(true);
  });
});
