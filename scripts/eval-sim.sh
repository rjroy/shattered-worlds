#!/bin/bash

# if tmp dir is missing create
if [ ! -d "tmp" ]; then
    mkdir tmp
fi

bun run sim:complete -- "$@" > tmp/sim-results.json

echo "ID  | Base Wins  | Recovery Wins  | Flagged"
echo "--- | ---------- | -------------- | --------"

jq -r '
    .worlds[] |
    [
      .id,
      "\((.baseline.wins / .baseline.games * 100) | round)%",
      "\((.recovery.wins / .recovery.games * 100) | round)%",
      .flagged
    ] | join(" | ")
  ' tmp/sim-results.json
