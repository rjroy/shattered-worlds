---
title: "Implementation plan: world consolidation"
date: 2026-06-13
status: executed
tags: [plan, worlds, registry, refactor, core-renderer-boundary]
modules: [core-model, data, game-data, game-view-themes, game-scenes]
related: [.lore/work/design/world-consolidation.md]
---

# Implementation plan: world consolidation

Source design: [.lore/work/design/world-consolidation.md](../design/world-consolidation.md).

Goal: collapse the eight scattered places that together define "a world" into
**one authoring point per world**, with the parallel manifests *derived* from a
single registry and a conformance test that turns today's silent failures
(wrong theme, blank art, missing music) into compile or test failures.

## Corrections to the design (decided before planning)

The investigation found three things the design got wrong or left open. These
are settled and shape the plan:

1. **The async JSON load path is dead.** The design claimed "both JSON load
   paths must survive." False — the `world-<id>` `?url` entries in
   `assetManifest` are loaded into the Phaser cache via `scene.load.json` but
   **nothing reads them back**. The live path is the synchronous bundled import
   through `worldManifest.buildWorld`. **Decision: remove the dead async path.**

2. **A monolithic asset-bearing bundle would break the headless path.**
   `src/data/worldManifest.ts` is imported by core tests (`testFixture.ts`,
   `reduce.test.ts`, `available.test.ts`) and the sim, all Phaser-free under
   Bun. A single `WorldBundle` that statically imports `.webp`/`.mp3` would drag
   Vite asset imports into that graph — untested under Bun (nothing imports
   assets there today). **Decision: two-tier split** (below).

3. **Theme objects move into the world folders** (decision: relocate, not just
   import in place). They are pure data with no asset imports, so they are
   core-safe and belong with their world.

## Target architecture: two tiers

**Tier 1 — core-safe data registry (`src/data/worlds/`).** Pure data, zero Vite
asset imports, importable by core tests and the sim. Holds the world's identity:
card source, theme object, display copy, help notes, music *key*. This derives
`worldManifest`, `themeManifest`, `worldDisplayManifest`, `worldHelpManifest`.

**Tier 2 — renderer asset binding (`src/game/worlds/`).** The only place
`.webp`/`.mp3` imports live. Maps asset *keys* to Vite URLs and derives
`assetManifest` (world portion) and `worldMusicManifest`. Imported only by
Phaser scenes, which already run under Vite.

The seam between them is **stringly-typed keys made honest by a test.** The
asset keys a world references (`insetKey` on each card, the theme's
`backdrop.realityKey` / `intrusionKey` / `worldCardfrontKey`, the display's
`backgroundKey`) are *derived from the Tier-1 bundle*, not hand-listed, and the
Tier-2 conformance test asserts every derived key resolves to a bound URL.

### Final file layout

```
src/data/worlds/
  types.ts                 # WorldDataBundle; referencedAssetKeys(bundle) helper
  registry.ts              # worldDataRegistry: readonly WorldDataBundle[]  ← canonical world list
  starter.json             # shared source (unchanged)
  zombie-big-box/
    cards.json             # moved from src/data/worlds/zombie-big-box.json
    theme.ts               # moved from src/game/view/themes/zombie-big-box.ts (pure data)
    meta.ts                # display copy + help notes for this world
    index.ts               # the WorldDataBundle: id, source, theme, display, help, musicKey
  bird-building/ …  highway-volcano/ …  overgrown-mall/ …
  worldManifest.ts         # buildWorld() now derives source from registry
  worldDisplayManifest.ts  # = derive(registry, b => b.display)   (consumers unchanged)
  worldHelpManifest.ts     # = derive(registry, b => b.help)

src/game/worlds/
  assetBindings.ts         # per-world assetKey → .webp URL, musicKey → .mp3 URL  (Vite)
  manifests.ts             # assetManifest world-portion + worldMusicManifest, derived

src/game/data/assetManifest.ts        # shared (non-world) assets + loadAssets (image-only)
src/game/data/audioManifest.ts        # re-export derived worldMusicManifest
src/game/view/themes/themeManifest.ts # selectTheme derives from registry; STARTER fallback stays
src/game/view/themes/theme.ts         # VisualTheme/FrameStyle types + STARTER stay (shared)
```

`WorldDataBundle` carries **no `assetKeys` array** — the referenced keys are
computed by `referencedAssetKeys(bundle)` from `source` + `theme` + `display`,
so there is one fewer hand-maintained parallel list (the whole point). Only
`musicKey` is carried, since nothing else implies it.

`STARTER` stays in `view/themes/starter.ts` as the unthemed fallback — it is a
shared source, not a selectable world, so it is **not** a registry entry (design
open question, resolved).

---

