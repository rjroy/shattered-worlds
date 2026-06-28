/**
 * Unit tests for the eval-driven policy (`src/sim/evalPolicy.ts`) and the
 * name-free legal-action enumeration it relies on (`enumerateActions` in
 * `src/sim/policy.ts`). These pin the Step 3 validation gates:
 *
 *   1. Budget honesty (REQ-SCC-5): every action the eval policy returns is one
 *      `availableActions` admits for the committed state, and `enumerateActions`
 *      only ever yields members of `availableActions`.
 *   2. Seam honesty (REQ-SCC-2): the policy decides on the VIEW it is handed.
 *      Feeding it ground truth vs a determinized snapshot (same multiset, only
 *      hidden-zone order differs) can change the decision, proving it consumes
 *      the view's hidden info rather than peeking at a canonical truth.
 *   3. `enumerateActions` name-freeness (REQ-SCC-4): the enumeration is
 *      identical for two states differing only in card names, while `pickAction`
 *      (which DOES steer by name) diverges on the same pair.
 *   4. K behaviour: K-sampling actually varies the decision, and the policy is
 *      deterministic for a fixed (view, rng-seed, K).
 */
import { describe, expect, test } from "bun:test";
import type { Action, GameState } from "../../core/model/types";
import { createWorld } from "../../core/engine/world";
import { reduce } from "../../core/engine/reduce";
import { createRng, nextFloat, rngFromSeed } from "../../core/engine/rng";
import { availableActions, checkPlayAction } from "../../core/engine/available";
import { makePlayerCard, makeState } from "../../core/tests/testFixture";
import { determinize } from "../determinize";
import {
  enumerateActions,
  pickAction,
  catalog,
  worldData,
} from "../policy";
import { evalPolicyFactory } from "../evalPolicy";
import { DEFAULT_EVAL_WEIGHTS } from "../eval";

const W = DEFAULT_EVAL_WEIGHTS;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Whether `action` is one `availableActions` admits for `state`. This is the
 * budget-honesty oracle: a PlayCard must name a playable card AND pass the
 * spec-level `checkPlayAction`; targets/branches must be legal. Boon choices are
 * checked against the offered template ids.
 */
function actionIsAdmitted(state: GameState, action: Action): boolean {
  const pendingBoon = state.pendingBoonChoices[0];
  if (pendingBoon !== undefined) {
    return (
      action.type === "ChooseBoon" &&
      pendingBoon.offeredTemplateIds.includes(action.templateId)
    );
  }

  const avail = availableActions(state);
  switch (action.type) {
    case "EndTurn":
      return avail.canEndTurn;
    case "DiscardHazard":
      return avail.discardable.includes(action.cardId);
    case "PlayCard":
      return (
        avail.playable.some((p) => p.cardId === action.cardId) &&
        checkPlayAction(avail, action) === null
      );
    case "ChooseBoon":
      // No boon pending but a ChooseBoon was returned — never admissible.
      return false;
  }
}

/** Stable serialization for action equality across runs. */
function ser(action: Action): string {
  return JSON.stringify(action);
}

/**
 * Advance a fresh world (via the name-steered `pickAction`) until both hidden
 * piles are populated, so determinization and rollouts have material to chew on.
 * Mirrors sim.test.ts's `midRunState`.
 */
function midRunState(seed: number): GameState {
  let state = createWorld(catalog, worldData, seed).state;
  const rng = rngFromSeed(seed);
  let actions = 0;
  while (
    state.status === "playing" &&
    actions < 200 &&
    (state.playerDraw.length < 2 || state.acts.length === 0)
  ) {
    state = reduce(catalog, state, pickAction(state, rng)).state;
    actions++;
  }
  return state;
}

/**
 * Every `playing` state (no boon pending, at least two enumerable candidates)
 * visited while `pickAction` drives `seed`'s world to a terminal state. Sampling
 * the whole trajectory — not just an early mid-run snapshot — surfaces the
 * close-call late-game states where a single reshuffle or extra K sample can
 * actually flip the argmax.
 */
function trajectoryStates(seed: number, cap = 400): GameState[] {
  const states: GameState[] = [];
  let state = createWorld(catalog, worldData, seed).state;
  const rng = rngFromSeed(seed);
  let actions = 0;
  while (state.status === "playing" && actions < cap) {
    if (
      state.pendingBoonChoices.length === 0 &&
      enumerateActions(state, rngFromSeed(1)).length >= 2
    ) {
      states.push(state);
    }
    state = reduce(catalog, state, pickAction(state, rng)).state;
    actions++;
  }
  return states;
}

// ---------------------------------------------------------------------------
// 1. Budget honesty (REQ-SCC-5, validation 9)
// ---------------------------------------------------------------------------

