---
title: "Overgrown Mall: the infest world"
date: "2026-06-11"
status: "resolved"
tags: ['world-design', 'overgrown-mall', 'infest', 'spore', 'deck-pollution', 'prune-and-profit']
modules: ['core-engine', 'world-data']
---

Shattered Worlds · Brainstorm

# Overgrown Mall: the infest world

"The rot gets into your deck — prune it, or grow with it." Nature rapidly and dangerously reclaiming civilization; American malls were already dying on a forty-year clock, the disaster just compresses it.

Status: open · 2026-06-11 · fourth world candidate

## Where it sits in the shard map

The [response-archetype proposal](shard-response-archetypes.html) gave the shipped trio their identities. The Mall claims the first unclaimed clock: your own deck's purity.

| World | Threat-verb | Response archetype | Clock |
| --- | --- | --- | --- |
| Zombie big-box | multiply | sweep & noise | HP |
| Bird building | snatch | travel light | card attrition |
| Highway volcano | compound/clog | everything is fuel | deck race / hand clog |
| **Overgrown Mall** | **infest** | **prune & profit** | **player-deck pollution** |

**Theme rule (named 2026-06-11):** the place and the disaster argue with each other, and what's happening shouldn't quite make sense. Visual flag: this is the second retail interior after zombie-big-box — the overgrowth must fight for identity. Zombie big-box is fluorescent and dead; the Mall is green light through a broken skylight, planters gone feral, act 3 a forest.

## Engine ground truth

 Verified in core

`GainCard` resolves to `gainCard(…, 'playerDiscard')` (`effects.ts:365`) — gained cards enter the **player discard** and arrive via reshuffle. `AddPlayerCardToTop` resolves to `'playerDrawTop'` — straight onto the draw pile, drawn next turn guaranteed. The hand always refills to `WORLD_CONSTS.maxHandSize` split between world and player cards, so **every Spore drawn displaces a useful player card that turn**. The clog is automatic; the engine already enforces the clock.

## The central question: what is a Spore?

Four competing designs. **Decided 2026-06-11: B is the Spore, D is the reward for refusing to prune** — giving the world two legitimate lines, mirroring zombie-world's quiet/loud fork.

#### Rejected A · Pure dead weight

No effect, unplayable, just clogs. Honest but decision-free — Principle 1 wants every card to ask a question. Keep only if playtesting says the world needs simplifying.

#### Decided B · Self-pruning exhaust

`energyCost: 1, exhaust: true, effect: None, keywords: ["Spore"]`. Playing a Spore *is* pruning it — costs a card play and an energy, then leaves the run forever. Resolves "dead weight vs. playable-at-a-cost" by making the cost **tempo itself**. Every Spore in hand asks: prune now, or hold the dead slot? If core rejects a no-op player effect, add the allowance — the design is locked regardless (Q1 resolution).

#### Rejected C · Playable with teeth

Real but unpleasant effect, e.g. `Sequence [Damage 1, Draw 1]` ("inhale"). Worry: converges on Panic, which already exists as the shared junk card (Screams, Ash Fall). Spore should be a slow choke, not chaos. One pollution identity per world.

#### Wave 2 D · Symbiosis — grow with it

**Bloom**: `DealProgressScaled, per: { kind: "KeywordInHand", keyword: "Spore" }`. Per the Q3 resolution, the counter is a *spec*, keyword-based — extensible to other spore types without touching the effect, and the bird brainstorm's `emptyHandSlot` becomes just another counter kind in the same spec. Requires `keywords` on player card templates (decided: good idea independently). The Annihilation move: stop fighting the overgrowth, become it. A deck full of Spores becomes a build.

## Infest delivery — three speeds, one per act

Acts escalate by switching *delivery mechanism*, not just counts:

| Speed | Hook | Feel | Act |
| --- | --- | --- | --- |
| Punish avoidance | `onDiscarded: GainCard Spore` | "You brushed past the planter" | 1 |
| The drip | `onEndOfTurn: GainCard Spore` | Pollen on a timer; arrives via reshuffle | 1–2 |
| The cruelty | `onEndOfTurn: AddPlayerCardToTop Spore` | You *will* draw it next turn | 3 |

