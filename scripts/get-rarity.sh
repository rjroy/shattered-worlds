#!/bin/bash

jq '.cardTemplates | to_entries
  | group_by(.value.rarity)
  | map({
    rarity: .[0].value.rarity,
    cards: [.[].key]
  })' src/data/allCards.json

