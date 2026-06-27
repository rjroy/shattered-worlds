---
title: Observability boundary for the core engine
date: 2026-06-26
status: implemented
tags: [observability, preview, sim, rng, hidden-information, determinization]
modules: [core, sim]
related: [.lore/reference/index.md, .lore/work/plans/observability-boundary.md, .lore/work/notes/observability-boundary.md]
---

# Observability boundary for the core engine

## Problem

`previewAction` computes its result by running the real reducer:

```
previewAction → reduce(catalog, state, action) → { state, events }
```

Because `reduce` is pure and deterministic, the preview is not "what could
happen", it is exactly "what will happen". The committed dispatch consumes the
same `state.rng` and produces byte-identical results. That makes the preview
*too* truthful in two distinct ways:

1. **Resolution randomness.** Effects that consume `state.rng` at resolution
   time (random destroy, freeze-at-random, the weighted `GainRandomCard` roll,
   deck reshuffles) get sampled to a specific outcome the moment they are
   previewed.
2. **Hidden information.** The draw piles (`playerDraw`, `worldDraw`) are
   already shuffled and sitting in state. They are predetermined but unknown to
   the player. Previewing any draw (`EndTurn` refill, `Draw` effects) reveals
   that order early.

Today this leak is patched **reactively in the summary layer**
(`actionPreview.ts`): draws are summarized as "Draw N cards" rather than named,
and concealed-source events are masked via the existing `sourceCardId` stamp.
The text the player reads is mostly honest. But:

- The masking is pattern-matching downstream of events that *already contain the
  truth*. Every new stochastic effect needs a new mask, and it is easy to miss
  one. (This is the "I've set that up in a few places" whack-a-mole.)
- `ActionPreview.events` is **public API** and carries real `templateIds`.
  Anything that animates *preview* events (not dispatch events) leaks even when
  the summary text is clean. This is a latent hole, not a confirmed live bug.

The same property blocks an **honest sim agent**: a search that steps through a
draw reads the real shuffle, so it plays with perfect information and cannot be
used to estimate human-achievable difficulty.

## Two problems that look like one

The instinct is to add a "preview mode" that fakes the RNG inside `reduce`.
This conflates two problems with different correct treatments, and points the
fix at the wrong layer.

<table>
  <tr>
    <th align="left">Concern</th>
    <th align="left">Player display wants…</th>
    <th align="left">Sim agent wants…</th>
  </tr>
  <tr>
    <td><b>Resolution randomness</b><br/>(rng consumed at resolution)</td>
    <td>"something random happens here" — never a sampled outcome shown as fact</td>
    <td>a plausible sample it can <i>average over</i> across rollouts</td>
  </tr>
  <tr>
    <td><b>Hidden information</b><br/>(predetermined deck order)</td>
    <td>"draw N cards, contents unknown"</td>
    <td>a plausible reshuffle of the hidden zones, resampled per rollout</td>
  </tr>
</table>

Note the asymmetry: the display wants **"unknown"**, the sim wants **"a
plausible sample"**. Same boundary, opposite treatment. That is why the answer
is not one shared transform — it is one shared *concept* (the observability
boundary) with two consumers.

## Why not fake the RNG inside `reduce`

Two ways to do it, both wrong, and the friction is the signal:

- **Skip the roll.** Unsound in general. Downstream effects depend on the
  result (a card that draws, then reads the hand). Skipping leaves the
  post-state wrong and the error cascades. The engine cannot know which rolls
  are safe "leaf" rolls.
- **Substitute a placeholder.** Not representable. A card must physically be in
  a zone; there is no "maybe-card". This invents a second semantics for the
  whole reducer and branches every handler on a preview flag.

The *sound* version of "give it a fake roll" is just handing `reduce` a state
whose hidden zones have already been reshuffled — that is **determinization**,
and it belongs at the boundary, not inside the engine. `reduce` stays pure and
full-information. That purity is the only reason an honest sim is cheap to
build (free fork-and-rollback).

