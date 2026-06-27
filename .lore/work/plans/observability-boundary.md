---
title: "Implementation plan: observability boundary"
date: 2026-06-26
status: executed
tags: [plan, observability, preview, sim, determinization, rng]
modules: [core, sim]
related: [.lore/work/design/observability-boundary.md, .lore/work/notes/observability-boundary.md]
---

# Implementation plan: observability boundary

Source design: [.lore/work/design/observability-boundary.md](../design/observability-boundary.md).

## Goal and scope

Separate ground-truth state from player-observable state in the core engine so
that (1) action previews stop leaking resolution randomness and hidden deck
order, and (2) an honest sim agent becomes buildable. This plan delivers the
**boundary and the sim seam** only:

- the observability model as a small typed helper,
- the `randomized` / `revealedFromHidden` event stamps, applied at every audited
  emit site, with rule-based masking in the preview layer and a fail-closed
  conformance test,
- the `determinize(state, rng)` helper,
- a `Policy` seam in `src/sim` that decides on determinized snapshots and commits
  against real state.

**Out of scope (follow-on plan):** the greedy / search policy with a tunable
evaluation function, and the agent-ladder difficulty harness. The eval function
is its own iterative design problem and does not depend on anything here beyond
the seam this plan lands.

## Decisions baked into this plan

- **`determinize` shuffles within each future act entry.** The design left
  "shuffle act contents vs. treat contents as fair game" open. This plan takes
  the honest default: reshuffle the cards inside each `state.acts` entry under
  the agent rng, mirroring what `drawWorld` does when it advances an act. The
  agent learns act *contents* no earlier than a human would and never their
  order. (Reversible later if the follow-on wants a clairvoyant upper-bound
  agent.)
- **Masking changes text only, never risk.** The "stamped → generic" rule
  rewrites `summaryLines`. `classifyRisk` / `severityForRisk` are untouched, so a
  randomized freeze still reads as `harmful` even when its card names are hidden.
- **`determinize` preserves card instances and ids; reorders hidden piles only.**
  `hand` and all visible state stay byte-identical, so an action a policy chooses
  on the determinized snapshot remains valid against the real state.

## Step sequence

<svg viewBox="0 0 820 220" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="11">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#666"/>
    </marker>
  </defs>
  <rect x="10" y="80" width="120" height="54" rx="6" fill="#e8eef7" stroke="#33558b"/>
  <text x="70" y="100" text-anchor="middle" font-weight="bold">1. Model</text>
  <text x="70" y="116" text-anchor="middle">hiddenZones /</text>
  <text x="70" y="128" text-anchor="middle">isHidden</text>

  <rect x="170" y="20" width="130" height="54" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="235" y="40" text-anchor="middle" font-weight="bold">2. Stamp</text>
  <text x="235" y="56" text-anchor="middle">widen GameEvent +</text>
  <text x="235" y="68" text-anchor="middle">emit-site stamps</text>

  <rect x="170" y="100" width="130" height="54" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="235" y="120" text-anchor="middle" font-weight="bold">3. Mask</text>
  <text x="235" y="136" text-anchor="middle">stamped → generic;</text>
  <text x="235" y="148" text-anchor="middle">fix 2 live leaks</text>

  <rect x="340" y="60" width="130" height="54" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="405" y="80" text-anchor="middle" font-weight="bold">4. Conformance</text>
  <text x="405" y="96" text-anchor="middle">fail-closed</text>
  <text x="405" y="108" text-anchor="middle">stamp test</text>

  <rect x="510" y="60" width="130" height="54" rx="6" fill="#f7efe8" stroke="#8b5a33"/>
  <text x="575" y="80" text-anchor="middle" font-weight="bold">5. determinize</text>
  <text x="575" y="96" text-anchor="middle">3 surfaces +</text>
  <text x="575" y="108" text-anchor="middle">rng reseed</text>

  <rect x="680" y="60" width="130" height="54" rx="6" fill="#f7efe8" stroke="#8b5a33"/>
  <text x="745" y="80" text-anchor="middle" font-weight="bold">6. Sim seam</text>
  <text x="745" y="96" text-anchor="middle">Policy +</text>
  <text x="745" y="108" text-anchor="middle">determinized view</text>

  <line x1="130" y1="100" x2="170" y2="55" stroke="#666" marker-end="url(#arrow)"/>
  <line x1="130" y1="112" x2="500" y2="90" stroke="#999" stroke-dasharray="3 3" marker-end="url(#arrow)"/>
  <line x1="235" y1="74" x2="235" y2="100" stroke="#666" marker-end="url(#arrow)"/>
  <line x1="300" y1="120" x2="340" y2="92" stroke="#666" marker-end="url(#arrow)"/>
  <line x1="470" y1="87" x2="510" y2="87" stroke="#666" marker-end="url(#arrow)"/>
  <line x1="640" y1="87" x2="680" y2="87" stroke="#666" marker-end="url(#arrow)"/>
  <text x="300" y="175" text-anchor="middle" fill="#777">Steps 2–4 (display) and steps 5–6 (sim) both depend only on step 1.</text>
