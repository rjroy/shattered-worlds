---
title: Unlock System Runtime Ownership
date: 2026-06-25
status: current
tags: [unlocks, destiny, run-modifiers, runtime, meta-progression]
fg-type: architecture
fg-sources: [.lore/work/plans/unlock-system.md, .lore/work/notes/unlock-system.md, .lore/work/brainstorm/unlock-system.md, .lore/work/specs/unlock-system.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/gameplayRuntime.ts
    - src/game/runtime/unlocksProfile.ts
    - src/data/unlocks/catalog.ts
    - src/data/unlocks/types.ts
  tests:
    - src/game/runtime/gameplayRuntime.test.ts
    - src/game/runtime/unlocksProfile.test.ts
    - src/data/unlocks/catalog.test.ts
  symbols:
    - RunModifiers
    - startSession
    - UnlocksProfile
---

# Unlock System Runtime Ownership

The unlock system belongs to the gameplay runtime. `TableScene` no longer assembles worlds directly; the runtime chooses the starter deck override, builds `RunModifiers` from the activated unlock subset, assembles the world, and starts the gameplay session through one path.

Purchasing unlocks and activating run modifiers are distinct. The Destiny scene handles both buying Blessings and toggling which owned modifiers are active within the Destiny budget. Only activated ids feed `buildRunModifiers`.

## Persistence

The unlock profile stores purchased ids and activated ids. Spendable Memory Fragments are derived from earned feats minus purchased unlock costs, not stored as a mutable balance. Activated ids are constrained to purchased ids.

## Runtime Seam

Production `startSession(worldId, seed, options)` assembles from manifests and unlock state. Tests can inject `options.world` to supply a hand-built catalog and world data, but both production and test paths converge on the same modifier and session-creation tail.

## Destiny UI

Destiny is the between-run purchase and loadout screen. It displays spendable Fragments, active weight against the Destiny budget, purchase state, and activation toggles. Purchases auto-activate when they fit.

See [[run-modifiers-engine-hooks]] for the specific core-engine call sites (`effectiveHandSize`, `decayLight`, `gainEnergy`, `dealProgress`) that read the assembled `RunModifiers` bag.

## UX model considered

The design brainstorm weighed three shapes for where unlocks live before settling on purchase-then-activate:

- **Always-on** (purchase = permanent effect, no per-run choice). Rejected as the sole model: simple and narratively clean, but the power floor only rises over time and every run converges toward feeling the same once a player owns enough Blessings.
- **Per-world gating** (an unlock is tied to clearing a specific world's feat, contextual rather than cross-world). Rejected as the primary model: interesting as a supplement, but it breaks the "Destiny grows across all worlds" narrative and limits cross-world power expression.
- **Purchase + per-run activation** (Hades/Mirror model: buy permanently, then choose a subset to bring within the Destiny budget each run). Chosen: gives a replay decision every run and a natural god-mode gate via the budget.

The activation layer was deliberately sequenced as a second step, not built alongside the shop. The brainstorm's stated risk: building a "pick N from your unlocks" screen while the player owns only 1–2 Blessings makes the choice trivial and the extra screen pure friction. The MVP path was always-on (every purchased unlock active) first, with the activation screen added once the catalog had roughly 6+ unlocks to make the choice meaningful — which matches the shipped Destiny scene's toggle-based activation.
