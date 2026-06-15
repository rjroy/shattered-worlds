import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { FOG_BEACH_PARTY_BUNDLE } from "../../data/worlds/fog-beach-party/index";
import { availableActions } from "../engine/available";
import { applyEffect } from "../engine/effects";
import { createWorld } from "../engine/world";
import { concealOf } from "../model/keywords";
import { mintCard } from "../model/cards";
import type { CardEffect, GameState, PlayerCard, WorldCard } from "../model/types";
import type { CardCatalog } from "../model/catalog";
import type { PlayerCardTemplate, WorldCardTemplate } from "../model/cards";

const FOG_ID = "fog-beach-party";
const fogSource = FOG_BEACH_PARTY_BUNDLE.source;

function fogPlayerTemplateIdsMatching(predicate: (effect: CardEffect) => boolean): string[] {
  return Object.entries(fogSource.cardTemplates)
    .filter(([, raw]) => {
      const t = raw as unknown as PlayerCardTemplate | WorldCardTemplate;
      return t.kind === "player" && predicate(t.effect);
    })
    .map(([id]) => id);
}

function firstFogWorldTemplateIdMatching(
  predicate: (template: WorldCardTemplate) => boolean,
): string {
  const entry = Object.entries(fogSource.cardTemplates).find(([, raw]) => {
    const t = raw as unknown as PlayerCardTemplate | WorldCardTemplate;
    return t.kind === "world" && predicate(t);
  });

  expect(entry, "expected a fog world template for this integration test").toBeDefined();
  return entry![0];
}

function mintPlayer(catalog: CardCatalog, state: GameState, templateId: string): [PlayerCard, GameState] {
  const [card, next] = mintCard(catalog, state, templateId);
  expect(card.kind).toBe("player");
  return [card as PlayerCard, next];
}

function mintWorld(catalog: CardCatalog, state: GameState, templateId: string): [WorldCard, GameState] {
  const [card, next] = mintCard(catalog, state, templateId);
  expect(card.kind).toBe("world");
  return [card as WorldCard, next];
}

describe("fog-beach-party integration", () => {
  it("builds the fog world and creates an opening game state", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);
    const { state } = createWorld(catalog, worldData, 12345);

    expect(state.worldId).toBe(FOG_ID);
    expect(state.totalActs).toBe(worldData.deckComposition.acts.length);
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.light).toBe(Math.max(0, (worldData.startLight ?? 0) - 1));
  });

  it("applies fog-authored GainLight cards through the effect dispatcher", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);
    const gainLightIds = fogPlayerTemplateIdsMatching((effect) => effect.kind === "GainLight");

    expect(gainLightIds.length).toBeGreaterThan(0);

    for (const templateId of gainLightIds) {
      const { state: base } = createWorld(catalog, worldData, 1);
      const [card, next] = mintPlayer(catalog, { ...base, worldId: FOG_ID }, templateId);
      expect(card.effect.kind).toBe("GainLight");
      if (card.effect.kind !== "GainLight") continue;

      const beforeLight = 2;
      const { state: after, events } = applyEffect(catalog, { ...next, light: beforeLight }, card.effect);

      expect(after.light).toBe(beforeLight + card.effect.amount);
      expect(events).toContainEqual({ type: "LightChanged", light: after.light });
    }
  });

  it("keeps concealed fog hazards out of single-target legal targets until Light reaches the depth", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);
    const concealedTemplateId = firstFogWorldTemplateIdMatching((t) =>
      t.keywords.some((k) => k.startsWith("Concealed:")),
    );

    const { state: base } = createWorld(catalog, worldData, 1);
    const [explore, s1] = mintPlayer(catalog, base, "Explore");
    const [hazard, s2] = mintWorld(catalog, { ...s1, worldId: FOG_ID }, concealedTemplateId);
    const depth = concealOf(hazard);
    expect(depth).toBeGreaterThan(0);

    const fogged = { ...s2, hand: [explore, hazard], energy: explore.energyCost, light: depth - 1 };
    const visible = { ...fogged, light: depth };

    expect(availableActions(fogged).legalTargets(explore.id, 0)).not.toContain(hazard.id);
    expect(availableActions(visible).legalTargets(explore.id, 0)).toContain(hazard.id);
  });

  it("lets fog-authored sweeps hit concealed hazards without single-target visibility", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);
    const sweepTemplateId = fogPlayerTemplateIdsMatching(
      (effect) => effect.kind === "DealProgressAll",
    )[0];
    const hiddenConcealedTemplateId = firstFogWorldTemplateIdMatching(
      (t) => t.keywords.includes("Hidden") && t.keywords.some((k) => k.startsWith("Concealed:")),
    );

    expect(sweepTemplateId, "expected a fog sweep card for this integration test").toBeDefined();

    const { state: base } = createWorld(catalog, worldData, 1);
    const [sweep, s1] = mintPlayer(catalog, { ...base, worldId: FOG_ID }, sweepTemplateId!);
    const [hazard, s2] = mintWorld(catalog, { ...s1, worldId: FOG_ID }, hiddenConcealedTemplateId);
    expect(sweep.effect.kind).toBe("DealProgressAll");
    if (sweep.effect.kind !== "DealProgressAll") return;

    const state = {
      ...s2,
      hand: [sweep, hazard],
      energy: sweep.energyCost,
      light: Math.max(0, concealOf(hazard) - 1),
      progress: {},
    };

    expect(availableActions(state).playable.map((p) => p.cardId)).toContain(sweep.id);

    const { events } = applyEffect(catalog, state, sweep.effect);
    const progress = events.find(
      (e): e is Extract<typeof e, { type: "ProgressDealt" }> => e.type === "ProgressDealt",
    );

    expect(progress?.hazardId).toBe(hazard.id);
  });
});
