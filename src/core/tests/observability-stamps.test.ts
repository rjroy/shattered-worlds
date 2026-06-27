import { describe, expect, it } from "bun:test";
import { applyEffect } from "../engine/effects";
import { drawPlayer, drawWorld, resolveForceDestroy } from "../engine/draw";
import { createBoonOffer } from "../engine/actBoon";
import { resolvePool } from "../effects/pools";
import type { CardEffect } from "../model/types";
import { catalog, makePlayerCard, makeState, makeWorldCard } from "./testFixture";

// Step 2 (observability boundary): events whose identities came from a hidden
// zone carry `revealedFromHidden: true`, and events whose outcome was chosen by
// the rng at resolution carry `randomized: true`. Each stamp lives at its emit
// site, asserted here per audited site. Determinize-only events (DeckShuffled,
// ActAdvanced, fixed CardGained, etc.) deliberately carry neither flag.

describe("observability emit-site stamps", () => {
  it("drawPlayer stamps CardsDrawn (bHazard:false) revealedFromHidden", () => {
    const card = makePlayerCard({ id: "draw-me" });
    const state = makeState({ playerDraw: [card] });

    const { events } = drawPlayer(state, 1);
    const drawn = events.find((e) => e.type === "CardsDrawn");

    expect(drawn).toBeDefined();
    expect(drawn?.type === "CardsDrawn" && drawn.bHazard).toBe(false);
    expect(drawn?.revealedFromHidden).toBe(true);
  });

  it("drawWorld stamps CardsDrawn (bHazard:true) and HazardAdded revealedFromHidden", () => {
    const hazard = makeWorldCard({ id: "world-draw-me" });
    const state = makeState({ worldDraw: [hazard] });

    const { events } = drawWorld(state, 1);
    const drawn = events.find((e) => e.type === "CardsDrawn");
    const added = events.find((e) => e.type === "HazardAdded");

    expect(drawn?.type === "CardsDrawn" && drawn.bHazard).toBe(true);
    expect(drawn?.revealedFromHidden).toBe(true);
    expect(added).toBeDefined();
    expect(added?.revealedFromHidden).toBe(true);
  });

  it("resolveForceDestroy stamps CardDestroyed randomized alongside the source stamp", () => {
    const loot = Array.from({ length: 4 }, (_, i) => makePlayerCard({ id: `loot-${i}` }));
    const state = makeState({
      hand: loot,
      pendingForceDestroy: 1,
      pendingForceDestroySource: "snatcher",
    });

    const { events } = resolveForceDestroy(state);
    const destroyed = events.find((e) => e.type === "CardDestroyed");

    expect(destroyed).toBeDefined();
    expect(destroyed?.randomized).toBe(true);
    // The randomized stamp must coexist with the existing source provenance.
    expect(destroyed?.sourceCardId).toBe("snatcher");
  });

  it("ExileTopWorldCards stamps WorldCardsExiled revealedFromHidden", () => {
    const top = makeWorldCard({ id: "exile-me", canExile: true });
    const state = makeState({ worldDraw: [top] });
    const effect: CardEffect = { kind: "ExileTopWorldCards", amount: 1 };

    const { events } = applyEffect(catalog, state, effect);
    const exiled = events.find((e) => e.type === "WorldCardsExiled");

    expect(exiled).toBeDefined();
    expect(exiled?.revealedFromHidden).toBe(true);
  });

  it("FreezeCards stamps CardsFrozen randomized", () => {
    const cards = Array.from({ length: 3 }, (_, i) => makePlayerCard({ id: `hand-${i}` }));
    const state = makeState({ hand: cards });
    const effect: CardEffect = { kind: "FreezeCards", amount: 1, duration: 2 };

    const { events } = applyEffect(catalog, state, effect);
    const frozen = events.find((e) => e.type === "CardsFrozen");

    expect(frozen).toBeDefined();
    expect(frozen?.randomized).toBe(true);
  });

  it("GainRandomCard stamps CardGained randomized while keeping setName", () => {
    const state = makeState();
    const effect: CardEffect = { kind: "GainRandomCard", setId: "pool-fortune", setName: "Fortune" };

    const { events } = applyEffect(catalog, state, effect);
    const gained = events.find((e) => e.type === "CardGained");

    expect(gained).toBeDefined();
    expect(gained?.randomized).toBe(true);
    expect(gained?.type === "CardGained" && gained.setName).toBe("Fortune");
  });

  it("createBoonOffer stamps BoonOffered randomized", () => {
    const state = makeState();
    const poolTemplateIds = resolvePool("pool-fortune") ?? [];
    expect(poolTemplateIds.length).toBeGreaterThan(0);

    const { event } = createBoonOffer(catalog, state, {
      source: "worldClear",
      setId: "pool-fortune",
      setName: "Fortune",
      poolTemplateIds,
      offeredCount: 3,
      chooseCount: 1,
    });

    expect(event?.type).toBe("BoonOffered");
    expect(event?.randomized).toBe(true);
  });

  describe("RecallPlayerDiscard: only the random policy is stamped", () => {
    function recall(policy: NonNullable<Extract<CardEffect, { kind: "RecallPlayerDiscard" }>["policy"]>) {
      const discard = Array.from({ length: 3 }, (_, i) =>
        makePlayerCard({ id: `disc-${i}`, energyCost: i }),
      );
      const state = makeState({ playerDiscard: discard });
      const effect: CardEffect = { kind: "RecallPlayerDiscard", count: 1, policy };
      const { events } = applyEffect(catalog, state, effect);
      return events.find((e) => e.type === "PlayerDiscardRecalled");
    }

    it("random policy emits PlayerDiscardRecalled WITH randomized", () => {
      const recalled = recall("random");
      expect(recalled).toBeDefined();
      expect(recalled?.randomized).toBe(true);
    });

    for (const policy of ["latest", "lowestCost", "highestCost", "panicFirst"] as const) {
      it(`${policy} policy emits PlayerDiscardRecalled with NO randomized flag`, () => {
        const recalled = recall(policy);
        expect(recalled).toBeDefined();
        expect(recalled?.randomized).toBeUndefined();
      });
    }
  });
});
