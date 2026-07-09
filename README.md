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

Full campaign, in active balance and polish. The project now has:

- A deterministic, seeded TypeScript rules engine with reducer-driven state and semantic game events.
- A Phaser/Vite browser client with world select, table play, action previews, confirmations, help overlays, settings, music, run summaries, a Destiny scene, and a Chronicle scene for run history.
- Persistent local stats, Chronicle import/export, feat rewards, Fragments, and Destiny unlocks.
- World access unlocks, starter deck unlocks, stat/resource unlocks, rarity modifiers, card modifiers, and temporary Fortune boon rewards.
- Fifteen registered worlds, from The Big Box through a three-part finale trilogy (Questions, Answers, The Beginning) that closes the Destiny arc. The finale deals with grief and loss; a one-time support interstitial precedes it.
- A headless sim runner for balance checks, plus a per-world completeness checker (`bun run sim:complete`) used to audit win-rate health across the roster.
- CI for lint, typecheck, tests, and production build.

Live build: [GitHub Pages](https://rjroy.github.io/shattered-worlds/)

## Portfolio standard

That phrase is load-bearing: the codebase must be typed, tested, CI-backed, **and** genuinely fun with real retention. Not one or the other.

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, tooling, and how to build locally.
