---
title: "Each shard answers differently: new effects for world identity"
date: "2026-06-10"
status: "resolved"
tags: ['world', 'differentiation', 'effects', 'archetype', 'deckbuilder', 'zombie-big-box', 'bird-building', 'highway-volcano']
modules: ['core-engine', 'worlds', 'data']
---

Shattered Worlds · Proposal

# Each shard *answers* differently

The threat-verbs shipped — Zombie multiplies, Lava compounds, the Bird snatches. The worlds now hit you differently, but you answer them with the same three cards wearing different art. This proposal gives each shard a nameable response archetype: new player-side effects, plus data-only tweaks.

Status: proposed · 2026-06-10

Effort tags: no code data-only, reuses existing effects · data + tuning recompose effects/composition · core change new effect kind or state shape

## ◈ Where the June 7 brainstorm got us

The [prior brainstorm](theme-mechanical-differentiation.html) diagnosed the worlds as reskins and prescribed threat-verbs. Most of that shipped: energy exists now (`energy.ts`, cost gating in `handlePlayCard`), the Zombie's `onEndOfTurn` spawns another Zombie, Lava Flow compounds (`ForceDestroy` + Ash Fall spawn), and the Bird's "displace" verb became the `ForceDestroy` / `pendingForceDestroy` pipeline. Corpses reanimate. The *threat side* diverged.

The remaining sameness is on the response side. Read the three world files next to each other and the player-facing cards are literally identical:

| Role | Zombie big-box | Bird building | Highway volcano | Effect |
| --- | --- | --- | --- | --- |
| Scout reward | Listen | Find Footing | Spot a Path | `DealProgress 2, Hidden +2` — same card ×3 |
| Weapon reward | Baseball Bat | Fire Axe | Floor It | `DealProgress 1, +3` — same card, keyword swapped |
| Utility reward | Regroup | Steady | Ditch Gear | `DestroyCardInHand 0–1, maxCost 2` — same card ×3 |
| Act shape | 3 acts, 6 / 6–7 / 6 cards, Walker capstone — same template ×3 |  |  |  |

⊘**Why tuning can't fix this.** The worlds differ in *which clock ticks* (HP vs. deck attrition vs. hand clog), but every clock is answered the same way: target the hazard, deal progress, occasionally thin a card. When the response toolkit is constant, the player's *decisions* are constant — and Principle 2 says a world ships only when it forces a different way to *build*. Threat divergence alone got us to "moderately different." Response divergence is the other half.

**The design move:** give each world one signature player verb that only exists there, make the world's threat-verb *reward* that verb, and rewrite the identical reward trio around it. Each archetype must pass the Principle 5 test — explainable in one sentence.

| World | Threat-verb (shipped) | Response archetype (proposed) | One-sentence synergy |
| --- | --- | --- | --- |
| Zombie big-box | *multiply* | Sweep & noise | "Go loud and sweep the horde, or stay quiet and pick them off." |
| Bird building | *snatch* | Travel light | "Anything you carry, the sky can take — so carry less, and grip what matters." |
| Highway volcano | *compound* | Everything is fuel | "You can't fight the volcano, only outrun it — burn HP, gear, and whole stretches of road." |

## ◈ Zombie big-box — sweep & noise

The Zombie spawning loop is the world's identity, but every player tool is single-target, so the horde is just a slow HP tax. Two changes make the swarm a *puzzle*: a tool that wants the horde big, and power that makes it bigger.

 New effect · cleave

**`DealProgressAll`** — deal progress to *every* world card in hand at once.

```
{ "kind": "DealProgressAll", "base": 1, "bonus": { "tag": "Creature", "amount": 1 } }
```

Engine: loop `dealProgress` over a snapshot of world cards in hand; `TargetSpec` is `{ kind: 'none' }` — no targeting UI needed. Card sketch: Shelf Sweep (2 energy, reward for clearing Strange Sounds late-act). Suddenly "let three Zombies accumulate, then sweep" is a real line — the first strategy in the game where a growing hand of hazards is something you *chose*.

 Data only · loud weapons

Big hits make noise; noise draws the horde. Shotgun (act-2/3 find, replaces one Find Baseball Bat): `Sequence [ DealProgress 5, AddWorldCardToTop "Zombie" ]`. Every effect already exists. This is the Principle 1 card: never an auto-pick, because the answer to "is +5 progress worth +1 Zombie?" depends entirely on whether you drafted sweep.

 Data only · kill chains

