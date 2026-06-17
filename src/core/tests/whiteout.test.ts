import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { availableActions } from "../engine/available";
import { reduce } from "../engine/reduce";
import { createRng } from "../engine/rng";
import { createWorld } from "../engine/world";
import type { CardCatalog } from "../model/catalog";
import type { GameState, PlayerCard } from "../model/types";
import { makePlayerCard, makeState, makeWorldCard } from "./testFixture";

function stateWithHand(hand: GameState["hand"], overrides: Partial<GameState> = {}): GameState {
  return {
    ...makeState(),
    hand,
    energy: 3,
    heat: 0,
    playerDraw: [makePlayerCard({ id: "draw-next" })],
    ...overrides,
  };
}

function heatCard(effect: PlayerCard["effect"]): PlayerCard {
  return makePlayerCard({ id: "heat-card", templateId: "Heat Card", name: "Heat Card", effect });
}

describe("Whiteout frozen cards and heat", () => {
  it("excludes frozen player cards from playable actions", () => {
    const frozen = makePlayerCard({
      id: "frozen-explore",
      effect: { kind: "DealProgress", base: 1 },
      frozen: 2,
    });
    const hazard = makeWorldCard({ id: "hazard" });
    const state = stateWithHand([frozen, hazard]);

    expect(availableActions(state).playable).toEqual([]);
  });

  it("retains frozen player cards across end turn and thaws before energy gain", () => {
    const frozen = makePlayerCard({ id: "frozen", templateId: "Explore", frozen: 1 });
    const unfrozen = makePlayerCard({ id: "loose", templateId: "Sprint" });
    const hazard = makeWorldCard({ id: "hazard", onEndOfTurn: { kind: "None" } });
    const state = stateWithHand([hazard, frozen, unfrozen], {
      playerDraw: [
        makePlayerCard({ id: "draw-1" }),
        makePlayerCard({ id: "draw-2" }),
        makePlayerCard({ id: "draw-3" }),
        makePlayerCard({ id: "draw-4" }),
        makePlayerCard({ id: "draw-5" }),
      ],
    });

    const { state: after, events } = reduce({} as CardCatalog, state, { type: "EndTurn" });

    expect(after.hand.some((card) => card.id === "frozen" && card.kind === "player")).toBe(true);
    expect(after.hand.some((card) => card.id === "loose")).toBe(false);
    expect(after.playerDiscard.some((card) => card.id === "loose")).toBe(true);
    expect(events).toContainEqual({
      type: "CardsThawed",
      ids: ["frozen"],
      templateIds: ["Explore"],
    });
    expect(events.findIndex((event) => event.type === "CardsThawed")).toBeLessThan(
      events.findIndex((event) => event.type === "EnergyChanged"),
    );
  });

  it("freezes unfrozen player cards as instance state and emits ids plus templates", () => {
    const source = makeWorldCard({
      id: "freeze-hazard",
      onEndOfTurn: { kind: "FreezeCards", amount: 1, duration: 2 },
    });
    const first = makePlayerCard({ id: "copy-a", templateId: "Explore" });
    const second = makePlayerCard({ id: "copy-b", templateId: "Explore" });
    const state = stateWithHand([source, first, second], { rng: createRng(7) });

    const { state: after, events } = reduce({} as CardCatalog, state, { type: "EndTurn" });
    const frozenCopies = after.hand.filter(
      (card) => card.kind === "player" && card.templateId === "Explore" && (card.frozen ?? 0) > 0,
    );

    expect(frozenCopies).toHaveLength(1);
    expect(events.some((event) => event.type === "CardsFrozen")).toBe(true);
  });

  it("gains heat, spends heat to thaw, and emits signed HeatChanged events", () => {
    const frozen = makePlayerCard({ id: "locked", templateId: "Explore", frozen: 3 });
    const gain = heatCard({ kind: "GainHeat", amount: 2 });
    const thaw = makePlayerCard({
      id: "thaw",
      effect: { kind: "ThawCards", amount: 1, heatCost: 1 },
    });
    const gained = reduce({} as CardCatalog, stateWithHand([gain, thaw, frozen]), {
      type: "PlayCard",
      cardId: gain.id,
    });

    const thawed = reduce({} as CardCatalog, gained.state, {
      type: "PlayCard",
      cardId: thaw.id,
      thawIds: [frozen.id],
    });

    expect(gained.events).toContainEqual({ type: "HeatChanged", heat: 2, delta: 2 });
    expect(thawed.events).toContainEqual({ type: "HeatChanged", heat: 1, delta: -1 });
    expect(thawed.events).toContainEqual({
      type: "CardsThawed",
      ids: [frozen.id],
      templateIds: ["Explore"],
    });
    const thawedCard = thawed.state.hand.find(
      (card): card is PlayerCard => card.id === frozen.id && card.kind === "player",
    );
    expect(thawedCard?.frozen).toBeUndefined();
  });

  it("burns frozen cards for heat as an emergency valve", () => {
    const burn = heatCard({ kind: "BurnForHeat", min: 1, max: 1, amountPerCard: 3 });
    const frozen = makePlayerCard({ id: "locked", templateId: "Explore", frozen: 2 });
    const state = stateWithHand([burn, frozen]);

    expect(availableActions(state).legalTargets(burn.id, 0)).toContain(frozen.id);

    const { state: after, events } = reduce({} as CardCatalog, state, {
      type: "PlayCard",
      cardId: burn.id,
      destroyIds: [frozen.id],
    });

    expect(after.heat).toBe(3);
    expect(after.hand.some((card) => card.id === frozen.id)).toBe(false);
    expect(events).toContainEqual({
      type: "CardsBurnedForHeat",
      ids: [frozen.id],
      templateIds: ["Explore"],
    });
  });

  it("assembles the Whiteout world with three acts and a final Walker", () => {
    const { catalog, worldData } = buildWorld("whiteout-parking-garage");
    const finalAct = worldData.deckComposition.acts[2]!;

    expect(worldData.worldId).toBe("whiteout-parking-garage");
    expect(worldData.deckComposition.acts).toHaveLength(3);
    expect(finalAct.cards.at(-1)).toEqual({ templateId: "The Walker", count: 1 });
    expect(catalog["The Walker"]).toBeDefined();
    expect(catalog["Summon Door"]).toBeDefined();
    expect(catalog["Door"]).toBeDefined();
    expect(worldData.startHeat).toBe(1);

    const { state } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    expect(state.heat).toBe(1);
  });
});
