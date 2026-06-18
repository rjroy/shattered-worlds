---
title: World access unlocks
date: 2026-06-18
status: draft
tags: [unlocks, destiny, world-select, meta-progression]
modules: [unlocks, world-select-scene, destiny-scene]
related: [.lore/work/specs/unlock-system.md, .lore/work/specs/world-select.html, .lore/reference/destiny-progression.html]
req-prefix: WAU
---

# World access unlocks

## Summary

Some worlds should start locked and become available through the existing Destiny unlock shop. These unlocks cost Memory Fragments but do not consume the 5-point Destiny activation budget and do not apply run modifiers.

Fog Beach Party and Whiteout Parking Garage are the first gated worlds. Each costs 5 Fragments and has 0 Destiny Weight.

## Scope

In scope:

- Add world-access unlocks to the existing unlock data model.
- Add two catalog entries for Fog Beach Party and Whiteout Parking Garage.
- Make World Select prevent starting locked worlds.
- Make the Destiny scene render owned world-access unlocks without activation toggles.
- Preserve existing purchased/activated profile persistence shape.

Out of scope:

- Changing feat rewards or fragment economy values.
- Adding a separate run-start loadout screen.
- Reordering worlds in the registry.
- Locking worlds through save migration or profile version changes.
- Hiding worlds from Chronicle history.

## Requirements

**REQ-WAU-1 — World-access unlock effect.** `UnlockEffect` must include a pure-data effect variant for unlocking a world:

```ts
{ readonly type: "worldUnlock"; readonly worldId: string }
```

The effect grants access when the unlock id is present in `UnlocksProfile.purchased`. It must not require the unlock id to be present in `UnlocksProfile.activated`.

**REQ-WAU-2 — Catalog entries.** `UNLOCK_CATALOG` must include exactly these two world-access unlock entries:

| id | name | cost | destinyWeight | worldId |
| --- | --- | ---: | ---: | --- |
| `world-fog-beach-party` | `Fog Beach Party` | 5 | 0 | `fog-beach-party` |
| `world-whiteout-parking-garage` | `Whiteout Parking Garage` | 5 | 0 | `whiteout-parking-garage` |

Descriptions should make clear that the purchase opens the world in World Select. These ids are stable and must not be renamed once shipped.

**REQ-WAU-3 — Zero-weight purchase behavior.** Purchasing a world-access unlock must spend its fragment cost and append the id to `purchased`. Because its `destinyWeight` is 0, it may be auto-added to `activated` by the existing store rule, but gameplay and access checks must not depend on activation. If implementation chooses to avoid activating `worldUnlock` entries, that behavior must be explicit and covered by tests.

**REQ-WAU-4 — Run modifiers ignore world unlocks.** `buildRunModifiers` must treat `worldUnlock` as a no-op. A world-access unlock must not change starting stats, hand size, resource floors, card modifiers, starter deck selection, act boons, `appliedModifiers`, or any other run behavior.

**REQ-WAU-5 — World access helper.** Add a tested helper that answers whether a world is unlocked from a profile and catalog. It must return:

- `true` for worlds with no matching `worldUnlock` catalog entry.
- `true` when a matching `worldUnlock` entry exists and its unlock id is in `profile.purchased`.
- `false` when a matching `worldUnlock` entry exists and its unlock id is not in `profile.purchased`.

Unknown purchased ids are ignored.

**REQ-WAU-6 — World Select store wiring.** `WorldSelectScene` must receive `UnlocksStore` from the composition root, alongside the existing run-stats dependency. `main.ts` must construct it with `gameplayRuntime.unlocksStore`.

**REQ-WAU-7 — Locked world presentation.** World Select must continue to show locked worlds in the carousel. A locked card must be visually distinct from playable cards with a dimmed treatment and a lock/cost affordance that communicates the world is unlocked in Destiny for 5 Fragments.

**REQ-WAU-8 — Locked world interaction.** Clicking a locked world card must not launch `TableScene`. The click should either do nothing except show a short message, or route the player to `DestinyScene`; the chosen behavior must be consistent for both locked worlds.

**REQ-WAU-9 — Help overlay behavior.** The World Select help button must not bypass world locking. If the currently selected world is locked, the help overlay should not expose the locked world's mechanical details unless the implementation intentionally treats help as preview content. The chosen behavior must be explicit in tests or a source-level assertion.

**REQ-WAU-10 — Destiny card rendering.** In `DestinyScene`, owned world-access cards must render as owned/unlocked and must not render an activation toggle that implies they consume Destiny budget. Unowned world-access cards follow the normal purchase states: affordable at balance >= 5, unaffordable below 5.

**REQ-WAU-11 — Effect summary.** `effectSummary` must handle `worldUnlock` with text that distinguishes it from run modifiers, such as `Unlocks world access`.

**REQ-WAU-12 — Existing saves.** Existing unlock profiles remain valid. A player with no purchased world-access unlocks sees Fog Beach Party and Whiteout Parking Garage locked after the change. A profile that already contains either new id in `purchased` sees that world unlocked.

**REQ-WAU-13 — Direct runtime policy.** World access enforcement is required in World Select. Direct calls to `gameplayRuntime.startSession(worldId, seed)` may continue to start any world for tests and development, unless a later implementation plan chooses to add an explicit runtime guard with a test bypass.

## AI Validation

**V1 — Typecheck.** `bun run typecheck` exits 0.

**V2 — Catalog tests.** `bun run test src/data/unlocks/catalog.test.ts` passes and includes coverage that:

- both world-access unlock ids exist with cost 5 and destinyWeight 0;
- `buildRunModifiers(["world-fog-beach-party"], UNLOCK_CATALOG)` equals `DEFAULT_RUN_MODIFIERS`;
- `activeWeight(["world-fog-beach-party", "world-whiteout-parking-garage"], UNLOCK_CATALOG)` is 0.

**V3 — Access helper tests.** A unit test covers the helper from REQ-WAU-5 for ungated worlds, locked gated worlds, purchased gated worlds, and unknown purchased ids.

**V4 — Unlock store tests.** `bun run test src/game/runtime/unlocksProfile.test.ts` passes and covers purchase of a 0-weight world-access unlock: the purchase spends 5 Fragments, persists ownership, and does not make the unlock required in `activated` for access.

**V5 — Destiny shop tests or source assertions.** Tests or source assertions verify that `DestinyScene` has a `worldUnlock` summary branch and does not call `addActivationToggle` for world-access unlocks.

**V6 — World Select wiring tests.** Existing lightweight scene wiring tests verify that `main.ts` passes `gameplayRuntime.unlocksStore` into `WorldSelectScene`.

**V7 — Locked launch prevention.** A World Select test or source assertion verifies that locked Fog Beach Party and locked Whiteout Parking Garage do not call `this.scene.launch("Table", ...)`.

**V8 — Manual browser pass.** In a clean localStorage profile:

1. Open World Select.
2. Confirm Fog Beach Party and Whiteout Parking Garage are visible but locked.
3. Confirm clicking either locked world does not start a run.
4. Open Destiny and confirm each world unlock costs 5 Fragments and shows no Destiny pips/toggle.
5. With enough Fragments, buy one world unlock.
6. Return to World Select and confirm that world is playable while the other remains locked.

**V9 — Full regression.** `bun run test` exits 0.

## Open Questions

- Should clicking a locked world send the player directly to Destiny, or stay on World Select with a short message?
- Should the help overlay preview locked-world mechanics, or should it also be gated?
- Should 0-weight world unlocks be kept out of `activated` entirely to avoid confusing persisted state, even though current purchase logic auto-activates anything that fits?
