import { describe, expect, it } from "bun:test";
import { applyEffect } from "../engine/effects";
import { reduce } from "../engine/reduce";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";

// Provenance: events emitted by a world card's hook carry `sourceCardId` equal
// to that card's id (stamped at the applyEffect boundary). Player-played
// effects (no selfId) leave it undefined. The preview layer relies on this to
// mask events from concealed sources without re-deriving reducer emissions.

describe("event provenance", () => {
  it("stamps onEndOfTurn hook events with the firing world card's id", () => {
    const hook = makeWorldCard({
      id: "end-turn-hazard",
      onEndOfTurn: { kind: "Damage", amount: 3 },
    });
    const filler = makePlayerCard({ id: "filler" });
    const state = makeState({ hand: [hook, filler], hp: 10, playerDraw: [filler] });

    const { events } = reduce(catalog, state, { type: "EndTurn" });
    const hookEvents = events.filter(
      (event) => event.type === "DamageDealt" || event.type === "HpChanged",
    );

    expect(hookEvents.length).toBeGreaterThan(0);
    for (const event of hookEvents) {
      expect(event.sourceCardId).toBe("end-turn-hazard");
    }
  });

  it("stamps onDiscarded hook events with the discarded world card's id", () => {
    const hazard = makeWorldCard({
      id: "discard-hazard",
      onDiscarded: { kind: "Damage", amount: 2 },
    });
    const state = makeState({ hand: [hazard], hp: 10 });

    const { events } = reduce(catalog, state, { type: "DiscardHazard", cardId: hazard.id });
    const damage = events.find((event) => event.type === "DamageDealt");

    expect(damage).toBeDefined();
    expect(damage?.sourceCardId).toBe("discard-hazard");
    // The HazardDiscarded event itself is emitted by the reducer, not the hook,
    // so it carries no source provenance (it already names the discarded card).
    const discarded = events.find((event) => event.type === "HazardDiscarded");
    expect(discarded?.sourceCardId).toBeUndefined();
  });

  it("stamps onCleared hook events with the cleared hazard's id", () => {
    const hazard = makeWorldCard({
      id: "cleared-hazard",
      cost: 1,
      onCleared: { kind: "Heal", amount: 3 },
    });
    const explore = makePlayerCard({
      id: "progress-card",
      effect: { kind: "DealProgress", base: 1 },
    });
    const state = makeState({ hand: [explore, hazard], hp: 5, energy: 1 });

    const { events } = reduce(catalog, state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: hazard.id,
    });

    const heal = events.find((event) => event.type === "HealReceived");
    expect(heal).toBeDefined();
    expect(heal?.sourceCardId).toBe("cleared-hazard");
  });

  it("stamps the deferred CardDestroyed from a concealed-queued ForceDestroy", () => {
    // ForceDestroy queues at hook time (no event) and emits CardDestroyed later,
    // at turn start in resolveForceDestroy — past the applyEffect provenance
    // boundary. The queuing card's id rides along via pendingForceDestroySource
    // so the deferred CardDestroyed still carries provenance.
    const snatcher = makeWorldCard({
      id: "mist-snatcher",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const loot = Array.from({ length: 5 }, (_, index) =>
      makePlayerCard({ id: `loot-${index}` }),
    );
    const state = makeState({ hand: [snatcher], playerDraw: loot, light: 0 });

    const { events } = reduce(catalog, state, { type: "EndTurn" });
    const destroyed = events.find((event) => event.type === "CardDestroyed");

    expect(destroyed).toBeDefined();
    expect(destroyed?.sourceCardId).toBe("mist-snatcher");
  });

  it("leaves player-played effect events unstamped (no selfId)", () => {
    const state = makeState({ hp: 5 });
    const { events } = applyEffect(catalog, state, { kind: "Heal", amount: 3 });

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.sourceCardId).toBeUndefined();
    }
  });
});
