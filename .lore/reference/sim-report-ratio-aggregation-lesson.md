---
title: Aggregating Per-Run Ratios Needs a Deliberate Formula Choice
date: 2026-07-02
status: current
tags: [sim, completeness-checker, statistics, process-lesson]
fg-type: lesson
fg-sources: [.lore/work/notes/completeness-agent-performance-stats.md]
fg-status: current
fg-evidence:
  code:
    - src/sim/completeness.ts
---

# Aggregating Per-Run Ratios Needs a Deliberate Formula Choice

While building the completeness report's per-cohort efficiency section, two different rate metrics needed two different aggregation strategies, and the two are easy to conflate because both "average a rate across runs."

**Median-of-per-run-ratio** was used for actions-per-completed-turn and unused-energy-per-`EndTurn`: compute the ratio within each run first, then take the median across runs. This keeps a single high-opportunity run (e.g. one long game with many turns) from dominating what's meant to be a "typical run looks like this" statistic.

**Aggregate sum-over-sum** was used for no-progress rate and positive-unused-energy rate: sum the numerator and denominator across every run first, then divide once. This treats every comparable opportunity (every `EndTurn` across the whole cohort) equally regardless of which run produced it, which is what "rate of X happening" means when X is a per-opportunity event rather than a per-run summary.

Both formulas produce a plausible-looking number if swapped — there's no type error, crash, or obviously wrong output to catch the mistake by inspection. The distinction only surfaced because a fresh-context review checked each report line against its documented intended formula rather than trusting that "it's a rate, so it's an average" was specific enough. Any future report metric that averages a per-run ratio should decide explicitly which of the two it means before writing the aggregation code, and say so in a comment or the governing spec if the choice isn't obvious from the metric's name.
