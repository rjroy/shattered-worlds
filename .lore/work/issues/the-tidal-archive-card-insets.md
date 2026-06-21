---
title: The Tidal Archive card insets
date: 2026-06-20
status: open
tags: [the-tidal-archive, world-design, art, card-insets, deferred]
modules: [game-view, themes, world-data]
related: [.lore/work/specs/the-tidal-archive.md, .lore/work/plans/the-tidal-archive.md]
---

# The Tidal Archive card insets

The Tidal Archive shipped without per-card inset art. This was a deliberate deferral
(matching the bird-building / highway-volcano precedent) so the world could land
fully typed, tested, and CI-backed while the art pass follows separately.

## Deferred requirements

- **REQ-TIDAL-3** — one inset asset per Tidal card under
  `src/game/assets/themes/the-tidal-archive/insets/`, in a `tidal-inset-*` key
  namespace, with every referenced inset key registered in
  `src/game/worlds/assetBindings.ts`.
- **Inset half of REQ-TIDAL-46** — hazard insets (places out of order, maps to
  wrong districts, books chained to water, repeated footprints) and reward insets
  (deliberate indexing, marked shelves, waterproof notes, anchored memories). The
  base displacement-legibility intent stands; only the inset visuals are deferred.
- **Inset clause of REQ-TIDAL-56** — asset validation of `insetKey` bindings.

The non-inset portions of REQ-TIDAL-46 and REQ-TIDAL-56 are NOT deferred.

## Current state (base assets are done)

- Base assets are wired and load without falling back to starter art:
  `the-tidal-archive-bg`, `the-tidal-archive-overlay`, `the-tidal-archive-cardfront`,
  and `music-the-tidal-archive`.
- No Tidal card template carries an `insetKey`, so `referencedAssetKeys(bundle)`
  returns only the base keys. Asset validation (`worldAssetBindings.test.ts`)
  therefore passes with no inset bindings present.
- The discard chooser (REQ-TIDAL-14) renders an empty inset slot for these cards
  until the art lands; name, cost, and modified/exhaust state already render.

## Follow-up

When the art pass runs: produce one inset per template in the `tidal-inset-*`
namespace, register each key in `assetBindings.ts`, set the matching `insetKey`
on each card template, and re-enable the `insetKey` clause of REQ-TIDAL-56 in the
spec. Flip this issue to `resolved` and drop the DEFERRED annotations from
REQ-TIDAL-3 / REQ-TIDAL-46 / REQ-TIDAL-56.
