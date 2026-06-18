---
title: Effective card modifiers
date: 2026-06-17
status: draft
tags: [unlocks, card-system, effective-cards, gameplay-identity]
modules: [unlocks, core-engine, card-system, table-scene]
related: [.lore/work/brainstorm/unlocks-modifying-card-templates.md, .lore/work/brainstorm/unlocks-changing-gameplay.md, .lore/work/specs/unlock-system.md]
req-prefix: CARDMOD
---

# Effective card modifiers

## Context

The current unlock system can modify run-level stats through `RunModifiers`, but the more interesting gameplay unlocks change how existing player cards behave. Examples include:

- the first `Sprint` each turn costs `0`
- the second `Explore` each turn adds an extra effect
- `Panic` keeps its normal behavior but also progresses all world cards

These changes must not rewrite the durable card objects in hand, draw, or discard. Instead, the engine and UI need an **effective card** read-model: a derived copy of a base player card under the current game state and active modifiers.

This matters most for conditional modifiers. If the player has three `Sprint` cards in hand and "first `Sprint` each turn costs 0" is active, all three visible `Sprint` cards should render as free until one `Sprint` has finished resolving. Then the remaining `Sprint` cards should re-render at their normal cost. No individual hand card was secretly chosen as "the free Sprint."

## Scope

In scope:

- Pure-data card modifier types carried through active run modifiers.
- Per-turn play history in core state.
- Effective player card derivation without mutating base cards.
- Stable selected-card snapshots for targeting and play resolution.
- Rendering visible hand cards from effective cards.
- Ensuring `availableActions`, targeting, previews, connector styles, and `reduce` agree on effective card behavior.
- A small first modifier vocabulary: exact template targeting, simple ordinal/resource conditions, and basic player card patches.

Out of scope:

- Mid-run acquisition of new unlocks.
- Arbitrary JavaScript/card transform callbacks in unlock data.
- Keyword-targeted card modifiers.
- Cross-modifier predicates such as "cards made free by another modifier exhaust."
- Networked, delayed, or multiplayer action validation.
- Final unlock catalog design using this mechanism.

## Terms

**Base card:** the durable `PlayerCard` stored in `GameState.hand`, `playerDraw`, or `playerDiscard`.

**Effective card:** a derived `PlayerCard` copy produced from a base card, current `GameState`, and active `PlayerCardModifier` data. Effective cards are read-models and must not be stored back into card zones.

**Selected card snapshot:** the effective card captured when a player starts targeting or playing a card. This snapshot remains stable through that selection/play even if game state changes during resolution.

**Template play ordinal:** the 1-based count of a template's successful play within the current turn. If no `Sprint` has been played this turn, the next `Sprint` has template play ordinal `1`.

## Requirements

### Modifier Data

**REQ-CARDMOD-1:** Extend active run modifier data with `playerCardModifiers: readonly PlayerCardModifier[]`, defaulting to `[]` when no active unlock provides card modifiers.

**REQ-CARDMOD-2:** Define `PlayerCardModifier` as pure serializable data. It must include a stable modifier id, an exact player-card template target, a condition, and one or more patches.

Suggested shape:

```typescript
export type PlayerCardModifier = {
  readonly id: string;
  readonly target: PlayerCardModifierTarget;
  readonly condition: PlayerCardModifierCondition;
  readonly patches: readonly PlayerCardPatch[];
};
```

**REQ-CARDMOD-3:** The first implementation must support exact template targeting:

```typescript
export type PlayerCardModifierTarget =
  | { readonly kind: "template"; readonly templateId: CardTemplateId };
```

**REQ-CARDMOD-4:** The first implementation must not support keyword, name, source-world, cost-derived, or arbitrary predicate targets. Those target families require later specs.

**REQ-CARDMOD-5:** The first condition vocabulary must support:

- `always`
- `templatePlayOrdinalThisTurn`
- `anyPlayOrdinalThisTurn`
- `hp` threshold
- `resource` threshold for `energy`, `light`, `heat`, and `brace`
- `and`, `or`, and `not`

**REQ-CARDMOD-6:** `templatePlayOrdinalThisTurn` is evaluated before the current play increments history. For example, when zero `Sprint` cards have been played this turn, a `Sprint` currently being evaluated has ordinal `1`.

**REQ-CARDMOD-7:** The first patch vocabulary must support:

- set energy cost
- add energy cost
- set exhaust
- replace effect
- prepend effect
- append effect
- add keyword
- rename

**REQ-CARDMOD-8:** Modifier definitions must not contain executable transform functions. Effect changes must be represented through typed patches and existing `CardEffect` data.