Change Zombie's `onCleared` from `None` to `GainEnergy 1`. Killing fuels the next kill; the kill-or-discard decision becomes tempo (energy now) vs. health (5 damage on discard) instead of damage-vs-damage. Tuning risk flagged in open questions.

## ◈ Bird building — travel light

The Bird already eats your cards, but `ForceDestroy` is pure punishment — there is no counterplay and no way to lean in. Attrition becomes an *economy* when the player can both defend against it and exploit it.

 New effect · brace

**`Brace`** — absorb the next N snatches before they take a card.

```
{ "kind": "Brace", "amount": 1 }
```

Engine: new `braceCharges` counter on `GameState`; `resolveForceDestroy` drains brace before destroying (must be a persistent counter, not a subtraction from `pendingForceDestroy`, because snatches queue at end-of-turn after the brace was played). Card sketch: rework Steady (1 energy, Brace 1) — "lash yourself down." The first time a Talon's snatch fizzles against your rope, the world's identity clicks.

 New effect · unburdened (wave 2)

**`DealProgressScaled`** — progress that scales with how light you're traveling.

```
{ "kind": "DealProgressScaled", "base": 1, "per": "emptyHandSlot", "amount": 1 }
```

Engine: same shape as `DealProgress` with the amount computed from state (empty hand slots = `maxHandSize − hand.length` at resolution); fully deterministic. Card sketch: Unburdened. The world that destroys your cards becomes the world where a thin hand is a *build* — bird-building runs want exhaust cards and Regroup-style thinning from other shards' rewards, which is exactly the cross-world Destiny texture we want.

 Data only · feed the bird

