# Theme Art Direction

Theme art should make each world recognizable before the catastrophe arrives,
then leave room for the intrusion layer to make that reality feel impossible.

## Shared Visual Language

- Use a 3:2 landscape composition. Reality backdrops are displayed at 900x600.
- Render environments as gritty ink-and-wash concept art on warm, weathered
  paper: dense scratch linework, imperfect black borders, restrained paint, and
  tactile grain.
- Keep the reality layer mostly desaturated. Reserve vivid color for each
  world's intrusion overlay and for the shared violet Door.
- Establish one strong place with a clear perspective and readable large forms.
  Fine detail may enrich the edges, but the image must survive cards and HUD
  elements covering much of its center.
- Favor environmental storytelling over characters. A recently occupied place
  is more unsettling than a generic ruin.
- Do not paint the Walker or Door into a reality backdrop. The renderer supplies
  both as animated shared layers.
- Do not include logos, legible brand names, captions, watermarks, or decorative
  UI. Incidental signs should be abstract or unreadable.

## Layer Responsibilities

### Reality backdrop

The baseline place and emotional contradiction. It should look 95-98% normal:
at most one or two localized warning signs, never an environment already in
visible collapse. The intrusion overlay owns the disaster.

### Intrusion overlay

The catastrophe, signature hue, impossible light, creatures, and localized
environmental transformation. It must preserve transparent regions so mundane
reality remains visible as intensity rises.

- Build the catastrophe as an irregular perimeter frame, not a replacement
  backdrop. Roughly 40-55% of the canvas should remain fully transparent.
- Let the strongest forms enter from world-specific source edges, then taper
  before crossing the central play area.
- Use a real alpha channel with soft transition pixels. Never ship a black,
  white, or chroma-key center.
- The overlay may include transformed fragments of the location, but not the
  Walker or Door; those remain animated shared layers.
- Review the overlay composited at both half and full opacity.

### Card front

A graphic distillation of the world's materials, palette, and threat shape. It
should feel related to the backdrop without becoming a miniature landscape.

- Use the runtime card ratio of 150x196; production assets may be 459x600.
- Keep roughly 60-70% of the face as a low-detail near-black field. Runtime
  titles and rules are drawn directly over the artwork.
- Concentrate one strong world motif around the perimeter and lower third.
  Avoid a complete landscape or a second inset-shaped illustration.
- Keep the top-center title zone readable and leave the extreme corners quiet
  enough for runtime badges, rings, and highlights.
- Use rounded transparent outer corners, but keep the interior field opaque.
- Do not bake in words, numbers, labels, logos, or UI symbols.
- Validate at the actual 150x196 display size with representative pale title
  and rules text over the center.

### Insets

Thumbnail-first event illustrations. Insets have their own per-theme README and
are intentionally outside the scope of this direction pass.

## New Reality Backdrops

### Overgrown Mall

An abandoned late-century indoor shopping mall whose decorative planters have
started escaping their boundaries. The baseline should be unmistakably
different from Zombie Big Box: skylight architecture, tiled concourse, dead
fountain, glass storefronts, benches, and ornamental greenery rather than
warehouse aisles or fluorescent retail shelving.

- Mood: faded civic optimism becoming humid and feral.
- Reality palette: warm concrete, dirty cream tile, smoke gray, dry brown, muted
  moss.
- Early warning: one mildly overgrown planter and a few cracked or lifted tiles
  beside it. Keep all other vegetation contained and ordinary.
- Hold for overlay: saturated emerald growth, spores, forest density, impossible
  bloom.

### Fog Beach Party

The remains of a cheerful beach gathering at the edge of evening: folding
chairs, coolers, paper decorations, a dying bonfire, footprints, and a calm
shoreline. The open horizon and abandoned party geometry should carry the
image.

- Mood: joy interrupted so recently that the silence feels personal.
- Reality palette: ash beige sand, weathered wood, cool gray-blue sea, faded
  coral and yellow accents.
- Early warning: a low natural haze far offshore and one or two empty chairs
  turned toward the water.
- Hold for overlay: opaque fog banks, silhouettes, creature forms, flare light,
  supernatural concealment.

### Whiteout Parking Garage

An upper level of a concrete parking structure during an ordinary cold evening.
Use repeating columns, low ceilings, fluorescent fixtures, ramps, parked cars,
salt stains, and a distant city opening to make the location immediately read.

- Mood: impersonal concrete cold becoming physically hostile.
- Reality palette: cement gray, charcoal, dirty white, oxidized steel, muted
  sodium amber.
- Early warning: a narrow trace of windblown powder at the exterior edge and one
  small frozen puddle. Keep the central lane, cars, and architecture dry.
- Hold for overlay: blizzard whiteout, deep ice, frozen vehicles, blue-white
  supernatural cold, buried architecture.

## Reality Prompt Template

```text
Use case: stylized-concept
Asset type: 3:2 game reality backdrop
Primary request: [WORLD-SPECIFIC BASELINE SCENE]
Style/medium: gritty ink-and-wash environment concept art on warm weathered
paper, dense scratchy black linework, restrained watercolor, imperfect ink
border, tactile grain
Composition/framing: wide establishing view with strong perspective and large
readable environmental forms; important location cues around the outer thirds;
center may be covered by game cards
Lighting/mood: mundane natural or practical light, ominous through absence and
staging rather than supernatural effects
Color palette: heavily desaturated, with only small faded real-world accents
Constraints: 3:2 landscape; environment only; no Walker; no Door; no full
catastrophe; no text; no logos; no watermark
Avoid: glossy digital painting, clean vector art, vivid all-over color,
cinematic characters, generic rubble, illegible AI signage
```

## Review Checklist

- Reads as the intended location at thumbnail size.
- Clearly differs from every existing world, especially worlds sharing an
  interior or vehicle setting.
- Looks mundane enough that the intrusion overlay will feel wrong.
- Uses the established ink, paper, border, and desaturated palette language.
- Leaves the Walker, Door, and full catastrophe to their proper layers.
- Contains no prominent malformed text or accidental branding.
