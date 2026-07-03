---
title: Persistent Keyword Cost Modifiers
date: 2026-07-02
status: current
tags: [keywords, cost-modifiers, world-cards, lockdown, reroute, alarm, core-engine]
fg-type: architecture
fg-sources: [.lore/work/plans/keyword-cost-modifiers.md, .lore/work/notes/keyword-cost-modifiers.md, .lore/work/plans/new-derelict.md, .lore/work/notes/new-derelict.md, .lore/work/plans/transit-authority.md, .lore/work/notes/transit-authority.md]
fg-status: current
fg-evidence:
  code:
    - src/core/model/types.ts
    - src/core/model/keywords.ts
    - src/core/engine/effectiveCards.ts
  tests:
    - src/core/tests/effectiveCards.test.ts
    - src/core/tests/newDerelict.test.ts
    - src/core/tests/transitAuthority.test.ts
  symbols:
    - PersistentModifier
    - KEYWORD_COST_MODIFIERS
    - PERSISTENT_KEYWORDS
    - effectiveWorldCardCost
    - extraWorldCardCost
    - activeKeywordCostModifiers
---

# Persistent Keyword Cost Modifiers

A world card's clear cost can be taxed by the keywords it or its hand-mates carry. The rule lives once, globally, keyed by keyword name, in `KEYWORD_COST_MODIFIERS` (`src/core/model/keywords.ts`) — never authored per card template. `effectiveWorldCardCost(card, state)` reads a card's actual keyword names (deduped, since authored and applied keyword lists are concatenated without deduping) and sums any registered modifier's contribution on top of `card.cost`.

## Why keyword-level, not per-template

The original design (New Derelict's first cut) put the rule on a per-template `WorldCard.persistent` field, hand-authored on only the templates a designer remembered to tag. This produced a live, one-directional bug: `ApplyKeyword` targets like `"firstWorldCardInHand"`/`"randomWorldCardInHand"` can legally place `Lockdown` on *any* world card in hand, including ones whose template never declared `persistent`. Those cards taxed every other Locked card in hand (the hand-count filter checks `hasKeyword`, not the field) while never scaling their own cost, because they had no field to read. Moving the rule to a keyword-keyed registry fixed this by construction: any card that ever carries a registered keyword is taxed identically, whether the keyword was authored on the template or applied at runtime. A future hazard template that becomes a legal target for a registered keyword gets correct behavior automatically, with no authoring step to forget.

## The modifier registry

`PersistentModifier` (`src/core/model/types.ts`) is a discriminated union with three kinds, each reading a different signal off the game state:

- `ClearCostPerKeywordCount` — taxes based on how many hand cards carry the keyword at all (used by `Alarm`).
- `ClearCostPerOtherKeyword` — taxes based on the total keyword *value* summed across every **other** hand card (present in the type, available for future use).
- `ClearCostPerSelfKeyword` — taxes based on the keyword's own value on **this** card (used by `Lockdown` and `Reroute`, both authored with a nominal value of `1`).

`KEYWORD_COST_MODIFIERS: Partial<Record<KeywordName, PersistentModifier>>` currently holds `Lockdown: ClearCostPerSelfKeyword`, `Alarm: ClearCostPerKeywordCount`, and `Reroute: ClearCostPerSelfKeyword`, each `costPer: 1`. `extraWorldCardCost` sums every registered modifier's contribution across the card's deduped keyword names; `effectiveWorldCardCost` adds that to `card.cost`. A card carrying no registered keyword is a guaranteed no-op — this is what lets every world that authors no relevant keyword stay unaffected without an explicit opt-out.

## Persistent vs. transient keywords

`PERSISTENT_KEYWORDS: ReadonlySet<KeywordName>` (currently just `Lockdown`) is a separate allowlist controlling *decay*, not cost. `tickAppliedKeywords` passes any applied keyword in this set through turn-start ticking unchanged instead of decrementing/dropping it — "presence is the state," with no meaningful numeric value. Because the allowlist and not the value drives persistence, Lockdown's `ApplyKeyword` calls carry a nominal `value: 1` that is deliberately unused for decay math, and player-facing render paths (the applied-keyword badge, the handler's rules text, the compact effect-line token) special-case `PERSISTENT_KEYWORDS` members to display the bare keyword name with no numeric suffix.

`Reroute` (Transit Authority) reuses the same `ApplyKeyword`/`RemoveKeyword`/`KEYWORD_COST_MODIFIERS` primitives as `Lockdown` but is **not** added to `PERSISTENT_KEYWORDS` — it decays at turn start like `Alarm`, matching its "just got reassigned" framing, where the self-transforming card that carries it has usually already been replaced by the time decay would matter.

## Where the effective cost must be read

Because a sibling card's keyword state can change a card's own displayed cost, every consumer of a world card's cost must call `effectiveWorldCardCost`, not `card.cost`, directly: resolution (progress-threshold checks), action preview, the table's cost ring, and the card face's cost digit. The card face in particular has no dedicated change event tied to a sibling card's state — `cardDisplaySignature` only tracks the card's own fields — so its cost label is updated reactively every render cycle, the same way the progress ring already bypasses the signature check.
