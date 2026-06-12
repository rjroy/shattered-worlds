# Telemetry gaps — runStats audit (2026-06-12)

Audit of the gameplay event stream → runStats pipeline on branch `feat/telemetry`.
Companion to [gameplay-event-stream.md](gameplay-event-stream.md).

**Pipeline wiring verified sound:** every TableScene dispatch funnels through the
session, the only `createGame` call sits inside `gameplaySession`, RunEnded fires
exactly once (terminal status, scene shutdown abandon, pagehide abandonAll).
The gaps below are about *what* the stream carries, not how it's delivered.

## Fixed

- **`DiscardThenDraw` discarded silently.** The effect moved a card from hand to
  `playerDiscard` without emitting `CardsDiscarded` (`src/core/engine/effects.ts`).
  runStats undercounted `cardsDiscarded`, and the renderer's animation script never
  saw the discard. Fixed on this branch: the effect now emits
  `CardsDiscarded { cardIds: [discardId] }` before the draw events.

## Open — semantic caveats on counters that fire today

- **`turns` misses the final turn.** `TurnEnded` only fires on the `EndTurn`
  action and `GameState` has no turn counter, so a run that ends mid-turn (win by
  playing a card, loss to a discard penalty) records one turn fewer than the turn
  it ended on. Fix options: add a turn counter to core state, or have the
  collector count `RunStarted` as turn 1.
- **Abandoned runs dilute lifetime averages.** `foldIntoLifetime` folds partial
  counters from abandoned runs into the same totals as finished runs. Any derived
  "per run" stat is skewed by half-finished runs. Decide deliberately whether
  abandons should fold or only be counted.
- **`progressDealt` includes overkill.** `dealProgress` reports the full computed
  amount even past the hazard's remaining cost. Efficiency stats would overstate
  useful progress. `ProgressDealt.hazardTurnTotal` plus the hazard cost is enough
  to compute waste if ever wanted.

## Open — data the stream doesn't carry yet

Listed roughly by "hardest to reconstruct later":

1. **Timestamps.** Neither `RunStarted` nor `RunEnded` carries one, so `lastRun`
   can't say *when* and run duration is unknowable. Inject a clock at the
   runtime layer (game side) to keep core deterministic. **Cannot be backfilled**
   — decide before stats accumulate.
2. **`appliedModifiers` dropped at the collector.** `RunStarted` carries them but
   `RunRecord` doesn't keep them, so once meta-progression modifiers exist (the
   stated future consumer of this stream), `lastRun` won't know what setup
   produced the result. Also cannot be backfilled.
3. **Hazards removed by other means.** `hazardsResolved + hazardsDiscarded`
   misses hazards leaving play via `CardDestroyed`, `WorldCardsExiled`, or
   `WorldCardsReturned`. Undercounts "hazards dealt with" on worlds using those
   mechanics.
4. **Heals are invisible.** `heal()` emits only `HpChanged` (absolute value), no
   amount-bearing event. A future `healingReceived` counter would need fragile
   state diffing. Clean fix: a `HealReceived { amount }` event in core.
5. **Bird-world losses untracked.** `BraceConsumed.absorbed` and `CardDestroyed`
   from `ForceDestroy` aren't tallied. "Cards lost to the bird / saves by
   bracing" is a natural per-world stat; the events already exist, only the
   tally is missing.
6. **`HazardPartial` and energy spent untallied.** Derivable later from the same
   stream; nothing lost by deferring.
