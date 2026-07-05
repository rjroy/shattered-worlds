---
title: "Card design: the-beginning (World 15)"
date: 2026-07-04
status: draft
tags: [world, walker-narrative, grief-arc, acceptance, destiny-entity, keyword-cost-modifiers, unburden, finale, card-design]
modules: [data-worlds]
related:
  - .lore/work/specs/the-beginning.md
  - .lore/work/plans/the-beginning.md
  - .lore/work/design/questions-card-design.md
  - .lore/work/design/answers-card-design.md
---

# Card design: the-beginning (World 15)

The spec (`.lore/work/specs/the-beginning.md`) deliberately deferred concrete card templates, exact numbers, and deck counts to an authoring pass (see its Scope note and Open Questions), matching `questions.md`/`answers.md`'s scope discipline. This document is that pass — every world/reward card template below is ready to drop into `src/data/allCards.json`, and the deck composition is ready for `src/data/worlds/the-beginning/cards.json`.

**Calibration source:** costs, keyword-apply values, and deck-slot counts are matched against `questions-card-design.md`/`answers-card-design.md` (Worlds 13/14's own authoring passes), since Acts I/II here are explicitly a reprise of that same material, just faster (Act I) or gentler (Act II) per REQ-W15-17/18.

## Read this first: this pass follows the plan's redesigned Acceptance mechanic, not the spec's original REQ-W15-12

`.lore/work/plans/the-beginning.md` documents a confirmed deviation from the ratified spec, worked out with the user during plan-prep: `Destiny` is the same shared, unmodified card template `questions`/`answers` already use (cost `15`, no authored keywords, `onCleared: SurviveWorld`) — not a fresh per-world instance with a placeholder cost of `50`. `Acceptance` is not applied via `Destiny`'s own hook at all. Instead, **every reward card in this world that strips one of the four reprised grief keywords via `RemoveKeyword` also applies `Acceptance` directly to `Destiny` by name**, using the plan's new `ApplyKeyword` target `worldCardInHandByTemplateId` (a no-op if `Destiny` isn't in hand yet, which is true for all of Acts I/II — the discount only becomes real once Act III begins and `Destiny` is drawn). Concretely: **all four grief-release reward cards below carry this as a second `Sequence` step**, not just cards authored fresh for Act III. This is what makes "unburden" mechanical — a reward earned releasing `Denial` in Act I still chips at `Destiny`'s cost if played once Act III's hand includes it, since the player's earned reward cards persist across acts within a run.

**Chosen `Acceptance` applied value: `15`** — exactly `Destiny`'s base cost. A single successful engagement (any one of the four reward cards, played while `Destiny` is in hand) drops its effective cost to `0`; the "dramatic swing on first contact, not gradual accumulation" framing from the spec's own REQ-W15-12 correction survives the redesign even though the delivery mechanism changed. Because `withAppliedKeyword` refreshes to the larger value rather than summing (confirmed in the plan), playing a second (or third, or fourth) different grief-release card in the same or a later turn does not stack past `15` — it simply keeps the discount at full strength. Stop engaging (chase `Door` instead, or simply run out of these reward cards to play) and `Acceptance` decays by 1 per turn, climbing `Destiny`'s effective cost back up at 1/turn until it's gone.

`costPer: -1` (REQ-W15-9) is unchanged from the spec and matches every other keyword's `costPer` in this trilogy.

## World cards (`src/data/allCards.json` → `cardTemplates`)

All templates below define all five hooks explicitly (`{ "kind": "None" }` where empty), per C3.

### Act I — Denial + Anger, reprised (faster saturation than World 13)

```json
"It's Fine, Actually": {
  "kind": "world",
  "name": "It's Fine, Actually",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Denial", "value": 3, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Denial",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ForceDestroy", "amount": 1 }
  }
},
"Somebody Else Will Handle It": {
  "kind": "world",
  "name": "Somebody Else Will Handle It",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 2, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Anger",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 1, "target": "randomWorldCardInHand" }
  }
},
"A Story You've Told Yourself": {
  "kind": "world",
  "name": "A Story You've Told Yourself",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Say It Out Loud" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Denial", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"Somebody Should Be Mad About This": {
  "kind": "world",
  "name": "Somebody Should Be Mad About This",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Put It Down" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Anger", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"Every Excuse Sounds Thinner": {
  "kind": "world",
  "name": "Every Excuse Sounds Thinner",
  "rarity": "common",
  "cost": 3,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "ForceDestroy", "amount": 1 }
},
"One More Excuse": {
  "kind": "world",
  "name": "One More Excuse",
  "rarity": "common",
  "cost": 2,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "Draw", "world": 1 },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `It's Fine, Actually` is the Act I signature `Denial` threat: self-applies `Denial:3` on draw (strippable) — higher than `Everyone Says It's Nothing`'s `2` — so `KeywordGate{min:2}` is already tripped the same turn it's drawn, no second Denial-carrying card needed. This is the "faster saturation, less patience" REQ-W15-17 calls for, made concrete: World 13's version needed value `2` to just barely meet its own `min:2`; this one clears the gate with room to spare.
- `Somebody Else Will Handle It` is the Act I signature `Anger` threat, same faster-saturation treatment: self-applies `Anger:2` (vs. World 13's `1`), tripping its own `KeywordGate{min:2}` alone and spreading `Anger:1` to a random hand card every turn it's left undealt.
- `A Story You've Told Yourself` / `Somebody Should Be Mad About This` are Act I's two Obstructed tool-fetch cards (REQ-W15-20): clearing them grants `Say It Out Loud` / `Put It Down`, this world's `Denial`/`Anger`-strip rewards (see Reward Player Cards — both also carry the `Acceptance`-to-`Destiny` step).
- `Every Excuse Sounds Thinner` is a keyword-free `ForceDestroy` pressure card, mirroring World 13's `The Monitor Keeps Beeping` — baseline pressure independent of the keyword mechanic.
- `One More Excuse` is a keyword-free `Obstructed` filler/foreshadow card, mirroring `Waiting Room Silence`.

### Act II — Bargaining + Depression, reprised (gentler than World 14)

```json
"A Smaller Ask": {
  "kind": "world",
  "name": "A Smaller Ask",
  "rarity": "uncommon",
  "cost": 4,
  "keywords": [],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Bargaining", "value": 1, "target": "self" },
  "onEndOfTurn": {
    "kind": "KeywordGate",
    "keyword": "Bargaining",
    "min": 2,
    "zone": "hand",
    "then": { "kind": "ForceDestroy", "amount": 1 }
  }
},
"It's Not So Bad": {
  "kind": "world",
  "name": "It's Not So Bad",
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
"Terms You Already Know": {
  "kind": "world",
  "name": "Terms You Already Know",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Close the Book On It" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Bargaining", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
},
"The Same Tired Weight": {
  "kind": "world",
  "name": "The Same Tired Weight",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Set It Down" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "ApplyKeyword", "keyword": "Depression", "value": 1, "target": "self" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `A Smaller Ask` / `It's Not So Bad` are Act II's signature `Bargaining`/`Depression` threats, deliberately gentler than Act I's pair (REQ-W15-18): both self-apply value `1`, so `KeywordGate{min:2}` genuinely needs a second Bargaining/Depression-carrying card in hand — unlike Act I's threats, neither trips its own gate alone. This is the "same shapes, turned down" REQ-W15-18 calls for.
- `Terms You Already Know` / `The Same Tired Weight` are Act II's two Obstructed tool-fetch cards (REQ-W15-20): grant `Close the Book On It` / `Set It Down`, this world's `Bargaining`/`Depression`-strip rewards.
- No `AddThreatToWorldDeck`, `Modal`, or `DiscardThenDraw` card is authored for Act II — the spec's "smaller stakes, gentler bargains, slower cycling" language (REQ-W15-18) describes a difference in *degree* from World 14's own cards, not a specific effect this world must newly introduce; Act II stays deliberately thin here (4 templates vs. Act I's 6), which is itself the "lighter, slower-paced" REQ-W15-21 calls for.

### Act III — the Destiny/Acceptance loop

```json
"He's Still Fighting": {
  "kind": "world",
  "name": "He's Still Fighting",
  "rarity": "common",
  "cost": 3,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "None" },
  "onCleared": { "kind": "GainCard", "template": "Watch Over Him" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
},
"The Weight You're Still Carrying": {
  "kind": "world",
  "name": "The Weight You're Still Carrying",
  "rarity": "common",
  "cost": 2,
  "keywords": ["Obstructed"],
  "discardable": true,
  "onDiscarded": { "kind": "Draw", "world": 1 },
  "onCleared": { "kind": "None" },
  "onPartialClear": { "kind": "None" },
  "onDraw": { "kind": "None" },
  "onEndOfTurn": { "kind": "None" }
}
```

- `He's Still Fighting` is Act III's one new tool-fetch card, realizing the companion-figure framing (REQ-W15-6): clearing it grants `Watch Over Him`, a caretaking reward (see Reward Player Cards). It carries no keyword of its own — Act III introduces no sixth keyword and no new grief pressure (REQ-W15-14); it exists to deliver one reward card, not to threaten.
- `The Weight You're Still Carrying` is a keyword-free filler card, mirroring `One More Excuse`/`Waiting Room Silence` — gives Act III a small amount of deck bulk without adding mechanical noise, consistent with REQ-W15-21's "centers on the loop, not card volume."
- `Destiny` and the fixed `{ "templateId": "The Walker", "count": 1 }` closer are referenced only in Deck Composition below, never redefined here — no change of any kind to `Destiny`'s authored template (REQ-W15-2/3, and this plan's central deviation).

## Reward player cards (`src/data/allCards.json` → `cardTemplates`)

```json
"Say It Out Loud": {
  "kind": "player",
  "name": "Say It Out Loud",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Denial", "target": "hand", "amount": 2 },
      {
        "kind": "ApplyKeyword",
        "keyword": "Acceptance",
        "value": 15,
        "target": "worldCardInHandByTemplateId",
        "templateId": "Destiny"
      }
    ]
  }
},
"Put It Down": {
  "kind": "player",
  "name": "Put It Down",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Anger", "target": "hand", "amount": 2 },
      {
        "kind": "ApplyKeyword",
        "keyword": "Acceptance",
        "value": 15,
        "target": "worldCardInHandByTemplateId",
        "templateId": "Destiny"
      }
    ]
  }
},
"Close the Book On It": {
  "kind": "player",
  "name": "Close the Book On It",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Bargaining", "target": "hand", "amount": 2 },
      {
        "kind": "ApplyKeyword",
        "keyword": "Acceptance",
        "value": 15,
        "target": "worldCardInHandByTemplateId",
        "templateId": "Destiny"
      }
    ]
  }
},
"Set It Down": {
  "kind": "player",
  "name": "Set It Down",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "DealProgress", "base": 2 },
      { "kind": "RemoveKeyword", "keyword": "Depression", "target": "hand", "amount": 2 },
      {
        "kind": "ApplyKeyword",
        "keyword": "Acceptance",
        "value": 15,
        "target": "worldCardInHandByTemplateId",
        "templateId": "Destiny"
      }
    ]
  }
},
"Watch Over Him": {
  "kind": "player",
  "name": "Watch Over Him",
  "rarity": "common",
  "energyCost": 1,
  "effect": {
    "kind": "Sequence",
    "steps": [
      { "kind": "Heal", "amount": 2 },
      { "kind": "GainLight", "amount": 1 }
    ]
  }
},
"Help Him Focus": {
  "kind": "player",
  "name": "Help Him Focus",
  "rarity": "uncommon",
  "energyCost": 2,
  "effect": { "kind": "DealProgress", "base": 3 }
},
"Keep Him Upright": {
  "kind": "player",
  "name": "Keep Him Upright",
  "rarity": "common",
  "energyCost": 1,
  "effect": { "kind": "Brace", "amount": 1 }
}
```

- `Say It Out Loud` / `Put It Down` / `Close the Book On It` / `Set It Down` are the four grief-release rewards (REQ-W15-15/20) — one per reprised keyword, each pairing the standard small `DealProgress` + `RemoveKeyword{amount:2}` shape (matching `Ask The Question`/`Let It Out`/`Call In The Favor`/`Let It Sit` exactly) with the new third step that applies `Acceptance:15` to `Destiny` by name if it's in hand. This is the mechanism carrying this plan's central redesign: **every one of these four cards is the "unburden" verb made literal**, whichever act it was earned in.
- `Watch Over Him` / `Help Him Focus` / `Keep Him Upright` are the companion-figure reflavors REQ-W15-6/16 calls for — `Heal`/`GainLight` combined as tending to him, `DealProgress` reframed as helping him focus on a threat (not the player striking it — works against whichever hazard the player targets, including but not limited to `Destiny`), and `Brace` reframed as steadying him rather than self-preservation. No new effect kind or mechanic anywhere in this group — flavor text only, per REQ-W15-16.

## Deck composition (`src/data/worlds/the-beginning/cards.json`)

```json
{
  "worldId": "the-beginning",
  "deckComposition": {
    "acts": [
      {
        "cards": [
          { "templateId": "It's Fine, Actually", "count": 2 },
          { "templateId": "Somebody Else Will Handle It", "count": 2 },
          { "templateId": "A Story You've Told Yourself", "count": 1 },
          { "templateId": "Somebody Should Be Mad About This", "count": 1 },
          { "templateId": "Every Excuse Sounds Thinner", "count": 1 },
          { "templateId": "One More Excuse", "count": 1 }
        ]
      },
      {
        "cards": [
          { "templateId": "A Smaller Ask", "count": 2 },
          { "templateId": "It's Not So Bad", "count": 2 },
          { "templateId": "Terms You Already Know", "count": 1 },
          { "templateId": "The Same Tired Weight", "count": 1 }
        ]
      },
      {
        "cards": [
          { "templateId": "He's Still Fighting", "count": 2 },
          { "templateId": "The Weight You're Still Carrying", "count": 1 },
          { "templateId": "Destiny", "count": 1 },
          { "templateId": "The Walker", "count": 1 }
        ]
      }
    ]
  }
}
```

Act I: 8 cards, fast and dense — reprising two keywords at once (REQ-W15-21). Act II: 6 cards, lighter (REQ-W15-18/21). Act III: 5 cards, thinnest of the three, centered on the loop rather than volume (REQ-W15-21), including the referenced `Destiny` and the fixed `The Walker` closer (REQ-W15-22).

## Open items this pass did not resolve

- **The `Acceptance` applied value of `15` is chosen to exactly zero `Destiny`'s unmodified cost on first contact** — a placeholder pending a real numbers-and-feel pass, not sim-checked. Whether a single reward-card play should fully zero the cost (as authored here) or leave a smaller remainder needing further `DealProgress` is exactly the open question the spec's own Open Questions flagged, now answered with a concrete number rather than left as a shape.
- Rarity weights and exact costs haven't been checked against `sim/` balance tooling — recommend a `bun run sim` pass once authored, same recommendation the prior two worlds' design docs made.
- No in-world `GainKeywordGuard`-granting reward card exists in this design, by choice — matches `questions`' own precedent (no `Brace`/guard-granting reward exists there either) and is consistent with REQ-W15-17's framing that guard charges come from the meta-progression pre-load (plan Slice 1 Step 6), not from an in-run source.
- Whether Act III's two new cards (`He's Still Fighting`, `The Weight You're Still Carrying`) give the act enough texture, or read as too thin next to `Destiny`'s own weight, is unconfirmed until manual playtest (plan Step 24, final item).
- Whether playing a grief-release reward card for flavor reasons in Act I/II (before `Destiny` is ever in hand) reads oddly, given its third effect step silently no-ops until Act III — flag during manual playtest; the effect's `describe()`/card text should make clear the `Acceptance` step only matters once `Destiny` is present, not fabricate a false promise on the card face in earlier acts.
