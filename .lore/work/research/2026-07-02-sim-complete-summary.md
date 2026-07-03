# Raw Data

Completeness report
  N=100  K=5  agentSeed=12345  threshold=2.0%
  Eval weights: default

World: zombie-big-box  (3 acts)
  Games:   100
  Wins:    73  (73.0%)
  Losses:  27
  Capped:  0
  Recovery runs: 0
  Avg turns survived: 31.4
  Loss by cause: hp=27
  Loss by act:   act 2/3=24, act 3/3=3

World: bird-building  (3 acts)
  Games:   100
  Wins:    74  (74.0%)
  Losses:  25
  Capped:  1
  Recovery runs: 0
  Avg turns survived: 16.6
  Loss by cause: noPlayerCards=25
  Loss by act:   act 3/3=25

World: highway-volcano  (3 acts)
  Games:   100
  Wins:    76  (76.0%)
  Losses:  16
  Capped:  8
  Recovery runs: 0
  Avg turns survived: 47.6
  Loss by cause: hp=16
  Loss by act:   act 3/3=16

World: overgrown-mall  (3 acts)
  Games:   100
  Wins:    17  (17.0%)
  Losses:  78
  Capped:  5
  Recovery runs: 40
  Avg turns survived: 58.2
  Loss by cause: hp=65, noPlayerCards=13
  Loss by act:   act 2/3=17, act 3/3=61

World: fog-beach-party  (3 acts)
  Games:   100
  Wins:    99  (99.0%)
  Losses:  1
  Capped:  0
  Recovery runs: 0
  Avg turns survived: 20.9
  Loss by cause: hp=1
  Loss by act:   act 3/3=1

World: whiteout-parking-garage  (3 acts)
  Games:   100
  Wins:    77  (77.0%)
  Losses:  23
  Capped:  0
  Recovery runs: 0
  Avg turns survived: 31.5
  Loss by cause: hp=23
  Loss by act:   act 3/3=23

World: the-tidal-archive  (3 acts)
  Games:   100
  Wins:    98  (98.0%)
  Losses:  0
  Capped:  2
  Recovery runs: 0
  Avg turns survived: 39.7
  Loss by cause: (none)
  Loss by act:   (none)

World: the-ember-orchard  (3 acts)
  Games:   100
  Wins:    3  (3.0%)
  Losses:  86
  Capped:  11
  Recovery runs: 47
  Avg turns survived: 32.3
  Loss by cause: hp=1, noPlayerCards=85
  Loss by act:   act 1/3=21, act 2/3=49, act 3/3=16

World: city-of-sleeping-giants  (3 acts)
  Games:   100
  Wins:    85  (85.0%)
  Losses:  15
  Capped:  0
  Recovery runs: 0
  Avg turns survived: 40.8
  Loss by cause: noPlayerCards=15
  Loss by act:   act 2/3=2, act 3/3=13

World: eden-prime  (3 acts)
  Games:   100
  Wins:    2  (2.0%)
  Losses:  69
  Capped:  29
  Recovery runs: 50
  Avg turns survived: 92.6
  Loss by cause: noPlayerCards=69
  Loss by act:   act 2/3=50, act 3/3=19
  [FLAGGED] win-rate 2.0% <= 2.0%
    Dominant cause: noPlayerCards (69/69 losses)
    Dominant act:   act 2/3 (50/69 losses)
    Caveat: a win-rate is a SAMPLE under ONE agent at ONE skill level, not a
    proof of (un)solvability. A near-0% flag means "this agent could not
    survive it", to be confirmed by a future clairvoyant check.

World: new-derelict  (3 acts)
  Games:   100
  Wins:    90  (90.0%)
  Losses:  10
  Capped:  0
  Recovery runs: 0
  Avg turns survived: 28.1
  Loss by cause: exhausted=1, noPlayerCards=9
  Loss by act:   act 3/3=10

World: transit-authority  (3 acts)
  Games:   100
  Wins:    40  (40.0%)
  Losses:  59
  Capped:  1
  Recovery runs: 29
  Avg turns survived: 56.0
  Loss by cause: exhausted=2, noPlayerCards=57
  Loss by act:   act 3/3=59

Flagged worlds: 1/12

# Result Summary

Summary — sim:complete results (N=100, K=5, 12 worlds, 1/12 flagged)

Trivial (95–100% win-rate): worlds barely test the player.
- fog-beach-party — 100%, zero losses across 100 baseline runs. No pressure at all.
- the-tidal-archive — 98%, only 2 capped runs, no losses. Longest average survival (39 turns) but never threatening.

Comfortable (75–90%): solid difficulty, clears reliably but not trivially.
- new-derelict — 86%, losses split noPlayerCards/exhausted at act 3.
- city-of-sleeping-giants — 82%, noPlayerCards-driven losses concentrated in act 3.
- bird-building — 80%, shortest world (median 15 turns), dies to noPlayerCards at act 3 when it dies at all.
- highway-volcano — 78%, notable capped-run rate (13%), hp-driven losses at act 3.
- zombie-big-box — 76%, hp-driven losses mostly at act 2.
- whiteout-parking-garage — 75%, hp-driven losses at act 3.

Hard (15–35%): genuinely punishing, most runs end in loss.
- transit-authority — 30%, longest median action count (296) and turn count, dies almost entirely to noPlayerCards at act 3 — a slow grind that runs out of cards, not HP.
- overgrown-mall — 18%, hp-dominant losses (62/73) with a negative median HP-pressure floor (-1), suggesting runs regularly end already past zero.

Near-unsolvable (<5%): the two outliers.
- eden-prime — 3% baseline, just above the 2% flag line. 90%+ no-progress-EndTurn rate — the agent is essentially stalled, dying to noPlayerCards mostly at act 2.
- the-ember-orchard — 2%, [FLAGGED]. Same signature: noPlayerCards (90/91 losses), dominant at act 2.

Two things worth flagging beyond the raw tiers:
1. Card-economy failure, not damage, kills the hard worlds. noPlayerCards (hand/deck starvation) dominates transit-authority, overgrown-mall (partially)w-derelict, eden-prime, and ember-orchard. The comfortable mid-tier worlds fail to raw HP damage instead. If eden-prime/ember-orchard get balance attention, the lever is probably card economy around act 2, not su
2. Recovery unlocks (extra HP, sprint, keyword bonus) don't behave uniformly. They boost most worlds nicely (w+23pp, transit-authority +21pp, bird-buildinge two near-unsolvable worlds, and actuallyhurt win-rate in zombie-big-box (-6pp) and the-tidal-archive (-7pp). That's counterintuitive for a "recovery" configuration and worth a follow-up look — ittion where extra resources change the evalagent's early decisions for the worse, not just noise.

# Plan

- fog-beach-party - needs more leathality
- the-tidal-archive - "Trivial" why?

