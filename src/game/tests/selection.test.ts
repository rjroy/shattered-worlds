import { describe, expect, it } from "bun:test";
import {
  activeStep,
  advance,
  autoAdvances,
  beginTargeting,
  buildAction,
  cancel,
  chooseModal,
  hintForSelection,
  isComplete,
  needsConfirm,
  stepSatisfied,
  togglePick,
} from "../interaction/selection";
import type { TargetSpec } from "../../core/index";

// ---------------------------------------------------------------------------
// Barricade walk — compound [hazard, returnWorld(0,1)]
// ---------------------------------------------------------------------------

describe("Barricade walk (hazard + returnWorld)", () => {
  const spec: TargetSpec = {
    kind: "compound",
    steps: [{ kind: "hazard" }, { kind: "returnWorld", min: 0, max: 1 }],
  };

  it("beginTargeting sets up two steps at stepIdx=0", () => {
    const sel = beginTargeting("p1", spec);
    expect(sel.phase).toBe("targeting");
    if (sel.phase !== "targeting") return;
    expect(sel.stepIdx).toBe(0);
    expect(sel.steps).toHaveLength(2);
    expect(sel.steps[0]).toEqual({ kind: "hazard" });
    expect(sel.steps[1]).toEqual({ kind: "returnWorld", min: 0, max: 1 });
    expect(sel.done).toHaveLength(0);
    expect(sel.current).toHaveLength(0);
  });

  it("togglePick adds hazard target", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.current).toEqual(["w1"]);
  });

  it("autoAdvances true after single hazard pick", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    expect(autoAdvances(sel)).toBe(true);
  });

  it("advance after hazard pick moves to returnWorld step", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.done).toHaveLength(1);
    expect(sel.done[0]).toEqual({ kind: "hazard", targetId: "w1" });
    expect(sel.stepIdx).toBe(1);
    expect(sel.current).toHaveLength(0);
  });

  it("returnWorld step needsConfirm true (0 !== 1)", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    expect(needsConfirm(sel)).toBe(true);
  });

  it("returnWorld step stepSatisfied true even at 0 picks (min=0)", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    expect(stepSatisfied(sel)).toBe(true);
  });

  it("confirm with 0 picks produces returnIds=[] and completes", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    // No picks for returnWorld — advance with empty current
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.done[1]).toEqual({ kind: "returnWorld", returnIds: [] });
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      targetId: "w1",
      returnIds: [],
    });
  });

  it("confirm with 1 pick produces returnIds=[w2] and completes", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    sel = togglePick(sel, "w2");
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      targetId: "w1",
      returnIds: ["w2"],
    });
  });
});

// ---------------------------------------------------------------------------
// Cut It Loose walk — compound [destroyHand(1,1), hazard]
// This is THE test that fails against the old machine.
// ---------------------------------------------------------------------------

describe("Cut It Loose walk (destroyHand(1,1) + hazard)", () => {
  const spec: TargetSpec = {
    kind: "compound",
    steps: [{ kind: "destroyHand", min: 1, max: 1 }, { kind: "hazard" }],
  };

  it("beginTargeting starts at stepIdx=0", () => {
    const sel = beginTargeting("p1", spec);
    expect(sel.phase).toBe("targeting");
    if (sel.phase !== "targeting") return;
    expect(sel.stepIdx).toBe(0);
  });

  it("destroyHand(1,1) needsConfirm false (min===max)", () => {
    const sel = beginTargeting("p1", spec);
    expect(needsConfirm(sel)).toBe(false);
  });

  it("autoAdvances false before any pick", () => {
    const sel = beginTargeting("p1", spec);
    expect(autoAdvances(sel)).toBe(false);
  });

  it("togglePick adds hand card", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.current).toEqual(["p2"]);
  });

  it("autoAdvances true after single destroyHand pick", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    expect(autoAdvances(sel)).toBe(true);
  });

  it("advance after destroyHand pick moves to hazard step", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    sel = advance(sel);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.done[0]).toEqual({ kind: "destroyHand", destroyIds: ["p2"] });
    expect(sel.stepIdx).toBe(1);
    expect(sel.current).toHaveLength(0);
  });

  it("togglePick for hazard, then advance completes", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    sel = advance(sel);
    sel = togglePick(sel, "w1");
    expect(autoAdvances(sel)).toBe(true);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.done[1]).toEqual({ kind: "hazard", targetId: "w1" });
  });

  it("buildAction produces correct flat action", () => {
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    sel = advance(sel);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      destroyIds: ["p2"],
      targetId: "w1",
    });
  });
});

