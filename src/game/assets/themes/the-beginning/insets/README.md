# The Beginning Inset Art Guidance

**This world is a deliberate exception to the single-Direction-section
convention every other multi-act world's inset README uses** (see
`answers/insets/README.md`, `questions/insets/README.md`). Worlds 13/14 each
commit to one house-style-plus-accent-color scheme for the whole card set;
this world's REQ-W15-23 three-act visual arc (Act I saturated/intense, Act II
cooler/muted, Act III's returning warmth) is carried entirely by inset art
direction rather than `VisualTheme` (see `theme.ts`'s comment and the plan's
Step 14 resolution: `VisualTheme` stays one flat palette, no per-act switching
anywhere in the renderer). That means **three distinct "Direction"
subsections below, one per act**, instead of one. Do not read the three
sections as an authoring mistake or an unfinished merge — it is intentional,
and it is the only place in this world's data where a per-act split is a
normal authoring choice rather than a code change.

Thumbnail-first square inset assets (19). Filename = `inset-<kebab-name>.webp`;
asset key = `the-beginning-inset-<kebab-name>`. No art exists yet for any of
these — this document is guidance for a follow-on art-generation pass, not a
record of art already produced (see `assetBindings.ts`'s note: this world
ships without insets or a cardfront, matching `answers`' initial state before
its own inset pass).

