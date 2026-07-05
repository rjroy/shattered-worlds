/**
 * Completeness runner: per-world survivability under the honest eval agent.
 *
 * For every registered world it builds the world (default starter, no unlocks),
 * then for each of N seeds runs TWO fixed configurations back to back: a
 * baseline play-out (default starter, no unlocks) and a recovery play-out (the
 * same seed, with `RECOVERY_RUN_MODIFIERS` applied). This is a fixed paired
 * cohort design (see the "Implementation amendment: fixed paired recovery
 * cohort" section of the governing spec): every seed gets both configurations,
 * in the same order, every time — there is no outcome-dependent branching.
 * Baseline is the sole source of the completeness result and the `[FLAGGED]`
 * determination (REQ-SCC-10); recovery is a diagnostic-only comparison that
 * can never rescue or mask a baseline flag.
 *
 * Each world's `WorldAggregate` reports, per cohort: win-rate with a 95%
 * Wilson interval, average turns survived, median/p90 turns by disposition, a
 * progress funnel over acts, action/resource efficiency (medians and
 * opportunity-normalized rates), median per-run minimum resource pressure
 * (posthoc ground truth, never the agent's perceived view), and the
 * distribution of losses by cause and by act. Worlds whose BASELINE win-rate
 * is at or below `threshold`, or exactly 100%, are FLAGGED. Low-win-rate flags
 * surface the dominant loss cause/act and an epistemic caveat so the flag
 * points at the knob to turn; perfect-win-rate flags identify worlds that are
 * too easy. Recovery is diagnostic-only data and never carries a flag of its
 * own.
 *
 * Honesty and reproducibility (REQ-SCC-16): the whole run is ONE continuous
 * agent rng stream, spanning `(1 + R) x N` play-outs per world (R = the number
 * of recovery unlock sets). A single agentRng is seeded from the agent seed and
 * threaded forward — baseline into each recovery set in declaration order, the
 * last recovery into the next seed's baseline, and onward across worlds — via
 * `Outcome.finalAgentRng`. The report is pure, seed-derived JSON:
 * NO timestamps, elapsed times, or other system-derived values appear in the
 * output.
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
import { buildRunModifiers, UNLOCK_CATALOG } from "../data/unlocks/catalog";
import { DEFAULT_EVAL_WEIGHTS, type EvalWeights } from "./eval";
import { evalPolicyFactory } from "./evalPolicy";
import {
  playOut,
  type ActionCounts,
  type GroundTruthPressure,
  type Outcome,
  type PlayOutStatus,
} from "./playOut";
import { median, p90, wilsonInterval } from "./statistics";

const DEFAULT_MAX_ACTIONS_PER_WORLD = 300;
const RECOVERY_UNLOCK_IDS = [
  [
    "first-sprint-free", // Burst of Speed
    "second-explore-push", // Determined Explorer
    "extra-hp", // Tough Hide
    "keyword-bonus", // Sharpened Instincts
  ],
  [
    "other-sprint-free", // Run in Terror
    "panic-response", // Fight or Flight
    "keyword-bonus", // Sharpened Instincts
  ],
] as const;
/** Play-outs per seed: one baseline + one per recovery unlock set. */
const PLAY_OUTS_PER_SEED = 1 + RECOVERY_UNLOCK_IDS.length;
const RECOVERY_RUN_MODIFIERS = RECOVERY_UNLOCK_IDS.map((ids) =>
  buildRunModifiers(ids, UNLOCK_CATALOG),
);

// ---------------------------------------------------------------------------
// Parameters
//
// Each numeric parameter resolves in this order: positional argv, then env
// var, then a documented default. Targets for a full audit are N=100, K=5
// (REQ-SCC-18); both tune down for a quick run (e.g. `bun run sim:complete 3
// 2`).
//
//   argv[2] / SIM_N         seeds per world           default 100
//   argv[3] / SIM_K         determinizations/candidate default 5
//   argv[4] / SIM_SEED      agent rng seed            default 12345
//   argv[5] / SIM_THRESHOLD flag win-rate <= this     default 0.02 (2%)
//   SIM_MAX_ACTIONS (env only) action cap per play-out; a run still "playing"
//                           at the cap is classified `capped`. default 300.
//                           Lower it when stall-prone worlds make a full audit
//                           crawl; capped runs cost the full cap in decisions.
//   SIM_WEIGHTS (env only)  JSON object merged onto DEFAULT_EVAL_WEIGHTS
//
// A world id may additionally appear ANYWHERE among the positional args (or
// via SIM_WORLD) to restrict the run to that one world, e.g.
// `bun run sim:complete the-tidal-archive` or `bun run sim:complete
// the-tidal-archive 20 3`. It is pulled out before the remaining positional
// args are assigned to N/K/agentSeed/threshold in order, so its position
// doesn't shift the others.
// ---------------------------------------------------------------------------

