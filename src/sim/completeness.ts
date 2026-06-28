/**
 * Completeness runner: per-world survivability under the honest eval agent.
 *
 * For every registered world it builds the world (default starter, no unlocks),
 * runs N seeds under the eval-driven policy, and reports survival statistics:
 * win-rate, average turns survived, and the distribution of losses by cause and
 * by act. Worlds the agent essentially cannot survive (win-rate <= threshold)
 * are FLAGGED, with the dominant loss cause/act surfaced so the flag points at
 * the knob to turn.
 *
 * Honesty and reproducibility (REQ-SCC-16): the whole run is ONE continuous
 * agent rng stream. A single agentRng is seeded from the agent seed and threaded
 * forward across every seed AND every world via `Outcome.finalAgentRng`. The
 * report is pure, seed-derived text: NO timestamps, elapsed times, or other
 * system-derived values appear in the output.
 *
 * Sample, not proof (REQ-SCC-15): a win-rate is a sample under one agent at one
 * skill level, not a proof of (un)solvability. A near-0% flag means "this agent
 * could not survive it", to be confirmed by a future clairvoyant check.
 *
 * No card-name literals; no Phaser/renderer imports (sim boundary).
 */
import { createRng } from "../core/engine/rng";
import type { RngState, WorldLostCause } from "../core/model/types";
import type { CardCatalog, WorldData } from "../core/model/catalog";
import { buildWorld } from "../data/worldManifest";
import { worldDataRegistry } from "../data/worlds/registry";
import { DEFAULT_EVAL_WEIGHTS, type EvalWeights } from "./eval";
import { evalPolicyFactory } from "./evalPolicy";
import { playOut } from "./playOut";

const MAX_ACTIONS_PER_WORLD = 500;

// ---------------------------------------------------------------------------
// Parameters
//
// Each parameter resolves in this order: positional argv, then env var, then a
// documented default. Targets for a full audit are N=100, K=5 (REQ-SCC-18);
// both tune down for a quick run (e.g. `bun run sim:complete 3 2`).
//
//   argv[2] / SIM_N         seeds per world           default 100
//   argv[3] / SIM_K         determinizations/candidate default 5
//   argv[4] / SIM_SEED      agent rng seed            default 12345
//   argv[5] / SIM_THRESHOLD flag win-rate <= this     default 0.02 (2%)
//   SIM_WEIGHTS (env only)  JSON object merged onto DEFAULT_EVAL_WEIGHTS
// ---------------------------------------------------------------------------

export interface CompletenessParams {
  N: number;
  K: number;
  agentSeed: number;
  threshold: number;
  weights: EvalWeights;
  weightsOverridden: boolean;
}

