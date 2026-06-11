# Bird Building Inset Art Guidance

Thumbnail-first inset assets:

- `inset-cut-it-loose.webp`
- `inset-find-footing.webp`
- `inset-fire-axe-find.webp`
- `inset-fire-axe.webp`
- `inset-gripping-talon.webp`
- `inset-groaning-girders.webp`
- `inset-shadow-overhead.webp`
- `inset-sliding-debris.webp`
- `inset-steady.webp`

## Direction

Preserve the existing ruined high-rise palette, but make sky-blue window light
the consistent accent. Each inset should have:

- one large foreground subject or hazard
- a bold silhouette readable at 100x100
- a simplified, darker office/building background
- sky-blue used for window light, reflections, or open sky
- no tiny debris or competing props
- light post-processing for contrast and thumbnail sharpening

## Prompt Template

```text
Square 600x600 illustrated game inset. Theme: ruined high-rise office during a
giant bird disaster. Palette: charcoal concrete, dark steel, and strong sky-blue
window light. Main subject: [ONE CLEAR FOREGROUND SUBJECT], large and
unmistakable, readable at 100x100 pixels. Background: broken windows with blue
sky, blurred and quiet. High contrast, gritty painterly realism, comic-book ink
texture. No text, no logos, no gore, no clutter.
```

## Finishing Pass

Each generated image was fit to 600x600, then finished with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before adding it to the asset manifest.
