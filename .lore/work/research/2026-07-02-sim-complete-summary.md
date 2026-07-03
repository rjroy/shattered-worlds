# Raw Data

Completeness report
  N=100  K=5  agentSeed=12345  threshold=2.0%
  Eval weights: default
  Play-outs per world: 200 (2 x N: one baseline + one recovery play-out per seed)
  Recovery unlock configuration: first-sprint-free, second-explore-push, extra-hp, keyword-bonus

World: zombie-big-box  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    76  (76.0%)  95% Wilson: [66.8%, 83.3%]
  Losses:  24
  Capped:  0
  Avg turns survived (all dispositions): 31.5
  Turns survived (won):  median=28.0 p90=46.0
  Turns survived (lost): median=32.0 p90=48.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=76.0%
    act 2/3: reached=100 (100.0%)  win|reached=76.0%
    act 3/3: reached=79 (79.0%)  win|reached=96.2%
  Efficiency:
    Median total actions: 183.0
    Median actions/completed turn: 6.2
    No-progress rate (per comparable EndTurn): 47.9%
    Positive-unused-energy EndTurn rate: 99.7%
    Median unused energy/EndTurn: 11.5
    Action-kind counts: PlayCard=15835, DiscardHazard=665, EndTurn=3149, ChooseBoon=30
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 9.0
    player supply: 10.0
    predicted refill room: 2.0
    runway: 19.0
    energy: 1.0
  Loss by cause: hp=24
  Loss by act:   act 2/3=21, act 3/3=3

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    70  (70.0%)  95% Wilson: [60.4%, 78.1%]
  Losses:  30
  Capped:  0
  Avg turns survived (all dispositions): 30.5
  Turns survived (won):  median=29.0 p90=39.0
  Turns survived (lost): median=36.0 p90=40.0
  Win-rate diff vs baseline (descriptive, not causal): -6.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=70.0%
    act 2/3: reached=100 (100.0%)  win|reached=70.0%
    act 3/3: reached=71 (71.0%)  win|reached=98.6%
  Efficiency:
    Median total actions: 176.0
    Median actions/completed turn: 5.9
    No-progress rate (per comparable EndTurn): 48.0%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 15.8
    Action-kind counts: PlayCard=14331, DiscardHazard=659, EndTurn=3052, ChooseBoon=58
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 10.0
    predicted refill room: 2.0
    runway: 19.0
    energy: 1.0
  Loss by cause: hp=30
  Loss by act:   act 2/3=29, act 3/3=1

World: bird-building  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    80  (80.0%)  95% Wilson: [71.1%, 86.7%]
  Losses:  20
  Capped:  0
  Avg turns survived (all dispositions): 15.4
  Turns survived (won):  median=15.0 p90=19.0
  Turns survived (lost): median=16.0 p90=18.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=80.0%
    act 2/3: reached=100 (100.0%)  win|reached=80.0%
    act 3/3: reached=100 (100.0%)  win|reached=80.0%
  Efficiency:
    Median total actions: 59.0
    Median actions/completed turn: 3.9
    No-progress rate (per comparable EndTurn): 11.2%
    Positive-unused-energy EndTurn rate: 100.0%
    Median unused energy/EndTurn: 6.4
    Action-kind counts: PlayCard=3400, DiscardHazard=1100, EndTurn=1545, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 7.0
    predicted refill room: 3.0
    runway: 5.0
    energy: 1.0
  Loss by cause: exhausted=1, noPlayerCards=19
  Loss by act:   act 3/3=20

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    97  (97.0%)  95% Wilson: [91.5%, 99.0%]
  Losses:  3
  Capped:  0
  Avg turns survived (all dispositions): 15.3
  Turns survived (won):  median=15.0 p90=19.0
  Turns survived (lost): median=15.0 p90=18.0
  Win-rate diff vs baseline (descriptive, not causal): +17.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=97.0%
    act 2/3: reached=100 (100.0%)  win|reached=97.0%
    act 3/3: reached=100 (100.0%)  win|reached=97.0%
  Efficiency:
    Median total actions: 65.0
    Median actions/completed turn: 4.3
    No-progress rate (per comparable EndTurn): 11.2%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 7.0
    Action-kind counts: PlayCard=4245, DiscardHazard=711, EndTurn=1532, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 10.0
    energy: 1.0
  Loss by cause: noPlayerCards=3
  Loss by act:   act 3/3=3

