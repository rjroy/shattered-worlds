# The Tidal Archive Inset Art Guidance

Thumbnail-first inset assets (12). Filename = `inset-<kebab-name>.webp`, asset
key = `tidal-inset-<kebab-name>`. Card names come from `cards.json` and
`boons/tidal.json`; the `insetKey` fields still need wiring once the art exists
(see the TODO in `worlds/assetBindings.ts`).

Hazards and world cards:

- `inset-wandering-stacks.webp`
- `inset-drowned-index.webp`
- `inset-misfiled-century.webp`
- `inset-bridge-to-yesterday.webp`
- `inset-borrowed-catastrophe.webp`
- `inset-chained-books-rising.webp`
- `inset-the-same-footprint.webp`

Boons (`boons/tidal.json`):

- `inset-mark-the-shelf.webp`
- `inset-cross-reference.webp`
- `inset-waterproof-notes.webp`
- `inset-anchor-the-memory.webp`
- `inset-shelf-map.webp`

## Direction

Match the reality backdrop: a flooded floating library rendered in fine
etched-ink architectural linework over still turquoise water. The palette is
sea-glass green and deep turquoise, brass-and-gold lamplight, and drowned coral
red, with moonlit cyan in the arches and a single warm doorway glow far off.
Water is always present as a calm reflective plane, and books, shelves, and
coral bridges are the recurring nouns.

The threat verb is **displace**: a thing is never destroyed, only moved to a
place the tide can revisit. The intrusion accent is the Walker's impossible
**violet**, arriving as displacement glow and as fine **index/constellation map
lines** that bend every route toward one repeated footprint. Keep violet rare
and surgical. Hazard cards should feel mislocated and looping; reward cards
should feel like deliberate navigation, a hand placing or marking one memory.

Regenerate each composition so it has:

- one large foreground subject (a shelf, globe, chained book, bridge, or map)
- a bold silhouette readable at 100x100
- a simplified, darker background, distant arches reduced to a few masses
- only one or two environmental cues (waterline, a lamp, a coral arch)
- no scattered floating debris, no crowded shelving competing with the subject
- light post-processing for contrast and thumbnail sharpening

Per-card intent to guide the subject:

- Wandering Stacks: a bookshelf detached and drifting, carrying one lit book.
- Drowned Index: a sunken card catalog glowing with one findable memory.
- Misfiled Century: a district sign labelled with the wrong drowned disaster.
- Bridge to Yesterday: a coral road folding backward into an impossible loop.
- Borrowed Catastrophe: a present arch overlapping a translucent ghost building.
- Chained Books Rising: chained tomes spiraling up out of the still water.
- The Same Footprint: every map line on the water converging on one footprint.
- Mark the Shelf: a hand placing one chosen book back onto the top of a shelf.
- Cross-Reference: two open books traded, one sinking as another surfaces.
- Waterproof Notes: sealed inked notes held above the waterline, tempo and risk.
- Anchor the Memory: a single book pinned and protected under a brass weight.
- Shelf Map: an index map of the archive with one route marked in cyan light.

## Prompt Template

```text
Square 600x600 game card inset illustration for a mythic flooded-library
survival game, sea-glass green and deep turquoise palette, brass lamplight gold,
drowned coral red, moonlit cyan arches, fine etched-ink architectural linework
over still reflective water. Subject: [ONE CLEAR FOREGROUND SUBJECT, a shelf/
globe/chained book/coral bridge/index map], large and unmistakable, arranged as
a bold readable silhouette, readable as "[CARD NAME]" at 100x100 pixels.
Background: [ARCHIVE LOCATION], heavily simplified and out of focus, distant
arches as a few masses, only [1-2 CUES] plus a calm waterline. High contrast
value hierarchy: lit [SUBJECT] against deep teal shadow. Thin impossible violet
map lines bending toward one footprint as the only cold accent. Painterly rim
light, no text, no logos, no scattered floating debris competing with the
subject.
```

## Finishing Pass

Fit each generated image to 600x600, then finish with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before wiring it into
`assetBindings.ts` and the asset manifest.
