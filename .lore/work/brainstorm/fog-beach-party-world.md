---
title: "Fog Beach Party: the conceal world"
date: 2026-06-13
status: open
tags: [world-design, fog-beach-party, conceal, reveal, hidden, light, information-clock]
modules: [core-engine, world-data, renderer]
related: [.lore/work/brainstorm/new-world-concepts.md, .lore/work/brainstorm/overgrown-mall-world.html, .lore/work/brainstorm/shard-response-archetypes.html]
---

# Fog Beach Party: the conceal world

World 5. A beach party at golden hour. Then the fog rolls in off the water faster than fog should, and there is something in it. Stephen King's *The Mist* by way of a cooler full of warm beer and a half-built sandcastle. The place-vs-disaster contrast is the joy of the party against the meanness of the Mist: the brighter the party, the crueler the turn.

The threat-verb is **conceal**. Hazards arrive face-down. You cannot see what they are, you cannot aim at them, and they hurt you while you stand there blind. The response archetype is **reveal/scry**: light is the weapon, and the clock is your own decision quality.

This doc is the design exploration. Some decisions are settled (the user picked hard teeth and the Mall-mirror structure up front); the open questions are flagged as such and collected at the end.

## The core bet: Conceal is a depth, Light is a level

The Mall taught us a world can be nearly data-only. Fog cannot — "conceal" needs real core state. The model is a **light-versus-fog threshold**, not a boolean:

- Each hazard carries **`Conceal N`** — how deep in the fog it sits (Conceal 1 = light haze, Conceal 5 = nearly invisible).
- The player has one global **`Light`** level. A card is **visible iff `Light ≥ its Conceal`.** That's the whole rule. Light 4 shows you a Conceal 2 and a Conceal 4 simultaneously, for free — light isn't spent on seeing, it's a level you bathe the whole hand in.
- **Light decays 1 per turn.** The working level sits around 4 and you top it up with light cards. As it decays, the deepest hazards wink back out of view on their own — the fog literally closes back in. No special "re-conceal" mechanic needed; it's a consequence of the level dropping.

When a card is **concealed** (`Light < Conceal`), concealment is exactly two things and nothing more:

1. **No target.** It cannot be selected as the target of a single-target effect. You can't aim Explore into fog you can't see.
2. **No visible details.** Its name, cost, effect, keywords, and inset are hidden. On screen it's a fog-shrouded back; `describe.ts` says "lost in the fog."

Everything else resolves on the card's **true data:**

- **Area effects hit it.** `DealProgressAll` (Searchlight) chews through concealed cards, keyword bonuses and all. You watch progress move on a face-down card and don't learn what you wore down until it clears and reveals itself by dying.
- **`onEndOfTurn` ticks** normally. The threat grows whether you can see it or not.
- **Keyword bonuses apply** — not mechanically masked, only *visually* hidden. A `Slow` bonus lands on a concealed `Slow` hazard; you just aren't told why the number was bigger.

The design in one line: **all effects still happen, you just don't know why.** Raising Light above a card's Conceal restores targetability and visibility at once; letting Light decay below it takes them away again.

The teeth are sharp but local: you can't *snipe* the fog and you can't *see* it. You can still blanket it with area damage (inefficiently, blindly) and it still hurts you every turn. So the triage is real: pour light to snipe-and-see, sweep with AOE and pray, dump the shape blind, or eat the tick.

### Why this isn't a soft-lock (the escape valves)

Hard teeth raises the obvious fear: a hand full of concealed hazards, no reveal card, guaranteed damage with no recourse. The reassuring discovery is that the engine already has several non-reveal escape valves, so the player is rarely truly stuck:

1. **Blind discard.** Concealed hazards that are `discardable: true` can still be dumped via the `DiscardHazard` action — you flee the shape in the fog and *something* happens (its `onDiscarded` fires). You're gambling on an unknown cost. That is the information clock made literal: fleeing blind is a real, sometimes-bad decision, not a free out.
2. **Return to deck.** `Panic` (return 1–2) and `Barricade` (return ≤1) are in the shared starter deck. Shoving a concealed thing back into the fog works without revealing it. It re-conceals when redrawn, so it's a stall, not a solution.
3. **Reveal proper** — the world's own kit (below).

The design rule that falls out: **the punishing, high-tick concealed hazards must be `discardable`**, so a reveal-starved player always has the blind-discard valve. Only gentle, low-tick concealed clutter can be non-discardable.

