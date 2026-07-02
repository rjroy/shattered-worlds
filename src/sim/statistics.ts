/**
 * Pure statistical helpers for the completeness report (step 5 of the
 * "completeness agent performance stats" plan): nearest-rank percentiles and a
 * 95% Wilson score interval. These know nothing about `GameState`, cohorts, or
 * play-outs — they operate on plain number arrays and success/n counts so they
 * can be unit tested in isolation from the aggregator, and so `completeness.ts`
 * can stay focused on cohort shape and report formatting.
 */

/** 95% two-sided z-score, used by {@link wilsonInterval}. */
const WILSON_Z_95 = 1.959964;

/**
 * Nearest-rank percentile over an ALREADY-SORTED-ASCENDING array. `p` is in
 * `(0, 100]`. `index = ceil((p / 100) * n)`, clamped to `[1, n]`; the result is
 * `sortedAscending[index - 1]`.
 *
 * Returns `undefined` when `n === 0` — there is no percentile of an empty
 * sample, and callers render that as `(none)` rather than a numeric fallback.
 * For `n === 1` the clamp always resolves `index` to `1`, so the single value
 * is returned for any `p`.
 */
export function nearestRankPercentile(sortedAscending: number[], p: number): number | undefined {
  const n = sortedAscending.length;
  if (n === 0) return undefined;
  const index = Math.min(n, Math.max(1, Math.ceil((p / 100) * n)));
  return sortedAscending[index - 1];
}

/** Sorts a COPY of `values` ascending; never mutates the caller's array. */
function sortedCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Nearest-rank median (p50) over `values`, sorting a copy first. */
export function median(values: number[]): number | undefined {
  return nearestRankPercentile(sortedCopy(values), 50);
}

/** Nearest-rank 90th percentile over `values`, sorting a copy first. */
export function p90(values: number[]): number | undefined {
  return nearestRankPercentile(sortedCopy(values), 90);
}

export interface WilsonInterval {
  lower: number;
  upper: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * 95% Wilson score interval for `successes` out of `n` trials. Returns
 * `undefined` when `n === 0` (callers render `(none)`, never a numeric
 * interval for an empty sample). Endpoints are clamped to `[0, 1]`: the
 * closed-form formula can push a fraction of a ULP outside that range at the
 * extremes (e.g. `successes === n`).
 *
 * This is a DISPLAY-ONLY uncertainty band. It never changes the point-estimate
 * `wins / games` used for the `[FLAGGED]` threshold comparison elsewhere in
 * this module.
 */
export function wilsonInterval(successes: number, n: number): WilsonInterval | undefined {
  if (n === 0) return undefined;
  const z = WILSON_Z_95;
  const z2 = z * z;
  const phat = successes / n;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const halfWidth = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / denom;
  return {
    lower: clamp01(center - halfWidth),
    upper: clamp01(center + halfWidth),
  };
}
