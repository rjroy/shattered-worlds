---
title: Field Guide Index
date: 2026-06-25
status: current
tags: [field-guide, index, reference, shattered-worlds]
---

# Field Guide Index

Reference wiki for durable project knowledge extracted from lore artifacts.

## decision

- [Game Engine Choice: TypeScript Core with Phaser Renderer](game-engine-choice.md) - TypeScript owns rules and Phaser owns rendering so game logic stays testable.
- [Self Describing Card Faces](self-describing-card-faces.md) - Card faces should carry enough rules text to be playable without external lookup.
- [World Access Unlocks](world-access-unlocks.md) - world access is purchased ownership, not an activated run modifier.
- [Sim Completeness Performance Stats Plan](sim-completeness-performance-stats-plan.md) - planned paired-cohort telemetry to explain how the honest sim agent performed, not just whether it won.

## lesson

- [Deckbuilder Design Principles](deckbuilder-design-principles.md) - deck-building decisions must expose agency, synergy, deck thickness, and risk.
- [Effect System Extension Pattern](effect-system-extension-pattern.md) - new effects require union, handler, description, playability, data, tests, and renderer checks.
- [Feat Definition Type Contract](feat-definition-type-contract.md) - feat exported types are the live contract for authored conditions and rewards.
- [Readable Targeting Feedback](player-feedback-readable-targeting.md) - targeting feedback should preview consequences before the player commits.
- [World Launch Checklist Gaps](world-launch-checklist-gaps.md) - music-key reuse and missing unlock gates silently ship a world wrong unless checked explicitly.
- [World Registry Template Reference Walker](world-registry-template-reference-walker.md) - the template-reference conformance walker must cover every hook and gate branch or it silently misses references.
- [Image-Gen Prompt Engineering Gotchas](image-gen-prompt-engineering-gotchas.md) - describing objects as text-bearing hallucinates glyphs; confinement imagery with human figures hits content moderation.

## architecture

- [Action Preview and Confirmation System](action-preview-confirmation-system.md) - pure reducer previews feed hover text and confirmation while masking concealed provenance.
- [Audio Volume Settings](audio-volume-settings.md) - music and SFX volumes are separate persisted settings applied through the runtime.
- [Card Data and World Scoped Templates](card-data-and-world-scoped-templates.md) - world card templates live in authored data and are assembled into catalogs by world.
- [Core Render Split](core-render-split.md) - core game state is renderer-free and Phaser consumes read models and events.
- [Effective Card Modifiers Read Model](effective-card-modifiers-read-model.md) - run modifiers derive effective card snapshots without mutating durable cards.
- [Energy Turn Resource](energy-turn-resource.md) - energy is a per-turn spend resource reset by core turn flow.
- [Feat Evaluation and Memory Fragment Economy](feat-evaluation-memory-fragments.md) - runtime feat evaluation derives Memory Fragment balance from earned feats.
- [Fortune Act Boon Rewards](fortune-act-boon-rewards.md) - Fortune offers one exhaust boon choice after real act advancement.
- [OfferBoon Reward Path](offer-boon-reward-path.md) - generic boon choices share the Fortune reward path for world-clear rewards.
- [Persistent Keyword Cost Modifiers](persistent-keyword-cost-modifiers.md) - world-card clear-cost taxes are declared once per keyword in a global registry, not per template.
- [Rarity and Weighted Reward Pools](rarity-and-weighted-reward-pools.md) - rarity lives on templates and weighted selection reads tiers from legal candidates.
- [Targeting and Selection Grammar](targeting-and-selection-grammar.md) - target specs define the grammar shared by availability, selection UI, and simulation.
- [Shattered Worlds - Theme Authoring Rules](theme-authoring.md) - world themes define visual verbs, palettes, asset keys, and authoring caveats.
- [Unified Card Catalog Plan](unified-card-catalog-plan.md) - card data is unified through catalog assembly instead of scattered constants.
- [Unlock System Runtime Ownership](unlock-system-runtime-ownership.md) - the runtime assembles worlds with purchased and activated unlock state.
- [World Deck Loop](world-deck-loop.md) - the world deck creates pressure through draw, hazard resolution, progress, and refill loops.

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
