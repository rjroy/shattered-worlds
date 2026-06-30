/**
 * Eden Prime — Slice 1 (core-engine) tests: the general applied-keyword
 * mechanism with Alarm as its first instance (REQ-EDEN-9,10,11,11a,12,12a,13,
 * 14,15,45 / Gate G1).
 *
 * These drive the pure core directly: synthetic hands built from the shared
 * testFixture card builders, then applyEffect / startTurn / drawWorld / reduce.
 * No mocking — the core is fast, deterministic, and seedable.
 */
import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { applyEffect } from "../engine/effects";
import { drawWorld } from "../engine/draw";
import { startTurn } from "../engine/energy";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { appliedKeywordValue } from "../model/keywords";
import type { CardEffect, CardId, GameEvent, GameState, WorldCard } from "../model/types";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";

const ALARM_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "KeywordApplied",
  "KeywordRemoved",
  "AlarmGuardChanged",
  "AlarmGuardConsumed",
]);

/** A world card already carrying applied Alarm at the given lifetime. */
function alarmedWorld(id: CardId, value: number): WorldCard {
  return makeWorldCard({ id, appliedKeywords: [{ name: "Alarm", value }] });
}

const applyToHand = (target: "hand" | "self" | "firstWorldCardInHand"): CardEffect => ({
  kind: "ApplyKeyword",
  keyword: "Alarm",
  value: 2,
  target,
});

// ---------------------------------------------------------------------------
// ApplyKeyword — all four targets.
// ---------------------------------------------------------------------------

