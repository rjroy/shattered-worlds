# The Ember Orchard Inset Art Guidance

Thumbnail-first inset assets (16). Filename = `inset-<kebab-name>.webp`, asset
key = `ember-inset-<kebab-name>` (see `cards.json` and `boons/ember.json`). All
16 art files exist and their imports/manifest entries in
`worlds/assetBindings.ts` are wired; the `insetKey` fields were already authored
in `cards.json` and `boons/ember.json`.

Hazards and world cards:

- `inset-cracked-hearth-star.webp`
- `inset-dormant-star.webp`
- `inset-ember-moth.webp`
- `inset-falling-fruit.webp`
- `inset-glasshouse-lantern.webp`
- `inset-ground-constellation.webp`
- `inset-hatchery-cellar.webp`
- `inset-lantern-brood.webp`
- `inset-rooted-meteor.webp`
- `inset-take-one.webp`
- `inset-the-orchard-counts-wrong.webp`

Boons (`boons/ember.json`):

- `inset-bank-the-heat.webp`
- `inset-constellation-shears.webp`
- `inset-keep-vigil.webp`
- `inset-leave-one.webp`
- `inset-star-pruner.webp`

## Direction

Match the reality backdrop: a warm twilight orchard rendered in dense
naturalist ink linework with a painterly ember glow. The palette is deep
ember-orange and amber against near-black branch silhouettes, crimson sunset
sky, and pools of village-lantern gold. Stars are physical things here, hung in
the boughs like ripe fruit and stored in iron lanterns, so light always reads
as a contained, fragile heat.

The threat verb is **incubate**: warmth that is secretly an egg. The intrusion
accent is an impossible **violet-white core** breaking through the warm light,
plus thin **violet-magenta trails** that bend toward a repeated empty footprint.
Use that cold violet sparingly, as the wrongness inside otherwise inviting
light. Hazard cards should lean colder and cracked; reward cards should lean
warmer and intact.

Regenerate each composition so it has:

- one large foreground subject (a single star, lantern, moth, or meteor-fruit)
- a bold silhouette readable at 100x100
- a simplified, darker orchard background, branches reduced to a few black masses
- only one or two environmental cues (a lantern, a branch, a furrow, a basket)
- no tiny debris, no crowded botany, no competing props
- light post-processing for contrast and thumbnail sharpening

Per-card intent to guide the subject:

- Cracked Hearth-Star: a fuel-star pulsing inside an iron stove, shell fissured.
- Dormant Star: a single banked star carried safe, faint violet seam inside.
- Ember Moth: a moth-seed-constellation hatchling, wings mapped with stars.
- Falling Fruit: a lantern-sized star dropping downward, not rising.
- Glasshouse Lantern: a glass lantern sheltering a drawn star, calm and warm.
- Ground Constellation: stars planted in soil like rooted meteors, sky emptied.
- Hatchery Cellar: a storehouse of clicking shells, one cracking open.
- Lantern Brood: several small ember things spilling from a single lantern.
- Rooted Meteor: a buried star grown burning roots, blocking a road.
- Take One: a hand lifting one warm star from the branch, generous and risky.
- The Orchard Counts Wrong: a branch bearing one too many lights, miscounted.
- Bank the Heat / Keep Vigil / Leave One: restraint and stewardship, warm-intact.
- Constellation Shears / Star-Pruner: a clean tool severing a star or seam.

## Prompt Template

```text
Square 600x600 game card inset illustration for a mythic orchard survival game,
warm twilight orchard palette of deep ember-orange and amber against near-black
branches, crimson sunset sky, village-lantern gold, naturalist ink linework with
painterly glowing heat. Subject: [ONE CLEAR FOREGROUND SUBJECT, a star/lantern/
ember-moth/meteor-fruit], large and unmistakable, arranged as a bold readable
silhouette, readable as "[CARD NAME]" at 100x100 pixels. Background: [ORCHARD
LOCATION], heavily simplified and out of focus, branches as a few dark masses,
only [1-2 CUES]. High contrast value hierarchy: glowing [SUBJECT] against deep
shadow. One impossible violet-white core inside the warm light as the only cold
accent. Etched ink texture, painterly rim light, no text, no logos, no tiny
debris, no crowded botany competing with the subject.
```

## Finishing Pass

Fit each generated image to 600x600, then finish with:

- contrast: `1.12`
- brightness: `0.99`
- unsharp mask: radius `1.1`, percent `80`, threshold `4`

Validate new artwork in a 100x100 contact sheet before wiring it into
`assetBindings.ts` and the asset manifest.
