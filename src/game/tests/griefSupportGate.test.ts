import { describe, expect, it } from "bun:test";

import { GRIEF_SUPPORT_WORLD_IDS, shouldShowGriefSupport } from "../scenes/griefSupportGate";

// REQ-W13-29.6 / REQ-W13-32: the grief-support notice is a one-time,
// trilogy-level acknowledgment covering questions/answers/the-beginning, not
// a per-world gate. WorldSelectScene's pointerdown handler is not practical
// to drive directly in this test environment (no scene test in this repo
// instantiates a Phaser scene and asserts on scene.launch/scene.start calls),
// so this exercises the SAME pure decision function the scene calls, the way
// worldSelectPaging.ts's carousel logic is tested in worldSelectCarousel.test.ts.
describe("shouldShowGriefSupport (REQ-W13-30..33)", () => {
  it("shows the notice for each of the three grief-arc worlds when unseen", () => {
    for (const worldId of GRIEF_SUPPORT_WORLD_IDS) {
      expect(shouldShowGriefSupport(worldId, false)).toBe(true);
    }
  });

  it("skips the notice for the three grief-arc worlds once seen", () => {
    for (const worldId of GRIEF_SUPPORT_WORLD_IDS) {
      expect(shouldShowGriefSupport(worldId, true)).toBe(false);
    }
  });

  it("never shows the notice for a world outside the trilogy, seen or not", () => {
    expect(shouldShowGriefSupport("zombie-big-box", false)).toBe(false);
    expect(shouldShowGriefSupport("zombie-big-box", true)).toBe(false);
  });

  it("the flag is trilogy-wide: seeing it via one of the three skips the other two", () => {
    // Simulates: player selects `questions` (unseen) -> notice shown -> flag
    // set to true -> player later selects `answers`/`the-beginning`.
    const hasSeenAfterQuestions = true;
    expect(shouldShowGriefSupport("answers", hasSeenAfterQuestions)).toBe(false);
    expect(shouldShowGriefSupport("the-beginning", hasSeenAfterQuestions)).toBe(false);
  });

  it("exposes exactly the three grief-arc world ids", () => {
    expect(GRIEF_SUPPORT_WORLD_IDS).toEqual(["questions", "answers", "the-beginning"]);
  });
});