World: highway-volcano  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    78  (78.0%)  95% Wilson: [68.9%, 85.0%]
  Losses:  9
  Capped:  13
  Avg turns survived (all dispositions): 52.3
  Turns survived (won):  median=23.0 p90=30.0
  Turns survived (lost): median=40.0 p90=51.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=78.0%
    act 2/3: reached=100 (100.0%)  win|reached=78.0%
    act 3/3: reached=99 (99.0%)  win|reached=78.8%
  Efficiency:
    Median total actions: 132.0
    Median actions/completed turn: 5.4
    No-progress rate (per comparable EndTurn): 61.8%
    Positive-unused-energy EndTurn rate: 100.0%
    Median unused energy/EndTurn: 20.5
    Action-kind counts: PlayCard=17857, DiscardHazard=1545, EndTurn=5227, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 7.0
    predicted refill room: 2.0
    runway: 5.0
    energy: 1.0
  Loss by cause: hp=9
  Loss by act:   act 3/3=9

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    87  (87.0%)  95% Wilson: [79.0%, 92.2%]
  Losses:  5
  Capped:  8
  Avg turns survived (all dispositions): 44.7
  Turns survived (won):  median=19.0 p90=31.0
  Turns survived (lost): median=46.0 p90=132.0
  Win-rate diff vs baseline (descriptive, not causal): +9.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=87.0%
    act 2/3: reached=100 (100.0%)  win|reached=87.0%
    act 3/3: reached=100 (100.0%)  win|reached=87.0%
  Efficiency:
    Median total actions: 123.0
    Median actions/completed turn: 5.9
    No-progress rate (per comparable EndTurn): 61.4%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 21.4
    Action-kind counts: PlayCard=15585, DiscardHazard=1395, EndTurn=4471, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 11.0
    player supply: 7.0
    predicted refill room: 3.0
    runway: 6.0
    energy: 1.0
  Loss by cause: hp=4, noPlayerCards=1
  Loss by act:   act 3/3=5

World: overgrown-mall  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    18  (18.0%)  95% Wilson: [11.7%, 26.7%]
  Losses:  73
  Capped:  9
  Avg turns survived (all dispositions): 82.7
  Turns survived (won):  median=24.0 p90=37.0
  Turns survived (lost): median=33.0 p90=81.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=18.0%
    act 2/3: reached=100 (100.0%)  win|reached=18.0%
    act 3/3: reached=86 (86.0%)  win|reached=20.9%
  Efficiency:
    Median total actions: 125.0
    Median actions/completed turn: 3.7
    No-progress rate (per comparable EndTurn): 83.1%
    Positive-unused-energy EndTurn rate: 99.5%
    Median unused energy/EndTurn: 6.5
    Action-kind counts: PlayCard=6567, DiscardHazard=7002, EndTurn=8272, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: -1.0
    player supply: 10.0
    predicted refill room: 1.0
    runway: 26.0
    energy: 1.0
  Loss by cause: hp=62, noPlayerCards=11
  Loss by act:   act 2/3=14, act 3/3=59

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    24  (24.0%)  95% Wilson: [16.7%, 33.2%]
  Losses:  69
  Capped:  7
  Avg turns survived (all dispositions): 58.6
  Turns survived (won):  median=23.0 p90=28.0
  Turns survived (lost): median=24.0 p90=49.0
  Win-rate diff vs baseline (descriptive, not causal): +6.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=24.0%
    act 2/3: reached=100 (100.0%)  win|reached=24.0%
    act 3/3: reached=90 (90.0%)  win|reached=26.7%
  Efficiency:
    Median total actions: 111.0
    Median actions/completed turn: 4.2
    No-progress rate (per comparable EndTurn): 76.7%
    Positive-unused-energy EndTurn rate: 99.4%
    Median unused energy/EndTurn: 6.6
    Action-kind counts: PlayCard=6856, DiscardHazard=4799, EndTurn=5865, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: -1.0
    player supply: 10.0
    predicted refill room: 1.0
    runway: 23.0
    energy: 1.0
  Loss by cause: hp=64, noPlayerCards=5
  Loss by act:   act 2/3=10, act 3/3=59

