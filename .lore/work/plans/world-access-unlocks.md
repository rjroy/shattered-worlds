---
title: World access unlocks implementation plan
date: 2026-06-18
status: draft
tags: [plan, unlocks, destiny, world-select]
source: .lore/work/specs/world-access-unlocks.md
modules: [unlocks, world-select-scene, destiny-scene]
related: [.lore/work/specs/world-access-unlocks.md, .lore/work/specs/unlock-system.md]
---

# World access unlocks implementation plan

## Source

This plan implements `.lore/work/specs/world-access-unlocks.md`.

The plan resolves the spec's open questions this way:

- Clicking a locked world routes to `DestinyScene`.
- The World Select help overlay is gated for locked worlds; locked-world mechanics are not previewed through Help.
- `worldUnlock` purchases are kept out of `activated` entirely. Ownership lives in `purchased`; activation remains the run loadout.

## Step 1 — Extend unlock data and catalog

Files:

- `src/data/unlocks/types.ts`
- `src/data/unlocks/catalog.ts`
- `src/data/unlocks/catalog.test.ts`

Changes:

- Add `worldUnlock` to the `UnlockEffect` union with `worldId: string`.
- Add two catalog entries:
  - `world-fog-beach-party`, name `Fog Beach Party`, cost `5`, destinyWeight `0`, `worldId: "fog-beach-party"`.
  - `world-whiteout-parking-garage`, name `Whiteout Parking Garage`, cost `5`, destinyWeight `0`, `worldId: "whiteout-parking-garage"`.
- Add a `case "worldUnlock": break` branch to `buildRunModifiers`.
- Add a helper in `catalog.ts`, tentatively:

```ts
export function isWorldUnlocked(
  worldId: string,
  profile: UnlocksProfile,
  catalog: readonly UnlockDefinition[],
): boolean
```

The helper returns true for ungated worlds, true for gated worlds whose unlock id is purchased, and false for gated worlds whose unlock id is not purchased.

Validation:

- Add catalog tests for both new entries.
- Add tests that both world unlocks have zero active weight.
- Add tests that `buildRunModifiers(["world-fog-beach-party"], UNLOCK_CATALOG)` equals `DEFAULT_RUN_MODIFIERS`.
- Add access-helper tests for an ungated world, a locked gated world, a purchased gated world, and unknown purchased ids.

## Step 2 — Keep world unlocks out of activation

Files:

- `src/game/runtime/unlocksProfile.ts`
- `src/game/runtime/unlocksProfile.test.ts`

Changes:

- Update `createUnlocksStore().purchase` so `worldUnlock` effects are appended to `purchased` but not auto-added to `activated`.
- Update `setActive(id, true)` so an owned `worldUnlock` id returns `"ok"` without adding it to `activated`, or introduce an equivalent no-op path that preserves the existing public return type. Unowned world unlock ids must still return `"not-owned"`.
- Preserve the current profile shape and storage key.

Validation:

- Add a store test that purchasing `world-fog-beach-party` with sufficient fragments persists it in `purchased` and leaves `activated` unchanged.
- Add a store test or assertion that access is based on `purchased`, not `activated`.
- Add a store test that `setActive("world-fog-beach-party", true)` returns `"not-owned"` before purchase and does not mutate the profile.
- Run `bun run test src/game/runtime/unlocksProfile.test.ts`.

## Step 3 — Update Destiny shop rendering

Files:

- `src/game/scenes/DestinyScene.ts`
- `src/game/tests/gameplaySessionIntegration.test.ts`

Changes:

- Add a `worldUnlock` branch in `effectSummary`, e.g. `Unlocks world access`.
- Render zero-weight world unlock cards without pips and without the active/inactive toggle.
- For owned world unlocks, render an owned/unlocked label that does not imply run activation.
- Keep normal affordability and purchase confirmation behavior.
- Add a source-level assertion in the integration test that `effectSummary` handles `worldUnlock` and that `addActivationToggle` is guarded away from `worldUnlock` cards.