describe("Eden Prime — ApplyKeyword (REQ-EDEN-9,10)", () => {
  it("target 'hand' alarms every card in hand and emits one event", () => {
    const state = makeState({
      hand: [makeWorldCard({ id: "3" }), makePlayerCard({ id: "4" })],
    });
    const { state: after, events } = applyEffect(catalog, state, applyToHand("hand"));

    for (const card of after.hand) {
      expect(appliedKeywordValue(card, "Alarm")).toBe(2);
    }
    const applied = events.find((e) => e.type === "KeywordApplied");
    expect(applied).toBeDefined();
    if (applied?.type === "KeywordApplied") {
      expect(applied.keyword).toBe("Alarm");
      expect(applied.value).toBe(2);
      expect(new Set(applied.ids)).toEqual(new Set(["3", "4"]));
    }
  });

  it("target 'self' alarms only the hook's own card (ctx.selfId)", () => {
    const state = makeState({
      hand: [makeWorldCard({ id: "5" }), makeWorldCard({ id: "6" })],
    });
    // selfId is the 5th applyEffect arg (as onEndOfTurn / onPartialClear pass it).
    const { state: after, events } = applyEffect(
      catalog,
      state,
      applyToHand("self"),
      undefined,
      "5",
    );

    expect(appliedKeywordValue(after.hand.find((c) => c.id === "5")!, "Alarm")).toBe(2);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "6")!, "Alarm")).toBe(0);
    expect(events.some((e) => e.type === "KeywordApplied")).toBe(true);
  });

  it("target 'firstWorldCardInHand' resolves by NUMERIC id, not string order (>= 10 minted)", () => {
    // String order would pick "10" ("10" < "2"); numeric order picks "2". The
    // hand spans ids past 9 to catch the lexicographic-vs-numeric bug.
    const state = makeState({
      hand: [
        makeWorldCard({ id: "10" }),
        makeWorldCard({ id: "2" }),
        makePlayerCard({ id: "11" }),
      ],
    });
    const { state: after, events } = applyEffect(catalog, state, applyToHand("firstWorldCardInHand"));

    expect(appliedKeywordValue(after.hand.find((c) => c.id === "2")!, "Alarm")).toBe(2);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "10")!, "Alarm")).toBe(0);
    // Player card is never a "world card" target.
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "11")!, "Alarm")).toBe(0);

    const applied = events.find((e) => e.type === "KeywordApplied");
    expect(applied?.type === "KeywordApplied" && applied.ids).toEqual(["2"]);
  });

  it("target 'nextWorldCard' defers: queues the flag now, stamps on the next world draw", () => {
    const state = makeState({ worldDraw: [makeWorldCard({ id: "20" })] });
    const queue: CardEffect = {
      kind: "ApplyKeyword",
      keyword: "Alarm",
      value: 2,
      target: "nextWorldCard",
    };

    // Apply now: no card changes, no event — only the queue flag is set.
    const queued = applyEffect(catalog, state, queue);
    expect(queued.state.pendingAlarmNextWorldCard).toBe(2);
    expect(queued.events).toHaveLength(0);
    expect(queued.state.hand).toHaveLength(0);

    // The next world card pulled into hand is stamped and the flag is cleared.
    const drawn = drawWorld(queued.state, 1);
    expect(drawn.state.pendingAlarmNextWorldCard).toBeUndefined();
    const card20 = drawn.state.hand.find((c) => c.id === "20")!;
    expect(appliedKeywordValue(card20, "Alarm")).toBe(2);
    expect(drawn.events.some((e) => e.type === "KeywordApplied")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KeywordGate / ProgressGate — boundary behavior.
// ---------------------------------------------------------------------------

const HEAL_FIVE: CardEffect = { kind: "Heal", amount: 5 };

function keywordGate(min: number): CardEffect {
  return { kind: "KeywordGate", keyword: "Alarm", min, zone: "hand", then: HEAL_FIVE };
}

describe("Eden Prime — KeywordGate (REQ-EDEN-11,11a)", () => {
  // Counts cards that carry Alarm (applied here). hand has exactly two.
  const handWithTwoAlarms = () => [alarmedWorld("1", 2), alarmedWorld("2", 2), makeWorldCard({ id: "3" })];

  it("is a no-op below min", () => {
    const state = makeState({ hand: handWithTwoAlarms(), hp: 10 });
    const { state: after, events } = applyEffect(catalog, state, keywordGate(3));
    expect(after.hp).toBe(10);
    expect(events).toHaveLength(0);
  });

  it("fires at min", () => {
    const state = makeState({ hand: handWithTwoAlarms(), hp: 10 });
    const { state: after, events } = applyEffect(catalog, state, keywordGate(2));
    expect(after.hp).toBe(15);
    expect(events.some((e) => e.type === "HpChanged")).toBe(true);
  });

  it("fires above min", () => {
    const state = makeState({ hand: handWithTwoAlarms(), hp: 10 });
    const { state: after } = applyEffect(catalog, state, keywordGate(1));
    expect(after.hp).toBe(15);
  });
});

describe("Eden Prime — ProgressGate (REQ-EDEN-12)", () => {
  function progressGate(min: number): CardEffect {
    return { kind: "ProgressGate", min, then: HEAL_FIVE };
  }

  it("is a no-op below min and does not touch alarmGuard", () => {
    const state = makeState({ hp: 10, progressDealtThisTurn: 1, alarmGuard: 1 });
    const { state: after, events } = applyEffect(catalog, state, progressGate(2));
    expect(after.hp).toBe(10);
    expect(after.alarmGuard).toBe(1);
    expect(events).toHaveLength(0);
  });

  it("fires at min without consuming alarmGuard", () => {
    const state = makeState({ hp: 10, progressDealtThisTurn: 2, alarmGuard: 1 });
    const { state: after } = applyEffect(catalog, state, progressGate(2));
    expect(after.hp).toBe(15);
    expect(after.alarmGuard).toBe(1);
  });

  it("fires above min", () => {
    const state = makeState({ hp: 10, progressDealtThisTurn: 3 });
    const { state: after } = applyEffect(catalog, state, progressGate(2));
    expect(after.hp).toBe(15);
  });

  it("counts Progress via the shared dealProgress choke point", () => {
    // A real DealProgress play should advance progressDealtThisTurn so a later
    // ProgressGate reads it. Target a 1-cost hazard so the meter rises by 3.
    const hazard = makeWorldCard({ id: "9", cost: 99 });
    const state = makeState({ hand: [hazard], progressDealtThisTurn: 0 });
    const dealt = applyEffect(catalog, state, { kind: "DealProgress", base: 3 }, {
      type: "PlayCard",
      cardId: "src",
      targetId: "9",
    });
    expect(dealt.state.progressDealtThisTurn).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// RemoveKeyword / GainAlarmGuard.
// ---------------------------------------------------------------------------

describe("Eden Prime — RemoveKeyword (REQ-EDEN-13)", () => {
  it("clears applied Alarm from up to `amount` cards in ascending numeric id order", () => {
    const state = makeState({
      hand: [alarmedWorld("3", 2), alarmedWorld("1", 2), alarmedWorld("2", 2)],
    });
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "RemoveKeyword",
      keyword: "Alarm",
      target: "hand",
      amount: 2,
    });

    // Lowest two ids (1, 2) lose Alarm; id 3 keeps it.
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "1")!, "Alarm")).toBe(0);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "2")!, "Alarm")).toBe(0);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "3")!, "Alarm")).toBe(2);

    const removed = events.find((e) => e.type === "KeywordRemoved");
    expect(removed?.type === "KeywordRemoved" && removed.ids).toEqual(["1", "2"]);
  });
});

