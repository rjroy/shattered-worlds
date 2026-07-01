import { describe, expect, test } from "bun:test";
import { createRng } from "../../core/engine/rng";
import type { RngState } from "../../core/model/types";
import type { CardCatalog, WorldData } from "../../core/model/catalog";
import type { CardTemplate } from "../../core/model/cards";
import { buildWorld } from "../../data/worldManifest";
import { DEFAULT_EVAL_WEIGHTS } from "../eval";
import { evalPolicyFactory } from "../evalPolicy";
import { playOut } from "../playOut";
import {
  formatReport,
  runCompleteness,
  type BuiltWorld,
  type CompletenessParams,
} from "../completeness";

// ---------------------------------------------------------------------------
// Broken-world detection (REQ-SCC-14, validation 7).
//
// This test proves the completeness checker DETECTS an unwinnable world. It
// hand-rolls a minimal WorldData DIRECTLY (not via buildWorld / the data-bundle
// layer) that is unwinnable AND unsurvivable, runs it through the REAL
// aggregation (`runCompleteness`) and the REAL report/flag formatting
// (`formatReport`) from completeness.ts, and asserts the world is flagged with
// HP as the dominant cause. The same threshold leaves a known-winnable world
// (zombie-big-box) UNflagged, so the flag is shown to DISCRIMINATE.
// ---------------------------------------------------------------------------

const MAX_ACTIONS = 500;

// --- Synthetic, hand-rolled unsurvivable world ----------------------------
//
// Why it cannot be WON: no effect anywhere resolves to SurviveWorld (no Door),
// so the world has no exit and `status` can never flip to "won".
//
// Why it cannot be SURVIVED: every act is full of "crusher" hazards whose
// onEndOfTurn deals heavy Damage. They cannot be cleared (cost 99 and the
// starter deals zero progress), discarded (discardable: false), or exiled
// (canExile: false), so they stay in hand and fire every turn. The opening hand
// holds startWorldCards (2) crushers; the first EndTurn fires both onEndOfTurn
// hooks and starting HP (10) cannot absorb 2 x 6 = 12 damage, so the world is
// lost to "hp" on turn 1 (act 1) before any other failure axis can bind.

const FIDGET = "broken-fidget"; // harmless player card: does nothing on play

function crusherId(act: number): string {
  return `broken-crusher-a${act}`;
}

function crusherTemplate(damage: number): CardTemplate {
  return {
    kind: "world",
    name: "crusher",
    cost: 99, // unclearable: the starter deals no progress
    keywords: [],
    discardable: false, // cannot be discarded away to dodge the end-of-turn hit
    canExile: false, // cannot be exiled out of the deck
    onDiscarded: { kind: "None" },
    onCleared: { kind: "None" }, // no SurviveWorld anywhere => unwinnable
    onEndOfTurn: { kind: "Damage", amount: damage },
    onPartialClear: { kind: "None" },
    onDraw: { kind: "None" },
  };
}

// Damage escalates per act for narrative completeness, though the agent dies in
// act 1: even act 1's two opening crushers (6 each) overrun starting HP.
const ACT_DAMAGE = [6, 10, 14];

const brokenCatalog: CardCatalog = {
  [FIDGET]: {
    kind: "player",
    name: "fidget",
    effect: { kind: "None" },
    energyCost: 0,
  },
  [crusherId(1)]: crusherTemplate(ACT_DAMAGE[0]!),
  [crusherId(2)]: crusherTemplate(ACT_DAMAGE[1]!),
  [crusherId(3)]: crusherTemplate(ACT_DAMAGE[2]!),
};

const brokenWorld: WorldData = {
  worldId: "broken-unwinnable",
  // Plenty of harmless player cards so player-card starvation is never the
  // binding loss: we want HP to be the dominant cause.
  starterDeck: [{ templateId: FIDGET, count: 12 }],
  deckComposition: {
    acts: [
      { cards: [{ templateId: crusherId(1), count: 8 }] },
      { cards: [{ templateId: crusherId(2), count: 8 }] },
      { cards: [{ templateId: crusherId(3), count: 8 }] },
    ],
  },
};