`Destiny` is **not** in the 19 count and needs no new inset — it is the
identical `"Destiny"` template reused from `questions`/`answers` (see
`theme-authoring.md`'s "Template reuse, intentional" note) and already has art
(`questions-inset-destiny`). `The Walker` closer is likewise shared, carrying
its own global `inset-walker` key, and is not authored here.

## Direction — Act I (Denial + Anger, reprised faster)

Reprises `questions`' saturated/intense inset style directly, not just its
house style: the same bold graphic-novel ink linework and chiaroscuro, but
leaning harder into `questions`' sparse ember-orange escalation thread than
`questions` itself ever fully commits to, since Act I here saturates faster
(REQ-W15-17) — `It's Fine, Actually` and `Somebody Else Will Handle It` trip
their own keyword gates alone, without needing a second card to help. Palette:
institutional sage-ash-cream base (`#e8e6e0` / `#b3b0a6` / `#6e6a62`, matching
`QUESTIONS_THEME`), tarnished gold (`#c9a86a`) for confirm/tool-fetch moments,
and the ember-orange thread (`#ff8a4a`, hotter and more present than
`questions`' own sparse foreshadow use) reserved for Denial/Anger subjects —
this is the one Act where ember-orange is allowed to dominate a calm subject,
not just foreshadow it. A bruised violet-grey (`#9a94a8`) carries Denial's
withdrawal moments specifically, same role it plays in `questions`.

Each image has one large foreground subject, a bold silhouette readable at
100x100, and a simplified darker home/office/street background with only one
or two environmental cues. No frame, title, readable UI copy, logo, watermark,
Walker, Door, gore, crowd, or tiny clutter.

World cards:

- `inset-its-fine-actually.webp` -> `the-beginning-inset-its-fine-actually`: a hand waving off a visibly cracked object without looking at it.
- `inset-somebody-else-will-handle-it.webp` -> `the-beginning-inset-somebody-else-will-handle-it`: a phone left ringing on a counter, someone's back already turned to it.
- `inset-a-story-youve-told-yourself.webp` -> `the-beginning-inset-a-story-youve-told-yourself`: a figure rehearsing a explanation to an empty mirror, mouth mid-word.
- `inset-somebody-should-be-mad-about-this.webp` -> `the-beginning-inset-somebody-should-be-mad-about-this`: a fist half-raised, then stalled, knuckles pale but unthrown.
- `inset-every-excuse-sounds-thinner.webp` -> `the-beginning-inset-every-excuse-sounds-thinner`: a stack of sticky notes with the same excuse rewritten smaller and smaller each time.
- `inset-one-more-excuse.webp` -> `the-beginning-inset-one-more-excuse`: a hand reaching for a coat already halfway to the door.

## Direction — Act II (Bargaining + Depression, reprised gentler)

Reprises `answers`' cooler, muted grey-blue inset style directly: the same
dry, archival dust-tone palette and the same flat grey-blue stillness, but
turned down from `answers`' own intensity to match this Act's gentler
saturation (REQ-W15-18) — `A Smaller Ask` and `It's Not So Bad` need a second
card in hand to trip their own gates, unlike Act I's pair. Palette: pale
grey-blue and dust-cream base (`#dfe2e6` / `#9aa3ac` / `#5d636a`, matching
`ANSWERS_THEME`), tarnished gold (`#b08a5a`) as the one warm accent reserved
for bargaining/tool-fetch moments, and a flat cooler violet-grey (`#8f8fa0`)
for Depression's stillness — same roles `answers` assigns them, applied more
sparingly here since the pressure itself is gentler.

Each image has one large foreground subject, a bold silhouette readable at
100x100, and a simplified darker home/waiting-room background with only one
or two environmental cues. No frame, title, readable UI copy, logo,
watermark, Walker, Door, gore, crowd, or tiny clutter.

World cards:

- `inset-a-smaller-ask.webp` -> `the-beginning-inset-a-smaller-ask`: a hand offering a folded note across a table, the ask deliberately modest.
- `inset-its-not-so-bad.webp` -> `the-beginning-inset-its-not-so-bad`: a figure straightening a crooked picture frame instead of addressing the wall behind it.
- `inset-terms-you-already-know.webp` -> `the-beginning-inset-terms-you-already-know`: a hand signing a form without reading past the first line.
- `inset-the-same-tired-weight.webp` -> `the-beginning-inset-the-same-tired-weight`: a figure resettling a bag on the same shoulder, the strap already worn smooth there.

## Direction — Act III (warmth returning, new direction)

A new direction not reused from either sibling world: still the shared bold
graphic-novel ink linework, but the palette turns warm for the first time in
the trilogy — amber-gold light replacing both `questions`' ember-orange
escalation and `answers`' cool grey-blue numbness. This is the resolution the
whole world builds toward (`THE_BEGINNING_THEME`'s own signature), so Act III
insets should read as arrival, not further threat: soft firelight-gold
(`#e0b054`, matching `THE_BEGINNING_THEME.realityPalette.confirm`), warm
parchment-cream (`#f2e2c4`), and warm umber shadow (`#6b5a45`) replacing every
cooler tone used in Acts I/II. No ember-orange, no violet-grey, no grey-blue
anywhere in this Act's insets — the palette shift itself is the tell that
something has changed.

Each image has one large foreground subject (often the companion figure,
reframed as tended-to rather than threatening — see REQ-W15-6/16), a bold
silhouette readable at 100x100, and a simplified warm-lit background with
only one or two environmental cues. No frame, title, readable UI copy, logo,
watermark, Walker, Door, gore, crowd, or tiny clutter.

World cards:

- `inset-hes-still-fighting.webp` -> `the-beginning-inset-hes-still-fighting`: a figure holding steady in warm lamplight, gripping something upright rather than letting it fall.
- `inset-the-weight-youre-still-carrying.webp` -> `the-beginning-inset-the-weight-youre-still-carrying`: a bag finally set down at the foot of a warmly lit doorway, still full but no longer being carried.

Reward player cards (all four grief-release rewards plus the companion-care
trio — see the card design doc's "unburden" framing):

- `inset-say-it-out-loud.webp` -> `the-beginning-inset-say-it-out-loud`: a figure speaking plainly into warm light, no one flinching away from it.
- `inset-put-it-down.webp` -> `the-beginning-inset-put-it-down`: a clenched fist opening in warm light, nothing thrown.
- `inset-close-the-book-on-it.webp` -> `the-beginning-inset-close-the-book-on-it`: a ledger or file closed and set aside, gold light catching the cover.
- `inset-set-it-down.webp` -> `the-beginning-inset-set-it-down`: a carried weight lowered gently to rest in warm light, hands still resting on it a moment.
- `inset-watch-over-him.webp` -> `the-beginning-inset-watch-over-him`: a hand steadying a companion's shoulder in warm lamplight, both figures still.
- `inset-help-him-focus.webp` -> `the-beginning-inset-help-him-focus`: two figures looking together at the same point, one gently directing the other's attention.
- `inset-keep-him-upright.webp` -> `the-beginning-inset-keep-him-upright`: an arm braced under a companion's shoulder, weight shared rather than carried alone.

## Prompt template

Use the Direction section matching the card's act; only the palette line and
subject framing change between them.

```text
Full-bleed square illustration, bold graphic-novel comic art with heavy black
ink linework and dramatic chiaroscuro, painted in rich saturated light. One
large [SUBJECT] instantly recognizable in silhouette at thumbnail size,
rim-lit against a simplified dark [ACT-APPROPRIATE] background with only
[ONE OR TWO CUES]. [ACT PALETTE — see the matching Direction section above].
No border, frame, card layout, title, readable text, logo, watermark, Walker,
Door, gore, crowd, or tiny clutter.
```

## Finishing pass and validation

Fit each generated image to 600x600, then finish with contrast `1.12`,
brightness `0.99`, and unsharp mask radius `1.1` / percent `80` / threshold
`4`, matching every other world's finishing pass. Validate all nineteen final
WebPs together on a 100x100 contact sheet for silhouette, subject
distinction, and thumbnail readability — and specifically confirm the
three-act palette progression reads as a deliberate arc (ember-orange-leaning
Act I, cool grey-blue Act II, warm amber-gold Act III) rather than a
inconsistent mix, before wiring any `insetKey` into `src/data/allCards.json`
or binding assets in `worlds/assetBindings.ts` / `data/assetManifest.ts`.