// ---------------------------------------------------------------------------
// 'none'-step skipping
// ---------------------------------------------------------------------------

describe("'none' step skipping", () => {
  it("Panic-shape [returnWorld(1,2), none]: stepIdx=0, none not skipped as leading", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }, { kind: "none" }],
    };
    const sel = beginTargeting("p1", spec);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.stepIdx).toBe(0);
    expect(sel.steps).toHaveLength(2); // no stripping
  });

  it("Panic-shape: advance from returnWorld skips trailing none → complete", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }, { kind: "none" }],
    };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.stepIdx).toBe(2); // jumped past none to length
    expect(sel.steps).toHaveLength(2); // still not stripped
  });

  it("Panic-shape: needsConfirm true (1 < 2), stepSatisfied requires >= 1 pick", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "returnWorld", min: 1, max: 2 }, { kind: "none" }],
    };
    const sel = beginTargeting("p1", spec);
    expect(needsConfirm(sel)).toBe(true);
    expect(stepSatisfied(sel)).toBe(false);
    const selWithPick = togglePick(sel, "w1");
    expect(stepSatisfied(selWithPick)).toBe(true);
  });

  it("Adrenaline-shape [discardPlayer, none]: autoAdvance skips trailing none → complete", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "discardPlayer" }, { kind: "none" }],
    };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    expect(autoAdvances(sel)).toBe(true);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.stepIdx).toBe(2);
  });

  it("Leading-none synthetic [none, hazard]: beginTargeting skips to stepIdx=1", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "none" }, { kind: "hazard" }],
    };
    const sel = beginTargeting("p1", spec);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.stepIdx).toBe(1);
    expect(activeStep(sel)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Sprint modal
// ---------------------------------------------------------------------------

describe("Sprint modal", () => {
  const modalSpec: Extract<TargetSpec, { kind: "modal" }> = {
    kind: "modal",
    branches: [{ kind: "none" }, { kind: "hazard" }],
  };

  it("chooseModal into none branch → immediately complete", () => {
    const waiting = { phase: "awaiting-modal" as const, cardId: "p1" };
    const sel = chooseModal(waiting, 0, modalSpec);
    expect(isComplete(sel)).toBe(true);
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.choice).toBe(0);
  });

  it("chooseModal into hazard branch → targeting, activeStep === choice", () => {
    const waiting = { phase: "awaiting-modal" as const, cardId: "p1" };
    const sel = chooseModal(waiting, 1, modalSpec);
    expect(sel.phase).toBe("targeting");
    if (sel.phase !== "targeting") return;
    expect(sel.choice).toBe(1);
    expect(activeStep(sel)).toBe(1); // choice, not stepIdx
    expect(isComplete(sel)).toBe(false);
  });

  it("chooseModal is no-op when not in awaiting-modal phase", () => {
    const idleSel = { phase: "idle" as const };
    expect(chooseModal(idleSel, 0, modalSpec)).toEqual(idleSel);
  });

  it("chooseModal is no-op for undefined branch index", () => {
    const waiting = { phase: "awaiting-modal" as const, cardId: "p1" };
    expect(chooseModal(waiting, 99, modalSpec)).toEqual(waiting);
  });

  it("chooseModal hazard branch walks through to action with choice + targetId", () => {
    const waiting = { phase: "awaiting-modal" as const, cardId: "p1" };
    let sel = chooseModal(waiting, 1, modalSpec);
    sel = togglePick(sel, "w1");
    expect(autoAdvances(sel)).toBe(true);
    sel = advance(sel);
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      choice: 1,
      targetId: "w1",
    });
  });
});

