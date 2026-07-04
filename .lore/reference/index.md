---
title: Field Guide Index
date: 2026-07-03
status: current
tags: [field-guide, index, reference, shattered-worlds]
---

# Field Guide Index

Reference wiki for durable project knowledge extracted from lore artifacts.

## Layout

Pages live under `<category>/` or `<category>/<subcategory>/`. Stratification policy: a directory that grows past ~12 pages is split into 3-4 groups; the tree adjusts over time toward 6-7 top-level categories. Every page must be listed here — lint discovers pages only through this index.

## direction

Vision, design principles, and project-wide art direction.

- [Shattered Worlds - Vision](direction/vision.md) - the game is a surreal deckbuilder about surviving invasive worlds.
- [Deckbuilder Design Principles](direction/deckbuilder-design-principles.md) - deck-building decisions must expose agency, synergy, deck thickness, and risk.
- [Game Engine Choice: TypeScript Core with Phaser Renderer](direction/game-engine-choice.md) - TypeScript owns rules and Phaser owns rendering so game logic stays testable.
- [Shattered Worlds - Visual Direction](direction/visual-direction.md) - visual style favors readable surrealism and world-specific intrusion palettes.
- [Unlock Art Style](direction/unlock-art-style.md) - world unlocks read as opened places, starter unlocks as memory dossiers, general unlocks as gold-lit relics; all inside the ink-and-ash project look.
- [Image-Gen Prompt Engineering Gotchas](direction/image-gen-prompt-engineering-gotchas.md) - describing objects as text-bearing hallucinates glyphs; confinement imagery with human figures hits content moderation.

## engine

The pure, deterministic core rules engine.

### contracts

- [Core Render Split](engine/contracts/core-render-split.md) - core game state is renderer-free and Phaser consumes read models and events.
- [Core Dispatch Rejects Illegal Actions by Throwing, Never by Event](engine/contracts/core-dispatch-illegal-action-contract.md) - illegal actions throw a typed `IllegalActionError` instead of surfacing as a game event.
- [Targeting and Selection Grammar](engine/contracts/targeting-and-selection-grammar.md) - target specs define the grammar shared by availability, selection UI, and simulation.
- [Generalize an Engine Primitive Only When a Second Customer Needs It](engine/contracts/generalize-on-second-customer-lesson.md) - a numeric-valued keyword and a versioned-storage helper both waited for a second concrete consumer before generalizing.

### effects-and-keywords

- [Effect System Extension Pattern](engine/effects-and-keywords/effect-system-extension-pattern.md) - new effects require union, handler, description, playability, data, tests, and renderer checks.
- [Numeric Keywords And Keyword-Scaled Effects](engine/effects-and-keywords/numeric-keywords-and-scaled-effects.md) - the `KeywordName`/`Keyword` type split and `CounterSpec.KeywordInHand` scaling primitive shared by Fog's Whiteout and Mall's Bloom.
- [Persistent Keyword Cost Modifiers](engine/effects-and-keywords/persistent-keyword-cost-modifiers.md) - world-card clear-cost taxes are declared once per keyword in a global registry, not per template.
- [RunModifiers — the Engine Hooks Unlocks Actually Touch](engine/effects-and-keywords/run-modifiers-engine-hooks.md) - one assembled modifier bag feeds starting stats, hand growth, resource floors, reward rarity, keyword progress, act boons, and effective player cards without exposing the unlock catalog to core.
- [Effective Card Modifiers Read Model](engine/effects-and-keywords/effective-card-modifiers-read-model.md) - run modifiers derive effective card snapshots without mutating durable cards.

### randomness-and-hidden-state

