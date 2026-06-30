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
import { buildWorld, FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { worldDataRegistry } from "../../data/worlds/registry";
import { applyEffect } from "../engine/effects";
import { drawWorld } from "../engine/draw";
import { startTurn } from "../engine/energy";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { appliedKeywordValue } from "../model/keywords";
import type { CardEffect, CardId, GameEvent, GameState, WorldCard } from "../model/types";
import {
  catalog,
  makePlayerCard,
  makeState,
  makeWorldCard,
  mintPlayer,
  mintPlayers,
  mintWorld,
} from "./testFixture";

const ALARM_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "KeywordApplied",
  "KeywordRemoved",
  "AlarmGuardChanged",
  "KeywordGuardConsumed",
]);

const EDEN_WORLD_ID = "eden-prime";
const REQUIRED_HOOKS = ["onDiscarded", "onCleared", "onPartialClear", "onEndOfTurn"] as const;
const VALID_KEYWORDS = new Set(["Obstructed", "Creature", "Slow", "Spore", "Concealed", "Alarm"]);
const EDEN_WORLD_CARDS = [
  "Fruit Offered Too Quickly",
  "First Warning Cry",
  "Curious Swarm",
  "The Herd Misunderstands",
  "Flowers Face the Wrong Sun",
  "The Quiet Grove",
  "Paradise Runs",
] as const;
const EDEN_REWARDS = [
  "Take the Fruit",
  "Gentle Approach",
  "Stillness Lesson",
  "Follow the Shade",
  "Hush the Valley",
] as const;

function normalizeNoAlarmState(state: GameState): unknown {
  const copy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete copy.alarmGuard;
  delete copy.progressDealtThisTurn;
  delete copy.pendingKeywordNextWorldCard;
  return copy;
}

function asPreSliceNoAlarmState(state: GameState): GameState {
  return normalizeNoAlarmState(state) as GameState;
}

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

function edenTemplate(templateId: string) {
  const { catalog: edenCatalog } = buildWorld(EDEN_WORLD_ID);
  const template = edenCatalog[templateId];
  if (template === undefined) throw new Error(`${templateId} missing from catalog`);
  return template;
}

function seededEdenState(seed: number, overrides: Partial<GameState> = {}): GameState {
  const { catalog: edenCatalog, worldData } = buildWorld(EDEN_WORLD_ID);
  const { state } = createWorld(edenCatalog, worldData, seed, DEFAULT_RUN_MODIFIERS);
  return {
    ...state,
    hand: [],
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    energy: 0,
    status: "playing",
    ...overrides,
  };
}

function alarmedCardsInHand(state: GameState): WorldCard[] {
  return state.hand.filter(
    (card): card is WorldCard => card.kind === "world" && appliedKeywordValue(card, "Alarm") > 0,
  );
}

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
    expect(queued.state.pendingKeywordNextWorldCard).toEqual({ keyword: "Spore", value: 3 });
    expect(queued.events).toHaveLength(0);
    expect(queued.state.hand).toHaveLength(0);

    // The next world card pulled into hand is stamped and the flag is cleared.
    const drawn = drawWorld(queued.state, 1);
    expect(drawn.state.pendingKeywordNextWorldCard).toBeUndefined();
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

