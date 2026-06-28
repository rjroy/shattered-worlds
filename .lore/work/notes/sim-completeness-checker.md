---
title: "Implementation notes: sim per-world completeness checker"
date: 2026-06-27
status: complete
tags: [implementation, notes, sim, completeness, agent, evaluation-function]
source: .lore/work/plans/sim-completeness-checker.md
modules: [sim, core, data]
related: [.lore/work/specs/sim-completeness-checker.md, .lore/work/notes/observability-boundary.md]
---

# Implementation notes: sim per-world completeness checker

Orchestrated implementation of the 6-step plan. Source spec REQ-SCC-1..18.

## Progress tracker

- [x] **Step 1** — `WorldLost` cause instrumentation (core) ✅ implement/test/review green
- [x] **Step 2** — Survival evaluation function (`src/sim/eval.ts`, pure) ✅ implement/test/review green (1 fix round)
- [x] **Step 3** — Honest eval-driven policy (`src/sim/evalPolicy.ts` + `enumerateActions`) ✅ implement/test/review green (1 fix round)
- [x] **Step 4** — Completeness runner + report ✅ built, green, dominance proven. **APPROVED DIVERGENCE:** validation 10 descoped (capped REPORTED, not ==0) per user decision 2026-06-28; spec amended. `progressWeight=0` (anti-stall term inert pending future redesign).
- [x] **Step 5** — Broken-world fixture + detection test ✅ broken world flagged (0%, hp/act1) vs zombie-big-box not flagged (70.8%); exercises REAL aggregator/flag predicate. (Review folded into Step 6 holistic.)
- [x] **Step 6** — Final validation against the spec ✅ all gates green
- [x] **Holistic validation** — spec-conformance review: every REQ-SCC-1..18 + validation 1-12 MET (10 amended, 11 = command gauntlet), no scope creep, broken-world test sound

Status legend: each step runs implement → test → review before being checked.

## Key facts from prior-work research (verified against shipped source)

- `determinize(state, agentRng): [GameState, RngState]` at `src/sim/determinize.ts:23`. Reseeds `state.rng`; threads pure `RngState`. `hiddenZones(state)` is a **positional** array `[playerDraw, worldDraw, ...acts]` split by index — fragile contract.
- `Policy = (view: GameState, rng: Rng) => Action` at `src/sim/policy.ts:200`; `pickAction` at `:207`; `randomPolicy = pickAction` at `:264`. Card-name steering is **inline in `pickAction`'s body** (~lines 217-249, `nameById`, `priorityTarget` at 32-38). Must extract a name-free `enumerateActions` and leave shortcuts in `pickAction` so `randomPolicy` stays byte-identical.
- `run.ts`: `MAX_ACTIONS_PER_WORLD = 500` (:15); capped runs counted as `violations` (:68), not losses. Single `agentRng` threaded across whole loop. Per-decision: `determinize` → bridge to policy rng → `policy(view, policyRng)` → `reduce(catalog, realState, action)`. **`run.ts` currently imports `catalog, worldData` from `policy.ts` test fixture and uses `createWorld`, NOT `buildWorld`.** The completeness runner is the first `buildWorld`/`worldDataRegistry` consumer.
- `buildWorld(worldId, starterId="starter"): AssembledWorld { catalog, worldData }` at `src/data/worldManifest.ts:63`; throws on unknown id/starter/missing deck.
- `worldDataRegistry` at `src/data/worlds/registry.ts:12`. 9 ids: zombie-big-box, bird-building, highway-volcano, overgrown-mall, fog-beach-party, whiteout-parking-garage, the-tidal-archive, the-ember-orchard, city-of-sleeping-giants.
- `checkIdAccounting(state)` at `src/sim/accounting.ts:7` (throws on violation).
- `package.json`: only `"sim": "bun run src/sim/run.ts"` exists today.
- WorldLost emit sites (verify exact lines before editing): HP `effects/damage.ts:~20`, zero-player-cards `reduce.ts:~254`, no-future-cards `reduce.ts:~260-277`, world-livelock `reduce.ts:~290-322`. Win at `effects/worldCards.ts:249`.
- Honesty: do NOT let eval policy close over the runner's real `state`. Captured catalog/weights/K are config, fine.

## Agents

No `.lore/lore-agents.md` and no specialized code agents registered → using `general-purpose` for implement / test / review roles.

## Log

