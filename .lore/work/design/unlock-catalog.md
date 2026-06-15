---
title: Unlock catalog design — Destiny Blessings
date: 2026-06-15
status: draft
tags: [meta-progression, unlocks, balance, catalog, destiny-weight, fragments]
modules: [feats, meta-progression, core-engine]
related:
  - .lore/work/brainstorm/unlock-system.md
  - .lore/work/brainstorm/feat-definitions.md
---

# Unlock catalog design — Destiny Blessings

## Scope

This document designs the unlock catalog: the ten purchasable items the player can spend Memory Fragments on, and what each one does mechanically. It does not design the shop UX, the persistence layer, or the activation screen (per-run Destiny budget selector). Those are downstream.

The brainstorm established:
- **Unique unlocks only.** No stacking — each unlock exists once. Tiers are separate catalog entries.
- **Point budget (5 Destiny Points per run).** Each unlock has a weight 1–3. The activation budget prevents stacking everything.
- **Purchase layer first, activation layer later.** MVP applies all purchased unlocks; the selection screen comes once ≥6 unlocks exist.

---

## Budget validation

Budget of 5 with weights 1–3. Testing that interesting builds emerge without feeling trivially constrained:

<table style="border-collapse:collapse; font-size:0.9em;">
<thead>
<tr style="background:#f0f0f0;">
  <th style="padding:6px 12px; text-align:left;">Build name</th>
  <th style="padding:6px 12px; text-align:left;">Unlocks</th>
  <th style="padding:6px 12px; text-align:center;">Total weight</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:5px 12px;">Fog specialist</td><td style="padding:5px 12px;">Fog Lantern (1) + Fog Signal (2) + Adaptable (2)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:5px 12px;">Athlete</td><td style="padding:5px 12px;">Athlete's Instinct (3) + Tough Hide (1) + Charged (1)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
<tr><td style="padding:5px 12px;">Explorer</td><td style="padding:5px 12px;">Fortune (3) + Fog Lantern (1) + Braced (1)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:5px 12px;">Aggressor</td><td style="padding:5px 12px;">Sharpened Instincts (2) + Adaptable (2) + Charged (1)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
<tr><td style="padding:5px 12px;">Survivor</td><td style="padding:5px 12px;">Steady Pulse (2) + Sharpened Instincts (2) + Tough Hide (1)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:5px 12px;">Bird specialist</td><td style="padding:5px 12px;">Braced (1) + Adaptable (2) + Steady Pulse (2)</td><td style="padding:5px 12px; text-align:center;">5</td></tr>
</tbody>
</table>

All six builds feel distinct. The budget is confirmed at 5.

A player cannot meaningfully fill the budget until they have purchased at least 2 unlocks. This means the budget design isn't felt until the collection grows — exactly the right timing.

---

## The catalog

Ten unlocks, covering all six categories from the design notes.

### Category: Starting stats (weight 1)

These are the cheapest and lightest unlocks. They smooth the opening of a run without shaping strategy. Weight 1 each because they're world-specific in effect (light, brace) or single-turn in impact (charged).

---

**Tough Hide** `extra-hp`

> *The memory of surviving worse than this.*

Start each run with +3 HP (13 total instead of 10).

- **Cost:** 15 fragments
- **Weight:** 1
- **Effect:** `{ type: 'startingStat', stat: 'hp', amount: 3 }`
- **Rationale:** +30% HP is meaningful (lets you absorb one extra hit, extends the window for recoveries) without warping strategy. First unlock a new player can afford — reachable after 2 wins and the Iron Will feat. Low weight because HP buffs don't shape turn decisions.

---

**Charged** `extra-energy`

> *You remember how it felt to move fast when it mattered.*

Start the run with +1 energy. Your first turn has 2 energy instead of 1.

