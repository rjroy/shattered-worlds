---
title: Witness Knowledge — Per-Threat History Feeding Feats, Not Player-Facing Reveals
date: 2026-07-02
status: current
tags: [witness, meta-progression, feats, telemetry, destiny]
fg-type: architecture
fg-sources: [.lore/work/brainstorm/shattered-worlds-meta-progression.md, .lore/work/specs/extended-run-telemetry.md]
fg-status: current
fg-evidence:
  code:
    - src/game/runtime/witnessProfile.ts
    - src/data/feats/catalog.json
    - src/data/feats/types.ts
  tests:
    - src/game/runtime/witnessProfile.test.ts
  symbols:
    - WitnessProfile
    - WitnessEntry
    - createWitnessCollector
---

# Witness Knowledge — Per-Threat History Feeding Feats, Not Player-Facing Reveals

The meta-progression brainstorm proposed "Witness Knowledge": threats the player has encountered or died to become legible in future runs (face-up capstone rules after a first death, a spawn-forecast pip after enough repeat encounters, a Journal codex page per threat). The framing was that mastery should transfer without power transferring, and that dying should be a clean, guilt-free earn.

## What Shipped

`witnessProfile.ts` implements the data substrate: a per-threat `WitnessEntry` (`encounterCount`, `discardedCount`, `resolvedCount`, `diedTo`) keyed by hazard template name, persisted under `shattered-worlds/witness/v1`. It is built from the gameplay event stream — `HazardAdded`/`HazardResolved`/`HazardDiscarded` events tally counts, and a `lost` `RunEnded` outcome marks every world card still in the losing hand as `diedTo: true`. Wins and abandons never set `diedTo`.

This data feeds the feat system directly: `witness.<ThreatName>.<field>` is a first-class feat condition scope (see `src/data/feats/types.ts` and the `feat-definition-type-contract` page), and the shipped feat catalog gates several unlocks on `witness.<ThreatName>.resolvedCount >= N` (e.g. clearing The Walker, Zombie, Gripping Talon, Lava Flow 25 times each).

## What Did Not Ship (Yet)

The brainstorm's specific *player-facing* payoffs — face-up capstone rules after a first death, a forecast pip after repeat encounters, a dedicated Codex journal page per threat — are not implemented. What exists today is the tracking layer and its use as a feat-gating input, not a witness-specific UI surface. If those sketched features are revisited, the data they'd need (`encounterCount`, `resolvedCount`, `diedTo`) already exists in `WitnessProfile`.

Related: [[destiny-progression]], [[feat-definition-type-contract]], [[feat-evaluation-memory-fragments]], [[extended-run-telemetry-fields]]
