/**
 * Honest, eval-driven policy for the sim agent.
 *
 * Unlike the card-name-steered `pickAction`, this policy chooses purely by
 * lookahead: it enumerates the legal actions (name-free, via `enumerateActions`)
 * and scores each by applying it to a determinized snapshot and running the
 * survival `evaluate`. It then takes the deterministic argmax.
 *
 * HONESTY (REQ-SCC-2): the returned Policy reads ONLY the `view` it is handed
 * and its own `rng`. It never closes over or imports the runner's committed
 * ("real") state. The captured `catalog`, `weights`, and `K` are configuration,
 * not ground truth, so capturing them does not let the agent cheat. Every
 * candidate is rolled out against `determinize(view, ...)` — the same honest
 * snapshot a human-equivalent planner would see.
 *
 * NO CARD NAMES (REQ-SCC-4): this module never matches card names. Action
 * selection is entirely score-driven; the only signals come from `evaluate`,
 * which itself reads structured state only.
 */
import type { Action, GameState, RngState } from "../core/model/types";
import type { CardCatalog } from "../core/model/catalog";
import { createRng } from "../core/engine/rng";
import { reduce } from "../core/engine/reduce";
import { determinize } from "./determinize";
import { enumerateActions, type Policy } from "./policy";
import { evaluate, type EvalWeights } from "./eval";

/**
 * Build an eval-driven {@link Policy}. The closure captures the `catalog` (so it
 * can `reduce` candidate actions), the survival `weights`, and `K`, the number
 * of determinizations averaged per candidate.
 *
 * `K` must be >= 1 (REQ-SCC-6): the per-candidate score is `acc / K`, so a
 * `K < 1` (including 0 or `NaN`) would divide by zero and produce `NaN` scores,
 * silently collapsing the argmax to the first candidate with no signal (and the
 * project has a documented NaN-through-JSON hazard). This is enforced at factory
 * construction time so the failure is loud and immediate, not a silent runtime
 * degradation. The `!(K >= 1)` form also rejects `NaN`.
 */
export function evalPolicyFactory(
  catalog: CardCatalog,
  weights: EvalWeights,
  kCount: number,
): Policy {
  if (!(kCount >= 1)) {
    throw new RangeError(
      `evalPolicyFactory: K must be >= 1 (got ${kCount}); ` +
        "score is acc / K, so K < 1 yields NaN scores(REQ - SCC - 6).",
    );
  }
  return (view: GameState, rng: () => number): Action => {
    // Boon-pending: a boon resolves deterministically (no hidden-zone draw), so
    // a single evaluation per option is exact — K-sampling would only repeat the
    // same result. Apply each offered boon to the view and keep the best
    // (REQ-SCC-7). Deterministic tiebreak: strict `>` keeps the first option in
    // offered order.
    const pendingBoon = view.pendingBoonChoices[0];
    if (pendingBoon !== undefined) {
      // offeredTemplateIds is non-empty whenever a boon choice is pending; the
      // `!` covers the indexed-access type, not a real empty case.
      let bestBoon: Action = { type: "ChooseBoon", templateId: pendingBoon.offeredTemplateIds[0]! };
      let bestBoonScore = -Infinity;
      for (const templateId of pendingBoon.offeredTemplateIds) {
        const action: Action = { type: "ChooseBoon", templateId };
        const score = evaluate(reduce(catalog, view, action).state, weights);
        if (score > bestBoonScore) {
          bestBoonScore = score;
          bestBoon = action;
        }
      }
      return bestBoon;
    }

    const candidates = enumerateActions(view, rng);
    if (candidates.length === 0) {
      // Mirror pickAction's safe fallback for a state with no enumerable action.
      return { type: "EndTurn" };
    }

    // Derive one RngState for this whole decision from the policy rng, mirroring
    // run.ts's float->seed bridge (Math.floor(x * 0x100000000)). Threading this
    // single state forward across ALL K samples of ALL candidates is what makes
    // the determinizations differ; reseeding per sample would make them
    // identical and collapse the average.
    let rngState: RngState = createRng(Math.floor(rng() * 0x100000000));

    let best: Action = candidates[0]!; // candidates is non-empty (checked above).
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const kSet = [];
      for (let k = 0; k < kCount; k++) {
        const [det, nextRng] = determinize(view, rngState);
        rngState = nextRng;
        kSet.push(evaluate(reduce(catalog, det, candidate).state, weights));
      }
      const mSet = kSet.slice(0, Math.ceil(kSet.length / 2));
      const score = mSet.length > 0 ? mSet.reduce((sum, e) => sum + e, 0) / mSet.length : 0;
      // Deterministic tiebreak: strict `>` keeps the FIRST candidate in
      // enumeration order when scores tie.
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  };
}
