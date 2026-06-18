---
title: Unlocks modifying card templates
date: 2026-06-17
status: open
tags: [unlocks, card-system, meta-progression, gameplay-identity]
modules: [unlocks, core-engine, card-system]
related: [.lore/work/brainstorm/unlocks-changing-gameplay.md, .lore/work/specs/unlock-system.md, src/core/model/types.ts]
---

# Unlocks modifying card templates

The narrow question: how does an unlock modify an existing player card template, especially when the modification is not always active?

The interesting promise is that an unlock can make an old card mean something new. This is stronger than giving the player a new card because it changes how the player evaluates a familiar card already sitting in the starter deck, reward pool, or future hand.

Examples:

- `Sprint` is free.
- The first `Sprint` each turn is free.
- The second `Explore` each turn does something extra.
- `Panic` stops being only bad filler and becomes a potential boon.
- `Panic` still does its normal thing, but also progresses every world card.
- `Med Kit` costs less if the player is at low HP.
- `Barricade` adds light when used against a Hidden hazard.

The simple half is static mutation. The hard half is conditional mutation.

## Static card modification

`PlayerCard` currently has a compact shape:

- `name`
- `insetKey`
- `sourceWorldId`
- `effect`
- `energyCost`
- `exhaust`
- `frozen`
- `keywords`

If an unlock can change any value of a `PlayerCard`, many modifications are mechanically straightforward.

`Sprint is free`:

```typescript
{ field: "energyCost", set: 0 }
```

`Panic also progresses all hazards`:

```typescript
{
  field: "effect",
  map: (current) => ({
    kind: "Sequence",
    steps: [
      current,
      { kind: "DealProgressAll", base: 1 },
    ],
  }),
}
```

`Panic becomes a boon` could be several different concrete edits:

- Set `energyCost` to `0`.
- Replace `Damage` with `GainEnergy`.
- Keep the original effect and append `DealProgressAll`.
- Add `exhaust: true`, so the bad card self-removes after use.
- Rename it to `Controlled Panic` or alter `keywords` so other systems can care about it.

This suggests a useful authoring model: an unlock has one or more patches targeting player card templates by `templateId`.

The patch is not applied to one card instance manually. It is applied wherever cards are minted or normalized so all future instances of that template inherit the altered shape. Existing instances are the open question:

- If the unlock is chosen before a run starts, patching at mint time is enough.
- If unlocks can be gained mid-run, current hand/discard/draw cards may need to be rewritten too.
- For meta-progression unlocks active at run start, the cleanest first version is probably "patch templates before run assembly, then mint from the patched catalog."

## Static patch vocabulary

A patch system could be narrowly typed rather than a generic JavaScript callback:

```typescript
type PlayerCardPatch =
  | { op: "setEnergyCost"; value: number }
  | { op: "addEnergyCost"; amount: number }
  | { op: "setExhaust"; value: boolean }
  | { op: "appendEffect"; effect: CardEffect }
  | { op: "prependEffect"; effect: CardEffect }
  | { op: "replaceEffect"; effect: CardEffect }
  | { op: "addKeyword"; keyword: string }
  | { op: "rename"; name: string };
```

That is less expressive than "change any value of `PlayerCard`", but much easier to serialize, inspect, test, and render. It also avoids arbitrary code inside unlock data.

The broadest version is a structural patch:

```typescript
type PlayerCardPatch = {
  readonly targetTemplateId: CardTemplateId;
  readonly set?: Partial<Omit<PlayerCardTemplate, "kind">>;
  readonly appendEffect?: CardEffect;
};
```

This is attractive because the template shape already exists. The risk is that patches start encoding effect surgery in ad hoc ways. For example, "append a step to a `Sequence`, but create a `Sequence` if it is not already one" is a rule, not a field assignment.

Maybe the right split:

- Field patches for ordinary values: `energyCost`, `exhaust`, `keywords`, `name`, `insetKey`.
- Effect combinators for effects: `replace`, `prepend`, `append`, `wrapSequence`.

## Conditional modification

Conditional changes need runtime facts. "The first `Sprint` used each turn is free" cannot be answered by looking only at the card template. The template needs context:

