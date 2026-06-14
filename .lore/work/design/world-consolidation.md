---
title: Consolidating "what a world is" — one bundle, derived manifests
date: 2026-06-13
status: implemented
tags: [worlds, registry, refactor, extensibility, core-renderer-boundary, data]
modules: [core-model, data, game-data, game-view-themes, game-scenes]
related: [.lore/work/design/card-effect-registry.md]
---

# Consolidating "what a world is" — one bundle, derived manifests

## Problem

A "world" has no single definition. It is assembled at runtime from one JSON
file plus six independent `Record<string, …>` maps, each authored in a
different file, each keyed by the same `worldId`, and **nothing proves the six
agree**. Adding one world is an eight-file edit across three architectural
layers, and most of the ways to get it wrong fail *silently*.

Here is everything that is "a world" today, and where each piece lives:

| Facet | File | Layer | Keyed by |
|---|---|---|---|
| Card templates + act composition | `src/data/worlds/<id>.json` | core data | self (`worldId` field) |
| Gameplay registry / world-select order | `src/data/worldManifest.ts` | core compose | `worldManifest[worldId]` |
| Music track | `src/game/data/audioManifest.ts` | renderer | `worldMusicManifest[worldId]` |
| Backdrop, overlay, cardfront, per-card insets, world JSON URL | `src/game/data/assetManifest.ts` | renderer | flat string keys |
| Visual theme (palette, frame, backdrop keys) | `src/game/view/themes/<id>.ts` | renderer | the object's `worldId` |
| Theme registry | `src/game/view/themes/themeManifest.ts` | renderer | `themeManifest[worldId]` |
| Display copy (name, tagline, story) | `src/data/worldDisplayManifest.ts` | UI text | `worldDisplayManifest[worldId]` |
| Help mechanics notes | `src/data/worldHelpManifest.ts` | UI text | `worldHelpManifest[worldId]` |

`Object.keys(worldManifest)` is the *de facto* canonical world list (it drives
`WorldSelectScene`), but the other six maps are free to disagree with it and
with each other.

### Why this is worse than "just eight files"

The facets are stitched together by **stringly-typed keys that cross the
core/renderer boundary with no check that the target exists.** A card template
in core JSON carries `"insetKey": "zombie-inset-zombie"`; that string has to
match a hand-written entry in `assetManifest`. A theme carries
`realityKey: 'bigbox-reality'`; that string also has to match an `assetManifest`
entry. `worldDisplayManifest` carries `backgroundKey`; same deal. None of these
bindings is validated anywhere.

The failure modes are uneven, which is the real trap — you can't learn one rule:

- **Forget `themeManifest`** → `selectTheme` falls back to `STARTER` and the
  world renders in the wrong palette. *Silent.*
- **Forget `audioManifest`** → no music. *Silent.*
- **Typo an `insetKey`, or forget the asset import** → card art is blank; only a
  `console.warn` from the Phaser loader. *Near-silent.*
- **Theme `realityKey` doesn't match `assetManifest`** → blank backdrop. *Silent.*
- **Forget `worldDisplayManifest`** → `WorldSelectScene` *throws* at runtime.
- **Forget `worldHelpManifest`** → `HelpOverlayView` reads `undefined`.

Two of eight mistakes crash; six render something wrong and say nothing. This
is the same disease the card-effect registry just cured
(`.lore/work/design/card-effect-registry.md`): one conceptual addition smeared
across many sites, several of which fail *open*.

### The constraint that shapes the fix

This cannot be solved by "put it all in the JSON." The architecture is
load-bearing and lint-enforced: **`src/core/` is pure TypeScript with zero
Phaser imports**, and the core is deterministic and seedable. Card data is core.
Themes, asset URLs, and audio are renderer concerns (they pull `.webp`/`.mp3`
imports through Vite and feed Phaser). Display and help copy are UI-only and
must not be imported by core.

So the card JSON *should* stay free of asset bindings, and the renderer facets
*cannot* move into core. The goal is not one file — it is **one registration
point per world that is cross-checked**, with the layers preserved.

A second nuance the design must keep: the world JSON loads **two ways**. The
headless sim and core tests import it synchronously (`worldManifest.ts`); the
Phaser renderer loads the same file asynchronously by URL (`assetManifest`
`world-<id>` entries, read back out of the Phaser cache). Both paths must
survive.

## Proposal

Co-locate every facet of a world into one **world bundle** per world, and make
the six flat manifests *derived* from a single registry instead of
hand-authored. This mirrors the card-effect registry move: author once, in one
place, and let a conformance test refuse to compile/pass when a facet is missing
or a key doesn't resolve.

### 1. A `WorldBundle` type that names every facet

A bundle is a renderer-side aggregator. It is allowed to reference core data and
renderer assets because it lives *outside* core — core never imports it, so the
lint boundary is untouched.

```ts
// src/game/worlds/types.ts  (renderer side — may touch Phaser-adjacent assets)
import type { RawCardSource } from '../../core/model/catalog'
import type { VisualTheme } from '../view/themes/theme'

export interface WorldAsset {
  key: string   // the string other layers reference (insetKey, backdrop key, …)
  url: string   // the Vite-resolved asset URL
}

export interface WorldBundle {
  id: string                       // single source of truth for worldId

  // --- core data (Phaser-free) ---
  source: RawCardSource            // the parsed <id>.json (card templates + acts)
  jsonUrl: string                  // <id>.json?url, for the async Phaser load path

  // --- renderer ---
  theme: VisualTheme
  music: WorldAsset
  assets: WorldAsset[]             // backdrop, overlay, cardfront, every inset

  // --- UI text ---
  display: WorldDisplayData
  help: WorldHelpData
}
```

