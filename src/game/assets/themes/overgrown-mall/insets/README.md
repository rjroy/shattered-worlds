# Overgrown Mall Inset Art Guidance

Thumbnail-first inset assets:

- `inset-bloom.webp`
- `inset-burst-planter.webp`
- `inset-fountain-bloom.webp`
- `inset-garden-center.webp`
- `inset-kudzu-curtain.webp`
- `inset-machete.webp`
- `inset-pollen-haze.webp`
- `inset-pruning-shears.webp`
- `inset-something-in-the-atrium.webp`
- `inset-spore.webp`
- `inset-weed-killer.webp`

## Direction

Preserve the abandoned mall's warm, faded civic palette, but make deep
botanical emerald the consistent accent. The green must read as vigorous plant
life rather than chemical ooze. Each inset should have:

- one large foreground subject, tool, plant form, or hazard
- a bold silhouette readable at 100x100
- a simplified, darker mall background
- warm dirty cream tile, smoke-gray storefronts, dry brown soil, and muted wood
- deep emerald used for matte leaves, stems, vines, moss, and reflected skylight
- visible botanical structure: leaf veins, bark, fibers, roots, petals, or pollen
- no tiny debris or competing props
- light post-processing for contrast and thumbnail sharpening

Avoid neon chartreuse, wet translucency, dripping surfaces, glossy blobs,
amorphous green masses, or anything that suggests slime, poison, or radioactive
fluid.

## Prompt Template

```text
Square 600x600 illustrated game inset for an overgrown abandoned shopping mall
survival board game. Palette: warm dirty cream tile, smoke-gray storefronts,
dry brown soil, and deep botanical emerald green accents. Main subject:
[ONE CLEAR FOREGROUND SUBJECT], large and unmistakable, readable as
"[EVENT NAME]" at 100x100 pixels. Background: [MALL LOCATION], heavily
simplified and blurred, with only [1-2 ARCHITECTURAL CUES]. Emphasize matte
leaves, visible veins, woody stems, fibrous roots, petals, pollen, and natural
plant structure. High contrast, gritty painterly realism, comic-book ink
texture, strong natural rim light. No text, no logos, no slime, no ooze, no
dripping liquid, no neon green, no clutter.
```

## Finishing Pass

Each generated image was fit to 600x600, then finished with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before adding it to the asset manifest.