- What turn is it?
- How many `Sprint` cards have already been played this turn?
- Does this count exact `templateId`, card name, keyword, or category?
- Does playing a free `Sprint` increment the same counter before or after the cost is derived?
- Does an attempted illegal play count? Probably no.
- Do copied, generated, or renamed cards count? Probably by `templateId`, not display name.

Current state and event data are close but incomplete:

- `GameState` does not appear to carry a turn number.
- `GameState` does not carry "cards played this turn."
- `GameEvent.CardPlayed` currently carries only `cardId`, not `templateId`.
- Runtime stats count total `cardsPlayed` and `turns`, but those are aggregate run stats, not core reducer facts that can determine legal actions.

So the current system does not have enough core-local information to know "first Sprint this turn" or "second Explore this turn." It can know a card's `templateId` when reducing a play because the reducer finds the card in hand, but that fact is not persisted as a per-turn counter.

## Option A: patch the effective card at selection time

Instead of permanently changing card instances, the engine could derive an effective card every time it needs one:

```typescript
effectiveCard = applyActiveCardModifiers(baseCard, state, context)
```

The available-actions selector would use the effective card's `energyCost` and `effect`.

The reducer would use the effective card's `energyCost` and `effect`.

This is important: `availableActions` and `reduce` must agree. If `availableActions` says the first `Sprint` is free but `reduce` spends the base card's original cost, the UI and rules diverge. Any conditional modifier has to be part of the same core rule path used by both legality and resolution.

In this model, the actual card in hand remains `Sprint` with its base fields. The unlock overlays a derived view:

- If `Sprint` has been played zero times this turn, effective cost is `0`.
- If `Sprint` has already been played, effective cost is base cost.

This is clean for temporary conditions. It avoids mutating the card after each play. It also lets the view show the modified cost while the condition is active.

The important display consequence: if the player has three `Sprint` cards in hand and the unlock says "the first `Sprint` each turn costs 0", all three visible `Sprint` cards should present as free until one `Sprint` has actually finished being played. None of the three hand cards has personally become "the free copy." They are all views of the same template under the same current turn predicate.

The cost is that all card consumers need to remember whether they want the base card or effective card. Core legality, core reduction, and card rendering probably want effective card. Persistence/debugging may want base card plus modifiers.

## Effective card snapshots

The phrase "effective card" should probably mean an immutable snapshot, not a live proxy.

When the player starts playing a card, the engine should derive a `cardBeingPlayed` or `EffectivePlayerCard` from the base hand card and the current state. That snapshot is then used through the whole play:

- energy affordability
- energy spend
- target spec / selection steps
- effect resolution
- connector style and progress preview
- card face shown while the card is selected or moving

This matters because playing the card can change the game state in ways that would make its own conditions invalid if re-evaluated halfway through.

Example:

1. `Sprint` is free if no `Sprint` has been played this turn.
2. The player clicks a `Sprint`.
3. The game snapshots that selected card as `energyCost: 0`.
4. During resolution, the game records that a `Sprint` has now been played.
5. The selected `Sprint` still finishes as the free card because it is resolving from the snapshot.
6. The remaining visible `Sprint` cards now re-render from fresh state and show their normal cost.

Without a snapshot, a rule can invalidate itself during its own play. That is especially dangerous for effects that append extra target steps or change cost based on resources the card spends or gains.

So there are three identities in play:

- **Base card in memory:** the durable card object in `GameState.hand`, draw, or discard.
- **Effective card for display/legality:** a derived copy for the current state.
- **Card being played:** the effective snapshot selected for the current action, stable until the action resolves.

The base card should not be rewritten for conditional unlocks. The viewed or played version should change.

## View and selection integration

`CardView` already receives a `Card` object and does not read `GameState` directly. That makes it compatible with effective cards: `TableScene` can pass an effective copy to `CardView` instead of the base hand card.

That gives the player the proposed behavior on the face:

- effective `energyCost`
- effective effect lines
- effective `exhaust` marker, if rendered
- effective keywords, if rendered

The selection system also has to follow effective cards. `src/game/interaction/selection.ts` currently stores `cardId`, `steps`, and step progress. It does not know energy cost directly, but it does know the target steps that come from the card's effect. If an unlock changes `effect`, then the selection steps must be derived from the effective effect, not the base effect.

This creates a useful rule:

