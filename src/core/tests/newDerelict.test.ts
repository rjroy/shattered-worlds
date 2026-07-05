import { describe, expect, it } from "bun:test";
import { buildWorld, FORTUNE_BOON_POOLS } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { effectiveWorldCardCost } from "../engine/effectiveCards";
import { applyEffect } from "../engine/effects";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import { appliedKeywordValue } from "../model/keywords";
import { mintCard } from "../model/cards";
import { dealProgress } from "../effects/dealProgress";
import { drawWorld } from "../engine/draw";
import type { GameState, WorldCard } from "../model/types";

const WORLD_ID = "new-derelict";
const WORLD_CARDS = [
  "Bulkhead 7-C Seals",
  "Unfinished Captain's Address",
  "Gravity Priority Shift",
  "Administrative Misfile",
  "Corridor Becomes Lifeboat",
  "Systems Panel",
  "The Order Arrives",
] as const;
const REQUIRED_HOOKS = [
  "onDiscarded",
  "onCleared",
  "onPartialClear",
  "onEndOfTurn",
  "onDraw",
] as const;
const VALID_KEYWORDS = new Set([
  "Obstructed",
  "Creature",
  "Slow",
  "Spore",
  "Concealed",
  "Alarm",
  "Lockdown",
]);

function worldTemplate(id: (typeof WORLD_CARDS)[number]) {
  const template = buildWorld(WORLD_ID).catalog[id];
  if (template?.kind !== "world") throw new Error(`${id} missing`);
  return template;
}

function locked(card: WorldCard): WorldCard {
  return { ...card, appliedKeywords: [{ name: "Lockdown", value: 1 }] };
}

