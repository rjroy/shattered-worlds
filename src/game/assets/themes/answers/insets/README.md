# Answers Inset Art Guidance

Thumbnail-first square inset assets (21). Filename = `inset-<kebab-name>.webp`;
asset key = `answers-inset-<kebab-name>`.

All 21 insets (14 world hazards across three acts, plus 7 reward cards) have
been generated per this guidance and are wired: each template in
`src/data/allCards.json` carries its `insetKey: "answers-inset-<kebab-name>"`,
and every key is bound in `worlds/assetBindings.ts`'s `worldAssetUrls`. This
world's own cardfront still doesn't exist (see `theme.ts`'s comment on
`ANSWERS_THEME`) — only the cardfront gap remains open.

`Destiny` is **not** in the 21 count and needs no new inset. It is the
identical `"Destiny"` template reused from `questions` (see
`theme-authoring.md`'s "Template reuse, intentional" note) — the same
entity, not a reskin — so it already has art (`questions-inset-destiny`) and
should keep pointing at that key rather than getting an `answers`-prefixed
duplicate. `The Walker` closer is likewise shared and uncarded here.

## Direction

Bold graphic-novel comic illustration with heavy black ink linework, dramatic
chiaroscuro, a strong rim-lit single subject, and rich saturated lighting —
the shared inset house style used by Eden Prime, New Derelict, City of
Sleeping Giants, Questions, and others. Insets are deliberately more vivid
than this world's own muted backdrop/overlay palette (`intrusionHue:
#8a95a3`); vivid color carries the focal subject, the same way it does in
every other themed world's insets.

Palette: cooler and more desaturated than `questions`' sage-green — pale
grey-blue and dust-cream as the base (`#dfe2e6` / `#9aa3ac` / `#5d636a`,
matching `ANSWERS_THEME`), tarnished gold (`#b08a5a`) as the one warm accent,
reserved for Bargaining/tool-fetch/confirm moments (a deal actually being
struck). Add a sparse violet fracture-light (recommend `#8b7aa8`) reserved
exclusively for Act II's "eleven violet fractures hanging suspended" motif —
present as a hairline crack or bleed-through glow, never the dominant color
of a calm subject. A flat, cooler violet-grey (`#8f8fa0`, matching
`realityPalette.cancel`) carries Depression's stillness in Act III. Never use
`questions`' tarnished-ember-orange escalation thread or
whiteout-parking-garage's icy saturated blue anywhere — this world trends
the opposite direction from `questions`, toward cool and muted rather than
warming toward hot, and the two must stay visually distinct even though they
share a house style.

The signature verb is **concede**: every act is some flavor of giving
something up, whether it's spent chasing a deal (Bargaining, Act I) or given
up on chasing anything at all (Depression, Act III). Act I reads dry,
archival, dust-toned — a Walker searching ledgers and back rooms for a way
out, not yet cornered. Act II is the Door as lore, not threat: fractures
appearing and widening, the visible, accumulating cost of what's being
learned, bridging Bargaining into Depression. Act III desaturates further
into flat grey-blue — the weight has already settled, nothing left to
negotiate.

Each image has one large foreground subject, a bold silhouette readable at
100x100, and a simplified darker archive/back-room/roadside background with
only one or two environmental cues. No frame, title, readable UI copy, logo,
watermark, Walker, Door, gore, crowd, or tiny clutter.

## Files and per-card intent

World cards, Act 1 — Bargaining (dry, archival, dust-toned; searching, not yet
cornered):

- `inset-the-ledger-never-closes.webp` -> `answers-inset-the-ledger-never-closes`: an open ledger whose columns keep re-inking themselves, the totals never staying settled.
- `inset-a-broker-who-owes-nothing.webp` -> `answers-inset-a-broker-who-owes-nothing`: a shadowed figure across a bare desk, hands empty, a contract untouched between them.
- `inset-what-would-you-give-up.webp` -> `answers-inset-what-would-you-give-up`: a hand hovering undecided between a keepsake and a folded stack of unpaid bills.
- `inset-the-archive-has-a-price.webp` -> `answers-inset-the-archive-has-a-price`: a locked archive door with a toll slot, ledger pages just visible through the gap.
- `inset-a-deal-too-easy.webp` -> `answers-inset-a-deal-too-easy`: a handshake closing a beat too eagerly, papers already sliding unattended off the table.
- `inset-a-reading-of-the-ledger.webp` -> `answers-inset-a-reading-of-the-ledger`: a robed reader turning a ledger page toward the viewer, two passages lit, both legible.

World cards, Act 2 — the Door as lore (violet fracture motif, accumulating
visibility, no keyword pressure yet):

- `inset-a-fracture-opens.webp` -> `answers-inset-a-fracture-opens`: a single hairline violet crack splitting open in mid-air, dust sifting through it.
- `inset-another-fracture.webp` -> `answers-inset-another-fracture`: a wider violet fracture branching from the first, heavier light bleeding through the gap.
- `inset-the-point-of-no-return.webp` -> `answers-inset-the-point-of-no-return`: a threshold with fractures converging on it from every side, the last step before crossing.

World cards, Act 3 — Depression (flat grey-blue, weight, stillness,
calcification):

- `inset-the-weight-doesnt-lift.webp` -> `answers-inset-the-weight-doesnt-lift`: a figure standing beneath its own shadow made physically heavy, unable to straighten.
- `inset-it-wont-go-away.webp` -> `answers-inset-it-wont-go-away`: a stone-grey growth spreading slowly across an otherwise ordinary hand or surface.
- `inset-it-calcified.webp` -> `answers-inset-it-calcified`: that same growth now fully solid stone, a hand or gesture fused mid-motion.
- `inset-a-reason-to-keep-moving.webp` -> `answers-inset-a-reason-to-keep-moving`: a single footprint pressed into dust, another beginning faintly ahead of it.
- `inset-just-keep-walking.webp` -> `answers-inset-just-keep-walking`: a lone silhouette walking forward into grey-blue haze, no destination yet visible.

Reward player cards:

- `inset-call-in-the-favor.webp` -> `answers-inset-call-in-the-favor`: a hand closing around a returned token, the broker's ledger snapping shut behind it.
- `inset-a-page-from-the-ledger.webp` -> `answers-inset-a-page-from-the-ledger`: a single torn ledger page held up to light, one line on it legible.
- `inset-ask-for-more-time.webp` -> `answers-inset-ask-for-more-time`: a hand gently staying a clock or hourglass mid-fall.
- `inset-take-whats-owed.webp` -> `answers-inset-take-whats-owed`: a hand taking payment directly, no bargaining left in the gesture, exact and plain.
- `inset-let-it-sit.webp` -> `answers-inset-let-it-sit`: a hand setting a carried weight down to rest instead of carrying it further.
- `inset-keep-walking.webp` -> `answers-inset-keep-walking`: a boot planting forward mid-stride, steady despite a visible drag.
- `inset-let-it-go.webp` -> `answers-inset-let-it-go`: an open hand releasing a scatter of dust or torn paper to open air.

## Prompt template

```text
Full-bleed square illustration, bold graphic-novel comic art with heavy black
ink linework and dramatic chiaroscuro, painted in rich saturated light. One
large [SUBJECT] instantly recognizable in silhouette at thumbnail size,
rim-lit against a simplified dark archive/back-room/roadside background with
only [ONE OR TWO CUES]. Cool, desaturated grey-blue and dust-cream palette
with tarnished gold reserved for Bargaining/deal-making moments, a sparse
violet fracture-light reserved for the Door-as-lore motif, and flat
violet-grey for Depression's stillness — no ember-orange, no icy saturated
blue anywhere. No border, frame, card layout, title, readable text, logo,
watermark, Walker, Door, gore, crowd, or tiny clutter.
```

## Finishing pass and validation

Fit each generated image to 600x600, then finish with contrast `1.12`,
brightness `0.99`, and unsharp mask radius `1.1` / percent `80` / threshold
`4`, matching every other world's finishing pass. Validate all twenty-one
final WebPs together on a 100x100 contact sheet for silhouette, subject
distinction, palette consistency (especially confirming the violet fracture
accent stays sparse and doesn't drift toward `questions`' ember-orange or
whiteout-parking-garage's cold-blue territory), and thumbnail readability
before wiring any `insetKey` into `src/data/allCards.json` or binding assets
in `worlds/assetBindings.ts` / `data/assetManifest.ts`.