- The scene may keep only `cardId` in selection state.
- The selected card's `TargetSpec` must come from the same effective snapshot used by core.
- Once targeting begins, the selected effective snapshot should stay stable for that selection.

Otherwise a conditional effect can change while the player is halfway through selecting targets. For example, "second `Explore` this turn also return a world card" changes the target sequence. If the player starts selecting targets under one effective effect, the selection state should not morph because some unrelated event caused the condition to re-evaluate.

That implies the scene may need to hold a lightweight selected-card snapshot alongside selection state:

```typescript
type CardSelection = {
  readonly cardId: CardId;
  readonly effectiveCard: PlayerCard;
  readonly targetSpec: TargetSpec;
};
```

This does not replace core validation. The reducer must still derive or receive the same effective card rules and reject illegal stale actions. But the scene needs a stable read-model so the card face, target steps, previews, and connector styles do not disagree during interaction.

## Option B: mutate card instances as turn state changes

Another model is to rewrite cards in hand whenever the condition changes.

At turn start:

- Find `Sprint` cards.
- Set the first relevant instance to cost `0`.

After playing a `Sprint`:

- Rewrite any remaining `Sprint` cards back to base cost.

This is more concrete but quickly gets brittle:

- Which copy of `Sprint` becomes free if there are two in hand?
- What if the free copy is frozen?
- What if `Sprint` is drawn mid-turn?
- What if a card returns from discard mid-turn?
- What if a free `Sprint` is destroyed before being played?

This approach treats the condition as stateful mutation of individual cards. That may be useful for effects like "mark one card" or "the next card you draw is free," but it feels awkward for template-wide rules.

For "first/second card of this template each turn", effective derivation is probably cleaner.

## Option C: add trigger-style runtime effects

Maybe the unlock does not patch `PlayerCard` directly. Instead, it listens to events and injects additional behavior:

- `onBeforePlayCard`: modify cost, block play, replace effect.
- `onAfterPlayCard`: add extra effects after the card resolves.
- `onTurnStart`: reset counters or create per-turn marks.
- `onCardMinted`: patch new cards as they enter the game.

This is more like a relic system. It is expressive, but it is a larger engine concept than "card template patches." It could become the general home for all gameplay-changing unlocks.

However, cost changes need `onBeforePlayCard` or effective derivation because affordability is checked before the play. Extra effects can be `onAfterPlayCard`, but "make this free" cannot be bolted on after the fact unless the engine supports refunds, which is uglier.

So trigger effects are powerful, but cost and target changes still need integration with `availableActions`.

## The missing data model: per-turn play history

To support conditions like "first `Sprint` each turn" or "second `Explore` each turn", add explicit core state.

Possible shape:

```typescript
type TurnPlayHistory = {
  readonly cardsPlayedThisTurn: number;
  readonly byTemplateId: Readonly<Record<CardTemplateId, number>>;
};
```

Then `GameState` gets:

```typescript
readonly turnPlayHistory: TurnPlayHistory;
```

On successful `PlayCard`, after the card is found:

- Read the current count before play.
- Derive the effective card using that count.
- Spend effective cost.
- Apply effective effect.
- Increment `turnPlayHistory.byTemplateId[card.templateId]`.

On `EndTurn`, after or before start-turn refill, reset play history to zero.

This supports:

- first `Sprint`: count before play is `0`
- second `Explore`: count before play is `1`
- every third `Panic`: `(countBefore + 1) % 3 === 0`
- after playing any two cards: `cardsPlayedThisTurn >= 2`

The event can also improve:

```typescript
{ type: "CardPlayed"; cardId: CardId; templateId: CardTemplateId; ordinalThisTurn: number }
```

`ordinalThisTurn` could be the count for that template after incrementing, so the first `Sprint` event carries `ordinalThisTurn: 1`.

This is not strictly required for rules if `GameState` has the counters, but it is useful for animation, stats, debugging, achievements, and future unlocks.

## Predicate vocabulary

Once conditions exist, the authoring question becomes: how do unlocks express them?

A simple predicate vocabulary:

