---
title: Destiny scene — purchase and activation UI
date: 2026-06-15
status: pending
tags: [task, unlocks, scene, ui, activation]
source: .lore/work/plans/unlock-system.md
sequence: 9
modules: [game-runtime, unlocks]
---

# Destiny scene — purchase and activation UI

The screen that makes the system reachable: spend Fragments, equip Blessings within the budget. Mirrors `ChronicleScene`. Depends on tasks 003, 007, 008.

## What

**`src/game/scenes/DestinyScene.ts`** — scene key `'Destiny'`, constructor `(featsStore: FeatsStore, unlocksStore: UnlocksStore)`. Reuse `ChronicleScene` idioms (dark bg `0x0d0a12`, gold `#d6b15c`, `addPanel`/`createButton`/confirm-overlay, `textStyle`/`TEXT`, 900×600):
- **Header** (REQ-UNLK-30): `✦ {computeSpendableBalance(...)} Fragments` **and** the budget meter `Destiny {pips} {activeWeight(activated)}/{DESTINY_BUDGET}` (filled/empty dots). Re-derived every render and after every purchase/toggle.
- **Card grid** (REQ-UNLK-31): two columns over `UNLOCK_CATALOG`; per card — art slot (`scene.textures.exists('unlock/' + id)` ? image : placeholder rect; missing art never throws), name, `destinyWeight` pips, effect + `description`, `✦ cost`, a purchase-state control and (when owned) an activation toggle. Wheel + arrow scroll when rows overflow (mirror Chronicle's worlds-scroll).
- **Purchase-state control** (REQ-UNLK-32): `unlockCardState` → `✓ owned` badge / interactive `Buy` / dimmed cost.
- **Activation toggle** (REQ-UNLK-37): owned cards show `◉ ACTIVE` / `◯ inactive`; click → `unlocksStore.setActive(id, !active)` → re-render. When inactive and `canActivate(def, activated, UNLOCK_CATALOG)` is false, render the toggle dimmed/non-interactive. Deactivation always allowed.
- **Purchase** (REQ-UNLK-33): `Buy` → confirm overlay naming the Blessing + cost → `unlocksStore.purchase(id)`; `'ok'` re-renders + brief confirmation (auto-activated card shows ACTIVE); error results surface in a message line (never swallowed).
- **Nav** (REQ-UNLK-29): `Back` button + `ESC` → `scene.start('WorldSelect')`.

**`src/game/scenes/WorldSelectScene.ts`:** add a `Destiny` button mirroring `createChronicleButton` → `this.scene.start('Destiny')`.

**`src/game/main.ts`:** add `new DestinyScene(gameplayRuntime.featsStore, gameplayRuntime.unlocksStore)` to the `scene` array (after `ChronicleScene`).

**`src/game/scenes/BootScene.ts`:** optionally attempt to preload `unlock/<id>` images if present (REQ-UNLK-34). Absence is the expected MVP state — placeholders handle it; skip if no art exists.

**Wiring test:** add two source-string assertions to the **existing** `src/game/tests/gameplaySessionIntegration.test.ts` (do not create a new file): `main.ts` constructs `DestinyScene` with both stores, and `WorldSelectScene` starts `'Destiny'` (REQ-UNLK-35).

## Validation

- `bun run typecheck` + **full** `bun run test` green (incl. the new wiring assertions).
- **Manual browser pass** (V13, V14, V15, V17) via `/run` or `/verify`:
  - Destiny reachable from WorldSelect; renders all ten Blessing cards; `Back`/`ESC` return (**V13**).
  - With balance ≥ cost: `Buy` → confirm → card flips `✓ owned`, header balance drops, the unlock auto-activates and shows ACTIVE; persists across page reload (**V14**).
  - Unaffordable cards show no `Buy`; owned show `owned` (**V15**).
  - Toggling ACTIVE/inactive updates the meter; toggling past 5 weight is blocked (**V17**).

## Why

REQ-UNLK-28, 29, 30, 31, 33, 34, 37; validators V13, V14, V15, V17.

## Files

- `src/game/scenes/DestinyScene.ts` (new), `src/game/scenes/WorldSelectScene.ts`, `src/game/main.ts`, `src/game/scenes/BootScene.ts`, `src/game/tests/gameplaySessionIntegration.test.ts`
