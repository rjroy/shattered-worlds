import { describe, expect, it } from "bun:test";
import type { CardEffect } from "../../core/index";
import type { EffectLine, EffectToken, IconId, ValueEmphasis } from "../../core/view/effectGlyphs";
import { compileEffect } from "../../core/view/effectGlyphs";

// ---------------------------------------------------------------------------
// Helpers — expected-value shorthands (build literals, not compiler internals)
// ---------------------------------------------------------------------------

function i(id: IconId): EffectToken {
  return { kind: "icon", icon: id };
}

function v(text: string, emphasis?: ValueEmphasis): EffectToken {
  return emphasis === undefined ? { kind: "value", text } : { kind: "value", text, emphasis };
}

function t(text: string): EffectToken {
  return { kind: "text", text };
}

function line(tokens: EffectToken[], role?: "main" | "branch" | "rider"): EffectLine {
  return role === undefined ? { tokens } : { tokens, role };
}

// ---------------------------------------------------------------------------
// compileEffect — every kind, with riders
// ---------------------------------------------------------------------------

describe("compileEffect", () => {
  it("compiles DealProgress to an icon + emphasized value", () => {
    expect(compileEffect({ kind: "DealProgress", base: 3 })).toStrictEqual([
      line([t("+"), i("progress"), v("3", "progress")]),
    ]);
  });

  it("compiles a DealProgress keyword bonus to a rider with the keyword as plain text", () => {
    expect(
      compileEffect({ kind: "DealProgress", base: 3, bonus: { tag: "Spore", amount: 2 } }),
    ).toStrictEqual([
      line([t("+"), i("progress"), v("3", "progress")]),
      line([v("+2"), t("vs"), t("Spore")], "rider"),
    ]);
  });

  it("compiles DealProgressScaled with the scale clause as a rider", () => {
    expect(
      compileEffect({
        kind: "DealProgressScaled",
        base: 1,
        per: { kind: "KeywordInHand", keyword: "Spore" },
        amount: 1,
      }),
    ).toStrictEqual([
      line([t("+"), i("progress"), v("1", "progress")]),
      line([v("+1"), t("per"), t("Spore"), t("in hand")], "rider"),
    ]);
  });

  it('compiles DealProgressAll with an "all" marker and the same bonus rider as DealProgress', () => {
    expect(compileEffect({ kind: "DealProgressAll", base: 2 })).toStrictEqual([
      line([t("+"), i("progressAll"), v("2", "progress"), t("all")]),
    ]);
    expect(
      compileEffect({ kind: "DealProgressAll", base: 2, bonus: { tag: "Spore", amount: 2 } }),
    ).toStrictEqual([
      line([t("+"), i("progressAll"), v("2", "progress"), t("all")]),
      line([v("+2"), t("vs"), t("Spore")], "rider"),
    ]);
  });

  it("compiles all four Draw variants", () => {
    expect(compileEffect({ kind: "Draw", player: 2, world: 1 })).toStrictEqual([
      line([i("draw"), v("2"), t("·"), i("worldDraw"), v("+1")]),
    ]);
    expect(compileEffect({ kind: "Draw", player: 2 })).toStrictEqual([line([i("draw"), v("2")])]);
    expect(compileEffect({ kind: "Draw", world: 1 })).toStrictEqual([
      line([i("worldDraw"), v("+1")]),
    ]);
    expect(compileEffect({ kind: "Draw" })).toStrictEqual([line([t("draw nothing")])]);
  });

  it("compiles HP and energy changes with reward/penalty emphasis", () => {
    expect(compileEffect({ kind: "Heal", amount: 2 })).toStrictEqual([
      line([i("hp"), v("+2", "reward")]),
    ]);
    expect(compileEffect({ kind: "Damage", amount: 2 })).toStrictEqual([
      line([i("hp"), v("−2", "penalty")]),
    ]);
    expect(compileEffect({ kind: "GainEnergy", amount: 1 })).toStrictEqual([
      line([i("energy"), v("+1", "reward")]),
    ]);
  });

  it("compiles DamageScaled with the scale clause as a rider", () => {
    expect(
      compileEffect({
        kind: "DamageScaled",
        base: 1,
        per: { kind: "KeywordInHand", keyword: "Spore" },
        amount: 1,
      }),
    ).toStrictEqual([
      line([i("hp"), v("−1", "penalty")]),
      line([v("−1"), t("per"), t("Spore"), t("in hand")], "rider"),
    ]);
  });

  it("compiles ReturnWorldCards as a range or a fixed count", () => {
    expect(compileEffect({ kind: "ReturnWorldCards", min: 1, max: 2 })).toStrictEqual([
      line([i("return"), v("1–2")]),
    ]);
    expect(compileEffect({ kind: "ReturnWorldCards", min: 1, max: 1 })).toStrictEqual([
      line([i("return"), v("1")]),
    ]);
  });

  it("compiles DestroyCardInHand singular, optional, and ranged forms", () => {
    expect(compileEffect({ kind: "DestroyCardInHand", min: 1, max: 1 })).toStrictEqual([
      line([i("destroy"), v("1"), t("in hand")]),
    ]);
    expect(compileEffect({ kind: "DestroyCardInHand", min: 0, max: 1 })).toStrictEqual([
      line([i("destroy"), v("1"), t("in hand")]),
      line([t("(optional)")], "rider"),
    ]);
    expect(compileEffect({ kind: "DestroyCardInHand", min: 2, max: 4 })).toStrictEqual([
      line([i("destroy"), v("2–4"), t("in hand")]),
    ]);
  });

  it("compiles the remaining simple player effects", () => {
    expect(compileEffect({ kind: "DiscardThenDraw", player: 2 })).toStrictEqual([
      line([i("discard"), v("1"), t("→"), i("draw"), v("2")]),
    ]);
    expect(compileEffect({ kind: "ExileTopWorldCards", amount: 2 })).toStrictEqual([
      line([i("exile"), t("top"), v("2")]),
    ]);
    expect(compileEffect({ kind: "Brace", amount: 1 })).toStrictEqual([line([i("brace"), v("1")])]);
    expect(
      compileEffect({ kind: "AddCard", template: "Listen", dest: "playerDiscard" }),
    ).toStrictEqual([line([i("addCard"), t("Listen")])]);
  });

  it("compiles the hazard effect kinds", () => {
    expect(compileEffect({ kind: "GainCard", template: "Panic" })).toStrictEqual([
      line([i("addCard"), t("Panic")]),
    ]);
    expect(compileEffect({ kind: "AddPlayerCardToTop", template: "Summon Door" })).toStrictEqual([
      line([i("addCard"), t("Summon Door")]),
      line([t("top of deck")], "rider"),
    ]);
    expect(
      compileEffect({ kind: "AddWorldCardToDeck", template: "Door" }, "zombie-big-box"),
    ).toStrictEqual([line([i("addCard"), t("Door")])]);
    expect(compileEffect({ kind: "AddThreatToWorldDeck" }, "zombie-big-box")).toStrictEqual([
      line([i("addCard"), v("Zombie")]),
    ]);
    expect(compileEffect({ kind: "SurviveWorld" }, "zombie-big-box")).toStrictEqual([
      line([i("survive"), t("survive")]),
    ]);
    expect(compileEffect({ kind: "ForceDestroy", amount: 1 })).toStrictEqual([
      line([i("destroy"), t("random, next hand")]),
    ]);
    expect(compileEffect({ kind: "DestroySelf" })).toStrictEqual([line([i("vanish")])]);
  });

  it("compiles None to no lines at all", () => {
    expect(compileEffect({ kind: "None" })).toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Composites — Modal, Sequence, and nesting
// ---------------------------------------------------------------------------

describe("compileEffect (composites)", () => {
  it("compiles Modal to a Choose: header plus a branch line per branch", () => {
    const modal: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Heal", amount: 1 },
        { kind: "Draw", player: 2 },
      ],
    };
    expect(compileEffect(modal)).toStrictEqual([
      line([t("Choose:")]),
      line([i("hp"), v("+1", "reward")], "branch"),
      line([i("draw"), v("2")], "branch"),
    ]);
  });

  it('joins a 1–2 step Sequence onto one line with "→" connectives', () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        { kind: "Draw", player: 1 },
      ],
    };
    expect(compileEffect(sequence)).toStrictEqual([
      line([t("+"), i("progress"), v("1", "progress"), t("→"), i("draw"), v("1")]),
    ]);
  });

  it("keeps a step rider as a trailing rider line of the Sequence", () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 2, bonus: { tag: "Spore", amount: 2 } },
        { kind: "Draw", player: 1, world: 1 },
      ],
    };
    expect(compileEffect(sequence)).toStrictEqual([
      line([
        t("+"),
        i("progress"),
        v("2", "progress"),
        t("→"),
        i("draw"),
        v("1"),
        t("·"),
        i("worldDraw"),
        v("+1"),
      ]),
      line([v("+2"), t("vs"), t("Spore")], "rider"),
    ]);
  });

  it('splits a 3+ step Sequence into one line per step, continuation lines led by "→"', () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        { kind: "Draw", player: 1 },
        { kind: "Heal", amount: 1 },
      ],
    };
    expect(compileEffect(sequence)).toStrictEqual([
      line([t("+"), i("progress"), v("1", "progress")]),
      line([t("→"), i("draw"), v("1")]),
      line([t("→"), i("hp"), v("+1", "reward")]),
    ]);
  });

  it("keeps a rider immediately after its own step line in a split Sequence", () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 2, bonus: { tag: "Spore", amount: 2 } },
        { kind: "Draw", player: 1 },
        { kind: "Heal", amount: 1 },
      ],
    };
    expect(compileEffect(sequence)).toStrictEqual([
      line([t("+"), i("progress"), v("2", "progress")]),
      line([v("+2"), t("vs"), t("Spore")], "rider"),
      line([t("→"), i("draw"), v("1")]),
      line([t("→"), i("hp"), v("+1", "reward")]),
    ]);
  });

  it('skips None steps in a Sequence without emitting a dangling "then"', () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [{ kind: "None" }, { kind: "Heal", amount: 1 }],
    };
    expect(compileEffect(sequence)).toStrictEqual([line([i("hp"), v("+1", "reward")])]);
  });

  it("keeps a Sequence branch as a single branch line inside a Modal", () => {
    const modal: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Heal", amount: 1 },
        {
          kind: "Sequence",
          steps: [
            { kind: "DealProgress", base: 1 },
            { kind: "Draw", player: 1 },
          ],
        },
      ],
    };
    expect(compileEffect(modal)).toStrictEqual([
      line([t("Choose:")]),
      line([i("hp"), v("+1", "reward")], "branch"),
      line([t("+"), i("progress"), v("1", "progress"), t("→"), i("draw"), v("1")], "branch"),
    ]);
  });

  it("keeps a 3+ step Sequence branch as a single branch line — branches stay compact", () => {
    const modal: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Heal", amount: 1 },
        {
          kind: "Sequence",
          steps: [
            { kind: "DealProgress", base: 1 },
            { kind: "Draw", player: 1 },
            { kind: "GainEnergy", amount: 1 },
          ],
        },
      ],
    };
    expect(compileEffect(modal)).toStrictEqual([
      line([t("Choose:")]),
      line([i("hp"), v("+1", "reward")], "branch"),
      line(
        [
          t("+"),
          i("progress"),
          v("1", "progress"),
          t("→"),
          i("draw"),
          v("1"),
          t("→"),
          i("energy"),
          v("+1", "reward"),
        ],
        "branch",
      ),
    ]);
  });

  it("compiles a Modal inside a Modal at a single indent level — branch does not stack", () => {
    const nested: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Draw", player: 1 },
        {
          kind: "Modal",
          branches: [
            { kind: "Heal", amount: 1 },
            { kind: "Damage", amount: 1 },
          ],
        },
      ],
    };
    expect(compileEffect(nested)).toStrictEqual([
      line([t("Choose:")]),
      line([i("draw"), v("1")], "branch"),
      line([t("Choose:")], "branch"),
      line([i("hp"), v("+1", "reward")], "branch"),
      line([i("hp"), v("−1", "penalty")], "branch"),
    ]);
  });

  it("compiles a Modal inside a Sequence without error", () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        {
          kind: "Modal",
          branches: [
            { kind: "Heal", amount: 1 },
            { kind: "Draw", player: 1 },
          ],
        },
      ],
    };
    expect(compileEffect(sequence)).toStrictEqual([
      line([t("+"), i("progress"), v("1", "progress"), t("→"), t("Choose:")]),
      line([i("hp"), v("+1", "reward")], "branch"),
      line([i("draw"), v("1")], "branch"),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Real composite cards — shapes from the starter catalog
// ---------------------------------------------------------------------------

describe("compileEffect (catalog composites)", () => {
  it("compiles Sprint — Modal of Draw and a bonus-only DealProgress", () => {
    const sprint: CardEffect = {
      kind: "Modal",
      branches: [
        { kind: "Draw", player: 3, world: 1 },
        { kind: "DealProgress", base: 0, bonus: { tag: "Slow", amount: 3 } },
      ],
    };
    expect(compileEffect(sprint)).toStrictEqual([
      line([t("Choose:")]),
      line([i("draw"), v("3"), t("·"), i("worldDraw"), v("+1")], "branch"),
      line([t("+"), i("progress"), v("0", "progress")], "branch"),
      line([v("+3"), t("vs"), t("Slow")], "rider"),
    ]);
  });

  it("compiles Garden Center's onCleared — 4-step GainCard Sequence, one line per step", () => {
    // Verbatim from src/data/worlds/overgrown-mall.json ("The Garden Center").
    const onCleared: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "GainCard", template: "Pruning Shears" },
        { kind: "GainCard", template: "Machete" },
        { kind: "GainCard", template: "Weed Killer" },
        { kind: "GainCard", template: "Bloom" },
      ],
    };
    expect(compileEffect(onCleared)).toStrictEqual([
      line([i("addCard"), t("Pruning Shears")]),
      line([t("→"), i("addCard"), t("Machete")]),
      line([t("→"), i("addCard"), t("Weed Killer")]),
      line([t("→"), i("addCard"), t("Bloom")]),
    ]);
  });

  it("compiles Barricade — Sequence of DealProgress then ReturnWorldCards", () => {
    const barricade: CardEffect = {
      kind: "Sequence",
      steps: [
        { kind: "DealProgress", base: 1 },
        { kind: "ReturnWorldCards", min: 0, max: 1 },
      ],
    };
    expect(compileEffect(barricade)).toStrictEqual([
      line([t("+"), i("progress"), v("1", "progress"), t("→"), i("return"), v("0–1")]),
    ]);
  });
});
