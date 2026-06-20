import { describe, expect, it } from "bun:test";
import {
  describeWorldCardHooks,
  CONCEALED_WORLD_HOOK_WARNING,
} from "../view/describe";
import { makeWorldCard, makeState } from "./testFixture";

describe("describeWorldCardHooks", () => {
  it("summarizes both end-of-turn and on-discard hooks for a visible discardable card", () => {
    const card = makeWorldCard({
      id: "hazard-both",
      name: "Both Hooks",
      discardable: true,
      onEndOfTurn: { kind: "Damage", amount: 2 },
      onDiscarded: { kind: "Damage", amount: 5 },
    });
    const lines = describeWorldCardHooks(card, makeState({ hand: [card], light: 0 }));

    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("End of turn:");
    expect(lines[1]).toContain("If discarded:");
    // The math/effect text comes through describeEffect, so it must be present.
    expect(lines.join(" ")).toContain("2");
    expect(lines.join(" ")).toContain("5");
  });

  it("returns only the concealment warning for a fogged card (no name or hook text)", () => {
    const card = makeWorldCard({
      id: "hazard-fog",
      name: "Secret Menace",
      keywords: [{ name: "Concealed", value: 3 }],
      onEndOfTurn: { kind: "Damage", amount: 9 },
      onDiscarded: { kind: "Damage", amount: 9 },
    });
    // Light 0 < depth 3 → concealed.
    const lines = describeWorldCardHooks(card, makeState({ hand: [card], light: 0 }));

    expect(lines).toEqual([CONCEALED_WORLD_HOOK_WARNING]);
    const joined = lines.join(" ");
    expect(joined).not.toContain("Secret Menace");
    expect(joined).not.toContain("9");
    expect(joined).not.toContain("End of turn");
  });

  it("returns an empty array when the card has no meaningful hooks", () => {
    const card = makeWorldCard({
      id: "hazard-inert",
      onEndOfTurn: { kind: "None" },
      onDiscarded: { kind: "None" },
    });
    expect(describeWorldCardHooks(card, makeState({ hand: [card], light: 0 }))).toEqual([]);
  });

  it("omits the on-discard hook when the card is not discardable", () => {
    const card = makeWorldCard({
      id: "hazard-door",
      discardable: false,
      onEndOfTurn: { kind: "None" },
      onDiscarded: { kind: "Damage", amount: 4 },
    });
    // Non-discardable → onDiscarded never surfaces, and onEndOfTurn is None.
    expect(describeWorldCardHooks(card, makeState({ hand: [card], light: 0 }))).toEqual([]);
  });
});