### The chicken-and-egg, and how the capstone dodges it

Mall unlocks its player kit by clearing the Garden Center capstone (`onCleared` grants Pruning Shears / Machete / Weed Killer / Bloom). Fog mirrors this: a capstone grants the reveal kit. But if the capstone were itself concealed, you'd need reveal to clear it and the kit to get reveal. Deadlock.

Dodge: **the capstone — "The Bonfire" — is the one hazard that is NOT concealed.** It is a literal source of light; of course you can see it. It's a high-cost, visible hazard you race to clear, and clearing it hands you the reveal kit. Early concealed clutter is gentle and discardable; you survive the opening on blind-discard and starter cards while you burn the Bonfire down. Once it's cleared, you handle the fog properly.

Note the existing-card synergy that makes this coherent: **`Explore` (starter) deals +1 vs `Hidden`.** Under hard teeth it is *dead* against a concealed hazard (can't target it), but the instant you reveal, the hazard keeps its `Hidden` keyword and Explore becomes your finisher. Reveal-then-Explore is the natural combo, and it uses a card the player already owns.

## The Light resource — a decaying threshold

`light: number` on `GameState`, but it behaves as a **level, not a pool**. It is never consumed by seeing — only spent by time.

- **Visibility is a comparison, not a transaction.** Every turn, every world card in hand is visible if `Light ≥ Conceal`, concealed otherwise. Recomputed live as Light changes; nothing is stored as "revealed."
- **Decay: `Light = max(0, Light − 1)` at turn start.** This is the clock. Left alone, your light dims one step a turn and the fog creeps back in from the deep end first.
- **Baseline ~4.** You want a working level around 4 so a couple of turns' buffer exists against the decay and the mid-depth hazards stay lit. Open tuning question: is 4 the *starting* Light that decays toward 0, or a floor you never drop below? Leaning starting-value-that-decays, refueled by cards, but this wants playtest.
- **Light cards add to the level** via a single new `GainLight` effect. Because seeing is free and global, one `GainLight 4` re-lights everything at or below Conceal 4 at once.

This is the standing-flame fantasy after all — feed the fire and you see the whole beach; let it die and the Mist swallows the deep shapes first. The cost over the boolean model is one extra subtlety (a `conceal: number` per card and a derived-visibility check), but it buys the entire re-concealment dynamic for free and collapses the reveal kit down to "cards that add Light."

## The cards

### The three answers to fog (the strategic triangle)

Because concealment is narrow, there are three real ways to deal with a fog hand, each with a different cost:

- **Snipe** — single-target progress (`Explore`, already in the starter deck). Precise and efficient, but *blocked by concealment*: the target must be lit (`Light ≥ its Conceal`) before you can aim. The reward for keeping your light up.
- **Sweep** — area progress (`DealProgressAll`). Ignores light entirely, chews every world card in hand including deep fog. But it's spread thin and you're firing blind — you don't know what you're killing or whether you wasted it on a harmless Cooler.
- **See** — raise `Light` (`Flashlight`, `Flare Gun`, `Bonfire`). Lifts the visibility threshold so the fog's shapes resolve, unlocking the snipe *and* giving you the information to choose well.

Light is never strictly mandatory (sweep and blind-discard exist), which kills the soft-lock worry. But light is almost always *better*, which is what makes the world about light.

### Player light kit (unlocked by The Bonfire)

All "reveal" is now just adding Light, so the kit is `GainLight` cards differentiated by magnitude, cost, and persistence — plus the one sweep card.

| Card | Mall analog | Sketch |
|---|---|---|
| **Flashlight** | Pruning Shears (cleanup) | `energyCost 1`, `GainLight 2`, repeatable (no exhaust). The maintenance top-up — keep the shallow fog lit turn to turn. |
| **Flare Gun** | — | `energyCost 1`, `exhaust`, `GainLight 6`. A flare burns bright then dies: a one-shot that floods light over everything for a moment, which the 1/turn decay then bleeds away. The emergency "show me everything *now*." |
| **Bonfire** | (Brace from another world) | `energyCost 2`, `GainLight 4`. The sustained centerpiece. **Open:** to feel distinct from Flare it may also slow decay or set a temporary floor while it burns — a second bit of state we'd only add if a flat refuel feels too samey. |
| **Searchlight** | Weed Killer (AOE) | `energyCost 2`, `exhaust`, `DealProgressAll base 1, bonus { tag: Hidden, amount: 1 }`. The **sweep**: hits every world card in hand including concealed ones, extra against `Hidden` (which the fog all is). Area damage that passes straight through concealment, as you called for. |

The single-target heavy hitter is `Explore` from the shared starter (`+1 vs Hidden`), so the kit needs no Machete-equivalent; light-then-Explore is the snipe line. The kit is unlocked, not starter, so it doesn't leak into other worlds (same containment as Mall's kit).