### 2. One file per world that fills it in

```
src/game/worlds/
  zombie-big-box/
    index.ts        // assembles the WorldBundle: imports the JSON, the theme,
                    // the inset/backdrop/music assets, and the copy
  bird-building/index.ts
  highway-volcano/index.ts
  overgrown-mall/index.ts
  registry.ts       // worldBundles: WorldBundle[]  — the ONE canonical list
  types.ts
```

Each `index.ts` is the world's whole identity in one screen: which cards, which
art, which palette, which music, which words. The `insetKey` strings authored in
the JSON are bound to files *right next to* the JSON they belong to, so the
binding is visible and reviewable in one place instead of inferred across two
files in two layers.

The theme objects (`src/game/view/themes/<id>.ts`) can stay where they are and
be imported by the bundle, or move under the world folder — either is fine; the
bundle is what makes them discoverable.

### 3. Derive the existing manifests from the registry

The current consumers all read flat `Record<string, …>` maps. We **do not
rewrite every consumer.** Instead the maps become *generated* from
`worldBundles`, so authoring moves to the bundle while call sites stay put:

```ts
// derived, not authored
export const themeManifest        = byId(worldBundles, b => b.theme)
export const worldMusicManifest   = byId(worldBundles, b => b.music)
export const worldDisplayManifest = byId(worldBundles, b => b.display)
export const worldHelpManifest    = byId(worldBundles, b => b.help)
export const worldManifest        = byId(worldBundles, b => makeBuilder(b.source))
export const assetManifest        = collectAssets(worldBundles)   // + shared assets
```

`worldManifest`'s pairing of the shared starter source with each world's acts
(`makeWorldBuilder`, the starter-deck merge) is preserved exactly — it just gets
its world source from the bundle. Shared, non-world assets (cardback, energy
icon, effect icons, generic insets) stay in a `sharedAssets` list that
`collectAssets` concatenates.

### 4. A conformance test that closes every silent gap

One test, run in CI, asserting the invariants the type system can't:

- Every bundle id is unique, and `bundle.id === bundle.source.worldId`.
- Every `theme`, `music`, `display`, `help` is present (the type already forces
  this — that alone kills four of the six "forgot a map" failure modes).
- **Every key referenced anywhere resolves to a real asset:** every `insetKey`
  in every card template, every `backdrop.realityKey` / `intrusionKey` /
  `worldCardfrontKey` in the theme, and every `display.backgroundKey` appears in
  that bundle's `assets` (or the shared list). This is the check that does not
  exist today and is the source of the blank-art / blank-backdrop failures.
- Every `GainCard` / `AddWorldCardToDeck` template reference resolves within the
  assembled catalog (catches dangling card references too).

## What this buys

- **Adding a world becomes one folder.** Author `worlds/<id>/index.ts`, add it
  to `registry.ts`. The type makes "forgot the theme/help/display/music"
  impossible to compile; the test makes "art key doesn't resolve" impossible to
  merge.
- **The core/renderer boundary is unchanged.** Core still sees only
  `RawCardSource` / `WorldData`; the bundle lives in `game/` and core never
  imports it. The lint rule keeps holding.
- **Both JSON load paths survive.** `source` feeds the sync sim/test path;
  `jsonUrl` feeds the async Phaser path. No behavior change for either.
- **Silent failures become loud.** Four are caught by the compiler, the
  remaining stringly-typed ones by a single test.

## Migration (phased, test-green at each step)

The maps stay byte-identical in shape, so this is a pure refactor — golden tests
and the existing manifest tests (`worldManifest.test.ts`,
`worldDisplayManifest.test.ts`, `worldHelpManifest.test.ts`) are the safety net.

1. Add `WorldBundle` types and the `registry.ts` skeleton. No consumers yet.
2. Build the four bundles, importing the *existing* JSON, themes, assets, copy
   (move nothing; just reference). Assert the derived maps deep-equal the
   current hand-authored maps in a temporary test.
3. Flip each manifest export to its derived form, one at a time, running the
   suite between each. Delete the hand-authored body once its consumers are
   green.
4. Add the conformance test. Fix whatever real key mismatches it surfaces (this
   step is expected to find at least one existing dangling key).
5. Delete the now-empty authored manifests. Update `CONTRIBUTING.md` "adding a
   world" to point at the one folder.

Each phase is independently revertable, per the phased-migration rule — no step
has an unrecoverable blast radius.

## Open questions

- **Do theme files move into the world folder, or stay in `view/themes/` and get
  imported?** Leaning toward moving them, so a world is genuinely one directory;
  but `view/themes/theme.ts` (the `VisualTheme` type and `STARTER` fallback) is
  shared and stays put.
- **`STARTER` is special:** it has a theme and a source but is not a selectable
  world (no display/help/music). It should be a `sharedStarter` constant the
  builders merge in, not a `WorldBundle`. The registry is selectable worlds only.
- **Should `assetManifest`'s shared (non-world) assets also move behind the
  registry**, or stay a separate hand-maintained `sharedAssets` list? Proposed:
  separate list — they aren't world-scoped and don't benefit from the bundle.
- Whether to enforce the asset-key resolution at **build time** (a Vite plugin /
  codegen) rather than test time. Test-time is enough to start and far cheaper;
  revisit only if the test proves too easy to skip.

## Recommendation

Adopt the bundle + derived-manifest shape. It is the same medicine that worked
for card effects, it respects the one hard constraint (the core boundary), and
the migration is a mechanical, test-guarded refactor rather than a rewrite. The
conformance test alone — even without the folder move — would catch six classes
of bug we currently ship blind.
