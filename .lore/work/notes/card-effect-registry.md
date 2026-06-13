---
title: "Implementation notes: card-effect handler registry"
date: 2026-06-13
status: in_progress
tags: [implementation, notes, card-effect, registry, refactor, core]
source: .lore/work/plans/card-effect-registry.md
modules: [core-model, core-engine, core-view, game-interaction]
related: [.lore/work/design/card-effect-registry.md]
---

# Implementation notes: card-effect handler registry

Orchestrated implementation of the card-effect handler registry refactor. Replaces
seven `switch (effect.kind)` statements across five files with one handler class per
`kind`, registered in an exhaustive map.

Branch: `effect-handler-registry` (off `master`).

## Setup findings

- **Token-IR collision is moot.** The researcher warned a `card-effect-token-ir`
  branch was unmerged and would collide on `compileEffect`/`describe.ts`. Verified
  against current master: `effectGlyphs.ts`/`compileEffect` and all other target
  files already exist on master (landed via #56/#57). No collision; proceed.
- **Real test command is `bun run test`** (`bun test --preload ./src/game/tests/testSetup.ts`),
  not bare `bun test`. Gate commands: `bun run typecheck`, `bun run test`,
  `bun run lint`, `bun run build`.
- All 6 `default:` sites confirmed at the plan's line numbers: available.ts (62, 127,
  202, 242), describe.ts (169), feedback.ts (95).
- No prior task files, no `.lore/lore-agents.md`. Roles filled by `general-purpose`
  (implementation/testing/review), with `typescript-quality` skill applied at Steps 2/5/7.

## Progress

<!-- Status: ☐ pending · ◐ in progress · ☑ done -->

- ☑ **Step 1** (Phase 0) — make silent switches fail closed (delete 6 `default:`, enumerate cases)
- ☐ **Step 2** (Phase 1) — scaffold EffectHandler base + EffectContext + EffectResult
- ☐ **Step 3** (Phase 1) — composite handlers (Modal/Sequence) + recursion seam
- ☐ **Step 4** (Phase 1) — DealProgress handlers + HazardTargetingHandler
- ☐ **Step 5** (Phase 1) — registry + dispatcher wiring (GO/NO-GO gate)
- ☐ **Step 6** (Phase 2) — migrate remaining leaf kinds, grouped by file
- ☐ **Step 7** (Phase 2) — remove transitional fallback; exhaustive map
- ☐ **Step 8** (Phase 3) — relocate connectorStyle into core; slim feedback.ts
- ☐ **Step 9** — validation against design + manual browser smoke

## Log

### Init (2026-06-13)
- Read plan + design + frontmatter schema. No existing tasks/notes/agents registry.
- lore-researcher: only plan+design exist for the registry itself; adjacent token-IR
  design is context not a prerequisite; ForceDestroy retro warns deferred effects
  (`pendingForceDestroy`, `skipDrawNext`) split logic into draw.ts/energy.ts — a
  per-kind handler may not capture deferred resolution. Carry as a watch item.
- Created branch `effect-handler-registry`.

### Step 1 — fail-closed (complete)
- Implementer removed `default:` from all 6 switches, enumerated explicit cases. No
  test edits, no behavior change. `CardEffect` union has 24 kinds.
- Reviewer (fresh context) audited every added case against the old default value
  1:1 — all correct. `computeLegalTargets` leaf step-0 body preserved as shared
  fallthrough (not collapsed to `[]`). Noted intentional asymmetry: `DealProgressAll`
  → non-null in `dealProgressOf` but `null` in `selectConnectorStyle` (matches master).
- Gate green both runs: typecheck clean, 613 pass / 0 fail, lint clean.
- Commit: per-step on feature branch (recoverability across the 9-step refactor).
