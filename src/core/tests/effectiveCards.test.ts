import { describe, expect, it } from "bun:test";
import { DEFAULT_RUN_MODIFIERS, type PlayerCardModifier } from "../../data/unlocks/types";
import {
  effectiveHand,
  effectivePlayerCard,
  effectiveWorldCardCost,
} from "../engine/effectiveCards";
import type { GameState, PlayerCard } from "../model/types";
import { makePlayerCard, makeState, makeWorldCard, mintPlayers } from "./testFixture";

function stateWithModifiers(
  playerCardModifiers: readonly PlayerCardModifier[],
  overrides: Partial<GameState> = {},
): GameState {
  return makeState({
    ...overrides,
    runModifiers: {
      ...DEFAULT_RUN_MODIFIERS,
      playerCardModifiers,
    },
  });
}

function modifier(
  id: string,
  templateId: string,
  patches: PlayerCardModifier["patches"],
  condition: PlayerCardModifier["condition"] = { kind: "always" },
): PlayerCardModifier {
  return {
    id,
    displayName: id,
    target: { kind: "template", templateId },
    condition,
    patches,
  };
}

describe("effectivePlayerCard", () => {
  it("derives a no-op copy when no modifiers match", () => {
    const card = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
      effect: { kind: "Draw", player: 1 },
      keywords: [{ name: "Spore" }],
    });
    const state = stateWithModifiers([
      modifier("explore-only", "Explore", [{ kind: "setEnergyCost", energyCost: 0 }]),
    ]);

    const effective = effectivePlayerCard(card, state);

    expect(effective).toEqual(card);
    expect(effective).not.toBe(card);
    expect(effective.keywords).not.toBe(card.keywords);
  });

  it("applies a static energy cost patch to an exact template id", () => {
    const card = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
    });
    const other = makePlayerCard({
      id: "explore",
      templateId: "Explore",
      name: "Explore",
      energyCost: 1,
    });
    const state = stateWithModifiers([
      modifier("sprint-free", "Sprint", [{ kind: "setEnergyCost", energyCost: 0 }]),
    ]);

    expect(effectivePlayerCard(card, state).energyCost).toBe(0);
    expect(effectivePlayerCard(other, state).energyCost).toBe(1);
  });

  it("appends effects with a flattened readable Sequence", () => {
    const card = makePlayerCard({
      id: "panic",
      templateId: "Panic",
      name: "Panic",
      effect: {
        kind: "Sequence",
        steps: [
          { kind: "ReturnWorldCards", min: 1, max: 4 },
          { kind: "Draw", world: 1 },
        ],
      },
    });
    const state = stateWithModifiers([
      modifier("panic-sweep", "Panic", [
        { kind: "appendEffect", effect: { kind: "DealProgressAll", base: 1 } },
      ]),
    ]);

    const effective = effectivePlayerCard(card, state);

    expect(effective.effect).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "ReturnWorldCards", min: 1, max: 4 },
        { kind: "Draw", world: 1 },
        { kind: "DealProgressAll", base: 1 },
      ],
    });
  });

  it("evaluates template and global play ordinal conditions against the next play", () => {
    const sprint = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
    });
    const explore = makePlayerCard({
      id: "explore",
      templateId: "Explore",
      name: "Explore",
      energyCost: 1,
    });
    const state = stateWithModifiers([
      modifier("first-sprint-free", "Sprint", [{ kind: "setEnergyCost", energyCost: 0 }], {
        kind: "templatePlayOrdinalThisTurn",
        ordinal: 1,
      }),
      modifier("second-card-free", "Explore", [{ kind: "setEnergyCost", energyCost: 0 }], {
        kind: "anyPlayOrdinalThisTurn",
        ordinal: 2,
      }),
    ]);

    expect(effectivePlayerCard(sprint, state).energyCost).toBe(0);
    expect(effectivePlayerCard(explore, state).energyCost).toBe(1);

    const afterOnePlay = {
      ...state,
      turnPlayHistory: {
        cardsPlayedThisTurn: 1,
        byTemplateId: { Sprint: 1 },
      },
    };

    expect(effectivePlayerCard(sprint, afterOnePlay).energyCost).toBe(1);
    expect(effectivePlayerCard(explore, afterOnePlay).energyCost).toBe(0);
  });

  it("evaluates hp, resource, and/or/not conditions", () => {
    const card = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
    });
    const state = stateWithModifiers(
      [
        modifier("desperate-braced-sprint", "Sprint", [{ kind: "setEnergyCost", energyCost: 0 }], {
          kind: "and",
          conditions: [
            { kind: "hp", comparison: "lessThanOrEqual", value: 3 },
            {
              kind: "or",
              conditions: [
                {
                  kind: "resource",
                  resource: "energy",
                  comparison: "greaterThanOrEqual",
                  value: 2,
                },
                {
                  kind: "resource",
                  resource: "brace",
                  comparison: "greaterThan",
                  value: 0,
                },
              ],
            },
            {
              kind: "not",
              condition: {
                kind: "resource",
                resource: "heat",
                comparison: "greaterThan",
                value: 0,
              },
            },
          ],
        }),
      ],
      { hp: 3, energy: 0, heat: 0, braceCharges: 1 },
    );

    expect(effectivePlayerCard(card, state).energyCost).toBe(0);
    expect(effectivePlayerCard(card, { ...state, heat: 1 }).energyCost).toBe(1);
  });

  it("applies multiple matching modifiers in deterministic order", () => {
    const card = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
      effect: { kind: "Draw", player: 1 },
    });
    const state = stateWithModifiers([
      modifier("set-to-two", "Sprint", [
        { kind: "setEnergyCost", energyCost: 2 },
        { kind: "rename", name: "Quick Step" },
      ]),
      modifier("discount-and-mark", "Sprint", [
        { kind: "addEnergyCost", amount: -5 },
        { kind: "addKeyword", keyword: { name: "Spore" } },
        { kind: "setExhaust", exhaust: true },
        { kind: "rename", name: "Free Step" },
      ]),
    ]);

    const effective = effectivePlayerCard(card, state);

    expect(effective.energyCost).toBe(0);
    expect(effective.name).toBe("Free Step");
    expect(effective.exhaust).toBe(true);
    expect(effective.keywords).toEqual([{ name: "Spore" }]);
    expect(effective.id).toBe(card.id);
    expect(effective.templateId).toBe(card.templateId);
    expect(effective.sourceWorldId).toBe(card.sourceWorldId);
  });

  it("does not mutate the base card or nested arrays", () => {
    const card = makePlayerCard({
      id: "barricade",
      templateId: "Barricade",
      name: "Barricade",
      energyCost: 1,
      effect: {
        kind: "Sequence",
        steps: [
          { kind: "DealProgress", base: 1 },
          { kind: "ReturnWorldCards", min: 0, max: 3 },
        ],
      },
      keywords: [{ name: "Spore" }],
    });
    const originalEffect = card.effect;
    const originalKeywords = card.keywords;
    const state = stateWithModifiers([
      modifier("upgrade", "Barricade", [
        { kind: "prependEffect", effect: { kind: "GainEnergy", amount: 1 } },
        { kind: "appendEffect", effect: { kind: "Brace", amount: 1 } },
        { kind: "addKeyword", keyword: { name: "Obstructed" } },
      ]),
    ]);

    const effective = effectivePlayerCard(card, state);

    expect(card.effect).toBe(originalEffect);
    expect(card.keywords).toBe(originalKeywords);
    expect(card.effect).toEqual({
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        { kind: "ReturnWorldCards", min: 0, max: 3 },
      ],
    });
    expect(card.keywords).toEqual([{ name: "Spore" }]);
    expect(effective.effect).not.toBe(card.effect);
    expect(effective.keywords).not.toBe(card.keywords);
  });

  it("derives three base Sprint cards as cost 0 before any Sprint has been played", () => {
    const s0 = makeState();
    const [cards, s1] = mintPlayers(s0, "Sprint", 3);
    const state = stateWithModifiers(
      [
        modifier("first-sprint-free", "Sprint", [{ kind: "setEnergyCost", energyCost: 0 }], {
          kind: "templatePlayOrdinalThisTurn",
          ordinal: 1,
        }),
      ],
      { ...s1, hand: cards },
    );

    const costs = cards.map((card: PlayerCard) => effectivePlayerCard(card, state).energyCost);

    expect(cards.map((card) => card.energyCost)).toEqual([1, 1, 1]);
    expect(costs).toEqual([0, 0, 0]);
  });

  it("derives effective hand cards while preserving world card bases", () => {
    const player = makePlayerCard({
      id: "sprint",
      templateId: "Sprint",
      name: "Sprint",
      energyCost: 1,
    });
    const world = makeWorldCard({ id: "hazard" });
    const state = stateWithModifiers(
      [modifier("sprint-free", "Sprint", [{ kind: "setEnergyCost", energyCost: 0 }])],
      { hand: [world, player] },
    );

    const hand = effectiveHand(state);

    expect(hand).toHaveLength(2);
    expect(hand[0]).toBe(world);
    expect(hand[1]).toEqual({ ...player, energyCost: 0, modified: true, name: "sprint-free" });
    expect(hand[1]).not.toBe(player);
  });
});

