---
title: "Card design: answers (World 14)"
date: 2026-07-04
status: draft
tags: [world, walker-narrative, grief-arc, bargaining, depression, destiny-entity, keyword-cost-modifiers, concede, card-design]
modules: [data-worlds]
related:
  - .lore/work/specs/answers.md
  - .lore/work/design/questions-card-design.md
  - .lore/work/plans/answers.md
---

# Card design: answers (World 14)

The spec (`.lore/work/specs/answers.md`) deliberately deferred concrete card templates, exact numbers, and deck counts to "an explicit authoring pass to follow" (see its Scope note and Open Questions), matching `questions.md`'s scope discipline. This document is that pass — every world/reward card template below is ready to drop into `src/data/allCards.json`, and the deck composition is ready for `src/data/worlds/answers/cards.json`.

**Calibration source:** every cost, keyword-apply value, and deck-slot count below is matched against shipped precedent, primarily `questions-card-design.md` (World 13's own authoring pass), since Bargaining/Depression are structurally the same "grief-keyword pair taxing a shared Destiny entity" shape as Denial/Anger. Where a number or structural choice diverges from World 13's precedent, the reasoning is called out inline.

## Decision superseding REQ-W14-12/13 (confirmed with user during plan-prep, 2026-07-04)

**This is a deviation from the ratified spec text, not an implementation detail — read this before the Act 3 section.**

REQ-W14-12/13 originally called for a *new* `Destiny` card template authored specifically for this world (`Depression:2`, `onCleared: { "kind": "None" }`). During plan-prep, a code-level constraint surfaced: `CardTemplateId` is a plain string used as the `cardTemplates` map key, template ids are globally unique (duplicate ids throw in `buildWorld`), and World 13 already claimed the literal key `"Destiny"` for its own card (`src/data/allCards.json`, authored `["Denial:2"]`, `onCleared: { "kind": "ExileTopWorldCards", "amount": 3 }`).

Presented with that constraint, the user's resolved decision was **not** to author a second, differently-keyed Destiny-flavored template, but to literally reuse World 13's existing `"Destiny"` card entity — same template, unchanged — in World 14's own Act 3 deck composition. This reframes `Destiny` from "a recurring narrative concept each world reskins" into "a single persistent entity, mechanically identical, that follows the Walker between worlds." Concretely, this changes what `Destiny` does in `answers` relative to what the spec described:

- Its authored keyword stays `Denial:2` (not `Depression:2`). `Denial`'s `ClearCostPerSelfKeyword` modifier still applies to it in this world exactly as it did in World 13, because `KEYWORD_COST_MODIFIERS` is global and doesn't check `worldId`.
- Its cost *also* now picks up `answers`' own `Bargaining` tax for free: `ClearCostPerOtherKeyword` reads the summed `Bargaining` value on every *other* card in the current hand, regardless of what `Destiny` itself carries, so any Bargaining-carrying card elsewhere in hand still raises Destiny's cost. `Depression`'s self-tax, however, does **not** apply to Destiny in this world, since Destiny carries no authored `Depression` value here.
- Its `onCleared` stays `ExileTopWorldCards{amount:3}` (not `{kind:"None"}` as REQ-W14-13 specified) — clearing it in `answers` has the same dramatic, permanent texture it had in `questions`, not the flatter "just marks that the Walker picked it up" texture the spec called for.

**Upside this unlocks, not just a constraint worked around:** because `Destiny` is now the same template `AddThreatToWorldDeck` can resolve to (see the `WORLD_THREAT_BY_WORLD_ID` fix in the implementation plan's Slice 1), an Act 1 hazard can use `AddThreatToWorldDeck` to seed a real, uncleared copy of `Destiny` into the world deck early — mechanically realizing REQ-W14-5's "glimpsed via lore in Act I, it becomes the thing carried onward by Act III" as an actual card the player sees early, can't yet afford to deal with, and which persists into Act 3. This is a stronger, less abstract version of the beat than a wholly separate lore/hazard card would have given.

**Consequence to flag explicitly:** REQ-W14-9's AI-validation-style claim ("`Destiny`'s effective cost... equals `baseCost + 2*costPer(Depression) + 3*costPer(Bargaining)`") no longer holds as written — replace with `baseCost + 2*costPer(Denial) + costPer(Bargaining)*sum(other Bargaining in hand)`, since Denial (not Depression) is Destiny's authored keyword in every world it appears. The plan's validation step must test the corrected formula, not the spec's original one.

`answers.md`'s own text is not edited by this document — the plan and its validation gate carry this correction forward; a documentation-fix step (mirroring how World 13's plan corrected stale citations) should note this superseding decision in the world's own help text and in `theme-authoring.md`'s narrative note, so a future reader isn't confused by the spec/plan mismatch.

## World cards (`src/data/allCards.json` → `cardTemplates`)

All templates below define all five hooks explicitly (`{ "kind": "None" }` where empty), per C3.

### Act 1 — Bargaining

```json
"The Ledger Never Closes": {
  "kind": "world",
  "name": "The Ledger Never Closes",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Bargaining", "value": 2, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Bargaining",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ForceDestroy", "amount": 1 }
  }
},
"A Broker Who Owes Nothing": {
  "kind": "world",
  "name": "A Broker Who Owes Nothing",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Call In The Favor" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Bargaining", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"What Would You Give Up": {
  "kind": "world",
  "name": "What Would You Give Up",
  "rarity": "uncommon",
  "cost": 3,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": {
    "kind": "Modal",
    "branches": [
      { "kind": "DestroyCardInHand", "min": 1, "max": 1 },
      { "kind": "Damage", "amount": 2 }
    ]
  },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
},
"The Archive Has a Price": {
  "kind": "world",
  "name": "The Archive Has a Price",
  "rarity": "common",
  "cost": 2,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "AddPlayerCardToTop", "template": "A Page From the Ledger" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
},
"A Deal Too Easy": {
  "kind": "world",
  "name": "A Deal Too Easy",
  "rarity": "common",
  "cost": 2,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "AddThreatToWorldDeck" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
},
"A Reading of the Ledger": {
  "kind": "world",
  "name": "A Reading of the Ledger",
  "rarity": "uncommon",
  "cost": 2,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": {
    "kind": "OfferBoon",
    "setId": "pool-ledger-reading",
    "setName": "A Reading of the Ledger",
    "offeredCount": 2,
    "chooseCount": 1
  },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `The Ledger Never Closes` is the Act 1 signature Bargaining threat — self-applies `Bargaining:2` on draw (strippable), escalates to `ForceDestroy` once hand-wide `Bargaining` value reaches 2 (`KeywordGate` sums *value* across the zone, not card count — so this card alone satisfies the gate the turn it's drawn, no second Bargaining-carrying card required). Directly mirrors `Everyone Says It's Nothing`'s shape (REQ-W14-8a: applied, not authored, so it stays strippable).
- `A Broker Who Owes Nothing` is the Obstructed tool-fetch (first half of REQ-W14-19): clearing it grants `Call In The Favor`, the Bargaining-strip reward.
- `What Would You Give Up` is REQ-W14-16's required `Modal` card literalizing "what would you give up": clearing it forces a genuine branch, destroy a card from hand *or* take 2 direct damage. Deliberately carries no Bargaining/Depression itself — it's the recipe's dedicated "genuine choice" card, not a keyword vector.
- `The Archive Has a Price` satisfies REQ-W14-16's "hazard whose `onCleared` uses `AddPlayerCardToTop` to queue a Destiny-lore card onto the very next draw" — queues `A Page From the Ledger` (see Reward Player Cards).
- `A Deal Too Easy` satisfies REQ-W14-16's `AddThreatToWorldDeck` requirement. Once `WORLD_THREAT_BY_WORLD_ID["answers"]` is wired to `"Destiny"` (see the implementation plan's Slice 1), clearing this card seeds an early, uncleared copy of `Destiny` into the world deck — see the superseding-decision section above for why this is the mechanism realizing REQ-W14-5's "glimpsed in Act I, carried into Act III."
- `A Reading of the Ledger` is REQ-W14-15's `OfferBoon` reflavor: a genuine choice (not a trap) between two Destiny-adjacent boons, drawn from a new pool `pool-ledger-reading` (see Deck Composition / new pool section below).