- **Cost:** 20 fragments
- **Weight:** 1
- **Effect:** `{ type: 'startingStat', stat: 'energy', amount: 1 }`
- **Rationale:** Affects only turn 1 (the initial state's energy field before `startTurn` fires). A tempo boost on the opener — play a Sprint and still have energy left, or open with Barricade + Explore. Doesn't compound. Weight 1 because the advantage decays to zero within one turn.
- **Engine note:** `createWorld` sets `energy: 0` in the skeleton state. This unlock adds to that initial value before `startTurn` fires its own `+1`. The player opens with 2 energy.

---

**Fog Lantern** `extra-light`

> *You packed an extra flashlight. It felt like superstition.*

Start each run with +2 light (Fog Beach Party: 7 instead of 5, other worlds: no effect).

- **Cost:** 20 fragments
- **Weight:** 1
- **Effect:** `{ type: 'startingStat', stat: 'light', amount: 2 }`
- **Rationale:** Buys two extra turns before light decay forces you to light the kit. Meaningful in Fog Beach Party; completely inert everywhere else. Weight 1 because it's world-specific and only affects the opening curve, not the mid-run decision loop.

---

**Braced** `extra-brace`

> *Shoulders back. Ready for something to grab.*

Start each run with +2 brace charges (Bird Building: 2 free absorbs before you've played a card).

- **Cost:** 20 fragments
- **Weight:** 1
- **Effect:** `{ type: 'startingStat', stat: 'brace', amount: 2 }`
- **Rationale:** Absorbs 2 ForceDestroy triggers before you've played a single Steady. In Bird Building this is strong insurance against an unlucky opening act; everywhere else it does nothing (no brace mechanic). Weight 1 for same reason as Fog Lantern — world-specific effect.

---

### Category: Hand size (weight 2)

One unlock. It scales, so it earns weight 2.

---

**Adaptable** `hand-size-per-act`

> *Every situation teaches you something. You start learning faster.*

Hand size grows as the run progresses: base 6 in act 1, 7 in act 2, 8 in act 3.

- **Cost:** 35 fragments
- **Weight:** 2
- **Effect:** `{ type: 'handSizeBonus', amountPerAct: 1 }`
- **Rationale:** The per-act scaling makes act 1 feel normal (no handhold) while acts 2 and 3 feel progressively more powerful. This creates a "snowball" feeling that rewards surviving long enough to reach deeper acts. Weight 2 because the compounding effect is significant — a 7-card hand gives 17% more options per turn than 6.
- **Engine note:** Requires `maxHandSize` to move off `WORLD_CONSTS` and onto a per-run value. `refillHand` and `startTurn` both reference this constant; they'd read from `GameState.runModifiers.maxHandSize` instead. At initialization: `maxHandSize = WORLD_CONSTS.baseHandSize + actIndex * amountPerAct`. The value updates when an act transition fires.
- **Design note:** "Per act" from the original notes was interpreted as scaling (+1 per completed act), not "one unlock that applies to each act." This is more interesting mechanically and creates late-game acceleration.

---

### Category: Combat (weight 2)

---

**Sharpened Instincts** `keyword-damage-bonus`

> *You've learned where the weak points are.*

Keyword-triggered progress bonuses deal +1 more.

- **Cost:** 30 fragments
- **Weight:** 2
- **Effect:** `{ type: 'keywordDamageBonus', amount: 1 }`
- **Rationale:** Concretely: Explore's Hidden bonus goes from +1 to +2 (total 3 vs Hidden), Sprint's Slow bonus goes from +3 to +4. Both cards are in the default starter deck, so this immediately buffs the two most keyword-sensitive cards the player owns. Weight 2 because it silently buffs multiple cards simultaneously and the effect is felt every turn those cards are played against tagged hazards.
- **Engine note:** In `DealProgress` effect resolution, when `bonus.tag` triggers, add `runModifiers.keywordDamageBonus` to the bonus amount before applying. The effect lives in `reduce`, which processes card effects — the modifier must be readable from `GameState`.

---

### Category: Resource floor (weight 2)

Two unlocks — one for light (meaningful now), one for energy (defensive/forward-looking).

---

**Fog Signal** `min-light-per-turn`

> *There is always a little light left. You make sure of it.*

After turn-start light decay, light cannot fall below 1.

- **Cost:** 35 fragments
- **Weight:** 2
- **Effect:** `{ type: 'minResourcePerTurn', resource: 'light', floor: 1 }`
- **Rationale:** Changes the Fog Beach Party loop fundamentally. Without it: light eventually reaches 0, everything is concealed, and you fight blind. With it: 1-depth cards are always revealed, the deepest hazards still hide, but total darkness never lands. Strong in Fog, completely inert in other worlds. Weight 2 because it restructures a world mechanic when active.
- **Engine note:** In `decayLight`, after `Math.max(0, state.light - LIGHT_DECAY)`, clamp the result against `state.runModifiers.minLightPerTurn`. Currently `decayLight` is a private function inside `energy.ts`; the modifier would thread through `state` so no signature change is needed.

---

**Steady Pulse** `min-energy-per-turn`

> *Your hands stop shaking. You always find a little more to give.*

At the start of each turn, energy is guaranteed to be at least 2 after the turn-start gain.

- **Cost:** 40 fragments
- **Weight:** 2
- **Effect:** `{ type: 'minResourcePerTurn', resource: 'energy', floor: 2 }`
- **Rationale:** The current engine always gives +1 energy per turn. Normally this means: if you spent everything, you start with 1. This unlock raises that floor to 2 — on turns where you spent everything, you get an extra energy bonus. Rewards aggressive spending (clearing your hand completely) with a slight refund. Inert if you conserved energy (you already have ≥2). Weight 2 because the conditional bonus matters most in high-pressure turns.
- **Engine note:** In `gainEnergy`, after the +1 grant, if `state.runModifiers.minEnergyPerTurn > state.energy`, set energy to the floor. The min applies after the gain (not instead of it), so the player always gets the +1, and the floor is a bonus on top.
- **Design honesty:** Currently no mechanic reduces energy at turn start, so the floor is only triggered by spending-then-regenerating. If future worlds add energy-drain effects, this unlock becomes more defensive. Documented so implementers don't treat it as dead code.

---

### Category: Character (weight 3)

---

**Athlete's Instinct** `starter-footballer`

> *A muscle memory from a different life. Different strengths, different gaps.*

Replaces the default starter deck with the Footballer deck (Sprint ×3, Explore ×2, Med Kit ×1, Panic ×2, Adrenaline ×2).

- **Cost:** 50 fragments
- **Weight:** 3
- **Effect:** `{ type: 'starterDeckOverride', starterDeckId: 'footballer' }`
- **Rationale:** Not additive — it replaces. The Footballer has more Sprints and Adrenalines (burst energy + card cycling) and more Panic (emergency repositioning), but loses Barricade (no defensive return valve). It's a faster, flimsier identity that rewards hand cycling over board control. Weight 3 because choosing a character is the highest-level build decision in the game; it should consume most of the budget to prevent stacking heavy modifiers on top.
- **Engine note:** `worldManifest.ts` already supports alternate starters via `buildWorld(worldId, starterId)`. This unlock simply maps to passing `starterId: 'footballer'` instead of `starterId: 'starter'`. No changes to `createWorld` are needed — the deck substitution happens in the manifest layer upstream.
- **Footballer deck profile vs default:**

<table style="border-collapse:collapse; font-size:0.9em; margin-top:8px;">
<thead>
<tr style="background:#f0f0f0;">
  <th style="padding:5px 10px;">Card</th>
  <th style="padding:5px 10px; text-align:center;">Default</th>
  <th style="padding:5px 10px; text-align:center;">Footballer</th>
  <th style="padding:5px 10px;">Tradeoff</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:4px 10px;">Sprint</td><td style="padding:4px 10px; text-align:center;">×2</td><td style="padding:4px 10px; text-align:center;">×3</td><td style="padding:4px 10px;">More Slow-removal / draw cycling</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:4px 10px;">Explore</td><td style="padding:4px 10px; text-align:center;">×3</td><td style="padding:4px 10px; text-align:center;">×2</td><td style="padding:4px 10px;">Less reliable single-target progress</td></tr>
<tr><td style="padding:4px 10px;">Barricade</td><td style="padding:4px 10px; text-align:center;">×2</td><td style="padding:4px 10px; text-align:center;">×0</td><td style="padding:4px 10px;">No board-return safety valve</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:4px 10px;">Med Kit</td><td style="padding:4px 10px; text-align:center;">×1</td><td style="padding:4px 10px; text-align:center;">×1</td><td style="padding:4px 10px;">Same</td></tr>
<tr><td style="padding:4px 10px;">Panic</td><td style="padding:4px 10px; text-align:center;">×1</td><td style="padding:4px 10px; text-align:center;">×2</td><td style="padding:4px 10px;">More emergency repositioning</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:4px 10px;">Adrenaline</td><td style="padding:4px 10px; text-align:center;">×1</td><td style="padding:4px 10px; text-align:center;">×2</td><td style="padding:4px 10px;">More burst energy + card cycling</td></tr>
</tbody>
</table>

---

### Category: Discovery (weight 3)

---

**Fortune** `act-reward`

> *You've learned to look for useful things in impossible places.*

After completing each act (before the next act's hazards arrive), choose 1 of 3 player cards to add to your deck.

- **Cost:** 70 fragments
- **Weight:** 3
- **Effect:** `{ type: 'actReward', offeredCount: 3 }`
- **Rationale:** This is the structurally largest unlock. Every act completion triggers a card selection moment, transforming the mid-run experience into a draft. The player can build toward a strategy across acts rather than playing the same fixed deck forever. Weight 3 because it fundamentally changes the run structure. Cost 70 because it's the "end game" purchase — it should feel like a milestone, not a default buy.
- **Engine note:** This is the most complex unlock to implement. It requires:
  1. New `GameState.status` value `'choosingActReward'` (or an equivalent choice-pending state)
  2. A new `ChooseActCard` action
  3. A seeded offer generation (3 random cards from the available player template pool)
  4. New UI in the scene layer to present the choice
  This unlock should be implemented last. The `actReward` effect type in the union is sufficient to signal the feature exists; it does not need to be wired until all other unlocks are done.
- **Edge case:** What cards are offered? They should be drawn from the combined player card template pool (all worlds assembled in the current catalog). The 3 offers are seeded from the run seed + actIndex for determinism. World cards and utility cards (Door, Walker) are excluded from the pool.

---

## Full catalog reference

<table style="border-collapse:collapse; font-size:0.88em; width:100%;">
<thead>
<tr style="background:#e8e8e8;">
  <th style="padding:6px 10px; text-align:left;">ID</th>
  <th style="padding:6px 10px; text-align:left;">Name</th>
  <th style="padding:6px 10px; text-align:center;">Cost</th>
  <th style="padding:6px 10px; text-align:center;">Weight</th>
  <th style="padding:6px 10px; text-align:left;">Category</th>
  <th style="padding:6px 10px; text-align:left;">Effect summary</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:5px 10px;"><code>extra-hp</code></td><td style="padding:5px 10px;">Tough Hide</td><td style="padding:5px 10px; text-align:center;">15</td><td style="padding:5px 10px; text-align:center;">1</td><td style="padding:5px 10px;">stat</td><td style="padding:5px 10px;">+3 starting HP</td></tr>
<tr style="background:#f5f5f5;"><td style="padding:5px 10px;"><code>extra-energy</code></td><td style="padding:5px 10px;">Charged</td><td style="padding:5px 10px; text-align:center;">20</td><td style="padding:5px 10px; text-align:center;">1</td><td style="padding:5px 10px;">stat</td><td style="padding:5px 10px;">+1 energy at run start</td></tr>
<tr><td style="padding:5px 10px;"><code>extra-light</code></td><td style="padding:5px 10px;">Fog Lantern</td><td style="padding:5px 10px; text-align:center;">20</td><td style="padding:5px 10px; text-align:center;">1</td><td style="padding:5px 10px;">stat</td><td style="padding:5px 10px;">+2 starting light</td></tr>
<tr style="background:#f5f5f5;"><td style="padding:5px 10px;"><code>extra-brace</code></td><td style="padding:5px 10px;">Braced</td><td style="padding:5px 10px; text-align:center;">20</td><td style="padding:5px 10px; text-align:center;">1</td><td style="padding:5px 10px;">stat</td><td style="padding:5px 10px;">+2 starting brace</td></tr>
<tr><td style="padding:5px 10px;"><code>hand-size-per-act</code></td><td style="padding:5px 10px;">Adaptable</td><td style="padding:5px 10px; text-align:center;">35</td><td style="padding:5px 10px; text-align:center;">2</td><td style="padding:5px 10px;">hand</td><td style="padding:5px 10px;">+1 hand size per completed act</td></tr>
<tr style="background:#f5f5f5;"><td style="padding:5px 10px;"><code>keyword-bonus</code></td><td style="padding:5px 10px;">Sharpened Instincts</td><td style="padding:5px 10px; text-align:center;">30</td><td style="padding:5px 10px; text-align:center;">2</td><td style="padding:5px 10px;">combat</td><td style="padding:5px 10px;">+1 to keyword damage bonus</td></tr>
<tr><td style="padding:5px 10px;"><code>min-light</code></td><td style="padding:5px 10px;">Fog Signal</td><td style="padding:5px 10px; text-align:center;">35</td><td style="padding:5px 10px; text-align:center;">2</td><td style="padding:5px 10px;">floor</td><td style="padding:5px 10px;">light never decays below 1</td></tr>
<tr style="background:#f5f5f5;"><td style="padding:5px 10px;"><code>min-energy</code></td><td style="padding:5px 10px;">Steady Pulse</td><td style="padding:5px 10px; text-align:center;">40</td><td style="padding:5px 10px; text-align:center;">2</td><td style="padding:5px 10px;">floor</td><td style="padding:5px 10px;">energy floored at 2 after turn-start gain</td></tr>
<tr><td style="padding:5px 10px;"><code>starter-footballer</code></td><td style="padding:5px 10px;">Athlete's Instinct</td><td style="padding:5px 10px; text-align:center;">50</td><td style="padding:5px 10px; text-align:center;">3</td><td style="padding:5px 10px;">character</td><td style="padding:5px 10px;">Footballer starter deck</td></tr>
<tr style="background:#f5f5f5;"><td style="padding:5px 10px;"><code>act-reward</code></td><td style="padding:5px 10px;">Fortune</td><td style="padding:5px 10px; text-align:center;">70</td><td style="padding:5px 10px; text-align:center;">3</td><td style="padding:5px 10px;">discovery</td><td style="padding:5px 10px;">choose 1 of 3 bonus cards per act</td></tr>
</tbody>
</table>

**Total catalog cost:** 335 fragments  
**Max earnable from current feat catalog:** 250 fragments  
**Ratio:** ~75% reachable with all current feats — enough to make meaningful choices, leaves room for future feats to unlock the remainder.

---

## Fragment economy analysis

Fragment earning milestones:

| Milestone | Cumulative fragments | First unlock reachable |
|---|---|---|
| First win (First Survivor) | 10 | — (not yet) |
| + Iron Will (win with 20+ HP) | 25 | Tough Hide (15) |
| + Swift Clear (win in < 10 turns) | 45 | + Fog Lantern or Charged |
| + Century (100+ progress) | 60 | + Braced |
| + Energy Hoard | 80 | + Sharpened Instincts (30) |
| + Light Keeper or Brace Master | 105 | + Fog Signal (35) |
| + Veteran (10 runs) | 135 | + Adaptable (35) |
| + Last Breath | 160 | + Steady Pulse (40) |
| + Conqueror (5 wins) | 200 | + Athlete's Instinct (50) |
| All feats | 250 | Most of catalog; ~85 short of Fortune |

Fortune (70 fragments) requires a player who has bought nothing else up to that point, or who has supplemented their earning with future feats. This is intentional — it's a "long game" unlock.

---

## Effect type union (authoritative)

The discriminated union for `UnlockEffect`. The engine supports exactly these variants; anything not in this list does not exist yet.

```ts
type UnlockEffect =
  | { type: 'startingStat'; stat: 'hp' | 'energy' | 'light' | 'brace'; amount: number }
  | { type: 'handSizeBonus'; amountPerAct: number }
  | { type: 'minResourcePerTurn'; resource: 'energy' | 'light'; floor: number }
  | { type: 'keywordDamageBonus'; amount: number }
  | { type: 'starterDeckOverride'; starterDeckId: string }
  | { type: 'actReward'; offeredCount: number }
```

---

## Implementation order

Not all unlocks are equal difficulty. Recommended build order based on engine impact:

1. **Stat unlocks** (`extra-hp`, `extra-energy`, `extra-light`, `extra-brace`) — patch initial `GameState` fields in `createWorld`. Pure additions to existing fields, no engine changes.
2. **Keyword bonus** (`keyword-bonus`) — add `runModifiers.keywordDamageBonus` to `GameState`, read in `DealProgress` effect resolution.
3. **Light floor** (`min-light`) — modify `decayLight` in `energy.ts` to respect floor.
4. **Energy floor** (`min-energy`) — modify `gainEnergy` to floor after the +1 gain.
5. **Character** (`starter-footballer`) — wire in `worldManifest.ts` / `buildWorld` call site, no core engine changes.
6. **Hand size per act** (`hand-size-per-act`) — move `WORLD_CONSTS.maxHandSize` to a per-run mutable value; update `refillHand` and any act-transition logic to recompute it.
7. **Act rewards** (`act-reward`) — new `GameState` status, new action type, new UI. Implement last.

---

## Decision

**This catalog is approved for implementation as specified.** The ten unlocks cover all six note categories, use consistent fragment costs relative to the feat economy, and produce at least five distinct viable build archetypes within the 5-point budget. The effect type union is the implementation contract; no variant should be added without revising this document first.

One open item deferred to the spec phase: whether `Adaptable` recalculates `maxHandSize` on the act-transition event or at draw time. The simpler implementation is: read `baseHandSize + actIndex * bonus` each time `refillHand` is called, so no explicit recalculation event is needed.
