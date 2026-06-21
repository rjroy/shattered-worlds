---
title: "Implementation notes: The Tidal Archive world"
date: 2026-06-20
status: in_progress
tags: [implementation, notes, the-tidal-archive, world-design, core-effect, displacement]
source: .lore/work/plans/the-tidal-archive.md
modules: [core-engine, world-data, game-view, themes]
related: [.lore/work/specs/the-tidal-archive.md]
---

# Implementation notes: The Tidal Archive world

Implementing [the-tidal-archive plan](../plans/the-tidal-archive.md) (`REQ-TIDAL-1` … `REQ-TIDAL-58`) as orchestrator. Phases are the plan's four slices (A→B→C→D), executed via sub-agents (implement → test → review per slice). No task files existed, so phases come from the plan directly. Agent roles fall back to `general-purpose` (no `.lore/lore-agents.md`).

## Progress

- [ ] **Slice A** — Core: recall effects + end-turn passive (`REQ-TIDAL-9..18, 52, 53, 54`)
- [ ] **Slice B** — World data + registration + boon source (`REQ-TIDAL-1, 4-7, 19-41, 47, 48, 55`)
- [ ] **Slice C** — Assets, selection UI, help, docs (`REQ-TIDAL-2, 14, 42-46, 49, 50, 57`)
- [ ] **Slice D** — Validation + spec reconciliation (`REQ-TIDAL-51, 56, 58`)

## Key gotchas (from lore-researcher, code-anchored)

1. `recallTarget` TargetSpec touches 8 sites / 3 files, most with no `default`: `available.ts checkSpec` (mandatory), six `selection.ts` branches, `sim/policy.ts buildPlayAction`.
2. `ReturnWorldCards` inert on world auto-hooks (`ctx.returnIds` undefined) → use `AddWorldCardToDeck { bTop: true }`. Player-played is fine.
3. `Brace` only absorbs `ForceDestroy` (snatch), never `Damage`. `ForceDestroy` removes from hand outright (not to discard) → does NOT feed Tidal Memory recall.
4. `Hidden` is not a keyword (`Obstructed | Creature | Slow | Spore | Concealed`). theme-authoring.md is stale on this.
5. Boon cards single-sourced in `boons/tidal.json`, registered in `boons/fortune.ts`; auto-merge via `worldManifest.ts`. Do NOT redefine in `cards.json`.
6. Registry init cycle risk when adding handlers (offer-boon hit `registry -> composite -> describe/available -> registry`, fixed by lazy lookup). Watch for it.
7. JSON catalogs are NOT typechecked — parameterized world tests are the only guard for ref resolution.
8. Browser smoke likely unavailable; fall back to build + local-server HTTP 200 + asset checks (per whiteout notes).

## Log

- 2026-06-20: Initialized. lore-researcher confirmed City of Sleeping Giants plan is the closest mirror; whiteout-parking-garage notes + offer-boon-rewards notes are the relevant prior `/implement` logs.
