---
title: Field Guide Index
date: 2026-07-02
status: current
tags: [field-guide, index, reference, shattered-worlds]
---

# Field Guide Index

Reference wiki for durable project knowledge extracted from lore artifacts.

## decision

- [Destiny Blessing Catalog — Unique Unlocks Under a Weighted Point Budget](destiny-blessing-catalog-design.md) - unique-only unlocks activated within a weighted Destiny budget; starter decks are exclusivity-gated at weight 0, not budget-gated.
- [Game Engine Choice: TypeScript Core with Phaser Renderer](game-engine-choice.md) - TypeScript owns rules and Phaser owns rendering so game logic stays testable.
- [Self Describing Card Faces](self-describing-card-faces.md) - Card faces should carry enough rules text to be playable without external lookup.
- [World Access Unlocks](world-access-unlocks.md) - world access is purchased ownership, not an activated run modifier.
- [Sim Completeness Performance Stats Plan](sim-completeness-performance-stats-plan.md) - implemented paired-cohort telemetry explaining how the honest sim agent performed, not just whether it won.
- [Meta-Progression Approaches Rejected on Purpose](meta-progression-rejected-approaches.md) - banked gold, play-count mastery, prestige resets, and permanent stat tracks were considered and cut; recorded so they aren't re-litigated.
- ["ChronicleScene as the Proto-Destiny Surface"](chronicle-scene-decision.md) - one dedicated stats scene framed as Destiny's memory from day one, built to grow into the meta-progression hub rather than be replaced by it.
- [Story Detail Lives in World-Select; Help Is a Phaser Overlay](story-detail-and-help-screen-decisions.md) - story is a short mood paragraph on the world-select card; help is a 5-tab Phaser overlay because its trigger is mid-run.
- [Core Dispatch Rejects Illegal Actions by Throwing, Never by Event](core-dispatch-illegal-action-contract.md) - illegal actions throw a typed `IllegalActionError` instead of surfacing as a game event.
- [Progress Never Carries Between Turns, and The Walker Is Meant to Be a Wall](progress-no-carryover-and-the-walker-wall.md) - per-turn Progress resets to zero; The Walker is an intentionally unbeatable starter-deck hazard, a meta-progression hook rather than a bug.
- [Run Summary Shows on Every Terminal Outcome; World-Select Badges Are Live Data](run-summary-and-world-select-badges.md) - the summary view now covers abandon-then-recap too, and world-select badges read live stats rather than authored content.

## lesson

