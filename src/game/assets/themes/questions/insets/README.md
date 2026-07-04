# Questions Inset Art Guidance

Thumbnail-first square inset assets (15). Filename = `inset-<kebab-name>.webp`;
asset key = `questions-inset-<kebab-name>`.

Unlike most other worlds' inset READMEs (where `insetKey` values are already
authored in `src/data/allCards.json`, pointing at keys with no art yet), the
`questions` world's 15 card templates currently have **no `insetKey` field at
all** — a known, flagged gap from the world's initial data-authoring pass (no
cardfront or inset art existed at that time). Once art matching this guidance
exists: add `insetKey: "questions-inset-<kebab-name>"` to each template in
`allCards.json`, then wire the key in `worlds/assetBindings.ts` and
`data/assetManifest.ts` — bind only after final art passes the validation
below, matching the two-step pattern every other world uses.

## Direction

Bold graphic-novel comic illustration with heavy black ink linework, dramatic
chiaroscuro, a strong rim-lit single subject, and rich saturated lighting —
the shared inset house style used by Eden Prime, New Derelict, City of
Sleeping Giants, and others. Insets are deliberately more vivid than this
world's own muted backdrop/overlay palette (`intrusionHue: #9fae9a`, sage-ash
institutional grey); vivid color carries the focal subject, the same way it
does in every other themed world's insets.

Palette: institutional muted sage-ash-grey and hospital-fluorescent cream as
the base (`#e8e6e0` / `#b3b0a6` / `#6e6a62`, matching `QUESTIONS_THEME`),
tarnished gold (`#c9a86a`) as the warmth/confirm accent, a single sparse
ember-orange thread reserved for Anger/Act 3 escalation (present as a quiet
foreshadow in Acts 1-2, allowed to intensify by Act 3 — never the dominant
color of a calm subject), and a bruised violet-grey (`#9a94a8`) reserved for
Denial/withdrawal moments. Never use whiteout-parking-garage's icy saturated
blue anywhere — this world's identity is grief-numbness, not cold.

The signature verb is **compound**: hazards show a small, ordinary moment of
avoidance — a look turned away, a door left shut, a phone left ringing —
compounding the longer it goes unaddressed. This is `Denial`/`Anger` made
visual, not a monster. Reward insets show the opposite motion: a hand finally
reaching for the thing that was being avoided.

Each image has one large foreground subject, a bold silhouette readable at
100x100, and a simplified darker hospital/waiting-room/home background with
only one or two environmental cues. No frame, title, readable UI copy, logo,
watermark, Walker, Door, gore, crowd, or tiny clutter.

## Files and per-card intent

World cards, Act 1 (no Denial/Anger yet — ambient loss, fear, helplessness):

- `inset-waiting-room-silence.webp` -> `questions-inset-waiting-room-silence`: an empty vinyl waiting-room bench under a flickering fluorescent strip, the silence itself the subject.
- `inset-im-outta-here.webp` -> `questions-inset-im-outta-here`: a hand pushing through an exit door, back already turned.
- `inset-the-monitor-keeps-beeping.webp` -> `questions-inset-the-monitor-keeps-beeping`: a bedside monitor mid-beep, its glow the only light in the room.

World cards, Act 2 (Denial):

- `inset-everyone-says-its-nothing.webp` -> `questions-inset-everyone-says-its-nothing`: a reassuring hand on a shoulder, both faces turned away from what's actually being pointed at.
- `inset-the-test-results-sit-unopened.webp` -> `questions-inset-the-test-results-sit-unopened`: a sealed envelope on a counter, undisturbed, dust just beginning to settle on it.
- `inset-she-says-shes-fine.webp` -> `questions-inset-she-says-shes-fine`: a figure managing a small, unconvincing smile, framed to make the effort visible.
- `inset-he-isnt-coming-back.webp` -> `questions-inset-he-isnt-coming-back`: an empty chair at a table set for two, one place setting untouched.

World cards, Act 3 (Anger, plus Destiny):

- `inset-it-isnt-fair.webp` -> `questions-inset-it-isnt-fair`: a fist coming down on a surface, whatever was on it already scattered.
- `inset-nobody-warned-you.webp` -> `questions-inset-nobody-warned-you`: a figure gripping a phone too hard, knuckles pale.
- `inset-the-question-that-has-no-answer.webp` -> `questions-inset-the-question-that-has-no-answer`: a single raised, open hand against a dark room, demanding rather than pleading.
- `inset-destiny.webp` -> `questions-inset-destiny`: a long hospital corridor narrowing toward a single closed door lit from beneath, the accumulated weight of everything not yet said.

Reward player cards:

- `inset-ask-the-question.webp` -> `questions-inset-ask-the-question`: a hand finally breaking a sealed envelope open.
- `inset-let-it-out.webp` -> `questions-inset-let-it-out`: a fist unclenching, tension visibly leaving the frame.
- `inset-why.webp` -> `questions-inset-why`: a figure looking directly upward or outward, not down or away — the one moment of confrontation rather than avoidance.
- `inset-sit-with-it-a-while.webp` -> `questions-inset-sit-with-it-a-while`: a figure simply seated, still, neither reaching nor turning away.

## Prompt template

```text
Full-bleed square illustration, bold graphic-novel comic art with heavy black
ink linework and dramatic chiaroscuro, painted in rich saturated light. One
large [SUBJECT] instantly recognizable in silhouette at thumbnail size,
rim-lit against a simplified dark hospital/waiting-room/home background with
only [ONE OR TWO CUES]. Muted institutional sage-ash-cream palette with
tarnished gold warmth, a single sparse ember-orange thread reserved for
Anger/escalation, and bruised violet-grey reserved for Denial/withdrawal
moments — no icy saturated blue anywhere. No border, frame, card layout,
title, readable text, logo, watermark, Walker, Door, gore, crowd, or tiny
clutter.
```

## Finishing pass and validation

Fit each generated image to 600x600, then finish with contrast `1.12`,
brightness `0.99`, and unsharp mask radius `1.1` / percent `80` / threshold
`4`, matching every other world's finishing pass. Validate all fifteen final
WebPs together on a 100x100 contact sheet for silhouette, subject
distinction, palette consistency (especially confirming no drift toward
whiteout-parking-garage's cold-blue territory), and thumbnail readability
before wiring any `insetKey` into `src/data/allCards.json` or binding assets
in `worlds/assetBindings.ts` / `data/assetManifest.ts`.
