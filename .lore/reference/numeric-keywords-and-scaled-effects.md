---
title: Numeric Keywords And Keyword-Scaled Effects
date: 2026-07-02
status: current
tags: [keywords, core-engine, counter-spec, fog-beach-party, overgrown-mall, engine-generalization]
fg-type: architecture
fg-sources: [.lore/work/specs/fog-beach-party.html, .lore/work/specs/overgrown-mall.html]
fg-status: current
fg-evidence:
  code:
    - src/core/model/keywords.ts
    - src/core/model/types.ts
    - src/core/effects/dealProgress.ts
    - src/core/effects/tokens.ts
  tests:
    - src/core/tests/keywords.test.ts
    - src/core/tests/effects.test.ts
  symbols:
    - Keyword
    - KeywordName
    - CounterSpec
    - hasKeyword
    - parseKeyword
---

# Numeric Keywords And Keyword-Scaled Effects

The keyword system splits the authoring-facing name from the runtime value. `KeywordName` (`src/core/model/types.ts`) is the closed string union; `Keyword = { name: KeywordName; value?: number }` is the runtime shape a card actually carries. Authoring stays string-based (`"Spore"`, `"Concealed:3"`) and is parsed at mint by `parseKeyword` (`src/core/model/keywords.ts`): a bare name has no value, a `"Name:N"` form parses to `{ name, value: N }`, and an unknown name or non-numeric `N` throws at parse time rather than failing silently later. This generalization was sequenced ahead of any consumer — see [[generalize-on-second-customer-lesson]] for why it waited for a second concrete need (Fog's `Concealed:N` and Whiteout's `frozen` depth/duration) before landing.

Every consumer that only cares whether a card carries a keyword (value irrelevant) routes through `hasKeyword(card, name)` / `keywordNames(card)` rather than an ad hoc `.includes` over the keywords array. This is what let `Concealed` (Fog), `Spore` (Overgrown Mall), and later `Alarm`/`Lockdown`/`Reroute` join the vocabulary without touching every call site that matches by name. `CounterSpec.keyword`, `DealProgress(.bonus).tag`, `DealProgressAll.bonus.tag`, and `TargetSpec.hazard.tag` are all typed as `KeywordName`, not `Keyword` — they match by name only.

## `CounterSpec.KeywordInHand` — the shared scaling primitive

`CounterSpec` (`src/core/model/types.ts`) is a discriminated union with one member so far: `{ kind: "KeywordInHand"; keyword: KeywordName }`, resolved by `resolveCounter` (`src/core/effects/dealProgress.ts`) to a count of every hand card (player or world) carrying that keyword name, value ignored. Two effect kinds consume it:

- `DealProgressScaled { base, per: CounterSpec, amount }` — Overgrown Mall's `Bloom` reward: `base + amount × counter(state)` progress dealt, scaling with `Spore` cards left in hand. This is Mall's claimed signature verb (no other world's data may use `DealProgressScaled`).
- `DamageScaled { base, per: CounterSpec, amount }` — Fog Beach Party's `Whiteout` hazard: damage scaled by the count of `Concealed`-tagged cards in hand (itself included), reusing the identical counter rather than inventing a bespoke `ConcealedInHand` field.

Both resolve at effect-application time from current state, so the scaling is deterministic and introduces no new randomness. The union is built extensible (a future counter, e.g. an empty-hand-slot count from the bird-building brainstorm, is additive) but only `KeywordInHand` is implemented; adding a member is a separate design decision, not a side effect of this generalization.

## Display

Wherever keywords render as text, the structured `{ name, value }` shape must format as a readable chip (e.g. "Concealed 3"), not a bare `.join(" · ")` over the array — that would print raw object references once keywords carry a value. `src/core/effects/tokens.ts` and the renderer's keyword-chip path both format through the same name+value convention documented for authors in [[theme-authoring]] (rule C2a).

Related: [[fog-beach-party-world]], [[overgrown-mall-world]], [[whiteout-parking-garage-world]], [[persistent-keyword-cost-modifiers]] (the later applied-keyword/cost-modifier layer built on top of this same `Keyword` shape).
