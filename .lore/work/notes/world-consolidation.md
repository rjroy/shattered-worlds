---
title: "Implementation notes: world consolidation"
date: 2026-06-13
status: complete
tags: [implementation, notes, worlds, registry, refactor, core-renderer-boundary]
source: .lore/work/plans/world-consolidation.md
modules: [core-model, data, game-data, game-view-themes, game-scenes]
related: [.lore/work/plans/world-consolidation.md, .lore/work/design/world-consolidation.md]
---

# Implementation notes: world consolidation

Source plan: [.lore/work/plans/world-consolidation.md](../plans/world-consolidation.md)

## Baseline

**Test suite before any changes:** 595 pass / 3 fail / 3 errors — all 3 failures are pre-existing in `gameplaySession.test.ts` (subscriber failure handler behavior), unrelated to world consolidation. Golden tests passing.

## Phase Tracker

<table>
<tr>
  <th>Phase</th><th>Step</th><th>Status</th>
</tr>
<tr>
  <td rowspan="5"><strong>Phase 1</strong><br>Tier-1 registry + core data</td>
  <td>1.1 — Create <code>src/data/worlds/types.ts</code> (<code>WorldDataBundle</code>, <code>referencedAssetKeys</code>, <code>derive</code>)</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>1.2 — Land zombie-big-box end-to-end + add registry.ts (1 entry) + rewrite worldManifest.ts</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>1.3 — Fan out remaining worlds (bird-building, highway-volcano, overgrown-mall) in parallel</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>1.4 — Repoint worldDisplayManifest / worldHelpManifest / themeManifest to derive from registry</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>1.5 — Add <code>src/core/tests/worldRegistry.test.ts</code> conformance test</td>
  <td>✅ done</td>
</tr>
<tr>
  <td colspan="2"><strong>Gate 1:</strong> typecheck + lint + full suite green + golden unchanged</td>
  <td>✅ PASSED</td>
</tr>
<tr>
  <td rowspan="4"><strong>Phase 2</strong><br>Tier-2 renderer binding</td>
  <td>2.1 — Create <code>src/game/worlds/assetBindings.ts</code></td>
  <td>✅ done</td>
</tr>
<tr>
  <td>2.2 — Create <code>src/game/worlds/manifests.ts</code></td>
  <td>✅ done</td>
</tr>
<tr>
  <td>2.3 — Slim <code>assetManifest.ts</code>, remove dead async path, slim <code>audioManifest.ts</code></td>
  <td>✅ done</td>
</tr>
<tr>
  <td>2.4 — Add <code>src/game/tests/worldAssetBindings.test.ts</code> renderer conformance test</td>
  <td>✅ done</td>
</tr>
<tr>
  <td colspan="2"><strong>Gate 2:</strong> bun test green + bun build clean + manual boot check</td>
  <td>✅ PASSED (manual: user confirmed)</td>
</tr>
<tr>
  <td rowspan="3"><strong>Phase 3</strong><br>Validation + docs</td>
  <td>3.1 — Validate against design + close all six failure modes</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>3.2 — Update CONTRIBUTING.md "adding a world"</td>
  <td>✅ done</td>
</tr>
<tr>
  <td>3.3 — Remove stale comments, confirm no orphaned files</td>
  <td>✅ done</td>
</tr>
<tr>
  <td colspan="2"><strong>Gate 3:</strong> full suite + typecheck + lint + build green + fresh-eyes review</td>
  <td>✅ PASSED (621 pass / 3 fail — same pre-existing failures as baseline)</td>
</tr>
</table>

## Log

### 2026-06-13 — Session start

**Context gathered:**
- `worldManifest.ts` has a stale comment ("renderer does NOT use this") — corrected in plan, the dead async path is in `assetManifest.ts` not here
- `worldDisplayManifest.ts` and `worldHelpManifest.ts` define their interface types inline — these move to `types.ts` and are re-exported so existing imports stay unchanged
- `themeManifest.ts` is a hand-authored map; `selectTheme` fallback to STARTER stays
- `src/game/tests/theme.test.ts:4` imports `ZOMBIE_BIG_BOX_THEME` from old path — must update
- `assetManifest.ts` has 5 dead `?url` JSON entries + `url.endsWith(".json")` branch — confirmed dead by plan investigation
- `audioManifest.ts` is pure world music imports + `worldMusicManifest` record

**Key consumers mapped:**
- `testFixture.ts` → imports `buildWorld` from `worldManifest` (must keep working, Bun/headless)
- `WorldSelectScene.ts`, `ChronicleScene.ts`, `TableScene.ts` → import `worldManifest` + `worldDisplayManifest`
- `HelpOverlayView.ts` → imports `worldDisplayManifest` + `worldHelpManifest`
- `TableScene.ts:15` → imports `selectTheme` from `themeManifest`

## Validation

Design failure modes vs. what now closes them (Phase 3 check):

- **Forget `themeManifest` → wrong palette (silent).** Closed by type: `WorldDataBundle.theme: VisualTheme` is required. Missing it is a compile error. `worldRegistry.test.ts` additionally asserts `bundle.theme` is non-null at runtime for every registered world.
- **Forget `audioManifest` → no music (silent).** Closed by type: `WorldDataBundle.musicKey: string` is required. `worldRegistry.test.ts` asserts `typeof bundle.musicKey === 'string'` and length > 0. `worldAssetBindings.test.ts` asserts the key is bound in `worldMusicManifest`.
- **Typo an `insetKey` or forget the asset import → blank card art (near-silent).** Closed by `worldAssetBindings.test.ts`: `referencedAssetKeys(bundle)` collects every `insetKey` in every card template, then the test asserts each key exists in `assetManifest`.
- **Theme `realityKey` doesn't match `assetManifest` → blank backdrop (silent).** Closed by `worldAssetBindings.test.ts`: `referencedAssetKeys` includes `backdrop.realityKey` and `backdrop.intrusionKey` from the theme; both must be in `assetManifest`.
- **Forget `worldDisplayManifest` → `WorldSelectScene` throws at runtime.** Closed by type: `WorldDataBundle.display: WorldDisplayData` is required. Missing it is a compile error.
- **Forget `worldHelpManifest` → `HelpOverlayView` reads `undefined`.** Closed by type: `WorldDataBundle.help: WorldHelpData` is required. Missing it is a compile error.

Summary: four of six failure modes are now compile errors (theme, music key, display, help). The two stringly-typed bindings (inset art keys, backdrop keys) are caught by `worldAssetBindings.test.ts` which runs in CI.