**REQ-CARDMOD-9:** Multiple modifiers applying to the same card must be deterministic. Apply matching modifiers in their `playerCardModifiers` array order, and apply each modifier's patches in array order.

**REQ-CARDMOD-10:** Effect composition must preserve readable effect trees. Prepending or appending an effect must produce a `Sequence` and should flatten adjacent `Sequence` wrappers where doing so does not change semantics.

### Turn Play History

**REQ-CARDMOD-11:** Add core state for per-turn successful player-card plays:

```typescript
export type TurnPlayHistory = {
  readonly cardsPlayedThisTurn: number;
  readonly byTemplateId: Readonly<Record<CardTemplateId, number>>;
};
```

**REQ-CARDMOD-12:** `GameState` must include `turnPlayHistory`. It starts empty at run creation.

**REQ-CARDMOD-13:** On a successful `PlayCard`, core must increment `cardsPlayedThisTurn` and the played card's `byTemplateId[templateId]` exactly once, after the effective-card snapshot for that play has been derived.

**REQ-CARDMOD-14:** Illegal or rejected `PlayCard` actions must not increment turn play history.

**REQ-CARDMOD-15:** Turn play history must reset to empty when a new player turn begins after `EndTurn` processing. The reset must happen before the next turn's hand is evaluated for playability or rendered as effective cards.

**REQ-CARDMOD-16:** `CardPlayed` events must include `templateId` and the played card's `templateOrdinalThisTurn`.

Suggested shape:

```typescript
{ type: "CardPlayed"; cardId: CardId; templateId: CardTemplateId; templateOrdinalThisTurn: number }
```

Existing aggregate run stats may continue counting `CardPlayed` events without depending on the added fields.

### Effective Card Derivation

**REQ-CARDMOD-17:** Core must expose a pure effective-card derivation function for player cards.

Suggested shape:

```typescript
effectivePlayerCard(card: PlayerCard, state: GameState): PlayerCard
```

**REQ-CARDMOD-18:** `effectivePlayerCard` must return the original card object or an equivalent copy when no modifier applies. It must never mutate the input card.

**REQ-CARDMOD-19:** `effectivePlayerCard` must only apply modifiers whose target matches the base card and whose condition is true for the current state and base card.

**REQ-CARDMOD-20:** The returned effective card must preserve stable identity fields required to dispatch and reconcile the base card: `id`, `templateId`, and `sourceWorldId`.

**REQ-CARDMOD-21:** Conditional modifiers must be evaluated against current core state before the current play is counted. A "first `Sprint` each turn" modifier is active for every visible `Sprint` while `turnPlayHistory.byTemplateId.Sprint` is unset or `0`.

**REQ-CARDMOD-22:** Effective card derivation must be used by `availableActions` for energy affordability and playable target spec derivation.

**REQ-CARDMOD-23:** Effective card derivation must be used by `availableActions.legalTargets` so legal target ids reflect the effective effect tree.

**REQ-CARDMOD-24:** Effective card derivation must be used by reducer play resolution for energy spending, effect application, exhaust handling, and `CardDestroyed` emission.

**REQ-CARDMOD-25:** Base cards in `GameState.hand`, `playerDraw`, and `playerDiscard` must remain unmodified by conditional effective-card derivation.

### Selected Card Snapshots

**REQ-CARDMOD-26:** Starting a card play or targeting interaction must capture a selected effective-card snapshot before the current play is recorded in turn play history. This snapshot is stable for that interaction.

**REQ-CARDMOD-27:** A selected snapshot must continue resolving with its captured cost, effect, exhaust value, and keywords even if resolving the card changes state such that the modifier condition would no longer be true.

**REQ-CARDMOD-28:** The reducer must not re-evaluate a selected card's effective fields after it has begun resolving the current `PlayCard` action.

**REQ-CARDMOD-29:** During reducer handling of `PlayCard`, the effective snapshot used for cost, effect, and exhaust must be derived before emitting the `CardPlayed` event, incrementing play history, spending energy, or applying effects.

**REQ-CARDMOD-30:** If the implementation keeps selected snapshots only in UI state, the reducer must still derive an equivalent authoritative snapshot at action validation/resolution time. UI snapshots are read-models, not trust boundaries.

**REQ-CARDMOD-31:** The initial implementation may omit a snapshot version/token on `Action.PlayCard` because play is local and synchronous. The design must leave room for a future token if action replay or delayed automation requires exact snapshot verification.

### View And Interaction

**REQ-CARDMOD-32:** Visible hand rendering must pass effective cards to `CardView` for player cards. `CardView` should continue to be data-in/data-out and must not read `GameState` or compute modifiers itself.

**REQ-CARDMOD-33:** When "first `Sprint` each turn costs 0" is active and three `Sprint` cards are visible before any `Sprint` has resolved this turn, all three visible `Sprint` cards must show the effective `0` cost.

