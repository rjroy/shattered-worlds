---
title: "Making themes play differently, not just look different"
date: "2026-06-07"
status: "open"
tags: ['theme', 'world', 'gameplay', 'mechanics', 'differentiation', 'keyword-bias', 'threat-verb', 'deckbuilder']
modules: ['core-engine', 'worlds', 'theme-authoring']
---

Shattered Worlds · Brainstorm

# Making themes *play* differently, not just look different

Three worlds that are identical in play with different names. The authoring recipe is what made them the same. Here's the engine reality and the levers that actually exist to pull them apart.

Status: open · 2026-06-07

Effort tags: no code data-only, reuses existing effects · data + tuning recompose effects/composition · core change new effect kind or state shape

## ◈ The diagnosis

Before any idea: three facts read straight from the engine that change what "fixing" even means.

1.**There is no energy / mana.** `handlePlayCard` charges nothing. Player cards are free; the only limit is how many sit in your hand. So a hazard's `cost` is *not* a budget — it is purely the progress threshold needed to clear it.

2.**Progress resets every turn.** `handleEndTurn` sets `progress: {}`. Clearing a hazard is a *burst* you must land within one turn, not savings you accumulate across turns.

3.**World cards stay in hand; player cards don't.** Held hazards eat your 6 hand slots, tick `onEndOfTurn`, and starve next turn's player draw (the refill formula draws 1–2 world cards first, then fills the rest with player cards).

**So the real pressure levers are: HP, hand-slot clogging, the one-turn burst, and keyword gating.** Not cost. Any differentiation plan that leans on "cost curves" is leaning on a knob that barely does anything right now.

The actual culprit. The theme-authoring rules enforce sameness *by design*: "map onto these five archetypes, reuse the same effects, the same numbers." That is a recipe for a reskin. The doc itself notes the Zombie's `onEndOfTurn` is just `Damage 1` and that `AddWorldCardToTop` is used by no theme. The worlds are identical because the recipe told them to be.

The reframe: stop asking "what new effects do we add" first. Ask **"what single threat-*verb* does each catastrophe embody"** — and notice most of those verbs are already expressible.

## ◈ The free win nobody's using: keyword bias no code

 Highest leverage, zero code

The starter deck is shared and unchanged across worlds. But `Sprint` keys off `Slow`, `Explore`/`Listen` key off `Hidden`, `Baseball Bat` keys off `Creature`. So if each world biases its hazards toward a *different* keyword, **the same starter deck plays differently** — a different starter card becomes MVP per world, with no engine change at all.

| World | Keyword bias | Fiction | What becomes the answer |
| --- | --- | --- | --- |
| Zombie big-box | `Creature`-dense | The swarm is bodies | Melee / weapon cards (already true) |
| Highway volcano | `Slow`-dense | Lava is slow but inexorable | `Sprint` — outrun, don't fight |
| Bird building | `Hidden`-dense | In cloud / at altitude you can't see what's coming | `Explore` / `Listen` — scout, don't swing |

This differentiates the player's moment-to-moment decisions across all three worlds for the price of editing JSON keyword arrays.

## ◈ Threat-verbs: the catastrophe as a verb, not a noun

Each disaster wants a different verb. Most are recomposable from the effects that already exist.

### Zombie = *multiply* data + tuning

Change the Zombie's `onEndOfTurn` from `Damage 1` to `AddWorldCardToTop: Zombie`. Ignoring it now floods your hand exponentially; the pressure becomes *spread*, and the counter is anything that clears in bulk. `AddWorldCardToTop` already exists — no code change.

### Volcano = *compound* data + tuning

A held `Lava` whose `onEndOfTurn` spawns a cheap `Ash` clog *and* deals small damage. Damage scales with how much lava you let accumulate — a doomsday-by-card-count, entirely within the vocabulary. Pairs naturally with the `Slow` keyword bias.

### Bird = *displace* core change

This is the one that genuinely needs a new effect — the bird *carries your stuff off*. There is no "discard / steal a random player card from hand" effect today. That's a real core addition. Flag it; don't pretend it's data.

## ◈ The wild pile (bad ideas welcome)

Volcano · the floor is lava core change

At end of turn, *unplayed player cards burn* — destroyed, not discarded. Punishes hoarding, rewards dumping your whole hand every turn. The exact opposite of zombie, where holding is safe. Needs a new end-of-turn rule over player cards.

Bird · weight limit core change

Reframe held-hazard count from a soft 10% intensity nudge into a *hard fail*: too many world cards in hand and the building can't stay aloft — you crash. Turns clogging into a lose condition, not just chip damage.

Bird · updrafts = shortcuts data + tuning

A card that yanks the next act forward (a `Draw` world-burst) to rush the Door — trade safety for speed. Verticality as risk/reward.

Zombie · corpses data + tuning

A cleared Zombie's `onCleared` drops a `Corpse` into the world deck that can re-animate. Clearing isn't clean.

Theme the intensity weights core change

`intensity()` is hardcoded 0.6 act / 0.3 hp / 0.1 held. Make it per-theme so the *juice ramps from a different source*: volcano spikes on time, bird on clog, zombie on HP. The music / screen-shake would crescendo differently per world — direct tie-in to the Balatro-maximalist juice goal.

## ◈ Structural knobs (per-world rules) core change

If worlds should differ at the rules layer, not just the cards:

- **Per-world HP** — volcano lower / more lethal; bird higher but you lose cards.
- **Per-world hand size** — bird smaller; you can only carry so much aloft.
- **Per-world draw formula** — volcano forces more world cards in; the eruption floods you.
- **Per-world global end-of-turn tick** — volcano: lose 1 HP every turn no matter what (ambient heat).
- **Per-world win condition** — zombie reaches the Door; volcano survives N turns (outrun the lava).

## ◈ Open questions (resolve before building)

Q1**Is "no energy" deliberate or an unfinished slice?** This is the biggest fork. Adding an energy budget makes `cost` meaningful and unlocks a whole class of "you can't clear everything, choose" decisions — itself a per-world lever (zombie gives lots of energy; volcano drains it from heat). Almost everything else is cheaper if this stays as-is, and more powerful if it changes.

Q2**How much divergence do you actually want?** Re-skinned-but-tuned (keyword bias + threat-verbs, all data) versus genuinely-different-rules (structural knobs, core changes). Very different amounts of work, and they're not mutually exclusive — keyword bias is worth doing regardless.

Q3**Does the shared starter deck stay sacred?** The keyword-bias win leans entirely on it being shared. But injecting *one* themed player card per world (Glide, Heat Shimmer) is another cheap differentiator that bends authoring rule D2.

## ◈ If we pull one thread first

Recommended order if this graduates from brainstorm: **(1) keyword bias** — free, immediate, differentiates all three; **(2) threat-verbs for zombie + volcano** — data-only, gives each its signature pressure; then **(3) decide Q1**, because the energy answer reshapes everything structural that follows. The bird's "displace" verb is the natural first core change to scope, since it's the world with no within-vocabulary identity.

Shattered Worlds · Brainstorm · related: `.lore/reference/theme-authoring.md`