- 2026-06-27: Initialized. lore-researcher confirmed observability-boundary seam shipped & current; no task files exist (phases = plan steps 1-6).
- 2026-06-28: **Steps 5 & 6 done; implementation COMPLETE.** Step 5: `brokenWorld.test.ts` builds unwinnable WorldData directly (unclearable cost-99 crushers, 12 dmg/turn vs 10 HP, no SurviveWorld), runs REAL aggregator → flagged 0% hp/act1; zombie-big-box not flagged → predicate discriminates. Step 6 holistic review: every REQ-SCC-1..18 + validation 1-12 MET (10 amended/approved, 11 = gauntlet). No scope creep (no clairvoyant/ladder/CI-gate/sweeps/chaining). Final gauntlet ALL GREEN: lint ✓, typecheck ✓, test 1405 pass/2 skip/0 fail, build ✓, `bun run sim 10 12345` byte-identical, `bun run sim:complete` emits all 9 worlds + caveated flags, reproducible (same seed identical, diff seed differs). Spec → implemented, plan → executed.
- 2026-06-28: **Step 4 built, one open divergence.** `playOut.ts` (shared loop, `Outcome` with `finalAgentRng`), `run.ts` rewired (byte-identical to `sim_before.txt`), `completeness.ts` (9-world runner, threaded rng, per-world stats + cause/act attribution, flagging + caveat; now exports `runCompleteness`/`formatReport`/`parseParams`/`buildAllWorlds` behind `import.meta.main` guard for testability), `sim:complete` script. Params N/K/seed/threshold via argv+env, defaults N=100 K=5 seed=12345 threshold=0.02. **Found & fixed 2 more illegal-action bugs (same class as destroyHand): thawHand + modal-branch targeting — all behind paths zombie-big-box never hits, byte-identity preserved.** Tests: `completeness.test.ts` (attribution integrity via REAL aggregator, reproducibility, all-9). **Dominance CONFIRMED: eval 74% vs random 0% on zombie-big-box (50 seeds).** Runtime ~17s for full default (well under 60s). Default-run win-rates: zombie 73, bird 71, highway 78, overgrown-mall 11, fog 100, whiteout 67, tidal 98, ember 2 (FLAGGED), giants 83.
  - **DIVERGENCE (open):** REQ-SCC-7 / validation 10 require `capped == 0` on a default run. The eval agent stalls (neither wins nor loses within 500 actions) in **32/900** games (highway=10, ember=11, mall=7, giants=2, bird=1, tidal=1). Planned fix was an additive forward-progress eval term to break survival plateaus. Empirically it BACKFIRES: every positive `progressWeight` raises capping (pw2→46, pw4→53) and harms survival/dominance, because on comfortable boards survival axes saturate so the "tie-break" band steers toward depleting the world at survival's expense (catastrophic on recurrence world overgrown-mall 7→25). acts-mode signal also worse (44). Min capping (32) is at `progressWeight=0`. Agent set `progressWeight: 0` (term wired but inert, finding documented in eval.ts) to keep suite green. **Conclusion: capped==0 is not reachable by weight-tuning; needs an anti-stall REDESIGN or descope.**
  - **RESOLUTION (user-approved 2026-06-28):** Descope validation 10 — `capped` is reported per world as honest signal, not a hard `==0` gate. Spec amended in place. `progressWeight=0` ships (term wired but inert). Future spec may add a plateau-aware anti-stall mechanism. Step 4 accepted; Step 3's review-clean state and dominance result stand.
- 2026-06-27: **Step 3 done.** `enumerateActions(state, rng)` extracted in `policy.ts` via shared `buildLegalActions(state, nameById, rng)`; `enumerateActions` passes EMPTY name map (no steering leak), `pickAction` passes real map (byte-identical, sim.test.ts green). New `src/sim/evalPolicy.ts`: `evalPolicyFactory(catalog, weights, K)`. Boon-pending → score each ChooseBoon via reduce+evaluate (single eval, deterministic). Else → enumerate, K-sample with ONE RngState threaded forward across all candidates (plan-specified), deterministic argmax (first-in-order). Reads only view+rng (honesty proven by behavioral spy test). **Review found 2 issues, fixed:** (1) REQ-SCC-5 — `destroyHand` with `min>0` could emit inadmissible actions on non-zombie worlds (would break Step 4's 9-world run); `buildPlayAction` now returns `null` (excluded from enumeration) when legal targets < min, matching core's `checkPlayAction`; returnWorld/recallTarget verified already-guarded. (2) K≤0 NaN risk — factory now throws RangeError if `!(K>=1)`. Tests in `evalPolicy.test.ts`. 1398 pass. **Deliberate plan-conformant choice:** K samples thread rngState forward across candidates (per plan architecture notes), not common-random-numbers; CRN is a noted future variance-reduction tuning knob.
- 2026-06-27: **Step 2 done.** `src/sim/eval.ts`: pure `evaluate(view, weights)`, `EvalWeights` + `DEFAULT_EVAL_WEIGHTS`. Min-of-margins over HP/player-availability/runway; frozen folded into availability axis (not its own min-term); energy live; escape (`SurviveWorld` detected by effect KIND via recursive `effectContainsKind`, no card names). Tests `src/sim/tests/eval.test.ts`. **Review found REQ-SCC-3 violation**: original `spreadWeight=10` could mask a near-death axis. Fixed: spread normalized to `[0,1]` weighted average, `spreadWeight 10→1`, so spread is a ≤0.01-band tie-break vs worst axis. Also fixed refill-cap accuracy (`forcedWorldDraw` now mirrors `draw.ts` `min(.., room, remaining)`). New guard test: dying-but-plush board scores below surviving-but-mediocre board. 1384 pass.
- 2026-06-27: **Step 1 done.** `WorldLostCause` union + optional `cause?` on `WorldLost` (types.ts:306/378). 4 emit sites tagged: damage.ts:22 `hp`, reduce.ts:256 `noPlayerCards`, reduce.ts:274 `exhausted`, reduce.ts:319 `worldLivelock`. New `src/core/tests/worldLost.test.ts` covers all 4 guards (1376 pass/1 skip). No existing WorldLost assertions broke (all structural matchers). Review: no non-conformances, mapping verified against guard conditions. Note: pre-existing comment at reduce.ts:250 calls the noPlayerCards site "Livelock guard A" — stale terminology, label still accurate.
