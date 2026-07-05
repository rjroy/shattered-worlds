/**
 * Unit tests for the `cause` tag on the `WorldLost` event.
 *
 * Each of the four loss paths is driven in isolation and the emitted
 * `WorldLost` event is checked for the expected `cause`:
 *   - "hp"            HP reaches 0 from damage
 *   - "noPlayerCards" turn start draws zero player cards
 *   - "exhausted"     all piles empty and no structural play remains, in a world
 *                     without an automatic threat fallback
 *   - "worldLivelock" world deck gone and nothing can reintroduce world cards, in
 *                     a world without an automatic threat fallback
 *
 * All tests operate on pure GameState — no Phaser, no browser globals.
 */

import { describe, expect, it } from "bun:test";
import { damage } from "../engine/effects";
import { reduce } from "../engine/reduce";
import type { GameEvent, PlayerCard } from "../model/types";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";

/** Pull the single WorldLost event out of an event stream, or fail loudly. */
function worldLostEvent(events: readonly GameEvent[]): Extract<GameEvent, { type: "WorldLost" }> {
  const lost = events.find((e) => e.type === "WorldLost");
  expect(lost).toBeDefined();
  return lost as Extract<GameEvent, { type: "WorldLost" }>;
}

describe("WorldLost cause", () => {
  it('tags "hp" when HP reaches 0 from damage', () => {
    const state = makeState({ hp: 5 });

    const { state: after, events } = damage(state, 5);

    expect(after.status).toBe("lost");
    expect(worldLostEvent(events).cause).toBe("hp");
  });

  it('tags "noPlayerCards" when turn start draws zero player cards', () => {
    // A world card is held but no player card can be drawn from any pile, so
    // refillHand adds no player cards and the draw-phase guard fires first.
    const world = makeWorldCard({ id: "wl-no-player-world" });
    const state = makeState({
      hand: [world],
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 2,
    });

    const result = reduce(catalog, state, { type: "EndTurn" });

    expect(result.state.status).toBe("lost");
    expect(worldLostEvent(result.events).cause).toBe("noPlayerCards");
  });

  it('tags "exhausted" when all piles empty and no structural play remains', () => {
    // One DealProgress player card is drawn this turn (so the noPlayerCards
    // guard is skipped), but with every pile empty and no world card to target
    // it is neither playable nor discardable — a genuinely dead board.
    const dealProgress: PlayerCard = makePlayerCard({
      id: "wl-deal-progress",
      effect: { kind: "DealProgress", base: 1 },
    });
    const state = makeState({
      hand: [],
      playerDraw: [dealProgress],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 5,
      worldId: "test-no-threat",
    });

    const result = reduce(catalog, state, { type: "EndTurn" });

    expect(result.state.status).toBe("lost");
    expect(worldLostEvent(result.events).cause).toBe("exhausted");
  });

  it('tags "worldLivelock" when no world card exists and none can be reintroduced', () => {
    // Seven inert player cards: six fill the hand, one remains in playerDraw so
    // the exhausted guard is skipped (future cards exist). No world card lives
    // anywhere and no player card can introduce one, so the world-livelock
    // guard is the only loss path left.
    const players: PlayerCard[] = Array.from({ length: 7 }, (_, i) =>
      makePlayerCard({ id: `wl-livelock-${i}`, effect: { kind: "None" } }),
    );
    const state = makeState({
      hand: [],
      playerDraw: players,
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 5,
      worldId: "test-no-threat",
    });

    const result = reduce(catalog, state, { type: "EndTurn" });

    expect(result.state.status).toBe("lost");
    expect(worldLostEvent(result.events).cause).toBe("worldLivelock");
  });
});
