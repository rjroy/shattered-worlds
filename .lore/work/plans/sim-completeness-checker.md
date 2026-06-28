---
title: "Implementation plan: sim per-world completeness checker"
date: 2026-06-27
status: executed
tags: [plan, sim, completeness, agent, evaluation-function, determinize, balance]
modules: [sim, core, data]
related: [.lore/work/specs/sim-completeness-checker.md, .lore/work/brainstorm/sim-completeness-checker.md, .lore/work/plans/observability-boundary.md]
---

# Implementation plan: sim per-world completeness checker

Source spec: [.lore/work/specs/sim-completeness-checker.md](../specs/sim-completeness-checker.md)
(REQ-SCC-1..18). Builds on the **executed** observability-boundary plan, which
landed `determinize` and the `Policy` seam in `src/sim`.

## Goal and scope

Deliver a **per-world solvability instrument**: a stronger-than-random *honest*
agent driven by a survival eval, run over many seeds against all 9 registered
worlds, emitting a stdout report of per-world win-rate plus failure attribution
(cause + act). Report-only — no CI gate. Clairvoyant agent and difficulty ladder
are out of scope (future specs).

## Decisions (resolving the spec's open questions)

- **Failure attribution → instrument `WorldLost` at the source.** Terminal-state
  inference cannot cleanly separate the three turn-start livelock guards (HP>0 in
  all three; the distinguishing fact — `playerCardsDrawn === 0` vs. all-piles-empty
  vs. no-world-cards — is not all recoverable from the final state). Inferring it
  in the sim would also duplicate core's loss logic (two code paths = bug source).
  Instead add an **optional** `cause` field to the `WorldLost` event, populated at
  each of the 4 emit sites. Optional matches the low-blast-radius `sourceCardId`
  precedent; existing consumers ignore it. (REQ-SCC-12, REQ-SCC-17.)
- **Search shape → 1-ply over K determinizations of the post-action state.** For
  each candidate action, apply it via `reduce`, then average the eval over K
  re-determinizations to account for draw uncertainty; pick the argmax. K default
  5, configurable. Deep multi-ply lookahead stays a future tuning knob
  (REQ-SCC-6, REQ-SCC-8).
- **Eval calibration → land working agent + report first, tune second.** The
  dominance assertion (REQ-SCC-9 / validation 3) ships as a **pending/skipped**
  test until tuning is confirmed, so an untuned eval is not read as a code bug.

## Architecture notes that shape the steps

- The runner already determinizes the real `state` into a `view` once per decision
  and commits the chosen action against real state. The eval policy receives
  `view` and must do its own K-sampling. **The K determinizations must thread one
  `RngState` forward** — `determinize` returns `[det, nextRng]`, and each call's
  `nextRng` feeds the next, or all K samples are identical and the average is a
  no-op:
  ```
  rngState ← createRng(Math.floor(rng() * 0x100000000))   // once per decision
  for each candidate action:
    let acc = 0
    for k in 0..K-1:
      [det, rngState] ← determinize(view, rngState)        // thread forward
      result ← reduce(catalog, det, candidate)
      acc += evaluate(result.state, weights)
    score[candidate] = acc / K
  pick argmax(score)                                        // deterministic tiebreak
  ```
  `determinize`, `reduce`, and the policy all live in/near `src/sim`, so this needs
  no seam widening (REQ-SCC-1 kept). Note the policy needs the **catalog** to call
  `reduce` — see step 3's factory signature.
- **One play-out path, not two.** `run.ts` and the new completeness runner must
  share a single `playOut(...)` loop and a single action-enumeration helper, so the
  random and eval policies run through identical machinery (user rule: two code
  paths "doing the same thing" is a bug source). Refactoring `run.ts` onto the
  shared helpers is part of the work, and existing random-sim behavior must be
  preserved.

## Step sequence