World: fog-beach-party  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    100  (100.0%)  95% Wilson: [96.3%, 100.0%]
  Losses:  0
  Capped:  0
  Avg turns survived (all dispositions): 21.0
  Turns survived (won):  median=20.0 p90=27.0
  Turns survived (lost): median=(none) p90=(none)
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=100.0%
    act 2/3: reached=100 (100.0%)  win|reached=100.0%
    act 3/3: reached=100 (100.0%)  win|reached=100.0%
  Efficiency:
    Median total actions: 106.0
    Median actions/completed turn: 5.2
    No-progress rate (per comparable EndTurn): 23.0%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 9.9
    Action-kind counts: PlayCard=6716, DiscardHazard=1991, EndTurn=2096, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 7.0
    energy: 1.0
  Loss by cause: (none)
  Loss by act:   (none)

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    100  (100.0%)  95% Wilson: [96.3%, 100.0%]
  Losses:  0
  Capped:  0
  Avg turns survived (all dispositions): 17.2
  Turns survived (won):  median=17.0 p90=21.0
  Turns survived (lost): median=(none) p90=(none)
  Win-rate diff vs baseline (descriptive, not causal): +0.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=100.0%
    act 2/3: reached=100 (100.0%)  win|reached=100.0%
    act 3/3: reached=100 (100.0%)  win|reached=100.0%
  Efficiency:
    Median total actions: 100.0
    Median actions/completed turn: 5.9
    No-progress rate (per comparable EndTurn): 18.1%
    Positive-unused-energy EndTurn rate: 100.0%
    Median unused energy/EndTurn: 8.2
    Action-kind counts: PlayCard=7152, DiscardHazard=1212, EndTurn=1716, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 8.0
    energy: 1.0
  Loss by cause: (none)
  Loss by act:   (none)

World: whiteout-parking-garage  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    75  (75.0%)  95% Wilson: [65.7%, 82.5%]
  Losses:  25
  Capped:  0
  Avg turns survived (all dispositions): 30.0
  Turns survived (won):  median=30.0 p90=38.0
  Turns survived (lost): median=31.0 p90=40.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=75.0%
    act 2/3: reached=100 (100.0%)  win|reached=75.0%
    act 3/3: reached=100 (100.0%)  win|reached=75.0%
  Efficiency:
    Median total actions: 133.0
    Median actions/completed turn: 4.4
    No-progress rate (per comparable EndTurn): 38.1%
    Positive-unused-energy EndTurn rate: 98.3%
    Median unused energy/EndTurn: 8.4
    Action-kind counts: PlayCard=8674, DiscardHazard=1638, EndTurn=2999, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 4.0
    player supply: 8.0
    predicted refill room: 2.0
    runway: 9.0
    energy: 1.0
  Loss by cause: hp=24, noPlayerCards=1
  Loss by act:   act 3/3=25

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    98  (98.0%)  95% Wilson: [93.0%, 99.4%]
  Losses:  2
  Capped:  0
  Avg turns survived (all dispositions): 19.1
  Turns survived (won):  median=19.0 p90=24.0
  Turns survived (lost): median=19.0 p90=27.0
  Win-rate diff vs baseline (descriptive, not causal): +23.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=98.0%
    act 2/3: reached=100 (100.0%)  win|reached=98.0%
    act 3/3: reached=100 (100.0%)  win|reached=98.0%
  Efficiency:
    Median total actions: 100.0
    Median actions/completed turn: 5.3
    No-progress rate (per comparable EndTurn): 21.2%
    Positive-unused-energy EndTurn rate: 99.6%
    Median unused energy/EndTurn: 8.1
    Action-kind counts: PlayCard=6727, DiscardHazard=1334, EndTurn=1905, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 9.0
    player supply: 9.0
    predicted refill room: 3.0
    runway: 8.0
    energy: 1.0
  Loss by cause: hp=2
  Loss by act:   act 3/3=2

