#!/bin/bash

# Reads the sim results produced by eval-sim.sh (tmp/sim-results.json) and
# averages win rate per cohort (baseline, then each recovery set in
# declaration order) across all worlds. Run eval-sim.sh first.

if [ ! -f "tmp/sim-results.json" ]; then
    echo "tmp/sim-results.json not found. Run scripts/eval-sim.sh first." >&2
    exit 1
fi

echo "Cohort      | Pooled Win %  | Mean-of-Worlds Win %"
echo "----------- | ------------- | ---------------------"

# Pooled: sum wins / sum games across worlds.
# Mean-of-worlds: average of each world's own win percentage.
jq -r '
    .worlds as $w |
    ($w[0].recoveries | length) as $n |
    def cohortStats(wins; games):
      { wins: ($w | map(wins) | add),
        games: ($w | map(games) | add),
        meanPct: ($w | map((wins / games) * 100) | add / length) };
    ( [ cohortStats(.baseline.wins; .baseline.games) + {label: "Baseline"} ]
      + ( [range(0; $n)] | map(
          . as $i | cohortStats(.recoveries[$i].wins; .recoveries[$i].games)
            + {label: "Recovery \($i)"}
        ) )
    )[] |
    [.label, "\((.wins / .games * 100) | round)%", "\(.meanPct | round)%"] | join(" | ")
  ' tmp/sim-results.json