<svg viewBox="0 0 860 140" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="11">
  <defs>
    <marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#666"/></marker>
  </defs>
  <rect x="10" y="50" width="120" height="44" rx="6" fill="#e8eef7" stroke="#33558b"/>
  <text x="70" y="68" text-anchor="middle" font-weight="bold">1. WorldLost</text>
  <text x="70" y="82" text-anchor="middle">cause (core)</text>
  <rect x="160" y="50" width="120" height="44" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="220" y="68" text-anchor="middle" font-weight="bold">2. Eval fn</text>
  <text x="220" y="82" text-anchor="middle">min-of-margins</text>
  <rect x="310" y="50" width="120" height="44" rx="6" fill="#eaf5ea" stroke="#2f7d31"/>
  <text x="370" y="68" text-anchor="middle" font-weight="bold">3. Eval policy</text>
  <text x="370" y="82" text-anchor="middle">1-ply × K</text>
  <rect x="460" y="50" width="130" height="44" rx="6" fill="#f7efe8" stroke="#8b5a33"/>
  <text x="525" y="68" text-anchor="middle" font-weight="bold">4. Runner+report</text>
  <text x="525" y="82" text-anchor="middle">9 worlds, attrib</text>
  <rect x="620" y="50" width="120" height="44" rx="6" fill="#f7efe8" stroke="#8b5a33"/>
  <text x="680" y="68" text-anchor="middle" font-weight="bold">5. Broken-world</text>
  <text x="680" y="82" text-anchor="middle">detection test</text>
  <rect x="770" y="50" width="80" height="44" rx="6" fill="#fff" stroke="#666"/>
  <text x="810" y="68" text-anchor="middle" font-weight="bold">6. Final</text>
  <text x="810" y="82" text-anchor="middle">validate</text>
  <line x1="130" y1="72" x2="160" y2="72" stroke="#666" marker-end="url(#a)"/>
  <line x1="280" y1="72" x2="310" y2="72" stroke="#666" marker-end="url(#a)"/>
  <line x1="430" y1="72" x2="460" y2="72" stroke="#666" marker-end="url(#a)"/>
  <line x1="590" y1="72" x2="620" y2="72" stroke="#666" marker-end="url(#a)"/>
  <line x1="740" y1="72" x2="770" y2="72" stroke="#666" marker-end="url(#a)"/>
  <line x1="70" y1="50" x2="500" y2="30" stroke="#999" stroke-dasharray="3 3" marker-end="url(#a)"/>
  <text x="300" y="24" fill="#777" font-size="10">step 1's cause field is consumed by step 4's attribution</text>
</svg>

Steps 2 and 3 (the agent) and step 1 (core instrumentation) are independent and
could proceed in parallel; the report (step 4) depends on all three.

---

### Step 1 — `WorldLost` cause instrumentation (core)

**Do:**
- `src/core/model/types.ts:373`: add a `WorldLostCause` union and an optional field
  on the event:
  `{ type: "WorldLost"; cause?: WorldLostCause }` where
  `WorldLostCause = "hp" | "noPlayerCards" | "exhausted" | "worldLivelock"`.
