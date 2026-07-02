# Transit Authority Inset Art Guidance

Thumbnail-first square inset assets (13). Filename = `inset-<kebab-name>.webp`;
asset key = `transit-inset-<kebab-name>`.

## Direction

**Rendering technique is a deliberate departure from the shared house style
(see plan deviation 5).** Every other Shattered Worlds theme renders its
backdrop, overlay, cardfront, *and* insets in gritty ink-and-wash concept art.
Transit Authority's backdrop, overlay, and cardfront still follow that shared
language, but its 13 card insets instead use an **anime-but-gritty** style:
bold cel-shaded linework, high-contrast expressive shading, and hard graphic
shadow shapes, kept "gritty" rather than clean-shonen-polish through visible
grime and wear texture, scuffed/imperfect edges, and desaturation held outside
the accent palette. This is Transit-specific, not a change to the shared
convention — new worlds should keep defaulting to ink-and-wash unless they
have an equally deliberate, documented reason not to.

Palette: sodium-amber, iron, and cream as the base station light and material
colors, with quarantine crimson and violet reserved as the reroute-intrusion
accent (never the dominant color of a calm/functioning subject). Recurring
reroute nouns: flipping departure boards mid-flip, platform number placards
being swapped or crossed out, quarantine stamps and tape, chained gates,
credential tickets, and route-map lines bending toward a single point.

**Composition is unchanged from every other world's insets and takes
precedence over the rendering-style choice (W2b, `.lore/reference/theme-authoring.md`).**
"Anime" pulls toward multi-figure action panels, speed lines, and busy
screen-tone clutter — none of that is wanted here. Every inset must be a
single-subject, bold-silhouette key visual: one large foreground subject, a
bold silhouette readable at 100x100, a simplified darker terminal background,
and only one or two environmental cues. No action panels, no multiple
figures, no speed lines, no screen-tone clutter, no crowded background detail
competing with the subject. Treat this as a restrained anime *key visual*
(box-art energy), not manga action-scene panel art.

## Files and per-card intent

- `inset-service-change.webp` -> `transit-inset-service-change`: a departure board mid-flip, one panel already blank, the rest still catching up.
- `inset-platform-reassignment.webp` -> `transit-inset-platform-reassignment`: a platform number placard being swapped for a new one by an unseen hand.
- `inset-ticket-invalidated.webp` -> `transit-inset-ticket-invalidated`: a single ticket stamped INVALID, crimson ink still wet.
- `inset-train-arrives-from-nowhere.webp` -> `transit-inset-train-arrives-from-nowhere`: a train's headlight bursting out of a platform archway that shouldn't lead anywhere.
- `inset-do-not-board-unknown-trains.webp` -> `transit-inset-do-not-board-unknown-trains`: a chained gate barring a platform edge, warning tape stretched across it.
- `inset-all-departures-suspended.webp` -> `transit-inset-all-departures-suspended`: the whole departure board frozen mid-flip, every line the same crimson warning glyph.
- `inset-reissue-credentials.webp` -> `transit-inset-reissue-credentials`: a credentials kiosk window handing out a fresh stamped pass.
- `inset-entity-detected.webp` -> `transit-inset-entity-detected`: a violet quarantine seal closing over a platform silhouette, the shape of the thing it's containing left deliberately ambiguous.
- `inset-temporary-credentials.webp` -> `transit-inset-temporary-credentials`: a hand holding up a valid stamped pass to a scanner light.
- `inset-express-transfer.webp` -> `transit-inset-express-transfer`: a figure sprinting through a closing set of doors onto a departing express.
- `inset-check-the-board.webp` -> `transit-inset-check-the-board`: a figure reading the departure board with a raised hand refusing the offered route.
- `inset-board-anyway.webp` -> `transit-inset-board-anyway`: a figure stepping onto a train despite a crimson warning placard beside the door.
- `inset-right-of-way.webp` -> `transit-inset-right-of-way`: a hand slamming a stamp onto a route map, redrawing the line itself.

## Prompt template

```text
Square key-art illustration, anime-but-gritty style: bold cel-shaded linework,
high-contrast expressive shading, hard graphic shadow shapes, visible grime
and wear texture and imperfect scuffed edges (not clean shonen polish). One
large [SUBJECT] as a single foreground focus, instantly recognizable in
silhouette at thumbnail size, set against a simplified darker transit-terminal
background with only [ONE OR TWO CUES]. Sodium-amber, iron, and cream palette
with quarantine crimson and violet reserved as the only saturated
reroute-intrusion accent. Single subject, key-art composition only — no
action panel, no multiple figures, no speed lines, no screen-tone clutter, no
busy background detail. This illustration must contain zero text: no legible
words, no numbers, no invented alphabet or pseudo-script glyphs, no barcodes,
no calligraphy, no readable marks of any kind on any surface (boards,
tickets, stamps, papers, signs, screens). Render all signage, boards, and
stamps as abstract blank or geometric shapes only — plain unlit or lit tally
cells, a blank card, a plain circular ink blot — never as text. Full-bleed
square image with no outer border, frame, vignette, or photo-corner
treatment. No card layout, title, logo, watermark, Walker, Door, combat,
crowd, or tiny clutter.
```

The bracketed standing constraint ("single subject, key-art composition
only...", the zero-text clause, and the no-border clause) is not optional
per-prompt phrasing — it is baked into every generation for this set so no
individual inset drifts into a busier, multi-element, or text-bearing
composition than the house W2b rule and the shared "no readable text" rule
allow. In practice `flux-2-pro` (the model used for this set) has a strong
tendency to hallucinate pseudo-CJK glyphs, garbled Latin lettering, and
photo-border/vignette framing onto any object described as a "board",
"ticket", "stamp", or "sign" even when told not to — per-card prompts below
describe those objects in purely geometric/abstract terms (blank panels,
plain ink blots, unmarked cards) rather than naming them as text-bearing
objects, which is what actually suppressed the hallucinated text in
practice.

## Finishing pass and validation

Generated sources are fit to 600x600, then processed at contrast `1.12`,
brightness `0.99`, and unsharp mask radius `1.1` / percent `80` / threshold `4`.
All thirteen final WebPs were reviewed together on a 100x100 contact sheet for
silhouette, subject distinction, palette consistency, and thumbnail
readability before asset binding, and independently re-checked against W2b's
composition rule (one subject, bold silhouette, simplified background, no
action-panel busyness) given anime's pull toward busier compositions.