## The architecture

One concept, defined once; two mechanisms that consume it.

<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="12">
  <rect x="280" y="10" width="200" height="50" rx="6" fill="#e8eef7" stroke="#33558b"/>
  <text x="380" y="32" text-anchor="middle" font-weight="bold">Observability model</text>
  <text x="380" y="48" text-anchor="middle">which state is hidden / which events are random</text>

  <rect x="40" y="120" width="320" height="60" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="200" y="143" text-anchor="middle" font-weight="bold">Source stamp on events</text>
  <text x="200" y="160" text-anchor="middle">randomized / revealedFromHidden</text>
  <text x="200" y="174" text-anchor="middle">(extends the sourceCardId pattern)</text>

  <rect x="410" y="120" width="320" height="60" rx="6" fill="#f7efe8" stroke="#8b5a33"/>
  <text x="570" y="143" text-anchor="middle" font-weight="bold">determinize(state, rng)</text>
  <text x="570" y="160" text-anchor="middle">reshuffle hidden zones under agent rng</text>
  <text x="570" y="174" text-anchor="middle">(boundary helper; reduce untouched)</text>

  <rect x="40" y="240" width="320" height="40" rx="6" fill="#fff" stroke="#666"/>
  <text x="200" y="265" text-anchor="middle">Preview summary: mask if stamped → "unknown"</text>

  <rect x="410" y="240" width="320" height="40" rx="6" fill="#fff" stroke="#666"/>
  <text x="570" y="265" text-anchor="middle">Sim: plan on determinized copies, sample stamped actions</text>

  <line x1="340" y1="60" x2="200" y2="120" stroke="#33558b" stroke-width="1.5"/>
  <line x1="420" y1="60" x2="570" y2="120" stroke="#33558b" stroke-width="1.5"/>
  <line x1="200" y1="180" x2="200" y2="240" stroke="#2f7d31" stroke-width="1.5"/>
  <line x1="570" y1="180" x2="570" y2="240" stroke="#8b5a33" stroke-width="1.5"/>
  <line x1="360" y1="150" x2="410" y2="150" stroke="#999" stroke-dasharray="4 3"/>
  <text x="385" y="145" text-anchor="middle" fill="#777" font-size="10">shared stamp</text>
</svg>

### 1. Define the observability model (the prerequisite)

Right now the model is implicit. Concealment is modeled explicitly
(`Concealed` keyword + `isConcealed` + the `sourceCardId` stamp), but
"draw-pile order is hidden" and "a pending random roll is unknown" are only
assumed. Write it down in one place:

| State / event | Visible to player? |
|---|---|
| `hand` | yes |
| `playerDraw`, `worldDraw` (order) | no — hidden order |
| `playerDiscard` | yes — not hidden information (no UX yet, but that does not change the model) |
| `acts` beyond current | no |
| Concealed card identity + effects | no (already modeled) |
| Outcome of an rng roll before commit | no |

Codify as a small helper surface in core (e.g. `hiddenZones(state)` /
`isHidden`). Both mechanisms below derive from this one model, so it is the
real "sort this out" step.

### 2. Player display: stamp at source, mask by rule

Mirror the existing concealment provenance. `sourceCardId` is stamped at the
`applyEffect` boundary (`engine/effects.ts:92-98`) and at the draw boundary
(`engine/draw.ts:215`). Add a sibling stamp on the *same* `GameEvent`
intersection:

```
& { readonly sourceCardId?: CardId;
    readonly randomized?: boolean;        // outcome chosen via rng at resolution
    readonly revealedFromHidden?: boolean // identities came from a hidden zone
  }
```

The stamp goes **where the dice are rolled / the hidden zone is read**, not
where the text is written:

- `engine/rng.ts shuffle` callers — `engine/draw.ts` (reshuffle, act advance,
  ForceDestroy random destroy at `draw.ts:245`).
