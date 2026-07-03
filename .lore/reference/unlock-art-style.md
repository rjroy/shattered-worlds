---
title: Unlock art style
date: 2026-06-25
status: draft
tags: [unlocks, art-direction, icons, starter-decks, worlds]
modules: [unlocks, game-assets]
related: [.lore/reference/visual-direction.html, .lore/work/design/unlock-catalog.md]
fg-evidence:
  code:
    - src/data/unlocks/catalog.json
    - src/game/assets/unlocks
  symbols:
    - UnlockDefinition
---

# Unlock art style

## Decision

Unlock icons use three related but distinct visual languages:

1. **World unlocks** are environmental access icons: a sealed object or portal in the world itself. They should feel like a new place has opened.
2. **Starter unlocks** are memory dossier icons: a retrieved identity, habit, or role crystallized into a deck. They should feel like gaining access to a remembered way of surviving, not like opening a location.
3. **General unlocks** are relic icons: close-up objects, body cues, or symbolic tools charged with gold light. They should feel like small permanent advantages pulled out of memory.

All three stay inside the project-wide look from `.lore/reference/visual-direction.html`: ink-and-ash linework, distressed surfaces, desaturated dark material, and scarce saturated glow used as intrusion, memory, or access energy.

## Current asset read

The unlock catalog lives at `src/data/unlocks/catalog.json`. Existing unlock art lives at `src/game/assets/unlocks/`, 256x256 WebP.

Existing image coverage:

| Unlock class | Current assets | Current read |
| --- | --- | --- |
| World unlocks | `world-fog-beach-party`, `world-whiteout-parking-garage`, `world-the-tidal-archive`, `world-the-ember-orchard`, `world-city-of-sleeping-giants`, plus `bird-building` | A lock, seal, or portal object placed in an environment. More pictorial and scene-like than the other icons. Rounded icon corners on several assets. |
| Starter deck unlocks | `starter-contractor`, `starter-footballer` | Currently close to general relic art: boots/tools/role objects on a dark background with gold motion. They work, but do not yet distinguish "new starter memory" strongly enough. |
| General unlocks | `extra-*`, `min-*`, `keyword-bonus`, `hand-size-per-act`, `act-reward`, `first-sprint-free`, `panic-response`, `second-explore-push`, `strong-barricades` | Close-up relic or gesture, almost no environment, black-violet background, sharp gold rim light, sparks, scratches, and occult geometry. |

Known missing icons from the current catalog:

| Unlock id | Name | Recommended class |
| --- | --- | --- |
| `rarity-bonus` | Born Lucky | General relic |
| `other-sprint-free` | Run in Terror | General relic |
| `starter-harvester` | Harvester of the Ember Orchard | Starter memory dossier |
| `starter-archivist` | Tidal Archivist | Starter memory dossier |
| `starter-surveyor` | Giant Surveyor | Starter memory dossier |

Naming note: `bird-building` is mechanically a world unlock even though it does not use the `world-*` filename prefix. Art direction should follow the effect type, not only the filename.

## Shared production rules

Every unlock icon should pass these checks:

- **Format:** square 256x256 WebP, readable at 48x48, no text, no UI badge baked into the image.
- **Rendering:** painterly graphic novel, high-contrast ink, scraped texture, smoky grain, distressed metal/paper/leather, no clean vector flatness.
- **Lighting:** one dominant focal glow. Gold is the shared unlock/access color; world-specific hues are secondary accents.
- **Composition:** centered readable silhouette, strong value contrast, no important detail at the outer 8 percent of the image.
- **Palette:** dark charcoal, tarnished brass, dirty umber, slate, bruised violet-black. Saturated color is reserved for the focal energy or world-specific intrusion.
- **Camera:** dramatic close icon framing for general and starter unlocks; small environmental scene framing for world unlocks.
- **Texture:** surfaces should feel touched, salvaged, or remembered: scratched lock plates, bent cards, worn boots, marked maps, ash, salt, frost, soot.
- **Continuity:** occult cartography can appear as faint gold rings, compass marks, sigils, alignment lines, or card geometry, but it should support the focal object rather than become decorative noise.

Avoid:

- Clean mobile-game reward icons with glossy gem polish.
- Neon everywhere.
- Full character portraits.
- Literal card fan plus text labels for every starter deck.
- Generic fantasy runes that do not connect to doors, memory, maps, locks, cards, or survival tools.
- AI smear where the focal object cannot be identified at small size.

## World unlock style: access seals in place

World unlocks should answer: **what door into this world just opened?**

They are the most environmental of the unlock icons. The viewer should feel a threshold to a place: beach fog, parking-garage snow, flooded archive, ember orchard, giant city, office building. The lock/portal/seal is not an abstract reward token floating in space; it belongs to the world and inherits its atmosphere.

Composition rules:

- Use a locked gate, hanging padlock, sealed door, portal, arch, hatch, or suspended access relic as the foreground anchor.
- Include enough background to identify the world, even at thumbnail size.
- Keep the access glow gold-violet or gold-white, with the world hue bleeding around it.
- Rounded app-icon corners are acceptable and currently help separate world icons from relic icons.
- The object should feel newly openable, not already conquered. Avoid triumphant landscapes with no lock, no seal, and no threshold.

World-specific hooks:

