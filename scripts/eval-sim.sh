#!/bin/bash

bun run sim:complete -- "$@" > sim-results.json

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
  ' sim-results.json
