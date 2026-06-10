# CLAUDE.md

Orientation for working in this repo. The real detail lives in the docs below — this file says **what each one is for and when to open it**, so don't duplicate their content here.

## What this is

Shattered Worlds: a roguelite deckbuilder where each world remakes how you build, and a persistent Destiny outlives the run. It's a **portfolio game**, which is load-bearing — typed, tested, CI-backed **and** genuinely fun. Both gates or it doesn't merge.

Read [README.md](README.md) for the pitch, the core loop, and the seven design principles in short form.

## Where to look, and when

| When you're about to… | Open | Why |
|---|---|---|
| Build, test, lint, or run anything | [CONTRIBUTING.md](CONTRIBUTING.md) | Commands (`bun run …`), the `src/` layout, and the branch/PR/CI workflow |
| Decide where new logic belongs | [CONTRIBUTING.md](CONTRIBUTING.md) § Architecture | The core/game/sim split and the lint-enforced boundary |
| Make a call that feels wrong or trades one value against another | [.lore/reference/vision.html](.lore/reference/vision.html) | North star, anti-goals, and which way to lean when principles collide |
| Add or change a world's look | [.lore/reference/visual-direction.html](.lore/reference/visual-direction.html), [.lore/reference/theme-authoring.html](.lore/reference/theme-authoring.html) | Visual identity rules and how themes are authored |

Lore docs are HTML — open them in a browser, or read the source directly.

## Project-specific rules that aren't obvious from the code

- **The `core` / `game` boundary is lint-enforced.** `src/core/` is pure TypeScript with zero Phaser imports; a violation fails the build. If it decides *what is true* in the game, it's core. If it decides *how truth looks or feels*, it's renderer. See CONTRIBUTING.md before moving code across the line.
- **The core is deterministic and seedable.** Same seed + same actions = the same run, byte for byte. Never introduce non-seeded randomness into core. Cosmetic randomness (particle jitter, flourishes) lives in the renderer and never feeds back into state.
- **`dispatch` returns state *and* an ordered event list.** The renderer reads events as an animation script; the final `state` is the snap-to truth. Keep both correct.
- **New core logic requires tests.** The core has near-complete coverage and is pure and fast — use it directly in renderer tests, don't mock it.

## Working conventions

Design docs, specs, plans, research, and retros live in `.lore/`. When a decision is significant, capture the *why* there rather than only in code or commit messages. The `/lore-development:*` skills produce these artifacts.