## Phase 1 — Tier-1 registry + co-locate core data

All pure-data work, fully covered by golden and manifest tests. Touches every
world folder, so the per-world conversion is parallelizable (one sub-agent per
1–2 worlds) once the shared types and the first world land as the template.

**Steps**

1. Add `src/data/worlds/types.ts`: `WorldDataBundle` (`id`, `source:
   RawCardSource`, `theme: VisualTheme`, `display: WorldDisplayData`, `help:
   WorldHelpData`, `musicKey`) and the pure helper `referencedAssetKeys(bundle):
   ReadonlySet<string>`. Also **relocate the `WorldDisplayData` and
   `WorldHelpData` interface definitions here** (they currently live inline in
   `worldDisplayManifest.ts` / `worldHelpManifest.ts`); those wrapper files will
   re-export the type so scene imports like `WorldSelectScene.ts:4`
   (`import { worldDisplayManifest, type WorldDisplayData }`) keep working
   unchanged. Add the small `derive(registry, selector)` helper here too
   (returns `Record<worldId, T>`), used by the derived manifests; it must throw
   on duplicate world ids rather than last-writer-wins (mirrors
   `assembleCatalog`).
   - **Lint/runtime note for the implementer:** `types.ts` does a *type-only*
     `import type { VisualTheme } from '../../game/view/themes/theme'`. That file
     is interface-only (zero runtime content — it only declares `FrameStyle` and
     `VisualTheme`), so the type erases and pulls no asset. The eslint boundary
     binds `src/core/**` only and is per-file syntactic, so when a
     `src/core/tests/*` file transitively reaches the registry → a world's
     `theme.ts` → `theme.ts` (types), **no lint rule fires and nothing executes
     at runtime**. This is expected, not a smell. Do not move the `VisualTheme`
     type or add a boundary exception.
2. **Land one world (zombie-big-box) end-to-end as the template, and repoint
   `worldManifest.ts` in the same step — before any fan-out.** This avoids a
   broken-import window: the moment `<id>.json` moves, `worldManifest.ts`'s
   direct imports (`worldManifest.ts:11-14`) dangle. So treat the move and the
   `worldManifest` rewrite as one atomic unit:
   - create `src/data/worlds/zombie-big-box/`; move `zombie-big-box.json` →
     `zombie-big-box/cards.json`; move `view/themes/zombie-big-box.ts` →
     `zombie-big-box/theme.ts`; create `meta.ts` (cut its `display` + `help`
     entries from the two manifest maps); create `index.ts` assembling the
     `WorldDataBundle` (import `cards.json`, theme, meta; set `musicKey`);
   - rewrite `worldManifest.ts` so `buildWorld` reads each world's `source` from
     the registry instead of importing JSON directly — **drop the four
     `import …Json from './worlds/*.json'` lines entirely** (`worldManifest.ts:11-14`),
     keep `makeWorldBuilder` / starter-merge byte-for-byte, fix the stale
     "renderer does NOT use this" comment;
   - **update the consumers that import the moved theme file by name:**
     `src/game/tests/theme.test.ts:4` (`import { ZOMBIE_BIG_BOX_THEME } from
     '../view/themes/zombie-big-box'`) → new path; and remove the four named
     per-theme imports from `view/themes/themeManifest.ts` (it derives from the
     registry now).
   Run `bun test` here. Only once green do the remaining three worlds in
   parallel, each a mechanical repeat (sub-agent per 1–2 worlds).
3. Add `src/data/worlds/registry.ts` exporting `worldDataRegistry` (the four
   bundles, order = world-select order). Build it incrementally with step 2 (one
   entry for the template world first, then the rest).
4. Repoint the remaining Tier-1 consumers to derive from the registry and delete
   the now-duplicated authored bodies:
   - `worldDisplayManifest.ts` / `worldHelpManifest.ts`: become
     `derive(worldDataRegistry, b => b.display | b.help)` plus the type
     re-export; their hand-authored map bodies are deleted.
   - `view/themes/themeManifest.ts`: `selectTheme` reads the registry; `STARTER`
     stays the fallback.
5. Add the core-safe conformance test `src/core/tests/worldRegistry.test.ts`
   (placed in `core/tests` alongside the existing `worldManifest.test.ts`, which
   it complements; it imports the registry from `src/data`, the same core-safe
   pattern `testFixture.ts` already uses):
   id uniqueness; `id === source.worldId`; theme/display/help/musicKey present
   (the type already forces presence); every key in
   `referencedAssetKeys(bundle)` is non-empty/string; every `GainCard` /
   `AddWorldCardToDeck` template reference resolves in the assembled catalog.

<table><tr><td><strong>✅ Gate — Phase 1</strong></td></tr><tr><td>

