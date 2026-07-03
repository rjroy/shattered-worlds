---
title: RunModifiers — the Engine Hooks Unlocks Actually Touch
date: 2026-07-02
status: current
tags: [unlocks, run-modifiers, core-engine, starting-stats, hand-size, resources, rarity, keyword-bonus, act-boons, card-modifiers, architecture]
fg-type: architecture
fg-sources: [.lore/work/specs/unlock-system.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/world.ts
    - src/core/engine/energy.ts
    - src/core/effects/dealProgress.ts
    - src/core/engine/draw.ts
    - src/core/engine/actBoon.ts
    - src/core/engine/effectiveCards.ts
    - src/data/unlocks/types.ts
  tests:
    - src/core/tests/draw.test.ts
    - src/core/tests/effectiveCards.test.ts
---

# RunModifiers — the Engine Hooks Unlocks Actually Touch

`GameState.runModifiers` is the only state-level boundary the unlock system adds to the core model. It is set once in `createWorld` from resolved `RunModifiers` (or `DEFAULT_RUN_MODIFIERS` when none are supplied), and the core engine only ever reads it — the engine has no knowledge of the unlock catalog, purchases, or activation state. The bag currently carries starting-stat bonuses, turn resource floors, hand growth, rarity and keyword-progress bonuses, an optional act-boon definition, and effective player-card modifiers.

## Current engine hooks

- **Starting stats.** `createWorld` applies `extraStartHp`, `extraStartEnergy`, `extraStartLight`, `extraStartHeat`, and `extraStartBrace` when constructing the initial state. These are one-time run initialization bonuses, not per-turn effects.

- **Hand size.** `WORLD_CONSTS.maxHandSize` was renamed to `WORLD_CONSTS.baseHandSize` (unchanged value, 6) and `effectiveHandSize(state)` in `src/core/engine/world.ts` computes `baseHandSize + actIndex * runModifiers.handSizeBonusPerAct`. `refillHand` (`src/core/engine/draw.ts`) is the only draw-target function and must use `effectiveHandSize(state)`. `intensity.ts`'s normalization denominator and `WORLD_CONSTS.startPlayerCards` deliberately keep using the flat `baseHandSize` — they aren't a draw target, and switching them to the act-scaled value would corrupt intensity math.
- **Light floor.** `decayLight` (private, `src/core/engine/energy.ts`) decays light by the normal amount and then clamps it up to `runModifiers.minLightPerTurn` if the decayed value would fall below that floor. The floor can raise light from 0 back up to the floor value — the original early-return guard (`if (state.light <= 0) return`) had to be revised to also check `floor === 0` before short-circuiting, or an active floor unlock would never fire on a world already at 0 light.
- **Energy floor.** The turn-start `gainEnergy(state)` (zero-argument form) applies `Math.max(state.energy + 1, runModifiers.minEnergyPerTurn)`. This is distinct from the card-effect `gainEnergy(state, n)` in `src/core/effects/resources.ts` (the `GainEnergy` card handler), which intentionally does **not** receive the floor — a card's printed energy gain is not a turn-start event.
- **Keyword damage bonus.** `dealProgress` (`src/core/effects/dealProgress.ts`) adds `runModifiers.keywordDamageBonus` to a keyword-tag bonus only when the tag check already passed; a hazard without the matching keyword gets no bonus regardless of the modifier. `DealProgressAll` shares the same helper, so it inherits the bonus automatically.
- **Reward rarity.** Reward selection and act-boon offers pass `rarityBonus` into weighted template selection. The modifier changes tier weights; it does not bypass the caller's legality filtering.
- **Act boon.** The reducer reads `actBoon` after real act advancement and queues the configured boon offers. The modifier contains the pool and choice parameters, keeping Fortune-specific catalog data outside the reducer.
- **Effective player cards.** `effectiveCards.ts` folds `playerCardModifiers` into read-only card snapshots used by availability, resolution, previews, and rendering. Durable cards and templates are not mutated.

Two `UnlockEffect` variants intentionally have no `RunModifiers` field: `starterDeckOverride` is resolved at session creation, and `worldUnlock` controls world ownership outside a run. `actReward` is no longer one of these exceptions: `buildRunModifiers` resolves it into `actBoon`; see [[fortune-act-boon-rewards]].