- [Randomness/Hidden-Reveal Event Stamps (randomized, revealedFromHidden)](engine/randomness-and-hidden-state/event-randomness-hidden-reveal-stamps.md) - `GameEvent` stamps at the emit site so the preview can mask any stochastic or hidden-zone-reading event by one rule instead of per-effect pattern matching.
- [Observability Boundary — One Hidden-State Model, Two Consumers](engine/randomness-and-hidden-state/observability-boundary-shared-model.md) - preview masks hidden state to "unknown", the sim agent determinizes it into a plausible sample; both derive from one `hiddenZones` model.
- [Don't Fake RNG Inside a Pure Reducer — Determinize at the Boundary Instead](engine/randomness-and-hidden-state/pure-reducer-determinization-lesson.md) - skipping or placeholdering a roll inside the reducer is unsound; reshuffle hidden state at the boundary and keep the reducer pure.
- [A Hidden-State Audit Must Follow Two Axes, Not Just RNG Call Sites](engine/randomness-and-hidden-state/rng-audit-two-axes-lesson.md) - a deterministic read of a hidden zone (no rng roll) can still leak; audit rng consumers and hidden-zone readers separately.

### turn-loop

- [World Deck Loop](engine/turn-loop/world-deck-loop.md) - the world deck creates pressure through draw, hazard resolution, progress, and refill loops.
- [Energy Turn Resource](engine/turn-loop/energy-turn-resource.md) - energy is a per-turn spend resource reset by core turn flow.
- [Progress Never Carries Between Turns, and The Walker Is Meant to Be a Wall](engine/turn-loop/progress-no-carryover-and-the-walker-wall.md) - per-turn Progress resets to zero; The Walker is an intentionally unbeatable starter-deck hazard, a meta-progression hook rather than a bug.

## worlds

World concepts, world-design rules, and the authoring/shipping pipeline.

### catalog

- [Tidal Archive World](worlds/catalog/tidal-archive-world.md) - displace-themed world pressure makes discard and deck order part of play.
- [Overgrown Mall World](worlds/catalog/overgrown-mall-world.md) - mall pressure uses spores, commerce fiction, and clogged choices.
- [Fog Beach Party World](worlds/catalog/fog-beach-party-world.md) - beach-party pressure blends light, discard, and escalating fog hazards.
- [Whiteout Parking Garage World](worlds/catalog/whiteout-parking-garage-world.md) - cold-survival world pressure revolves around heat, frozen cards, and thawing.
- [Ember Orchard World](worlds/catalog/ember-orchard-world.md) - incubate-themed world pressure grants utility that plants future hazards.
- [City of Sleeping Giants World](worlds/catalog/city-of-sleeping-giants-world.md) - stir-themed world pressure uses recurrence and body-movement hazards.
- [Eden Prime World](worlds/catalog/eden-prime-world.md) - startle-themed world pressure introduces Alarm; the first world to require a reusable core-engine keyword-application slice.
- [New Derelict World](worlds/catalog/new-derelict-world.md) - isolate-themed world pressure seals hand cards with the first persistent (non-decaying) keyword, Lockdown.
- [Transit Authority World](worlds/catalog/transit-authority-world.md) - reroute-themed world pressure force-tops both decks and taxes cost with a transient Reroute keyword.
- ["The Endworlds Trilogy (Worlds 13-15): Destination or Denial"](worlds/catalog/endworlds-trilogy-concept.md) - ratified narrative concept reframing the Walker's journey as fleeing grief, staged as Denial/Anger, Bargaining/Depression, and Acceptance across Worlds 13-15, with a single convergent ending.

### design

- [Place and Disaster Must Argue With Each Other](worlds/design/place-disaster-contrast-theme-rule.md) - a world's fiction should pair a place with a disaster that argues with it, not one that agrees; the free filter for pitching new worlds.
- [Keyword Density Bias Differentiates the Shared Starter Deck for Free](worlds/design/keyword-bias-differentiation.md) - biasing which keyword a world's hazards carry changes which shared starter card is the correct answer there, at zero code cost.
- [Per-World Intensity Weights Remain an Open Idea, Not Yet Built](worlds/design/per-world-intensity-weights-open-idea.md) - twice-proposed, still-global juice weights; a recorded open idea rather than a decision.

### authoring

- [Shattered Worlds - Theme Authoring Rules](worlds/authoring/theme-authoring.md) - world themes define visual verbs, palettes, asset keys, and authoring caveats.
- [World Launch Checklist Gaps](worlds/authoring/world-launch-checklist-gaps.md) - music-key reuse and missing unlock gates silently ship a world wrong unless checked explicitly.
- [World Registry Template Reference Walker](worlds/authoring/world-registry-template-reference-walker.md) - the template-reference conformance walker must cover every hook and gate branch or it silently misses references.

## progression

Meta-progression design and the runtime that persists it.

### destiny-and-unlocks

- [Destiny Progression](progression/destiny-and-unlocks/destiny-progression.md) - meta-progression spends Memory Fragments on Blessings and world access.
- [Destiny Blessing Catalog — Unique Unlocks Under a Weighted Point Budget](progression/destiny-and-unlocks/destiny-blessing-catalog-design.md) - unique-only unlocks activated within a weighted Destiny budget; starter decks are exclusivity-gated at weight 0, not budget-gated.
- [Meta-Progression Approaches Rejected on Purpose](progression/destiny-and-unlocks/meta-progression-rejected-approaches.md) - banked gold, play-count mastery, prestige resets, and permanent stat tracks were considered and cut; recorded so they aren't re-litigated.
- [Unlock Design Pattern — Ask a New Question](progression/destiny-and-unlocks/unlock-design-pattern-new-questions.md) - a good unlock should ask the player a new question during the run, not just make an old answer bigger; six Slay-the-Spire-derived categories sketched for future Blessings.
- [Unlock System Runtime Ownership](progression/destiny-and-unlocks/unlock-system-runtime-ownership.md) - the runtime assembles worlds with purchased and activated unlock state.
- [World Access Unlocks](progression/destiny-and-unlocks/world-access-unlocks.md) - world access is purchased ownership, not an activated run modifier.

### feats-and-witness

- [Feat Definition Type Contract](progression/feats-and-witness/feat-definition-type-contract.md) - feat exported types are the live contract for authored conditions and rewards.
- [Feat Evaluation and Memory Fragment Economy](progression/feats-and-witness/feat-evaluation-memory-fragments.md) - runtime feat evaluation derives Memory Fragment balance from earned feats.
- [Witness Knowledge — Per-Threat History Feeding Feats, Not Player-Facing Reveals](progression/feats-and-witness/witness-knowledge-system.md) - per-threat encounter/resolve/death tallies feed feat conditions; the sketched player-facing reveal UI never shipped.

### stats-and-chronicle

- [Gameplay Event Stream — Run Lifecycle Envelopes and the Multi-Consumer Boundary](progression/stats-and-chronicle/gameplay-event-stream-architecture.md) - `RunStarted`/`GameplayBatch`/`RunEnded` envelopes and the fixed subscriber order (runStats -> witnessStore -> featEvaluator) that keeps the composition root correct.
- [Run Stats Persistence Architecture](progression/stats-and-chronicle/run-stats-persistence-architecture.md) - versioned lifetime stats, a run-history ring buffer, active-duration tracking, and export/import all hang off `RunEnded`.
- [RunRecord's finalHp/finalResources/healingReceived Fields and Their Source Events](progression/stats-and-chronicle/extended-run-telemetry-fields.md) - `HealReceived` and `HazardAdded` events feed extended per-run telemetry beyond the original stats plan.
- ["localStorage Durability Risk and the Migrate-Don't-Discard Policy"](progression/stats-and-chronicle/save-durability-and-migration-lesson.md) - client storage can be silently evicted; export/import is the adopted backstop and schema bumps must migrate, never discard.
- ["ChronicleScene as the Proto-Destiny Surface"](progression/stats-and-chronicle/chronicle-scene-decision.md) - one dedicated stats scene framed as Destiny's memory from day one, built to grow into the meta-progression hub rather than be replaced by it.

## cards

Authored card content, catalogs, and the reward economy.

- [Card Data and World Scoped Templates](cards/card-data-and-world-scoped-templates.md) - card templates are unified in one `allCards.json` catalog; per-world JSON now carries only `worldId` and deck composition.
- [Unified Card Catalog Plan](cards/unified-card-catalog-plan.md) - card data is unified through catalog assembly instead of scattered constants.
- [Self Describing Card Faces](cards/self-describing-card-faces.md) - Card faces should carry enough rules text to be playable without external lookup.
- [Rarity and Weighted Reward Pools](cards/rarity-and-weighted-reward-pools.md) - rarity lives on templates and weighted selection reads tiers from legal candidates.
- [Fortune Act Boon Rewards](cards/fortune-act-boon-rewards.md) - Fortune offers one exhaust boon choice after real act advancement.
- [OfferBoon Reward Path](cards/offer-boon-reward-path.md) - generic boon choices share the Fortune reward path for world-clear rewards.
- [A Card's Value Depends on Which World Carries It](cards/cross-world-card-context-value.md) - a hand-thinning reward can be mediocre in its home world and premium once carried into a prune-and-profit world.

## client

The Phaser renderer: scenes, UI patterns, and player feedback.

- [Action Preview and Confirmation System](client/action-preview-confirmation-system.md) - pure reducer previews feed hover text and confirmation while masking concealed provenance.
- [Readable Targeting Feedback](client/player-feedback-readable-targeting.md) - targeting feedback should preview consequences before the player commits.
- [Oversized Hand Row Windowing](client/oversized-hand-layout.md) - fixed-size row windowing with independent per-row offsets keeps an overflowing hand navigable without resizing cards.
- [Full-Screen Overlay Input Blocking via Phaser's topOnly Default](client/full-screen-overlay-input-blocking-pattern.md) - a shared depth-1000 plus interactive background-rect convention blocks input to whatever sits underneath a full-canvas overlay.
- [Choosing Where Text-Heavy Content Lives in a Fixed Phaser Canvas](client/phaser-text-heavy-overlay-tradeoffs-lesson.md) - the right container for full-screen text depends on when it's read, not what it contains; mid-run triggers favor staying in-canvas.
- [Story Detail Lives in World-Select; Help Is a Phaser Overlay](client/story-detail-and-help-screen-decisions.md) - story is a short mood paragraph on the world-select card; help is a 5-tab Phaser overlay because its trigger is mid-run.
- [WorldSelectScene Replaces BootScene's Random World Assignment](client/world-select-scene-and-display-manifest.md) - a dedicated scene and `worldDisplayManifest` replace hand-picking a random world at boot.
- [World Select Uses Full-Window Paging, Not the Decided Shift-by-One Carousel](client/world-select-carousel-paging.md) - the shipped carousel implements the exact page-flip-by-3 shape a 2026-06-11 brainstorm explicitly rejected; undocumented decision drift.
- [Run Summary Shows on Every Terminal Outcome; World-Select Badges Are Live Data](client/run-summary-and-world-select-badges.md) - the summary view now covers abandon-then-recap too, and world-select badges read live stats rather than authored content.
- [Audio Volume Settings](client/audio-volume-settings.md) - music and SFX volumes are separate persisted settings applied through the runtime.

## sim

Headless simulation, completeness checking, and balance telemetry.

- [Sim Per-World Completeness Checker](sim/sim-completeness-checker.md) - the foundational honest-agent, min-of-margins evaluation architecture that later performance-stats work builds on.
- [Sim Completeness Performance Stats Plan](sim/sim-completeness-performance-stats-plan.md) - implemented paired-cohort telemetry explaining how the honest sim agent performed, not just whether it won.
- [Sim playOut Per-Run Agent Performance Telemetry](sim/sim-agent-performance-telemetry.md) - per-run action, energy, no-progress, and posthoc pressure telemetry captured during headless play-outs.
- [Shared EvalAxes Measurement Between Agent Scoring and Telemetry](sim/sim-eval-axes-shared-measurement.md) - one pure axis-measurement function feeds both agent scoring and posthoc telemetry so formulas can't drift apart.
- [Aggregating Per-Run Ratios Needs a Deliberate Formula Choice](sim/sim-report-ratio-aggregation-lesson.md) - median-of-per-run-ratio and sum-over-sum both look like "an average rate" but mean different things.
- [Sim Statistics Helpers (src/sim/statistics.ts)](sim/sim-statistics-helpers.md) - the project's first reusable percentile/Wilson-interval module; display-only, never gates the completeness flag.
