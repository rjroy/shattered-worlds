# Eden Prime Inset Art Guidance

Thumbnail-first inset assets (13). Filename = `inset-<kebab-name>.webp`; asset key
= `eden-inset-<kebab-name>` (see `src/data/allCards.json`). The card catalog
already references these keys, but final WebP inset art is still out-of-band:
do not add placeholder bindings. Wire each key in `worlds/assetBindings.ts` only
after the matching final art file exists and passes the 100x100 contact-sheet
validation below.

Hazards and world cards:

- `inset-fruit-offered-too-quickly.webp` -> `eden-inset-fruit-offered-too-quickly`
- `inset-first-warning-cry.webp` -> `eden-inset-first-warning-cry`
- `inset-curious-swarm.webp` -> `eden-inset-curious-swarm`
- `inset-the-herd-misunderstands.webp` -> `eden-inset-the-herd-misunderstands`
- `inset-flowers-face-the-wrong-sun.webp` -> `eden-inset-flowers-face-the-wrong-sun`
- `inset-the-quiet-grove.webp` -> `eden-inset-the-quiet-grove`
- `inset-paradise-runs.webp` -> `eden-inset-paradise-runs`

Rewards and Eden player cards:

- `inset-take-the-fruit.webp` -> `eden-inset-take-the-fruit`
- `inset-gentle-approach.webp` -> `eden-inset-gentle-approach`
- `inset-stillness-lesson.webp` -> `eden-inset-stillness-lesson`
- `inset-follow-the-shade.webp` -> `eden-inset-follow-the-shade`
- `inset-hush-the-valley.webp` -> `eden-inset-hush-the-valley`
- `inset-tread-softly.webp` -> `eden-inset-tread-softly`

## Direction

Match the realized inset house style of the recent worlds (the Ember Orchard,
City of Sleeping Giants): bold graphic-novel comic illustration with heavy black
ink linework, dramatic chiaroscuro, a strong rim-lit single subject, and rich
saturated lighting. Insets are deliberately more vivid than the desaturated
ink-and-wash reality backdrops; the shared backdrop direction does not apply
here. Vivid color carries the focal subject, with one glowing accent reserved
for the intrusion, Alarm, and the shared Door. Eden Prime stays gentle paradise
green and garden gold under a deep glowing sky, pierced by a sparse
violet-white second sun.

The threat verb is **startle**: gifts, curiosity, and abundance becoming an
involuntary flinch. Insets should read as a paradise with no word for danger
misreading the player's reach. Hazard insets show calm subjects at the instant
before they turn: low fruit splitting early, a bird inventing a warning cry, a
curious swarm tightening into panic, a gentle herd moving too fast, flowers
facing the wrong sun, and the valley running from itself. Reward insets show
restraint and measured reach: a careful hand, stillness, walking in shade, and
hushing the valley.

Regenerate each composition so it has:

- one large foreground subject, not a crowded botanical scene
- a bold silhouette readable at 100x100
- a simplified, darker Eden background with only one or two environmental cues
- paradise green/gold as the base palette, with violet-white wrongness used
  sparingly as the startle accent
- no generic fantasy monsters, gore, neon poison green, readable text, logos,
  tiny insects/debris, or crowded props
- a calm face and an alarmed reading where the card concept allows both

Per-card intent to guide the subject:

- Fruit Offered Too Quickly: low gold fruit offered by a bending branch, skin
  just beginning to split before touch.
- First Warning Cry: a bright bird mid-call under two shadows, the sound new to
  the valley.
- Curious Swarm: harmless insects gathering around a hand, curiosity tipping
  into a spiral.
- The Herd Misunderstands: long-necked grazers beginning a confused stampede,
  gentle faces and wrong momentum.
- Flowers Face the Wrong Sun: blossoms turning away from warmth toward a
  violet-white second sun.
- The Quiet Grove: a still grove offering tools and shade, calm but watchful.
- Paradise Runs: the whole foreground valley in flight from no visible predator.
- Take the Fruit: a hand accepting generous fruit, beautiful and risky.
- Gentle Approach: an open hand stopping short, respect over grabbing.
- Stillness Lesson: a figure motionless while birds and insects settle.
- Follow the Shade: measured footsteps kept under broad leaves and forked shade.
- Hush the Valley: a quieting gesture over grass, water, and startled wings.
- Tread Softly: a careful foot placed between flowers without bending them.

## Prompt Template

Describe the silhouette intent in words; never quote the literal card name or the
word "card" into the prompt. flux-2-pro renders quoted titles as on-image text
and a card frame, which insets must not have.

```text
Full-bleed square illustration, bold graphic-novel comic art with heavy black
ink linework and dramatic chiaroscuro, painted in rich saturated light, instantly
recognizable in silhouette at thumbnail size. Mythic Eden valley palette of lush
garden green and warm fruit gold under a deep glowing sunset-toned sky. Subject:
[ONE CLEAR FOREGROUND SUBJECT, a fruit/hand/bird/swarm/herd/flower/grove/footstep],
large and unmistakable, rim-lit against shadow as a bold silhouette. Background:
[EDEN LOCATION], heavily simplified and darker, only [1-2 CUES] in silhouette.
High value contrast: glowing [SUBJECT] against deep green shadow. One sparse
violet-white second-sun accent and forked shadow geometry signal the startle
without taking over the image. Full-bleed art only: no border, no frame, no card
layout, no title banner, no UI panel, no text, no caption, no lettering, no logos,
no monsters, no gore, no neon poison green, no crowded botany, no tiny debris
competing with the subject.
```

## Finishing Pass

Fit each generated image to 600x600, then finish with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`
- inspect against the runtime cardfront to ensure title/rules text stays clear

Validate new artwork in a 100x100 contact sheet before wiring it into
`assetBindings.ts` and the asset manifest. The contact sheet must show all 13
Eden cards together, with each filename/key pair checked for silhouette,
subject distinction, violet-white restraint, and thumbnail readability.
