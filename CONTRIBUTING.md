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
| `bun run preview` | Serve the production build locally |
| `bun run test` | Run unit tests |
| `bun run typecheck` | Type-check without emitting |
| `bun run lint` | ESLint across all sources |
| `bun run sim` | Headless sim runner (balance data) |

CI runs install, lint, typecheck, tests, and build. A PR must pass those checks before it can merge.

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
    runtime/             — session orchestration, local profiles, feats, unlocks, stats, import/export
    data/                — assetManifest, audioManifest
    worlds/              — Vite asset bindings for world art and music
    assets/              — webp art + per-theme assets
    tests/               — *.test.ts + testSetup
  sim/                   — headless runner, imports core
    tests/               — *.test.ts
  data/                  — card, boon, starter deck, feat, unlock, and world data
    allCards.json        — unified card template catalog
    boonPools.json       — fortune boon template pools
    starterDecks/        — starter deck JSON
    feats/               — feat catalog and types
    unlocks/             — Destiny unlock catalog and types
    worlds/              — per-world deck composition, theme, display/help metadata
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

**Why Phaser?** The architecture supports the kind of maximalist juice (Balatro-style card effects, screen shake, escalating particle work) that DOM-based approaches make painful. Phaser gives full control over the render loop without fighting the browser. The research doc lives in `.lore/reference/game-engine-choice.md`.

**Why a pure-core/renderer split?** The core is exhaustively unit-testable and runnable headless for balance sims. Simulation speed and animation speed are decoupled by design. The architecture document is at `.lore/reference/core-render-split.md`.

**Why seeded RNG?** Same seed + same actions yields the same run, byte for byte. This is what makes "randomness is owned, never imposed" enforceable — every outcome is reproducible and traceable.

## Lore

Design documents, specs, research, retros, and reference pages live in `.lore/`. Most are Markdown, with some older HTML artifacts. Vite serves the folder at `/lore/` during development and copies it to `dist/lore/` during production builds. Key documents:

- `.lore/reference/vision.md` — project north star, principles, anti-goals
- `.lore/reference/core-render-split.md` — the core/renderer split in detail
- `.lore/work/specs/poc-core-loop.html` — POC scope and requirements

## Branch and PR workflow

- All changes go on a branch. Never commit directly to `master`.
- Every PR needs a description covering what changed and why.
- CI runs lint, typecheck, tests, and build on every PR. All must pass.
- Merges to `master` trigger a GitHub Pages deploy automatically.

## Testing

Tests live beside the code they cover or in a module `tests/` folder (`*.test.ts`). Run them with `bun run test`.

The core module has near-complete unit test coverage. New core logic requires tests. The sim runner provides integration-level validation of the full game loop.

Do not mock the core in renderer tests. The core is pure and fast — use it directly.

## Adding a world

A world is one folder under `src/data/worlds/<id>/` plus renderer asset and music bindings. Card templates are global; per-world `cards.json` files define world id, act composition, and optional world settings. The type system prevents most authoring mistakes; conformance tests catch the rest.

### 1. Create the world folder

```
src/data/worlds/<id>/
  cards.json    — worldId, deckComposition, and optional start/passive settings
  theme.ts      — exports a named VisualTheme constant (import the type from ../../../game/view/themes/theme)
  meta.ts       — exports WorldDisplayData (name, tagline, story, backgroundKey) and WorldHelpData (mechanics[])
  index.ts      — assembles and exports the WorldDataBundle (id, deck, theme, display, help, musicKey)
```

A `WorldDataBundle` requires `id`, `deck`, `theme`, `display`, `help`, and `musicKey` — the type will not compile with any of them missing. If the world needs new card templates, add them to `src/data/allCards.json`. If it needs new fortune boon pools, add pool membership to `src/data/boonPools.json`.

### 2. Register the bundle

Add the bundle to the `worldDataRegistry` array in `src/data/worlds/registry.ts`. Order in the array is the world-select order shown to the player.

### 3. Add asset bindings

Add the world's asset entries (backdrops, card front, inset art) and music binding to `src/game/worlds/assetBindings.ts`. Each entry maps the string key used in card templates, `theme.ts`, and `meta.ts` to the Vite-resolved asset URL. `src/game/data/assetManifest.ts` spreads these world bindings into the preload manifest.

### 4. Run the conformance tests

```sh
bun run test
```

These tests catch the common wiring mistakes:

- `src/core/tests/worldRegistry.test.ts` — verifies id uniqueness, required bundle fields, non-empty referenced asset keys, and every card-template cross-reference in the assembled catalog.
- `src/core/tests/worldManifest.test.ts` — verifies assembled world data, deck composition, starter decks, boon pools, and catalog consistency.
- `src/game/tests/worldAssetBindings.test.ts` — verifies every key that `referencedAssetKeys(bundle)` derives (card insets, backdrop keys, display background) is bound in `assetManifest`, and the music key is bound in `worldMusicManifest`.
- `src/game/tests/unlockAssetBindings.test.ts` — verifies every unlock icon key from the unlock catalog is bound in `assetManifest`.

If a key is missing from `assetManifest`, the second test names it explicitly. Fix the `assetBindings.ts` entry rather than the key string.
