# Shattered Worlds - Vision

<!--
date: 2026-06-02
status: current
tags: vision, deckbuilding, roguelite, worlds, destiny
fg-type: concept
fg-sources: .lore/work/research/deckbuilding-game-design.html, .lore/work/brainstorm/shattered-worlds-meta-progression.html
fg-status: current
related: .lore/work/research/deckbuilding-game-design.html
-->

**Project North Star.** Approved 2026-06-02.

A roguelite deckbuilder where you survive a gauntlet of broken worlds, each remaking how you build, and forge a Destiny that outlives the run.

## Identity

Where *Slay the Spire* changes the game by changing your **character**, Shattered Worlds changes it by changing your **world**. Each world has its own deck style and its own challenges. A run is the act of surviving multiple worlds in sequence, and as you cross them you extend and adjust your Destiny - the thread that carries through the shattering.

Runs are disposable; what you earn is not. Between runs you spend your winnings to unlock new options and deepen certain synergies, so the *possibility space* grows even though every run still starts you at the bottom of the climb.

This is a portfolio game, and that word is load-bearing: it must be typed, tested, and CI-backed **and** genuinely fun with real retention. Not one or the other. If it isn't both, why try.

- Enter a world
- Build to its deck style
- Survive its challenges
- Cross to the next world
- Run ends
- Spend earnings into a wider Destiny

## What It Always Is

Behavioral guidelines, not aspirations. Each is a test a decision can pass or fail.

### Principle 1: The deck-building is the game

Every card offered must **change a decision**, not merely add power. If a reward is an obvious auto-pick or an obvious skip, it has failed. The acquire / thin / re-shape tension stays the most interesting thing on screen.

### Principle 2: Worlds are the identity, not the wallpaper

A new world ships **only when it forces a different way to build** - a distinct deck style and a distinct challenge logic. A world that plays like an existing one with new art is not a world; it's a reskin, and it doesn't ship.

### Principle 3: Destiny grows you, but the summit still demands skill

Between-run spending may **unlock new choices and grant modest persistent power** - easing the early climb is fine and rewarding. What it may never do is let a patient player **buy past the real challenge**. Destiny softens the foothills; the summit stays earned by skill, not by hours ground.

### Principle 4: Randomness is owned, never imposed

The player chooses *into* the chaos. Random offers and world order create variety; the player's picks at every fork own the outcome. A bad draw must trace back to a choice the player made, never to a result the game dealt them blind.

### Principle 5: Synergies are legible

Every archetype must be **nameable and its payoff visible**. Players should grasp *why* cards combo within a world, so a winning build feels intended, not stumbled into. If you can't explain a synergy in a sentence, it isn't ready.

### Principle 6: Balance answers to data, not to feelings

Single-player frees us from competitive fairness, so we tune for **fun over symmetry** - but changes are justified by playtest and pick/win data, not by intuition or the loudest feedback. We instrument early and expect multiple balance passes.

### Principle 7: Craft and fun are one gate, not two

A feature is not done if it's fun but untyped/untested, and not done if it's clean but boring. **Both gates or it doesn't merge.** Fun is validated by playtest before we invest deep engineering in a system; engineering is non-negotiable before a system is called finished.

## What It Must Never Become

### Grind past the ceiling

Progression that lets a patient player buy their way past the hardest content. Modest power that eases the early climb is welcome; meta-progression that makes skill irrelevant at the summit is not.

### Reskinned worlds

Content that pads the world count without changing how you build or what threatens you. Variety in art is not variety in play.

### A PvP balance obligation

Competitive multiplayer would chain us to symmetric, tournament-grade balance and kill the freedom to tune for fun. This is a single-player roguelite by choice.

### Card bloat

More cards as a substitute for better decisions. Choosing one of three sharp options beats sorting twenty mediocre ones.

### Power-creep content waves

Expansions that break the run economy to feel exciting. New content earns its place by adding decisions, not by inflating numbers.

### Fun-but-broken, or clean-but-boring

Shipping either half alone. A delightful prototype with no tests is not progress; a pristine engine no one enjoys is not a game.

## When Values Collide

The decisions that will actually feel hard. Here's which way we lean by default.

### Meta-progression vs. run integrity

Unlocks make returning rewarding, but every unlock risks diluting the tension that makes a single run gripping.

**Run integrity wins at the top.** Destiny may add options and modest power, and may soften the early climb - but when an unlock would let a player buy past the hardest content, cut it. Ease the foothills, never the summit.

### Engineering craft vs. getting it fun fast

Portfolio-grade rigor is slow; finding the fun wants rapid, throwaway iteration.

**Sequence resolves it.** Fun is proven first with cheap prototypes; rigor is mandatory before any system is declared done. Neither half is skipped - they happen in order.

### World variety vs. one coherent game

Each world must play differently, yet the whole must feel like one game rather than a bundle of minigames.

**Diverge in worlds, unify in Destiny.** Worlds are free to feel alien in deck style and challenges; the Destiny layer is the constant that makes a run feel like one journey.

Drafted 2026-06-02 from a vision conversation, building on [deckbuilding-game-design research](../work/research/deckbuilding-game-design.html). Status **current** (approved) - this is the document to open when a decision feels wrong. It defines spirit, not requirements; mechanics for Destiny, worlds, and the economy belong in a spec.
