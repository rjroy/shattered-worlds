import { describe, expect, it } from "bun:test";
import type { Card, PlayerCard, WorldCard } from "../../core/index";
import type { SelectionState } from "../interaction/selection";
import { classifyHighlight } from "../interaction/highlight";

function player(id: string): PlayerCard {
  return {
    kind: "player",
    id,
    name: "P",
    insetKey: undefined,
    sourceWorldId: "test",
    effect: { kind: "Draw", player: 1 },
    energyCost: 0,
    keywords: [],
  };
}

function world(id: string, discardable = false): WorldCard {
  return {
    kind: "world",
    id,
    name: "W",
    insetKey: undefined,
    cost: 1,
    keywords: [],
    discardable,
    canExile: true,
    onDiscarded: { kind: "None" },
    onCleared: { kind: "None" },
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
  };
}

const NONE = new Set<string>();
const set = (...ids: string[]): ReadonlySet<string> => new Set(ids);

function classify(
  sel: SelectionState,
  card: Card,
  opts: {
    playable?: ReadonlySet<string>;
    discardable?: ReadonlySet<string>;
    legal?: ReadonlySet<string>;
  } = {},
) {
  return classifyHighlight(
    sel,
    card,
    opts.playable ?? NONE,
    opts.discardable ?? NONE,
    opts.legal ?? NONE,
  );
}

describe("classifyHighlight", () => {
  it("marks the actively-selected card, undimmed", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "hazard" }],
      stepIdx: 0,
      done: [],
      current: [],
    };
    expect(classify(sel, player("p1"))).toEqual({
      kind: "selected",
      dim: false,
    });
  });

  it("marks a live legal target, undimmed", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "hazard" }],
      stepIdx: 0,
      done: [],
      current: [],
    };
    expect(classify(sel, world("w1"), { legal: set("w1") })).toEqual({
      kind: "target",
      dim: false,
    });
  });

  it("marks a discardable hazard only when idle", () => {
    const idle: SelectionState = { phase: "idle" };
    expect(
      classify(idle, world("w1", true), { discardable: set("w1") }),
    ).toEqual({
      kind: "discard",
      dim: false,
    });
    // During a selection, a discardable hazard that is not a target is dimmed.
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p2",
      steps: [{ kind: "hazard" }],
      stepIdx: 0,
      done: [],
      current: [],
    };
    expect(
      classify(sel, world("w1", true), { discardable: set("w1") }),
    ).toEqual({
      kind: "none",
      dim: true,
    });
  });

  it("leaves a playable player card neutral and undimmed when idle", () => {
    const idle: SelectionState = { phase: "idle" };
    expect(classify(idle, player("p1"), { playable: set("p1") })).toEqual({
      kind: "none",
      dim: false,
    });
  });

  it("dims an unplayable player card when idle", () => {
    const idle: SelectionState = { phase: "idle" };
    expect(classify(idle, player("p1"))).toEqual({ kind: "none", dim: true });
  });

  it("marks all chosen cards as 'picked' — current step and prior steps", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "hazard" }, { kind: "returnWorld", min: 1, max: 2 }],
      stepIdx: 1,
      done: [{ kind: "hazard", targetId: "w9" }],
      current: ["w2"],
    };
    expect(classify(sel, world("w2"))).toEqual({ kind: "picked", dim: false });
    expect(classify(sel, world("w9"))).toEqual({ kind: "picked", dim: false });
  });

  it("keeps a Cut It Loose destroy pick as 'picked' during the following hazard step", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "destroyHand", min: 1, max: 1 }, { kind: "hazard" }],
      stepIdx: 1,
      done: [{ kind: "destroyHand", destroyIds: ["p2"] }],
      current: [],
    };
    expect(classify(sel, player("p2"))).toEqual({ kind: "picked", dim: false });
    expect(classify(sel, world("w1"), { legal: set("w1") })).toEqual({
      kind: "target",
      dim: false,
    });
  });

  it("'picked' beats legal-target for a card already chosen in a prior step", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "hazard" }, { kind: "returnWorld", min: 1, max: 2 }],
      stepIdx: 1,
      done: [{ kind: "hazard", targetId: "w9" }],
      current: [],
    };
    // w9 was chosen in a prior step — reads as "already chosen" even if still in legalTargetIds.
    expect(classify(sel, world("w9"), { legal: set("w9") })).toEqual({
      kind: "picked",
      dim: false,
    });
  });
});

describe("classifyHighlight 'picked' kind", () => {
  it("classifies a returnWorld multi-pick current card as 'picked'", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }],
      stepIdx: 0,
      done: [],
      current: ["w1"],
    };
    expect(classify(sel, world("w1"))).toEqual({ kind: "picked", dim: false });
  });

  it("classifies a destroyHand multi-pick current card as 'picked'", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "destroyHand", min: 1, max: 3 }],
      stepIdx: 0,
      done: [],
      current: ["p2"],
    };
    expect(classify(sel, player("p2"))).toEqual({ kind: "picked", dim: false });
  });

  it("classifies a hazard current card as 'picked'", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "hazard" }],
      stepIdx: 0,
      done: [],
      current: ["w1"],
    };
    expect(classify(sel, world("w1"))).toEqual({ kind: "picked", dim: false });
  });

  it("classifies a discardPlayer current card as 'picked'", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "discardPlayer" }],
      stepIdx: 0,
      done: [],
      current: ["p2"],
    };
    expect(classify(sel, player("p2"))).toEqual({ kind: "picked", dim: false });
  });

  it("classifies a destroyHand max:1 current card as 'picked'", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "destroyHand", min: 1, max: 1 }],
      stepIdx: 0,
      done: [],
      current: ["p2"],
    };
    expect(classify(sel, player("p2"))).toEqual({ kind: "picked", dim: false });
  });

  it("classifies a single-pick step within a compound sequence as 'picked' (Barricade pattern)", () => {
    // Barricade: [DealProgress (none), ReturnWorldCards max:1]. "none" steps auto-advance
    // without appending to done, so done is empty when the returnWorld step fires.
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "none" }, { kind: "returnWorld", min: 0, max: 1 }],
      stepIdx: 1,
      done: [],
      current: ["w1"],
    };
    expect(classify(sel, world("w1"))).toEqual({ kind: "picked", dim: false });
  });

  it("acting card stays 'selected' even during a multi-pick step", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }],
      stepIdx: 0,
      done: [],
      current: [],
    };
    expect(classify(sel, player("p1"))).toEqual({ kind: "selected", dim: false });
  });

  it("'picked' beats legal-target for a card already in current (it reads as chosen, not available)", () => {
    const sel: SelectionState = {
      phase: "targeting",
      cardId: "p1",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }],
      stepIdx: 0,
      done: [],
      current: ["w1"],
    };
    // w1 is still in legalTargetIds (can be un-picked), but must read as "picked"
    // so the player sees they've already chosen it.
    expect(classify(sel, world("w1"), { legal: set("w1") })).toEqual({
      kind: "picked",
      dim: false,
    });
  });
});