// ---------------------------------------------------------------------------
// Other shard-plan sequence shapes
// ---------------------------------------------------------------------------

describe("single-target sequence shapes with trailing none", () => {
  it("Shotgun-shape [hazard, none] auto-advances through none to action", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "hazard" }, { kind: "none" }],
    };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    expect(autoAdvances(sel)).toBe(true);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      targetId: "w1",
    });
  });

  it("Ditch-Gear-shape [destroyHand(1,1), none] auto-advances through none to action", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "destroyHand", min: 1, max: 1 }, { kind: "none" }],
    };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    expect(autoAdvances(sel)).toBe(true);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    expect(buildAction(sel)).toEqual({
      type: "PlayCard",
      cardId: "p1",
      destroyIds: ["p2"],
    });
  });
});

// ---------------------------------------------------------------------------
// needsConfirm boundaries
// ---------------------------------------------------------------------------

describe("needsConfirm boundaries", () => {
  it("destroyHand(1,1): needsConfirm false", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 1, max: 1 };
    const sel = beginTargeting("p1", spec);
    expect(needsConfirm(sel)).toBe(false);
  });

  it("destroyHand(1,1): autoAdvances true at one pick", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 1, max: 1 };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    expect(autoAdvances(sel)).toBe(true);
  });

  it("destroyHand(0,2): needsConfirm true", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 0, max: 2 };
    const sel = beginTargeting("p1", spec);
    expect(needsConfirm(sel)).toBe(true);
  });

  it("destroyHand(0,2): stepSatisfied true at 0 picks (min=0)", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 0, max: 2 };
    const sel = beginTargeting("p1", spec);
    expect(stepSatisfied(sel)).toBe(true);
  });

  it("destroyHand(0,2): advance with 0 picks → buildAction emits empty destroyIds", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 0, max: 2 };
    let sel = beginTargeting("p1", spec);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
    const action = buildAction(sel);
    expect(action).not.toBeNull();
    expect(action).toEqual({ type: "PlayCard", cardId: "p1", destroyIds: [] });
  });

  it("destroyHand(0,2): advance with 2 picks → destroyIds preserves both picks", () => {
    const spec: TargetSpec = { kind: "destroyHand", min: 0, max: 2 };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "p2");
    sel = togglePick(sel, "p3");
    sel = advance(sel);
    const action = buildAction(sel);
    expect(action).not.toBeNull();
    expect((action as Record<string, unknown>).destroyIds).toEqual(["p2", "p3"]);
  });
});

// ---------------------------------------------------------------------------
// activeStep and hintForSelection
// ---------------------------------------------------------------------------

describe("activeStep", () => {
  it("is 0 for idle", () => {
    expect(activeStep({ phase: "idle" })).toBe(0);
  });

  it("is 0 for awaiting-modal", () => {
    expect(activeStep({ phase: "awaiting-modal", cardId: "p1" })).toBe(0);
  });

  it("returns sel.choice for modal-entered targeting", () => {
    const waiting = { phase: "awaiting-modal" as const, cardId: "p1" };
    const modalSpec: Extract<TargetSpec, { kind: "modal" }> = {
      kind: "modal",
      branches: [{ kind: "none" }, { kind: "hazard" }],
    };
    const sel = chooseModal(waiting, 1, modalSpec);
    expect(activeStep(sel)).toBe(1);
  });

  it("returns stepIdx for non-modal targeting", () => {
    const spec: TargetSpec = {
      kind: "compound",
      steps: [{ kind: "hazard" }, { kind: "returnWorld", min: 0, max: 1 }],
    };
    let sel = beginTargeting("p1", spec);
    expect(activeStep(sel)).toBe(0);
    sel = togglePick(sel, "w1");
    sel = advance(sel);
    expect(activeStep(sel)).toBe(1);
  });
});

