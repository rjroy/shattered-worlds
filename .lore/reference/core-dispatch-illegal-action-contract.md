---
title: Core Dispatch Rejects Illegal Actions by Throwing, Never by Event
date: 2026-07-02
status: current
tags: [core, dispatch, error-handling, contract, validation, determinism]
fg-type: decision
fg-sources: [.lore/work/specs/poc-core-loop.html, .lore/work/specs/world-deck-slice.html]
fg-status: current
fg-evidence:
  code:
    - src/core/model/errors.ts
    - src/core/engine/reduce.ts
  symbols:
    - IllegalActionError
---

# Core Dispatch Rejects Illegal Actions by Throwing, Never by Event

`dispatch(action) → { state, events }` (see [Core Render Split](core-render-split.md)) is a contract for **legal actions only**. When an action is illegal, the core throws a typed error carrying the offending action and the current state, instead of returning a normal `{ state, events }` result with a failure event mixed into the log. There is one error contract for every action, not a per-action bespoke failure mode.

This was decided in the original proof-of-concept (`PlayCard` with a card id not currently in hand throws) and carried forward unchanged into the first real game slice, which explicitly cites it as "the POC error contract, unchanged." The world-deck slice's illegal cases are broader — an unknown card id, a `DealProgress` card with no Hazard in hand to target, a `Modal` choice out of range, `Panic` played with no world card in hand, `DiscardHazard` on a non-discardable card (the Door), naming a player-card id where a world-card target is required, or any gameplay action dispatched once the run has already reached `won`/`lost` — but all of them throw `IllegalActionError` (`src/core/model/errors.ts`), the same mechanism.

`Panic`'s `ReturnWorldCards` effect actually accepts 1 to 4 world cards (`min: 1, max: 4`); zero in hand is the illegal case, not "not exactly one."

## Why this shape

Keeping the `events` log exclusively for things that actually happened preserves it as an animation script the renderer can trust and replay (see [Core Render Split](core-render-split.md)); a log that could also contain "rejected attempt" entries would force every consumer (renderer, sim, tests) to filter before treating events as a script of causes. In normal play the player should never actually trigger this path — the renderer's legality gate ([Targeting and Selection Grammar](targeting-and-selection-grammar.md)) is supposed to prevent illegal actions from ever being dispatched — so a thrown `IllegalActionError` during real interaction signals a bug in that gate, not an expected game state.