describe("eval policy — budget honesty", () => {
  const MAX_ACTIONS = 400;

  test("every returned action is admitted by the committed state (sampled run)", () => {
    const policy = evalPolicyFactory(catalog, W, 2);

    for (let seed = 1; seed <= 5; seed++) {
      // Drive the loop exactly like run.ts: determinize the REAL state, bridge
      // the threaded RngState to a () => number closure, decide on the snapshot,
      // apply the chosen action to the REAL (committed) state.
      let state = createWorld(catalog, worldData, seed).state;
      let agentRng = createRng(12345 + seed);
      let actions = 0;

      while (state.status === "playing" && actions < MAX_ACTIONS) {
        const [view, rngAfterDet] = determinize(state, agentRng);
        const [seedValue, rngAfterPolicy] = nextFloat(rngAfterDet);
        const policyRng = rngFromSeed(Math.floor(seedValue * 0x100000000));
        agentRng = rngAfterPolicy;

        const action = policy(view, policyRng);

        // The action decided on the snapshot must be legal for the committed
        // state and must apply without throwing.
        expect(
          actionIsAdmitted(state, action),
          `seed=${seed} action ${ser(action)} not admitted by committed state`,
        ).toBe(true);
        expect(() => reduce(catalog, state, action)).not.toThrow();

        state = reduce(catalog, state, action).state;
        actions++;
      }

      expect(state.status === "won" || state.status === "lost").toBe(true);
    }
  });

  test("enumerateActions only ever returns members of availableActions", () => {
    // Walk real mid-game states and assert every enumerated candidate is admitted.
    for (let seed = 1; seed <= 8; seed++) {
      let state = createWorld(catalog, worldData, seed).state;
      const driveRng = rngFromSeed(seed);
      let actions = 0;

      while (state.status === "playing" && actions < 200) {
        if (state.pendingBoonChoices.length === 0) {
          // Use a fresh rng so target/branch fill-in is exercised independently.
          const enumRng = rngFromSeed(1000 + seed * 31 + actions);
          for (const candidate of enumerateActions(state, enumRng)) {
            expect(
              actionIsAdmitted(state, candidate),
              `seed=${seed} enumerated ${ser(candidate)} not admitted`,
            ).toBe(true);
          }
        }
        state = reduce(catalog, state, pickAction(state, driveRng)).state;
        actions++;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Seam honesty — behavioral (REQ-SCC-2, validation 4)
// ---------------------------------------------------------------------------

describe("eval policy — seam honesty", () => {
  test("decision can differ between ground truth and the determinized view", () => {
    // Ground truth and its determinization hold the SAME hidden-zone multiset;
    // only the order differs. The policy reshuffles internally from whatever
    // order it is handed, so a decision that flips between the two proves the
    // policy consumes the view's hidden info, not a canonical truth. Search a
    // grid of (base state, policy seed); the search is deterministic.
    const policy = evalPolicyFactory(catalog, W, 1);
    let found = false;
    let detail = "";

    outer: for (let base = 1; base <= 40; base++) {
      for (const truth of trajectoryStates(base)) {
        if (truth.worldDraw.length + truth.acts.flat().length < 2) continue;
        const [view] = determinize(truth, createRng(7000 + base));
        for (let s = 0; s < 12; s++) {
          const aTruth = ser(policy(truth, rngFromSeed(s)));
          const aView = ser(policy(view, rngFromSeed(s)));
          if (aTruth !== aView) {
            found = true;
            detail = `base=${base} seed=${s}: truth=${aTruth} view=${aView}`;
            break outer;
          }
        }
      }
    }

    expect(found, `no ground-truth/view decision divergence found`).toBe(true);
    // Surface the witnessing case for forensic clarity if the assert ever flips.
    expect(detail.length).toBeGreaterThan(0);
  });

  test("the policy is a pure function of its view (a hidden-zone lie changes the decision)", () => {
    // Stronger, guaranteed seam proof: hand the policy two views with DIFFERENT
    // hidden content (full runway vs stripped piles). If the policy ignored the
    // view's hidden zones the two decisions would be identical; that they differ
    // shows the decision is computed from the handed view alone.
    const policy = evalPolicyFactory(catalog, W, 3);
    let found = false;

    outer: for (let base = 1; base <= 50; base++) {
      const truth = midRunState(base);
      if (truth.status !== "playing") continue;
      if (enumerateActions(truth, rngFromSeed(1)).length < 2) continue;

      const stripped: GameState = { ...truth, playerDraw: [], worldDraw: [], acts: [] };
      for (let s = 0; s < 40; s++) {
        if (ser(policy(truth, rngFromSeed(s))) !== ser(policy(stripped, rngFromSeed(s)))) {
          found = true;
          break outer;
        }
      }
    }

    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. enumerateActions name-freeness (supports REQ-SCC-4)
// ---------------------------------------------------------------------------

describe("enumerateActions — name-freeness", () => {
  /**
   * Two states identical in every structural respect (same ids, effects,
   * resources) and differing ONLY in card names. The first carries an objective
   * name `pickAction` steers toward; the second is generic.
   */
  function twoStatesDifferingOnlyInNames(): {
    named: GameState;
    generic: GameState;
  } {
    const baseCards = (xName: string) => [
      makePlayerCard({ id: "cx", name: xName, effect: { kind: "None" }, energyCost: 0 }),
      makePlayerCard({ id: "cy", name: "cy", effect: { kind: "None" }, energyCost: 0 }),
    ];
    return {
      named: makeState({ hand: baseCards("Summon Door"), energy: 0, status: "playing" }),
      generic: makeState({ hand: baseCards("cx"), energy: 0, status: "playing" }),
    };
  }

  test("enumeration is identical for states differing only in card names", () => {
    const { named, generic } = twoStatesDifferingOnlyInNames();

    // Fresh closures with the same seed: any rng consumed during fill-in is
    // consumed identically, so equal output isolates the name-independence.
    const fromNamed = enumerateActions(named, rngFromSeed(42)).map(ser);
    const fromGeneric = enumerateActions(generic, rngFromSeed(42)).map(ser);

    expect(fromNamed).toEqual(fromGeneric);
    // Sanity: the enumeration actually lists both plays plus EndTurn.
    expect(fromNamed.length).toBe(3);
  });

  test("pickAction DOES steer by name on the same pair (proving the names matter)", () => {
    const { named, generic } = twoStatesDifferingOnlyInNames();

    // None effects consume no rng during build, so the only rng draw is the
    // final uniform `pick`. A value of 0.9 over 3 actions selects index 2
    // (EndTurn) for the generic state, while the named state short-circuits to
    // its "Summon Door" objective (cx) before reaching the pick.
    const rng09 = () => 0.9;
    const namedChoice = pickAction(named, rng09);
    const genericChoice = pickAction(generic, () => 0.9);

    expect(namedChoice).toEqual({ type: "PlayCard", cardId: "cx" });
    expect(genericChoice).toEqual({ type: "EndTurn" });
    // The divergence confirms names steer pickAction but not enumerateActions.
    expect(ser(namedChoice)).not.toBe(ser(genericChoice));
  });

  test("pickAction's choice is always a slot enumerateActions also lists", () => {
    // Membership at the (type, cardId/templateId) level: enumerateActions never
    // omits the slot pickAction selects. (Exact targets may differ because
    // pickAction steers targets by name while enumerate picks randomly.)
    const slot = (a: Action): string =>
      a.type === "PlayCard"
        ? `PlayCard:${a.cardId}`
        : a.type === "DiscardHazard"
          ? `DiscardHazard:${a.cardId}`
          : a.type === "ChooseBoon"
            ? `ChooseBoon:${a.templateId}`
            : "EndTurn";

    for (let seed = 1; seed <= 8; seed++) {
      let state = createWorld(catalog, worldData, seed).state;
      const driveRng = rngFromSeed(seed);
      let actions = 0;

      while (state.status === "playing" && actions < 200) {
        const chosen = pickAction(state, rngFromSeed(500 + seed * 13 + actions));
        const enumerated = enumerateActions(
          state,
          rngFromSeed(900 + seed * 13 + actions),
        ).map(slot);
        expect(
          enumerated.includes(slot(chosen)),
          `seed=${seed} pickAction slot ${slot(chosen)} missing from enumeration`,
        ).toBe(true);
        state = reduce(catalog, state, pickAction(state, driveRng)).state;
        actions++;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 1b. destroyHand admissibility (REQ-SCC-5)
// ---------------------------------------------------------------------------

describe("enumerateActions — destroyHand admissibility", () => {
  /**
   * A hand where a DestroyCardInHand card is "playable" per core's isPlayable
   * (playerCardsInHand > min) yet has ZERO legal destroy targets, because
   * legalTargets excludes self and filters on canDestroy. The companion is
   * undestroyable, so the only other player card cannot be a target. This is the
   * exact mismatch the standalone/compound destroyHand branches must guard.
   */
  function stateWithUntargetableDestroyer(effect: {
    kind: "DestroyCardInHand" | "Sequence";
  }): GameState {
    const destroyer = makePlayerCard({
      id: "destroyer",
      name: "destroyer",
      effect:
        effect.kind === "DestroyCardInHand"
          ? { kind: "DestroyCardInHand", min: 1, max: 1 }
          : { kind: "Sequence", steps: [{ kind: "DestroyCardInHand", min: 1, max: 1 }] },
      energyCost: 0,
    });
    const companion = makePlayerCard({
      id: "companion",
      name: "companion",
      effect: { kind: "None" },
      canDestroy: false,
      energyCost: 0,
    });
    return makeState({ hand: [destroyer, companion], energy: 0, status: "playing" });
  }

  test("excludes a standalone DestroyCardInHand (min>0) when legal targets < min", () => {
    const state = stateWithUntargetableDestroyer({ kind: "DestroyCardInHand" });

    // Sanity: core reports the card as playable (the mismatch creating the hole)
    // while it has no legal destroy targets.
    const avail = availableActions(state);
    expect(avail.playable.some((p) => p.cardId === "destroyer")).toBe(true);
    expect(avail.legalTargets("destroyer", 0).length).toBe(0);

    const actions = enumerateActions(state, rngFromSeed(7));
    expect(actions.some((a) => a.type === "PlayCard" && a.cardId === "destroyer")).toBe(false);
    // Every enumerated action stays admissible by core's checkPlayAction.
    for (const a of actions) {
      expect(actionIsAdmitted(state, a), `${ser(a)} not admitted`).toBe(true);
    }
  });

  test("excludes a Sequence whose DestroyCardInHand step (min>0) has no legal targets", () => {
    const state = stateWithUntargetableDestroyer({ kind: "Sequence" });

    const avail = availableActions(state);
    expect(avail.playable.some((p) => p.cardId === "destroyer")).toBe(true);

    const actions = enumerateActions(state, rngFromSeed(11));
    expect(actions.some((a) => a.type === "PlayCard" && a.cardId === "destroyer")).toBe(false);
    for (const a of actions) {
      expect(actionIsAdmitted(state, a), `${ser(a)} not admitted`).toBe(true);
    }
  });

  test("still enumerates a min===0 DestroyCardInHand (optional destroy stays available)", () => {
    // With min===0 an empty selection is admissible, so the card must NOT be
    // excluded even with zero legal targets. Use a fixed-true rng for the
    // optional coin flip so the action is deterministically the skip form.
    const destroyer = makePlayerCard({
      id: "optDestroyer",
      name: "optDestroyer",
      effect: { kind: "DestroyCardInHand", min: 0, max: 1 },
      energyCost: 0,
    });
    const companion = makePlayerCard({
      id: "companion",
      name: "companion",
      effect: { kind: "None" },
      canDestroy: false,
      energyCost: 0,
    });
    const state = makeState({ hand: [destroyer, companion], energy: 0, status: "playing" });

    const actions = enumerateActions(state, rngFromSeed(3));
    expect(actions.some((a) => a.type === "PlayCard" && a.cardId === "optDestroyer")).toBe(true);
    for (const a of actions) {
      expect(actionIsAdmitted(state, a), `${ser(a)} not admitted`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 1c. evalPolicyFactory K guard (REQ-SCC-6)
// ---------------------------------------------------------------------------

describe("evalPolicyFactory — K guard", () => {
  test("throws when K < 1 (zero, negative, NaN)", () => {
    expect(() => evalPolicyFactory(catalog, W, 0)).toThrow(/K must be >= 1/);
    expect(() => evalPolicyFactory(catalog, W, -1)).toThrow(/K must be >= 1/);
    expect(() => evalPolicyFactory(catalog, W, Number.NaN)).toThrow(/K must be >= 1/);
  });

  test("accepts K >= 1", () => {
    expect(() => evalPolicyFactory(catalog, W, 1)).not.toThrow();
    expect(() => evalPolicyFactory(catalog, W, 8)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. K behaviour
// ---------------------------------------------------------------------------

describe("eval policy — K behaviour", () => {
  test("deterministic for a fixed (view, rng-seed, K)", () => {
    const policy = evalPolicyFactory(catalog, W, 4);
    const view = midRunState(3);
    expect(view.status).toBe("playing");

    const first = policy(view, rngFromSeed(2024));
    const second = policy(view, rngFromSeed(2024));
    expect(ser(first)).toBe(ser(second));
  });

  test("K=1 vs K>1 can change the decision on some seed/state", () => {
    const policyK1 = evalPolicyFactory(catalog, W, 1);
    const policyK8 = evalPolicyFactory(catalog, W, 8);
    let found = false;

    outer: for (let base = 1; base <= 40; base++) {
      for (const view of trajectoryStates(base)) {
        for (let s = 0; s < 12; s++) {
          if (ser(policyK1(view, rngFromSeed(s))) !== ser(policyK8(view, rngFromSeed(s)))) {
            found = true;
            break outer;
          }
        }
      }
    }

    expect(found, "K=1 and K=8 never diverged across the search grid").toBe(true);
  });
});
