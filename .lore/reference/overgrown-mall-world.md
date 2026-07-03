# Overgrown Mall World

<!--
date: 2026-07-02
status: current
tags: world-design, overgrown-mall, spore, prune, bloom, deal-progress-scaled
fg-type: concept
fg-sources: .lore/work/specs/overgrown-mall.html, .lore/work/brainstorm/overgrown-mall-world.html, .lore/work/plans/overgrown-mall.html
fg-status: current
fg-evidence:
  code:
    - src/data/allCards.json
    - src/data/worlds/overgrown-mall/cards.json
    - src/data/worlds/overgrown-mall/index.ts
    - src/core/effects/dealProgress.ts
    - src/core/effects/damage.ts
    - src/core/model/types.ts
  tests:
    - src/core/tests/effects.test.ts
    - src/core/tests/available.test.ts
  symbols:
    - Spore
    - DealProgressScaled
    - DamageScaled
-->

Overgrown Mall's threat verb is **infest**: world cards inject Spore cards into the player deck. The player response archetype is **prune and profit**, with a symbiosis line for players who choose to keep Spores and scale with them.

## Mechanical Identity

Spore is a player card with `energyCost: 1`, `exhaust: true`, and the `Spore` keyword. **Correction (verified 2026-07-02 against `src/data/allCards.json`):** the brainstorm's Design B locked Spore's effect as `None` (a true no-op — pruning costs only tempo). The shipped card diverges from that: Spore's effect is `DamageScaled { base: 0, per: KeywordInHand "Spore", amount: 1 }` — playing a Spore actually damages the player, scaled by how many Spores remain in hand. Pruning is not free; it gets more expensive the longer Spores are left to stack, which is a sharper tension than the brainstorm's plain no-op but is not what either the brainstorm or the original version of this page described. Bloom uses `DealProgressScaled` (also keyed on `KeywordInHand "Spore"`) to reward carrying Spores, making "clean it out" and "grow with it" both live strategic lines — that half of the design matches the brainstorm as written.

## World Shape

Acts escalate by delivery mechanism: avoidance pollution first, timed pollution next, then guaranteed next-turn Spore draws. The visual identity must distinguish this retail interior from Zombie Big Box by leaning into overgrowth-green intrusion, broken skylights, and civilization being reclaimed.
