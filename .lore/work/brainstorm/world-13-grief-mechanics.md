---
title: World 13 grief mechanics (Denial and Anger)
date: 2026-07-03
status: open
tags: [walker-narrative, grief-arc, world-13, applied-keywords, no-new-effects]
modules: [core-effects]
related: [.lore/work/brainstorm/endworlds-destination.md]
---

# World 13 grief mechanics (Denial and Anger)

Focused brainstorm on mechanizing World 13's three acts (Loss / Denial / Anger) using only the effect kinds that already exist in `src/core/effects/registry.ts`. New keywords are fine — stamped via `ApplyKeyword`, checked via `KeywordGate`/`ResourceGate`, cleared via `RemoveKeyword` — but no new effect kinds.

## Grounding corrections from reading the engine

- Progress is the player's own effort to clear a hazard, not a countdown against them. `dealProgress` accumulates toward a hazard's cost; short of it, `onPartialClear` fires, at or over it, `onCleared` fires and the hazard leaves hand. There is no ticking-clock-antagonist in the engine as it stands — that was a wrong assumption from before reading the code.
- `FreezeCards`/`ThawCards` freeze and unfreeze *player* cards in hand; thawing costs Heat. This is the existing lever for "can't act with your own tools."
- `ReturnWorldCards` shuffles a hazard back into the world deck instead of resolving it — it doesn't vanish, it comes back later. This is Denial as a mechanic, already built, no invention needed.
- `ForceDestroy` queues a random destruction landing at a future turn start, absorbable only by `Brace` charges — non-negotiable loss on a delay if no Brace is available.
- `DealProgressAll` hits every hazard in hand at once (indiscriminate). `ExileTopWorldCards` removes cards from the world deck before they ever reach hand — erasure of the future, not the present.
- `ApplyKeyword` / `KeywordGate` / `ResourceGate` / `RemoveKeyword` / `GainKeywordGuard` is the sanctioned slot for new keywords (Alarm was the first, per Eden Prime). New keyword names are data, not new effect kinds.

## Act I — Loss, fear, helplessness

- Player hand opens with cards already `FreezeCards`-frozen — can't act with your own tools.
- `GainHeat` trickles in slowly; `ThawCards` costs Heat, so thawing is earned, not free.
- A `ForceDestroy` queued early with no `Brace` available yet — something lands later, guaranteed, no way to stop it.
- A `Numb` keyword (via `ApplyKeyword`) stacks in hand; `KeywordGate` at a threshold could release a `GainHeat` burst — numbness cracking into feeling.

## Act II — Denial

- A hazard whose own effect is `ReturnWorldCards` — reject it, it goes back into the deck, it comes back later.
- A `Denial` keyword accumulates via `ApplyKeyword`. `GainKeywordGuard` lets the player absorb the first `KeywordGate` trigger (denial holds for a while) — but it runs out.
- `DealProgressScaled` off a `KeywordInHand` counter (existing `CounterSpec`) could make holding Denial cards paradoxically easier to clear in the short term — leaning into it works, until it doesn't.

## Act III — Anger / Destiny's first appearance

- `DealProgressAll` as the indiscriminate "Why" swing — hits every hazard in hand, no aim.
- Destiny's card uses `ExileTopWorldCards` — cutting off future moments entirely and permanently. This is what Destruction actually costs.
- An `Anger` keyword saturates hand via `ApplyKeyword`, gated by `KeywordGate`, unlocking access to the big `DealProgressAll`/`ExileTopWorldCards` payoff. Anger earns you the tool, and costs a `ForceDestroy` on yourself as the price of using it.

## Open threads

- Whether "Denial comes back via `ReturnWorldCards`" needs a dedicated hazard template or is just a property any Act II hazard can carry.
- Whether `Numb` needs to be a real new applied keyword or whether `FreezeCards`/`ThawCards` alone already carries the Act I feel without inventing keyword data.
- The Attachment stat from `endworlds-destination.md` doesn't have a job anymore since the Refusal fork was cut. Could tie into how much `Numb`/`Denial`/`Anger` keyword saturation a given run generates, but not decided.
