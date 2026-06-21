---
title: City of Sleeping Giants card insets
date: 2026-06-21
status: open
tags: [city-of-sleeping-giants, world-design, art, card-insets, deferred]
modules: [game-view, themes, world-data]
related: [.lore/work/specs/city-of-sleeping-giants.md, .lore/work/plans/city-of-sleeping-giants.md, .lore/work/notes/city-of-sleeping-giants.md]
---

# City of Sleeping Giants card insets

The City of Sleeping Giants (8th world) shipped its logic, data, registration, gating,
tests, and base presentation fully typed/tested/CI-backed, but **per-card inset art and
the world unlock art are deferred** (deliberate user choice during `/implement`, matching
the Ember Orchard precedent). The 14 images are user-owned follow-up.

## Deferred requirements

- **REQ-GIANTS-3, 39** — 13 card insets under
  `src/game/assets/themes/city-of-sleeping-giants/insets/inset-<kebab>.webp`, in the
  `giants-inset-*` key namespace.
- **REQ-GIANTS-47** (asset validation) — the inset clause only. The 13 cards already
  carry their `insetKey`s, so the bindings must be wired before validation goes green.
- **Inset/render half of REQ-GIANTS-48** — a card rendering with its inset (manual smoke,
  browser unavailable in this env). Palette + base-key assertions are NOT deferred and pass.
- **Unlock art** — `src/game/assets/unlocks/world-city-of-sleeping-giants.webp` + the
  `assetManifest.ts` binding (currently a `// TODO(giants art)` comment).

## Current RED-by-design tests (do NOT paper over)

Unlike Tidal (which carried no `insetKey`s, so its asset test passed), Giants cards DO
carry `insetKey`s (Ember approach), so these stay RED until art lands:

- `worldAssetBindings.test.ts` → `"city-of-sleeping-giants" > all referenced asset keys
  are bound` (the 13 `giants-inset-*` cards.json keys).
- `cityOfSleepingGiantsPresentation.test.ts` → `boon-source inset bindings (REQ-GIANTS-47)`
  (the 4 `giants-boons` inset keys: quiet-survey, brace-the-ward, bone-pin, contour-map).

Do NOT add placeholder webp files to force these green.

## Current state (base + music are done)

- Base assets wired and load without starter fallback: `city-of-sleeping-giants-bg`,
  `-overlay`, `-cardfront`, and `music-city-of-sleeping-giants` (reuses the fog-beach track).
- All world/boon card templates carry their `insetKey`; only the bindings + webp files are missing.

## Follow-up

When the art pass runs: generate the 13 card insets (keynote violet-cyan city invaded by
emerald-vascular + bone-white) + the unlock art; add the 13 inset import/map entries in
`assetBindings.ts` (turnkey TODO comment in place) and the unlock-art entry in
`assetManifest.ts` (turnkey TODO comment in place). The two RED tests then go green
automatically. Run the manual smoke (REQ-GIANTS-49 three-act run + inset render) once art
exists. Flip this issue to `resolved`.
