---
title: World Launch Checklist Gaps
date: 2026-07-02
status: current
tags: [world-design, checklist, music-binding, unlock-gate, process-lesson]
fg-type: lesson
fg-sources: [.lore/work/notes/new-derelict.md, .lore/work/plans/transit-authority.md, .lore/work/notes/transit-authority.md]
fg-status: current
fg-evidence:
  code:
    - src/game/worlds/assetBindings.ts
    - src/data/unlocks/catalog.json
  symbols:
    - worldMusicManifest
    - worldUnlock
---

# World Launch Checklist Gaps

Two recurring gaps have shown up across consecutive world implementations (New Derelict, then Transit Authority) that don't fail any automated gate on their own, so they need to be checked deliberately rather than assumed to be handled by the registry pattern.

## Music key reuse is a bug, not a shortcut

New Derelict shipped its first pass reusing `eden-prime`'s `musicKey` as a temporary stand-in, with the intent to replace it before release. When Transit Authority hit the same situation (no `transit-authority-music.mp3` file and no audio-generation tool available in the working environment), the plan explicitly named the earlier reuse as "a bug, not a pattern to repeat" and declined to repeat it — leaving `worldMusicManifest["transit-authority"]` unbound instead (graceful degradation exists: `TableScene.startWorldMusic` warns and continues rather than crashing on a missing entry). Both worlds ultimately shipped with distinct, correctly bound music keys before merge. The lesson: a new world's `musicKey` needs its own real audio file and `audioManifest`/`worldMusicManifest` entry checked explicitly at registration time — reusing another world's key doesn't fail any test today (nothing asserts music keys are unique across worlds), so it will silently pass review unless someone looks.

## Unlock-catalog gating is not automatic

Every world shipped since Eden Prime has gated itself behind a `worldUnlock` entry in `src/data/unlocks/catalog.json`. Transit Authority's spec left "ship gated vs. ship free/hidden" as an open question conditional on world-select capacity, and that decision was never made explicitly during planning — the mechanical result of skipping the catalog entry is not "hidden," it's the opposite: the world is unlocked and immediately selectable for everyone by default. `buildWorld`/`selectTheme` don't require a catalog entry to function, so nothing breaks; the world just ships with no gate. This resolved before merge for both New Derelict and Transit Authority, but it's a decision that needs to be made and acted on explicitly per world, not left as a byproduct of whether someone remembered to add the catalog line.

## No state-injection hook for manual validation of cross-card reactive effects

Effects like the Lockdown cluster tax only become visible once several hazards have accumulated a specific keyword state in hand — a state that's hard to reach deterministically by playing the app normally (the app generates a random seed and builds `TableScene` state internally, with no state injection exposed on `window` and no URL/debug fixture for constructing a specific hand). Manual validation of this kind of cross-card reactive behavior was attempted and abandoned as out of scope for a feature plan to build ad hoc; it's worth deciding, above the level of an individual world's plan, whether some form of scripted/injectable game state for manual QA is worth building once, generally.