- Populate at the 4 emit sites:
  - `src/core/effects/damage.ts:22` → `cause: "hp"`.
  - `src/core/engine/reduce.ts:256` (zero player cards drawn) → `cause: "noPlayerCards"`.
  - `src/core/engine/reduce.ts:274` (no future cards + no play) → `cause: "exhausted"`.
  - `src/core/engine/reduce.ts:319` (no world cards + can't introduce) → `cause: "worldLivelock"`.
- Leave `WorldWon` unchanged.

**Validation gate:**
- New unit test (`src/core/tests/`) drives each of the 4 loss paths and asserts the
  `WorldLost` event carries the expected `cause`.
- `bun run test` green (update any existing WorldLost assertions only if they do
  exact-object matching: `golden.test.ts`, `reduce.test.ts`, `effects.test.ts`,
  and the `actionPreview.ts` consumer compile clean — optional field, so partial
  matchers are unaffected).
- `bun run typecheck` clean.

---

### Step 2 — Survival evaluation function (sim, pure)

**Do:**
- New `src/sim/eval.ts`. Export `evaluate(view: GameState, weights: EvalWeights): number`
  and an `EvalWeights` type with documented defaults. Score = *distance from death*,
  dominated by the worst axis (`min`-of-margins), reading **structured state only**
  (no card names, REQ-SCC-4):
  - HP margin (`hp` headroom).
  - Player-card availability vs. hand-flood pressure: room for player cards at next
    refill and world-card load in hand (this is the axis the frozen pressure feeds
    into, per the spec — frozen is an *input here*, not its own term).
  - Frozen pressure: fraction of hand frozen vs. thaw capacity.
  - Deck/world-exhaustion proximity (sizes of `playerDraw`/`playerDiscard`/`worldDraw`/`acts`).
  - Escape signal: progress toward / availability of a `SurviveWorld` play.
  - Energy-aware: read `state.energy` (REQ-SCC-5), never a constant.
- Keep weights and any K/depth knobs as named params (REQ-SCC-8).

**Validation gate:**
- Unit tests: eval increases as HP/headroom improve; a state one reduce-step from
  each loss line scores strictly worse than a safe sibling; a state with
  `SurviveWorld` playable and safe margins scores highest.
- Grep test / review: no objective/threat card-name literals in `eval.ts` (REQ-SCC-4).
- `bun run typecheck` clean.

---

### Step 3 — Honest eval-driven policy (sim)

**Do:**
- Extract action enumeration from `pickAction` into a shared
  `enumerateActions(state, rng): Action[]` (in `policy.ts`) that returns the **full,
  un-prioritized** legal action list. `pickAction` keeps its priority/card-name
  selection logic **in its own body**, applied on top of `enumerateActions` — the
  shortcuts must NOT move into the shared helper, or the eval policy would inherit
  card-name steering and violate REQ-SCC-4. `randomPolicy` behavior stays
  byte-preserved (REQ-SCC-1).
- New `src/sim/evalPolicy.ts` exporting a factory
  `evalPolicyFactory(catalog: CardCatalog, weights: EvalWeights, K: number): Policy`
  (the catalog is captured in the closure because the K-loop calls
  `reduce(catalog, det, candidate)`; the completeness runner passes the catalog
  from `buildWorld`'s return value, and tests can pass a synthetic catalog). The
  returned `Policy`: for the boon-pending case, evaluate each offered boon
  (`ChooseBoon`) and pick the best (REQ-SCC-7); otherwise enumerate candidate
  actions and score each via the threaded-rng K-sampling loop shown in the
  architecture notes, picking the deterministic argmax.
- The policy reads only `view` and `rng` (REQ-SCC-2); it imports `determinize`,
  `reduce`, `evaluate` from sibling sim/core modules. It contains **no** reference
  to the runner's committed `state`.

**Validation gate:**
- Seam honesty (structural, primary): review + grep confirm the returned `Policy`
  reads no `state.playerDraw`/`worldDraw`/`acts` of any committed state — it sees
  only the `view` it is handed plus its `rng` (the captured `catalog`/`weights`/`K`
  are config, not ground-truth state). (REQ-SCC-2, validation 4.)
- Seam honesty (behavioral): spy test — feeding ground truth vs. determinized view
  changes the decision.
- Budget honesty: every returned action is one `availableActions` admits for the
  committed state (guaranteed because candidates come from `enumerateActions`);
  assert across a sample run (REQ-SCC-5, validation 9).
- Dominance test (REQ-SCC-9): eval vs. random over the same seeds on
  `zombie-big-box`, asserting eval strictly higher — **written as
  pending/skipped** until tuning, per the calibration decision.
- `bun run test` (sim) green; existing `sim.test.ts` random behavior unchanged.

---

### Step 4 — Completeness runner + report (sim)

**Do:**
- Refactor the decide-on-view/commit loop out of `run.ts` into a shared
  `playOut(catalog, worldData, seed, policy, agentRng, opts): Outcome` where
  `Outcome = { status, turns, actReached, lossCause?, actAtLoss?, capped,
  finalAgentRng: RngState }`. **`finalAgentRng` is required**: the multi-seed loop
  threads it across worlds, so each world continues the agent rng stream rather
  than resetting it — without this, REQ-SCC-16 (reproducible, same-inputs →
  byte-identical) breaks. The loop scans each `reduce` result's events for
  `WorldLost` to read `cause`, and records `actIndex` at the moment status flips.
  `run.ts` is rewired onto `playOut` with `randomPolicy`, threading `finalAgentRng`
  exactly as it threads `agentRng` today, preserving its current output.
- New `src/sim/completeness.ts` entry + a `sim:complete` script in `package.json`
  (`bun run src/sim/completeness.ts`). It:
  - iterates `worldDataRegistry` ids, `buildWorld(id)` (default starter, no
    unlocks), builds the policy via `evalPolicyFactory(catalog, weights, K)` with
    that world's catalog, and runs N seeds each via `playOut(...)`, threading
    `Outcome.finalAgentRng` forward across every seed and world so the whole run is
    one continuous agent rng stream (REQ-SCC-16);
  - aggregates per world: games, wins, losses, win-rate, avg turns survived,
    loss-by-cause, loss-by-act, capped count;
  - flags worlds with win-rate ≤ threshold (default near 0%) and surfaces the
    dominant cause/act (REQ-SCC-14);
  - prints the sample-not-proof caveat for flagged worlds (REQ-SCC-15);
  - emits **stdout text only**, no timestamps/elapsed/system values (REQ-SCC-16).
- Parameters (N, K, threshold, agent seed, weights) come from argv/env with
  documented defaults (target N=100, K=5; REQ-SCC-18).

**Validation gate:**
- Report shape: running `bun run sim:complete` emits a per-world block for **all 9**
  worlds with the required fields (validation 1).
- Attribution integrity: per world, `wins + losses + capped == N` **and**
  `sum(lossByCause) == losses` **and** `sum(lossByAct) == losses`; each loss has
  exactly one cause and one act (validation 2).
- Reproducibility: two runs with identical params produce identical stdout;
  changing the agent seed changes it (validation 6).
- Tunability: a fixed-seed run at `K=1` vs `K=5` (and one varied eval weight)
  produces different win-rates with no code edits (validation 8).
- No-stall: capped/violation count is 0 on a default run (REQ-SCC-7, validation 10).
- `checkIdAccounting` holds every step (REQ-SCC-18); smoke-check that
  `buildWorld(id)` succeeds for all 9 ids with the default starter (fail loudly if
  a world lacks a `starter`).
- Random-sim preservation: capture `bun run sim 10 12345` stdout before and after
  the `playOut` refactor and confirm it is byte-identical (sharpens the otherwise
  subjective "behavior unchanged" claim, since `sim.test.ts` exercises `pickAction`
  directly, not `run.ts`).

---

### Step 5 — Broken-world fixture + detection test

**Do:**
- Add a test that constructs a **minimal in-memory `WorldData`** directly (not via
  the bundle layer) whose acts escalate beyond any survivable threshold (e.g. only
  heavy `Damage` / `ForceDestroy` hazards, no meaningful defense), runs the eval
  agent over N seeds, and asserts a near-0% win-rate **and** that the report flags
  it with a dominant cause/act. Assert a known-winnable world (`zombie-big-box`) is
  **not** flagged.

**Validation gate:**
- `bun run test` green; broken world flagged, winnable world not (REQ-SCC-14,
  validation 7).

---

### Step 6 — Final validation against the spec

**Do:**
- Walk REQ-SCC-1..18 against the implementation; confirm every in-scope requirement
  is met and no out-of-scope item (clairvoyant agent, ladder, CI gate, starter/
  unlock sweeps, full-run chaining) crept in.
- `bun run lint && bun run typecheck && bun run test && bun run build` all clean;
  `bun run sim` (random) still works; `bun run sim:complete` sanity run.
- Update the spec `status` to `implemented` and back-link this plan (or leave for
  `/retro`).

**Validation gate:** all commands green; spec checklist fully satisfied.

## Risks carried from the spec

- **Eval quality is iterative.** Dominance over random (REQ-SCC-9) may need several
  tuning passes; the pending dominance test keeps that honest without blocking the
  pipeline. Don't over-engineer the first eval — land the loop, then tune.
- **K-sampling cost.** K × candidates × determinize+reduce per decision can be slow;
  if the default run misses the ~60s bar (REQ-SCC-18), tune K/N down before adding
  complexity, and measure before optimizing.
- **Shared-loop refactor.** Rewiring `run.ts` onto `playOut` risks changing random
  sim output; the existing `sim.test.ts` is the guard, and `run.ts`'s reported
  stats should stay in the same range.
- **All-9 build coverage.** A registered world without a default `starter` would
  throw; the step-4 smoke check surfaces it rather than failing mid-report.