### World hazards — the party turned mean

All carry `Concealed:N` and are tagged `Hidden` by convention (a shape in the mist) so the once-lit Explore/Searchlight payoffs apply. Conceal depth is a design dial: shallow hazards (Conceal 1–2) surface at a normal working light, deep ones (Conceal 4–5) only under a flare and are first to vanish as light decays. HP starts at 10; numbers tuned against Mall's escalation (gentle act 1 → brutal act 3). Names carry the place-vs-disaster irony: beach-party objects, now ominous.

| Hazard | Act | `Concealed:N` | `onEndOfTurn` | Discardable / `onDiscarded` | Role |
|---|---|---|---|---|---|
| **Rolling Fog** | 1 | 1 | `Damage 1` | yes / `None` | Cheap creep; shallow, almost always visible. Teaches the loop. |
| **Abandoned Cooler** | 1 | 2 | `None` | yes / `None` | **The false alarm.** Harmless, but at depth 2 it looks identical to a depth-2 monster. Pure noise — it makes spending light a real gamble. |
| **The Bonfire** (capstone) | 1–3 | none (visible) | `None` | yes / `None` | High cost (~6), never concealed (a light source), ~3 copies in act 1 like Garden Center. `onCleared` grants the light kit. Benign — just hard to clear. Walk away and you forfeit the kit. |
| **Something in the Mist** | 2 | 3 | `Damage 2` | yes / `Damage 2` | `Creature` + `Hidden`. Mauls you blind *and* lunges if you flee. Sits deep enough that a decaying light loses it first — but it looks exactly like a depth-3 nothing. The high-stakes light target. |
| **The Tide Coming In** | 2–3 | 3 | `Damage 2` | yes / `Damage 2` | Mid-game squeeze. Mean, so discardable per the rule. |
| **Whiteout** | 3 | 5 | `DamageScaled base 0, per { KeywordInHand: "Concealed" }, amount 1` | yes / `Damage 2` | **The mechanic's capstone.** Deepest fog in the game; end of turn deals 1 damage per `Concealed`-tagged card in hand (itself included). Punishes letting fog pile up; only a flare-level light burst sees it coming. |
| **The Walker** | 3 | none | `None` | (existing) | The shared run-capstone, one copy in act 3, as in every world. |

Two design notes that came out of writing the numbers:

- **Cooler is load-bearing, not filler.** A harmless concealed card is what makes concealment a real information problem: at equal Conceal depth every fog card looks identical, but some are Coolers (your light spent on nothing) and some are Somethings (deadly if ignored or blind-discarded). The decision-quality clock *is* "is it worth the light to find out." Without noise, light would be a rote "see the fog, then act" with no judgment. The Cooler supplies the judgment.
- **Whiteout closes the loop on the mechanic.** It's the one hazard whose damage scales with the fog you're carrying, so the world's tension (keep the hand lit) gets a hard enforcer in act 3. With numeric keywords it's just `DamageScaled per { KeywordInHand: "Concealed" }` — no bespoke counter. It counts every `Concealed`-tagged card in hand (lit or not), which is simpler and still reads as "the more Mist around you, the worse it is."

There is **no Spore-equivalent junk card.** "Infest" injected dead cards into your deck; "conceal" doesn't — the hazards themselves *are* the threat, just face-down. Fog's deck-pollution surface is zero; its novelty is concentrated entirely in the concealment state.

## Representation: Concealed as a numeric keyword

Conceal depth is stored not as a bespoke `conceal: number` field but as a **valued keyword, `Concealed:N`** — generalizing the keyword system to optionally carry a numeral. The motivation is that this isn't a one-off: world 6 (Whiteout, the *freeze* world) wants `Frozen:N` in the same shape, so two consecutive worlds justify the generalization. This is an **engine change, sequenced before the Fog content** (Fog is its first customer), mirroring the Mall rule of extending the `Keyword` union before using it.

Type design that keeps the blast radius sane:

