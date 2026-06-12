---
name: new-world-concepts
description: "Approved concepts for worlds 4-6 (Overgrown Mall, Fog Beach Party, Whiteout Parking Garage) and the contrast theme rule"
metadata: 
  node_type: memory
  type: project
  originSessionId: f3a93c6a-c50b-4d80-9a00-540927a2b739
---

Three new world concepts approved 2026-06-11, extending the shipped trio (zombie-big-box, bird-building, highway-volcano; see [[shard-differentiation-proposal]]):

- **Overgrown Mall** — nature rapidly reclaiming civilization. Threat-verb: *infest* (world cards inject dead Spore cards into the player deck via GainCard). Response archetype: prune & profit. Clock: player-deck pollution. Nearly data-only. Flag: second retail interior after zombie-big-box; differentiate visually (green/feral vs. fluorescent/dead).
- **Fog Beach Party** — fast fog rolls over a beach party; something is in the Mist (Stephen King homage). Threat-verb: *conceal* (world cards arrive face-down; Hidden becomes literal). Response archetype: reveal/scry, light as the resource (bonfires, flares). Clock: information / decision quality. Moderate core change (renderer must actually hide info). Creatures in the fog stack with the existing Creature tag.
- **Whiteout Parking Garage** — flash blizzard starting a new ice age. Threat-verb: *freeze* (locks hand cards unplayable until thawed). Response archetype: heat economy (thaw, burn cards for warmth). Clock: hand usability. Biggest lift: new frozen state on hand cards, mirroring how braceCharges was added.

**Theme rule (named this session):** the place and the disaster argue with each other, and what's happening shouldn't make complete sense. Malls were already declining (disaster rushes it); parking garages are emotionally cold concrete (now literally cold); a beach party is joy (the Mist turn is meaner for it). Shipped worlds follow this implicitly. Use this rule when pitching future worlds.

Recommended order: Mall 4th (cheapest, proves archetype framework scales), Fog Beach 5th (most novel clock), Whiteout 6th.

Mall brainstorm (`.lore/work/brainstorm/overgrown-mall-world.html`, status resolved) fed a full spec: **`.lore/work/specs/overgrown-mall.html`, REQ-MALL-1..28, status draft, reviewed by spec-reviewer with all findings applied (2026-06-11).** Spec covers everything in one release — no phasing (user: "spec everything, you are being too conservative"). Key locked decisions: Spore = `energyCost 1, exhaust, effect None, keywords ["Spore"]`; Bloom = `DealProgressScaled per { kind: "KeywordInHand", keyword: "Spore" }` (counter is an extensible spec); extend `Keyword` union BEFORE adding `keywords: readonly Keyword[]` to PlayerCardTemplate; Weed Killer keeps DealProgressAll (Q6 resolved); explicit `available.ts` cases required (`isPlayable`/`structuralSpec` have silent default fallbacks); inset art may be placeholder per precedent.

**World Select blocker (decided, not yet specced):** 4 cards don't fit — 4×240 + 3×30 = 1050px > 900px canvas (`WORLD_SELECT_LAYOUT` in `src/game/view/layout.ts`, `WorldSelectScene.ts` lays out all worlds in one row). Decision: shift-by-ONE carousel (arrows tween the row one card at a time, edge cards peek at partial opacity), NOT page-flip-by-3 (orphan pages) and NOT shrinking cards. Belongs as an amendment to the existing world-select spec, separate from the Mall spec.

**Next step (user moving to fresh context):** plan the Mall implementation from the spec (`/lore-development:prep-plan`), plus the world-select carousel amendment. Reference doc bug to fix during docs pass: theme-authoring SV1 table has bird/volcano archetypes transposed (REQ-MALL-25).