- [A Hidden-State Audit Must Follow Two Axes, Not Just RNG Call Sites](rng-audit-two-axes-lesson.md) - a deterministic read of a hidden zone (no rng roll) can still leak; audit rng consumers and hidden-zone readers separately.
- [Aggregating Per-Run Ratios Needs a Deliberate Formula Choice](sim-report-ratio-aggregation-lesson.md) - median-of-per-run-ratio and sum-over-sum both look like "an average rate" but mean different things.
- [Deckbuilder Design Principles](deckbuilder-design-principles.md) - deck-building decisions must expose agency, synergy, deck thickness, and risk.
- [Don't Fake RNG Inside a Pure Reducer — Determinize at the Boundary Instead](pure-reducer-determinization-lesson.md) - skipping or placeholdering a roll inside the reducer is unsound; reshuffle hidden state at the boundary and keep the reducer pure.
- [Effect System Extension Pattern](effect-system-extension-pattern.md) - new effects require union, handler, description, playability, data, tests, and renderer checks.
- [Feat Definition Type Contract](feat-definition-type-contract.md) - feat exported types are the live contract for authored conditions and rewards.
- [Readable Targeting Feedback](player-feedback-readable-targeting.md) - targeting feedback should preview consequences before the player commits.
- [World Launch Checklist Gaps](world-launch-checklist-gaps.md) - music-key reuse and missing unlock gates silently ship a world wrong unless checked explicitly.
- [World Registry Template Reference Walker](world-registry-template-reference-walker.md) - the template-reference conformance walker must cover every hook and gate branch or it silently misses references.
- [Image-Gen Prompt Engineering Gotchas](image-gen-prompt-engineering-gotchas.md) - describing objects as text-bearing hallucinates glyphs; confinement imagery with human figures hits content moderation.
- [A Card's Value Depends on Which World Carries It](cross-world-card-context-value.md) - a hand-thinning reward can be mediocre in its home world and premium once carried into a prune-and-profit world.
- [Generalize an Engine Primitive Only When a Second Customer Needs It](generalize-on-second-customer-lesson.md) - a numeric-valued keyword and a versioned-storage helper both waited for a second concrete consumer before generalizing.
- [World Select Uses Full-Window Paging, Not the Decided Shift-by-One Carousel](world-select-carousel-paging.md) - the shipped carousel implements the exact page-flip-by-3 shape a 2026-06-11 brainstorm explicitly rejected; undocumented decision drift.
- ["localStorage Durability Risk and the Migrate-Don't-Discard Policy"](save-durability-and-migration-lesson.md) - client storage can be silently evicted; export/import is the adopted backstop and schema bumps must migrate, never discard.
- [Choosing Where Text-Heavy Content Lives in a Fixed Phaser Canvas](phaser-text-heavy-overlay-tradeoffs-lesson.md) - the right container for full-screen text depends on when it's read, not what it contains; mid-run triggers favor staying in-canvas.

## architecture

- [Action Preview and Confirmation System](action-preview-confirmation-system.md) - pure reducer previews feed hover text and confirmation while masking concealed provenance.
- [Audio Volume Settings](audio-volume-settings.md) - music and SFX volumes are separate persisted settings applied through the runtime.
- [Card Data and World Scoped Templates](card-data-and-world-scoped-templates.md) - card templates are unified in one `allCards.json` catalog; per-world JSON now carries only `worldId` and deck composition.
- [Core Render Split](core-render-split.md) - core game state is renderer-free and Phaser consumes read models and events.
- [Effective Card Modifiers Read Model](effective-card-modifiers-read-model.md) - run modifiers derive effective card snapshots without mutating durable cards.
- [Energy Turn Resource](energy-turn-resource.md) - energy is a per-turn spend resource reset by core turn flow.
- [Feat Evaluation and Memory Fragment Economy](feat-evaluation-memory-fragments.md) - runtime feat evaluation derives Memory Fragment balance from earned feats.
- [Fortune Act Boon Rewards](fortune-act-boon-rewards.md) - Fortune offers one exhaust boon choice after real act advancement.
- [Observability Boundary — One Hidden-State Model, Two Consumers](observability-boundary-shared-model.md) - preview masks hidden state to "unknown", the sim agent determinizes it into a plausible sample; both derive from one `hiddenZones` model.
- [OfferBoon Reward Path](offer-boon-reward-path.md) - generic boon choices share the Fortune reward path for world-clear rewards.
- [Persistent Keyword Cost Modifiers](persistent-keyword-cost-modifiers.md) - world-card clear-cost taxes are declared once per keyword in a global registry, not per template.
- [Randomness/Hidden-Reveal Event Stamps (randomized, revealedFromHidden)](event-randomness-hidden-reveal-stamps.md) - `GameEvent` stamps at the emit site so the preview can mask any stochastic or hidden-zone-reading event by one rule instead of per-effect pattern matching.
- [Rarity and Weighted Reward Pools](rarity-and-weighted-reward-pools.md) - rarity lives on templates and weighted selection reads tiers from legal candidates.
- [Shared EvalAxes Measurement Between Agent Scoring and Telemetry](sim-eval-axes-shared-measurement.md) - one pure axis-measurement function feeds both agent scoring and posthoc telemetry so formulas can't drift apart.
- [Sim playOut Per-Run Agent Performance Telemetry](sim-agent-performance-telemetry.md) - per-run action, energy, no-progress, and posthoc pressure telemetry captured during headless play-outs.
- [Sim Statistics Helpers (src/sim/statistics.ts)](sim-statistics-helpers.md) - the project's first reusable percentile/Wilson-interval module; display-only, never gates the completeness flag.
- [Targeting and Selection Grammar](targeting-and-selection-grammar.md) - target specs define the grammar shared by availability, selection UI, and simulation.
- [Shattered Worlds - Theme Authoring Rules](theme-authoring.md) - world themes define visual verbs, palettes, asset keys, and authoring caveats.
- [Unified Card Catalog Plan](unified-card-catalog-plan.md) - card data is unified through catalog assembly instead of scattered constants.
- [Unlock System Runtime Ownership](unlock-system-runtime-ownership.md) - the runtime assembles worlds with purchased and activated unlock state.
- [World Deck Loop](world-deck-loop.md) - the world deck creates pressure through draw, hazard resolution, progress, and refill loops.
- [Witness Knowledge — Per-Threat History Feeding Feats, Not Player-Facing Reveals](witness-knowledge-system.md) - per-threat encounter/resolve/death tallies feed feat conditions; the sketched player-facing reveal UI never shipped.
- [Run Stats Persistence Architecture](run-stats-persistence-architecture.md) - versioned lifetime stats, a run-history ring buffer, active-duration tracking, and export/import all hang off `RunEnded`.
- [Full-Screen Overlay Input Blocking via Phaser's topOnly Default](full-screen-overlay-input-blocking-pattern.md) - a shared depth-1000 plus interactive background-rect convention blocks input to whatever sits underneath a full-canvas overlay.
- [Gameplay Event Stream — Run Lifecycle Envelopes and the Multi-Consumer Boundary](gameplay-event-stream-architecture.md) - `RunStarted`/`GameplayBatch`/`RunEnded` envelopes and the fixed subscriber order (runStats -> witnessStore -> featEvaluator) that keeps the composition root correct.
- [WorldSelectScene Replaces BootScene's Random World Assignment](world-select-scene-and-display-manifest.md) - a dedicated scene and `worldDisplayManifest` replace hand-picking a random world at boot.
- [RunRecord's finalHp/finalResources/healingReceived Fields and Their Source Events](extended-run-telemetry-fields.md) - `HealReceived` and `HazardAdded` events feed extended per-run telemetry beyond the original stats plan.
- [RunModifiers — the Four Engine Hooks Unlocks Actually Touch](run-modifiers-engine-hooks.md) - hand size, energy floor, light decay, and progress-per-keyword are the only core-engine seams unlock modifiers reach.
- [Numeric Keywords And Keyword-Scaled Effects](numeric-keywords-and-scaled-effects.md) - the `KeywordName`/`Keyword` type split and `CounterSpec.KeywordInHand` scaling primitive shared by Fog's Whiteout and Mall's Bloom.
- [Oversized Hand Row Windowing](oversized-hand-layout.md) - fixed-size row windowing with independent per-row offsets keeps an overflowing hand navigable without resizing cards.
- [Sim Per-World Completeness Checker](sim-completeness-checker.md) - the foundational honest-agent, min-of-margins evaluation architecture that later performance-stats work builds on.

## concept

- [City of Sleeping Giants World](city-of-sleeping-giants-world.md) - stir-themed world pressure uses recurrence and body-movement hazards.
- [Destiny Progression](destiny-progression.md) - meta-progression spends Memory Fragments on Blessings and world access.
- [Ember Orchard World](ember-orchard-world.md) - incubate-themed world pressure grants utility that plants future hazards.
- [Fog Beach Party World](fog-beach-party-world.md) - beach-party pressure blends light, discard, and escalating fog hazards.
- [New Derelict World](new-derelict-world.md) - isolate-themed world pressure seals hand cards with the first persistent (non-decaying) keyword, Lockdown.
- [Overgrown Mall World](overgrown-mall-world.md) - mall pressure uses spores, commerce fiction, and clogged choices.
- [Shattered Worlds - Vision](vision.md) - the game is a surreal deckbuilder about surviving invasive worlds.
- [Shattered Worlds - Visual Direction](visual-direction.md) - visual style favors readable surrealism and world-specific intrusion palettes.
- [Tidal Archive World](tidal-archive-world.md) - displace-themed world pressure makes discard and deck order part of play.
- [Transit Authority World](transit-authority-world.md) - reroute-themed world pressure force-tops both decks and taxes cost with a transient Reroute keyword.
- [Whiteout Parking Garage World](whiteout-parking-garage-world.md) - cold-survival world pressure revolves around heat, frozen cards, and thawing.
- [Place and Disaster Must Argue With Each Other](place-disaster-contrast-theme-rule.md) - a world's fiction should pair a place with a disaster that argues with it, not one that agrees; the free filter for pitching new worlds.
- [Keyword Density Bias Differentiates the Shared Starter Deck for Free](keyword-bias-differentiation.md) - biasing which keyword a world's hazards carry changes which shared starter card is the correct answer there, at zero code cost.
- [Per-World Intensity Weights Remain an Open Idea, Not Yet Built](per-world-intensity-weights-open-idea.md) - twice-proposed, still-global juice weights; a recorded open idea rather than a decision.
- [Unlock Design Pattern — Ask a New Question](unlock-design-pattern-new-questions.md) - a good unlock should ask the player a new question during the run, not just make an old answer bigger; six Slay-the-Spire-derived categories sketched for future Blessings.
- ["The Endworlds Trilogy (Worlds 13-15): Destination or Denial"](endworlds-trilogy-concept.md) - unimplemented narrative concept reframing the Walker's journey as fleeing grief, resolved by a Refusal/Acknowledgment split ending.
- [Eden Prime World](eden-prime-world.md) - startle-themed world pressure introduces Alarm; the first world to require a reusable core-engine keyword-application slice.
