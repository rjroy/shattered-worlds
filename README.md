# Shattered Worlds

A roguelite deckbuilder where you survive a gauntlet of broken worlds, each remaking how you build, and forge a Destiny that outlives the run.

## What it is

Where Slay the Spire changes the game by changing your character, Shattered Worlds changes it by changing your world. Each world has its own deck style and its own challenges. A run is the act of surviving multiple worlds in sequence, and as you cross them you extend and adjust your Destiny — the thread that carries through the shattering.

Runs are disposable; what you earn is not. Between runs you spend your winnings to unlock new options and deepen synergies, so the possibility space grows even though every run still starts you at the bottom of the climb.

**Core loop:**

Enter a world → Build to its deck style → Survive its challenges → Cross to the next world → Run ends → Spend earnings → wider Destiny ↺

## Design principles

Every decision in this project answers to seven principles. The short version:

1. **The deck-building is the game.** Every card offered must change a decision, not merely add power.
2. **Worlds are the identity, not the wallpaper.** A world ships only when it forces a different way to build.
3. **Destiny grows you, but the summit still demands skill.** Meta-progression softens the foothills; skill earns the summit.
4. **Randomness is owned, never imposed.** A bad draw must trace back to a choice the player made.
5. **Synergies are legible.** Every archetype is nameable and its payoff visible.
6. **Balance answers to data, not feelings.** Tuned by playtest and pick/win data, not intuition.
7. **Craft and fun are one gate, not two.** Fun is validated before engineering investment; engineering is non-negotiable before anything is called done.

## Status

Early development. The POC core loop — seeded RNG, reducer-based state machine, headless sim runner, Phaser renderer — is implemented and deployed.

Live build: [GitHub Pages](https://rjroy.github.io/shattered-worlds) _(once deployed)_

## This is a portfolio game

That phrase is load-bearing: the codebase must be typed, tested, CI-backed, **and** genuinely fun with real retention. Not one or the other.

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, tooling, and how to build locally.