describe("Eden Prime — GainAlarmGuard absorbs a gate trigger (REQ-EDEN-12a)", () => {
  it("a guard charge absorbs one KeywordGate disruption and suppresses `then`", () => {
    const gained = applyEffect(catalog, makeState({ alarmGuard: 0 }), {
      kind: "GainAlarmGuard",
      amount: 1,
    });
    expect(gained.state.alarmGuard).toBe(1);
    expect(gained.events.some((e) => e.type === "AlarmGuardChanged")).toBe(true);

    // With a charge in hand, a gate at/above min spends the charge and the
    // damaging `then` (here a Heal sentinel) does NOT run.
    const armed: GameState = {
      ...gained.state,
      hp: 10,
      hand: [alarmedWorld("1", 2), alarmedWorld("2", 2)],
    };
    const { state: after, events } = applyEffect(catalog, armed, keywordGate(2));

    expect(after.alarmGuard).toBe(0);
    expect(after.hp).toBe(10); // then suppressed
    expect(events.some((e) => e.type === "AlarmGuardConsumed")).toBe(true);
    expect(events.some((e) => e.type === "HpChanged")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Turn-start decay, in the fixed lifecycle order.
// ---------------------------------------------------------------------------

describe("Eden Prime — applied-keyword decay (REQ-EDEN-15)", () => {
  it("decays one tick per turn start and removes at zero, AFTER thaw and BEFORE energy", () => {
    const state = makeState({
      hand: [alarmedWorld("1", 1), makePlayerCard({ id: "2", frozen: 1 })],
    });
    const { events } = startTurn(state);

    const thawIdx = events.findIndex((e) => e.type === "CardsThawed");
    const removedIdx = events.findIndex((e) => e.type === "KeywordRemoved");
    const energyIdx = events.findIndex((e) => e.type === "EnergyChanged");

    expect(thawIdx).toBeGreaterThanOrEqual(0);
    expect(removedIdx).toBeGreaterThanOrEqual(0);
    expect(energyIdx).toBeGreaterThanOrEqual(0);
    // Fixed order: thaw -> applied-keyword decay -> energy.
    expect(thawIdx).toBeLessThan(removedIdx);
    expect(removedIdx).toBeLessThan(energyIdx);
  });

  it("a longer lifetime survives one tick and expires on the next", () => {
    const state = makeState({ hand: [alarmedWorld("1", 2)] });

    const turn1 = startTurn(state);
    expect(appliedKeywordValue(turn1.state.hand.find((c) => c.id === "1")!, "Alarm")).toBe(1);
    expect(turn1.events.some((e) => e.type === "KeywordRemoved")).toBe(false);

    const turn2 = startTurn(turn1.state);
    expect(appliedKeywordValue(turn2.state.hand.find((c) => c.id === "1")!, "Alarm")).toBe(0);
    expect(turn2.events.some((e) => e.type === "KeywordRemoved")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No-op guarantee: a flow that applies no Alarm is unchanged by the slice.
// ---------------------------------------------------------------------------

describe("Eden Prime — no-op guarantee (REQ-EDEN-45)", () => {
  it("a normal world turn emits no Alarm/guard events and leaves the new fields at init", () => {
    const { catalog: cat, worldData } = buildWorld("the-ember-orchard");
    const { state: opened, openingEvents } = createWorld(cat, worldData, 1234, DEFAULT_RUN_MODIFIERS);

    expect(opened.alarmGuard).toBe(0);
    expect(opened.progressDealtThisTurn).toBe(0);
    expect(opened.pendingAlarmNextWorldCard).toBeUndefined();

    const ended = reduce(cat, opened, { type: "EndTurn" });
    const allEvents = [...openingEvents, ...ended.events];
    for (const event of allEvents) {
      expect(ALARM_EVENT_TYPES.has(event.type)).toBe(false);
    }

    expect(ended.state.alarmGuard).toBe(0);
    expect(ended.state.progressDealtThisTurn).toBe(0);
    expect(ended.state.pendingAlarmNextWorldCard).toBeUndefined();
  });

  it("maps the Eden Prime world threat to Paradise Runs (REQ-EDEN-14)", () => {
    expect(worldThreatTemplateByWorldId("eden-prime")).toBe("Paradise Runs");
  });
});