</svg>

Steps 2→3→4 are the player-display track and ship standalone value. Steps 5→6
are the sim track. Both depend only on step 1, so the tracks can proceed in
parallel after it, but the plan orders display first because it fixes the two
live leaks.

---

### Step 1 — Observability model helper

**Do:** Add a small typed surface that names the hidden zones, the single
written-down model both tracks derive from.

- New file `src/core/model/observability.ts` (model layer, no engine imports).
  - `hiddenZones(state)` → the zones whose contents/order are hidden:
    `playerDraw`, `worldDraw`, and each entry of `acts`. (`playerDiscard` and
    `hand` excluded — visible.)
  - `isHidden(card, state)` → folds zone membership with the existing
    `isConcealed(card, state.light)` so concealed cards in hand also count.
    Reuse `isConcealed` from `model/keywords.ts`; do not reimplement.
- Export both from `src/core/contract.ts` (and `index.ts` if appropriate),
  alongside the existing `isConcealed` export.
- Keep the model table from the design as the doc comment so the file *is* the
  reference.

**Validation gate:**
- `bun run test` (new unit test `src/core/tests/observability.test.ts`): asserts
  the zone set is exactly `{playerDraw, worldDraw, acts[*]}`; `isHidden` true for
  a concealed hand card and for any draw/act card, false for hand/discard cards.
- `bun run typecheck` clean.

---

### Step 2 — Widen `GameEvent` and stamp at emit sites

**Do:** Add the two optional fields and stamp every site in the design's audit
table. Stamp at the emit site, not a boundary (within one effect, some events
are random and some are not).

- `src/core/model/types.ts` (~line 386): extend the trailing `GameEvent`
  intersection that already carries `sourceCardId?` with
  `readonly randomized?: boolean` and `readonly revealedFromHidden?: boolean`.
- Stamp the audited sites:
  - `engine/draw.ts` `drawPlayer` → `CardsDrawn` (bHazard:false): `revealedFromHidden`.
    Note: this event's `templateIds` is already left empty (draw.ts:29), but the
    `ids` still resolve to names through the preview's `cardMap`, so the stamp is
    what actually plugs the leak — empty `templateIds` does not.
  - `engine/draw.ts` `drawWorld` → `CardsDrawn` (bHazard:true) and `HazardAdded`: `revealedFromHidden`.
  - `engine/draw.ts` `resolveForceDestroy` → `CardDestroyed`: `randomized` (the
    `shuffle` at draw.ts:245 picks victims). Apply alongside the existing
    `withSource` stamp; the two stamps coexist.
  - `effects/worldCards.ts` `ExileTopWorldCardsHandler` → `WorldCardsExiled`: `revealedFromHidden`.
  - `effects/heat.ts` `FreezeCardsHandler` → `CardsFrozen`: `randomized`.
  - `effects/gainCard.ts` `GainRandomCardHandler` → `CardGained`: `randomized`
    (keep `setName` as the label datum; the masking decision will key on the
    stamp, not on `setName` presence).
  - `effects/recallDiscard.ts` random recall → `PlayerDiscardRecalled`:
    `randomized`. **Path matters:** `resolveAutoRecall` does not emit the event —
    `recallToTop` does, and it is shared with the never-stamped `playerSelected`
    path (`ReturnPlayerDiscardToTopHandler`). Do **not** change `recallToTop`'s
    signature. Instead, post-process the events returned by `recallToTop` inside
    the auto-recall caller (`RecallPlayerDiscardHandler.apply()`), adding
    `randomized: true` only when `policy === "random"`. Deterministic policies
    (latest/lowestCost/highestCost/panicFirst) and `playerSelected` stay
    unstamped.
  - `engine/actBoon.ts` `createBoonOffer` → `BoonOffered`: `randomized`. This
    covers both callers (`createActBoonOffer` and `OfferBoonHandler` via
    `createBoonOffer`).
- Do **not** stamp the determinize-only sites (`DeckShuffled`, `ActAdvanced`,
  `WorldCardsReturned`, fixed `CardGained` to worldDraw, opening deal).

**Validation gate:**
- `bun run test` (shared core change): existing suite green.
- New per-site unit assertions: each listed handler emits its event with the
  expected flag set; the deterministic recall policies emit `PlayerDiscardRecalled`
  with no `randomized` flag.