- `engine/weightedDraw.ts` consumers — `effects/gainCard.ts` (`GainRandomCard`,
  boon rolls), `engine/actBoon.ts`.
- `effects/heat.ts` (freeze-at-random).
- `effects/recallDiscard.ts` (`random` policy).
- Any draw that surfaces hidden-zone cards → `revealedFromHidden`.

Then the preview rule collapses from per-effect pattern-matching to one
invariant:

> Any event carrying `randomized` or `revealedFromHidden` is summarized
> generically. Full stop.

A new stochastic effect cannot leak by omission, because the handler that rolls
the dice is the handler that stamps. This fix **stands alone** and is valuable
even if the sim work never happens.

### 3. Sim honesty: determinize at the boundary

Add `determinize(state, agentRng): GameState` that returns a copy with **all
three** hidden surfaces resampled under the *agent's own* rng. All three are
load-bearing; missing any one leaves the "honest" agent partly clairvoyant:

1. **Draw-pile order.** Reshuffle `playerDraw` and `worldDraw`. (`playerDiscard`
   is visible — do not touch it.)
2. **Future acts.** `state.acts` (acts beyond the current one) is hidden per the
   model, but it is stored *unshuffled* and a naive `determinize` that only
   touches the two draw piles leaves the agent reading exact future act
   contents. Shuffle within each act entry (mirroring what `drawWorld` does at
   advance time), or — if act *contents* are deemed fair game and only order is
   hidden — state that as a conscious scope decision. Do not leave it implicit.
3. **`state.rng` itself.** Replace it with a fresh rng seeded from `agentRng`.
   This is the non-obvious one: because `reduce` is pure, two rollouts from the
   same determinized state with the *same* `state.rng` produce identical freeze
   victims, identical `weightedDraw` results (boons, `GainRandomCard`), and
   identical `resolveForceDestroy` victims. Without replacing `state.rng`, the
   agent "averages" over deck order but is still clairvoyant about every future
   dice roll, and the whole point of sampling `randomized`-stamped actions
   across rollouts collapses.

The agent:

1. takes ground-truth `state`,
2. `determinize`s it (per rollout for sampling search),
3. plans on the determinized copy via the normal pure `reduce`,
4. commits the chosen action against the **real** state.

`reduce` is never modified. This is textbook ISMCTS / determinization, cheap
only because the engine is pure.

### The payoff of one shared stamp

The `randomized` / `revealedFromHidden` stamp from mechanism 2 also tells the
sim *where uncertainty enters the search*. An action whose preview events are
stamped is exactly an action the honest agent should evaluate by averaging over
several determinizations rather than trusting a single rollout. One stamp,
serving both the player's honesty and the sim's honesty.

## Stamp surface (handler audit)

Every `state.rng` consumer and every hidden-zone reveal in core, traced to the
event that must carry the stamp. This is the exact surface step 2 has to cover.

**Audit two axes, not one.** A first pass traced only `shuffle` / rng call
sites and missed `ExileTopWorldCards`, which reads the top of `worldDraw`
(hidden) *deterministically* — no rng, but a real reveal. The audit must run
twice: once over rng consumers (`randomized`), and once over **every handler
that reads a hidden zone** (`playerDraw`, `worldDraw`, future `acts`) regardless
of whether it rolls (`revealedFromHidden`). Treat the audit, not the stamp, as
the primary deliverable of step 2, and review it independently against the full
effect registry (`effects/registry.ts`).

### Events that must be stamped