export interface CompletenessParams {
  N: number;
  K: number;
  agentSeed: number;
  threshold: number;
  weights: EvalWeights;
  weightsOverridden: boolean;
  /** Action cap per play-out (SIM_MAX_ACTIONS); `runCompleteness` defaults it to 300. */
  maxActionsPerWorld?: number;
  /** Restrict the run to this one registered world id, or all worlds when absent. */
  worldId?: string;
  /** CLI output format. JSON is the default for machine-readable reports. */
  outputFormat?: OutputFormat;
}

export type OutputFormat = "json" | "human";

function parseOutputFormat(raw: string | undefined): OutputFormat {
  if (raw === undefined || raw === "") return "json";
  if (raw === "json" || raw === "human") return raw;
  throw new Error(`Unknown completeness output format "${raw}". Expected "json" or "human".`);
}

function resolveOutputFormat(
  argv: string[],
  env: string | undefined,
): {
  outputFormat: OutputFormat;
  positional: string[];
} {
  let cliFormat: OutputFormat | undefined;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    let requested: OutputFormat | undefined;
    if (arg === "--human") requested = "human";
    else if (arg === "--json") requested = "json";
    else if (arg === "--format") {
      const value = argv[++index];
      if (value === undefined) throw new Error('Missing value after "--format".');
      requested = parseOutputFormat(value);
    } else if (arg.startsWith("--format=")) {
      requested = parseOutputFormat(arg.slice("--format=".length));
    } else {
      positional.push(arg);
    }

    if (requested !== undefined) {
      if (cliFormat !== undefined && cliFormat !== requested) {
        throw new Error(
          `Conflicting completeness output formats: "${cliFormat}" and "${requested}".`,
        );
      }
      cliFormat = requested;
    }
  }

  return { outputFormat: cliFormat ?? parseOutputFormat(env), positional };
}

/**
 * Resolve a numeric parameter from `argv`, then `env`, then `fallback`, parsing
 * with `parse` (int vs float). An absent source or a NaN parse both fall back.
 */
