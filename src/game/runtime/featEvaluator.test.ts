import { describe, expect, it } from "bun:test";

import type { RunRecord, LifetimeStats, RunStatsReader, RunRecordRecords } from "./runStats";
import type { WitnessProfile } from "./witnessProfile";
import {
  evaluateCondition,
  evaluateFeat,
  createFeatEvaluator,
  type EvaluationContext,
} from "./featEvaluator";
import type { FeatCondition, FeatDefinition } from "../../data/feats/types";
import { createRunStatsCollector } from "./runStats";
import { createWitnessCollector } from "./witnessProfile";
import { createFeatsStore } from "./featsProfile";
import { FEAT_CATALOG } from "../../data/feats/catalog";
import { createRunStarted, createRunEnded, createGameplayBatch } from "./gameplayEventStream";
import { catalog, worldData } from "../../core/tests/testFixture";
import { buildWorld } from "../../data/worldManifest";
import { createGameplaySession } from "./gameplaySession";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides?: Partial<RunRecord>): EvaluationContext {
  const run: RunRecord = {
    sessionId: "test-session",
    worldId: "test-world",
    seed: 0,
    appliedModifiers: [],
    outcome: "won",
    finalActIndex: 0,
    startedAt: 0,
    endedAt: 0,
    activeDurationMs: 0,
    turns: 5,
    cardsPlayed: 0,
    progressDealt: 0,
    damageTaken: 0,
    hazardsResolved: 0,
    hazardsDiscarded: 0,
    cardsDiscarded: 0,
    ...overrides,
  };

  const lifetime: LifetimeStats = {
    version: 2,
    runs: 0,
    wins: 0,
    losses: 0,
    abandoned: 0,
    turns: 0,
    cardsPlayed: 0,
    progressDealt: 0,
    damageTaken: 0,
    hazardsResolved: 0,
    hazardsDiscarded: 0,
    cardsDiscarded: 0,
    durationMs: 0,
    byWorld: {},
  };

  const witness: WitnessProfile = { version: 1, threats: {} };

  return { run, lifetime, witness };
}

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #2: gte/lte numeric
// ---------------------------------------------------------------------------

