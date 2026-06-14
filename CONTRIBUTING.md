# Contributing

## Prerequisites

- [Bun](https://bun.sh) (used for runtime, package management, and tests)
- Node.js is not required; Bun handles everything

## Setup

```sh
bun install
```

## Development commands

| Command | What it does |
|---|---|
| `bun run dev` | Start Vite dev server with hot reload |
| `bun run build` | Production build to `dist/` |
| `bun run test` | Run unit tests |
| `bun run typecheck` | Type-check without emitting |
| `bun run lint` | ESLint across all sources |
| `bun run sim` | Headless sim runner (balance data) |

All of these run in CI. A PR must pass lint, typecheck, tests, and build before it can merge.

## Architecture

The codebase is split into three packages by role. The boundary between `core` and `game` is lint-enforced: a violation fails the build.

```
src/
  core/                  — pure TypeScript, zero Phaser imports
    index.ts contract.ts — public surface
    model/               — types, errors, cards, catalog
    engine/              — world, game, reduce, effects, available, draw, intensity, rng
    tests/               — *.test.ts + testFixture
  game/                  — Phaser renderer, imports core
    index.ts main.ts     — entry points
    scenes/              — BootScene, TableScene
    view/                — render, components, presentation, theme, visualMappers, backdrop, walker, piles
    interaction/         — selection, describe, feedback
    data/                — assetManifest, worldData
    assets/              — webp art + per-theme assets
    tests/               — *.test.ts + testSetup
  sim/                   — headless runner, imports core
    tests/               — *.test.ts
  data/worlds/           — world definition JSON
```

### `src/core/` — the rules engine

The core is a synchronous, deterministic, seedable state machine. It has no side effects and no Phaser dependency.

The public contract is small:

```ts
interface GameCore {
  readonly state: GameState
  dispatch(action: Action): { state: GameState; events: GameEvent[] }
}

function createGame(seed: number, config: GameConfig): GameCore
```

`dispatch` returns both the authoritative final state and an ordered list of semantic events (what actually happened, in order). The renderer reads the event list as an animation script. If the player skips, it snaps to `state`.

The rule for what belongs in core: **if it decides what is true in the game, it's core.**

### `src/game/` — the Phaser renderer

The renderer owns the clock. It translates player input into core `Action`s and translates the returned `GameEvent[]` into animation timelines (tweens, particles, audio). Cosmetic randomness (particle jitter, flourishes) lives here and never feeds back into state.

Escalation — dialing the juice from mundane to intense — is driven by an `intensity` value the core computes from run state. The renderer reads it; the renderer never decides it.

The rule: **if it decides how truth looks or feels, it's renderer.**

### `src/sim/` — headless simulation runner

The sim runner runs a full game at full speed with no renderer. It feeds a policy (a function that picks an action given a state) and records metrics. This is the instrument for Principle 6 (balance answers to data).

```sh
bun run sim
```

## Key design decisions

**Why Phaser?** The architecture supports the kind of maximalist juice (Balatro-style card effects, screen shake, escalating particle work) that DOM-based approaches make painful. Phaser gives full control over the render loop without fighting the browser. The research doc lives in `.lore/work/research/game-engine-for-ai-development.html`.

**Why a pure-core/renderer split?** The core is exhaustively unit-testable and runnable headless for balance sims. Simulation speed and animation speed are decoupled by design. The architecture document is at `.lore/work/design/core-render-architecture.html`.

**Why seeded RNG?** Same seed + same actions yields the same run, byte for byte. This is what makes "randomness is owned, never imposed" enforceable — every outcome is reproducible and traceable.

## Lore

Design documents, specs, research, and retros live in `.lore/`. They are HTML files readable in a browser. Key documents:

- `.lore/reference/vision.html` — project north star, principles, anti-goals
- `.lore/work/design/core-render-architecture.html` — the core/renderer split in detail
- `.lore/work/specs/poc-core-loop.html` — POC scope and requirements

## Branch and PR workflow

- All changes go on a branch. Never commit directly to `master`.
- Every PR needs a description covering what changed and why.
- CI runs lint, typecheck, tests, and build on every PR. All must pass.
- Merges to `master` trigger a GitHub Pages deploy automatically.

## Testing

Tests live in a `tests/` folder within each module (`*.test.ts`). Run them with `bun run test`.

The core module has near-complete unit test coverage. New core logic requires tests. The sim runner provides integration-level validation of the full game loop.

Do not mock the core in renderer tests. The core is pure and fast — use it directly.

## Adding a world

A world is one folder under `src/data/worlds/<id>/` plus two small entries in the renderer layer. The type system prevents most authoring mistakes; the two conformance tests catch the rest.

### 1. Create the world folder

```
src/data/worlds/<id>/
  cards.json    — card templates and act composition (same schema as existing worlds)
  theme.ts      — exports a named VisualTheme constant (import the type from ../../../game/view/themes/theme)
  meta.ts       — exports WorldDisplayData (name, tagline, story, backgroundKey) and WorldHelpData (mechanics[])
  index.ts      — assembles and exports the WorldDataBundle (id, source, theme, display, help, musicKey)
```

A `WorldDataBundle` requires all of `theme`, `display`, `help`, and `musicKey` — the type will not compile with any of them missing.

### 2. Register the bundle

Add the bundle to the `worldDataRegistry` array in `src/data/worlds/registry.ts`. Order in the array is the world-select order shown to the player.

### 3. Add asset bindings

Add the world's asset entries (backdrops, card front, inset art) and music binding to `src/game/worlds/assetBindings.ts`. Each entry maps the string key used in `cards.json` / `theme.ts` to the Vite-resolved asset URL.

### 4. Run the conformance tests

```sh
bun run test
```

Two tests catch every wiring mistake:

- `src/core/tests/worldRegistry.test.ts` — verifies id uniqueness, id matches `source.worldId`, all required fields present, all asset key strings are non-empty, and every card-template cross-reference resolves in the assembled catalog.
- `src/game/tests/worldAssetBindings.test.ts` — verifies every key that `referencedAssetKeys(bundle)` derives (card insets, backdrop keys, display background) is bound in `assetManifest`, and the music key is bound in `worldMusicManifest`.

If a key is missing from `assetManifest`, the second test names it explicitly. Fix the `assetBindings.ts` entry rather than the key string.