`bun run typecheck` clean · `bun run lint` clean (no `src/core/**` file directly
imports `**/game/**`) · `bun test` full suite green, **golden tests unchanged**
(byte-identical runs prove the data move changed nothing) · the three existing
manifest tests still pass against the derived exports.

</td></tr></table>

## Phase 2 — Tier-2 renderer binding + remove dead async path

**Steps**

1. Create `src/game/worlds/assetBindings.ts`: move the world-scoped `.webp`
   imports (backdrops, overlays, cardfronts, every inset) and `.mp3` imports out
   of `assetManifest.ts` / `audioManifest.ts` into here, as `assetKey → url`
   and `worldId → { key, url }` maps.
2. Create `src/game/worlds/manifests.ts`: derive the world portion of
   `assetManifest` (image keys only) and the full `worldMusicManifest` from the
   bindings. **Music stays in its own `worldMusicManifest` structure** — it does
   NOT go into `assetManifest`. `.mp3` files are loaded through the existing
   audio path (`TableScene.ts:755` reads `worldMusicManifest`), not through
   `loadAssets`. So `loadAssets` stays image-only and needs no audio branch.
3. Slim `src/game/data/assetManifest.ts` to the **shared, non-world** assets
   (cardback, energy/effect icons, generic insets, world-select bg) merged with
   `worlds/manifests` world assets. **Remove the dead async path**: delete the
   five `world-<id>` `?url` imports + entries, and drop the
   `if (url.endsWith(".json"))` branch in `loadAssets` (no `.json` entries
   remain — verified). `audioManifest.ts` becomes a re-export of the derived
   `worldMusicManifest`.
4. Add `src/game/tests/worldAssetBindings.test.ts` (renderer, Bun): for every
   world, `referencedAssetKeys(bundle)` ⊆ bound asset keys (shared + world), and
   `musicKey` is bound. **This is the first test to import asset URLs under Bun
   — a feasibility checkpoint.** If Bun fails to resolve `.webp`/`.mp3?url`
   imports, add a `bunfig.toml` `[loader]` entry (`.webp = "file"`, `.mp3 =
   "file"`) before proceeding; do not work around it by skipping the test.

<table><tr><td><strong>✅ Gate — Phase 2</strong></td></tr><tr><td>

`bun test` green including the new renderer conformance test · `bun run build`
(Vite) clean · **manual run required** (per the environment's "builds clean ≠
works" rule): boot the app, enter at least one world, confirm backdrop, card
inset art, theme palette, and music all load. Use `/run` or `/verify`.

</td></tr></table>

## Phase 3 — Final validation + docs

**Steps**

1. Validate against the source design: every facet from the design's
   "everything that is a world" table now has exactly one authoring home; the
   six "forgot a map" failure modes are each closed by either the type
   (theme/display/help/music presence) or a conformance test (key resolution,
   card cross-refs); the core/renderer boundary is intact (`bun run lint`).
2. Update `CONTRIBUTING.md` "adding a world" to describe the one-folder workflow
   (`src/data/worlds/<id>/` + one `assetBindings` entry) and point at the two
   conformance tests as the safety net.
3. Remove any remaining stale comments (e.g. the old worldManifest comment if
   not already fixed) and confirm no orphaned files remain under
   `view/themes/<id>.ts`.

<table><tr><td><strong>✅ Gate — Phase 3</strong></td></tr><tr><td>

Full suite + typecheck + lint + build green · fresh-eyes review (sub-agent) of
the whole diff against this plan and the design · design status flipped to
`implemented`, this plan to `executed`.

</td></tr></table>

---

## Risks and mitigations

- **Bun can't resolve `.webp`/`.mp3` imports in the new renderer test.** Likely,
  since nothing imports assets under Bun today. Mitigation is known and cheap: a
  `bunfig.toml` `[loader]` entry. Surfaced deliberately as the Phase 2
  checkpoint rather than discovered late.
- **Golden drift during the data move.** The Phase 1 file moves must not change
  any card data. The golden tests are the guard; if a golden diff appears, a
  byte changed in the move and must be reverted, not re-baselined.
- **Phase 1 is large** (every world, several files each). It is cohesive
  (all pure-data, one mechanical transform) and test-covered, so it is a
  parallelization target, not a correctness risk. Land one world end-to-end as
  the template before fanning out.
- **`derive()` helper key collisions.** `assembleCatalog` already throws on
  duplicate template ids; the registry should likewise throw on duplicate world
  ids rather than last-writer-wins. Assert in the conformance test too.

## Out of scope

Build-time (Vite-plugin/codegen) enforcement of key resolution — the test-time
check is sufficient and far cheaper; revisit only if the test proves skippable.
No gameplay, balance, or visual changes: this is a pure structural refactor,
byte-identical runs before and after.