function resolveInt(argv: string | undefined, env: string | undefined, fallback: number): number {
  const raw = argv ?? env;
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveFloat(argv: string | undefined, env: string | undefined, fallback: number): number {
  const raw = argv ?? env;
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseParams(): CompletenessParams {
  const env = process.env;
  const weightsRaw = env.SIM_WEIGHTS;
  let weights = DEFAULT_EVAL_WEIGHTS;
  let weightsOverridden = false;
  if (weightsRaw !== undefined && weightsRaw.trim() !== "") {
    // Merge the JSON override onto the defaults so a partial object only changes
    // the named knobs. A malformed override is a hard error, not a silent reset.
    const parsed = JSON.parse(weightsRaw) as Partial<EvalWeights>;
    weights = { ...DEFAULT_EVAL_WEIGHTS, ...parsed };
    weightsOverridden = true;
  }
  return {
    N: resolveInt(process.argv[2], env.SIM_N, 100),
    K: resolveInt(process.argv[3], env.SIM_K, 5),
    agentSeed: resolveInt(process.argv[4], env.SIM_SEED, 12345),
    threshold: resolveFloat(process.argv[5], env.SIM_THRESHOLD, 0.02),
    weights,
    weightsOverridden,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
//
// Each finished play-out increments exactly one disposition bucket, and a loss
// additionally increments exactly one cause bucket and one act bucket. This is
// what guarantees the attribution invariants: wins + losses + capped == games,
// sum(lossByCause) == losses, and sum(lossByAct) == losses.
// ---------------------------------------------------------------------------

const UNKNOWN_ACT = -1; // bucket key for a loss with no recorded act index

export interface WorldAggregate {
  id: string;
  totalActs: number;
  games: number;
  wins: number;
  losses: number;
  capped: number;
  totalTurns: number;
  lossByCause: Map<string, number>;
  lossByAct: Map<number, number>;
}

function newAggregate(id: string, totalActs: number): WorldAggregate {
  return {
    id,
    totalActs,
    games: 0,
    wins: 0,
    losses: 0,
    capped: 0,
    totalTurns: 0,
    lossByCause: new Map(),
    lossByAct: new Map(),
  };
}

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** A loss with no cause attached buckets as "unknown" so totals still reconcile. */
function causeKey(cause: WorldLostCause | undefined): string {
  return cause ?? "unknown";
}

// ---------------------------------------------------------------------------
// Build-and-run
// ---------------------------------------------------------------------------

export interface BuiltWorld {
  id: string;
  catalog: CardCatalog;
  worldData: WorldData;
}

/**
 * Smoke check (plan risk: all-9 build coverage): build every registered world
 * with the default starter up front. A world that lacks a starter or deck fails
 * LOUDLY here, naming the world, rather than crashing mid-report.
 */
export function buildAllWorlds(): BuiltWorld[] {
  const built: BuiltWorld[] = [];
  for (const bundle of worldDataRegistry) {
    try {
      const { catalog, worldData } = buildWorld(bundle.id);
      built.push({ id: bundle.id, catalog, worldData });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Completeness smoke check FAILED for world "${bundle.id}" with the default starter: ${msg}`,
        { cause: err },
      );
    }
  }
  return built;
}

/**
 * Run all worlds and return their aggregates, threading one continuous agent rng
 * stream across every seed and every world. The rng entering each play-out is
 * the rng leaving the previous one (REQ-SCC-16).
 */
export function runCompleteness(params: CompletenessParams, worlds: BuiltWorld[]): WorldAggregate[] {
  let agentRng: RngState = createRng(params.agentSeed);
  const aggregates: WorldAggregate[] = [];

  for (const world of worlds) {
    const policy = evalPolicyFactory(world.catalog, params.weights, params.K);
    const agg = newAggregate(world.id, world.worldData.deckComposition.acts.length);

    for (let seed = 1; seed <= params.N; seed++) {
      const outcome = playOut(world.catalog, world.worldData, seed, policy, agentRng, {
        maxActions: MAX_ACTIONS_PER_WORLD,
      });
      agentRng = outcome.finalAgentRng;

      agg.games++;
      agg.totalTurns += outcome.turns;
      if (outcome.status === "won") {
        agg.wins++;
      } else if (outcome.status === "lost") {
        agg.losses++;
        bump(agg.lossByCause, causeKey(outcome.lossCause));
        bump(agg.lossByAct, outcome.actAtLoss ?? UNKNOWN_ACT);
      } else {
        agg.capped++;
      }
    }

    aggregates.push(agg);
  }

  return aggregates;
}

// ---------------------------------------------------------------------------
// Report formatting (seed-derived text only)
// ---------------------------------------------------------------------------

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function actLabel(actIndex: number, totalActs: number): string {
  if (actIndex === UNKNOWN_ACT) return "unknown";
  return `act ${actIndex + 1}/${totalActs}`;
}

/** Format a count map as "k=v, k=v", sorted for deterministic output. */
function formatCauseMap(map: Map<string, number>): string {
  if (map.size === 0) return "(none)";
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cause, count]) => `${cause}=${count}`)
    .join(", ");
}

function formatActMap(map: Map<number, number>, totalActs: number): string {
  if (map.size === 0) return "(none)";
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([act, count]) => `${actLabel(act, totalActs)}=${count}`)
    .join(", ");
}

/** The dominant (highest-count) entry of a map, or undefined when empty. */
function dominant<K>(map: Map<K, number>): [K, number] | undefined {
  let best: [K, number] | undefined;
  for (const entry of map.entries()) {
    if (best === undefined || entry[1] > best[1]) best = entry;
  }
  return best;
}

const CAVEAT_LINES = [
  "    Caveat: a win-rate is a SAMPLE under ONE agent at ONE skill level, not a",
  '    proof of (un)solvability. A near-0% flag means "this agent could not',
  '    survive it", to be confirmed by a future clairvoyant check.',
];

function formatWorldBlock(agg: WorldAggregate, threshold: number): string {
  const lines: string[] = [];
  const winRate = agg.games > 0 ? agg.wins / agg.games : 0;
  lines.push(`World: ${agg.id}  (${agg.totalActs} acts)`);
  lines.push(`  Games:   ${agg.games}`);
  lines.push(`  Wins:    ${agg.wins}  (${pct(agg.wins, agg.games)})`);
  lines.push(`  Losses:  ${agg.losses}`);
  lines.push(`  Capped:  ${agg.capped}`);
  lines.push(`  Avg turns survived: ${(agg.games > 0 ? agg.totalTurns / agg.games : 0).toFixed(1)}`);
  lines.push(`  Loss by cause: ${formatCauseMap(agg.lossByCause)}`);
  lines.push(`  Loss by act:   ${formatActMap(agg.lossByAct, agg.totalActs)}`);

  if (winRate <= threshold) {
    lines.push(`  [FLAGGED] win-rate ${pct(agg.wins, agg.games)} <= ${(threshold * 100).toFixed(1)}%`);
    const domCause = dominant(agg.lossByCause);
    const domAct = dominant(agg.lossByAct);
    if (domCause !== undefined) {
      lines.push(`    Dominant cause: ${domCause[0]} (${domCause[1]}/${agg.losses} losses)`);
    }
    if (domAct !== undefined) {
      lines.push(
        `    Dominant act:   ${actLabel(domAct[0], agg.totalActs)} (${domAct[1]}/${agg.losses} losses)`,
      );
    }
    lines.push(...CAVEAT_LINES);
  }

  return lines.join("\n");
}

export function formatReport(params: CompletenessParams, aggregates: WorldAggregate[]): string {
  const blocks: string[] = [];
  blocks.push("Completeness report");
  blocks.push(
    `  N=${params.N}  K=${params.K}  agentSeed=${params.agentSeed}  threshold=${(params.threshold * 100).toFixed(1)}%`,
  );
  blocks.push(`  Eval weights: ${params.weightsOverridden ? "custom (SIM_WEIGHTS)" : "default"}`);
  blocks.push("");
  for (const agg of aggregates) {
    blocks.push(formatWorldBlock(agg, params.threshold));
    blocks.push("");
  }
  const flagged = aggregates.filter((a) => (a.games > 0 ? a.wins / a.games : 0) <= params.threshold);
  blocks.push(`Flagged worlds: ${flagged.length}/${aggregates.length}`);
  return blocks.join("\n");
}

// ---------------------------------------------------------------------------
// Entry
//
// Guarded by `import.meta.main` so importing this module (e.g. from a test that
// drives the real aggregator) does NOT trigger a full audit or write to stdout.
// `bun run sim:complete` runs the file directly, where `import.meta.main` is true.
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const params = parseParams();
  const worlds = buildAllWorlds();
  const aggregates = runCompleteness(params, worlds);
  console.log(formatReport(params, aggregates));
}
