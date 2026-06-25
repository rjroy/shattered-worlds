---
title: Unlock system — Memory Fragments, meta-shop, and Destiny Blessings
date: 2026-06-15
status: open
tags: [meta-progression, unlocks, memory-fragments, balance, ux, architecture]
modules: [feats, meta-progression, core-engine]
related:
  - .lore/work/brainstorm/feat-definitions.md
  - .lore/work/brainstorm/shattered-worlds-meta-progression.md
---

# Unlock system — Memory Fragments, meta-shop, and Destiny Blessings

## The raw problem

Memory Fragments are earned. They need somewhere to go. The notes list six unlock categories:

- Start with more energy/light/brace/HP
- Increase hand size per act
- +1 vs keyword
- Minimum resource at start of turn
- Different starter decks (characters)
- Bonus cards per act (a set of 3)

Three questions before any of this can be specced: where does the player manage unlocks (UX), how do unlocks reach the engine (architecture), and how do we stop stacking from breaking the game (balance).

---

## UX: Where does this live?

### Option A — Always-on (purchase = permanent effect)

Spend fragments in a meta-shop. Everything you buy is silently applied to every run. No pre-run configuration screen. The Destiny grows passively.

- Pros: dead simple, no decision fatigue, narratively clean ("your memories carry forward")
- Cons: players reach a ceiling and every run feels identical. No replay decision. Power floor rises until the game is trivial.

### Option B — Pre-run activation screen (Hades/Mirror model)

Two layers: **purchase** (spend fragments to unlock) and **activate** (choose which unlocks to bring per run, subject to a cap).

Flow:
```
Main Menu → World Select → Destiny Screen → Run
```

On the Destiny Screen, the player sees their purchased unlocks and picks which to activate within a budget. Budget enforces the constraint that prevents god-mode.

- Pros: replay decision every run, natural god-mode prevention, narratively satisfying ("you choose which memories to carry")
- Cons: one extra screen; requires a clear budget metaphor

### Option C — Skip the screen, gate by world unlocks

No activation layer at all. Unlocks are tied to specific worlds. Beat Fog Beach Party's speed feat → that world now gives you +1 Light at start. The unlock is contextual, not cross-world.

- Interesting but limits cross-world power feel. Loses the "Destiny grows across all worlds" narrative. Probably a good supplementary idea, not the primary system.

### Recommendation

**Option B with deferred activation layer.** Purchase is permanent and persistent. Activation with a budget is the run-start decision. MVP: build the purchase layer + always-on (all purchased = active). Add the activation screen as the second step once there are enough unlocks to make selection interesting (roughly 6+).

---

## Balance: How do we prevent god-mode?

### Flat slot limit ("pick 3")

"You may bring 3 Destiny Blessings per run." Simple to communicate. Risk: some unlocks are obviously dominant, making the choice trivial rather than strategic.

### Point budget ("Destiny Weight")

Each unlock has a weight (1–3). You have a total budget of 5 (or 6, or 7 — tune this). You can take many cheap unlocks or one expensive one. Budget cap = god-mode prevention.

This is the better design. Reasons:

1. Expresses relative power directly in data. "+1 Starting HP" costs 1. "Alternate Starter Deck" costs 3. No need to argue about equivalence.
2. Naturally generates meaningful decisions. "Do I take two cheap blessings or one strong one?" is more interesting than "pick any 3."
3. Expandable without redesign. A feat could reward "+1 to your Destiny budget for this world."
4. Small numbers stay legible. Budget of 5 with weights 1–3 means at most 5 items, usually 2–3. Doesn't overflow.

Bad idea: scaling costs per stack (first "+1 HP" costs 5 fragments, second costs 15). Too punishing to communicate. Don't do it.

### Category caps

"1 offensive, 1 defensive, 1 utility per run." Requires categorizing all unlocks, adds design overhead, feels arbitrary to players. Viable supplementary constraint but not the primary gate.

### Unique vs. stackable unlocks

Should the same unlock be purchasable multiple times for stacking effects? ("+1 HP" bought 3 times = "+3 HP starting")

**Unique unlocks only.** Each unlock is distinct: you either have it or you don't. Reasons:

- Finite collection goal. Players can see what's left to earn. No grind to godhood.
- Balanced by variety, not by stack depth. You pick a build, not a number.
- Better narrative fit. Each memory fragment is a specific memory, not a counter.
- Stops "optimize by buying the same card 10 times" from dominating.

If we want tiered power later, model it as three distinct unlocks: "First Light" (start with 1 light), "Keeper of Light" (start with 3 light), "Lighthouse" (start with 5 + minimum 2 per turn). The player buys one or upgrades through the tier.

---

## Architecture: Where do unlocks live and how do they reach the engine?

### Current state

`createGame(catalog, world, seed)` → `createWorld(catalog, world, seed)` → hard-coded `WORLD_CONSTS`:

```ts
export const WORLD_CONSTS = {
  startHp: 10,
  maxHandSize: 6,
  startWorldCards: 2,
  ...
};
```

`SetupModifier` already exists as a type in `gameplayEventStream.ts` and is tracked on `RunStarted` and `RunRecord`, but nothing actually consumes it — it's currently just metadata. The seam exists; it just isn't plumbed yet.

### Unlock categories by where they need to hook

| Unlock category | Engine hook point | Notes |
|---|---|---|
| Start HP / energy / light / brace | `createWorld` initial state | Simplest: patch the initial `GameState` values |
| Bonus cards per act | `createWorld`, act minting | Inject extra cards into an act's `CardCount[]` |
| Alternate starter deck | `createWorld`, starter minting | Replace `world.starterDeck` before calling `mintAll` |
| Hand size per act | `WORLD_CONSTS.maxHandSize` + `startTurn` | `maxHandSize` must move from a constant to a per-run value |
| Min resource at start of turn | `startTurn` in `energy.ts` | Needs a "floor" value threaded through |
| +1 vs keyword | `reduce` | Needs a modifier queried during damage calculation |

