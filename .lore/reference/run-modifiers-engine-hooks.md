---
title: RunModifiers — the Four Engine Hooks Unlocks Actually Touch
date: 2026-07-02
status: current
tags: [unlocks, run-modifiers, core-engine, hand-size, energy, light, keyword-bonus, architecture]
fg-type: architecture
fg-sources: [.lore/work/specs/unlock-system.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/world.ts
    - src/core/engine/energy.ts
    - src/core/effects/dealProgress.ts
    - src/core/engine/draw.ts
    - src/data/unlocks/types.ts
  tests:
    - src/core/tests/draw.test.ts
---

# RunModifiers — the Four Engine Hooks Unlocks Actually Touch

`GameState.runModifiers` (a `RunModifiers` bag: `extraStartHp`, `extraStartEnergy`, `extraStartLight`, `extraStartBrace`, `handSizeBonusPerAct`, `minLightPerTurn`, `minEnergyPerTurn`, `keywordDamageBonus`) is the only change the unlock system makes to `src/core/model/types.ts`. It is set once in `createWorld` from the resolved `RunModifiers` (or `DEFAULT_RUN_MODIFIERS` when none are supplied) and the core engine only ever reads it — the engine has no knowledge of the unlock catalog, purchases, or activation state. Four call sites read the bag:

- **Hand size.** `WORLD_CONSTS.maxHandSize` was renamed to `WORLD_CONSTS.baseHandSize` (unchanged value, 6) and `effectiveHandSize(state)` in `src/core/engine/world.ts` computes `baseHandSize + actIndex * runModifiers.handSizeBonusPerAct`. `refillHand` (`src/core/engine/draw.ts`) is the only draw-target function and must use `effectiveHandSize(state)`. `intensity.ts`'s normalization denominator and `WORLD_CONSTS.startPlayerCards` deliberately keep using the flat `baseHandSize` — they aren't a draw target, and switching them to the act-scaled value would corrupt intensity math.
- **Light floor.** `decayLight` (private, `src/core/engine/energy.ts`) decays light by the normal amount and then clamps it up to `runModifiers.minLightPerTurn` if the decayed value would fall below that floor. The floor can raise light from 0 back up to the floor value — the original early-return guard (`if (state.light <= 0) return`) had to be revised to also check `floor === 0` before short-circuiting, or an active floor unlock would never fire on a world already at 0 light.
- **Energy floor.** The turn-start `gainEnergy(state)` (zero-argument form) applies `Math.max(state.energy + 1, runModifiers.minEnergyPerTurn)`. This is distinct from the card-effect `gainEnergy(state, n)` in `src/core/effects/resources.ts` (the `GainEnergy` card handler), which intentionally does **not** receive the floor — a card's printed energy gain is not a turn-start event.
- **Keyword damage bonus.** `dealProgress` (`src/core/effects/dealProgress.ts`) adds `runModifiers.keywordDamageBonus` to a keyword-tag bonus only when the tag check already passed; a hazard without the matching keyword gets no bonus regardless of the modifier. `DealProgressAll` shares the same helper, so it inherits the bonus automatically.

Two `UnlockEffect` variants (`starterDeckOverride`, `actReward`) intentionally have **no** `RunModifiers` field — they're handled elsewhere (starter deck resolution at session creation; `actReward` has no engine wiring at all yet, see [[destiny-blessing-catalog-design]] for its later resolution as [[fortune-act-boon-rewards]]). `buildRunModifiers` silently skips both when folding the activated-unlock list into the bag.