describe("hintForSelection", () => {
  it("idle → hidden empty hint", () => {
    expect(hintForSelection({ phase: "idle" })).toEqual({
      text: "",
      visible: false,
    });
  });

  it('awaiting-modal → "Choose an option above"', () => {
    expect(hintForSelection({ phase: "awaiting-modal", cardId: "p1" })).toEqual(
      {
        text: "Choose an option above",
        visible: true,
      },
    );
  });

  it('hazard step → "Select a Hazard target"', () => {
    const sel = beginTargeting("p1", { kind: "hazard" });
    expect(hintForSelection(sel)).toEqual({
      text: "Select a Hazard target",
      visible: true,
    });
  });

  it('discardPlayer step → "Select a player card to discard"', () => {
    const sel = beginTargeting("p1", { kind: "discardPlayer" });
    expect(hintForSelection(sel)).toEqual({
      text: "Select a player card to discard",
      visible: true,
    });
  });

  it('destroyHand with min=0 contains "(optional)"', () => {
    const sel = beginTargeting("p1", { kind: "destroyHand", min: 0, max: 1 });
    const hint = hintForSelection(sel);
    expect(hint.visible).toBe(true);
    expect(hint.text).toContain("(optional)");
  });

  it('destroyHand with min=1 does NOT contain "(optional)"', () => {
    const sel = beginTargeting("p1", { kind: "destroyHand", min: 1, max: 1 });
    const hint = hintForSelection(sel);
    expect(hint.visible).toBe(true);
    expect(hint.text).not.toContain("(optional)");
  });

  it("returnWorld reports min/max and running count", () => {
    let sel = beginTargeting("p1", { kind: "returnWorld", min: 1, max: 3 });
    sel = togglePick(sel, "w1");
    const hint = hintForSelection(sel);
    expect(hint.visible).toBe(true);
    expect(hint.text).toBe("Select 1–3 world cards to return (1 chosen)");
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("cancel", () => {
  it("returns idle from any state", () => {
    expect(cancel()).toEqual({ phase: "idle" });
  });
});

// ---------------------------------------------------------------------------
// isComplete edges
// ---------------------------------------------------------------------------

describe("isComplete edges", () => {
  it("false for idle", () => {
    expect(isComplete({ phase: "idle" })).toBe(false);
  });

  it("false for awaiting-modal", () => {
    expect(isComplete({ phase: "awaiting-modal", cardId: "p1" })).toBe(false);
  });

  it("true only when stepIdx === steps.length", () => {
    const spec: TargetSpec = { kind: "hazard" };
    let sel = beginTargeting("p1", spec);
    expect(isComplete(sel)).toBe(false);
    sel = togglePick(sel, "w1");
    expect(isComplete(sel)).toBe(false);
    sel = advance(sel);
    expect(isComplete(sel)).toBe(true);
  });

  it("none spec → immediately complete", () => {
    const sel = beginTargeting("p1", { kind: "none" });
    expect(isComplete(sel)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// togglePick edge cases
// ---------------------------------------------------------------------------

describe("togglePick", () => {
  it("toggle off removes existing pick", () => {
    let sel = beginTargeting("p1", { kind: "hazard" });
    sel = togglePick(sel, "w1");
    sel = togglePick(sel, "w1"); // toggle off
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.current).toHaveLength(0);
  });

  it("single-pick step at max replaces pick", () => {
    let sel = beginTargeting("p1", { kind: "hazard" });
    sel = togglePick(sel, "w1");
    sel = togglePick(sel, "w2"); // replace
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.current).toEqual(["w2"]);
  });

  it("multi-pick step caps at max", () => {
    const spec: TargetSpec = { kind: "returnWorld", min: 0, max: 2 };
    let sel = beginTargeting("p1", spec);
    sel = togglePick(sel, "w1");
    sel = togglePick(sel, "w2");
    sel = togglePick(sel, "w3"); // over cap — ignored
    if (sel.phase !== "targeting") throw new Error("expected targeting");
    expect(sel.current).toHaveLength(2);
    expect(sel.current).toContain("w1");
    expect(sel.current).toContain("w2");
  });

  it("no-op on non-targeting phase", () => {
    const idle = { phase: "idle" as const };
    expect(togglePick(idle, "w1")).toEqual(idle);
  });
});