### Cleanest model

Introduce `RunModifiers` — a frozen, plain-data record attached to `GameState` at initialization. The engine reads it wherever it currently reads `WORLD_CONSTS`. It's pure data with no behavior; the engine behavior doesn't change, only the values it operates on.

```ts
type RunModifiers = {
  readonly extraStartHp: number        // default 0
  readonly extraStartEnergy: number    // default 0
  readonly extraStartLight: number     // default 0
  readonly extraStartBrace: number     // default 0
  readonly handSizeBonusPerAct: number // default 0
  readonly minEnergyPerTurn: number    // default 0
  readonly keywordDamageBonus: number  // default 0 (the "+1 vs keyword")
  readonly extraActCards: readonly CardCount[] // default []
}
```

`createWorld` accepts an optional `RunModifiers` and merges it with defaults. The `SetupModifier[]` passed at session creation is translated into a `RunModifiers` before calling `createGame`. This keeps the core deterministic and pure; same seed + same modifiers = same run.

### What about alternate starter decks (characters)?

A "character" unlock is best modeled as a variant `WorldData` — specifically, a different `starterDeck` field. The unlock catalog points to a `starterDeckOverride` (a `readonly CardCount[]`), and the session builder substitutes it before calling `createGame`. This doesn't require touching `createWorld` at all; the catalog/world construction handles it upstream.

### Persistence

`UnlocksProfile` — parallel to `FeatsProfile` — stores what the player has purchased:

```ts
type UnlocksProfile = {
  version: 1
  purchased: readonly string[] // unlock ids
}
```

Stored under `shattered-worlds/unlocks/v1`. Loaded at the composition root alongside `FeatsProfile`. `computeFragmentBalance` (already exists) minus `computeUnlockSpend` (new) = spendable balance.

### Data: the unlock catalog

```ts
type UnlockDefinition = {
  id: string
  name: string
  description: string
  cost: number                 // in Memory Fragments
  destinyWeight: number        // 1–3, for the per-run activation budget
  effect: UnlockEffect         // discriminated union
}

type UnlockEffect =
  | { type: 'startingStat'; stat: 'hp' | 'energy' | 'light' | 'brace'; amount: number }
  | { type: 'handSizeBonus'; amount: number }
  | { type: 'minResourcePerTurn'; resource: 'energy' | 'light' | 'brace'; floor: number }
  | { type: 'keywordDamageBonus'; amount: number }
  | { type: 'extraActCards'; actIndex: number; cards: readonly CardCount[] }
  | { type: 'starterDeckOverride'; cards: readonly CardCount[] }
```

The effect union is the authoritative spec for what the engine must support. Any effect type not in this union doesn't exist yet.

---

## Open questions

**How many points is the activation budget?** 5 feels right to start. Tune after playtesting. The number of unlocks in the catalog is the real constraint.

**Who sees the Destiny Screen?** New players won't have any purchased unlocks. The screen should hide itself (or be a stub "no blessings yet") until at least one unlock is owned. The first few feats should reward fragments that naturally lead to the first purchase.

**Character unlocks — are they also world-gated?** A "character" with a different starter deck might only make sense in certain worlds. Or it could be universal. Bad idea: an unlock that's meaningless in 4/6 worlds but dominant in 2. Either make characters world-specific or design them to be universally applicable.

**Bonus cards per act — which act?** "A set of 3" per the notes. Act 1 is the natural target (biggest impact since it's always played). But "bonus to act 2 or 3" is more interesting strategically. Worth making this per-act in the schema even if only act 1 is used first.

**Where is the meta-shop scene?** Main menu flow: does it live at `MainMenuScene` → unlock sub-screen, or does it live at `WorldSelectScene` → unlock sub-screen? The Destiny framing suggests it precedes world selection (you configure your soul before choosing where to go). But it could also be a persistent menu item. Lean toward main-menu-adjacent so it's clear it's a persistent feature, not a per-world option.

**How do we communicate fragment balance clearly?** The player needs to know their balance without opening the shop. A small persistent display (fragment counter) somewhere accessible. ChronicleScene shows totals; the main menu may want a HUD element.

---

## What feels wrong / interesting mistakes to explore

**Wrong**: Building the activation layer before having 6+ unlocks to fill it. If you build the "pick 3 from your unlocks" screen when the player has only 2 unlocks, the decision is trivial and the UX overhead is pure friction. Always-on first.

**Interesting**: What if the Memory Fragment cost to purchase is also the Destiny Weight? Then expensive unlocks are also the ones you're most reluctant to "spend" a slot on per run. Creates a coherent valuation signal. Risk: might make cheap unlocks universally better "first buys" because they're also lighter to carry.

**Interesting**: What if one feat could grant an unlock directly (not just fragments)? "Defeat the Walker without taking damage → unlock Warborn Starter Deck." This makes rare feats feel special without a shop transaction. The `unlock` RewardItem already exists in the type system. Worth using.

**Wrong**: Giving the player a +2 HP unlock when the base is 10 HP. That's a 20% buff — probably too strong as a flat modifier. Better to make it +5 and treat it as a meaningful choice rather than a +2 that feels like noise. If it's going to cost fragments, it should feel impactful.

**Interesting**: The "minimum resource per turn" unlock is unusual and potentially very strong for world-specific builds. A minimum of 1 light per turn in Fog Beach Party makes concealment almost always available. Design this one carefully — it may deserve a higher Destiny Weight than it initially appears.
