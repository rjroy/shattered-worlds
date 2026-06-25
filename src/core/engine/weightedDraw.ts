import type { CardCatalog } from "../model/catalog";
import type { CardTemplateId, RngState } from "../model/types";
import { RARITY_ORDER, RARITY_WEIGHTS, type RarityTier } from "../model/rarity";
import { nextFloat } from "./rng";

// ---------------------------------------------------------------------------
// filterLegalPlayerCandidates
// ---------------------------------------------------------------------------

/**
 * Deduplicate `templateIds` and keep only the ones that resolve to a
 * `"player"`-kind card in `catalog` — the legality pre-filter `weightedDraw`
 * requires of every caller (REQ-RARITY-19). Shared by `createBoonOffer` and
 * `GainRandomCardHandler.apply` so the dedup-then-filter logic exists once.
 */
export function filterLegalPlayerCandidates(
  catalog: CardCatalog,
  templateIds: readonly CardTemplateId[],
): CardTemplateId[] {
  const legalIds: CardTemplateId[] = [];
  const seen = new Set<CardTemplateId>();
  for (const templateId of templateIds) {
    if (seen.has(templateId)) continue;
    seen.add(templateId);
    if (catalog[templateId]?.kind === "player") {
      legalIds.push(templateId);
    }
  }
  return legalIds;
}

// ---------------------------------------------------------------------------
// weightedDraw
// ---------------------------------------------------------------------------

/**
 * Draw `count` distinct templateIds from `candidateIds` without replacement,
 * weighted by rarity tier (RARITY_WEIGHTS, renormalized per-slot over only
 * the tiers still present among the remaining candidates).
 *
 * Per resolvable slot (i.e. at least one candidate remains):
 *   1. Group remaining candidates by `catalog[id].rarity ?? "common"`.
 *   2. Renormalize RARITY_WEIGHTS over the present tiers and roll ONE
 *      nextFloat, walking the cumulative weight in RARITY_ORDER to pick a
 *      tier.
 *   3. Roll a SECOND nextFloat and uniformly pick one candidate within that
 *      tier via `Math.floor(value * tierSize)`.
 *   4. Remove the picked id from the remaining pool; the next slot
 *      recomputes present tiers (a depleted tier drops out — no
 *      replacement).
 *
 * RNG advancement is fixed, not data-dependent: every resolvable slot
 * consumes EXACTLY two nextFloat calls, even when only one candidate
 * remains (the tier roll still happens; its outcome is just forced). This
 * is deliberate so callers can reason about RNG consumption without
 * inspecting the candidate pool. If `candidateIds` is empty there are zero
 * resolvable slots, but the RNG still advances by exactly one nextFloat
 * call as a guard so empty-pool callers don't silently skip RNG
 * consumption (REQ-RARITY-18).
 *
 * If `candidateIds.length < count`, all candidates are returned (in the
 * order this algorithm resolves them) and no error is raised.
 *
 * This kernel is rarity-only: it has no notion of exhaust/player-vs-world
 * legality. Callers must pre-filter `candidateIds` to only legal
 * candidates (REQ-RARITY-19).
 *
 * Precondition: `candidateIds` must already be deduplicated and
 * legality-filtered by the caller. Duplicate ids skew draw probability
 * rather than erroring, and ids missing from `catalog` are silently
 * treated as `"common"` rarity rather than throwing.
 */
export function weightedDraw(
  catalog: CardCatalog,
  rng: RngState,
  candidateIds: readonly CardTemplateId[],
  count: number,
  rarityBonus?: number,
): { templateIds: CardTemplateId[]; rng: RngState } {
  if (candidateIds.length === 0) {
    const [, next] = nextFloat(rng);
    return { templateIds: [], rng: next };
  }

  const remaining = [...candidateIds];
  const picked: CardTemplateId[] = [];
  let state = rng;

  const slots = Math.min(count, candidateIds.length);
  for (let slot = 0; slot < slots; slot++) {
    const tierToCandidates = new Map<RarityTier, CardTemplateId[]>();
    for (const id of remaining) {
      const tier = catalog[id]?.rarity ?? "common";
      const bucket = tierToCandidates.get(tier);
      if (bucket) {
        bucket.push(id);
      } else {
        tierToCandidates.set(tier, [id]);
      }
    }

    const presentTiers = RARITY_ORDER.filter((tier) => tierToCandidates.has(tier));
    const currRarityWeights = rarityBonus
      ? presentTiers.reduce(
          (curr: Record<RarityTier, number>, tier: RarityTier) => {
            if (!rarityBonus) return curr;
            curr[tier] += RARITY_ORDER.indexOf(tier) * rarityBonus;
            return curr;
          },
          { ...RARITY_WEIGHTS },
        )
      : RARITY_WEIGHTS;

    const totalWeight = presentTiers.reduce((sum, tier) => sum + currRarityWeights[tier], 0);

    const [tierRoll, afterTierRoll] = nextFloat(state);
    state = afterTierRoll;

    let cumulative = 0;
    let chosenTier: RarityTier = presentTiers[0]!;
    for (const tier of presentTiers) {
      cumulative += currRarityWeights[tier] / totalWeight;
      if (tierRoll < cumulative) {
        chosenTier = tier;
        break;
      }
      chosenTier = tier;
    }

    const tierCandidates = tierToCandidates.get(chosenTier)!;
    const [withinTierRoll, afterWithinTierRoll] = nextFloat(state);
    state = afterWithinTierRoll;

    const index = Math.min(
      tierCandidates.length - 1,
      Math.floor(withinTierRoll * tierCandidates.length),
    );
    const pickedId = tierCandidates[index]!;

    picked.push(pickedId);
    const removeAt = remaining.indexOf(pickedId);
    remaining.splice(removeAt, 1);
  }

  return { templateIds: picked, rng: state };
}
