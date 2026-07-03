---
title: Sim Statistics Helpers (src/sim/statistics.ts)
date: 2026-07-02
status: current
tags: [sim, statistics, wilson-interval, percentile, architecture]
fg-type: architecture
fg-sources: [.lore/work/plans/completeness-agent-performance-stats.md, .lore/work/notes/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/statistics.ts
    - src/sim/completeness.ts
  symbols:
    - nearestRankPercentile
    - median
    - p90
    - wilsonInterval
---

# Sim Statistics Helpers (src/sim/statistics.ts)

`src/sim/statistics.ts` is the project's first reusable statistics module — before it was added, no percentile, confidence-interval, or cohort-comparison helpers existed anywhere in `src/`. It holds four small, pure, domain-agnostic functions: `nearestRankPercentile`, `median`, `p90`, and `wilsonInterval`. None of them know about sim, cards, or worlds; they operate on plain numeric arrays and counts.

## What they're used for

`src/sim/completeness.ts` uses the percentile helpers to report median and p90 turn counts split by disposition (win vs. loss) per world cohort, using nearest-rank percentiles over integer observations rather than interpolation. `wilsonInterval` computes a 95% confidence interval displayed beside each cohort's win rate.

## Display-only boundary

The Wilson interval is informational only. The completeness checker's `[FLAGGED]` decision always compares the raw point estimate `wins / games` against the configured threshold — the interval is never substituted into that comparison, even though it's computed from the same win/loss counts and displayed on the same line. This keeps the flag semantics exactly what they were before the interval was added: changing flag semantics was explicitly out of scope for the plan that introduced Wilson intervals.

`n === 0` renders `(none)` rather than a numeric interval or percentile, consistent with how the rest of the completeness report handles empty outcome buckets.
