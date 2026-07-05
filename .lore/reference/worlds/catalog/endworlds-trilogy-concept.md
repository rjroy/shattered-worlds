---
title: "The Endworlds Trilogy (Worlds 13-15): Destination or Denial"
date: 2026-07-04
status: current
tags: [world-design, narrative, walker, endgame, grief-arc, denial, anger, bargaining, depression, acceptance, destiny-entity]
fg-type: concept
fg-sources: [.lore/work/specs/questions.md, .lore/work/specs/answers.md, .lore/work/specs/the-beginning.md, .lore/work/brainstorm/endworlds-destination.md]
fg-status: current
---

# The Endworlds Trilogy (Worlds 13-15): Destination or Denial

This describes the ratified narrative and mechanical concept for the run's final three worlds — `questions` (World 13), `answers` (World 14), and `the-beginning` (World 15) — as fixed by their specs (`.lore/work/specs/questions.md`, `answers.md`, `the-beginning.md`, all dated 2026-07-03). It reframes the entire game's premise: the Walker is not fleeing an apocalypse, the Walker is fleeing the death of a parent, and every broken world crossed so far has been a way to avoid being present for that loss. "Apocalypse" is the excuse; grief is the plot.

This sits alongside — and narratively completes — the shared Walker/Door mechanical pattern described in [[theme-authoring]], which establishes that the Walker is never the enemy and is never re-themed per world. The trilogy keeps that rule and gives the throughline its payoff instead of contradicting it: the antagonist across these three closing worlds is Death, or grief itself, not the Walker. `The Walker`, `Summon Door`, and `Door` remain the same unmodified shared templates in all three worlds, ending Act 3 exactly as every other world does.

## The grief-arc stages

Each world is one stage of grief, expressed as its own applied-keyword cost-tax mechanic layered on top of Eden Prime's `ApplyKeyword`/`KeywordGate`/`RemoveKeyword` primitives and the generalized keyword-cost-modifier registry those primitives enabled. No stage forks or branches into another; the three worlds run in a straight line, and each carries its predecessor's weight forward rather than resolving it.

- **World 13 — `questions` — Denial and Anger.** Signature verb **compound**. Two new transient applied keywords, `Denial` and `Anger`, tax cost from two different shapes: `Denial` taxes only the card carrying it, scaled by its own value; `Anger` taxes every card in hand, including itself, by a flat amount per Anger-carrying card present. Both land on `Destiny` (see below) at once and stack, so its cost is a direct, compounding readout of both keywords together rather than whichever is momentarily larger.
- **World 14 — `answers` — Bargaining and Depression.** Signature verb **concede**. Two more transient applied keywords, `Bargaining` and `Depression`. `Bargaining` taxes every *other* card in hand by the summed value of `Bargaining` carried elsewhere, never taxing the card that carries it — the thing being actively negotiated stays cheap on its own terms, while everything else gets harder to deal with. `Depression` taxes only the card carrying it, the same plain self-tax shape `Denial` uses in World 13. Every act in this world gives something up, whether spent chasing a deal or given up on chasing anything at all.
- **World 15 — `the-beginning` — Acceptance.** Signature verb **unburden**. Acts I and II reprise all four prior keywords (`Denial`, `Anger`, `Bargaining`, `Depression`) at once, still taxing. Act III introduces a single new keyword, `Acceptance`, using the same self-tax shape as `Denial`/`Depression` but with its sign flipped — the only keyword in the game that makes a card's clear cost cheaper rather than costlier. Repeated, direct engagement with `Destiny` refreshes `Acceptance`; disengaging lets it decay away like any other transient keyword. This is the one place in the whole trilogy — and the whole game — where release, not accumulation, is the mechanic.

## `Destiny`: the continuous hazard entity

`Destiny` is a themed world-card hazard entity, introduced in World 13 and continued in Worlds 14 and 15. Unlike the original conception below, it is in fact a single shared template like `The Walker` or `Door` — reused unmodified across all three worlds rather than authored independently per world (see the addendum below for why) — but it is still the same narrative through-line across all three worlds: the thing the Walker's flight was always ultimately about.