- `bun run typecheck` clean (confirms optional fields don't break consumers).

---

### Step 3 — Rule-based masking + fix the two live leaks

**Do:** Route stamped events through generic summaries in `actionPreview.ts`.

- Add the invariant in `summarizeEvents`: any event with `randomized` or
  `revealedFromHidden` produces a name-free summary. **Ordering:** this stamp
  check runs **first** in the per-event loop (actionPreview.ts:141-178),
  *before* the `eventIsConcealed` check (line 148) and the `maskFlowAfterIndex`
  taint check (line 161). Making it primary is what lets the taint cases for
  stamped events be removed (next bullet) rather than left as dead fallbacks.
- Generic form per stamped event type. Several are already generic — name them
  so the implementer changes only what needs changing:
  - `WorldCardsExiled` → new generic "Exile top N world cards" (currently names
    cards — this is the leak fix).
  - `CardDestroyed` (randomized) → "Destroy N player cards" (currently names
    cards — leak fix).
  - `CardsDrawn` → keep "Draw N {player|world} cards" (already generic).
  - `CardsFrozen` → keep "Freeze N at random" (already generic).
  - `CardGained` (randomized) → "Gain a random card from {setName}" (keep
    `setName` as label data; see setName-keying bullet).
  - `HazardAdded` → no text change; `summarizeEvent` already returns `[]`
    (line 426). The stamp check still fires so the conformance invariant holds.
  - `PlayerDiscardRecalled` → no text change (already name-free, lines 454-457).
  - `BoonOffered` → no text change (already names only `setName`, line 427-428).
- **Fix the `ExileTopWorldCards` live leak** (actionPreview.ts:416-421): the
  stamped event now masks instead of naming the exiled cards.
- **Fix the `resolveForceDestroy` live leak**: the randomized `CardDestroyed`
  from the next-turn-start (reached via the EndTurn preview) now masks regardless
  of whether the queuing source is concealed.
- **Replace the `setName`-keying** for `CardGained` (actionPreview.ts:437-445)
  with the `randomized` check.
- **Contract, do not delete, the taint machinery.** With the stamp check now
  primary, go through `summarizeMaskedHiddenFlowEvent` (actionPreview.ts:616-644)
  case by case. Disposition:
  - **Remove** (now always stamped `revealedFromHidden`, caught before the taint
    path): `CardsDrawn`, `HazardAdded`. Note `HazardAdded`'s taint string ("A
    concealed hazard joins the world") differs from its stamped form (`[]`); the
    stamped form wins and the taint case goes.
  - **Remove** (carries no card names; normal summary already generic):
    `DeckShuffled`.
  - **Keep**: `CardsDiscarded` (player discards at EndTurn after a concealed
    hook — no stamp under this model), `CardsThawed` (deterministic, unstamped),
    and `CardDestroyed` / `CardsFrozen` / `CardsBurnedForHeat` / `CardGained` for
    their **concealed-hook** path: those carry `sourceCardId` (caught by
    `eventIsConcealed`) or are downstream-tainted but unstamped. The `randomized`
    stamp added in step 2 covers only the *random-selection* instances of
    `CardDestroyed`/`CardsFrozen`/`CardGained`, not the concealed-source ones, so
    these cases stay.
  - Verdict: the taint machinery contracts (drops 3 cases) but survives for
    concealment. The concealment regression suite (gate below) is the proof the
    kept cases still fire.
- Confirm `classifyRisk` / `severityForRisk` are untouched.

**Validation gate:**
- `bun run test` (targeting the actionPreview test file): assert previews of
  EndTurn-with-pending-ForceDestroy and of `ExileTopWorldCards` no longer name
  cards; risk/severity unchanged for those previews.
- Concealment regression: existing concealment/preview tests stay green (the
  contraction did not regress concealed-source masking).
- `bun run test` green.

---

### Step 4 — Fail-closed conformance test

**Do:** Add a test that fails when a stochastic / hidden-reveal event reaches the
preview unstamped, so new effects cannot silently leak.

- New test `src/core/tests/observability-conformance.test.ts`: drive states that
  exercise each audited path (force-destroy, freeze, gain-random, random recall,
  act/world-clear boon, world draws, exile) and assert the produced events carry
  the expected stamp; assert the preview summary for each is name-free.
- Document in the test header the audit-two-axes rule (rng consumers +
  hidden-zone readers) so future authors know the contract.
- Note `CardsBurnedForHeat` as a known unemitted event: add a skipped/pending
  assertion or comment so it is wired the day an emitter lands.

**Validation gate:**
- `bun run test` green; deliberately removing one stamp makes this test fail
  (verify once, then restore).

---

### Step 5 — `determinize(state, rng)` helper

**Do:** Add the boundary helper that produces a player-honest snapshot.

- New file `src/sim/determinize.ts` (sim layer; it consumes core's `shuffle`,
  `createRng`/`nextFloat`, and `hiddenZones` from step 1). It must:
  1. reshuffle `playerDraw` and `worldDraw` under the agent rng,
  2. reshuffle the cards **within each `state.acts` entry** (baked decision),
  3. replace `state.rng` with a fresh state seeded from the agent rng,
  4. leave `hand`, `playerDiscard`, `hp`, resources, `nextId`, and all card
     instances/ids untouched (reorder only).
- Use the existing `shuffle` from `engine/rng.ts`; do not write a new shuffle.
- **RNG type boundary (resolve here, it blocks step 6):** `shuffle` takes the
  pure `RngState` form, not a `() => number` closure. So `determinize` takes a
  `RngState` and returns `[determinizedState, nextRngState]` (threading the
  advanced state the way `shuffle` already does), keeping it pure. The reseed in
  (3) derives `state.rng` from that same agent `RngState` (e.g. via `createRng`
  off a value pulled from it). The runner (step 6), not `determinize`, owns
  converting to whatever form the policy wants.

**Validation gate:**
- `bun run test` (targeting `src/sim/`): hidden zones are permutations of the
  originals (same multiset of ids), `playerDiscard` and `hand` byte-identical,
  `state.rng` differs, same `agentRng` seed yields identical determinization
  (reproducible), different seeds generally differ.
- `checkIdAccounting` passes on `determinize`'s output directly (sharper than
  waiting for step 6 to catch it through the loop).
