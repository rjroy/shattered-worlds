---
title: Effective Card Modifiers Read Model
date: 2026-06-25
status: current
tags: [effective-cards, unlocks, run-modifiers, card-system, read-model]
fg-type: architecture
fg-sources: [.lore/work/plans/effective-card-modifiers.md, .lore/work/notes/effective-card-modifiers.md, .lore/work/brainstorm/unlocks-modifying-card-templates.md]
fg-status: current
fg-evidence:
  code:
    - src/core/engine/effectiveCards.ts
    - src/core/engine/available.ts
    - src/core/engine/reduce.ts
    - src/data/unlocks/types.ts
  tests:
    - src/core/tests/effectiveCards.test.ts
    - src/core/tests/available.test.ts
  symbols:
    - RunModifiers
    - effectiveCard
    - effectivePlayerCard
---

# Effective Card Modifiers Read Model

Player-card modifiers are applied as a pure read-model. Durable cards in `GameState` zones remain unchanged; core rules and UI derive effective player-card snapshots when they need to check legality, render card faces, spend energy, or resolve effects.

Modifiers are activated through `RunModifiers`. A modifier can target card templates, check conditions such as play ordinal, resources, or HP, and patch properties such as energy cost, exhaust behavior, name, keywords, or effect composition.

## Core Contract

Available-actions logic derives effective cards before checking affordability and target requirements. Reducer play resolution derives the snapshot before incrementing play history, validates against the same effective availability path, then removes or recycles the base card while applying the effective effect and cost.

Turn play history lives in core state and resets on end turn. It supports modifiers such as "first Sprint this turn costs 0" without mutating the card templates or the individual card instances.

## Design Constraint

Effective snapshots are not authority on their own. Reducer validation remains authoritative, and UI-selected snapshots are presentation/read-model artifacts. This prevents unlocked card changes from becoming a second rules engine in the renderer.

The table scene captures a selected effective snapshot when targeting or modal selection begins. That snapshot remains stable even if live modifiers change before the action completes, so previews, connector styling, target specs, and reducer submission all describe the same chosen card.

## Patch and condition vocabulary

`PlayerCardPatch` (`src/data/unlocks/types.ts`) is a closed, narrowly-typed union — `setEnergyCost`, `addEnergyCost`, `setExhaust`, `replaceEffect`, `prependEffect`, `appendEffect`, `addKeyword`, `rename` — rather than a generic transform callback. `PlayerCardModifierCondition` covers `always`, `templatePlayOrdinalThisTurn`, `anyPlayOrdinalThisTurn`, `hp`/`resource` threshold checks, and `and`/`or`/`not` composition. Modifier targets are template-id only (`PlayerCardModifierTarget.kind === "template"`); keyword-based targeting (e.g. "all Hidden tools cost 1 less") was scoped out at design time and never added — start narrow, add keyword targets only when a design actually needs one.

## Alternatives considered

Two other designs for reaching this behavior were rejected before landing on the read-model approach:

- **Mutate card instances directly** (rewrite the first `Sprint` in hand to cost 0 at turn start, rewrite it back after it's played). Rejected as brittle: it doesn't have a clean answer for which copy becomes free with duplicates in hand, cards drawn or returned mid-turn, or a free copy that gets destroyed before being played.
- **A fully generic patch** (`transform: (card, state) => Partial<PlayerCard>` as arbitrary code). Rejected because it's hard to serialize, inspect in the UI, or test as data, and it would let unlock content reach outside the core/data boundary — the closed patch union above solves the same examples without that risk.

A trigger/event-listener model (`onBeforePlayCard`, `onAfterPlayCard`, `onTurnStart`, `onCardMinted`) was also considered as a more relic-like alternative, but was set aside as a larger engine concept than "card template patches" — cost and target changes still need to integrate with `availableActions` either way, so the effective-card read-model was the narrower, sufficient path.
