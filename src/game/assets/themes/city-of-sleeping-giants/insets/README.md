# The City of Sleeping Giants Inset Art Guidance

Thumbnail-first inset assets (13). Filename = `inset-<kebab-name>.webp`, asset
key = `giants-inset-<kebab-name>` (see `cards.json` and `boons/giants.json`).

Hazards and world cards:

- `inset-minor-tremor.webp`
- `inset-relocation-order.webp`
- `inset-fingerquake-ward.webp`
- `inset-surveyors-mark-a-pulse.webp`
- `inset-vein-road-surge.webp`
- `inset-bone-anchor-failure.webp`
- `inset-district-recall.webp`
- `inset-the-giant-turns-in-sleep.webp`
- `inset-follow-the-vein.webp`

Boons (`boons/giants.json`):

- `inset-quiet-survey.webp`
- `inset-brace-the-ward.webp`
- `inset-bone-pin.webp`
- `inset-contour-map.webp`

## Direction

Match the reality backdrop: a vast violet-cyan metropolis rendered in dense
etched-ink fantasy-illustration linework, where continent-sized figures sleep
hidden in plain sight as the terrain. The palette is deep teal and violet-blue
stone, bone-white towers and exposed bone, emerald terraces and emerald
vascular light under the canals, with crimson civic banners and a clear blue
sky carrying slow airships. The city is built across living bodies, so masonry
and anatomy blur: roads are veins, plazas are old wounds, districts are
knuckles and ribs.

The threat verb is **stir**: accumulating disturbance in a body that is being
**noticed**, not crushed. The intrusion accent is **violet hairline cracks**
glowing along the vein-roads and a deeper **emerald pulse** under stone, both
growing as awareness rises. Hazard cards should show stone subtly becoming
flesh, something enormous beginning to flex; reward cards should show human
scale restraint, surveying, bracing, and keeping the body quiet.

Regenerate each composition so it has:

- one large foreground subject (a flexing hand-district, vein-road, bone anchor,
  survey marker, or a single sleeping eyelid/knuckle)
- a bold silhouette readable at 100x100
- a simplified, darker cityscape background, towers reduced to a few masses
- only one or two environmental cues (a banner, a canal, an airship, a lamp)
- no crowded skyline detail, no swarm of tiny props competing with the subject
- light post-processing for contrast and thumbnail sharpening
- never paint a fully risen titan; keep the giant subtly, dreadfully waking

Per-card intent to guide the subject:

- Minor Tremor: a hairline violet crack running across paving stones.
- Relocation Order: a district sign and cart, a neighborhood ordered to move.
- Fingerquake Ward: a block built across a colossal hand as the fingers flex.
- Surveyors Mark a Pulse: expedition figures charting a motion noticed too late.
- Vein-Road Surge: a boulevard glowing with dark emerald current beneath stone.
- Bone Anchor Failure: skyscraper bolts groaning free of exposed white bone.
- District Recall: a neighborhood folding back toward the body that carried it.
- The Giant Turns in Sleep: a massive limb shifting at scale, city sliding on it.
- Follow the Vein: a figure riding the emerald current for speed, tempo and risk.
- Quiet Survey: a surveyor calmly reading the ground, reordering what comes next.
- Brace the Ward: timbers and bolts bracing a tilting ward against a reflex.
- Bone Pin: a single anchor driven to pin a plan onto exposed bone.
- Contour Map: a contour and anatomy map of one district, one route marked.

## Prompt Template

```text
Square 600x600 game card inset illustration for a mythic city-on-sleeping-giants
survival game, deep teal and violet-blue palette, bone-white towers and exposed
bone, emerald vascular light, crimson banners, clear blue sky, dense etched-ink
fantasy-illustration linework where stone and anatomy blur. Subject: [ONE CLEAR
FOREGROUND SUBJECT, a flexing hand-district/vein-road/bone anchor/survey marker/
sleeping eyelid], large and unmistakable, arranged as a bold readable
silhouette, readable as "[CARD NAME]" at 100x100 pixels. Background: [CITY
LOCATION], heavily simplified and out of focus, towers as a few masses, only
[1-2 CUES]. High contrast value hierarchy: [SUBJECT] against deep teal shadow.
Violet hairline cracks and a deep emerald pulse under the stone as the only
glowing accents. Painterly rim light, stone subtly becoming flesh, never a fully
risen titan, no text, no logos, no crowded skyline competing with the subject.
```

## Finishing Pass

Fit each generated image to 600x600, then finish with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before wiring it into
`assetBindings.ts` and the asset manifest.
