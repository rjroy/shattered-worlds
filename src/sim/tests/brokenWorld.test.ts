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
  formatHumanReport,
  runCompleteness,
  type BuiltWorld,
  type CohortAggregate,
  type CompletenessParams,
  type PerRunObservation,
  type WorldAggregate,
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

  /**
   * A minimal but internally-coherent synthetic "won" observation: invented
   * numbers (not from a real play-out), but they satisfy the same per-run
   * invariants `checkCounterInvariants`/`checkDispositionInvariants`
   * (completeness.test.ts) hold every REAL cohort to — actionCounts sums to
   * totalActions, positiveUnusedEndTurns <= actionCounts.EndTurn, and
   * totalUnusedEnergy >= positiveUnusedEndTurns.
   */
  function syntheticWinObservation(turns: number): PerRunObservation {
    return {
      disposition: "won",
      turns,
      actReached: 0,
      totalActions: 10,
      actionCounts: { PlayCard: 5, DiscardHazard: 0, EndTurn: 5, ChooseBoon: 0 },
      positiveUnusedEndTurns: 2,
      totalUnusedEnergy: 6,
      noProgressEndTurns: 0,
      posthocPressure: {
        minHp: 8,
        minPlayerSupply: 3,
        minPredictedPlayerRoom: 2,
        minRunwayRemaining: 4,
        minEnergy: 1,
      },
      // No lossCause/actAtLoss: this observation never lost.
    };
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

    // Genuinely unwinnable: not one seed survives. Checked on the baseline
    // cohort: REQ-SCC-14's flag detection is defined in terms of baseline (see
    // the spec amendment); recovery is a diagnostic-only cohort.
    expect(agg.baseline.wins).toBe(0);
    expect(agg.baseline.wins / agg.baseline.games).toBeLessThanOrEqual(THRESHOLD);

    // Every game is a real loss (no caps): the agent always reaches a terminal.
    expect(agg.baseline.losses).toBe(N);
    expect(agg.baseline.capped).toBe(0);

    // Heavy-damage world => HP dominates the cause, and death lands in act 1.
    expect(dominantKey(agg.baseline.lossByCause)).toBe("hp");
    expect(dominantKey(agg.baseline.lossByAct)).toBe(0);

    // Exercise the REAL report/flag path (not a replica): the formatted report
    // flags the world and surfaces hp as the dominant cause.
    const report = formatHumanReport(params(), [agg]);
    expect(report).toContain("[FLAGGED]");
    expect(report).toContain("Dominant cause: hp");
    expect(report).toContain("Flagged worlds: 1/1");

    // Step 5: recovery is diagnostic-only and must never carry its own flag or
    // caveat, even on a world this broken (RECOVERY_RUN_MODIFIERS cannot
    // rescue a world with no SurviveWorld exit at all). Both markers must
    // appear exactly once each, in the baseline section only.
    expect((report.match(/\[FLAGGED\]/g) ?? []).length).toBe(1);
    expect((report.match(/Caveat: a win-rate is a SAMPLE/g) ?? []).length).toBe(1);

    // Step 6: recovery's own outcome on THIS world is also 0 wins — the fixed
    // recovery unlocks (extra hp, a free/discounted push, a keyword bonus)
    // never add a SurviveWorld exit, and the crusher hazards fire every turn
    // regardless of starter/unlock configuration — so recovery cannot rescue
    // an unwinnable world it structurally has no escape from.
    expect(agg.recoveries.reduce((sum, recovery) => sum + recovery.wins, 0)).toBe(0);

    // Text-level (not just count-based) confirmation that the recovery
    // section specifically carries no [FLAGGED] marker of its own.
    const recoverySection = report.slice(report.indexOf("-- Recovery"));
    expect(recoverySection).not.toContain("[FLAGGED]");
  });

  test("Flagged worlds is wired to baseline only: a synthetic recovery win cannot rescue the flag", () => {
    // The real recovery cohort for this world also loses every game (asserted
    // above), which on its own doesn't prove independence from baseline --
    // recovery could coincidentally be flag-free just because it also failed.
    // Swap in a synthetic recovery cohort with wins comfortably above
    // threshold and confirm the "Flagged worlds" summary line and per-cohort
    // [FLAGGED] gating are unaffected: they must be wired to baseline alone,
    // never to "whatever recovery happened to do here" (spec amendment: recovery
    // is diagnostic and can never rescue or mask a baseline flag).
    const [agg] = runCompleteness(params(), [brokenBuilt]);
    if (agg === undefined) throw new Error("runCompleteness returned no aggregate");

    // Genuinely independent synthetic cohort (not a spread-and-partial-override
    // of the real all-loss recovery data): every field below is internally
    // consistent with "4 wins, 0 losses, 0 capped" on its own terms, so this
    // fixture would also survive completeness.test.ts's own counter/disposition
    // invariant checks if run against it.
    const rescuedRuns: PerRunObservation[] = [
      syntheticWinObservation(4),
      syntheticWinObservation(5),
      syntheticWinObservation(6),
      syntheticWinObservation(3),
    ];
    const rescuedRecovery: CohortAggregate = {
      games: 4,
      wins: 4,
      losses: 0,
      capped: 0,
      totalTurns: rescuedRuns.reduce((sum, run) => sum + run.turns, 0),
      runs: rescuedRuns,
      lossByCause: new Map(),
      lossByAct: new Map(),
      reachedActCounts: new Map([[0, 4]]),
      reachedActWinCounts: new Map([[0, 4]]),
    };
    const rescuedAgg: WorldAggregate = { ...agg, recoveries: [rescuedRecovery] };

    const report = formatHumanReport(params(), [rescuedAgg]);
    expect(report).toContain("Flagged worlds: 1/1");
    expect((report.match(/\[FLAGGED\]/g) ?? []).length).toBe(1);

    const recoverySection = report.slice(report.indexOf("-- Recovery"));
    expect(recoverySection).not.toContain("[FLAGGED]");
  });

  test(
    "a known-winnable world (zombie-big-box) is NOT flagged at the same threshold",
    () => {
      const { catalog, worldData } = buildWorld("zombie-big-box");
      const built: BuiltWorld = { id: "zombie-big-box", catalog, worldData };
      const [agg] = runCompleteness(params(), [built]);
      if (agg === undefined) throw new Error("runCompleteness returned no aggregate");

      // The fixture world is winnable, so the same threshold must NOT flag it.
      // Checked on the baseline cohort, per the same REQ-SCC-14 reasoning above.
      expect(agg.baseline.wins).toBeGreaterThan(0);
      expect(agg.baseline.wins / agg.baseline.games).toBeGreaterThan(THRESHOLD);

      const report = formatHumanReport(params(), [agg]);
      expect(report).not.toContain("[FLAGGED]");
      expect(report).toContain("Flagged worlds: 0/1");
    },
    { timeout: 30000 },
  );
});