Validation:

- Run `bun run test src/game/tests/gameplaySessionIntegration.test.ts`.
- Run `bun run typecheck` after Step 3 because the `UnlockEffect` switch is widened.

## Step 4 — Wire unlock state into World Select

Files:

- `src/game/scenes/WorldSelectScene.ts`
- `src/game/main.ts`
- `src/game/tests/gameplaySessionIntegration.test.ts`

Changes:

- Change `WorldSelectScene` constructor to accept `unlocksStore?: UnlocksStore` in addition to `runStats?: RunStatsReader`.
- Store `unlocksStore` as a readonly scene dependency.
- Update `main.ts` to construct `new WorldSelectScene(gameplayRuntime.runStats, gameplayRuntime.unlocksStore)`.
- Update the existing app-boot source assertion to match the new constructor call.

Validation:

- Run `bun run test src/game/tests/gameplaySessionIntegration.test.ts`.

## Step 5 — Gate locked worlds in World Select

Files:

- `src/game/scenes/WorldSelectScene.ts`
- `src/game/tests/gameplaySessionIntegration.test.ts`

Changes:

- In `renderVisibleWorlds` / `createWorldCard`, compute `locked = !isWorldUnlocked(worldId, profile, UNLOCK_CATALOG)`.
- Keep locked cards visible in the carousel.
- Add a dim overlay or alpha treatment over locked cards, plus a compact lock/cost label such as `Locked - Destiny 5 Fragments`.
- Keep hover feedback modest for locked cards, but avoid implying they can launch a run.
- On locked-card click, call `this.scene.start("Destiny")` instead of launching `Table`.
- On unlocked-card click, keep the existing launch behavior.
- Keep `disableCarouselInteractions` behavior for unlocked launches only.

Validation:

- Add source assertions that `WorldSelectScene` imports/uses `isWorldUnlocked`, branches on locked state, starts `"Destiny"` for locked cards, and only launches `"Table"` through the unlocked branch.
- Run `bun run test src/game/tests/gameplaySessionIntegration.test.ts`.

## Step 6 — Gate World Select help for locked worlds

Files:

- `src/game/scenes/WorldSelectScene.ts`
- `src/game/tests/gameplaySessionIntegration.test.ts`

Changes:

- In `showHelpOverlay`, check the currently selected world with `isWorldUnlocked`.
- If locked, do not build `HelpOverlayView`.
- Route to `DestinyScene` or show a short locked message. Prefer routing to Destiny to match locked-card click behavior.
- Ensure this does not affect help for ungated or purchased worlds.

Validation:

- Add a source assertion that `showHelpOverlay` checks world access before constructing `HelpOverlayView`.
- Run `bun run test src/game/tests/gameplaySessionIntegration.test.ts`.

## Step 7 — Final validation

Commands:

- `bun run typecheck`
- `bun run test src/data/unlocks/catalog.test.ts`
- `bun run test src/game/runtime/unlocksProfile.test.ts`
- `bun run test src/game/tests/gameplaySessionIntegration.test.ts`
- `bun run test`

Manual browser validation:

1. Start the dev server.
2. Use a clean `localStorage` profile.
3. Confirm Fog Beach Party and Whiteout Parking Garage are visible but locked in World Select.
4. Confirm clicking either locked world opens Destiny and does not start a run.
5. Confirm the Help button for a locked selected world does not reveal its help overlay.
6. Seed enough earned fragments or use existing earned feats, buy `Fog Beach Party` for 5 Fragments, and confirm it shows as owned/unlocked without an activation toggle.
7. Return to World Select and confirm Fog Beach Party starts a run while Whiteout Parking Garage remains locked.

Completion criteria:

- All automated validation commands pass.
- Manual browser validation matches the spec.
- No profile migration is introduced.
- World access is based on `purchased`, not `activated`.
