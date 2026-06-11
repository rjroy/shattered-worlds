# Zombie Big Box Inset Art Guidance

Thumbnail-first inset assets:

- `inset-baseball.webp`
- `inset-corpse.webp`
- `inset-echoing-aisles.webp`
- `inset-find-shotgun.webp`
- `inset-listen.webp`
- `inset-regroup.webp`
- `inset-rubble.webp`
- `inset-screams.webp`
- `inset-shelf-sweep.webp`
- `inset-shotgun.webp`
- `inset-strange-sounds.webp`
- `inset-zombie.webp`

## Direction

Preserve the existing sickly green-black palette, but regenerate the composition so each image has:

- one large foreground subject
- a bold silhouette readable at 100x100
- a simplified, darker background
- only one or two environmental cues
- no tiny debris or competing props
- light post-processing for contrast and thumbnail sharpening

## Prompt Template

```text
Square 600x600 game card inset illustration for a zombie survival board game,
same sickly green-black abandoned store palette, grimy cinematic horror lighting.
Subject: [ONE CLEAR FOREGROUND SUBJECT], large and unmistakable, arranged as
bold readable silhouettes, readable as "[EVENT NAME]" at 100x100 pixels.
Background: [LOCATION], heavily simplified and out of focus, only [1-2 CUES],
no busy clutter, no tiny debris detail. High contrast value hierarchy: [SUBJECT]
against deep shadow. Gritty painterly realism, comic-book ink texture, strong rim
light. No text, no logos, no extra props competing with the subject.
```

## Finishing Pass

Each generated image was fit to 600x600, then finished with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before adding it to the asset manifest.