## Threat sketches (mall flavor)

| Card | Act | Sketch |
| --- | --- | --- |
| Burst Planter | 1 | cost 1, `onDiscarded: GainCard Spore` — the Rubble-equivalent, but dodging it dirties you |
| Pollen Haze | 1–2 | cost 2, `onEndOfTurn: GainCard Spore` — the clock |
| Kudzu Curtain | 2 | cost 2, `discardable: false` — a wall of green, pure obstruction |
| Something in the Atrium | 2–3 | `Creature` keyword — the fauna that moved in; keeps cross-world weapons (Bat, Axe) relevant |
| Fountain Bloom | 3 | `onEndOfTurn: Sequence [AddPlayerCardToTop Spore, AddWorldCardToTop Burst Planter]` — spreads on *both* sides of the table. Possibly too mean; tune carefully |
| The Garden Center | find, Hidden | `onCleared`: the prune rewards. The mall contains its own cure — good irony |

Capstone stays **The Walker** per the shared template.

## Prune & profit rewards (garden center loot)

| Card | Sketch | Effort |
| --- | --- | --- |
| Pruning Shears | `Sequence [DestroyCardInHand 1–1, GainEnergy 1]` | data-only |
| Machete | `DealProgress 1, bonus Creature +3` — the weapon slot | data-only |
| Weed Killer | `exhaust, DealProgressAll base 1` — borrows zombie's cleave for the green wall (see Q6) | data-only |
| Bloom | `DealProgressScaled per sporeInHand` — the symbiosis payoff | core (shared with bird wave 2) |

The profit-per-prune dream card ("gain X *per* card destroyed") needs new scaling state — **parked**. Sequence-based destroy-then-payoff gets 90% of the feel free; Cut It Loose already proved the pattern.

## Cross-world texture

Zombie-world's **Regroup** (`DestroyCardInHand 0–2`) is mediocre at home and *premium* in the Mall. First concrete case of Destiny meta-progression mattering: a card's value depends on which shard you carry it into. If meta-progression lets cards cross worlds, the Mall retroactively makes old rewards interesting. Bird-building's travel-light tools double as Mall prune tools — the two worlds want the same thin-deck Destiny.

## Dead ends, kept on purpose

Dead end Spores that *transform* into worse cards over time — no mechanism for time-based card mutation, and act-based delivery escalation gets the same feeling cheaper.

Dead end Spores in the *world* deck too — muddies whose pollution it is; the volcano already owns world-deck clog.

Dead end Reading the discard pile for "compost" payoffs — no effect reads the discard today. Cool, expensive, later.

## Decisions (resolved 2026-06-11)

Q1 · resolved

Design B is locked regardless of whether core currently permits a no-op player effect. If it doesn't, add the allowance — the legality question is an implementation detail, not a design input.

Q2 · resolved

The existing reshuffle timing is acceptable: a Spore gained into the discard can surface the same run via reshuffle. No special-casing.

Q3 · resolved

**Keywords, not template names.** The scaling counter is `{ kind: "KeywordInHand", keyword: "Spore" }` — extensible to other spore variants without touching the effect. This requires `keywords` on player card templates, which is a good idea independently (player-side tags unlock conditional effects across all worlds). The bird's `emptyHandSlot` becomes another counter kind in the same spec.

Q4 · resolved

Spore-per-act counts are pure tuning — easily human-tweakable in the world JSON. Don't over-engineer the budget math up front.

Q5 · resolved

**No Panic in the Mall.** One pollution identity per world; Spore is strictly the Mall's junk card.

## Still open

Q6 · resolved (during specify, 2026-06-11)

**Keep Weed Killer.** A single exhaust copy of `DealProgressAll` doesn't dilute zombie-world's repeatable sweep build; the green wall needs an answer and reusing a shipped effect is free. Specced in `.lore/work/specs/overgrown-mall.html` REQ-MALL-15.

No questions remain open; the spec is the live document.

Brainstorm · Overgrown Mall · fourth world · companions approved same session: Fog Beach Party (conceal), Whiteout Parking Garage (freeze)