- Currently, clearing `Destiny` fires `SurviveWorld` directly from its `onCleared` (see `src/data/allCards.json`'s `Destiny` entry), in both `questions` and `answers` since they share the one template. `SurviveWorld` also remains available via the standard `Door` chain in both worlds, so clearing `Destiny` is an earned alternate route to survival, not the only one.
- `the-beginning`'s implementation plan has since confirmed it reuses the same shared template unmodified and inherits its existing `onCleared` (firing `SurviveWorld`, same as `questions`/`answers`) — see the addendum below. `Acceptance`, `the-beginning`'s own keyword mechanic, reaches `Destiny` from outside, via a named-target `ApplyKeyword` variant fired by this world's own reward cards, never by any hook authored on `Destiny` itself.

**Naming note:** `Destiny`, the world-card entity described here, is unrelated to the existing `DestinyScene` (a Phaser scene reached from the locked-world branch of world selection) and to the Destiny Progression meta-progression system. The name is a deliberate pun — the trilogy's premise is literally "the Walker is fleeing the Destiny" — not a naming collision to fix. See [[theme-authoring]]'s signature-verb table note for the full disambiguation.

## The single convergent ending

World 15 ends in exactly one way: reach the `Door` (as in every other world) or repeatedly engage `Destiny` until `Acceptance` discounts it low enough to clear, and either path fires the same `SurviveWorld`. There is no branch and no second ending path beyond these two routes to the same terminal state.

An earlier brainstorm explored a two-path ending — a `Refusal`/`Acknowledgment` keyword fork across Worlds 13-14 deciding between a "fight Death" ending and a "be present" ending, backed by an invisible `Attachment` meta-stat and a Feat/Memory-Fragment-spending Bargain battle in World 14. All of that was dropped at the trilogy's ratification and does not appear in any of the three specs, not even in reduced form: there is no `Refusal`/`Acknowledgment` keyword, no `Attachment` stat, and no meta-progression spend gating World 14. The current design commits to one convergent ending rather than two branching ones.

## Relationship to the world-authoring pattern

This trilogy is additive to, not a departure from, the standard world contract: three-act decks, the fixed `The Walker` → `Door` → `SurviveWorld` closer, and the "no mechanic is exclusive, identity is" rule from [[theme-authoring]] all hold unchanged. What each world adds is its own pair (or, in World 15's case, quintet) of applied keywords and cost-tax modifiers, plus the continuing `Destiny` entity — mechanism precedent set by Eden Prime, New Derelict, and Transit Authority, aimed here at a sustained three-world narrative payoff instead of a single world's identity.

## Addendum (2026-07-04): `Destiny` is a reused template, not three independent ones

`answers`' (World 14) implementation plan settled a question this document's "continuous hazard entity" section above leaves open: because `allCards.json` enforces global template-id uniqueness, `answers` cannot author its own second `Destiny` card template. It instead reuses `questions`' existing `Destiny` template unmodified in its own Act 3 deck composition — **one shared card-template entity across the trilogy, not three per-world reskins.** `World 15`'s (`the-beginning`) implementation plan has since confirmed the same resolution, no longer a prediction: it reuses the identical shared `Destiny` template, unmodified, in its own Act 3 deck composition — no fourth, per-world reskin, and no change of any kind to `Destiny`'s authored `allCards.json` entry (cost, keywords, or hooks). This is the third and final endworld to confirm the shared-`Destiny` decision; all three now provably share the exact same card-template entity.

Because `Destiny` itself cannot be touched without also changing `questions`'/`answers`' already-shipped balance, `the-beginning`'s `Acceptance` mechanic is deliberately **not** applied via `Destiny`'s own `onPartialClear` or any other hook on the shared template — unlike an earlier design pass had assumed. Instead, `the-beginning` adds a new named-target `ApplyKeyword` variant (`target: "worldCardInHandByTemplateId"`) that this world's own `RemoveKeyword` reward cards fire, in the same effect `Sequence` that strips a grief keyword, to stamp `Acceptance` onto `Destiny` by id from the outside. This is the mechanism — not a hook on `Destiny` itself — that lets a per-world keyword reach a cross-world shared card without ever modifying it.

This addendum records the reuse decision itself, now confirmed by the third and final world; the "continuous hazard entity" section above has since been corrected in place to match it. See `.lore/work/plans/answers.md`'s header note and `.lore/work/plans/the-beginning.md`'s deviation section for the plan-level mechanical description of the shared template's behavior.
