# CLAUDE.md

Orientation for working in this repo. Keep this as a starting point, not a dossier: it should tell the next agent where to look and what not to break, then get out of the way.

## What this is

Shattered Worlds: a roguelite deckbuilder where each world remakes how you build, and a persistent Destiny outlives the run. It's a **portfolio game**, which is load-bearing — typed, tested, CI-backed **and** genuinely fun. Both gates or it doesn't merge.

Read [README.md](README.md) for the pitch, current status, live build, and the seven design principles in short form.

## Where to look, and when

| When you're about to… | Open | Why |
|---|---|---|
| Build, test, lint, or run anything | [CONTRIBUTING.md](CONTRIBUTING.md) | Commands (`bun run …`), the `src/` layout, and the branch/PR/CI workflow |
| Decide where new logic belongs | [CONTRIBUTING.md](CONTRIBUTING.md) § Architecture | The core/game/sim split and the lint-enforced boundary |
| Add a world or wire world assets | [CONTRIBUTING.md](CONTRIBUTING.md) § Adding a world | Required world bundle files, registry, asset bindings, and conformance tests |
| Change cards, starters, boons, unlocks, or feats | `src/data/` and `.lore/reference/index.md` | Authored data is centralized; the field guide links the relevant contracts |
| Touch run orchestration, persistence, Chronicle, feats, or Destiny | `src/game/runtime/` and `.lore/reference/index.md` | Runtime owns local profiles, rewards, unlock application, import/export, and run history |
| Make a call that trades one project value against another | `.lore/reference/direction/vision.md` | North star, anti-goals, and which way to lean when principles collide |
| Add or change a world's look | `.lore/reference/direction/visual-direction.md`, `.lore/reference/worlds/authoring/theme-authoring.md`, `src/game/assets/themes/README.md` | Visual identity rules, theme authoring, and asset-generation constraints |
| Check balance or autoplay behavior | `src/sim/`, `bun run sim`, `bun run sim:complete` | Headless policy runner for fast loop and balance checks; the completeness checker audits win-rate margins per world |

Most lore docs are Markdown now, with some older HTML artifacts still present. Use `.lore/reference/index.md` as the durable knowledge index.

## Current source landmarks

- `src/core/`: pure deterministic rules engine. Public surface is `src/core/contract.ts` and `src/core/index.ts`; reducer/effect behavior lives under `engine/` and `effects/`.
- `src/game/`: Phaser client. Scenes own screen flow, `view/` owns render components and layouts, `interaction/` owns selection/highlight/feedback, and `runtime/` bridges core state to persisted player-facing progression.
- `src/data/`: authored game content. `allCards.json` is the unified card template catalog; worlds, starter decks, boon pools, feats, and unlocks reference that catalog.
- `src/game/worlds/assetBindings.ts`: Vite URL binding for world art and music keys. If a data key references art, this is usually where missing texture failures are fixed.
- `src/sim/`: renderer-free simulation over the core for balance and policy experiments.

## Project-specific rules that aren't obvious from the code

- **The `core` / `game` boundary is lint-enforced.** `src/core/` is pure TypeScript with zero Phaser imports; a violation fails the build. If it decides *what is true* in the game, it's core. If it decides *how truth looks or feels*, it's renderer. See CONTRIBUTING.md before moving code across the line.
- **The core is deterministic and seedable.** Same seed + same actions = the same run, byte for byte. Never introduce non-seeded randomness into core. Cosmetic randomness (particle jitter, flourishes) lives in the renderer and never feeds back into state.
- **`dispatch` returns state *and* an ordered event list.** The renderer reads events as an animation script; the final `state` is the snap-to truth. Keep both correct.
- **Runtime owns progression application.** Feats, Memory Fragments, Destiny unlocks, world access, starter selection, stats, Chronicle import/export, and local settings live in `src/game/runtime/`. Core should receive already-assembled config, not know about local storage or profile policy.
- **Data keys must be wired all the way through.** Card templates, world metadata, themes, unlock icons, and audio use string keys that conformance tests check against manifests and bindings. Fix missing bindings at the manifest/binding layer rather than renaming data casually.
- **New core logic requires tests.** The core is pure and fast. Use it directly in renderer/runtime tests; don't mock it unless the test is explicitly about renderer plumbing.
- **The campaign has a definitive ending, and it deals with grief.** The three finale worlds (`questions`, `answers`, `the-beginning`) form a grief-arc trilogy that closes the Destiny storyline. `src/game/scenes/griefSupportGate.ts` gates a one-time support interstitial (`GriefSupportScene`) shown before a player's first entry into any of the three. Treat that gating logic and its copy source (`.lore/work/brainstorm/player-support-message.md`) as sensitive — don't strip or bypass it when touching world-select flow.

## Working conventions

Design docs, specs, plans, research, and retros live in `.lore/`. Durable project knowledge is distilled into `.lore/reference/`. When a decision is significant, capture the *why* there rather than only in code or commit messages.

Before handing off a code change, run the narrowest meaningful check first, then broaden as risk grows: targeted `bun test` files for local logic, `bun run test` for shared rules/runtime/data changes, and `bun run lint && bun run typecheck && bun run build` before PR-ready work.