| Site | Event(s) | Stamp | Notes |
|---|---|---|---|
| `engine/draw.ts` `drawPlayer` | `CardsDrawn` (bHazard:false) | `revealedFromHidden` | ids come from `playerDraw` (hidden order). `templateIds` is already left empty here, but ids still resolve to names via the preview's `cardMap` — the events-array leak. |
| `engine/draw.ts` `drawWorld` | `CardsDrawn` (bHazard:true) | `revealedFromHidden` | ids + templateIds pulled from `worldDraw` (hidden). |
| `engine/draw.ts` `drawWorld` | `HazardAdded` (`templateId: card.name`) | `revealedFromHidden` | Names the surfaced world card outright. Summary already returns `[]`, but the event leaks. |
| `effects/worldCards.ts` `ExileTopWorldCardsHandler` | `WorldCardsExiled` | `revealedFromHidden` | Reads the top of `worldDraw` (hidden) **deterministically** — no shuffle. **Live leak today**: summary (actionPreview.ts:417-421) names the exiled cards via `cardMap`, telling the player exactly what sits on top of the hidden pile. Worse than the draw events, which are at least already generic. Summary case must go generic ("Exile top N world cards"). |
| `engine/draw.ts` `resolveForceDestroy` | `CardDestroyed` | `randomized` | Victims chosen by `shuffle` (draw.ts:245). **Live leak today** when the queuing source is *not* concealed: the generic `pendingForceDestroy` summary block does not fire (startTurn already drained it), so the preview names the destroyed cards. |
| `effects/heat.ts` `FreezeCardsHandler` | `CardsFrozen` | `randomized` | Victims chosen by `shuffle` (heat.ts:88). Summary is generic ("Freeze N at random"), event carries the real ids+templateIds. |
| `effects/gainCard.ts` `GainRandomCardHandler` | `CardGained` | `randomized` | Template rolled via `weightedDraw`. Currently masked by keying on `setName !== undefined`; replace that with the explicit stamp. |
| `effects/recallDiscard.ts` `resolveAutoRecall` (**`random` policy only**) | `PlayerDiscardRecalled` (source "random") | `randomized` | Cards are from the *visible* discard, but the selection is random. The deterministic policies (latest/lowestCost/highestCost/panicFirst) must **not** be stamped. |
| `engine/actBoon.ts` `createBoonOffer` | `BoonOffered` | `randomized` | Offered templateIds rolled via `weightedDraw`. Summary already names only `setName`; the event carries templateIds + rarities. |

### RNG-consuming but no event stamp (determinize-only)

These advance `state.rng` and reorder a hidden zone, but the emitted event names
only player-known cards or no cards. They do not leak through the preview. They
matter only in that the reshuffle invalidates any deck knowledge — which
`determinize` already models by resampling per rollout. Do **not** stamp.

| Site | Event | Why no stamp |
|---|---|---|
| `engine/draw.ts` `drawPlayer` | `DeckShuffled` | Carries no identities; summary is generic. |
| `engine/draw.ts` `drawWorld` | `ActAdvanced` | Reorders the new act into `worldDraw`, but the act number is known; the reveal rides the following `CardsDrawn`. |
| `effects/worldCards.ts` `returnToActiveWorldDeck` | `WorldCardsReturned` | Returned ids are **player-selected** (known); only the worldDraw order is reshuffled. |
| `effects/gainCard.ts` `gainCard` (dest `worldDraw`) | `CardGained` | Template is authored/known (AddCard, GainCard); only its position in the hidden pile is randomized. |
| `engine/world.ts` `createWorld` | opening `startTurn` events | Game-creation deal, never previewed; the opening hand is legitimately shown. |

### Implementation notes

- **Stamp at the emit site, not at a boundary.** `sourceCardId` works as a
  uniform `applyEffect` boundary stamp (effects.ts:92-98) because *all* events
  from a hooked card share one source. `randomized` / `revealedFromHidden`
  cannot: within one effect, some events are random and some are not (the
  deterministic recall policies are the clearest case). Each emitting helper
  stamps its own event.
- **`weightedDraw` is a kernel, not an emitter.** Its callers stamp; the kernel
  stays stamp-agnostic. Note its empty-pool guard still advances the rng
  (weightedDraw.ts:80-83), so the fail-closed paths must stamp too. `BoonOffered`
  has **two** call paths into `createBoonOffer` — the act path
  (`createActBoonOffer`) and the world-clear path (`OfferBoonHandler` in
  `effects/boonChoice.ts`). Both route through `createBoonOffer`, so stamping
  there covers both; the conformance test must exercise both.