| Unlock id | Hook |
| --- | --- |
| `world-fog-beach-party` | Salt fog, beach clutter, party remnants, lifeguard/beach-access lock, wet lantern glow. |
| `bird-building` | Office interior or city high-rise, industrial lock, bird silhouettes, stale fluorescent light. |
| `world-whiteout-parking-garage` | Concrete garage, snow drift, icy lock, sodium-vapor light, tire lines vanishing into white. |
| `world-the-tidal-archive` | Flooded archive stacks, submerged threshold, barnacled brass seal, teal water glow. |
| `world-the-ember-orchard` | Charred orchard, ember fruit light, black soil, heat shimmer, red-orange intrusion behind the seal. |
| `world-city-of-sleeping-giants` | Monumental sleeping stone/giant shapes, city scale, huge lock or keyhole dwarfed by environment. |

## Starter unlock style: memory dossiers

Starter unlocks should answer: **what remembered identity did the player recover?**

These are not worlds and not generic stat relics. A starter deck changes the player's opening hand and role, so the icon should feel like a sealed memory file being granted: a compact arrangement of role objects, a few ghosted cards, and a gold memory aperture. The core metaphor is **"access to a practiced way of surviving."**

Use this visual grammar for all `starter-*` icons:

- A **memory dossier**: layered cards, a worn photograph, a tagged case file, or a compact kit of role objects.
- A **gold memory aperture**: keyhole, circular astrolabe ring, or glowing card-slot opening through the center.
- A **role artifact** in sharp silhouette: tool belt, cleats, pruning knife, archive stamp, contour map.
- A **small deck signal**: 2-4 card backs or translucent card rectangles, partially tucked behind the artifact. They should imply deck access without becoming a generic card fan.
- A **faint identity trace**, not a portrait: glove marks, footprints, hand silhouette, stamped seal, old photo edge, field notes. No full heroic character.
- A **color accent by starter source**: the accent identifies the memory's origin, while the gold aperture says it is unlocked.

Starter icons should be more structured than general relics and less environmental than world unlocks. They can include a shallow background texture, but not a full scene. The dossier shape should make them recognizable as a family at a glance.

Starter-specific briefs:

| Unlock id | Name | Focal concept | Accent |
| --- | --- | --- | --- |
| `starter-contractor` | Builder's Instinct | Tool belt, work gloves, folded blueprint/card backs, small barricade planks crossing the aperture. | Dusty brass, worksite umber. |
| `starter-footballer` | Athlete's Instinct | Muddy cleats over ghosted sprint cards, sideline chalk arcs, aperture like a stadium light/keyhole. | Warm gold with motion streaks. |
| `starter-harvester` | Harvester of the Ember Orchard | Pruning hook or harvesting glove over scorched dossier cards, ember fruit glow inside the memory aperture. | Ember orange-red. |
| `starter-archivist` | Tidal Archivist | Water-stained catalog cards, brass archive stamp, ribbon markers, aperture refracted through teal water. | Deep teal, tarnished brass. |
| `starter-surveyor` | Giant Surveyor | Contour map, compass, measuring cord, three dossier cards aligned like terrain strata. | Stone grey, vein-gold, muted moss. |

Prompt skeleton for future generation:

> 256x256 square icon, Shattered Worlds unlock art, dark ink-and-ash graphic novel rendering, distressed paper and tarnished brass, centered memory dossier of [role artifacts] with 3 ghosted card backs tucked behind it, glowing gold keyhole/astrolabe memory aperture at center, [starter accent] subtle glow, scratched texture, smoky black-violet background, high contrast, readable at small size, no text, no character portrait, no clean vector style.

## General unlock style: charged relics

General unlocks should answer: **what permanent advantage did memory leave behind?**

They stay close, symbolic, and object-forward. Unlike world unlocks, they should not describe a place. Unlike starter unlocks, they should not imply an alternate deck identity. A single relic or gesture is enough.

Composition rules:

- One object or gesture dominates the frame.
- Background is abstract dark smoke, scratched void, or faint occult geometry.
- Gold light draws the silhouette and explains the effect.
- The icon can be physically impossible if it reads cleanly: pulse line in a void, cards held by light, an eye with a gold slash, hands catching lightning.
- Do not add dossier card layers unless the unlock actually concerns deck/starter identity.

Missing general-icon briefs:

| Unlock id | Name | Focal concept |
| --- | --- | --- |
| `rarity-bonus` | Born Lucky | Tarnished coin, bone charm, or compass needle caught inside a gold probability ring; small fractured stars around it. |
| `other-sprint-free` | Run in Terror | Multiple shoes or repeated motion shadows vanishing into dark, with a torn Panic-card silhouette dragged behind the glow. |

## Category contrast checklist

Before approving a new unlock image, ask:

| Question | World unlock | Starter unlock | General unlock |
| --- | --- | --- | --- |
| Does it show a place? | Yes, enough to identify the world. | No, only shallow memory texture. | No. |
| Does it show a threshold? | Yes, lock/portal/seal in environment. | Yes, memory aperture or deck access slot. | Optional, usually no. |
| Does it show role/deck identity? | No. | Yes. | No, unless the specific mechanic is card-related. |
| Is the focal object readable at 48x48? | Lock/seal/portal. | Dossier plus role artifact. | Single relic/gesture. |
| What emotion should it land? | A new world is reachable. | A remembered self is available. | A useful edge has been recovered. |

## Approval rubric

An icon is ready when:

- It is identifiable at 48x48 without the label.
- It belongs to the correct family even before reading the filename.
- It uses gold/access light consistently.
- It does not flatten into generic fantasy item art.
- It leaves the interface room to add purchase, locked, active, or selected states outside the image.
- For starter unlocks, it clearly reads as memory/deck access and not as a world key.

