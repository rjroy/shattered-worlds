# Highway Volcano Inset Art Guidance

Thumbnail-first inset assets:

- `inset-ash-fall.webp`
- `inset-ditch-gear.webp`
- `inset-floor-it.webp`
- `inset-gridlock.webp`
- `inset-lava-flow.webp`
- `inset-nitro.webp`
- `inset-spot-path.webp`
- `inset-tremors.webp`
- `inset-vehicle.webp`

## Direction

Preserve the existing smoky highway palette, but make the red-orange lava accent
the consistent focal color. Each inset should have:

- one large foreground subject or road condition
- a bold silhouette readable at 100x100
- a simplified, darker highway/volcano background
- red-orange used for lava, brake lights, heat glow, or volcanic rim light
- no tiny debris or competing props
- light post-processing for contrast and thumbnail sharpening

## Prompt Template

```text
Square 600x600 game card inset illustration for a highway-volcano survival board game,
smoky charcoal-gray road palette with vivid red-orange lava accents.
Subject: [ONE CLEAR FOREGROUND SUBJECT], large and unmistakable, arranged as
bold readable silhouettes, readable as "[EVENT NAME]" at 100x100 pixels.
Background: [HIGHWAY/VOLCANO LOCATION], heavily simplified and out of focus,
only [1-2 CUES], no busy clutter, no tiny debris detail. High contrast value
hierarchy: [SUBJECT] against deep smoke, red-orange lava accent as the focal
color. Gritty painterly realism, comic-book ink texture, strong rim light.
No text, no logos, no extra props competing with the subject.
```

## Finishing Pass

Each generated image was fit to 600x600, then finished with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before adding it to the asset manifest.