World: the-tidal-archive  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    98  (98.0%)  95% Wilson: [93.0%, 99.4%]
  Losses:  0
  Capped:  2
  Avg turns survived (all dispositions): 39.1
  Turns survived (won):  median=35.0 p90=43.0
  Turns survived (lost): median=(none) p90=(none)
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=98.0%
    act 2/3: reached=98 (98.0%)  win|reached=100.0%
    act 3/3: reached=98 (98.0%)  win|reached=100.0%
  Efficiency:
    Median total actions: 171.0
    Median actions/completed turn: 5.0
    No-progress rate (per comparable EndTurn): 50.0%
    Positive-unused-energy EndTurn rate: 98.9%
    Median unused energy/EndTurn: 9.8
    Action-kind counts: PlayCard=13706, DiscardHazard=1577, EndTurn=3906, ChooseBoon=147
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 10.0
    predicted refill room: 2.0
    runway: 13.0
    energy: 1.0
  Loss by cause: (none)
  Loss by act:   (none)

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    91  (91.0%)  95% Wilson: [83.8%, 95.2%]
  Losses:  1
  Capped:  8
  Avg turns survived (all dispositions): 42.7
  Turns survived (won):  median=28.0 p90=34.0
  Turns survived (lost): median=88.0 p90=88.0
  Win-rate diff vs baseline (descriptive, not causal): -7.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=91.0%
    act 2/3: reached=91 (91.0%)  win|reached=100.0%
    act 3/3: reached=91 (91.0%)  win|reached=100.0%
  Efficiency:
    Median total actions: 156.0
    Median actions/completed turn: 5.6
    No-progress rate (per comparable EndTurn): 53.7%
    Positive-unused-energy EndTurn rate: 99.4%
    Median unused energy/EndTurn: 10.3
    Action-kind counts: PlayCard=16932, DiscardHazard=1516, EndTurn=4274, ChooseBoon=277
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 13.0
    energy: 1.0
  Loss by cause: hp=1
  Loss by act:   act 1/3=1

World: the-ember-orchard  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    2  (2.0%)  95% Wilson: [0.6%, 7.0%]
  Losses:  91
  Capped:  7
  Avg turns survived (all dispositions): 24.9
  Turns survived (won):  median=24.0 p90=25.0
  Turns survived (lost): median=17.0 p90=25.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=2.0%
    act 2/3: reached=76 (76.0%)  win|reached=2.6%
    act 3/3: reached=16 (16.0%)  win|reached=12.5%
  Efficiency:
    Median total actions: 90.0
    Median actions/completed turn: 4.6
    No-progress rate (per comparable EndTurn): 63.0%
    Positive-unused-energy EndTurn rate: 99.2%
    Median unused energy/EndTurn: 9.9
    Action-kind counts: PlayCard=10187, DiscardHazard=2797, EndTurn=2489, ChooseBoon=2
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 0.0
    predicted refill room: 2.0
    runway: 15.0
    energy: 1.0
  Loss by cause: hp=1, noPlayerCards=90
  Loss by act:   act 1/3=21, act 2/3=56, act 3/3=14
  [FLAGGED] win-rate 2.0% <= 2.0%
    Dominant cause: noPlayerCards (90/91 losses)
    Dominant act:   act 2/3 (56/91 losses)
    Caveat: a win-rate is a SAMPLE under ONE agent at ONE skill level, not a
    proof of (un)solvability. A near-0% flag means "this agent could not
    survive it", to be confirmed by a future clairvoyant check.

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    2  (2.0%)  95% Wilson: [0.6%, 7.0%]
  Losses:  90
  Capped:  8
  Avg turns survived (all dispositions): 16.2
  Turns survived (won):  median=19.0 p90=20.0
  Turns survived (lost): median=16.0 p90=23.0
  Win-rate diff vs baseline (descriptive, not causal): +0.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=2.0%
    act 2/3: reached=78 (78.0%)  win|reached=2.6%
    act 3/3: reached=16 (16.0%)  win|reached=12.5%
  Efficiency:
    Median total actions: 83.0
    Median actions/completed turn: 4.8
    No-progress rate (per comparable EndTurn): 46.4%
    Positive-unused-energy EndTurn rate: 99.0%
    Median unused energy/EndTurn: 10.5
    Action-kind counts: PlayCard=12718, DiscardHazard=2095, EndTurn=1620, ChooseBoon=17
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 0.0
    predicted refill room: 3.0
    runway: 16.0
    energy: 1.0
  Loss by cause: noPlayerCards=90
  Loss by act:   act 1/3=20, act 2/3=57, act 3/3=13