describe("New Derelict world data", () => {
  it("registers, builds, maps its threat, and ends act 3 with The Walker", () => {
    expect(worldDataRegistry.map((bundle) => bundle.id)).toContain(WORLD_ID);
    const { catalog, worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
    expect(new Set(Object.keys(catalog)).size).toBe(Object.keys(catalog).length);
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("The Order Arrives");
    expect(worldData.deckComposition.acts).toHaveLength(3);
    expect(worldData.deckComposition.acts.at(-1)?.cards.at(-1)).toEqual({
      templateId: "The Walker",
      count: 1,
    });
  });

  it("defines all five hooks and valid keywords on each world card", () => {
    for (const id of WORLD_CARDS) {
      const template = worldTemplate(id);
      for (const hook of REQUIRED_HOOKS) expect(template[hook]).toBeDefined();
      for (const keyword of template.keywords) {
        expect(VALID_KEYWORDS.has(keyword.split(":")[0]!)).toBe(true);
      }
    }
  });

  it("authors the authorized discard-recall substitutions and boon pool", () => {
    const { catalog } = buildWorld(WORLD_ID);
    expect(catalog["Follow the Checklist"]?.kind === "player" && catalog["Follow the Checklist"].effect)
      .toEqual({
        kind: "Sequence",
        steps: [
          { kind: "ReturnPlayerDiscardToTop", min: 0, max: 1 },
          { kind: "Draw", player: 1 },
          { kind: "Brace", amount: 1 },
        ],
      });
    expect(worldTemplate("Gravity Priority Shift").onPartialClear).toEqual({
      kind: "RecallPlayerDiscard",
      policy: "highestCost",
    });
    expect(FORTUNE_BOON_POOLS["pool-derelict-override"]).toEqual([
      "Emergency Route",
      "Override Badge",
      "Manual Release",
      "Follow the Checklist",
    ]);
  });
});

describe("New Derelict isolate effects", () => {
  it("Bulkhead seals itself and redirects traffic when ignored", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: base } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const card = base.worldDraw.find((candidate) => candidate.templateId === "Bulkhead 7-C Seals")!;
    const state: GameState = { ...base, hand: [card], worldDraw: [] };
    const result = applyEffect(catalog, state, worldTemplate("Bulkhead 7-C Seals").onEndOfTurn, undefined, card.id);
    expect(appliedKeywordValue(result.state.hand[0]!, "Lockdown")).toBe(1);
    expect(result.state.worldDraw[0]?.templateId).toBe("Gravity Priority Shift");
  });

  it("each Locked hazard pays its own Lockdown tax regardless of clustering", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 2, DEFAULT_RUN_MODIFIERS);
    const [bulkheadCard, afterBulkhead] = mintCard(catalog, state, "Bulkhead 7-C Seals");
    const [gravityCard] = mintCard(catalog, afterBulkhead, "Gravity Priority Shift");
    if (bulkheadCard.kind !== "world" || gravityCard.kind !== "world") {
      throw new Error("New Derelict hazard templates must mint world cards");
    }
    const bulkhead = locked(bulkheadCard);
    const gravity = locked(gravityCard);

    const isolatedBulkhead = dealProgress(
      catalog,
      { ...state, hand: [bulkhead] },
      bulkhead.id,
      effectiveWorldCardCost(bulkhead, { ...state, hand: [bulkhead] }),
      applyEffect,
    );
    const isolatedGravity = dealProgress(
      catalog,
      { ...state, hand: [gravity] },
      gravity.id,
      effectiveWorldCardCost(gravity, { ...state, hand: [gravity] }),
      applyEffect,
    );
    expect(isolatedBulkhead.events.some((event) => event.type === "HazardResolved")).toBe(true);
    expect(isolatedGravity.events.some((event) => event.type === "HazardResolved")).toBe(true);
    const isolatedProgress =
      effectiveWorldCardCost(bulkhead, { ...state, hand: [bulkhead] }) +
      effectiveWorldCardCost(gravity, { ...state, hand: [gravity] });

    const clusteredState = { ...state, hand: [bulkhead, gravity] };
    const firstCost = effectiveWorldCardCost(bulkhead, clusteredState);
    const firstClear = dealProgress(catalog, clusteredState, bulkhead.id, firstCost, applyEffect);
    expect(firstClear.events.some((event) => event.type === "HazardResolved")).toBe(true);
    const remaining = firstClear.state.hand.find(
      (card): card is WorldCard => card.kind === "world" && card.id === gravity.id,
    )!;
    const secondCost = effectiveWorldCardCost(remaining, firstClear.state);
    const secondClear = dealProgress(
      catalog,
      firstClear.state,
      remaining.id,
      secondCost,
      applyEffect,
    );
    expect(secondClear.events.some((event) => event.type === "HazardResolved")).toBe(true);

    expect(firstCost + secondCost).toBe(isolatedProgress);
  });

  it("taxes a template carrying Lockdown", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 2, DEFAULT_RUN_MODIFIERS);
    const [systemsCard, afterSystems] = mintCard(catalog, state, "Systems Panel");
    const [bulkheadCard] = mintCard(catalog, afterSystems, "Bulkhead 7-C Seals");
    if (systemsCard.kind !== "world" || bulkheadCard.kind !== "world") {
      throw new Error("New Derelict hazard templates must mint world cards");
    }
    const systems = locked(systemsCard);
    const bulkhead = locked(bulkheadCard);
    const clusteredState = { ...state, hand: [systems, bulkhead] };

    expect(effectiveWorldCardCost(systems, clusteredState)).toBe(systems.cost + 1);
  });

  it("Misfile seals the first hazard and grants Override Badge when cleared", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 3, DEFAULT_RUN_MODIFIERS);
    const first = state.worldDraw[0]!;
    const second = { ...state.worldDraw[1]!, id: "999" };
    const staged = { ...state, hand: [second, first] };
    const sealed = applyEffect(catalog, staged, worldTemplate("Administrative Misfile").onEndOfTurn);
    expect(appliedKeywordValue(sealed.state.hand.find((card) => card.id === first.id)!, "Lockdown")).toBe(1);
    const granted = applyEffect(catalog, staged, worldTemplate("Administrative Misfile").onCleared);
    expect(granted.state.playerDiscard.some((card) => card.templateId === "Override Badge")).toBe(true);
  });

  it("Systems Panel offers the override pool", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 4, DEFAULT_RUN_MODIFIERS);
    const result = applyEffect(catalog, state, worldTemplate("Systems Panel").onCleared);
    expect(result.state.pendingBoonChoices.at(-1)?.setId).toBe("pool-derelict-override");
  });

  it("release rewards strip Lockdown and Emergency Route seals the next draw", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 5, DEFAULT_RUN_MODIFIERS);
    const hazard = locked(state.worldDraw[0]!);
    const badge = catalog["Override Badge"]!;
    const route = catalog["Emergency Route"]!;
    if (badge.kind !== "player" || route.kind !== "player") throw new Error("rewards missing");
    const released = applyEffect(catalog, { ...state, hand: [hazard] }, badge.effect, {
      type: "PlayCard",
      cardId: badge.name,
      targetId: hazard.id,
    });
    expect(appliedKeywordValue(released.state.hand[0]!, "Lockdown")).toBe(0);
    const queued = applyEffect(catalog, state, route.effect);
    expect(queued.state.pendingKeywordNextWorldCard).toContainEqual({ name: "Lockdown", value: 1 });
  });

  it("Manual Release removes Lockdown from up to three cards", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 51, DEFAULT_RUN_MODIFIERS);
    const hazards = state.worldDraw.slice(0, 3).map(locked);
    const release = catalog["Manual Release"];
    if (release?.kind !== "player") throw new Error("Manual Release missing");

    const result = applyEffect(catalog, { ...state, hand: hazards }, release.effect);
    expect(result.state.hand.every((card) => appliedKeywordValue(card, "Lockdown") === 0)).toBe(
      true,
    );
    const removed = result.events.find((event) => event.type === "KeywordRemoved");
    expect(removed?.type === "KeywordRemoved" && removed.ids).toHaveLength(3);
  });

  it("The Order Arrives deals base plus Lockdown damage and repeats itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state } = createWorld(catalog, worldData, 6, DEFAULT_RUN_MODIFIERS);
    const hazard = locked(state.worldDraw[0]!);
    const result = applyEffect(catalog, { ...state, hand: [hazard] }, worldTemplate("The Order Arrives").onEndOfTurn);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "DamageDealt", amount: 3 }));
    expect(result.state.worldDraw[0]?.templateId).toBe("The Order Arrives");
  });
});

