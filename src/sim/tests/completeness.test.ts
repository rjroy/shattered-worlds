import { describe, expect, test } from "bun:test";
import { createRng } from "../../core/engine/rng";
import type { RngState } from "../../core/model/types";
import { buildWorld } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { DEFAULT_EVAL_WEIGHTS } from "../eval";
import { evalPolicyFactory } from "../evalPolicy";
import { randomPolicy } from "../policy";
import { playOut } from "../playOut";
import {
  buildAllWorlds,
  runCompleteness,
  type BuiltWorld,
  type CompletenessParams,
  type WorldAggregate,
} from "../completeness";

// ---------------------------------------------------------------------------
// Completeness attribution integrity (validation 2 / REQ-SCC).
//
// These tests drive the REAL aggregator (`runCompleteness` from completeness.ts)
// with small N/K, not a replica. `completeness.ts` guards its CLI entry behind
// `import.meta.main`, so importing it here neither runs the full audit nor writes
// to stdout. We exercise the exact aggregation the `bun run sim:complete` audit
// uses and assert the attribution invariants on its output.
// ---------------------------------------------------------------------------

const MAX_ACTIONS = 500;

/**
 * Build one world via the real `buildAllWorlds` smoke-check path and run the
 * real `runCompleteness` aggregator over it with the given small N/K, returning
 * that world's aggregate. Worlds beyond `worldId` are skipped so the suite stays
 * fast while still exercising the shared aggregation code.
 */
function aggregateWorld(
  worldId: string,
  N: number,
  K: number,
  agentSeed: number,
): WorldAggregate {
  const world = buildAllWorlds().find((w): w is BuiltWorld => w.id === worldId);
  if (world === undefined) throw new Error(`unknown world for test: ${worldId}`);

  const params: CompletenessParams = {
    N,
    K,
    agentSeed,
    threshold: 0.02,
    weights: DEFAULT_EVAL_WEIGHTS,
    weightsOverridden: false,
  };
  const [agg] = runCompleteness(params, [world]);
  if (agg === undefined) throw new Error("runCompleteness returned no aggregate");
  return agg;
}

function sumValues<K>(map: Map<K, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

describe("completeness attribution integrity", () => {
  // A small N keeps the suite fast while still exercising real wins/losses/caps.
  const N = 8;
  const K = 2;
  const AGENT_SEED = 4242;

  // Two worlds with very different survivability profiles, so the invariants are
  // checked against both a high-win and a near-0 (flagged) world.
  for (const worldId of ["zombie-big-box", "the-ember-orchard"]) {
    test(`${worldId}: dispositions and loss buckets reconcile`, () => {
      const agg = aggregateWorld(worldId, N, K, AGENT_SEED);

      // Every game lands in exactly one disposition bucket.
      expect(agg.wins + agg.losses + agg.capped).toBe(N);
      expect(agg.games).toBe(N);

      // Every loss carries exactly one cause and exactly one act.
      expect(sumValues(agg.lossByCause)).toBe(agg.losses);
      expect(sumValues(agg.lossByAct)).toBe(agg.losses);

      // No negative or fractional buckets leaked in.
      for (const v of agg.lossByCause.values()) expect(Number.isInteger(v) && v > 0).toBe(true);
      for (const v of agg.lossByAct.values()) expect(Number.isInteger(v) && v > 0).toBe(true);
    });
  }

  test("aggregation is reproducible for a fixed agent seed and varies by seed", () => {
    // REQ-SCC-16: the agent rng is the only randomness, so identical params must
    // yield identical aggregates, and a different agent seed must change them.
    const a = aggregateWorld("bird-building", N, K, AGENT_SEED);
    const b = aggregateWorld("bird-building", N, K, AGENT_SEED);
    expect(b.wins).toBe(a.wins);
    expect(b.losses).toBe(a.losses);
    expect(b.capped).toBe(a.capped);
    expect([...b.lossByCause.entries()].sort()).toEqual([...a.lossByCause.entries()].sort());
    expect([...b.lossByAct.entries()].sort()).toEqual([...a.lossByAct.entries()].sort());

    const c = aggregateWorld("bird-building", N, K, AGENT_SEED + 1);
    // A different agent seed should change at least one disposition tally.
    const sameTallies = c.wins === a.wins && c.losses === a.losses && c.capped === a.capped;
    expect(sameTallies).toBe(false);
  });

  test("all 9 registered worlds build and run without throwing", () => {
    // Mirrors completeness.ts's buildAllWorlds smoke check: every registered
    // world must build with the default starter and produce a terminal-or-capped
    // outcome under the eval policy.
    expect(worldDataRegistry.length).toBe(9);
    for (const bundle of worldDataRegistry) {
      const agg = aggregateWorld(bundle.id, 2, 1, 999);
      expect(agg.games).toBe(2);
      expect(agg.wins + agg.losses + agg.capped).toBe(2);
    }
  }, { timeout: 30000 });
});

// ---------------------------------------------------------------------------
// Eval-dominates-random (REQ-SCC-9, validation 3).
//
// SKIPPED per the plan's calibration decision: an untuned eval that fails to
// dominate must read as "needs tuning", not as a code bug, so this gate is not
// allowed to fail the build yet. The empirical numbers are reported separately
// (see the diagnostic in the Step-4 test report). When the eval is confirmed to
// dominate at the chosen N/K, drop `.skip` to turn this into a live gate.
//
// Measured at authoring time (zombie-big-box, N=50 same seeds, agentSeed=777,
// K=5): random 0/50 (0.0%), eval 37/50 (74.0%). Eval dominates decisively.
// ---------------------------------------------------------------------------
describe("eval dominates random (REQ-SCC-9)", () => {
  test.skip("eval win-rate > random win-rate on zombie-big-box (same seeds)", () => {
    const { catalog, worldData } = buildWorld("zombie-big-box");
    const N = 40;
    const K = 5;
    const AGENT_SEED = 777;

    const runWinRate = (policy: Parameters<typeof playOut>[3]): number => {
      let agentRng: RngState = createRng(AGENT_SEED);
      let wins = 0;
      for (let seed = 1; seed <= N; seed++) {
        const o = playOut(catalog, worldData, seed, policy, agentRng, { maxActions: MAX_ACTIONS });
        agentRng = o.finalAgentRng;
        if (o.status === "won") wins++;
      }
      return wins / N;
    };

    const randomRate = runWinRate(randomPolicy);
    const evalRate = runWinRate(evalPolicyFactory(catalog, DEFAULT_EVAL_WEIGHTS, K));
    expect(evalRate).toBeGreaterThan(randomRate);
  }, { timeout: 30000 });
});