- Split **`KeywordName`** (the string union — what `CounterSpec.keyword` and `DealProgress.bonus.tag` reference, matched by name, value ignored) from the runtime **`Keyword = { name: KeywordName; value?: number }`**.
- JSON authoring stays string-based with a `"Name"` / `"Name:N"` convention (`keywords: ["Hidden", "Concealed:3"]`), parsed at mint into the structured form. Existing flag keywords (`"Spore"`) barely change.
- Visibility reads it: `concealOf(card)` = the value of its `Concealed` keyword (0 if absent); `visible = light >= concealOf(card)`.

Two consequences worth noting:

- **Whiteout's counter dissolves into the generalized `KeywordInHand: "Concealed"`** — no bespoke `ConcealedInHand` variant needed. Caveat: that counts every `Concealed`-tagged card in hand, lit or not, rather than only those currently below the light line. "Damage per fog-thing you're carrying, lit or not" is simpler and still on-theme, so take it.
- **The `Concealed:N` chip is the one keyword still shown on a face-down card.** You hide identity but show depth, so the player knows how much light a shape needs. A Conceal 1 Rolling Fog and a Conceal 1 Cooler look identical, so depth leaks no identity — it's exactly the info light-management needs, in the natural place.

## Core integration (where the lift actually lands)

Two slices. The keyword generalization is engine-wide; the Fog world sits on top.

**Slice 1 — numeric keywords (engine, world-agnostic):**

- **`types.ts`**: split `KeywordName` (the existing string union + `"Concealed"`) from runtime `Keyword = { name: KeywordName; value?: number }`. `CounterSpec.keyword` and `DealProgress.bonus.tag` become `KeywordName`.
- **`cards.ts`**: parse `"Name"` / `"Name:N"` keyword strings into `{ name, value }` at mint.
- **Consumers**: every `keywords.includes(x)` becomes a name-match helper; `KeywordInHand` counting matches by name. This is the wide-but-mechanical part — touches available, describe, help, renderer chips.

**Slice 2 — Fog (light + concealment, on top of slice 1):**