Cut It Loose (replaces the Steady slot's twin): `Sequence [ DestroyCardInHand 1–1, DealProgress 4 ]` — hurl your gear to drive the Talon off. Destroy-as-cost plus compound targeting both exist (Barricade already composes a compound spec). Sacrifice on your terms vs. theft on the Bird's terms is the whole archetype in one card.

## ◈ Highway volcano — everything is fuel

Gridlock and Ash Fall make this the clog/pollution world, but the player's only response is the same generic clearing. The volcano should be the world you *don't fight*: you spend resources other worlds protect — HP, cards, and the road itself.

 New effect · bypass

**`ExileTopWorldCards`** — remove the top N cards of the world deck from the game, unseen.

```
{ "kind": "ExileTopWorldCards", "amount": 2 }
```

The only verb in the game that *skips content instead of clearing it* — racing past hazards you never face. Card sketch: rework Floor It (the Find a Vehicle reward, exhaust): exile the top 2 cards of the world deck.

**Exilability is a template flag.** Mirroring `discardable`, `WorldCardTemplate` gains `canExile: boolean` (default `true`); Door and The Walker ship with `canExile: false` — the win condition can never be raced past. Resolution rule: walk from the top of the world deck, exiling exilable cards until the amount is spent; non-exilable cards are skipped in place, preserving their order. With the Walker un-exilable, the livelock guards in `reduce.ts` still need a test pass (exile must not strand a run with no world cards and no `AddWorldCardToTop` escape), but the win path itself is safe by construction.

 Data only · HP as fuel

Push Through (Tremors reward, replacing Spot a Path's clone): `Sequence [ DealProgress 4 (Slow +2), Damage 1 ]` — sprint through the heat. Zombie-world HP loss is imposed; volcano HP loss is *spent*. Same resource, opposite decision, and it's all existing effects.

 Data only · consumables

The `exhaust` flag already exists on `PlayerCardTemplate` and no world uses it. Make volcano the exhaust world: Nitro (exhaust: `GainEnergy 2` + `Draw 2`), and rework Ditch Gear to exhaust with `Sequence [ DestroyCardInHand 1–1, GainEnergy 2 ]` — burn gear for speed. Everything in this world is one-shot; your deck literally burns down as the run progresses, which doubles as natural thinning for the late acts.

## ◈ The reward-trio rewrite (where it all lands)

With the new effects in place, the three identical trios become nine distinct cards. This is the table to implement from:

| Slot | Zombie big-box | Bird building | Highway volcano |
| --- | --- | --- | --- |
| Scout reward | **Listen** — keep as-is (`DealProgress 2, Hidden +2`); quiet scouting is on-theme here | **Find Footing** → `DealProgressScaled` "Unburdened" shape core change | **Spot a Path** → **Push Through**: progress + self-damage no code |
| Weapon reward | **Baseball Bat** keep; add **Shotgun** as the loud act-3 find no code | **Fire Axe** keep (the one tool the Bird respects) | **Floor It** → exhaust, `ExileTopWorldCards 2` core change |
| Utility reward | **Regroup** — keep destroy-thinning (quiet, methodical) | **Steady** → `Brace 1` core change; sibling **Cut It Loose** no code | **Ditch Gear** → exhaust, destroy-for-energy no code |
| Signature (new slot) | **Shelf Sweep** — `DealProgressAll` core change | — | **Nitro** — exhaust draw/energy burst no code |

## ◈ Cheap structural tweaks that compound the above data + tuning

 Finish the keyword bias

The prior brainstorm's keyword-saturation table is only half-applied: volcano has exactly one `Slow` card and bird one `Hidden`+`Creature`. Push it: Gridlock and Ash Fall gain `Slow`; Shadow Overhead and Sliding Debris gain `Hidden`. The shared starter deck (Sprint keys off Slow, Explore off Hidden) then plays differently per world for free.

 Break the act-shape template

All three worlds use the same 6 / 6–7 / 6 three-act curve. Shape the curve to the verb: **zombie** escalates body count (5 / 7 / 9 cheap-but-multiplying); **bird** stays sparse but every act mixes in snatchers (attrition is constant, not back-loaded); **volcano** seeds Gridlock in *every* act so the clog never lets up and bypass always has a target.

 Wild · per-world intensity weights

Still unbuilt from the prior brainstorm: `intensity()` is hardcoded 0.6 act / 0.3 hp / 0.1 held. Per-world weights would make the juice crescendo from each world's actual pressure source (volcano on time, bird on attrition, zombie on HP). Renderer-facing, zero gameplay risk.

## ◈ Engine work summary

| Effect | Wave | New state | Touches | Notes |
| --- | --- | --- | --- | --- |
| `DealProgressAll` | 1 | none | `types.ts`, `effects.ts`, `available.ts` (spec `none`), `describe.ts`, tests | Reuses `dealProgress` per hazard; emits one `ProgressDealt` per hazard so the renderer can stagger the sweep |
| `Brace` | 1 | `braceCharges: number` | `types.ts`, `effects.ts`, `draw.ts` (`resolveForceDestroy`), `describe.ts`, tests | Drain brace before destroying; needs a `BraceConsumed`-style event for feedback |
| `ExileTopWorldCards` | 1 | none | `types.ts`, `cards.ts` (`canExile` on `WorldCardTemplate` + `WorldCard`), `effects.ts`, `describe.ts`, world JSON (Door, Walker), tests | Skips `canExile: false` cards in place; test both livelock guards in `reduce.ts` |
| `DealProgressScaled` | 2 | none | `types.ts`, `effects.ts`, `available.ts`, `describe.ts`, tests | Deterministic state read; ship after wave 1 proves the archetype framing |

All four are pure, deterministic, JSON-expressible, and need no new targeting UI beyond specs that already exist. Per the core/game boundary, each lands with full core tests before any renderer work.

## ◈ Open questions — all resolved 2026-06-10

Q1**What can exile skip?** Resolved: exilability is a per-template flag, `canExile`, mirroring `discardable`. Door and The Walker are marked `canExile: false`; exile slides past them, so blind exile can still eat a Find (the owned gamble, per Principle 4) but never the win condition. Details in the volcano section above.

Q2**Does kill-energy snowball?** Resolved: ship it and see how it plays. Bounded by hand size and sweep card count in theory; Principle 6 says the verdict comes from playtest data, not pre-tuning by feel.

Q3**Amend the theme-authoring recipe?** Resolved: yes. The five-archetype recipe in `theme-authoring.md` is what produced the identical trios — it created this mess and must change with this proposal, not after it. New rule to add: every world defines one signature player verb, and no other world's recipe slot may reuse it.

## ◈ Recommended order

(1) **Data-only batch first** — Shotgun, kill-energy, Push Through, exhaust consumables, keyword saturation, act shapes. One JSON-heavy PR, immediate feel delta, zero engine risk. (2) **Amend the theme-authoring recipe** (Q3) in the same breath, so no new world is authored against the old template while this lands. (3) **Wave-1 effects** — `Brace` then `DealProgressAll` then `ExileTopWorldCards` with the `canExile` flag (rising order of design risk). (4) **Trio rewrite** lands with each effect as it ships. (5) **Wave 2** (`DealProgressScaled`) only after playtest confirms "travel light" reads as an archetype.

Shattered Worlds · Proposal · builds on [theme-mechanical-differentiation](theme-mechanical-differentiation.html) · related: [theme-authoring](../../reference/theme-authoring.md), [vision](../../reference/vision.html)