```typescript
type CardModifierCondition =
  | { kind: "always" }
  | { kind: "playedTemplateThisTurn"; templateId: CardTemplateId; operator: "eq" | "lt" | "gte"; count: number }
  | { kind: "playedAnyThisTurn"; operator: "eq" | "lt" | "gte"; count: number }
  | { kind: "hp"; operator: "lte" | "gte"; value: number }
  | { kind: "resource"; resource: "energy" | "light" | "heat" | "brace"; operator: "eq" | "lt" | "lte" | "gte"; value: number }
  | { kind: "and"; conditions: readonly CardModifierCondition[] }
  | { kind: "or"; conditions: readonly CardModifierCondition[] }
  | { kind: "not"; condition: CardModifierCondition };
```

Then:

```typescript
{
  type: "modifyPlayerCard";
  target: { templateId: "Sprint" };
  condition: {
    kind: "playedTemplateThisTurn",
    templateId: "Sprint",
    operator: "eq",
    count: 0,
  };
  patches: [{ op: "setEnergyCost", value: 0 }];
}
```

For "second `Explore` used each turn gets +2 progress":

```typescript
{
  type: "modifyPlayerCard";
  target: { templateId: "Explore" };
  condition: {
    kind: "playedTemplateThisTurn",
    templateId: "Explore",
    operator: "eq",
    count: 1,
  };
  patches: [{ op: "appendEffect", effect: { kind: "DealProgress", base: 2 } }];
}
```

This reads oddly at first because "second used" is expressed as "one has already been used." But it is precise because the condition is evaluated before the current play resolves.

Maybe authoring should hide that with a direct ordinal predicate:

```typescript
{ kind: "templatePlayOrdinalThisTurn", templateId: "Explore", ordinal: 2 }
```

Internally this checks `playedTemplateThisTurn === ordinal - 1`.

That is friendlier and less error-prone.

## Target vocabulary

At first, target only exact `templateId`.

```typescript
type CardModifierTarget =
  | { kind: "template"; templateId: CardTemplateId }
  | { kind: "keyword"; keyword: KeywordName };
```

Template targeting is deterministic and matches the examples.

Keyword targeting creates more design space:

- First `Hidden` tool each turn is free.
- All `Spore` cards exhaust.
- Cards with `Slow` get +1 progress.

But keyword targeting also raises questions:

- Player cards currently can have keywords, but most keyword gameplay appears world-card focused.
- Does an unlock-added keyword make another unlock apply?
- In what order do modifiers apply?

Probably start with `templateId` targets and add keyword targets only when a design actually needs them.

## Modifier ordering

Multiple unlocks may modify the same card.

Examples:

- Unlock A: `Sprint` costs `0`.
- Unlock B: the first `Sprint` each turn gains `Draw 1`.
- Unlock C: all free cards exhaust.

Ordering matters if patches are allowed to inspect already-patched values. It matters less if patches are purely declarative and applied in a fixed order.

Possible rules:

1. Apply static patches first.
2. Apply conditional patches second.
3. Sort by unlock id for deterministic output.
4. Within one unlock, preserve patch order.

Effect composition needs care:

- Appending two effects creates one `Sequence`.
- Appending onto an existing `Sequence` should probably flatten one level.
- Replacing an effect should happen before appends/prepends from later patches.

This argues for a dedicated `composeEffects(base, patches)` helper with tests rather than inline object surgery.

## Where this belongs

The current unlock MVP uses `RunModifiers`, a simple bag read by the core engine. Card-template modification is richer than the current numeric fields.

Possible extension:

```typescript
export type RunModifiers = {
  ...
  readonly playerCardModifiers: readonly PlayerCardModifier[];
};
```

Then the core engine has enough data to derive effective cards without importing unlock definitions. The data layer still owns catalog definitions; core only understands generic card modifiers.

This follows the existing boundary: core can read a pure data bag, but it does not know purchase state, destiny budgets, unlock UI, or fragment economy.

## Panic as a test case

`Panic` is the best stress test because it starts as an undesirable card. A good unlock can turn bad texture into build identity.

Possible `Panic` modifiers:

1. **Nervous Momentum**

   `Panic` costs `0` and exhausts.

   This turns junk into a one-time deck-thinning tempo card.

2. **Fear Response**

   The first `Panic` each turn also deals `1` progress to every world card.

   This makes `Panic` exciting when it appears early, but not something the player wants to spam.

3. **Controlled Panic**

   If `Panic` is the second player card used this turn, gain `1` energy before its normal effect.

   This makes sequencing matter and creates a small puzzle.