World: city-of-sleeping-giants  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    82  (82.0%)  95% Wilson: [73.3%, 88.3%]
  Losses:  18
  Capped:  0
  Avg turns survived (all dispositions): 40.5
  Turns survived (won):  median=36.0 p90=51.0
  Turns survived (lost): median=51.0 p90=73.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=82.0%
    act 2/3: reached=99 (99.0%)  win|reached=82.8%
    act 3/3: reached=98 (98.0%)  win|reached=83.7%
  Efficiency:
    Median total actions: 190.0
    Median actions/completed turn: 4.9
    No-progress rate (per comparable EndTurn): 50.1%
    Positive-unused-energy EndTurn rate: 85.5%
    Median unused energy/EndTurn: 4.5
    Action-kind counts: PlayCard=13413, DiscardHazard=2614, EndTurn=4045, ChooseBoon=2
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 9.0
    predicted refill room: 2.0
    runway: 20.0
    energy: 0.0
  Loss by cause: exhausted=1, noPlayerCards=17
  Loss by act:   act 1/3=1, act 2/3=1, act 3/3=16

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    86  (86.0%)  95% Wilson: [77.9%, 91.5%]
  Losses:  13
  Capped:  1
  Avg turns survived (all dispositions): 32.2
  Turns survived (won):  median=29.0 p90=45.0
  Turns survived (lost): median=36.0 p90=61.0
  Win-rate diff vs baseline (descriptive, not causal): +4.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=86.0%
    act 2/3: reached=100 (100.0%)  win|reached=86.0%
    act 3/3: reached=99 (99.0%)  win|reached=86.9%
  Efficiency:
    Median total actions: 173.0
    Median actions/completed turn: 5.9
    No-progress rate (per comparable EndTurn): 45.6%
    Positive-unused-energy EndTurn rate: 94.9%
    Median unused energy/EndTurn: 9.6
    Action-kind counts: PlayCard=14002, DiscardHazard=2048, EndTurn=3217, ChooseBoon=33
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 18.0
    energy: 1.0
  Loss by cause: noPlayerCards=13
  Loss by act:   act 2/3=1, act 3/3=12

World: eden-prime  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    3  (3.0%)  95% Wilson: [1.0%, 8.5%]
  Losses:  79
  Capped:  18
  Avg turns survived (all dispositions): 70.6
  Turns survived (won):  median=21.0 p90=30.0
  Turns survived (lost): median=22.0 p90=84.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=3.0%
    act 2/3: reached=100 (100.0%)  win|reached=3.0%
    act 3/3: reached=26 (26.0%)  win|reached=11.5%
  Efficiency:
    Median total actions: 134.0
    Median actions/completed turn: 4.7
    No-progress rate (per comparable EndTurn): 90.7%
    Positive-unused-energy EndTurn rate: 99.3%
    Median unused energy/EndTurn: 9.6
    Action-kind counts: PlayCard=25083, DiscardHazard=623, EndTurn=7058, ChooseBoon=4
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 9.0
    predicted refill room: 0.0
    runway: 13.0
    energy: 1.0
  Loss by cause: noPlayerCards=79
  Loss by act:   act 2/3=57, act 3/3=22

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    2  (2.0%)  95% Wilson: [0.6%, 7.0%]
  Losses:  80
  Capped:  18
  Avg turns survived (all dispositions): 66.4
  Turns survived (won):  median=15.0 p90=16.0
  Turns survived (lost): median=23.0 p90=106.0
  Win-rate diff vs baseline (descriptive, not causal): -1.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=2.0%
    act 2/3: reached=100 (100.0%)  win|reached=2.0%
    act 3/3: reached=24 (24.0%)  win|reached=8.3%
  Efficiency:
    Median total actions: 179.0
    Median actions/completed turn: 5.2
    No-progress rate (per comparable EndTurn): 90.3%
    Positive-unused-energy EndTurn rate: 99.7%
    Median unused energy/EndTurn: 11.4
    Action-kind counts: PlayCard=27575, DiscardHazard=464, EndTurn=6636, ChooseBoon=51
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 0.0
    runway: 15.0
    energy: 1.0
  Loss by cause: noPlayerCards=80
  Loss by act:   act 2/3=59, act 3/3=21