describe("New Derelict seeded policy lines", () => {
  it("prompt clearing stays open while shortcuts cluster, then Manual Release collapses the tax", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const { state: seeded } = createWorld(catalog, worldData, 20260630, DEFAULT_RUN_MODIFIERS);

    // Prompt-clearing line: stage each sealing hazard alone and pay its base
    // cost immediately. No end-turn sealing hook is allowed to fire.
    let prompt = seeded;
    let promptProgress = 0;
    for (let i = 0; i < 3; i++) {
      const [card, next] = mintCard(catalog, prompt, "Bulkhead 7-C Seals");
      if (card.kind !== "world") throw new Error("Bulkhead must mint a world card");
      prompt = { ...next, hand: [card] };
      const cleared = dealProgress(catalog, prompt, card.id, card.cost, applyEffect);
      prompt = cleared.state;
      promptProgress += card.cost;
      expect(cleared.events.some((event) => event.type === "HazardResolved")).toBe(true);
      expect(prompt.hand.filter((held) => appliedKeywordValue(held, "Lockdown") > 0)).toHaveLength(0);
    }
    expect(promptProgress).toBe(6);

    // Shortcut line: Emergency Route seals the next deterministic world draw,
    // then two ignored self-sealing hazards create a three-card cluster.
    const route = catalog["Emergency Route"];
    const release = catalog["Manual Release"];
    if (route?.kind !== "player" || release?.kind !== "player") {
      throw new Error("New Derelict policy rewards missing");
    }
    const shortcutQueued = applyEffect(catalog, seeded, route.effect);
    const shortcutDrawn = drawWorld(shortcutQueued.state, 1);
    const shortcutHazard = shortcutDrawn.state.hand.find(
      (card): card is WorldCard =>
        card.kind === "world" && appliedKeywordValue(card, "Lockdown") > 0,
    )!;
    expect(appliedKeywordValue(shortcutHazard, "Lockdown")).toBe(1);

    const [bulkheadA, afterA] = mintCard(catalog, shortcutDrawn.state, "Bulkhead 7-C Seals");
    const [bulkheadB, afterB] = mintCard(catalog, afterA, "Bulkhead 7-C Seals");
    if (bulkheadA.kind !== "world" || bulkheadB.kind !== "world") {
      throw new Error("Bulkhead must mint world cards");
    }
    let clustered: GameState = {
      ...afterB,
      hand: [shortcutHazard, bulkheadA, bulkheadB],
      worldDraw: [],
    };
    clustered = applyEffect(
      catalog,
      clustered,
      { kind: "ApplyKeyword", keyword: "Lockdown", value: 1, target: "self" },
      undefined,
      bulkheadA.id,
    ).state;
    clustered = applyEffect(
      catalog,
      clustered,
      { kind: "ApplyKeyword", keyword: "Lockdown", value: 1, target: "self" },
      undefined,
      bulkheadB.id,
    ).state;
    const lockedCards = clustered.hand.filter(
      (card): card is WorldCard => card.kind === "world" && appliedKeywordValue(card, "Lockdown") > 0,
    );
    expect(lockedCards).toHaveLength(3);
    expect(effectiveWorldCardCost(lockedCards[1]!, clustered)).toBe(lockedCards[1]!.cost + 1);

    const released = applyEffect(catalog, clustered, release.effect);
    expect(released.state.hand.every((card) => appliedKeywordValue(card, "Lockdown") === 0)).toBe(true);
    const reopened = released.state.hand.find(
      (card): card is WorldCard => card.kind === "world" && card.id === lockedCards[1]!.id,
    )!;
    expect(effectiveWorldCardCost(reopened, released.state)).toBe(reopened.cost);
  });
});
