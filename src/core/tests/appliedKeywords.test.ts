/**
 * The general applied-keyword mechanism (ApplyKeyword / KeywordGate /
 * ProgressGate / RemoveKeyword / tickAppliedKeywordsAtTurnStart). Alarm is the
 * only keyword wired to use it today, but these tests exercise the mechanism
 * itself, not any one world's authored content — no world-specific card data.
 *
 * Synthetic hands built from the shared testFixture card builders, driving
 * applyEffect / startTurn / drawWorld directly. No mocking — the core is fast,
 * deterministic, and seedable.
 */
import { describe, expect, it } from "bun:test";
import { applyEffect } from "../engine/effects";
import { drawWorld } from "../engine/draw";
import { startTurn } from "../engine/energy";
import { tickAppliedKeywordsAtTurnStart } from "../effects/appliedKeywords";
import { appliedKeywordValue } from "../model/keywords";
import type { CardEffect, GameState, WorldCard } from "../model/types";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";

/** A world card already carrying applied Alarm at the given lifetime. */
function alarmedWorld(id: string, value: number): WorldCard {
  return makeWorldCard({ id, appliedKeywords: [{ name: "Alarm", value }] });
}

const applyToHand = (target: "hand" | "self" | "firstWorldCardInHand"): CardEffect => ({
  kind: "ApplyKeyword",
  keyword: "Alarm",
  value: 2,
  target,
});

// ---------------------------------------------------------------------------
// ApplyKeyword — all five targets.
// ---------------------------------------------------------------------------