describe("effectiveWorldCardCost", () => {
  const locked = (id: string, persistent = true) =>
    makeWorldCard({
      id,
      cost: 3,
      appliedKeywords: [{ name: "Lockdown", value: 1 }],
      ...(persistent
        ? {
            persistent: {
              kind: "ClearCostPerKeyword" as const,
              keyword: "Lockdown" as const,
              costPerOther: 1,
            },
          }
        : {}),
    });

  it("adds one clear cost per other Locked card", () => {
    const cards = [locked("1"), locked("2"), locked("3")];
    expect(effectiveWorldCardCost(cards[0]!, makeState({ hand: cards.slice(0, 1) }))).toBe(3);
    expect(effectiveWorldCardCost(cards[0]!, makeState({ hand: cards.slice(0, 2) }))).toBe(4);
    expect(effectiveWorldCardCost(cards[0]!, makeState({ hand: cards }))).toBe(5);
  });

  it("returns base cost when the card lacks the condition or modifier", () => {
    const unlocked = makeWorldCard({
      id: "1",
      cost: 3,
      persistent: {
        kind: "ClearCostPerKeyword",
        keyword: "Lockdown",
        costPerOther: 1,
      },
    });
    const noModifier = locked("2", false);
    const state = makeState({ hand: [unlocked, noModifier, locked("3")] });
    expect(effectiveWorldCardCost(unlocked, state)).toBe(3);
    expect(effectiveWorldCardCost(noModifier, state)).toBe(3);
  });
});
