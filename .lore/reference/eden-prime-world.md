---
title: Eden Prime World
date: 2026-07-02
status: current
tags: [world-design, eden-prime, startle, alarm, applied-keywords, keyword-gate, progress-gate, core-engine]
fg-type: concept
fg-sources: [.lore/work/specs/eden-prime.md]
fg-status: current
fg-evidence:
  code:
    - src/data/worlds/eden-prime/cards.json
    - src/data/worlds/eden-prime/index.ts
    - src/data/worlds/eden-prime/theme.ts
    - src/data/worlds/eden-prime/meta.ts
    - src/core/model/types.ts
  tests:
    - src/core/tests/appliedKeywords.test.ts
    - src/core/tests/keywords.test.ts
    - src/game/tests/edenPrimePresentation.test.ts
  symbols:
    - ApplyKeyword
    - KeywordGate
    - ProgressGate
    - RemoveKeyword
    - GainKeywordGuard
    - appliedKeywords
    - progressDealtThisTurn
    - keywordGuard
---

# Eden Prime World

Eden Prime's threat verb is **startle**: hazards begin as harmless gifts and gentle interruptions, and the player's own beneficial actions (taking a gift, drawing extra cards, pushing a high-Progress turn) are what teach the world to treat them as a threat. This is the *implemented* state — despite the source spec's `status: draft` header, the world, its card set, and its core-engine slice are shipped (`src/data/worlds/eden-prime/`, `KeywordName` in `src/core/model/types.ts`).

Eden Prime is the **first world to take a core-engine slice**, and the slice it added is now shared infrastructure reused by later worlds (see below): a general, runtime-applied keyword mechanism separate from a card's authored `keywords` array, with `Alarm` as its first instance.

## The core-engine slice: applied keywords

Unlike the pre-existing static keywords (`Obstructed`, `Creature`, `Slow`, `Spore`, `Concealed`), `Alarm` is stamped onto a specific card instance at runtime rather than authored in JSON. This required a general `appliedKeywords?: readonly Keyword[]` collection on both `PlayerCard` and `WorldCard` — a transient, runtime-applied companion to the authored `keywords` array — with `hasKeyword`/`keywordNames` unioning both sets so existing keyword-counting machinery (`KeywordGate`, `CounterSpec`, `DealProgress.bonus.tag`) recognizes applied keywords with no changes of its own.

Five effect primitives shipped alongside `Alarm`, all general-purpose and reused by later worlds rather than Eden-Prime-specific:

- **`ApplyKeyword { keyword, value, target }`** — places a keyword on cards. Four targets are implemented: `"hand"` (cards currently in hand), `"nextWorldCard"` (the next world card drawn, via a deferred `GameState` flag consumed in the draw handler), `"self"` (the world card whose hook is firing), and `"firstWorldCardInHand"` (the world card with the smallest mint-order numeric id in hand — resolved via `parseInt(card.id, 10)`, not string comparison, since ids are `String(nextId)` and lexicographic order inverts past id 9).
- **`KeywordGate { keyword, min, zone, then }`** — runs `then` only when at least `min` cards bearing the keyword are present in `zone`; a **no-op below threshold**, with no else-branch. Two-arm state-conditional branching is deliberately not added — the engine's only branch primitive, `Modal`, branches on player choice, not `GameState`. A card needing "do A when calm, B when alarmed" is authored as `Sequence[ unconditional A, KeywordGate(...) -> B ]`.
- **`ProgressGate { min, then }`** — parallel to `KeywordGate` but conditions on a new `GameState.progressDealtThisTurn` counter (reset at turn start, incremented on every `DealProgress`/`DealProgressAll` resolution) rather than a keyword count. This is what lets a card read "the player just had a greedy, high-Progress turn" as a trigger.
- **`RemoveKeyword { keyword, target, amount }`** — clears a keyword from up to `amount` cards in a zone.
- **`GainKeywordGuard { amount }`** — grants `GameState.keywordGuard` charges (parallel to `braceCharges`), consumed inside `KeywordGate`: when a gate would pass threshold and a guard charge is available, the charge is spent and the inner effect is suppressed instead of firing. This is a distinct absorption path from `Brace`, which only absorbs `ForceDestroy`.

Alarm's own lifecycle: applied at value 2, decays by one at each turn-start tick (mirroring `frozen`), removed at zero. This makes `Alarm` the first **transient** applied keyword — decay is what later distinguishes it from New Derelict's persistent `Lockdown` (see [Persistent Keyword Cost Modifiers](persistent-keyword-cost-modifiers.md)).

All five primitives are structural no-ops in any world that never authors `ApplyKeyword`: no card ever bears the keyword, every `KeywordGate` evaluates `count == 0 < min`, and `progressDealtThisTurn`/`keywordGuard` are written but unread. State and event streams for other worlds are unaffected.

## World identity

Reward cards split into two opposed families: **greed** cards (`Take the Fruit`) that give strong immediate tempo while raising Alarm on the next hazard, and **restraint/valve** cards (`Gentle Approach`, `Stillness Lesson`, `Hush the Valley`) that are weak on a calm board and strong once Alarm is high. Hazards include a gift hazard that alarms on being taken (`Fruit Offered Too Quickly`), a self-alarming seeder (`First Warning Cry`), Alarm-gated disruption creatures (`Curious Swarm`, `The Herd Misunderstands`), a greed-reading hazard keyed off `progressDealtThisTurn` (`Flowers Face the Wrong Sun`), a boon-fetch hazard (`The Quiet Grove`), and the act-3 signature threat `Paradise Runs`, whose end-of-turn damage scales with the Alarm count in hand (guaranteeing real HP pressure even on a calm board via a non-zero base).

The world is deliberately not soft-locking: restraint (declining gifts, not over-drawing, keeping `progressDealtThisTurn` modest, clearing/discarding `First Warning Cry` before it seeds) is always available and keeps Alarm at zero through Act 1.

## Downstream reuse

New Derelict's `Lockdown` and Transit Authority's `Reroute` both reuse the `ApplyKeyword`/`RemoveKeyword`/`KeywordGate` primitives and the `appliedKeywords` field this slice introduced, adding no new `ApplyKeyword` targets of their own. See [New Derelict World](new-derelict-world.md), [Transit Authority World](transit-authority-world.md), and [Persistent Keyword Cost Modifiers](persistent-keyword-cost-modifiers.md) for how the persistence/decay and cost-modifier axes were generalized further on top of this base.