describe("Eden Prime — KeywordGate (REQ-EDEN-11,11a)", () => {
  // Counts cards that carry Alarm (applied here). hand has exactly two.
  const handWithTwoAlarms = () => [
    alarmedWorld("1", 2),
    alarmedWorld("2", 2),
    makeWorldCard({ id: "3" }),
  ];

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
  it("one guard charge suppresses exactly one gated disruption", () => {
    const gained = applyEffect(catalog, makeState({ alarmGuard: 0 }), {
      kind: "GainAlarmGuard",
      amount: 1,
    });
    expect(gained.state.alarmGuard).toBe(1);
    expect(gained.events.some((e) => e.type === "AlarmGuardChanged")).toBe(true);

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

    expect(after.alarmGuard).toBe(0);
    expect(after.hp).toBe(15);
    expect(events.filter((e) => e.type === "KeywordGuardConsumed")).toHaveLength(1);
    expect(events.filter((e) => e.type === "HpChanged")).toHaveLength(1);
    expect(events.findIndex((e) => e.type === "KeywordGuardConsumed")).toBeLessThan(
      events.findIndex((e) => e.type === "HpChanged"),
    );
  });

  it("does not consume alarmGuard for a non-Alarm KeywordGate", () => {
    const state = makeState({
      hp: 10,
      alarmGuard: 1,
      hand: [
        makeWorldCard({ id: "1", keywords: [{ name: "Spore" }] }),
        makeWorldCard({ id: "2", keywords: [{ name: "Spore" }] }),
      ],
    });
    const { state: after, events } = applyEffect(catalog, state, {
      kind: "KeywordGate",
      keyword: "Spore",
      min: 2,
      zone: "hand",
      then: HEAL_FIVE,
    });

    expect(after.hp).toBe(15);
    expect(after.alarmGuard).toBe(1);
    expect(events.some((e) => e.type === "HpChanged")).toBe(true);
    expect(events.some((e) => e.type === "KeywordGuardConsumed")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Turn-start decay, in the fixed lifecycle order.
// ---------------------------------------------------------------------------

describe("Eden Prime — applied-keyword decay (REQ-EDEN-15)", () => {
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

// ---------------------------------------------------------------------------
// No-op guarantee: a flow that applies no Alarm is unchanged by the slice.
// ---------------------------------------------------------------------------

describe("Eden Prime — no-op guarantee (REQ-EDEN-45)", () => {
  it("a normal world turn is byte-identical after normalizing intentionally added fields", () => {
    const { catalog: cat, worldData } = buildWorld("the-ember-orchard");
    const { state: opened, openingEvents } = createWorld(
      cat,
      worldData,
      1234,
      DEFAULT_RUN_MODIFIERS,
    );

    expect(opened.alarmGuard).toBe(0);
    expect(opened.progressDealtThisTurn).toBe(0);
    expect(opened.pendingKeywordNextWorldCard).toBeUndefined();

    const ended = reduce(cat, opened, { type: "EndTurn" });
    const legacyEnded = reduce(cat, asPreSliceNoAlarmState(opened), { type: "EndTurn" });
    const allEvents = [...openingEvents, ...ended.events];
    for (const event of allEvents) {
      expect(ALARM_EVENT_TYPES.has(event.type)).toBe(false);
    }

    expect(ended.events).toEqual(legacyEnded.events);
    expect(normalizeNoAlarmState(ended.state)).toEqual(normalizeNoAlarmState(legacyEnded.state));
    expect(ended.state.alarmGuard).toBe(0);
    expect(ended.state.progressDealtThisTurn).toBe(0);
    expect(ended.state.pendingKeywordNextWorldCard).toBeUndefined();
  });

  it("maps the Eden Prime world threat to Paradise Runs (REQ-EDEN-14)", () => {
    expect(worldThreatTemplateByWorldId("eden-prime")).toBe("Paradise Runs");
  });
});

// ---------------------------------------------------------------------------
// Slice 2 world data and authored startle patterns.
// ---------------------------------------------------------------------------

describe("Eden Prime — world data shape (REQ-EDEN-46)", () => {
  it("is registered in worldDataRegistry and buildWorld succeeds", () => {
    expect(worldDataRegistry.map((bundle) => bundle.id)).toContain(EDEN_WORLD_ID);

    const { worldData } = buildWorld(EDEN_WORLD_ID);
    expect(worldData.worldId).toBe(EDEN_WORLD_ID);
  });

  it("has no duplicate template ids across the unified catalog", () => {
    const { catalog: edenCatalog } = buildWorld(EDEN_WORLD_ID);
    const allIds = Object.keys(edenCatalog);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("defines all Eden templates, required hooks, and valid keywords including Alarm", () => {
    const { catalog: edenCatalog } = buildWorld(EDEN_WORLD_ID);
    for (const id of [...EDEN_WORLD_CARDS, ...EDEN_REWARDS, "Tread Softly"]) {
      expect(edenCatalog[id]).toBeDefined();
    }

    for (const id of EDEN_WORLD_CARDS) {
      const template = edenCatalog[id];
      expect(template).toBeDefined();
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const hook of REQUIRED_HOOKS) {
        expect(template[hook]).toBeDefined();
      }
      for (const keyword of template.keywords) {
        const name = keyword.split(":")[0]!;
        expect(VALID_KEYWORDS.has(name)).toBe(true);
      }
    }
  });

  it("has the Eden boon pool, threat mapping, and Walker closer", () => {
    expect(FORTUNE_BOON_POOLS["pool-eden-grove"]).toEqual([...EDEN_REWARDS]);
    expect(worldThreatTemplateByWorldId(EDEN_WORLD_ID)).toBe("Paradise Runs");

    const { worldData } = buildWorld(EDEN_WORLD_ID);
    expect(worldData.deckComposition.acts).toHaveLength(3);
    const finalAct = worldData.deckComposition.acts.at(-1)!;
    expect(finalAct.cards.at(-1)).toEqual({ templateId: "The Walker", count: 1 });
  });
});

describe("Eden Prime — shipped startle patterns (REQ-EDEN-47)", () => {
  it("Take the Fruit and Fruit Offered Too Quickly raise Alarm on the next world card", () => {
    const { catalog: edenCatalog, worldData } = buildWorld(EDEN_WORLD_ID);
    const takeFruit = edenTemplate("Take the Fruit");
    const fruitHazard = edenTemplate("Fruit Offered Too Quickly");
    if (takeFruit.kind !== "player" || fruitHazard.kind !== "world") {
      throw new Error("Eden fruit templates have the wrong kind");
    }

    const { state: base } = createWorld(edenCatalog, worldData, 100, DEFAULT_RUN_MODIFIERS);
    const queued = applyEffect(
      edenCatalog,
      { ...base, hand: [], playerDraw: [], worldDraw: [makeWorldCard({ id: "50" })] },
      takeFruit.effect,
    );
    const drawn = drawWorld(queued.state, 1);
    expect(appliedKeywordValue(drawn.state.hand[0]!, "Alarm")).toBe(2);

    const fromHazard = applyEffect(edenCatalog, { ...base, worldDraw: [] }, fruitHazard.onCleared);
    expect(fromHazard.state.pendingKeywordNextWorldCard).toEqual({ keyword: "Alarm", value: 2 });
  });

  it("Curious Swarm is inert when calm and disrupts an alarmed hand", () => {
    const swarm = edenTemplate("Curious Swarm");
    if (swarm.kind !== "world") throw new Error("Curious Swarm missing");

    const calm = makeState({ hp: 10, hand: [makeWorldCard({ id: "1" })] });
    const calmResult = applyEffect(catalog, calm, swarm.onEndOfTurn);
    expect(calmResult.events).toHaveLength(0);

    const target = makePlayerCard({ id: "p1" });
    const alarmed = makeState({
      hand: [alarmedWorld("1", 2), alarmedWorld("2", 2), target],
      playerDraw: [makePlayerCard({ id: "d1" }), makePlayerCard({ id: "d2" })],
    });
    const startled = applyEffect(
      catalog,
      alarmed,
      swarm.onEndOfTurn,
      { type: "PlayCard", cardId: "source", discardId: target.id },
      "1",
    );

    expect(startled.events.some((e) => e.type === "CardsDiscarded")).toBe(true);
    expect(startled.events.some((e) => e.type === "CardsDrawn")).toBe(true);
  });

  it("The Herd Misunderstands only recurs and adds Panic after Alarm thresholds", () => {
    const herd = edenTemplate("The Herd Misunderstands");
    if (herd.kind !== "world") throw new Error("The Herd Misunderstands missing");

    const calm = makeState({ worldDraw: [] });
    expect(applyEffect(catalog, calm, herd.onPartialClear).state.worldDraw).toHaveLength(0);

    const alarmed = makeState({
      hand: [alarmedWorld("1", 2), alarmedWorld("2", 2), alarmedWorld("3", 2)],
      worldDraw: [],
      playerDraw: [],
    });
    const recurred = applyEffect(catalog, alarmed, herd.onPartialClear);
    expect(recurred.state.worldDraw[0]!.templateId).toBe("The Herd Misunderstands");

    const panicked = applyEffect(catalog, alarmed, herd.onEndOfTurn);
    expect(panicked.state.playerDraw[0]!.templateId).toBe("Panic");
  });

  it("Flowers Face the Wrong Sun alarms the first world card only after a greedy turn", () => {
    const flowers = edenTemplate("Flowers Face the Wrong Sun");
    if (flowers.kind !== "world") throw new Error("Flowers Face the Wrong Sun missing");

    const quiet = makeState({
      hand: [makeWorldCard({ id: "10" }), makeWorldCard({ id: "2" })],
      progressDealtThisTurn: 4,
    });
    const quietResult = applyEffect(catalog, quiet, flowers.onEndOfTurn);
    expect(quietResult.events).toHaveLength(0);

    const greedy = { ...quiet, progressDealtThisTurn: 5 };
    const startled = applyEffect(catalog, greedy, flowers.onEndOfTurn);
    expect(appliedKeywordValue(startled.state.hand.find((c) => c.id === "2")!, "Alarm")).toBe(2);
    expect(appliedKeywordValue(startled.state.hand.find((c) => c.id === "10")!, "Alarm")).toBe(0);
  });

  it("The Quiet Grove offers the Eden boon pool", () => {
    const grove = edenTemplate("The Quiet Grove");
    if (grove.kind !== "world") throw new Error("The Quiet Grove missing");

    const result = applyEffect(catalog, makeState(), grove.onCleared);
    const pending = result.state.pendingBoonChoices.at(-1)!;
    expect(pending.setId).toBe("pool-eden-grove");
    expect(pending.chooseCount).toBe(1);
    expect(pending.offeredTemplateIds).toHaveLength(3);
    for (const offered of pending.offeredTemplateIds) {
      expect(FORTUNE_BOON_POOLS["pool-eden-grove"]).toContain(offered);
    }
  });

  it("Gentle Approach, Stillness Lesson, and Hush the Valley reduce or absorb Alarm", () => {
    const gentle = edenTemplate("Gentle Approach");
    const stillness = edenTemplate("Stillness Lesson");
    const hush = edenTemplate("Hush the Valley");
    if (gentle.kind !== "player" || stillness.kind !== "player" || hush.kind !== "player") {
      throw new Error("Eden valve rewards have the wrong kind");
    }

    const hand = [alarmedWorld("1", 2), alarmedWorld("2", 2), alarmedWorld("3", 2)];
    const gentleResult = applyEffect(catalog, makeState({ hand }), gentle.effect, {
      type: "PlayCard",
      cardId: "gentle",
      targetId: "3",
    });
    expect(appliedKeywordValue(gentleResult.state.hand.find((c) => c.id === "1")!, "Alarm")).toBe(
      0,
    );

    const guarded = applyEffect(catalog, makeState({ hand, alarmGuard: 0 }), stillness.effect);
    const suppressed = applyEffect(catalog, guarded.state, keywordGate(2));
    expect(suppressed.state.alarmGuard).toBe(0);
    expect(suppressed.events.some((e) => e.type === "KeywordGuardConsumed")).toBe(true);
    expect(suppressed.events.some((e) => e.type === "HpChanged")).toBe(false);

    const hushed = applyEffect(catalog, makeState({ hand }), hush.effect);
    expect(hushed.state.hand.every((card) => appliedKeywordValue(card, "Alarm") === 0)).toBe(true);
  });

  it("Follow the Shade top-decks distinct Tread Softly", () => {
    const follow = edenTemplate("Follow the Shade");
    if (follow.kind !== "player") throw new Error("Follow the Shade missing");

    const result = applyEffect(catalog, makeState({ playerDraw: [] }), follow.effect);
    expect(result.state.playerDraw[0]!.templateId).toBe("Tread Softly");
  });

  it("Paradise Runs deals real HP pressure and repeats the Eden threat", () => {
    const paradise = edenTemplate("Paradise Runs");
    if (paradise.kind !== "world") throw new Error("Paradise Runs missing");

    const result = applyEffect(
      catalog,
      makeState({
        worldId: EDEN_WORLD_ID,
        hp: 20,
        hand: [alarmedWorld("1", 2), alarmedWorld("2", 2)],
        worldDraw: [],
      }),
      paradise.onEndOfTurn,
    );

    expect(result.state.hp).toBe(16);
    expect(result.events.some((e) => e.type === "DamageDealt")).toBe(true);
    expect(result.state.worldDraw[0]!.templateId).toBe("Paradise Runs");
  });
});

describe("Eden Prime — seeded greed-tax gameplay identity (REQ-EDEN-50)", () => {
  it("contrasts restrained and greedy lines through the same startle hazards", () => {
    const { catalog: edenCatalog } = buildWorld(EDEN_WORLD_ID);

    let calm = seededEdenState(500, { energy: 6 });
    const [calmFruit, calm1] = mintWorld(calm, "Fruit Offered Too Quickly", edenCatalog);
    const [calmWarning, calm2] = mintWorld(calm1, "First Warning Cry", edenCatalog);
    const [calmSwarm, calm3] = mintWorld(calm2, "Curious Swarm", edenCatalog);
    const [calmGrove, calm4] = mintWorld(calm3, "The Quiet Grove", edenCatalog);
    const [calmHerd, calm5] = mintWorld(calm4, "The Herd Misunderstands", edenCatalog);
    const [calmDiscardTarget, calm6] = mintPlayer(calm5, "Explore", edenCatalog);
    const [calmFillers, calm7] = mintPlayers(calm6, "Explore", 3, edenCatalog);
    calm = {
      ...calm7,
      hand: [calmFruit, calmWarning, calmSwarm, calmGrove, calmHerd, calmDiscardTarget],
      playerDraw: calmFillers,
      energy: 6,
    };

    const declinedGift = reduce(edenCatalog, calm, {
      type: "DiscardHazard",
      cardId: calmFruit.id,
    });
    const clearedWarning = reduce(edenCatalog, declinedGift.state, {
      type: "DiscardHazard",
      cardId: calmWarning.id,
    });

    expect(clearedWarning.events.some((e) => e.type === "KeywordApplied")).toBe(false);
    expect(alarmedCardsInHand(clearedWarning.state)).toHaveLength(0);

    const calmSwarmResult = applyEffect(
      edenCatalog,
      clearedWarning.state,
      calmSwarm.onEndOfTurn,
      { type: "PlayCard", cardId: "source", discardId: calmDiscardTarget.id },
      calmSwarm.id,
    );
    expect(calmSwarmResult.events).toHaveLength(0);

    const calmGroveResult = applyEffect(
      edenCatalog,
      clearedWarning.state,
      calmGrove.onEndOfTurn,
      undefined,
      calmGrove.id,
    );
    expect(calmGroveResult.state.worldDraw).toHaveLength(0);

    const calmHerdResult = applyEffect(
      edenCatalog,
      clearedWarning.state,
      calmHerd.onEndOfTurn,
      undefined,
      calmHerd.id,
    );
    expect(calmHerdResult.state.playerDraw[0]?.templateId).not.toBe("Panic");

    let greedy = seededEdenState(501, { energy: 6 });
    const [greedyHerd, greedy1] = mintWorld(greedy, "The Herd Misunderstands", edenCatalog);
    const [greedyGrove, greedy2] = mintWorld(greedy1, "The Quiet Grove", edenCatalog);
    const [greedyWarning, greedy3] = mintWorld(greedy2, "First Warning Cry", edenCatalog);
    const [greedyFruit, greedy4] = mintWorld(greedy3, "Fruit Offered Too Quickly", edenCatalog);
    const [takeFruit, greedy5] = mintPlayer(greedy4, "Take the Fruit", edenCatalog);
    const [sprint, greedy6] = mintPlayer(greedy5, "Sprint", edenCatalog);
    const [explore, greedy7] = mintPlayer(greedy6, "Explore", edenCatalog);
    const [greedyDiscardTarget, greedy8] = mintPlayer(greedy7, "Explore", edenCatalog);
    const [nextSwarm, greedy9] = mintWorld(greedy8, "Curious Swarm", edenCatalog);
    const [greedyFillers, greedy10] = mintPlayers(greedy9, "Explore", 8, edenCatalog);
    greedy = {
      ...greedy10,
      hand: [
        greedyHerd,
        greedyGrove,
        greedyWarning,
        greedyFruit,
        takeFruit,
        sprint,
        explore,
        greedyDiscardTarget,
      ],
      playerDraw: greedyFillers,
      worldDraw: [nextSwarm],
      energy: 6,
    };

    const tookGift = reduce(edenCatalog, greedy, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: greedyFruit.id,
    });
    expect(tookGift.state.pendingKeywordNextWorldCard).toEqual({ keyword: "Alarm", value: 2 });

    const playedFruit = reduce(edenCatalog, tookGift.state, {
      type: "PlayCard",
      cardId: takeFruit.id,
    });
    expect(playedFruit.state.pendingKeywordNextWorldCard).toEqual({ keyword: "Alarm", value: 2 });

    const overDrew = reduce(edenCatalog, playedFruit.state, {
      type: "PlayCard",
      cardId: sprint.id,
      choice: 0,
    });
    const alarmedSwarm = overDrew.state.hand.find((c) => c.templateId === "Curious Swarm");
    expect(alarmedSwarm).toBeDefined();
    expect(alarmedSwarm !== undefined && appliedKeywordValue(alarmedSwarm, "Alarm")).toBe(2);

    const warningStartle = applyEffect(
      edenCatalog,
      overDrew.state,
      greedyWarning.onEndOfTurn,
      undefined,
      greedyWarning.id,
    );
    expect(
      alarmedCardsInHand(warningStartle.state)
        .map((c) => c.templateId)
        .sort(),
    ).toEqual(["Curious Swarm", "First Warning Cry", "The Herd Misunderstands"]);

    const greedySwarm = warningStartle.state.hand.find(
      (c): c is WorldCard => c.kind === "world" && c.templateId === "Curious Swarm",
    )!;
    const greedySwarmResult = applyEffect(
      edenCatalog,
      warningStartle.state,
      greedySwarm.onEndOfTurn,
      { type: "PlayCard", cardId: "source", discardId: greedyDiscardTarget.id },
      greedySwarm.id,
    );
    expect(greedySwarmResult.events.some((e) => e.type === "CardsDiscarded")).toBe(true);
    expect(greedySwarmResult.events.some((e) => e.type === "CardsDrawn")).toBe(true);

    const greedyGroveResult = applyEffect(
      edenCatalog,
      warningStartle.state,
      greedyGrove.onEndOfTurn,
      undefined,
      greedyGrove.id,
    );
    expect(greedyGroveResult.state.worldDraw[0]!.templateId).toBe("Curious Swarm");

    const greedyHerdResult = applyEffect(
      edenCatalog,
      warningStartle.state,
      greedyHerd.onEndOfTurn,
      undefined,
      greedyHerd.id,
    );
    expect(greedyHerdResult.state.playerDraw[0]!.templateId).toBe("Panic");
  });
});