- A reduced action over a `hand` card on the determinized state matches the same
  action's legality on the real state (instance/id preservation check).

---

### Step 6 — `Policy` seam in `src/sim`

**Do:** Refactor the runner so a policy decides on a determinized snapshot and
the chosen action is applied to the real state. Behavior-preserving for the
existing random policy.

- Define `Policy` (e.g. `src/sim/policy.ts`): `(view: GameState, rng: () => number)
  => Action`, keeping the existing `() => number` shape `pickAction` already
  takes (policy.ts:10-11). Adapt the existing `pickAction` into a `randomPolicy`
  implementing it.
- In `src/sim/run.ts`: own a single agent `RngState` and thread it across the
  loop. Each decision: call `determinize(state, agentRngState)` → get
  `[view, nextRngState]`, derive a `() => number` closure (e.g. via
  `rngFromSeed` off a value from the threaded state, or a small closure over the
  advancing state) for the policy, pass `view` to the policy, reduce the returned
  action against the **real** `state`, and carry `nextRngState` forward. Boon
  choices follow the same path.
- This replaces the loop's `Math.random.bind(Math)` (run.ts:28) with the seeded
  agent rng, giving reproducible sim runs whose rng is fully separate from
  `state.rng`. Note the bridge from pure `RngState` (determinize/shuffle) to
  `() => number` (policy) lives here, in the runner — neither core nor the policy
  needs to know about both forms.

**Validation gate:**
- `bun run sim` completes and reports win/loss/violation stats in a similar
  range with no new accounting violations. (Exact win/loss numbers *will* change:
  the loop's rng moves from `Math.random` to a seeded agent rng. "Same range, no
  new violations" is the bar, not byte-identical stats.)
- `bun run test` (targeting `src/sim/tests/sim.test.ts`) green.
- Seam test: a spy policy records the snapshot it receives and asserts its hidden
  zones differ from the real state's (proves decisions ride the determinized
  view). Note in the test that *honest-play* validation (an agent that cannot win
  by cheating) arrives with the follow-on greedy agent; the random policy ignores
  hidden info so this seam test is the in-scope proof the wiring is correct.

---

### Step 7 — Final validation against the design

**Do:** Whole-tree check and a requirement-style pass against the source design.

- `bun run lint && bun run typecheck && bun run test && bun run build` all clean.
- `bun run sim` sanity run.
- Cross-check the design's audit table: every "must stamp" site stamped, every
  "no stamp" site left alone, both live leaks (ExileTopWorldCards, ForceDestroy)
  closed, `determinize` resamples all three surfaces incl. rng, `playerDiscard`
  untouched, the two stamps kept distinct.
- Update the design doc `status` to `implemented` and add a back-link to this
  plan (or leave for `/retro`).

**Validation gate:** all commands green; checklist above fully satisfied.

## Risks carried from the design

- `GameEvent` widening touches a union with many consumers; fields are optional
  so blast radius is low, but typecheck the full tree (step 2 gate).
- Contracting the taint machinery (step 3) risks regressing concealed-source
  masking; the concealment regression suite is the guard.
- The sim seam's honesty cannot be fully validated without a hidden-info-reading
  agent; the spy-policy test proves wiring, full honesty proof is deferred to the
  follow-on (called out in step 6).
