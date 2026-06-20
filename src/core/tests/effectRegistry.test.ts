import { describe, expect, it } from "bun:test";
import type { CardEffect } from "../index";
import { effectAtStep } from "../effects/composite";
import { connectorStyleOf, EFFECTS } from "../effects/registry";
import { makeState } from "./testFixture";

describe("connectorStyleOf", () => {
  it("maps DealProgress -> progress", () => {
    expect(connectorStyleOf({ kind: "DealProgress", base: 1 })).toBe("progress");
  });

  it("maps DestroyCardInHand -> destroy", () => {
    expect(connectorStyleOf({ kind: "DestroyCardInHand", min: 0, max: 1 })).toBe("destroy");
  });

  it("maps ReturnWorldCards -> return", () => {
    expect(connectorStyleOf({ kind: "ReturnWorldCards", min: 0, max: 2 })).toBe("return");
  });

  it("resolves through a Modal branch (Sprint hit branch)", () => {
    const sprint: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Draw", player: 2, world: 1 },
        { kind: "DealProgress", base: 1, bonus: { tag: "Slow", amount: 1 } },
      ],
    };
    expect(connectorStyleOf(sprint)).toBe("progress");
  });

  it("resolves through a Sequence step (Barricade returns world cards)", () => {
    const barricade: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        { kind: "ReturnWorldCards", min: 0, max: 2 },
      ],
    };
    expect(connectorStyleOf(barricade)).toBe("progress");
  });

  it("resolves a Sequence to return when no earlier kind matches", () => {
    const seq: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "Heal", amount: 2 },
        { kind: "ReturnWorldCards", min: 1, max: 1 },
      ],
    };
    expect(connectorStyleOf(seq)).toBe("return");
  });

  it("returns null for an effect with none of the three kinds", () => {
    expect(connectorStyleOf({ kind: "Heal", amount: 2 })).toBeNull();
    expect(connectorStyleOf({ kind: "None" })).toBeNull();
    expect(
      connectorStyleOf({
        kind: "OfferBoon",
        setId: "fortune-v1",
        setName: "fortune-v1",
        offeredCount: 3,
        chooseCount: 1,
      }),
    ).toBeNull();
    expect(
      connectorStyleOf({
        kind: "Modal",
        branches: [
          { kind: "Draw", player: 1 },
          { kind: "Heal", amount: 1 },
        ],
      }),
    ).toBeNull();
  });

  it("treats OfferBoon as hook-only, not playable from hand", () => {
    const effect: CardEffect = {
      kind: "OfferBoon",
      setId: "fortune-v1",
      setName: "fortune-v1",
      offeredCount: 3,
      chooseCount: 1,
    };
    expect(EFFECTS.OfferBoon.isPlayable(effect, makeState(), "boon-card")).toBe(false);
  });

  it("surfaces missing lazy child handlers from composites", () => {
    const mutableEffects = EFFECTS as unknown as Record<string, unknown>;
    const healHandler = mutableEffects.Heal;
    const effect: CardEffect = {
      kind: "Sequence",
      steps: [{ kind: "Heal", amount: 1 }],
    };

    try {
      delete mutableEffects.Heal;
      expect(() => EFFECTS.Sequence.describe(effect)).toThrow();
    } finally {
      mutableEffects.Heal = healHandler;
    }
  });
});

describe("effectAtStep", () => {
  const deal: CardEffect = { kind: "DealProgress", base: 1 };
  const ret: CardEffect = { kind: "ReturnWorldCards", min: 1, max: 2 };

  it("returns a single effect regardless of step", () => {
    expect(effectAtStep(deal, 0)).toEqual(deal);
    expect(effectAtStep(deal, 5)).toEqual(deal);
  });

  it("indexes Sequence steps and Modal branches by step", () => {
    const seq: CardEffect = { kind: "Sequence", steps: [deal, ret] };
    expect(effectAtStep(seq, 0)).toEqual(deal);
    expect(effectAtStep(seq, 1)).toEqual(ret);

    const modal: CardEffect = { kind: "Modal", branches: [deal, ret] };
    expect(effectAtStep(modal, 0)).toEqual(deal);
    expect(effectAtStep(modal, 1)).toEqual(ret);
  });

  it("returns null for an out-of-range step/branch", () => {
    expect(effectAtStep({ kind: "Sequence", steps: [deal] }, 3)).toBeNull();
    expect(effectAtStep({ kind: "Modal", branches: [deal] }, 3)).toBeNull();
  });
});