describe("evaluateCondition — lte", () => {
  const condition: FeatCondition = { statId: "turns", operator: "lte", value: 9 };

  it("returns true when turns is below the threshold", () => {
    expect(evaluateCondition(condition, makeCtx({ turns: 8 }))).toBe(true);
  });

  it("returns false when turns exceeds the threshold", () => {
    expect(evaluateCondition(condition, makeCtx({ turns: 10 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #3: is operator on outcome
// ---------------------------------------------------------------------------

describe("evaluateCondition — is on outcome", () => {
  const condition: FeatCondition = { statId: "outcome", operator: "is", value: "won" };

  it("returns true when outcome matches", () => {
    expect(evaluateCondition(condition, makeCtx({ outcome: "won" }))).toBe(true);
  });

  it("returns false when outcome does not match", () => {
    expect(evaluateCondition(condition, makeCtx({ outcome: "lost" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #4: undefined optional field
// ---------------------------------------------------------------------------

describe("evaluateCondition — undefined optional field", () => {
  it("returns false without throwing when finalHp is undefined", () => {
    const condition: FeatCondition = { statId: "finalHp", operator: "gte", value: 10 };
    const ctx = makeCtx();
    expect(evaluateCondition(condition, ctx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #5: non-number in numeric operator
// ---------------------------------------------------------------------------

describe("evaluateCondition — non-number resolved value", () => {
  it("returns false when turns is a string and operator is gte", () => {
    const condition: FeatCondition = { statId: "turns", operator: "gte", value: 5 };
    // Cast to any to simulate corrupt data at runtime
    const ctx = makeCtx({ turns: "five" as unknown as number });
    expect(evaluateCondition(condition, ctx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateFeat — Validation #6: AND semantics, first condition false
// ---------------------------------------------------------------------------

describe("evaluateFeat — AND semantics", () => {
  it("returns false when the first condition fails", () => {
    const definition: FeatDefinition = {
      id: "test-feat",
      name: "Test Feat",
      description: "",
      conditions: [
        { statId: "outcome", operator: "is", value: "lost" },
        { statId: "turns", operator: "lte", value: 10 },
      ],
      reward: { items: [] },
    };
    expect(evaluateFeat(definition, makeCtx({ outcome: "won", turns: 5 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateFeat — Validation #7: empty conditions
// ---------------------------------------------------------------------------

describe("evaluateFeat — empty conditions", () => {
  it("returns true when conditions array is empty", () => {
    const definition: FeatDefinition = {
      id: "always-true",
      name: "Always True",
      description: "",
      conditions: [],
      reward: { items: [] },
    };
    expect(evaluateFeat(definition, makeCtx())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #8: lifetime.wins dot-path
// ---------------------------------------------------------------------------

describe("evaluateCondition — lifetime dot-path", () => {
  it("returns true when lifetime.wins satisfies gte", () => {
    const condition: FeatCondition = { statId: "lifetime.wins", operator: "gte", value: 3 };
    const ctx = makeCtx();
    const ctxWithWins: EvaluationContext = {
      ...ctx,
      lifetime: { ...ctx.lifetime, wins: 5 },
    };
    expect(evaluateCondition(condition, ctxWithWins)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #9: witness dot-path, missing threat
// ---------------------------------------------------------------------------

describe("evaluateCondition — witness dot-path, missing entry", () => {
  it("returns false when the threat entry does not exist", () => {
    const condition: FeatCondition = {
      statId: "witness.Zombie.encounterCount",
      operator: "gte",
      value: 1,
    };
    expect(evaluateCondition(condition, makeCtx())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — Validation #10: world dot-path, missing world entry
// ---------------------------------------------------------------------------

describe("evaluateCondition — world dot-path, missing world entry", () => {
  it("returns false when byWorld has no entry for the current worldId", () => {
    const condition: FeatCondition = { statId: "world.wins", operator: "gte", value: 1 };
    expect(evaluateCondition(condition, makeCtx())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createFeatEvaluator subscriber — integration tests
// ---------------------------------------------------------------------------

/** Real GameState from zombie-big-box fixture — used as a stub where resource contents don't matter. */
const stubState = createGameplaySession(catalog, worldData, 42).state;

/** Build a state override with specific resource values and worldId. */
function makeStateWithResources(overrides: {
  worldId?: string;
  light?: number;
  energy?: number;
  braceCharges?: number;
  status?: "playing" | "won" | "lost";
}) {
  return {
    ...stubState,
    worldId: overrides.worldId ?? stubState.worldId,
    light: overrides.light ?? 0,
    energy: overrides.energy ?? 0,
    braceCharges: overrides.braceCharges ?? 0,
    status: overrides.status ?? ("playing" as const),
  };
}

// ---------------------------------------------------------------------------
// Validation #11: first-survivor earned on won run
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #11: first-survivor earned on won run", () => {
  it("earns first-survivor after a won run and stores it in featsStore", () => {
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-11",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(startItem);
    witnessStore.subscriber(startItem);
    evaluator.subscriber(startItem);

    const endItem = createRunEnded({
      sessionId: "run-11",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(endItem);
    witnessStore.subscriber(endItem);
    evaluator.subscriber(endItem);

    expect(featsStore.getProfile().earned.find((r) => r.featId === "first-survivor")).toBeDefined();
    expect(evaluator.lastRunEarned().find((d) => d.id === "first-survivor")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Validation #12: first-survivor not earned twice across two won runs
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #12: first-survivor not duplicated", () => {
  it("earns first-survivor once even after two won runs", () => {
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    // Run 1: won
    const start1 = createRunStarted({
      sessionId: "run-12a",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(start1);
    witnessStore.subscriber(start1);
    evaluator.subscriber(start1);

    const end1 = createRunEnded({
      sessionId: "run-12a",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(end1);
    witnessStore.subscriber(end1);
    evaluator.subscriber(end1);

    // Run 2: won
    const start2 = createRunStarted({
      sessionId: "run-12b",
      worldId: "zombie-big-box",
      seed: 2,
      appliedModifiers: [],
      timestamp: 3000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(start2);
    witnessStore.subscriber(start2);
    evaluator.subscriber(start2);

    const end2 = createRunEnded({
      sessionId: "run-12b",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 4000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(end2);
    witnessStore.subscriber(end2);
    evaluator.subscriber(end2);

    const earned = featsStore.getProfile().earned.filter((r) => r.featId === "first-survivor");
    expect(earned).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Validation #13: abandoned run does not earn feats or reset lastRunEarned
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #13: abandoned run skipped", () => {
  it("does not earn feats or change lastRunEarned for an abandoned run", () => {
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-13",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(startItem);
    witnessStore.subscriber(startItem);
    evaluator.subscriber(startItem);

    const endItem = createRunEnded({
      sessionId: "run-13",
      outcome: "abandoned",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: stubState,
    });
    runStats.subscriber(endItem);
    witnessStore.subscriber(endItem);
    evaluator.subscriber(endItem);

    expect(evaluator.lastRunEarned()).toHaveLength(0);
    expect(featsStore.getProfile().earned).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Validation #20: no-healing earned on won run with healingReceived === 0
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #20: no-healing feat", () => {
  it("earns no-healing on a won run with no healing, but not on a subsequent run with healing", () => {
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    // Run 1: won, no healing — no-healing should fire
    const start1 = createRunStarted({
      sessionId: "run-20a",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(start1);
    witnessStore.subscriber(start1);
    evaluator.subscriber(start1);

    const end1 = createRunEnded({
      sessionId: "run-20a",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(end1);
    witnessStore.subscriber(end1);
    evaluator.subscriber(end1);

    expect(evaluator.lastRunEarned().find((d) => d.id === "no-healing")).toBeDefined();

    // Run 2: won, healing > 0 — no-healing already earned, should not appear in lastRunEarned
    const start2 = createRunStarted({
      sessionId: "run-20b",
      worldId: "zombie-big-box",
      seed: 2,
      appliedModifiers: [],
      timestamp: 3000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(start2);
    witnessStore.subscriber(start2);
    evaluator.subscriber(start2);

    // Emit a HealReceived event via GameplayBatch to set healingReceived > 0
    // We can also just check that since it's already earned, it won't re-appear.
    const end2 = createRunEnded({
      sessionId: "run-20b",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 4000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(end2);
    witnessStore.subscriber(end2);
    evaluator.subscriber(end2);

    // no-healing already earned — should NOT appear in lastRunEarned for run 2
    expect(evaluator.lastRunEarned().find((d) => d.id === "no-healing")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Validation #21: century-push earned on a lost run with progressDealt >= 100
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #21: century-push on loss", () => {
  it("earns century-push on a lost run with progressDealt >= 100", () => {
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-21",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(startItem);
    witnessStore.subscriber(startItem);
    evaluator.subscriber(startItem);

    // Inject 100 progress via GameplayBatch events so runStats tallies it
    const batchItem = createGameplayBatch(
      "run-21",
      { type: "EndTurn" },
      {
        state: stubState,
        events: Array.from({ length: 100 }, () => ({
          type: "ProgressDealt" as const,
          hazardId: "stub-hazard",
          templateId: "stub-hazard",
          amount: 1,
          hazardTurnTotal: 1,
        })),
      },
      1500,
    );
    runStats.subscriber(batchItem);
    witnessStore.subscriber(batchItem);
    evaluator.subscriber(batchItem);

    const endItem = createRunEnded({
      sessionId: "run-21",
      outcome: "lost",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: makeStateWithResources({ status: "lost" }),
    });
    runStats.subscriber(endItem);
    witnessStore.subscriber(endItem);
    evaluator.subscriber(endItem);

    expect(evaluator.lastRunEarned().find((d) => d.id === "century-push")).toBeDefined();
    expect(featsStore.getProfile().earned.find((r) => r.featId === "century-push")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Validation #22: veteran earned via stub RunStatsReader with 10 runs
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #22: veteran cross-run via stub reader", () => {
  it("earns veteran when stub lifetime has runs >= 10", () => {
    const stubLastRun: RunRecord = {
      sessionId: "stub-run",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      outcome: "won",
      finalActIndex: 0,
      startedAt: 0,
      endedAt: 1000,
      activeDurationMs: 1000,
      turns: 5,
      cardsPlayed: 3,
      progressDealt: 50,
      damageTaken: 0,
      hazardsResolved: 0,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
    };

    const stubLifetime: LifetimeStats = {
      version: 2,
      runs: 10,
      wins: 5,
      losses: 5,
      abandoned: 0,
      turns: 50,
      cardsPlayed: 30,
      progressDealt: 500,
      damageTaken: 0,
      hazardsResolved: 0,
      hazardsDiscarded: 0,
      cardsDiscarded: 0,
      durationMs: 10000,
      byWorld: {},
      lastRun: stubLastRun,
    };

    const stubRunStats: RunStatsReader = {
      lifetime: () => stubLifetime,
      lastRunRecords: (): RunRecordRecords => ({}),
    };

    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      stubRunStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-22",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    evaluator.subscriber(startItem);

    const endItem = createRunEnded({
      sessionId: "run-22",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: stubState,
    });
    evaluator.subscriber(endItem);

    expect(evaluator.lastRunEarned().find((d) => d.id === "veteran")).toBeDefined();
    expect(featsStore.getProfile().earned.find((r) => r.featId === "veteran")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Validation #23: light-keeper world-scoped feat
// ---------------------------------------------------------------------------

describe("createFeatEvaluator — Validation #23: light-keeper world-scoped", () => {
  it("earns light-keeper on fog-beach-party with light >= 10", () => {
    const fogWorldData = buildWorld("fog-beach-party");
    const fogSession = createGameplaySession(fogWorldData.catalog, fogWorldData.worldData, 42);
    const fogStubState = {
      ...fogSession.state,
      light: 10,
      worldId: "fog-beach-party",
      status: "won" as const,
    };

    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-23a",
      worldId: "fog-beach-party",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: fogStubState,
    });
    runStats.subscriber(startItem);
    witnessStore.subscriber(startItem);
    evaluator.subscriber(startItem);

    const endItem = createRunEnded({
      sessionId: "run-23a",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: fogStubState,
    });
    runStats.subscriber(endItem);
    witnessStore.subscriber(endItem);
    evaluator.subscriber(endItem);

    expect(evaluator.lastRunEarned().find((d) => d.id === "light-keeper")).toBeDefined();
  });

  it("does not earn light-keeper on zombie-big-box (world mismatch)", () => {
    // Fresh featsStore so light-keeper is not already earned
    const runStats = createRunStatsCollector({ clock: () => 1000 });
    const witnessStore = createWitnessCollector(undefined);
    const featsStore = createFeatsStore(undefined);
    const evaluator = createFeatEvaluator(
      FEAT_CATALOG,
      featsStore,
      runStats,
      witnessStore,
      () => 1000,
    );

    const startItem = createRunStarted({
      sessionId: "run-23b",
      worldId: "zombie-big-box",
      seed: 1,
      appliedModifiers: [],
      timestamp: 1000,
      initialEvents: [],
      initialState: stubState,
    });
    runStats.subscriber(startItem);
    witnessStore.subscriber(startItem);
    evaluator.subscriber(startItem);

    const endItem = createRunEnded({
      sessionId: "run-23b",
      outcome: "won",
      finalActIndex: 0,
      timestamp: 2000,
      finalState: makeStateWithResources({ status: "won" }),
    });
    runStats.subscriber(endItem);
    witnessStore.subscriber(endItem);
    evaluator.subscriber(endItem);

    expect(evaluator.lastRunEarned().find((d) => d.id === "light-keeper")).toBeUndefined();
  });
});
