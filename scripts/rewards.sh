#!/bin/bash

jq '[.cardTemplates | to_entries[]
  | select(.value.onCleared.kind == "GainCard")
  | {
    owner: .key,
    ownerRarity: .value.rarity,
    rewardId: .value.onCleared.template
  }
]
| group_by(.rewardId)
| map({
  rewardId: .[0].rewardId,
  givenBy: [.[] | {owner, ownerRarity}]
})' src/data/allCards.json