function resolveNumber(
  argv: string | undefined,
  env: string | undefined,
  fallback: number,
  parse: (raw: string) => number,
): number {
  const raw = argv ?? env;
  if (raw === undefined) return fallback;
  const parsed = parse(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveInt(argv: string | undefined, env: string | undefined, fallback: number): number {
  return resolveNumber(argv, env, fallback, (raw) => parseInt(raw, 10));
}

function resolveFloat(argv: string | undefined, env: string | undefined, fallback: number): number {
  return resolveNumber(argv, env, fallback, parseFloat);
}

/**
 * Pulls a registered world id out of the positional args, wherever it
 * appears, so it doesn't shift N/K/agentSeed/threshold's positions. Falls
 * back to `SIM_WORLD` when no positional arg is present.
 *
 * Any non-numeric positional arg is assumed to be a world-id attempt and
 * validated immediately: a typo (e.g. `sim:complete the-tidel-archive`) must
 * fail loudly here, NOT fall through to `resolveInt`'s NaN-defaults-to-100
 * fallback, which would silently run a full audit across every world instead
 * of the one the caller meant to target.
 */
function resolveWorldId(positional: string[]): { worldId: string | undefined; rest: string[] } {
  const knownIds = new Set(worldDataRegistry.map((bundle) => bundle.id));
  let worldId: string | undefined;
  const rest: string[] = [];
  for (const arg of positional) {
    if (!Number.isNaN(Number(arg))) {
      rest.push(arg);
      continue;
    }
    if (worldId !== undefined) {
      throw new Error(
        `sim:complete accepts at most one world id argument; got both "${worldId}" and "${arg}".`,
      );
    }
    if (!knownIds.has(arg)) {
      const known = [...knownIds].sort().join(", ");
      throw new Error(`Unknown world id "${arg}" for sim:complete. Known worlds: ${known}`);
    }
    worldId = arg;
  }
  return { worldId: worldId ?? process.env.SIM_WORLD, rest };
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
  const { outputFormat, positional } = resolveOutputFormat(process.argv.slice(2), env.SIM_FORMAT);
  const { worldId, rest } = resolveWorldId(positional);
  return {
    N: resolveInt(rest[0], env.SIM_N, 100),
    K: resolveInt(rest[1], env.SIM_K, 5),
    agentSeed: resolveInt(rest[2], env.SIM_SEED, 12345),
    threshold: resolveFloat(rest[3], env.SIM_THRESHOLD, 0.02),
    weights,
    weightsOverridden,
    maxActionsPerWorld: resolveInt(undefined, env.SIM_MAX_ACTIONS, DEFAULT_MAX_ACTIONS_PER_WORLD),
    outputFormat,
    ...(worldId !== undefined ? { worldId } : {}),
  };
}

/**
 * Restricts `worlds` to `worldId` when given (all worlds pass through
 * unchanged otherwise). Throws with the list of valid ids on an unknown id
 * rather than silently running everything or nothing.
 */
export function selectWorlds(worlds: BuiltWorld[], worldId: string | undefined): BuiltWorld[] {
  if (worldId === undefined) return worlds;
  const selected = worlds.filter((world) => world.id === worldId);
  if (selected.length === 0) {
    const known = worlds.map((world) => world.id).join(", ");
    throw new Error(`Unknown world id "${worldId}" for sim:complete. Known worlds: ${known}`);
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Aggregation
//
// Each finished play-out increments exactly one disposition bucket, and a loss
// additionally increments exactly one cause bucket and one act bucket. This is
// what guarantees the attribution invariants: wins + losses + capped == games,
// sum(lossByCause) == losses, and sum(lossByAct) == losses.
//
// A `CohortAggregate` holds one configuration's (baseline or recovery) tallies
// AND the raw per-run observations (`runs`) that later report-formatting code
// (step 5) needs for percentiles, Wilson intervals, and the progress funnel.
// `reachedActCounts`/`reachedActWinCounts` are PER-ACT counts of games/wins
// whose `actReached` equals that exact act index — not yet the cumulative
// ">= a" funnel. Building the monotonic ">= a" sums from these is report-time
// (step 5) work; aggregation only has to make the per-act counts exhaustive.
// ---------------------------------------------------------------------------

const UNKNOWN_ACT = -1; // bucket key for a loss with no recorded act index

/** One play-out's disposition and raw telemetry, as needed by report formatting. */
export interface PerRunObservation {
  disposition: PlayOutStatus;
  turns: number;
  actReached: number;
  totalActions: number;
  actionCounts: ActionCounts;
  positiveUnusedEndTurns: number;
  totalUnusedEnergy: number;
  noProgressEndTurns: number;
  posthocPressure: GroundTruthPressure;
  lossCause?: WorldLostCause;
  actAtLoss?: number;
}

/** Tallies and raw per-run observations for one fixed configuration (baseline or recovery). */
export interface CohortAggregate {
  games: number;
  wins: number;
  losses: number;
  capped: number;
  /** Sum of `turns` across ALL runs, incl. capped (REQ-SCC-11's avg-turns metric). */
  totalTurns: number;
  /** One entry per game, in seed order: the raw data step 5 percentiles/rates over. */
  runs: PerRunObservation[];
  lossByCause: Map<string, number>;
  lossByAct: Map<number, number>;
  /** Count of games whose `actReached` equals this act index (0-based, per-act, not cumulative). */
  reachedActCounts: Map<number, number>;
  /** Count of WINS whose `actReached` equals this act index (0-based, per-act, not cumulative). */
  reachedActWinCounts: Map<number, number>;
}

export interface WorldAggregate {
  id: string;
  totalActs: number;
  /** Default starter, no unlocks. Sole source of the completeness result and `[FLAGGED]`. */
  baseline: CohortAggregate;
  /** Same seeds, `RECOVERY_RUN_MODIFIERS` applied. Diagnostic only; never flags. */
  recoveries: CohortAggregate[];
}

function newCohortAggregate(): CohortAggregate {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    capped: 0,
    totalTurns: 0,
    runs: [],
    lossByCause: new Map(),
    lossByAct: new Map(),
    reachedActCounts: new Map(),
    reachedActWinCounts: new Map(),
  };
}

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** A loss with no cause attached buckets as "unknown" so totals still reconcile. */
function causeKey(cause: WorldLostCause | undefined): string {
  return cause ?? "unknown";
}

/**
 * Fold one play-out's `Outcome` into its cohort: append the raw observation,
 * bump the disposition bucket, and (for losses) bump the cause/act maps. Every
 * game bumps `reachedActCounts` exactly once, and every win also bumps
 * `reachedActWinCounts` exactly once, which is what keeps the "act reach is
 * monotonic" and "every win is captured" invariants true by construction.
 */
function recordOutcome(cohort: CohortAggregate, outcome: Outcome): void {
  cohort.games++;
  cohort.totalTurns += outcome.turns;

  cohort.runs.push({
    disposition: outcome.status,
    turns: outcome.turns,
    actReached: outcome.actReached,
    totalActions: outcome.totalActions,
    actionCounts: outcome.actionCounts,
    positiveUnusedEndTurns: outcome.positiveUnusedEndTurns,
    totalUnusedEnergy: outcome.totalUnusedEnergy,
    noProgressEndTurns: outcome.noProgressEndTurns,
    posthocPressure: outcome.posthocPressure,
    ...(outcome.lossCause !== undefined ? { lossCause: outcome.lossCause } : {}),
    ...(outcome.actAtLoss !== undefined ? { actAtLoss: outcome.actAtLoss } : {}),
  });

  bump(cohort.reachedActCounts, outcome.actReached);

  if (outcome.status === "won") {
    cohort.wins++;
    bump(cohort.reachedActWinCounts, outcome.actReached);
  } else if (outcome.status === "lost") {
    cohort.losses++;
    bump(cohort.lossByCause, causeKey(outcome.lossCause));
    bump(cohort.lossByAct, outcome.actAtLoss ?? UNKNOWN_ACT);
  } else {
    cohort.capped++;
  }
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
 * stream across every seed AND every play-out (baseline, then each recovery
 * unlock set in declaration order, for every seed) AND every world. The rng
 * entering each play-out is the rng leaving the previous one (REQ-SCC-16). This
 * is a fixed paired cohort: every configuration always runs, in the same order,
 * for every seed — there is no outcome-dependent branching (see the spec
 * amendment).
 */
export function runCompleteness(
  params: CompletenessParams,
  worlds: BuiltWorld[],
): WorldAggregate[] {
  let agentRng: RngState = createRng(params.agentSeed);
  const maxActions = params.maxActionsPerWorld ?? DEFAULT_MAX_ACTIONS_PER_WORLD;
  const aggregates: WorldAggregate[] = [];

  for (const world of worlds) {
    const policy = evalPolicyFactory(world.catalog, params.weights, params.K);
    const baseline = newCohortAggregate();
    // Pair each recovery unlock set's modifiers with its own cohort up front,
    // so the play-out loop never has to index two parallel arrays.
    const recoveryRuns = RECOVERY_RUN_MODIFIERS.map((modifiers) => ({
      modifiers,
      cohort: newCohortAggregate(),
    }));

    for (let seed = 1; seed <= params.N; seed++) {
      const baselineOutcome = playOut(world.catalog, world.worldData, seed, policy, agentRng, {
        maxActions,
        weights: params.weights,
      });
      agentRng = baselineOutcome.finalAgentRng;
      recordOutcome(baseline, baselineOutcome);

      for (const { modifiers, cohort } of recoveryRuns) {
        const outcome = playOut(world.catalog, world.worldData, seed, policy, agentRng, {
          maxActions,
          runModifiers: modifiers,
          weights: params.weights,
        });
        agentRng = outcome.finalAgentRng;
        recordOutcome(cohort, outcome);
      }
    }

    aggregates.push({
      id: world.id,
      totalActs: world.worldData.deckComposition.acts.length,
      baseline,
      recoveries: recoveryRuns.map((run) => run.cohort),
    });
  }

  return aggregates;
}

// ---------------------------------------------------------------------------
// Report formatting (seed-derived text only)
//
// Each world block reports the baseline cohort, then the recovery cohort, in
// that fixed order (see the plan's "Report shape" section). Both cohorts get
// the same disposition/funnel/efficiency/pressure/loss-attribution sections;
// only the recovery cohort adds the descriptive win-rate-difference line, and
// only the BASELINE cohort can carry `[FLAGGED]`, the dominant cause/act, and
// the epistemic caveat — recovery is diagnostic-only and must never rescue or
// mask a baseline flag (REQ-SCC-10, preserved unchanged: the flag still
// compares the raw point estimate `wins/games <= threshold`; the Wilson
// interval is a DISPLAY-ONLY uncertainty band beside it).
// ---------------------------------------------------------------------------

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Like `pct`, but a zero denominator is an empty bucket, not a real 0%. */
function pctOrNone(numerator: number, denominator: number): string {
  if (denominator === 0) return "(none)";
  return pct(numerator, denominator);
}

/** Renders a possibly-absent statistic (e.g. median of an empty bucket). */
function fmtOrNone(value: number | undefined, digits = 1): string {
  return value === undefined ? "(none)" : value.toFixed(digits);
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

/**
 * Point-estimate win-rate for the `[FLAGGED]` threshold check (REQ-SCC-10),
 * `0` when the cohort has no games. The per-world flag and the summary count
 * both go through this so their FLAGGED determination cannot drift apart. This
 * is the raw point estimate; the Wilson interval is a display-only band beside it.
 */
function winRateOf(cohort: CohortAggregate): number {
  return cohort.games > 0 ? cohort.wins / cohort.games : 0;
}

/** Baselines that are effectively unwinnable or perfectly won are both incomplete. */
function isFlagged(cohort: CohortAggregate, threshold: number): boolean {
  const winRate = winRateOf(cohort);
  return winRate <= threshold || (cohort.games > 0 && winRate === 1);
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

/** Deterministic display order for `ActionCounts`, independent of object key order. */
const ACTION_KIND_ORDER: (keyof ActionCounts)[] = [
  "PlayCard",
  "DiscardHazard",
  "EndTurn",
  "ChooseBoon",
];

/** Deterministic display order and labels for `GroundTruthPressure`'s five axes. */
const PRESSURE_AXES: { key: keyof GroundTruthPressure; label: string }[] = [
  { key: "minHp", label: "HP" },
  { key: "minPlayerSupply", label: "player supply" },
  { key: "minPredictedPlayerRoom", label: "predicted refill room" },
  { key: "minRunwayRemaining", label: "runway" },
  { key: "minEnergy", label: "energy" },
];

/** `runs` filtered to one disposition, projected to `turns` (bullet 1). */
function turnsFor(runs: PerRunObservation[], disposition: PlayOutStatus): number[] {
  return runs.filter((r) => r.disposition === disposition).map((r) => r.turns);
}

/**
 * Bullet 1 (and the shared half of bullet 2): games, wins with a 95% Wilson
 * interval beside the point estimate, losses, capped, average turns survived
 * across every disposition (REQ-SCC-11's existing metric, unchanged), and
 * median/p90 turns split by win/loss disposition. Capped runs are excluded
 * from the win/loss turn split — there is no "capped" bucket in that split, by
 * the plan's own wording — and an empty bucket (e.g. zero losses) renders
 * `(none)` rather than a fabricated number.
 */
function formatDistributionLines(cohort: CohortAggregate): string[] {
  const wilson = wilsonInterval(cohort.wins, cohort.games);
  const wilsonText =
    wilson === undefined
      ? "(none)"
      : `[${(wilson.lower * 100).toFixed(1)}%, ${(wilson.upper * 100).toFixed(1)}%]`;
  const wonTurns = turnsFor(cohort.runs, "won");
  const lostTurns = turnsFor(cohort.runs, "lost");
  const avgTurns = cohort.games > 0 ? cohort.totalTurns / cohort.games : undefined;

  return [
    `  Games:   ${cohort.games}`,
    `  Wins:    ${cohort.wins}  (${pctOrNone(cohort.wins, cohort.games)})  95% Wilson: ${wilsonText}`,
    `  Losses:  ${cohort.losses}`,
    `  Capped:  ${cohort.capped}`,
    `  Avg turns survived (all dispositions): ${fmtOrNone(avgTurns)}`,
    `  Turns survived (won):  median=${fmtOrNone(median(wonTurns))} p90=${fmtOrNone(p90(wonTurns))}`,
    `  Turns survived (lost): median=${fmtOrNone(median(lostTurns))} p90=${fmtOrNone(p90(lostTurns))}`,
  ];
}

/**
 * Bullet 2's other half: the recovery-minus-baseline win-rate difference, in
 * percentage points. Explicitly labeled descriptive, not causal — only the
 * world seed is paired between cohorts; the continuous agent rng stream is
 * not. Renders `(none)` rather than `NaN` when either cohort has zero games.
 */
function formatWinRateDiffLine(baseline: CohortAggregate, recovery: CohortAggregate): string {
  if (baseline.games === 0 || recovery.games === 0) {
    return "  Win-rate diff vs baseline (descriptive, not causal): (none)";
  }
  const diffPct = (recovery.wins / recovery.games - baseline.wins / baseline.games) * 100;
  const sign = diffPct >= 0 ? "+" : "";
  return `  Win-rate diff vs baseline (descriptive, not causal): ${sign}${diffPct.toFixed(1)} pp`;
}

/** Sum of `map`'s values at keys `>= act` — the monotonic ">= a" funnel sum. */
function reachedAtOrAbove(map: Map<number, number>, act: number): number {
  let total = 0;
  for (const [key, count] of map.entries()) {
    if (key >= act) total += count;
  }
  return total;
}

/**
 * Bullet 3: for each act (0-based internally, 1-based to the reader via
 * `actLabel`), the count and percentage of ALL games reaching that act or
 * later (wins, losses, and caps all participate in the reach denominator —
 * that is why this sums `reachedActCounts`, not just `reachedActWinCounts`),
 * plus the conditional conversion `wins that reached >= act / games that
 * reached >= act`. An unreached act renders `(none)` conversion.
 */
function formatFunnelLines(cohort: CohortAggregate, totalActs: number): string[] {
  const lines = ["  Progress funnel:"];
  for (let act = 0; act < totalActs; act++) {
    const reached = reachedAtOrAbove(cohort.reachedActCounts, act);
    const reachedWins = reachedAtOrAbove(cohort.reachedActWinCounts, act);
    const conversion = reached === 0 ? "(none)" : pct(reachedWins, reached);
    lines.push(
      `    ${actLabel(act, totalActs)}: reached=${reached} (${pctOrNone(reached, cohort.games)})  win|reached=${conversion}`,
    );
  }
  return lines;
}

/**
 * Bullet 4: efficiency and action-shape diagnostics. Medians are nearest-rank
 * over per-run derived values; the no-progress and positive-unused-energy
 * rates are cohort-level AGGREGATE ratios (sum over all runs, then divide),
 * not medians of per-run ratios — see the plan's exact wording for why these
 * two are aggregate rather than per-run-then-median. Every zero-opportunity
 * denominator (no run with a completed turn, no comparable EndTurn) renders
 * `(none)`.
 */
function formatEfficiencyLines(cohort: CohortAggregate): string[] {
  const totalActionsAll = cohort.runs.map((r) => r.totalActions);
  const runsWithEndTurn = cohort.runs.filter((r) => r.actionCounts.EndTurn > 0);
  const actionsPerTurn = runsWithEndTurn.map((r) => r.totalActions / r.actionCounts.EndTurn);
  const unusedEnergyPerTurn = runsWithEndTurn.map(
    (r) => r.totalUnusedEnergy / r.actionCounts.EndTurn,
  );

  let noProgressSum = 0;
  let comparableEndTurnsSum = 0;
  let positiveUnusedSum = 0;
  let endTurnsSum = 0;
  const actionKindTotals: ActionCounts = {
    PlayCard: 0,
    DiscardHazard: 0,
    EndTurn: 0,
    ChooseBoon: 0,
  };

  for (const run of cohort.runs) {
    noProgressSum += run.noProgressEndTurns;
    comparableEndTurnsSum += Math.max(0, run.actionCounts.EndTurn - 1);
    positiveUnusedSum += run.positiveUnusedEndTurns;
    endTurnsSum += run.actionCounts.EndTurn;
    for (const kind of ACTION_KIND_ORDER) actionKindTotals[kind] += run.actionCounts[kind];
  }

  const actionKindText = ACTION_KIND_ORDER.map((kind) => `${kind}=${actionKindTotals[kind]}`).join(
    ", ",
  );

  return [
    "  Efficiency:",
    `    Median total actions: ${fmtOrNone(median(totalActionsAll))}`,
    `    Median actions/completed turn: ${fmtOrNone(median(actionsPerTurn))}`,
    `    No-progress rate (per comparable EndTurn): ${pctOrNone(noProgressSum, comparableEndTurnsSum)}`,
    `    Positive-unused-energy EndTurn rate: ${pctOrNone(positiveUnusedSum, endTurnsSum)}`,
    `    Median unused energy/EndTurn: ${fmtOrNone(median(unusedEnergyPerTurn))}`,
    `    Action-kind counts: ${actionKindText}`,
  ];
}

/**
 * Bullet 5: median per-run minimum of each posthoc ground-truth pressure
 * axis, across ALL runs regardless of disposition. These are outcome
 * diagnostics sampled from committed state (see `GroundTruthPressure`), never
 * a claim about what the honest agent perceived.
 */
function formatPressureLines(cohort: CohortAggregate): string[] {
  const lines = ["  Pressure (median per-run minimum, posthoc ground truth):"];
  for (const axis of PRESSURE_AXES) {
    const values = cohort.runs.map((r) => r.posthocPressure[axis.key]);
    lines.push(`    ${axis.label}: ${fmtOrNone(median(values))}`);
  }
  return lines;
}

interface CohortBlockOptions {
  /** Only the baseline cohort can carry `[FLAGGED]`/dominant/caveat. */
  isBaseline: boolean;
  threshold: number;
  /** Present on the recovery cohort only, to render the win-rate-diff line. */
  baselineForDiff?: CohortAggregate;
}

/**
 * Formats one cohort's full section (bullets 1/2/3/4/5/6, as they apply) in
 * the plan's fixed order: distribution, funnel, efficiency, pressure, then
 * loss attribution. `[FLAGGED]`/dominant cause+act/caveat are gated on
 * `isBaseline` — recovery never gets them, per the spec amendment.
 */
function formatCohortBlock(
  label: string,
  cohort: CohortAggregate,
  totalActs: number,
  opts: CohortBlockOptions,
): string[] {
  const lines: string[] = [`  -- ${label} --`];
  lines.push(...formatDistributionLines(cohort));
  if (opts.baselineForDiff !== undefined) {
    lines.push(formatWinRateDiffLine(opts.baselineForDiff, cohort));
  }
  lines.push(...formatFunnelLines(cohort, totalActs));
  lines.push(...formatEfficiencyLines(cohort));
  lines.push(...formatPressureLines(cohort));
  lines.push(`  Loss by cause: ${formatCauseMap(cohort.lossByCause)}`);
  lines.push(`  Loss by act:   ${formatActMap(cohort.lossByAct, totalActs)}`);

  if (opts.isBaseline) {
    if (isFlagged(cohort, opts.threshold)) {
      const winRate = winRateOf(cohort);
      if (winRate === 1) {
        lines.push("  [FLAGGED] win-rate 100.0% (too easy)");
        return lines;
      }
      lines.push(
        `  [FLAGGED] win-rate ${pct(cohort.wins, cohort.games)} <= ${(opts.threshold * 100).toFixed(1)}%`,
      );
      const domCause = dominant(cohort.lossByCause);
      const domAct = dominant(cohort.lossByAct);
      if (domCause !== undefined) {
        lines.push(`    Dominant cause: ${domCause[0]} (${domCause[1]}/${cohort.losses} losses)`);
      }
      if (domAct !== undefined) {
        lines.push(
          `    Dominant act:   ${actLabel(domAct[0], totalActs)} (${domAct[1]}/${cohort.losses} losses)`,
        );
      }
      lines.push(...CAVEAT_LINES);
    }
  }

  return lines;
}

function formatWorldBlock(agg: WorldAggregate, threshold: number): string {
  const lines: string[] = [`World: ${agg.id}  (${agg.totalActs} acts)`, ""];
  lines.push(
    ...formatCohortBlock("Baseline (default starter, no unlocks)", agg.baseline, agg.totalActs, {
      isBaseline: true,
      threshold,
    }),
  );
  for (const [index, recovery] of agg.recoveries.entries()) {
    // `recoveries` is built 1:1 from RECOVERY_UNLOCK_IDS (runCompleteness), so
    // the index lookup only misses for hand-rolled aggregates in tests.
    const unlocks = RECOVERY_UNLOCK_IDS[index]?.join(", ") ?? "unknown";
    lines.push("");
    lines.push(
      ...formatCohortBlock(`Recovery (unlocks: ${unlocks})`, recovery, agg.totalActs, {
        isBaseline: false,
        threshold,
        baselineForDiff: agg.baseline,
      }),
    );
  }
  return lines.join("\n");
}

export function formatHumanReport(
  params: CompletenessParams,
  aggregates: WorldAggregate[],
): string {
  const blocks: string[] = [];
  blocks.push("Completeness report");
  blocks.push(
    `  N=${params.N}  K=${params.K}  agentSeed=${params.agentSeed}  threshold=${(params.threshold * 100).toFixed(1)}%`,
  );
  if (params.worldId !== undefined) blocks.push(`  World filter: ${params.worldId}`);
  blocks.push(`  Eval weights: ${params.weightsOverridden ? "custom (SIM_WEIGHTS)" : "default"}`);
  blocks.push(
    `  Play-outs per world: ${PLAY_OUTS_PER_SEED * params.N} (${PLAY_OUTS_PER_SEED} x N: one baseline + ${RECOVERY_UNLOCK_IDS.length} recovery play-out(s) per seed)`,
  );
  for (const [index, unlockIds] of RECOVERY_UNLOCK_IDS.entries()) {
    blocks.push(`  Recovery unlock set ${index + 1}: ${unlockIds.join(", ")}`);
  }
  blocks.push("");
  for (const agg of aggregates) {
    blocks.push(formatWorldBlock(agg, params.threshold));
    blocks.push("");
  }
  const flagged = aggregates.filter((a) => isFlagged(a.baseline, params.threshold));
  blocks.push(`Flagged worlds: ${flagged.length}/${aggregates.length}`);
  return blocks.join("\n");
}

export function formatJsonReport(params: CompletenessParams, aggregates: WorldAggregate[]): string {
  const flagged = aggregates.filter((a) => isFlagged(a.baseline, params.threshold));
  const report = {
    format: "shattered-worlds-completeness",
    version: 1,
    params: {
      N: params.N,
      K: params.K,
      agentSeed: params.agentSeed,
      threshold: params.threshold,
      weights: params.weights,
      weightsOverridden: params.weightsOverridden,
      maxActionsPerWorld: params.maxActionsPerWorld ?? DEFAULT_MAX_ACTIONS_PER_WORLD,
      ...(params.worldId !== undefined ? { worldId: params.worldId } : {}),
    },
    playOutsPerWorld: PLAY_OUTS_PER_SEED * params.N,
    recoveryUnlockIds: [...RECOVERY_UNLOCK_IDS],
    worlds: aggregates.map((aggregate) => ({
      ...aggregate,
      flagged: isFlagged(aggregate.baseline, params.threshold),
    })),
    summary: {
      flaggedWorldIds: flagged.map((aggregate) => aggregate.id),
      flaggedWorlds: flagged.length,
      totalWorlds: aggregates.length,
    },
  };

  return JSON.stringify(
    report,
    (_key, value: unknown) => (value instanceof Map ? Object.fromEntries(value.entries()) : value),
    2,
  );
}

/** Format using the CLI-selected format, defaulting to JSON for programmatic callers too. */
export function formatReport(params: CompletenessParams, aggregates: WorldAggregate[]): string {
  return params.outputFormat === "human"
    ? formatHumanReport(params, aggregates)
    : formatJsonReport(params, aggregates);
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
  const selected = selectWorlds(worlds, params.worldId);
  const aggregates = runCompleteness(params, selected);
  console.log(formatReport(params, aggregates));
}
