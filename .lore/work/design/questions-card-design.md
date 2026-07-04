---
title: "Card design: questions (World 13)"
date: 2026-07-04
status: draft
tags: [world, walker-narrative, grief-arc, denial, anger, destiny-entity, keyword-cost-modifiers, compound, card-design]
modules: [data-worlds]
related:
  - .lore/work/specs/questions.md
  - .lore/work/plans/questions.md
---

# Card design: questions (World 13)

The spec (`.lore/work/specs/questions.md`) deliberately deferred concrete card templates, exact numbers, and deck counts to "an explicit authoring pass" (see its Scope note and Open Questions). This document is that pass — every world/reward card template below is ready to drop into `src/data/allCards.json`, and the deck composition is ready for `src/data/worlds/questions/cards.json`.

**Calibration source:** every cost, keyword-apply value, `ForceDestroy`/`ExileTopWorldCards` amount, and deck-slot count below is matched against shipped precedent — Eden Prime (`Alarm`, `ClearCostPerKeywordCount`), New Derelict (`Lockdown`, `ClearCostPerSelfKeyword`), and Transit Authority (`Reroute`). Nothing here is invented from scratch; where a number diverges from precedent (Destiny's `ExileTopWorldCards` amount, notably), the reasoning is called out inline.

**One design decision this pass had to resolve that the spec left implicit:** whether Act 2/3's `Denial`/`Anger` are authored statically (`"Denial:2"` in a card's `keywords` array) or gained at runtime (`ApplyKeyword`). This matters because `RemoveKeyword` only strips runtime-*applied* keywords, never authored/static ones (see `[[world-authoring-engine-gotchas]]` finding #3). REQ-W13-19 requires tool-fetch cards to grant a working `RemoveKeyword` counter — so any card meant to be countered must gain its keyword via `ApplyKeyword`, not carry it statically. The one deliberate exception is `Destiny` itself and the escalated self-transform card `He Isn't Coming Back`: both author `Denial:2` statically and are treated as intentionally uncounterable by the Denial-strip reward, which is the mechanical expression of "some avoidance calcifies past the point a single tool clears it." Every other Denial/Anger-bearing card below gains its keyword via `ApplyKeyword{target:"self"}` on `onDraw`, making it strippable.

## World cards (`src/data/allCards.json` → `cardTemplates`)

All templates below define all five hooks explicitly (`{ "kind": "None" }` where empty), per C3.

### Act 1 — Loss, fear, helplessness (no Denial/Anger yet)

```json
"Waiting Room Silence": {
  "kind": "world",
  "name": "Waiting Room Silence",
  "rarity": "common",
  "cost": 2,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "Draw", "world": 1 },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
},
"I'm Outta Here": {
  "kind": "world",
  "name": "I'm Outta Here",
  "rarity": "common",
  "cost": 1,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "DestroySelf" }
},
"The Monitor Keeps Beeping": {
  "kind": "world",
  "name": "The Monitor Keeps Beeping",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "ForceDestroy", "amount": 1 }
}
```

- `I'm Outta Here` anchors REQ-W13-5: its only effect anywhere is `DestroySelf`, placed in `onEndOfTurn` per rule C1a (`DestroySelf` is only meaningful there — the engine has `selfId`). Left alone, the card leaves on its own. No `onCleared: DestroySelf` variant exists because that hook has no `selfId` to act on.
- `The Monitor Keeps Beeping` is the `ForceDestroy`-queuing card REQ-W13-16 calls for, with no `Brace`-granting reward introduced anywhere in this world — the pressure is meant to land, not be neutralized, in Act 1.

### Act 2 — Denial

```json
"Everyone Says It's Nothing": {
  "kind": "world",
  "name": "Everyone Says It's Nothing",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Denial", "value": 2, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Denial",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ForceDestroy", "amount": 1 }
  }
},
"The Test Results Sit Unopened": {
  "kind": "world",
  "name": "The Test Results Sit Unopened",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Ask The Question" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Denial", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"She Says She's Fine": {
  "kind": "world",
  "name": "She Says She's Fine",
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
      { "kind": "AddWorldCardToDeck", "template": "He Isn't Coming Back", "bTop": true },
      { "kind": "DestroySelf" }
    ]
  }
},
"He Isn't Coming Back": {
  "kind": "world",
  "name": "He Isn't Coming Back",
  "rarity": "rare",
  "cost": 5,
  "keywords": ["Denial:2"],
  "discardable": false,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "ForceDestroy", "amount": 1 }
}
```

- `Everyone Says It's Nothing` is the Act 2 signature threat: draws in with `Denial:2` applied to itself (strippable), escalates to `ForceDestroy` once 2+ Denial-carrying cards sit in hand — the self-tax has teeth if ignored.
- `The Test Results Sit Unopened` is the Obstructed tool-fetch card (REQ-W13-19): clearing it grants `Ask The Question`, the Denial-strip reward.
- `She Says She's Fine` → `He Isn't Coming Back` is the Self-Transform Pattern (REQ-W13-17): `AddWorldCardToDeck{bTop:true}` + `DestroySelf`, never `ReturnWorldCards`. The escalated card authors `Denial:2` statically and is `discardable:false` — deliberately uncounterable by the Denial-strip reward, per the design note above.

### Act 3 — Anger

```json
"It Isn't Fair": {
  "kind": "world",
  "name": "It Isn't Fair",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 1, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Anger",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 1, "target": "randomWorldCardInHand" }
  }
},
"Nobody Warned You": {
  "kind": "world",
  "name": "Nobody Warned You",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Let It Out" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"The Question That Has No Answer": {
  "kind": "world",
  "name": "The Question That Has No Answer",
  "rarity": "signature",
  "cost": 6,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Why" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 2, "target": "self" },
  "onEndOfTurn": {
    "kind": "Sequence",
    "steps": [
      {
        "kind": "DamageScaled",
        "base": 2,
        "per": { "kind": "KeywordInHand", "keyword": "Anger" },
        "amount": 1
      },
      { "kind": "AddThreatToWorldDeck" }
    ]
  }
},
"Destiny": {
  "kind": "world",
  "name": "Destiny",
  "rarity": "signature",
  "cost": 6,
  "keywords": ["Denial:2"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "ExileTopWorldCards", "amount": 3 },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `It Isn't Fair` is the Act 3 signature Anger threat: self-applies `Anger:1` on draw, spreads it to a random hand card once 2+ Anger-carrying cards are present — "Anger doesn't stay contained to what caused it" (REQ-W13-10) made literal.
- `Nobody Warned You` is Act 3's Obstructed tool-fetch (second half of REQ-W13-19): grants `Let It Out`, the Anger-strip reward.
- `The Question That Has No Answer` grants `Why`, the `DealProgressAll`-based reward — this is how REQ-W13-18's "`DealProgressAll`-based card as the indiscriminate 'Why' swing" gets into the World Card Recipe, mirroring exactly how Eden Prime's `Paradise Runs` grants `Hush the Valley`. Its own `onEndOfTurn` escalation (`DamageScaled` off `Anger` count + `AddThreatToWorldDeck`) mirrors every other world's signature-tier closer (`Paradise Runs`, `The Order Arrives`, `Entity Detected`).
- `Destiny` (REQ-W13-12/13): authored `Denial:2` self-taxes per `ClearCostPerSelfKeyword`; its cost additionally climbs from `Anger`'s ambient `ClearCostPerKeywordCount` tax whenever any Anger-carrying card sits in hand — no bespoke effect needed, both modifiers apply automatically once registered (Slice 1 of the plan). Effective cost = `6 (base) + 2×costPer(Denial) + count(Anger)×costPer(Anger)` — with the two Act 3 hazards above routinely putting 1-2 Anger-carrying cards in hand, this typically lands around 10-11, noticeably steeper than any other card in the game (next-highest is 6). `onCleared: ExileTopWorldCards{amount:3}` is larger than any existing player-card use of the effect (existing precedent tops out at 2) — deliberate, matching REQ-W13-13's framing of "cutting off future moments entirely and permanently," a heavier and more final effect than the tactical retreat existing player cards use it for.

`The Walker` is referenced by `{ "templateId": "The Walker", "count": 1 }` in deck composition only — never redefined here (REQ-W13-2).

## Reward player cards (`src/data/allCards.json` → `cardTemplates`)

```json
"Ask The Question": {
  "kind": "player",
  "name": "Ask The Question",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Denial", "target": "hand", "amount": 2 }
    ]
  }
},
"Let It Out": {
  "kind": "player",
  "name": "Let It Out",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Anger", "target": "hand", "amount": 2 }
    ]
  }
},
"Why": {
  "kind": "player",
  "name": "Why",
  "rarity": "rare",
  "energyCost": 2,
  "exhaust": true,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgressAll", "base": 1 },
      { "kind": "RemoveKeyword", "keyword": "Anger", "target": "hand", "amount": 1 }
    ]
  }
},
"Sit With It a While": {
  "kind": "player",
  "name": "Sit With It a While",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Modal",
    "branches": [
      { "kind": "ThawCards", "amount": 1, "heatCost": 1 },
      { "kind": "Heal", "amount": 2 }
    ]
  }
}
```

- `Ask The Question` / `Let It Out` are REQ-W13-14's two central reward cards — `RemoveKeyword` amount 2 matches the mid-range of shipped precedent (New Derelict's `Override Badge` uses amount 1, its `Manual Release` uses amount 3; Eden Prime's `Gentle Approach` uses amount 1). Paired with a small `DealProgress` per the standard "small progress + keyword removal" reward shape (mirrors `Gentle Approach` exactly).
- `Why` mirrors `Hush the Valley`'s exact shape (`DealProgressAll` + a `RemoveKeyword` on the world's own signature keyword), granted only through clearing `The Question That Has No Answer` — not independently available in the reward pool, matching how `Hush the Valley` is gated behind `Paradise Runs`.
- `Sit With It a While` is the one permitted Freeze/Thaw flavor touch (REQ-W13-15) — a `Modal` choice between minor `ThawCards` and a plain `Heal`, deliberately not central to either reward or world identity.

