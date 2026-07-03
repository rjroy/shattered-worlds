---
title: "Simplify notes: completeness agent performance stats"
date: 2026-07-02
status: complete
tags: [simplify, sim, completeness, eval, playout, statistics]
source: .lore/work/plans/completeness-agent-performance-stats.md
modules: [sim]
---

# Simplify notes: completeness agent performance stats

Ran `/simplify` on the four files touched by the just-completed `completeness-agent-performance-stats` plan implementation: `src/sim/eval.ts`, `src/sim/playOut.ts`, `src/sim/completeness.ts`, `src/sim/statistics.ts`.

## What was simplified

- **`src/sim/eval.ts`**: extracted `countWorldCardsRemaining(state)`, deduplicating an identical inline computation (world draw pile + unshuffled acts + world cards in hand) that had been written separately in `measureEvalAxes` (producing `worldCardsRemaining`) and `forwardProgress`. Removes a formula-drift risk between the scoring axis and the anti-stall signal.
- **`src/sim/completeness.ts`**: extracted `resolveNumber(argv, env, fallback, parse)` shared by `resolveInt`/`resolveFloat` (previously two near-identical 6-line functions); extracted `winRateOf(cohort)` shared by the per-world `[FLAGGED]` decision and the summary `Flagged worlds: N/M` count (previously each had its own inline `games > 0 ? wins/games : 0`), removing the risk of the two drifting apart.
- **`src/sim/playOut.ts`**: flattened `state.status === "won" ? "won" : state.status === "lost" ? "lost" : "capped"` into `state.status === "playing" ? "capped" : state.status`, backed by a comment noting the dependency on `GameState["status"]` being exactly `"playing" | "won" | "lost"`.
- **`src/sim/statistics.ts`**: reviewed, left unchanged — already minimal (77 lines, no redundancy).

No formulas, thresholds, weights, or report text were changed. No file exceeds the ~800-line size heuristic (`completeness.ts` is the largest at ~675 lines); no function exceeds ~100 lines.

## Verification

- `bun run test src/sim`: 81 pass, 1 skip, 0 fail. `bun run test` (full suite): 1477 pass, 2 skip, 0 fail. `bun run typecheck`, `bun run lint`: clean.
- Manual report-shape spot-check (`bun run sim:complete 3 2 12345 0.02`): all 12 worlds, coherent Baseline/Recovery sections, `(none)` renders 39 times where expected, no `NaN`/`undefined` anywhere.
- Fresh-context review confirmed all three extractions are algebraically identical to their originals: `countWorldCardsRemaining`'s three terms/order match both prior inline computations; `resolveNumber` preserves argv > env > fallback precedence and `resolveInt`'s radix-10 parsing; `winRateOf` is called with `agg.baseline` at both call sites (baseline remains the sole `[FLAGGED]` source per the parent plan's REQ-SCC-10 requirement), and the zero-games fallback (`0`, not `(none)`/`NaN`) is preserved exactly.
- One non-bug observation from the reviewer: comparing against `HEAD` shows a much larger diff than "three extractions" because nothing from the parent implementation plan has been committed yet this session — the reviewer independently traced the full `measureEvalAxes` consolidation (four axis functions merged into one) against the pre-plan originals and confirmed `evaluate()`'s output is provably unaffected. Not a defect, just a framing note for whoever reviews the eventual commit.

## Outcome

No failures, no escalations. Both the cleanup pass and the independent fresh-context review found zero behavior-changing defects.
