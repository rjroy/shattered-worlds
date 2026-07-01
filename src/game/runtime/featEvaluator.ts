import type { RunRecord, LifetimeStats, RunStatsReader } from "./runStats";
import type { WitnessProfile, WitnessStore } from "./witnessProfile";
import type { FeatsStore } from "./featsProfile";
import type { FeatCondition, FeatDefinition } from "../../data/feats/types";
import type { Clock, RunStreamSubscriber, RunStreamItem } from "./gameplayEventStream";

export type EvaluationContext = {
  readonly run: RunRecord;
  readonly witness: WitnessProfile;
  readonly lifetime: LifetimeStats;
};

const DIRECT_RUN_FIELDS = new Set([
  "outcome",
  "worldId",
  "turns",
  "cardsPlayed",
  "progressDealt",
  "damageTaken",
  "hazardsResolved",
  "hazardsDiscarded",
  "cardsDiscarded",
  "finalHp",
  "healingReceived",
  "cardsFrozen",
  "cardsThawed",
  "heatGained",
  "heatSpent",
  "cardsBurnedForHeat",
]);

const RESOURCE_FIELDS = new Set(["energy", "light", "brace", "heat"]);

// lifetime.version (literal 2) is reachable but harmless — numeric ops on 2 will fail-closed for all real catalog conditions
function resolveStat(statId: string, ctx: EvaluationContext): unknown {
  if (DIRECT_RUN_FIELDS.has(statId)) {
    return (ctx.run as unknown as Record<string, unknown>)[statId];
  }

  if (RESOURCE_FIELDS.has(statId)) {
    return ctx.run.finalResources?.[statId];
  }

  if (statId.startsWith("lifetime.")) {
    const field = statId.slice("lifetime.".length);
    return (ctx.lifetime as unknown as Record<string, unknown>)[field];
  }

  if (statId.startsWith("world.")) {
    const rest = statId.slice("world.".length);
    const dotIndex = rest.indexOf(".");
    if (dotIndex === -1) return undefined;
    const worldId = rest.slice(0, dotIndex);
    const field = rest.slice(dotIndex + 1);
    const worldEntry = ctx.lifetime.byWorld[worldId];
    if (worldEntry === undefined) return undefined;
    return (worldEntry as unknown as Record<string, unknown>)[field];
  }

  if (statId.startsWith("witness.")) {
    const rest = statId.slice("witness.".length);
    const dotIndex = rest.indexOf(".");
    if (dotIndex === -1) return undefined;
    const templateId = rest.slice(0, dotIndex);
    const field = rest.slice(dotIndex + 1);
    return (ctx.witness.threats[templateId] as unknown as Record<string, unknown> | undefined)?.[
      field
    ];
  }

  return undefined;
}

export function evaluateCondition(condition: FeatCondition, ctx: EvaluationContext): boolean {
  const resolved = resolveStat(condition.statId, ctx);

  if (resolved === undefined) return false;

  switch (condition.operator) {
    case "gte":
      if (typeof resolved !== "number" || typeof condition.value !== "number") return false;
      return resolved >= condition.value;
    case "lte":
      if (typeof resolved !== "number" || typeof condition.value !== "number") return false;
      return resolved <= condition.value;
    case "gt":
      if (typeof resolved !== "number" || typeof condition.value !== "number") return false;
      return resolved > condition.value;
    case "lt":
      if (typeof resolved !== "number" || typeof condition.value !== "number") return false;
      return resolved < condition.value;
    case "eq":
      return resolved === condition.value;
    case "is":
      if (typeof resolved !== "string") return false;
      return resolved === condition.value;
  }
}

export function evaluateFeat(definition: FeatDefinition, ctx: EvaluationContext): boolean {
  return definition.conditions.every((c) => evaluateCondition(c, ctx));
}

// ---------------------------------------------------------------------------
// Subscriber half
// ---------------------------------------------------------------------------

export interface FeatEvaluator {
  readonly subscriber: RunStreamSubscriber;
  lastRunEarned(): readonly FeatDefinition[];
}

export function createFeatEvaluator(
  catalog: readonly FeatDefinition[],
  featsStore: FeatsStore,
  runStats: RunStatsReader,
  witnessStore: WitnessStore,
  clock: Clock,
): FeatEvaluator {
  let lastEarned: FeatDefinition[] = [];

  const subscriber: RunStreamSubscriber = (item: RunStreamItem) => {
    if (item.kind === "RunStarted") {
      lastEarned = [];
      return;
    }

    if (item.kind !== "RunEnded") return;

    // Abandoned runs are skipped entirely — no reset, no evaluation.
    if (item.outcome === "abandoned") return;

    const lifetime = runStats.lifetime();

    if (lifetime.lastRun === undefined) {
      console.warn(
        "[featEvaluator] RunEnded received but lifetime.lastRun is undefined; skipping feat evaluation",
      );
      return;
    }

    const witness = witnessStore.getProfile();
    const ctx: EvaluationContext = {
      run: lifetime.lastRun,
      witness,
      lifetime,
    };

    const alreadyEarned = featsStore.getProfile().earned;

    for (const definition of catalog) {
      if (alreadyEarned.some((r) => r.featId === definition.id)) continue;

      if (evaluateFeat(definition, ctx)) {
        featsStore.appendFeat({
          featId: definition.id,
          earnedAt: clock(),
          sessionId: item.sessionId,
        });
        lastEarned.push(definition);
      }
    }
  };

  return {
    subscriber,
    lastRunEarned: () => lastEarned,
  };
}