## Deck composition (`src/data/worlds/questions/cards.json`)

```json
{
  "worldId": "questions",
  "deckComposition": {
    "acts": [
      {
        "cards": [
          { "templateId": "Waiting Room Silence", "count": 3 },
          { "templateId": "I'm Outta Here", "count": 2 },
          { "templateId": "The Monitor Keeps Beeping", "count": 2 }
        ]
      },
      {
        "cards": [
          { "templateId": "Everyone Says It's Nothing", "count": 3 },
          { "templateId": "The Test Results Sit Unopened", "count": 2 },
          { "templateId": "She Says She's Fine", "count": 2 },
          { "templateId": "He Isn't Coming Back", "count": 1 }
        ]
      },
      {
        "cards": [
          { "templateId": "It Isn't Fair", "count": 3 },
          { "templateId": "Nobody Warned You", "count": 2 },
          { "templateId": "The Question That Has No Answer", "count": 1 },
          { "templateId": "Destiny", "count": 1 },
          { "templateId": "The Walker", "count": 1 }
        ]
      }
    ]
  }
}
```

Act 1: 7 cards, foreshadow-only (REQ-W13-20 — lightest). Act 2: 8 cards. Act 3: 8 cards including `Destiny` and the fixed `The Walker` closer (REQ-W13-21). Sizes match the 7/8/7–8 shape used by Eden Prime and New Derelict, escalating card density (not raw count) is what carries Acts 2/3's extra weight, consistent with the spec's framing that it's Denial/Anger *density*, not deck size alone, that should climb.

## Open items this pass did not resolve

- These are still placeholders per the spec's own Open Questions, not settled by this pass: final `worldId`/title, the `compound` signature verb name, and whether `costPer` should differ from the `1` used here (chosen only because it matches every existing `KEYWORD_COST_MODIFIERS` entry — `Lockdown`, `Alarm`, `Reroute` are all `costPer: 1`).
- Rarity weights (`common`/`uncommon`/`rare`/`signature` distribution across the deck) follow the existing per-card `rarity` field convention but haven't been checked against the project's `sim/` balance tooling — recommend a `bun run sim` pass once this is authored, mirroring how other worlds got hand-verified plus sim-checked (see `[[sim-completeness-results-2026-07]]`).
- No Brace-granting reward exists anywhere in this world's design, by choice — Act 1's `ForceDestroy` pressure and Act 2/3's escalating `ForceDestroy` on ignored Denial are meant to land, not be neutralized. Flag to the user if this reads as too punishing once played by hand.
