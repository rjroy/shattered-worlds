---
title: Run Summary Shows on Every Terminal Outcome; World-Select Badges Are Live Data
date: 2026-07-02
status: current
tags: [run-summary, world-select, badges, stats-ui, decision]
fg-type: decision
fg-sources: [.lore/work/specs/stats-persistence-and-player-views.html]
fg-status: current
fg-evidence:
  code:
    - src/game/view/RunSummaryView.ts
    - src/game/scenes/TableScene.ts
    - src/game/view/worldBadge.ts
    - src/game/scenes/WorldSelectScene.ts
  tests:
    - src/game/tests/statsViews.test.ts
---

# Run Summary Shows on Every Terminal Outcome; World-Select Badges Are Live Data

Before this decision, the in-game exit (`X`) button in `TableScene` jumped straight back to `WorldSelectScene`, bypassing any end-of-run surface. `RunSummaryView` now shows for **all three** outcomes — won, lost, and the player-initiated exit — because the exit button's behavior changed: it abandons the run and shows the abandon summary before returning to World Select. A tab-close abandon (`pagehide`) still shows nothing (no UI is possible at that point) and is visible only later, in the Chronicle.

The summary shows: outcome, world name, turns, active duration, cards played, progress dealt, damage taken, hazards resolved, hazards discarded, cards discarded, plus the overall run number ("Run N", well-defined from the first run) and the win count on that world once it is at least 1. If the run just set or beat a per-world best, the summary calls the new record out explicitly — the payoff for [[chronicle-scene-decision]]'s persisted-bests design.

`RunSummaryView` reads exclusively through `RunStatsReader` (`lifetime().lastRun` plus lifetime/per-world fields) — it never writes stats and never scrapes renderer state. This is viable because `RunEnded` fires synchronously inside `dispatch`, so `lastRun` is already current by the time the overlay renders. The overlay reuses the same conventions as the help screen (centered container at overlay depth, full-canvas input-swallowing background, hidden by default, `?` button hidden while shown — see [[story-detail-and-help-screen-decisions]]) rather than inventing a second overlay pattern. Dismissing always returns to `WorldSelectScene`.

## World-Select Badges

Each world card on the World Select carousel shows that world's wins/attempts (e.g. `"2 / 7"`) sourced live from `RunStatsReader.lifetime().byWorld` — `worldBadgeLabel` (`src/game/view/worldBadge.ts`) returns `null` for a world with zero recorded runs, so unplayed worlds show no badge. This is deliberately decoupled from `worldDisplayManifest` (the authored name/tagline/story text): badges are live play data, never authored copy, so badge logic has no reason to import the display manifest.

Badges target whatever card layout World Select actually uses at the time (the carousel, per [[world-select-carousel-paging]]) and must be either fully legible or omitted — never half-readable — on any partially-visible peek card; when in doubt the rule defaults to omitting the badge on a peek card rather than rendering it dim.