describe("ApplyKeyword", () => {
  it("applies persistent Lockdown through every New Derelict target", () => {
    const effect = (target: "hand" | "self" | "firstWorldCardInHand" | "nextWorldCard") =>
      ({ kind: "ApplyKeyword", keyword: "Lockdown", value: 1, target }) as const;

    const hand = [makeWorldCard({ id: "2" }), makeWorldCard({ id: "1" })];
    const handResult = applyEffect(catalog, makeState({ hand }), effect("hand"));
    expect(handResult.state.hand.every((card) => appliedKeywordValue(card, "Lockdown") === 1)).toBe(
      true,
    );

    const selfResult = applyEffect(
      catalog,
      makeState({ hand }),
      effect("self"),
      undefined,
      "2",
    );
    expect(appliedKeywordValue(selfResult.state.hand[0]!, "Lockdown")).toBe(1);
    expect(appliedKeywordValue(selfResult.state.hand[1]!, "Lockdown")).toBe(0);

    const firstResult = applyEffect(
      catalog,
      makeState({ hand }),
      effect("firstWorldCardInHand"),
    );
    expect(appliedKeywordValue(firstResult.state.hand.find((card) => card.id === "1")!, "Lockdown"))
      .toBe(1);

    const queued = applyEffect(
      catalog,
      makeState({ worldDraw: [makeWorldCard({ id: "3" })] }),
      effect("nextWorldCard"),
    );
    const drawn = drawWorld(queued.state, 1);
    expect(appliedKeywordValue(drawn.state.hand[0]!, "Lockdown")).toBe(1);
    expect(drawn.events.some((event) => event.type === "KeywordApplied")).toBe(true);
  });
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

  it("target 'self' is a no-op when no selfId is provided", () => {
    const state = makeState({ hand: [makeWorldCard({ id: "5" })] });
    const { state: after, events } = applyEffect(catalog, state, applyToHand("self"));

    expect(appliedKeywordValue(after.hand.find((c) => c.id === "5")!, "Alarm")).toBe(0);
    expect(events).toHaveLength(0);
  });

  it("target 'firstWorldCardInHand' resolves by NUMERIC id, not string order (>= 10 minted)", () => {
    // String order would pick "10" ("10" < "2"); numeric order picks "2". The
    // hand spans ids past 9 to catch the lexicographic-vs-numeric bug.
    const state = makeState({
      hand: [makeWorldCard({ id: "10" }), makeWorldCard({ id: "2" }), makePlayerCard({ id: "11" })],
    });
    const { state: after, events } = applyEffect(
      catalog,
      state,
      applyToHand("firstWorldCardInHand"),
    );

    expect(appliedKeywordValue(after.hand.find((c) => c.id === "2")!, "Alarm")).toBe(2);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "10")!, "Alarm")).toBe(0);
    // Player card is never a "world card" target.
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "11")!, "Alarm")).toBe(0);

    const applied = events.find((e) => e.type === "KeywordApplied");
    expect(applied?.type === "KeywordApplied" && applied.ids).toEqual(["2"]);
  });

  it("target 'firstWorldCardInHand' is a no-op with no world cards in hand", () => {
    const state = makeState({ hand: [makePlayerCard({ id: "1" })] });
    const { events } = applyEffect(catalog, state, applyToHand("firstWorldCardInHand"));
    expect(events).toHaveLength(0);
  });

  it("target 'randomWorldCardInHand' alarms exactly one world card and advances rng", () => {
    const state = makeState({
      hand: [makeWorldCard({ id: "1" }), makeWorldCard({ id: "2" }), makePlayerCard({ id: "3" })],
    });
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "ApplyKeyword",
      keyword: "Alarm",
      value: 2,
      target: "randomWorldCardInHand",
    });

    const alarmed = after.hand.filter(
      (c): c is WorldCard => c.kind === "world" && appliedKeywordValue(c, "Alarm") === 2,
    );
    expect(alarmed).toHaveLength(1);
    expect(after.rng).not.toEqual(state.rng);
    const applied = events.find((e) => e.type === "KeywordApplied");
    expect(applied?.type === "KeywordApplied" && applied.ids).toEqual([alarmed[0]!.id]);
  });

  it("target 'randomWorldCardInHand' is a no-op with no world cards in hand", () => {
    const state = makeState({ hand: [makePlayerCard({ id: "1" })] });
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "ApplyKeyword",
      keyword: "Alarm",
      value: 2,
      target: "randomWorldCardInHand",
    });
    expect(events).toHaveLength(0);
    expect(after.hand).toEqual(state.hand);
  });

  it("target 'nextWorldCard' defers keyword/value and emits draw before annotation", () => {
    const state = makeState({ worldDraw: [makeWorldCard({ id: "20" })] });
    const queue: CardEffect = {
      kind: "ApplyKeyword",
      keyword: "Spore",
      value: 3,
      target: "nextWorldCard",
    };

    // Apply now: no card changes, no event — only the queue flag is set.
    const queued = applyEffect(catalog, state, queue);
    expect(queued.state.pendingKeywordNextWorldCard).toEqual([{ name: "Spore", value: 3 }]);
    expect(queued.events).toHaveLength(0);
    expect(queued.state.hand).toHaveLength(0);

    // The next world card pulled into hand is stamped and the flag is cleared.
    const drawn = drawWorld(queued.state, 1);
    expect(drawn.state.pendingKeywordNextWorldCard).toEqual([]);
    const card20 = drawn.state.hand.find((c) => c.id === "20")!;
    expect(appliedKeywordValue(card20, "Spore")).toBe(3);

    const drawnIdx = drawn.events.findIndex((e) => e.type === "CardsDrawn");
    const appliedIdx = drawn.events.findIndex((e) => e.type === "KeywordApplied");
    expect(drawnIdx).toBeGreaterThanOrEqual(0);
    expect(appliedIdx).toBeGreaterThan(drawnIdx);

    const applied = drawn.events[appliedIdx];
    expect(applied?.type === "KeywordApplied" && applied.keyword).toBe("Spore");
    expect(applied?.type === "KeywordApplied" && applied.value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// KeywordGate / ProgressGate — boundary behavior.
// ---------------------------------------------------------------------------

const HEAL_FIVE: CardEffect = { kind: "Heal", amount: 5 };

function keywordGate(min: number): CardEffect {
  return { kind: "KeywordGate", keyword: "Alarm", min, zone: "hand", then: HEAL_FIVE };
}

describe("KeywordGate", () => {
  // Counts cards that carry Alarm (applied here). hand has exactly two.
  const handWithTwoAlarm = () => [
    alarmedWorld("1", 1),
    alarmedWorld("2", 1),
    makeWorldCard({ id: "3" }),
  ];

  it("is a no-op below min", () => {
    const state = makeState({ hand: handWithTwoAlarm(), hp: 10 });
    const { state: after, events } = applyEffect(catalog, state, keywordGate(3));
    expect(after.hp).toBe(10);
    expect(events).toHaveLength(0);
  });

  it("fires at min", () => {
    const state = makeState({ hand: handWithTwoAlarm(), hp: 10 });
    const { state: after, events } = applyEffect(catalog, state, keywordGate(2));
    expect(after.hp).toBe(15);
    expect(events.some((e) => e.type === "HpChanged")).toBe(true);
  });

  it("fires above min", () => {
    const state = makeState({ hand: handWithTwoAlarm(), hp: 10 });
    const { state: after } = applyEffect(catalog, state, keywordGate(1));
    expect(after.hp).toBe(15);
  });

  it("one guard charge suppresses exactly one gated disruption", () => {
    const gained = applyEffect(catalog, makeState({ keywordGuard: 0 }), {
      kind: "GainKeywordGuard",
      amount: 1,
    });
    expect(gained.state.keywordGuard).toBe(1);
    expect(gained.events.some((e) => e.type === "keywordGuardChanged")).toBe(true);

    // With one charge in hand, the first gate spends the charge and the second
    // gate runs normally. This proves one guard suppresses exactly one trigger.
    const armed: GameState = {
      ...gained.state,
      hp: 10,
      hand: [alarmedWorld("1", 2), alarmedWorld("2", 2)],
    };
    const { state: after, events } = applyEffect(catalog, armed, {
      kind: "Sequence",
      steps: [keywordGate(2), keywordGate(2)],
    });

    expect(after.keywordGuard).toBe(0);
    expect(after.hp).toBe(15);
    expect(events.filter((e) => e.type === "KeywordGuardConsumed")).toHaveLength(1);
    expect(events.filter((e) => e.type === "HpChanged")).toHaveLength(1);
    expect(events.findIndex((e) => e.type === "KeywordGuardConsumed")).toBeLessThan(
      events.findIndex((e) => e.type === "HpChanged"),
    );
  });
});

describe("ProgressGate", () => {
  function progressGate(min: number): CardEffect {
    return { kind: "ProgressGate", min, then: HEAL_FIVE };
  }

  it("is a no-op below min and does not touch keywordGuard", () => {
    const state = makeState({ hp: 10, progressDealtThisTurn: 1, keywordGuard: 1 });
    const { state: after, events } = applyEffect(catalog, state, progressGate(2));
    expect(after.hp).toBe(10);
    expect(after.keywordGuard).toBe(1);
    expect(events).toHaveLength(0);
  });

  it("fires at min without consuming keywordGuard", () => {
    const state = makeState({ hp: 10, progressDealtThisTurn: 2, keywordGuard: 1 });
    const { state: after } = applyEffect(catalog, state, progressGate(2));
    expect(after.hp).toBe(15);
    expect(after.keywordGuard).toBe(1);
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
    const dealt = applyEffect(
      catalog,
      state,
      { kind: "DealProgress", base: 3 },
      {
        type: "PlayCard",
        cardId: "src",
        targetId: "9",
      },
    );
    expect(dealt.state.progressDealtThisTurn).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// RemoveKeyword.
// ---------------------------------------------------------------------------

describe("RemoveKeyword", () => {
  it("removes Lockdown deterministically in ascending numeric id order", () => {
    const locked = (id: string) =>
      makeWorldCard({ id, appliedKeywords: [{ name: "Lockdown", value: 1 }] });
    const state = makeState({ hand: [locked("10"), locked("2"), locked("1")] });
    const result = applyEffect(catalog, state, {
      kind: "RemoveKeyword",
      keyword: "Lockdown",
      target: "hand",
      amount: 2,
    });

    expect(
      result.state.hand
        .filter((card) => appliedKeywordValue(card, "Lockdown") > 0)
        .map((card) => card.id),
    ).toEqual(["10"]);
    const removed = result.events.find((event) => event.type === "KeywordRemoved");
    expect(removed?.type === "KeywordRemoved" && removed.ids).toEqual(["1", "2"]);
    expect(removed?.type === "KeywordRemoved" && removed.templateIds).toEqual(["1", "2"]);
    expect(removed?.type === "KeywordRemoved" && removed.keyword).toBe("Lockdown");
  });
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

  it("is a no-op when no card carries the keyword as an applied entry", () => {
    const state = makeState({
      hand: [makeWorldCard({ id: "1", keywords: [{ name: "Slow", value: 1 }] })],
    });
    const { events } = applyEffect(catalog, state, {
      kind: "RemoveKeyword",
      keyword: "Slow",
      target: "hand",
      amount: 5,
    });
    // Authored (template) keywords are never stripped by RemoveKeyword — only
    // applied entries are eligible.
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tickAppliedKeywordsAtTurnStart — the turn-start decay step.
// ---------------------------------------------------------------------------

describe("tickAppliedKeywordsAtTurnStart", () => {
  it("preserves Lockdown while Alarm decays at the actual turn-start boundary", () => {
    const card = makeWorldCard({
      id: "1",
      appliedKeywords: [
        { name: "Lockdown", value: 1 },
        { name: "Alarm", value: 1 },
      ],
    });
    const result = tickAppliedKeywordsAtTurnStart(makeState({ hand: [card] }));
    const after = result.state.hand[0]!;

    expect(appliedKeywordValue(after, "Lockdown")).toBe(1);
    expect(appliedKeywordValue(after, "Alarm")).toBe(0);
    expect(result.events).toContainEqual({
      type: "KeywordRemoved",
      ids: ["1"],
      templateIds: ["1"],
      keyword: "Alarm",
    });
  });

  it("is a no-op (identical state, no events) when no card carries an applied keyword", () => {
    const state = makeState({ hand: [makeWorldCard({ id: "1" }), makePlayerCard({ id: "2" })] });
    const { state: after, events } = tickAppliedKeywordsAtTurnStart(state);
    expect(after).toBe(state);
    expect(events).toHaveLength(0);
  });

  it("decrements a lifetime without expiring it", () => {
    const state = makeState({ hand: [alarmedWorld("1", 2)] });
    const { state: after, events } = tickAppliedKeywordsAtTurnStart(state);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "1")!, "Alarm")).toBe(1);
    expect(events).toHaveLength(0);
  });

  it("emits one KeywordRemoved grouped across all cards whose lifetime hits zero", () => {
    const state = makeState({ hand: [alarmedWorld("1", 1), alarmedWorld("2", 1)] });
    const { state: after, events } = tickAppliedKeywordsAtTurnStart(state);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "1")!, "Alarm")).toBe(0);
    expect(appliedKeywordValue(after.hand.find((c) => c.id === "2")!, "Alarm")).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.type === "KeywordRemoved" && new Set(events[0].ids)).toEqual(
      new Set(["1", "2"]),
    );
  });
});

describe("turn-start lifecycle ordering", () => {
  it("decays in the full turn-start lifecycle order", () => {
    const state = makeState({
      light: 2,
      hand: [alarmedWorld("1", 1), makePlayerCard({ id: "2", frozen: 1 })],
      worldDraw: [makeWorldCard({ id: "3" })],
      playerDraw: [makePlayerCard({ id: "4" })],
      pendingForceDestroy: 1,
    });
    const { events } = startTurn(state);

    const lightIdx = events.findIndex((e) => e.type === "LightChanged");
    const thawIdx = events.findIndex((e) => e.type === "CardsThawed");
    const removedIdx = events.findIndex((e) => e.type === "KeywordRemoved");
    const energyIdx = events.findIndex((e) => e.type === "EnergyChanged");
    const drawIdx = events.findIndex((e) => e.type === "CardsDrawn");
    const destroyedIdx = events.findIndex((e) => e.type === "CardDestroyed");

    expect(lightIdx).toBeGreaterThanOrEqual(0);
    expect(thawIdx).toBeGreaterThanOrEqual(0);
    expect(removedIdx).toBeGreaterThanOrEqual(0);
    expect(energyIdx).toBeGreaterThanOrEqual(0);
    expect(drawIdx).toBeGreaterThanOrEqual(0);
    expect(destroyedIdx).toBeGreaterThanOrEqual(0);
    // Fixed order: light decay -> thaw -> applied-keyword decay -> energy -> refill -> force destroy.
    expect(lightIdx).toBeLessThan(thawIdx);
    expect(thawIdx).toBeLessThan(removedIdx);
    expect(removedIdx).toBeLessThan(energyIdx);
    expect(energyIdx).toBeLessThan(drawIdx);
    expect(drawIdx).toBeLessThan(destroyedIdx);
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