- **This shrinks `actionPreview`, it does not erase the taint machinery.** Today
  the refill leak is held back by `hiddenFlowTaintIndex` /
  `summarizeMaskedHiddenFlowEvent` — index-based masking that only triggers when
  a *concealed* source disturbed composition. Once `drawPlayer`/`drawWorld`
  always stamp `revealedFromHidden`, the rule "stamped → generic" covers the
  *draw* events unconditionally and that part of the index masking drops out.
  But the taint machinery also masks `CardsDiscarded` (player cards discarded at
  EndTurn following a concealed hook, actionPreview.ts:617-618), which carries no
  rng/hidden-reveal stamp under this model. That case stays. Expect the index
  machinery to contract, not disappear.
- **Conformance test (fail closed).** Assert that any event of type
  `CardsDrawn`, `HazardAdded`, `CardsFrozen`, or `PlayerDiscardRecalled`(random),
  and any `CardDestroyed`/`CardGained`/`BoonOffered` produced down an
  rng-consuming path, reaches the preview carrying a stamp. New stochastic
  effects then fail the test until stamped, instead of silently leaking.
- **`CardsBurnedForHeat` is a planned-but-unemitted event.** It has summary
  handling (actionPreview.ts:405-410, which names burned cards) and appears in
  `disturbsDeckComposition`, but no core handler emits it today. If its future
  emitter selects victims randomly it needs `randomized`; the conformance test
  will catch it once an emitter exists. Listed here so it is not mistaken for an
  oversight.

## Tradeoffs and risks

- **`determinize` correctness depends on the model.** If a zone is wrongly
  classified visible, the agent cheats; if wrongly hidden, the agent is
  needlessly blind. The model table is load-bearing — get it reviewed.
- **Stamp coverage is an audit, not a one-liner.** Every rng-consuming and
  hidden-revealing handler must stamp. A conformance test should assert that no
  event reaching the preview from those handlers is unstamped (fail closed).
- **`GameEvent` widening touches a union with many consumers.** The fields are
  optional, so existing readers are unaffected, matching how `sourceCardId` was
  added. Low blast radius, but typecheck the full tree.
- **Display vs sim asymmetry must not be collapsed.** Tempting to reuse
  `determinize` for previews, but that would show a *sampled* card as fact — a
  lie worse than the current leak. Previews mask to "unknown"; only the sim
  consumes determinized samples.

## Decision

Adopt the **observability-boundary** architecture: define the model once, stamp
randomness/hidden-reveal at the source on `GameEvent` (extending the
`sourceCardId` pattern), mask by rule in the preview layer, and add a boundary
`determinize` helper for the sim. **Reject** any in-`reduce` "preview/fake-rng"
mode — it is the wrong layer, unsound when skipping, and unrepresentable when
placeholdering.

Sequence:

1. **Define the observability model** + `hiddenZones`/`isHidden` helper. (Cheap,
   unblocks both.)
2. **Stamp + rule-based masking** for player display. Audit every rng/hidden
   handler; add a fail-closed conformance test. Ships standalone value.
3. **`determinize` + honest sim policy.** Consumes 1 and 2; enables the greedy /
   search agents and difficulty measurement.

### Resolved decisions

- **`playerDiscard` is visible, not hidden information.** There is no UX for
  browsing it yet, but that is a presentation gap, not an observability
  boundary. `determinize` must not reshuffle or redact it, and recall previews
  (Tidal) may name discard contents freely.
- **`randomized` and `revealedFromHidden` stay distinct stamps.** They mask
  identically for the player today, but they mean different things (an rng roll
  at resolution vs. a predetermined hidden zone being read) and the sim treats
  them differently. Keeping them separate avoids a lossy merge we would have to
  unpick later. Do not collapse into a single flag.
