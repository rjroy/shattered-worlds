import { describe, expect, it } from "bun:test";
import { hiddenZones, isHidden } from "../model/observability";
import { makePlayerCard, makeState, makeWorldCard } from "./testFixture";

// ---------------------------------------------------------------------------
// hiddenZones — exactly {playerDraw, worldDraw, acts[*]}, never discard or hand.
// ---------------------------------------------------------------------------

describe("hiddenZones", () => {
  it("is exactly playerDraw, worldDraw, and each act — not playerDiscard or hand", () => {
    const playerDraw = [makePlayerCard({ id: "draw" })];
    const worldDraw = [makeWorldCard({ id: "wdraw" })];
    const act0 = [makeWorldCard({ id: "act0" })];
    const act1 = [makeWorldCard({ id: "act1" })];
    const hand = [makePlayerCard({ id: "hand" })];
    const playerDiscard = [makePlayerCard({ id: "discard" })];

    const state = makeState({
      playerDraw,
      worldDraw,
      acts: [act0, act1],
      hand,
      playerDiscard,
    });

    const zones = hiddenZones(state);
    // The hidden zones are the draw piles plus every act deck, in order.
    expect(zones).toEqual([playerDraw, worldDraw, act0, act1]);

    // The visible zones never appear among the hidden collections.
    const hiddenIds = new Set(zones.flat().map((c) => c.id));
    expect(hiddenIds.has("hand")).toBe(false);
    expect(hiddenIds.has("discard")).toBe(false);
    expect(hiddenIds).toEqual(new Set(["draw", "wdraw", "act0", "act1"]));
  });
});

// ---------------------------------------------------------------------------
// isHidden — folds zone membership with in-hand concealment.
// ---------------------------------------------------------------------------

describe("isHidden", () => {
  it("is true for a concealed hand card", () => {
    const concealed = makeWorldCard({ id: "c", keywords: [{ name: "Concealed", value: 3 }] });
    // light 0 < depth 3, so the card is concealed even though it sits in hand.
    const state = makeState({ hand: [concealed], light: 0 });
    expect(isHidden(concealed, state)).toBe(true);
  });

  it("is true for a draw-pile card and an act card", () => {
    const drawCard = makePlayerCard({ id: "draw" });
    const actCard = makeWorldCard({ id: "act" });
    const state = makeState({ playerDraw: [drawCard], acts: [[actCard]] });
    expect(isHidden(drawCard, state)).toBe(true);
    expect(isHidden(actCard, state)).toBe(true);
  });

  it("is false for a non-concealed hand card and a discard card", () => {
    const handCard = makePlayerCard({ id: "hand" });
    const discardCard = makePlayerCard({ id: "discard" });
    const state = makeState({ hand: [handCard], playerDiscard: [discardCard] });
    expect(isHidden(handCard, state)).toBe(false);
    expect(isHidden(discardCard, state)).toBe(false);
  });
});
