import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { availableActions } from "../engine/available";
import { applyEffect } from "../engine/effects";
import { createWorld } from "../engine/world";
import { concealOf } from "../model/keywords";
import { mintCard, WorldCardTemplate } from "../model/cards";
import type { GameEvent, GameState, PlayerCard, WorldCard } from "../model/types";
import type { CardCatalog } from "../model/catalog";

const FOG_ID = "fog-beach-party";

/** Fog-specific player template IDs. */
const FOG_PLAYER_TEMPLATES = [
  "Flashlight",
  "Flare Gun",
  "Bonfire",
  "Searchlight",
  "Find Fire Axe",
  "Fire Axe",
  "Steady",
  "Cut It Loose",
] as const;

/** Fog-specific world template IDs with Concealed keywords. */
const FOG_CONCEALED_TEMPLATES = ["Rolling Fog", "Whiteout"] as const;

function mintPlayer(
  catalog: CardCatalog,
  state: GameState,
  templateId: string,
): [PlayerCard, GameState] {
  const [card, next] = mintCard(catalog, state, templateId);
  expect(card.kind).toBe("player");
  return [card as unknown as PlayerCard, next];
}

function mintWorld(
  catalog: CardCatalog,
  state: GameState,
  templateId: string,
): [WorldCard, GameState] {
  const [card, next] = mintCard(catalog, state, templateId);
  expect(card.kind).toBe("world");
  return [card as unknown as WorldCard, next];
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
    const gainLightIds = FOG_PLAYER_TEMPLATES.filter((tid) => {
      const tpl = catalog[tid];
      return tpl?.kind === "player" && (tpl as unknown as PlayerCard).effect.kind === "GainLight";
    });

    expect(gainLightIds.length).toBeGreaterThan(0);

    for (const templateId of gainLightIds) {
      const { state: base } = createWorld(catalog, worldData, 1);
      const [card, next] = mintPlayer(catalog, { ...base, worldId: FOG_ID }, templateId);
      expect(card.effect.kind).toBe("GainLight");
      if (card.effect.kind !== "GainLight") continue;

      const beforeLight = 2;
      const { state: after, events } = applyEffect(
        catalog,
        { ...next, light: beforeLight },
        card.effect,
      );

      expect(after.light).toBe(beforeLight + card.effect.amount);
      expect(events).toContainEqual({
        type: "LightChanged",
        light: after.light,
        sourceKind: "GainLight",
      });
    }
  });

  it("keeps concealed fog hazards out of single-target legal targets until Light reaches the depth", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);

    // Find a fog world template with Concealed keywords
    const concealedTemplateId = FOG_CONCEALED_TEMPLATES.find((tid) => {
      const tpl = catalog[tid];
      if (tpl?.kind !== "world") return false;
      return (tpl as unknown as WorldCardTemplate).keywords.some((k: string) =>
        k.startsWith("Concealed"),
      );
    });
    expect(concealedTemplateId, "expected a Concealed fog world template").toBeDefined();

    const { state: base } = createWorld(catalog, worldData, 1);
    const [explore, s1] = mintPlayer(catalog, base, "Explore");
    const [hazard, s2] = mintWorld(catalog, { ...s1, worldId: FOG_ID }, concealedTemplateId!);
    const depth = concealOf(hazard);
    expect(depth).toBeGreaterThan(0);

    const fogged = { ...s2, hand: [explore, hazard], energy: explore.energyCost, light: depth - 1 };
    const visible = { ...fogged, light: depth };

    expect(availableActions(fogged).legalTargets(explore.id, 0)).not.toContain(hazard.id);
    expect(availableActions(visible).legalTargets(explore.id, 0)).toContain(hazard.id);
  });

  it("lets fog-authored sweeps hit concealed hazards without single-target visibility", () => {
    const { catalog, worldData } = buildWorld(FOG_ID);

    // Find a fog sweep card with DealProgressAll
    const sweepTid: string | undefined = [...FOG_PLAYER_TEMPLATES, "Panic"].find((tid) => {
      const tpl = catalog[tid];
      return (
        tpl?.kind === "player" && (tpl as unknown as PlayerCard).effect.kind === "DealProgressAll"
      );
    });
    expect(sweepTid, "expected a fog sweep card").toBeDefined();

    // Find a Concealed Obstructed fog hazard
    const hiddenTid = FOG_CONCEALED_TEMPLATES.find((tid) => {
      const tpl = catalog[tid];
      if (tpl?.kind !== "world") return false;
      const wc = tpl as unknown as WorldCardTemplate;
      return (
        wc.keywords.some((k: string) => k.startsWith("Obstructed")) &&
        wc.keywords.some((k: string) => k.startsWith("Concealed"))
      );
    });
    expect(hiddenTid, "expected a Concealed Obstructed fog hazard").toBeDefined();

    const { state: base } = createWorld(catalog, worldData, 1);
    const [sweep, s1] = mintPlayer(catalog, { ...base, worldId: FOG_ID }, sweepTid!);
    const [hazard, s2] = mintWorld(catalog, { ...s1, worldId: FOG_ID }, hiddenTid!);
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
    const progress = events.find((e: GameEvent) => e.type === "ProgressDealt") as
      | { hazardId: string; templateId: string; amount: number }
      | undefined;

    expect(progress?.hazardId).toBe(hazard.id);
  });
});