const brokenBuilt: BuiltWorld = {
  id: "broken-unwinnable",
  catalog: brokenCatalog,
  worldData: brokenWorld,
};

describe("completeness detects an unwinnable world (REQ-SCC-14)", () => {
  const N = 24;
  const K = 3;
  const AGENT_SEED = 31337;
  const THRESHOLD = 0.02;

  function params(): CompletenessParams {
    return {
      N,
      K,
      agentSeed: AGENT_SEED,
      threshold: THRESHOLD,
      weights: DEFAULT_EVAL_WEIGHTS,
      weightsOverridden: false,
    };
  }

  /** Highest-count entry's key, or undefined when the map is empty. */
  function dominantKey<T>(map: Map<T, number>): T | undefined {
    let best: [T, number] | undefined;
    for (const entry of map.entries()) {
      if (best === undefined || entry[1] > best[1]) best = entry;
    }
    return best?.[0];
  }

  test("a single broken-world play-out loses to hp in act 1 (direct playOut)", () => {
    // Item 2 of the validation: run the eval agent over the world via playOut.
    const policy = evalPolicyFactory(brokenCatalog, DEFAULT_EVAL_WEIGHTS, K);
    const agentRng: RngState = createRng(AGENT_SEED);
    const outcome = playOut(brokenCatalog, brokenWorld, 1, policy, agentRng, {
      maxActions: MAX_ACTIONS,
    });
    expect(outcome.status).toBe("lost");
    expect(outcome.lossCause).toBe("hp");
    expect(outcome.actAtLoss).toBe(0); // act 1 (0-based)
  });

  test("the broken world is near-0% and FLAGGED, dominated by hp in act 1", () => {
    // Drive the REAL aggregator with a hand-rolled BuiltWorld: runCompleteness
    // is generic over { id, catalog, worldData }, so no buildWorld is involved.
    const [agg] = runCompleteness(params(), [brokenBuilt]);
    if (agg === undefined) throw new Error("runCompleteness returned no aggregate");

    // Genuinely unwinnable: not one seed survives.
    expect(agg.wins).toBe(0);
    expect(agg.wins / agg.games).toBeLessThanOrEqual(THRESHOLD);

    // Every game is a real loss (no caps): the agent always reaches a terminal.
    expect(agg.losses).toBe(N);
    expect(agg.capped).toBe(0);

    // Heavy-damage world => HP dominates the cause, and death lands in act 1.
    expect(dominantKey(agg.lossByCause)).toBe("hp");
    expect(dominantKey(agg.lossByAct)).toBe(0);

    // Exercise the REAL report/flag path (not a replica): the formatted report
    // flags the world and surfaces hp as the dominant cause.
    const report = formatReport(params(), [agg]);
    expect(report).toContain("[FLAGGED]");
    expect(report).toContain("Dominant cause: hp");
    expect(report).toContain("Flagged worlds: 1/1");
  });

  test(
    "a known-winnable world (zombie-big-box) is NOT flagged at the same threshold",
    () => {
      const { catalog, worldData } = buildWorld("zombie-big-box");
      const built: BuiltWorld = { id: "zombie-big-box", catalog, worldData };
      const [agg] = runCompleteness(params(), [built]);
      if (agg === undefined) throw new Error("runCompleteness returned no aggregate");

      // The fixture world is winnable, so the same threshold must NOT flag it.
      expect(agg.wins).toBeGreaterThan(0);
      expect(agg.wins / agg.games).toBeGreaterThan(THRESHOLD);

      const report = formatReport(params(), [agg]);
      expect(report).not.toContain("[FLAGGED]");
      expect(report).toContain("Flagged worlds: 0/1");
    },
    { timeout: 30000 },
  );
});