**REQ-CARDMOD-34:** After one `Sprint` resolves under that condition, remaining visible `Sprint` cards must re-render from fresh state and show their non-free effective cost.

**REQ-CARDMOD-35:** Selection target steps must be derived from the selected effective-card snapshot, not from the base card's effect.

**REQ-CARDMOD-36:** Targeting state must not change its step list during an active selection because state changed elsewhere. The active selection keeps the snapshot-derived target spec until the selection is completed or canceled.

**REQ-CARDMOD-37:** Target preview text must use the selected effective-card snapshot so previewed progress and clears match the effect that will resolve.

**REQ-CARDMOD-38:** Connector style must use the selected effective-card snapshot so connectors match the active effective effect step.

**REQ-CARDMOD-39:** Playability highlights must use effective card affordability and playability.

**REQ-CARDMOD-40:** Effective card rendering should make modified behavior visible on the card face through existing cost and effect rendering. Additional unlock badges or inactive-condition text are out of scope for the first implementation.

### Catalog And Unlock Integration

**REQ-CARDMOD-41:** Unlock catalog entries may define card-modifier effects that build `PlayerCardModifier` data into active run modifiers.

**REQ-CARDMOD-42:** Core must know only generic `PlayerCardModifier` data, not unlock ownership, purchase state, destiny budget, or fragment economy.

**REQ-CARDMOD-43:** Card modifiers apply only when their unlock is active for the current run. Purchased but inactive unlocks must not affect effective cards.

**REQ-CARDMOD-44:** Modifiers targeting templates absent from the current run's catalog must be inert and must not throw.

## Example Requirements

These examples are normative acceptance cases for the first implementation.

**REQ-CARDMOD-45:** A static modifier targeting `Panic` that appends `{ kind: "DealProgressAll", base: 1 }` must render `Panic` with the added effect and resolve both the original effect and the appended progress-all effect.

**REQ-CARDMOD-46:** A conditional modifier targeting `Sprint` with `templatePlayOrdinalThisTurn: 1` and `setEnergyCost: 0` must make all visible `Sprint` cards free while no `Sprint` has resolved this turn.

**REQ-CARDMOD-47:** After a `Sprint` resolves under REQ-CARDMOD-46, subsequent `Sprint` cards in the same turn must use their normal effective cost unless another modifier applies.

**REQ-CARDMOD-48:** A conditional modifier targeting `Explore` with `templatePlayOrdinalThisTurn: 2` and an appended progress effect must affect only the second successful `Explore` play of a turn.

**REQ-CARDMOD-49:** If an effective modifier adds a target-requiring effect to a card, the card's selection flow must include the effective target step and the reducer must enforce the same target requirement.

## AI Validation

An AI implementing this spec should verify completion with the following checks.

1. Typecheck and test the project with the repo's normal validation commands.

2. Add unit tests for modifier condition evaluation:

   - `templatePlayOrdinalThisTurn` returns true for ordinal `1` before any matching template has been played.
   - ordinal `2` returns true only after one matching template has been played.
   - illegal play attempts do not alter history.
   - history resets on the next player turn.

3. Add unit tests for `effectivePlayerCard`:

   - no matching modifier leaves the base card unchanged.
   - `setEnergyCost` returns a free effective copy without mutating the base card.
   - `appendEffect` composes an effective `Sequence`.
   - multiple modifiers apply deterministically.

4. Add reducer tests:

   - first `Sprint` each turn spends `0` energy.
   - second `Sprint` in the same turn spends normal cost.
   - `CardPlayed` emits `templateId` and `templateOrdinalThisTurn`.
   - `Panic` with an appended `DealProgressAll` resolves the appended effect.

5. Add available-action tests:

   - effective cost controls playability when energy is low.
   - effective effect controls target spec and legal targets.
   - `ignoreEnergy: true` still uses the effective effect tree while bypassing cost affordability.

6. Add selection/view tests where feasible:

   - `CardView` receives effective player-card data for visible player cards.
   - three visible `Sprint` cards all render as cost `0` before any `Sprint` resolves.
   - after one `Sprint` resolves, remaining `Sprint` cards render with normal cost.
   - target previews and connector styles use the selected effective snapshot.

7. Run a manual smoke test in the browser:

   - activate a test modifier for first `Sprint` free.
   - start a run with multiple `Sprint` cards visible.
   - confirm all visible `Sprint`s show free.
   - play one `Sprint`.
   - confirm remaining `Sprint`s update after resolution and core energy matches the displayed cost.

8. Inspect `git diff` to confirm no durable card-zone objects are rewritten solely for conditional modifier display.
