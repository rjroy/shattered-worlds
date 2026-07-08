#!/bin/bash

# if tmp dir is missing create
if [ ! -d "tmp" ]; then
    mkdir tmp
fi

bun run sim:complete -- "$@" > tmp/sim-results.json

echo "ID  | Base Wins  | Recovery Wins  | Flagged"
echo "--- | ---------- | -------------- | --------"

# .recoveries is an array (one cohort per recovery unlock set); render one
# percentage per set, in declaration order, joined with " / ".
jq -r '
    .worlds |
    sort_by(
        .baseline.wins + (([.recoveries[] | .wins]) | min)
    ) |
    .[] |
    [
      .id,
      "\((.baseline.wins / .baseline.games * 100) | round)%",
      ([.recoveries[] | "\((.wins / .games * 100) | round)%"] | join(" / ")),
      (.flagged | tostring)
    ] | join(" | ")
  ' tmp/sim-results.json
