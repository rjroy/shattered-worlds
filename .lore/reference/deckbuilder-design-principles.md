# Deckbuilder Design Principles

<!--
date: 2026-06-15
status: current
tags: deckbuilder, design-principles, agency, randomness, synergy, balance, ui
fg-type: lesson
fg-sources: .lore/work/research/deckbuilding-game-design.html
fg-status: current
fg-evidence:
  code:
    - src/core/engine/weightedDraw.ts
    - src/core/effects/boonChoice.ts
    - src/core/view/actionPreview.ts
    - src/data/boonPools.json
  tests:
    - src/core/tests/weightedDraw.test.ts
    - src/core/tests/effects.test.ts
    - src/core/tests/actionPreview.test.ts
  symbols:
    - OfferBoon
    - GainRandomCard
    - previewAction
-->

Shattered Worlds treats deck-building as the primary game, not as a reward wrapper around combat. A good card offer changes a decision: it asks the player to weigh power, deck thickness, timing, synergy, and future risk. Auto-picks, obvious skips, and bloat are design failures even when the card looks exciting.

## Load-Bearing Lessons

**Randomness must be owned by the player.** Random card offers and world order create variety, but bad outcomes should be traceable to choices the player made: what they drafted, what they kept, what they discarded, and when they took risks.

**Synergy needs mechanical rewards.** Players do not reliably pursue combos just because they are cute. Archetypes need visible set-ups and payoffs, so the player can name the plan and see why one card makes another better.

**Thinning and dead weight matter.** Removing cards, accepting junk, or carrying hazardous clutter must be part of the core tension. The world deck system leans on this: hazards clog the hand, rewards alter the player deck, and some worlds intentionally pollute the deck.

**UI is design, not polish.** A card game lives in text, targeting, previews, and timing reads. If a player cannot tell what a card will do before committing, the decision is not actually available to them.

**Balance answers to play and data.** Single-player design can privilege fun over symmetry, but tuning still needs instrumentation and repeated playtests rather than intuition alone.
