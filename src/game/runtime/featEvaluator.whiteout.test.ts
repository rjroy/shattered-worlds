import { describe, expect, it } from "bun:test";
import { FEAT_CATALOG } from "../../data/feats/catalog";
import { evaluateFeat, type EvaluationContext } from "./featEvaluator";
import type { RunRecord, LifetimeStats } from "./runStats";
import type { WitnessProfile } from "./witnessProfile";

function makeCtx(overrides?: Partial<RunRecord>, witness?: WitnessProfile): EvaluationContext {
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

  return { run, lifetime, witness: witness ?? { version: 1, threats: {} } };
}

describe("Whiteout feats", () => {
  it("first-whiteout-parking-garage requires a cumulative Whiteout win", () => {
    const feat = FEAT_CATALOG.find(
      (definition) => definition.id === "first-whiteout-parking-garage",
    )!;
    const whiteoutStats = {
      runs: 1,
      wins: 1,
      losses: 0,
      abandoned: 0,
    };

    expect(
      evaluateFeat(feat, {
        ...makeCtx(),
        lifetime: {
          ...makeCtx().lifetime,
          byWorld: { "whiteout-parking-garage": whiteoutStats },
        },
      }),
    ).toBe(true);
    expect(
      evaluateFeat(feat, {
        ...makeCtx(),
        lifetime: {
          ...makeCtx().lifetime,
          byWorld: { "whiteout-parking-garage": { ...whiteoutStats, wins: 0 } },
        },
      }),
    ).toBe(false);
  });

  it("heat-keeper reads finalResources.heat", () => {
    const feat = FEAT_CATALOG.find((definition) => definition.id === "heat-keeper")!;

    expect(
      evaluateFeat(
        feat,
        makeCtx({
          outcome: "won",
          worldId: "whiteout-parking-garage",
          finalResources: { heat: 10 },
        }),
      ),
    ).toBe(true);
    expect(
      evaluateFeat(
        feat,
        makeCtx({
          outcome: "won",
          worldId: "whiteout-parking-garage",
          finalResources: { heat: 9 },
        }),
      ),
    ).toBe(false);
  });

  it("master-thaw reads cardsThawed from the run record", () => {
    const feat = FEAT_CATALOG.find((definition) => definition.id === "master-thaw")!;

    expect(
      evaluateFeat(
        feat,
        makeCtx({ outcome: "won", worldId: "whiteout-parking-garage", cardsThawed: 5 }),
      ),
    ).toBe(true);
    expect(
      evaluateFeat(
        feat,
        makeCtx({ outcome: "won", worldId: "whiteout-parking-garage", cardsThawed: 4 }),
      ),
    ).toBe(false);
  });

  it("freeze-slayer resolves through the witness namespace", () => {
    const feat = FEAT_CATALOG.find((definition) => definition.id === "freeze-slayer")!;
    const witness: WitnessProfile = {
      version: 1,
      threats: {
        "The Garage Freezes Shut": {
          encounterCount: 25,
          resolvedCount: 25,
          discardedCount: 0,
          diedTo: false,
        },
      },
    };

    expect(evaluateFeat(feat, makeCtx({}, witness))).toBe(true);
    expect(evaluateFeat(feat, makeCtx())).toBe(false);
  });
});