4. **Contagious Panic**

   `Panic` keeps its downside, then adds `DealProgressAll`.

   This is a clean "boon with a cost" version.

5. **Panic Button**

   If HP is `3` or lower, `Panic` becomes free and heals `1`.

   This makes it situational insurance rather than universally good.

These examples reveal a distinction:

- Some upgrades are template patches: cost, exhaust, append effect.
- Some upgrades are conditions over the current card: first `Panic`, second card this turn, low HP.
- Some upgrades may need new effect kinds if the card should react to the exact hazard, target, or previous choices.

## Design caution

Changing old cards is powerful because it rewrites player memory. But it can also make the deck harder to read if the card face does not explain why it changed.

The UI probably needs to show effective card values:

- Modified cost should render on the card.
- Added effect lines should render on the card.
- Conditional lines should distinguish active and inactive states.

For example:

- Active: `0 energy this turn`
- Inactive: `First Sprint each turn costs 0`

The current self-describing card face direction matters here. If unlocks silently modify behavior without visible card text, players will think the rules are inconsistent.

## Provisional implementation shape

The most promising path:

1. Add pure-data `PlayerCardModifier` values to `RunModifiers`.
2. Add `turnPlayHistory` to `GameState`.
3. Add `templateId` and maybe `ordinalThisTurn` to `CardPlayed`.
4. Create `effectivePlayerCard(card, state, context)` in core.
5. Use fresh effective cards for hand rendering and idle playability.
6. Snapshot a selected effective card when targeting/play begins, so the active play does not invalidate itself midway through resolution.
7. Use the effective snapshot in both `availableActions`/target spec derivation and `reduce`.
8. Keep base cards in memory unchanged for conditional modifiers.
9. Start with exact `templateId` targets.
10. Start with a small patch vocabulary: set cost, set exhaust, append/prepend/replace effect, add keyword.
11. Start with a small condition vocabulary: always, template play ordinal this turn, any-card play ordinal this turn, HP/resource thresholds.

This keeps the authoring model expressive without turning unlock definitions into engine code.

## Open questions

- Should `turnPlayHistory` reset at `EndTurn` before or after world end-of-turn effects? Probably after all effects resolve and before the next player turn begins, but the exact reset point matters if future world hooks play or copy player cards.
- Is "first `Sprint` each turn" counted by template id, card name, keyword, or resulting effective template after patches? Template id is the safest first answer.
- Can modifiers target cards not currently in the active world's catalog? If yes, they are inert until that template exists.
- Should modified cards preserve their original `sourceWorldId`, or can unlocks make them visually belong to the unlock source? Probably preserve source; unlock visuals belong in the card text/effect lines, not source identity.
- Are conditional modifications allowed to change target specs? Appending an effect that needs a different target can alter selection flow. This may be acceptable because `Sequence` and `compound` targeting already exist, but it needs tests.
- Can multiple conditional modifiers depend on each other? For example, one makes `Sprint` free and another says "free cards exhaust." That requires either cost-aware predicates or a fixed rule that predicates inspect base state, not patched state.
- Does `availableActions(ignoreEnergy: true)` use effective cost? For loss guards, probably yes if the effective effect also changes playability, but "ignore energy" should still ignore final effective cost.
- Should the view show base cards plus unlock badges, or only effective cards? The player needs to know both "what this card does now" and "why."
- Does `Action.PlayCard` need to carry a snapshot token/version so the reducer can prove the UI-selected effective card matches the reducer-derived effective card? Maybe not for local single-threaded play, but it matters if actions can be replayed, delayed, or generated by automation.
- Should the selected effective snapshot live in core, scene state, or both? Core needs authoritative resolution. The scene needs stable display and targeting. Duplicating the concept may be acceptable if the snapshot is pure and reproducible.

## Bad idea worth keeping nearby

A fully generic unlock could be:

```typescript
{
  type: "modifyPlayerCard",
  targetTemplateId: "Panic",
  transform: "(card, state) => ({ ...card, energyCost: 0 })"
}
```

This is tempting because it solves every example immediately. It is also hard to serialize, hard to inspect in UI, hard to test as data, and hard to keep inside the core/data boundary.

The better version is to grow a small rules language only as designs demand it.
