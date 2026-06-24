#!/bin/bash

echo "Total cost of unlocks:"
jq -r ' [ .[].cost ] | add ' src/data/unlocks/catalog.json
echo ""

echo "Total feat rewards:"
jq -r '[ .[] | .reward.items | .[].type="memoryFragments" | .[].amount ] | add ' src/data/feats/catalog.json