- **`types.ts`**: add `light: number` to `GameState`; add `GainLight` to the `CardEffect` union; add `LightChanged` to `GameEvent`. **No `concealed` flag, no `Reveal`/`RevealAll` effects, no `ConcealedInHand` counter, no new `TargetSpec`** — all dissolved by the threshold model.
- **derived visibility**: a helper `isConcealed(card, light) = concealOf(card) > light`, where `concealOf` reads the `Concealed` keyword's value. Used by targeting, renderer, and describe. Nothing stored.
- **`effects/`**: one new handler, `GainLightHandler` (light += amount), registered in `registry.ts`. Needs an explicit `available.ts` entry (`isPlayable`/`structuralSpec` have silent default fallbacks — the Mall gotcha).
- **`available.ts`**: reuse the existing `hazard` `TargetSpec`; single-target progress `legalTargets` exclude cards where `isConcealed` (you can't snipe unlit fog). `DealProgressAll` (a `none` spec) does **not** skip them — it resolves on true data like any area effect. No core keyword masking; keywords function normally and the renderer alone hides them.
- **turn start (`energy.ts`)**: `light = max(0, light - 1)` (the decay clock), emit `LightChanged`. `onEndOfTurn` already fires for in-hand world cards, so "ticks while concealed" needs no new plumbing.
- **renderer `CardView`**: a card with `isConcealed` renders as a fog-back showing only its `Concealed:N` chip (depth visible, identity hidden). A `LightChanged` event re-evaluates the hand and animates shapes fading in/out as the light line moves. The core exposes `light` and `Concealed:N`; the renderer derives and hides — determinism untouched.
- **`describe.ts`**: concealed cards describe as "lost in the fog (needs Light N)" rather than their real text.

### A subtlety worth not getting wrong: `Hidden` keyword vs concealment

These are two different things and must stay orthogonal:

- **`Hidden`** is a static, value-less keyword (a tag the card is born with — `Door` has it). It means "this lurks," and player cards bonus against it. It is *permanent*.
- **Concealment** is a *derived, transient* condition: a card is concealed while `Light < its Concealed:N value`. The `Concealed:N` keyword is permanent (the card is always that deep in potential fog), but whether it's *currently* concealed depends on the live light level.

A card can be `Hidden` without ever being concealed (`Door`, which has no `Concealed:N`), and concealed without being `Hidden`. In Fog they travel together by authoring convention — a shape in the mist is both — but they're independent properties. The payoff this protects: raising light un-conceals a hazard but it *keeps* its `Hidden` keyword, so `Explore`'s `+1 vs Hidden` still lands. Light changes visibility; it never touches keywords.

## Bad ideas and open tensions (the honest list)

- **Keyword masking is dead (and good riddance).** An earlier draft had concealment mechanically mask keywords. Dropped: concealment is now purely "no target + no visible details," and keywords function normally underneath (visually hidden only). This is simpler to implement, simpler to reason about, and it's what makes `DealProgressAll`-through-fog work without special cases.
- **Does the sweep make reveal pointless?** No — sweep (`Searchlight`/`DealProgressAll`) is `exhaust`, spread thin across the whole hand, and blind (you might be dumping progress into a harmless Cooler). Reveal-then-Explore concentrates force on the one thing that matters and lets you *choose* it. Sweep is the panic button; reveal is the skilled line. They coexist.
- **Does an "information clock" actually create fun decisions, or just annoyance?** The teeth are what save it: concealment isn't merely hidden info, it's hidden + harmful + uninteractable, so every turn is a concrete triage (reveal / blind-discard / endure). If we ever softened the teeth, the clock would collapse into "mildly annoying fog of war." The teeth are non-negotiable for this world to have a point.
- **Blind-discard asymmetry.** You can flee a concealed shape (discard) but not attack it (progress). Is that weird? I think it's *good* weird and on-theme (you can run from what you can't see, you can't aim at it), but it's worth a gut-check in playtest.
- **Act-1 light availability before the Bonfire is cleared.** The plan leans on blind-discard + Panic/Barricade + a low starting Light + the gentle act-1 hazards (Rolling Fog ticks 1, Cooler ticks 0) until a Bonfire copy falls. Leaning toward "no special leg-up needed" given ~3 visible Bonfire copies in act 1, but this is the single biggest tuning risk and the first thing to watch in playtest. The fallback if act 1 feels miserable: give one Rolling Fog copy an `onDiscarded` that grants a single Flashlight, or simply start the world with Light 4.
- **Baseline light and decay tuning.** The whole world lives or dies on the relationship between starting Light, the 1/turn decay, the Conceal depths in each act, and how much light the kit restores. These four numbers are one tuning surface and can only really be balanced against a playable build. The brainstorm fixes the *shape*; the numbers are deliberately soft.

## What's settled vs open

**Settled:**

- **Concealment is exactly two things** — no single-target + no visible details — and everything else (area effects, keyword bonuses, `onEndOfTurn`) resolves on true data: "all effects still happen, you just don't know why." `DealProgressAll` passes through fog; no core keyword masking (visual only).
- **Light is a decaying threshold, not a pool.** Visible iff `Light ≥ Conceal`; `Light -= 1` each turn; baseline ~4. Seeing is free and global; the fog closes back in automatically as light decays.
- **Conceal is a numeric keyword, `Concealed:N`** — generalize keywords to carry an optional value. Engine slice sequenced before Fog, justified by Fog (`Concealed`) plus world 6 (`Frozen`). Dissolves the boolean flag, the `Reveal`/`RevealAll` effects, and the `ConcealedInHand` counter.
- **Strategic triangle** snipe / sweep / see; single-target heavy hitter is starter `Explore`; the kit is `GainLight` cards (Flashlight/Flare/Bonfire) plus `Searchlight = DealProgressAll + Hidden` (the sweep through fog). Single new effect: `GainLight`. Reuses the `hazard` `TargetSpec` (handler-level filtering).
- Mall-mirror structure (one folder, 3 acts, capstone-unlocked kit); `Hidden` keyword stays orthogonal to concealment (light never touches keywords).

**Still open, for spec or playtest:**
1. The four-number tuning surface — starting Light, decay rate, per-act Conceal depths, kit light-restore amounts. Soft until there's a playable build.
2. Act-1 leg-up — ship without it and watch, or start the world with Light 4 / grant an early Flashlight?
3. Bonfire's distinctiveness — flat `GainLight 4`, or a second bit of state (slow decay / set a floor) so it doesn't feel like a bigger Flare?
4. Whether the `Concealed:N` depth is *always* shown on the fog-back (leaning yes — light management needs it) or itself partially hidden.
5. Theme/visual identity (`theme.ts` hues, the fog-back art, the light-line fade animation) — not yet explored; a `theme.ts` + asset pass like Mall's.
6. Scope/sequencing call: do the numeric-keyword engine slice and the Fog world go in one spec or two?