World: new-derelict  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    86  (86.0%)  95% Wilson: [77.9%, 91.5%]
  Losses:  14
  Capped:  0
  Avg turns survived (all dispositions): 29.5
  Turns survived (won):  median=27.0 p90=35.0
  Turns survived (lost): median=39.0 p90=49.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=86.0%
    act 2/3: reached=100 (100.0%)  win|reached=86.0%
    act 3/3: reached=100 (100.0%)  win|reached=86.0%
  Efficiency:
    Median total actions: 145.0
    Median actions/completed turn: 5.1
    No-progress rate (per comparable EndTurn): 47.0%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 8.7
    Action-kind counts: PlayCard=10215, DiscardHazard=1878, EndTurn=2954, ChooseBoon=11
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 10.0
    player supply: 10.0
    predicted refill room: 2.0
    runway: 9.0
    energy: 1.0
  Loss by cause: exhausted=2, noPlayerCards=12
  Loss by act:   act 3/3=14

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    98  (98.0%)  95% Wilson: [93.0%, 99.4%]
  Losses:  2
  Capped:  0
  Avg turns survived (all dispositions): 21.0
  Turns survived (won):  median=21.0 p90=26.0
  Turns survived (lost): median=32.0 p90=33.0
  Win-rate diff vs baseline (descriptive, not causal): +12.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=98.0%
    act 2/3: reached=100 (100.0%)  win|reached=98.0%
    act 3/3: reached=100 (100.0%)  win|reached=98.0%
  Efficiency:
    Median total actions: 115.0
    Median actions/completed turn: 5.6
    No-progress rate (per comparable EndTurn): 38.0%
    Positive-unused-energy EndTurn rate: 100.0%
    Median unused energy/EndTurn: 9.4
    Action-kind counts: PlayCard=8047, DiscardHazard=1325, EndTurn=2104, ChooseBoon=76
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 10.0
    predicted refill room: 3.0
    runway: 12.0
    energy: 1.0
  Loss by cause: noPlayerCards=2
  Loss by act:   act 3/3=2

World: transit-authority  (3 acts)

  -- Baseline (default starter, no unlocks) --
  Games:   100
  Wins:    30  (30.0%)  95% Wilson: [21.9%, 39.6%]
  Losses:  70
  Capped:  0
  Avg turns survived (all dispositions): 60.7
  Turns survived (won):  median=36.0 p90=46.0
  Turns survived (lost): median=69.0 p90=91.0
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=30.0%
    act 2/3: reached=100 (100.0%)  win|reached=30.0%
    act 3/3: reached=100 (100.0%)  win|reached=30.0%
  Efficiency:
    Median total actions: 296.0
    Median actions/completed turn: 4.8
    No-progress rate (per comparable EndTurn): 58.1%
    Positive-unused-energy EndTurn rate: 99.3%
    Median unused energy/EndTurn: 16.2
    Action-kind counts: PlayCard=18422, DiscardHazard=5252, EndTurn=6067, ChooseBoon=0
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 4.0
    player supply: 0.0
    predicted refill room: 2.0
    runway: 6.0
    energy: 1.0
  Loss by cause: exhausted=3, noPlayerCards=67
  Loss by act:   act 3/3=70

  -- Recovery (unlocks: first-sprint-free, second-explore-push, extra-hp, keyword-bonus) --
  Games:   100
  Wins:    51  (51.0%)  95% Wilson: [41.3%, 60.6%]
  Losses:  49
  Capped:  0
  Avg turns survived (all dispositions): 45.0
  Turns survived (won):  median=28.0 p90=36.0
  Turns survived (lost): median=59.0 p90=86.0
  Win-rate diff vs baseline (descriptive, not causal): +21.0 pp
  Progress funnel:
    act 1/3: reached=100 (100.0%)  win|reached=51.0%
    act 2/3: reached=100 (100.0%)  win|reached=51.0%
    act 3/3: reached=100 (100.0%)  win|reached=51.0%
  Efficiency:
    Median total actions: 199.0
    Median actions/completed turn: 4.8
    No-progress rate (per comparable EndTurn): 55.1%
    Positive-unused-energy EndTurn rate: 99.9%
    Median unused energy/EndTurn: 13.0
    Action-kind counts: PlayCard=13258, DiscardHazard=3770, EndTurn=4495, ChooseBoon=27
  Pressure (median per-run minimum, posthoc ground truth):
    HP: 13.0
    player supply: 4.0
    predicted refill room: 2.0
    runway: 7.0
    energy: 1.0
  Loss by cause: exhausted=1, noPlayerCards=48
  Loss by act:   act 3/3=49

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

## No Change Needed
- zombie-big-box - 1 star
- highway-volcano - 2 star
- bird-building - 2 star
- the-ember-orchard - 5 star
- overgrown-mall - 4 star
- whiteout-parking-garage - 3 star
- the-tidal-archive - 1 star

## Minor Tweaks
- city-of-sleeping-giants - 2 star
  - The player cards feel off

## May Need a Better Lose Condition
- fog-beach-party - 1 star
  - The hazard's aren't threatening enough
  - They have concealment, but no teeth

## May Need a Better Win Condition
- eden-prime - 5 star
  - This might be well balanced, not sure yet.

## Needs Playtesting
- new-derelict - 
- transit-authority - 4 star
