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
    expect(compileEffect({ kind: "DealProgress", base: 3 }, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("3", "progress"), i("progress")]),
    ]);
  });

  it("compiles a DealProgress keyword bonus to a rider with the keyword as plain text", () => {
    expect(
      compileEffect(
        { kind: "DealProgress", base: 3, bonus: { tag: "Spore", amount: 2 } },
        "zombie-big-box",
      ),
    ).toStrictEqual([
      line([t("+"), v("3", "progress"), i("progress")]),
      line([v("+2", "progress"), t("vs"), t("Spore")], "rider"),
    ]);
  });

  it("compiles DealProgressScaled with the scale clause as a rider", () => {
    expect(
      compileEffect(
        {
          kind: "DealProgressScaled",
          base: 1,
          per: { kind: "KeywordInHand", keyword: "Spore" },
          amount: 1,
        },
        "zombie-big-box",
      ),
    ).toStrictEqual([
      line([t("+"), v("1", "progress"), i("progress")]),
      line([v("+1"), t("per"), t("Spore"), t("in hand")], "rider"),
    ]);
  });

  it('compiles DealProgressAll with an "all" marker and the same bonus rider as DealProgress', () => {
    expect(compileEffect({ kind: "DealProgressAll", base: 2 }, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("2", "progress"), t("all"), i("progressAll")]),
    ]);
    expect(
      compileEffect(
        { kind: "DealProgressAll", base: 2, bonus: { tag: "Spore", amount: 2 } },
        "zombie-big-box",
      ),
    ).toStrictEqual([
      line([t("+"), v("2", "progress"), t("all"), i("progressAll")]),
      line([v("+2", "progress"), t("vs"), t("Spore")], "rider"),
    ]);
  });

  it("compiles all four Draw variants", () => {
    expect(compileEffect({ kind: "Draw", player: 2, world: 1 }, "zombie-big-box")).toStrictEqual([
      line([i("draw"), v("2", "reward"), t("·"), i("worldDraw"), v("1", "penalty")]),
    ]);
    expect(compileEffect({ kind: "Draw", player: 2 }, "zombie-big-box")).toStrictEqual([
      line([i("draw"), v("2", "reward")]),
    ]);
    expect(compileEffect({ kind: "Draw", world: 1 }, "zombie-big-box")).toStrictEqual([
      line([i("worldDraw"), v("1", "penalty")]),
    ]);
    expect(compileEffect({ kind: "Draw" }, "zombie-big-box")).toStrictEqual([
      line([t("draw nothing")]),
    ]);
  });

  it("compiles HP and energy changes with reward/penalty emphasis", () => {
    expect(compileEffect({ kind: "Heal", amount: 2 }, "zombie-big-box")).toStrictEqual([
      line([v("+2", "reward"), i("hp")]),
    ]);
    expect(compileEffect({ kind: "Damage", amount: 2 }, "zombie-big-box")).toStrictEqual([
      line([v("−2", "penalty"), i("hp")]),
    ]);
    expect(compileEffect({ kind: "GainEnergy", amount: 1 }, "zombie-big-box")).toStrictEqual([
      line([v("+1", "reward"), i("energy")]),
    ]);
  });

  it("compiles DamageScaled with the scale clause as a rider", () => {
    expect(
      compileEffect(
        {
          kind: "DamageScaled",
          base: 1,
          per: { kind: "KeywordInHand", keyword: "Spore" },
          amount: 1,
        },
        "zombie-big-box",
      ),
    ).toStrictEqual([
      line([v("−1", "penalty"), i("hp")]),
      line([v("−1"), t("per"), t("Spore"), t("in hand")], "rider"),
    ]);
  });

  it("compiles ReturnWorldCards as a range or a fixed count", () => {
    expect(
      compileEffect({ kind: "ReturnWorldCards", min: 1, max: 2 }, "zombie-big-box"),
    ).toStrictEqual([line([i("return"), v("1–2", "reward")])]);
    expect(
      compileEffect({ kind: "ReturnWorldCards", min: 1, max: 1 }, "zombie-big-box"),
    ).toStrictEqual([line([i("return"), v("1", "reward")])]);
  });

  it("compiles DestroyCardInHand singular, optional, and ranged forms", () => {
    expect(
      compileEffect({ kind: "DestroyCardInHand", min: 1, max: 1 }, "zombie-big-box"),
    ).toStrictEqual([line([i("destroy"), v("1", "penalty"), t("in hand")])]);
    expect(
      compileEffect({ kind: "DestroyCardInHand", min: 0, max: 1 }, "zombie-big-box"),
    ).toStrictEqual([
      line([i("destroy"), v("1", "penalty"), t("in hand")]),
      line([t("(optional)")], "rider"),
    ]);
    expect(
      compileEffect({ kind: "DestroyCardInHand", min: 2, max: 4 }, "zombie-big-box"),
    ).toStrictEqual([line([i("destroy"), v("2–4", "penalty"), t("in hand")])]);
  });

  it("compiles the remaining simple player effects", () => {
    expect(compileEffect({ kind: "DiscardThenDraw", player: 2 }, "zombie-big-box")).toStrictEqual([
      line([i("discard"), v("1"), t("→"), i("draw"), v("2")]),
    ]);
    expect(
      compileEffect({ kind: "ExileTopWorldCards", amount: 2 }, "zombie-big-box"),
    ).toStrictEqual([line([i("exile"), t("top"), v("2")])]);
    expect(compileEffect({ kind: "Brace", amount: 1 }, "zombie-big-box")).toStrictEqual([
      line([v("+1", "brace"), i("brace")]),
    ]);
    expect(
      compileEffect(
        { kind: "AddCard", template: "Listen", dest: "playerDiscard" },
        "zombie-big-box",
      ),
    ).toStrictEqual([line([i("addCard"), v("Listen", "reward")])]);
  });

  it("compiles the hazard effect kinds", () => {
    expect(compileEffect({ kind: "GainCard", template: "Panic" }, "zombie-big-box")).toStrictEqual([
      line([i("addCard"), v("Panic", "reward")]),
    ]);
    expect(
      compileEffect({ kind: "AddPlayerCardToTop", template: "Summon Door" }, "zombie-big-box"),
    ).toStrictEqual([
      line([i("addCard"), v("Summon Door", "reward")]),
      line([t("top of deck")], "rider"),
    ]);
    expect(
      compileEffect({ kind: "AddWorldCardToDeck", template: "Door" }, "zombie-big-box"),
    ).toStrictEqual([line([i("addCard"), v("Door", "penalty")])]);
    expect(compileEffect({ kind: "AddThreatToWorldDeck" }, "zombie-big-box")).toStrictEqual([
      line([i("addCard"), v("Zombie", "penalty")]),
    ]);
    expect(compileEffect({ kind: "SurviveWorld" }, "zombie-big-box")).toStrictEqual([
      line([i("survive"), t("SURVIVE!")]),
    ]);
    expect(compileEffect({ kind: "ForceDestroy", amount: 1 }, "zombie-big-box")).toStrictEqual([
      line([i("destroy"), t("random, next hand")]),
    ]);
    expect(compileEffect({ kind: "DestroySelf" }, "zombie-big-box")).toStrictEqual([
      line([i("vanish")]),
    ]);
  });

  it("compiles None to no lines at all", () => {
    expect(compileEffect({ kind: "None" }, "zombie-big-box")).toStrictEqual([]);
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
    expect(compileEffect(modal, "zombie-big-box")).toStrictEqual([
      line([t("Choose:")]),
      line([v("+1", "reward"), i("hp")], "branch"),
      line([i("draw"), v("2", "reward")], "branch"),
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
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("1", "progress"), i("progress"), t("→"), i("draw"), v("1", "reward")]),
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
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([
        t("+"),
        v("2", "progress"),
        i("progress"),
        t("→"),
        i("draw"),
        v("1", "reward"),
        t("·"),
        i("worldDraw"),
        v("1", "penalty"),
      ]),
      line([v("+2", "progress"), t("vs"), t("Spore")], "rider"),
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
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("1", "progress"), i("progress")]),
      line([t("→"), i("draw"), v("1", "reward")]),
      line([t("→"), v("+1", "reward"), i("hp")]),
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
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("2", "progress"), i("progress")]),
      line([v("+2", "progress"), t("vs"), t("Spore")], "rider"),
      line([t("→"), i("draw"), v("1", "reward")]),
      line([t("→"), v("+1", "reward"), i("hp")]),
    ]);
  });

  it('skips None steps in a Sequence without emitting a dangling "then"', () => {
    const sequence: CardEffect = {
      kind: "Sequence",
      steps: [{ kind: "None" }, { kind: "Heal", amount: 1 }],
    };
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([v("+1", "reward"), i("hp")]),
    ]);
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
    expect(compileEffect(modal, "zombie-big-box")).toStrictEqual([
      line([t("Choose:")]),
      line([v("+1", "reward"), i("hp")], "branch"),
      line(
        [t("+"), v("1", "progress"), i("progress"), t("→"), i("draw"), v("1", "reward")],
        "branch",
      ),
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
    expect(compileEffect(modal, "zombie-big-box")).toStrictEqual([
      line([t("Choose:")]),
      line([v("+1", "reward"), i("hp")], "branch"),
      line(
        [
          t("+"),
          v("1", "progress"),
          i("progress"),
          t("→"),
          i("draw"),
          v("1", "reward"),
          t("→"),
          v("+1", "reward"),
          i("energy"),
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
    expect(compileEffect(nested, "zombie-big-box")).toStrictEqual([
      line([t("Choose:")]),
      line([i("draw"), v("1", "reward")], "branch"),
      line([t("Choose:")], "branch"),
      line([v("+1", "reward"), i("hp")], "branch"),
      line([v("−1", "penalty"), i("hp")], "branch"),
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
    expect(compileEffect(sequence, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("1", "progress"), i("progress"), t("→"), t("Choose:")]),
      line([v("+1", "reward"), i("hp")], "branch"),
      line([i("draw"), v("1", "reward")], "branch"),
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
    expect(compileEffect(sprint, "zombie-big-box")).toStrictEqual([
      line([t("Choose:")]),
      line([i("draw"), v("3", "reward"), t("·"), i("worldDraw"), v("1", "penalty")], "branch"),
      line([t("+"), v("0", "progress"), i("progress")], "branch"),
      line([v("+3", "progress"), t("vs"), t("Slow")], "rider"),
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
    expect(compileEffect(onCleared, "zombie-big-box")).toStrictEqual([
      line([i("addCard"), v("Pruning Shears", "reward")]),
      line([t("→"), i("addCard"), v("Machete", "reward")]),
      line([t("→"), i("addCard"), v("Weed Killer", "reward")]),
      line([t("→"), i("addCard"), v("Bloom", "reward")]),
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
    expect(compileEffect(barricade, "zombie-big-box")).toStrictEqual([
      line([t("+"), v("1", "progress"), i("progress"), t("→"), i("return"), v("0–1", "reward")]),
    ]);
  });
});