### Act 2 — the Door (concept)

```json
"A Fracture Opens": {
  "kind": "world",
  "name": "A Fracture Opens",
  "rarity": "common",
  "cost": 3,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": {
    "kind": "Sequence",
    "steps": [
      { "kind": "AddWorldCardToDeck", "template": "Another Fracture", "bTop": true },
      { "kind": "DestroySelf" }
    ]
  }
},
"Another Fracture": {
  "kind": "world",
  "name": "Another Fracture",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "ForceDestroy", "amount": 1 }
},
"The Point of No Return": {
  "kind": "world",
  "name": "The Point of No Return",
  "rarity": "uncommon",
  "cost": 3,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "ExileTopWorldCards", "amount": 2 },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `A Fracture Opens` → `Another Fracture` is the Self-Transform Pattern (REQ-W14-17): `AddWorldCardToDeck{bTop:true}` then `DestroySelf`, never `ReturnWorldCards` (inert on world auto-hooks). Literalizes "eleven violet fractures hanging suspended" — each fracture left alone spawns a heavier one.
- `The Point of No Return` foreshadows Act III's commitment via a smaller `ExileTopWorldCards{amount:2}` — smaller than `Destiny`'s own `amount:3`, so the real commitment still reads as the bigger moment.
- Neither card carries `Bargaining` or `Depression` — Act 2 is deliberately keyword-free per REQ-W14-17, carrying the beat through accumulating hazard pressure and visibility, not tax.

### Act 3 — Depression

```json
"The Weight Doesn't Lift": {
  "kind": "world",
  "name": "The Weight Doesn't Lift",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Depression", "value": 1, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Depression",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ForceDestroy", "amount": 1 }
  }
},
"It Won't Go Away": {
  "kind": "world",
  "name": "It Won't Go Away",
  "rarity": "common",
  "cost": 2,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": {
    "kind": "Sequence",
    "steps": [
      { "kind": "AddWorldCardToDeck", "template": "It Calcified", "bTop": true },
      { "kind": "DestroySelf" }
    ]
  }
},
"It Calcified": {
  "kind": "world",
  "name": "It Calcified",
  "rarity": "rare",
  "cost": 5,
  "keywords": ["Depression:2"],
  "discardable": false,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "ForceDestroy", "amount": 1 }
},
"A Reason to Keep Moving": {
  "kind": "world",
  "name": "A Reason to Keep Moving",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Let It Sit" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Depression", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"Just Keep Walking": {
  "kind": "world",
  "name": "Just Keep Walking",
  "rarity": "common",
  "cost": 2,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Keep Walking" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `The Weight Doesn't Lift` is the Act 3 signature Depression threat — self-applies `Depression:1` on draw, escalates to `ForceDestroy` only once hand-wide `Depression` value reaches 2 (unlike `The Ledger Never Closes` above, this card's own value of 1 is *not* enough alone — it genuinely needs a second Depression-carrying card in hand, e.g. `A Reason to Keep Moving` below, also applying `Depression:1`). Deliberately **no** spread-to-other-cards step (unlike `It Isn't Fair`'s Anger-spreading escalation) — per REQ-W14-6, Depression's shape must stay the plainest self-tax, not competing for anything. The signature card and its tool-fetch both applying value `1` (rather than differentiating them the way Denial's signature card used `2` against its tool-fetch's `1`) is an intentional simplification, not an oversight — flag for confirmation during tuning if it plays too slow to trigger.
- `It Won't Go Away` → `It Calcified` is Depression's Self-Transform pair, mirroring `She Says She's Fine` → `He Isn't Coming Back` exactly: the escalated card authors `Depression:2` statically, is `discardable:false`, and is deliberately uncounterable by the Depression-strip reward (REQ-W14-8a's authored/applied asymmetry).
- `A Reason to Keep Moving` is Act 3's Obstructed tool-fetch (second half of REQ-W14-19): grants `Let It Sit`, the Depression-strip reward.
- `Just Keep Walking` grants `Keep Walking`, the `Brace`-as-endurance reward (REQ-W14-18).
- `Destiny` (reused, unmodified from World 13 — see superseding-decision section above) and the fixed `{ "templateId": "The Walker", "count": 1 }` closer are referenced only in deck composition, never redefined here (REQ-W14-2).

## Reward player cards (`src/data/allCards.json` → `cardTemplates`)

```json
"Call In The Favor": {
  "kind": "player",
  "name": "Call In The Favor",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Bargaining", "target": "hand", "amount": 2 }
    ]
  }
},
"A Page From the Ledger": {
  "kind": "player",
  "name": "A Page From the Ledger",
  "rarity": "common",
  "energyCost": 1,
  "effect": { "kind": "DealProgress", "base": 1 }
},
"Ask For More Time": {
  "kind": "player",
  "name": "Ask For More Time",
  "rarity": "common",
  "energyCost": 1,
  "effect": { "kind": "Heal", "amount": 2 }
},
"Take What's Owed": {
  "kind": "player",
  "name": "Take What's Owed",
  "rarity": "common",
  "energyCost": 1,
  "effect": { "kind": "DealProgress", "base": 3 }
},
"Let It Sit": {
  "kind": "player",
  "name": "Let It Sit",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Depression", "target": "hand", "amount": 2 }
    ]
  }
},
"Keep Walking": {
  "kind": "player",
  "name": "Keep Walking",
  "rarity": "common",
  "energyCost": 1,
  "effect": { "kind": "Brace", "amount": 1 }
},
"Let It Go": {
  "kind": "player",
  "name": "Let It Go",
  "rarity": "uncommon",
  "energyCost": 1,
  "effect": { "kind": "DiscardThenDraw", "player": 1 }
}
```

- `Call In The Favor` / `Let It Sit` are REQ-W14-14's two central reward candidates, now settled: `RemoveKeyword` amount 2 matches World 13's `Ask The Question`/`Let It Out` exactly, paired with the same small `DealProgress` shape.
- `A Page From the Ledger` is the lore-delivery card queued by `The Archive Has a Price` (REQ-W14-16) — deliberately minor mechanically; its purpose is the "libraries on death" glimpse, not a strong reward.
- `Ask For More Time` / `Take What's Owed` are the two boons in the new `pool-ledger-reading` set (REQ-W14-15) — a real choice between relief (`Heal`) and immediate payoff (`DealProgress`), both reading as "Destiny-adjacent" without either being a trap.
- `Keep Walking` is REQ-W14-18's `Brace`-as-endurance reward — same shape as every other world's `Brace` reward cards, reframed narratively only.
- `Let It Go` is REQ-W14-18's `DiscardThenDraw` "let go and keep moving" reward — cycling, not resolving, matching "the best you can do is not die."

## New boon pool (`src/data/boonPools.json`)

```json
"pool-ledger-reading": ["Ask For More Time", "Take What's Owed"]
```

Two-entry pool matching `offeredCount: 2, chooseCount: 1` on `A Reading of the Ledger` — every pool member is always offered, guaranteeing the "real option, not a trap" framing REQ-W14-15 calls for (no dilution from a larger pool where a weak boon could get buried in with two strong ones).

## Deck composition (`src/data/worlds/answers/cards.json`)

```json
{
  "worldId": "answers",
  "deckComposition": {
    "acts": [
      {
        "cards": [
          { "templateId": "The Ledger Never Closes", "count": 2 },
          { "templateId": "A Broker Who Owes Nothing", "count": 1 },
          { "templateId": "What Would You Give Up", "count": 2 },
          { "templateId": "The Archive Has a Price", "count": 1 },
          { "templateId": "A Deal Too Easy", "count": 1 },
          { "templateId": "A Reading of the Ledger", "count": 1 }
        ]
      },
      {
        "cards": [
          { "templateId": "A Fracture Opens", "count": 2 },
          { "templateId": "Another Fracture", "count": 2 },
          { "templateId": "The Point of No Return", "count": 2 }
        ]
      },
      {
        "cards": [
          { "templateId": "The Weight Doesn't Lift", "count": 2 },
          { "templateId": "It Won't Go Away", "count": 1 },
          { "templateId": "It Calcified", "count": 1 },
          { "templateId": "A Reason to Keep Moving", "count": 2 },
          { "templateId": "Just Keep Walking", "count": 1 },
          { "templateId": "Destiny", "count": 1 },
          { "templateId": "The Walker", "count": 1 }
        ]
      }
    ]
  }
}
```

Act 1: 8 cards, heaviest on genuine branching (two copies of the Modal `What Would You Give Up`, plus the boon-choice `A Reading of the Ledger`) — matches REQ-W14-20's "Act I heaviest on genuine branching choices." Act 2: 6 cards, moderate — matches "doesn't need volume, it needs visibility." Act 3: 9 cards, heaviest of the three — matches "Act III heavier on Depression-carrying cards as the weight settles in," including the reused `Destiny` and the fixed `The Walker` closer (REQ-W14-21).

## Open items this pass did not resolve

- These are still placeholders per the spec's own Open Questions, not settled by this pass: final `worldId`/title (`answers`), the `concede` signature verb name, and whether `costPer` should differ from `1` (chosen only because it matches every existing `KEYWORD_COST_MODIFIERS` entry).
- **The Destiny-reuse decision above is a real deviation from the ratified spec text (REQ-W14-12/13), confirmed with the user during plan-prep rather than left as an authoring-pass judgment call.** Flag this prominently to whoever reviews the plan — it's a bigger decision than a card-design numbers pass would normally make unilaterally.
- Rarity weights and exact costs haven't been checked against `sim/` balance tooling — recommend a `bun run sim` pass once authored, same recommendation `questions-card-design.md` made for World 13.
- Whether the Act 1 `A Deal Too Easy` → early-`Destiny` mechanic reads clearly to a player (an uncleared `Destiny` sitting in the world deck for two acts before its "real" Act 3 appearance) is untested; flag for manual playtest once implemented.
