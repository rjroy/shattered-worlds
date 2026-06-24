#!/bin/bash


for f in src/data/worlds/*/*.json; do
  jq '[.deckComposition.acts[].cards[]] | group_by(.templateId) | map({templateId: .[0].templateId, count: (map(.count)
  | add)}) | sort_by(-.count)' "$f"
done

